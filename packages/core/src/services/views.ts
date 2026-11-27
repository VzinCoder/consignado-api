import type { BankProvider } from '../interfaces';
import type {
  BankResult,
  BankResultStatus,
  Offer,
  SimulationDetails,
  SimulationOrigin,
  SimulationStatus,
  SimulationWithResults,
} from '../models';
import { maskCpf } from '../rules/documents';
import {
  compareOffers,
  deriveStatus,
  isApproved,
  isExpired,
  pickBestOffer,
} from '../rules/simulation';

export interface BankResultView {
  bankSlug: string;
  bankName: string;
  status: BankResultStatus;
  offer: Offer | null;
  rejectionReason: string | null;
  isBest: boolean;
}

/** O que o cliente vê pelo link com UUID: sem CPF, e-mail, telefone ou salário. */
export interface PublicSimulationView {
  id: string;
  customerFirstName: string;
  status: SimulationStatus;
  requestedAmountCents: number;
  termMonths: number;
  createdAt: Date;
  expiresAt: Date;
  chosenBankSlug: string | null;
  interestAt: Date | null;
  bestOfferBankSlug: string | null;
  results: BankResultView[];
}

export interface AdminBankResultView extends BankResultView {
  id: string;
  failureReason: string | null;
  startedAt: Date;
  respondedAt: Date | null;
  durationMs: number | null;
  retryable: boolean;
}

export interface AdminSimulationView extends Omit<
  PublicSimulationView,
  'results' | 'customerFirstName'
> {
  origin: SimulationOrigin;
  salaryCents: number;
  employerCnpj: string;
  customer: { name: string; email: string; phone: string; maskedCpf: string };
  results: AdminBankResultView[];
}

export interface BestOfferSummary {
  bankSlug: string;
  bankName: string;
  installmentCents: number;
  totalCents: number;
  monthlyRate: number;
}

export interface AdminSimulationSummary {
  id: string;
  customerName: string;
  maskedCpf: string;
  phone: string;
  requestedAmountCents: number;
  termMonths: number;
  status: SimulationStatus;
  origin: SimulationOrigin;
  createdAt: Date;
  expiresAt: Date;
  interestAt: Date | null;
  chosenBank: BestOfferSummary | null;
  bestOffer: BestOfferSummary | null;
  counts: Record<BankResultStatus, number>;
  /** Algum banco está FAILED e a simulação ainda vale: a equipe deve reconsultá-lo. */
  needsRetry: boolean;
}

export class ViewBuilder {
  private readonly order: Map<string, number>;
  private readonly names: Map<string, string>;

  constructor(providers: BankProvider[]) {
    this.order = new Map(providers.map((p, index) => [p.slug, index]));
    this.names = new Map(providers.map((p) => [p.slug, p.name]));
  }

  bankName(slug: string): string {
    return this.names.get(slug) ?? slug;
  }

  /** Ofertas aprovadas primeiro, da melhor para a pior; depois os demais bancos na ordem dos providers. */
  private sorted(results: BankResult[]): BankResult[] {
    const position = (slug: string) => this.order.get(slug) ?? Number.MAX_SAFE_INTEGER;
    const approved = results.filter(isApproved).sort(compareOffers);
    const others = results
      .filter((r) => !isApproved(r))
      .sort((a, b) => position(a.bankSlug) - position(b.bankSlug));
    return [...approved, ...others];
  }

  private resultView(result: BankResult, bestSlug: string | null): BankResultView {
    return {
      bankSlug: result.bankSlug,
      bankName: this.bankName(result.bankSlug),
      status: result.status,
      offer: result.offer,
      rejectionReason: result.rejectionReason,
      isBest: result.bankSlug === bestSlug,
    };
  }

  private summaryOf(result: BankResult | null | undefined): BestOfferSummary | null {
    if (!result?.offer) return null;
    return {
      bankSlug: result.bankSlug,
      bankName: this.bankName(result.bankSlug),
      installmentCents: result.offer.installmentCents,
      totalCents: result.offer.totalCents,
      monthlyRate: result.offer.monthlyRate,
    };
  }

  publicView(data: SimulationWithResults, customerName: string, now: Date): PublicSimulationView {
    const { simulation, results } = data;
    const best = pickBestOffer(results, simulation);
    const bestSlug = best?.bankSlug ?? null;
    return {
      id: simulation.id,
      customerFirstName: customerName.split(' ')[0] ?? customerName,
      status: deriveStatus(simulation, results, now),
      requestedAmountCents: simulation.requestedAmountCents,
      termMonths: simulation.termMonths,
      createdAt: simulation.createdAt,
      expiresAt: simulation.expiresAt,
      chosenBankSlug: simulation.chosenBankSlug,
      interestAt: simulation.interestAt,
      bestOfferBankSlug: bestSlug,
      results: this.sorted(results).map((r) => this.resultView(r, bestSlug)),
    };
  }

  adminView(details: SimulationDetails, now: Date): AdminSimulationView {
    const {
      results: _publicResults,
      customerFirstName: _first,
      ...base
    } = this.publicView(details, details.customer.name, now);
    const expired = isExpired(details.simulation, now);
    const bestSlug = base.bestOfferBankSlug;
    return {
      ...base,
      origin: details.simulation.origin,
      salaryCents: details.simulation.salaryCents,
      employerCnpj: details.simulation.employerCnpj,
      customer: {
        name: details.customer.name,
        email: details.customer.email,
        phone: details.customer.phone,
        maskedCpf: maskCpf(details.customer.cpf),
      },
      results: this.sorted(details.results).map((r) => ({
        ...this.resultView(r, bestSlug),
        id: r.id,
        failureReason: r.failureReason,
        startedAt: r.startedAt,
        respondedAt: r.respondedAt,
        durationMs: r.durationMs,
        retryable: r.status === 'FAILED' && !expired,
      })),
    };
  }

  summary(details: SimulationDetails, now: Date): AdminSimulationSummary {
    const { simulation, customer, results } = details;
    const counts: Record<BankResultStatus, number> = {
      PENDING: 0,
      APPROVED: 0,
      REJECTED: 0,
      FAILED: 0,
    };
    for (const result of results) counts[result.status] += 1;
    const chosen = results.find((r) => r.bankSlug === simulation.chosenBankSlug);
    return {
      id: simulation.id,
      customerName: customer.name,
      maskedCpf: maskCpf(customer.cpf),
      phone: customer.phone,
      requestedAmountCents: simulation.requestedAmountCents,
      termMonths: simulation.termMonths,
      status: deriveStatus(simulation, results, now),
      origin: simulation.origin,
      createdAt: simulation.createdAt,
      expiresAt: simulation.expiresAt,
      interestAt: simulation.interestAt,
      chosenBank: this.summaryOf(chosen),
      bestOffer: this.summaryOf(pickBestOffer(results, simulation)),
      counts,
      needsRetry: counts.FAILED > 0 && !isExpired(simulation, now),
    };
  }
}
