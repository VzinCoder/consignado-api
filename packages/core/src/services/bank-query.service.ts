import {
  BankIntegrationError,
  BankResultNotRetryableError,
  NotFoundError,
  SimulationExpiredError,
} from '../errors';
import type {
  BankProvider,
  BankResultRepository,
  Clock,
  Logger,
  SimulationRepository,
} from '../interfaces';
import type { BankResult, BankResultCompletion } from '../models';
import { isExpired } from '../rules/simulation';

export interface BankQueryServiceDeps {
  simulations: SimulationRepository;
  bankResults: BankResultRepository;
  providers: BankProvider[];
  clock: Clock;
  logger: Logger;
}

const UNEXPECTED_FAILURE = 'erro inesperado';
const PROVIDER_NOT_CONFIGURED = 'banco não configurado';

export class BankQueryService {
  private readonly providers: Map<string, BankProvider>;

  constructor(private readonly deps: BankQueryServiceDeps) {
    this.providers = new Map(deps.providers.map((p) => [p.slug, p]));
  }

  /** Queries one bank for a PENDING result and stores the outcome. Never throws for bank errors. */
  async query(bankResultId: string): Promise<BankResult | null> {
    const result = await this.deps.bankResults.findById(bankResultId);
    if (result?.status !== 'PENDING') return result;

    const details = await this.deps.simulations.findDetails(result.simulationId);
    if (!details) throw new NotFoundError('Simulação');

    const startedAt = this.deps.clock.now();
    const elapsed = () => this.deps.clock.now().getTime() - startedAt.getTime();
    const completion = await this.ask(result.bankSlug, {
      cpf: details.customer.cpf,
      salaryCents: details.simulation.salaryCents,
      amountCents: details.simulation.requestedAmountCents,
      termMonths: details.simulation.termMonths,
    }).then((outcome) => ({
      ...outcome,
      respondedAt: this.deps.clock.now(),
      durationMs: elapsed(),
    }));

    const saved = await this.deps.bankResults.completeIfPending(result.id, completion);
    this.deps.logger.info('consulta ao banco concluída', {
      bank: result.bankSlug,
      bankResultId: result.id,
      simulationId: result.simulationId,
      status: completion.status,
      durationMs: completion.durationMs,
      reason: completion.status === 'APPROVED' ? null : completion.reason,
      discarded: saved === null,
    });
    return saved ?? (await this.deps.bankResults.findById(result.id));
  }

  private async ask(
    slug: string,
    request: Parameters<BankProvider['simulate']>[0],
  ): Promise<DistributiveOmit<BankResultCompletion, 'respondedAt' | 'durationMs'>> {
    const provider = this.providers.get(slug);
    if (!provider) return { status: 'FAILED', reason: PROVIDER_NOT_CONFIGURED, raw: null };
    try {
      const quote = await provider.simulate(request);
      return quote.outcome === 'APPROVED'
        ? { status: 'APPROVED', offer: quote.offer, raw: quote.raw }
        : { status: 'REJECTED', reason: quote.reason, raw: quote.raw };
    } catch (error) {
      if (error instanceof BankIntegrationError) {
        return { status: 'FAILED', reason: error.reason, raw: null };
      }
      this.deps.logger.error('erro inesperado ao consultar banco', {
        bank: slug,
        error: error instanceof Error ? error.message : String(error),
      });
      return { status: 'FAILED', reason: UNEXPECTED_FAILURE, raw: null };
    }
  }

  /** Queries every PENDING bank of a simulation in parallel; one failure never stops the others. */
  async querySimulation(simulationId: string): Promise<void> {
    const data = await this.deps.simulations.findById(simulationId);
    if (!data) return;
    const pending = data.results.filter((r) => r.status === 'PENDING');
    const outcomes = await Promise.allSettled(pending.map((r) => this.query(r.id)));
    for (const outcome of outcomes) {
      if (outcome.status === 'rejected') {
        this.deps.logger.error('falha ao processar consulta', {
          simulationId,
          error: outcome.reason instanceof Error ? outcome.reason.message : String(outcome.reason),
        });
      }
    }
  }

  /** Manual retry by the admin: only FAILED results of non-expired simulations. */
  async retry(bankResultId: string): Promise<BankResult | null> {
    const result = await this.deps.bankResults.findById(bankResultId);
    if (!result) throw new NotFoundError('Resposta do banco');
    const data = await this.deps.simulations.findById(result.simulationId);
    if (!data) throw new NotFoundError('Simulação');

    const now = this.deps.clock.now();
    if (isExpired(data.simulation, now)) throw new SimulationExpiredError();

    const restarted = await this.deps.bankResults.restartIfFailed(bankResultId, now);
    if (!restarted) throw new BankResultNotRetryableError();

    this.deps.logger.info('reconsulta ao banco solicitada', {
      bank: result.bankSlug,
      bankResultId,
      simulationId: result.simulationId,
    });
    return this.query(bankResultId);
  }
}

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
