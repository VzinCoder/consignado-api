import type {
  BankResult,
  BankResultCompletion,
  BankResultRepository,
  Customer,
  CustomerInput,
  CustomerRepository,
  NewSimulation,
  Offer,
  Simulation,
  SimulationDetails,
  SimulationListFilter,
  SimulationRepository,
  SimulationWithResults,
} from '@zelafin/core';
import {
  and,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  isNotNull,
  like,
  lt,
  or,
  sql,
  type SQL,
} from 'drizzle-orm';
import type { Database } from './client';
import { bankResults, customers, simulations } from './schema';

type CustomerRow = typeof customers.$inferSelect;
type SimulationRow = typeof simulations.$inferSelect;
type BankResultRow = typeof bankResults.$inferSelect;

const toCustomer = (row: CustomerRow): Customer => ({ ...row });
const toSimulation = (row: SimulationRow): Simulation => ({ ...row });

/** As colunas de oferta podem ser nulas: apenas uma linha APPROVED com todas preenchidas tem oferta. */
function offerOf(row: BankResultRow): Offer | null {
  const { monthlyRate, approvedAmountCents, installmentCents, totalCents, termMonths } = row;
  if (
    row.status !== 'APPROVED' ||
    monthlyRate === null ||
    approvedAmountCents === null ||
    installmentCents === null ||
    totalCents === null ||
    termMonths === null
  ) {
    return null;
  }
  return { monthlyRate, approvedAmountCents, installmentCents, totalCents, termMonths };
}

function toBankResult(row: BankResultRow): BankResult {
  return {
    id: row.id,
    simulationId: row.simulationId,
    bankSlug: row.bankSlug,
    status: row.status,
    offer: offerOf(row),
    rejectionReason: row.rejectionReason,
    failureReason: row.failureReason,
    startedAt: row.startedAt,
    respondedAt: row.respondedAt,
    durationMs: row.durationMs,
  };
}

const escapeLike = (value: string) => value.replace(/[\\%_]/g, (c) => `\\${c}`);

export class DrizzleCustomerRepository implements CustomerRepository {
  constructor(private readonly db: Database) {}

  async upsertByCpf(input: CustomerInput): Promise<Customer> {
    const [row] = await this.db
      .insert(customers)
      .values(input)
      .onConflictDoUpdate({
        target: customers.cpf,
        set: { name: input.name, email: input.email, phone: input.phone, updatedAt: sql`now()` },
      })
      .returning();
    if (!row) throw new Error('upsert de cliente não retornou linha');
    return toCustomer(row);
  }
}

export class DrizzleSimulationRepository implements SimulationRepository {
  constructor(private readonly db: Database) {}

  async create(input: NewSimulation, bankSlugs: string[]): Promise<SimulationWithResults> {
    return this.db.transaction(async (tx) => {
      const [simulation] = await tx.insert(simulations).values(input).returning();
      if (!simulation) throw new Error('criação de simulação não retornou linha');
      const results = await tx
        .insert(bankResults)
        .values(
          bankSlugs.map((bankSlug) => ({
            simulationId: simulation.id,
            bankSlug,
            status: 'PENDING' as const,
            startedAt: input.createdAt,
          })),
        )
        .returning();
      return { simulation: toSimulation(simulation), results: results.map(toBankResult) };
    });
  }

  private async resultsFor(simulationIds: string[]): Promise<Map<string, BankResult[]>> {
    const bySimulation = new Map<string, BankResult[]>();
    if (simulationIds.length === 0) return bySimulation;
    const rows = await this.db
      .select()
      .from(bankResults)
      .where(inArray(bankResults.simulationId, simulationIds));
    for (const row of rows) {
      const list = bySimulation.get(row.simulationId) ?? [];
      list.push(toBankResult(row));
      bySimulation.set(row.simulationId, list);
    }
    return bySimulation;
  }

  async findById(id: string): Promise<SimulationWithResults | null> {
    const [row] = await this.db.select().from(simulations).where(eq(simulations.id, id));
    if (!row) return null;
    const results = await this.resultsFor([row.id]);
    return { simulation: toSimulation(row), results: results.get(row.id) ?? [] };
  }

  async findDetails(id: string): Promise<SimulationDetails | null> {
    const [details] = await this.detailsWhere(eq(simulations.id, id), 1);
    return details ?? null;
  }

  async list(filter: SimulationListFilter): Promise<SimulationDetails[]> {
    const conditions: SQL[] = [];
    if (filter.createdFrom) conditions.push(gte(simulations.createdAt, filter.createdFrom));
    if (filter.onlyWithInterest) conditions.push(isNotNull(simulations.chosenBankSlug));

    const search = filter.search?.trim();
    if (search) {
      const digits = search.replace(/\D/g, '');
      const byName = ilike(customers.name, `%${escapeLike(search)}%`);
      const searchCondition = digits
        ? or(byName, like(customers.cpf, `%${digits}%`), like(customers.phone, `%${digits}%`))
        : byName;
      if (searchCondition) conditions.push(searchCondition);
    }

    return this.detailsWhere(conditions.length > 0 ? and(...conditions) : undefined, filter.limit);
  }

  private async detailsWhere(where: SQL | undefined, limit: number): Promise<SimulationDetails[]> {
    const rows = await this.db
      .select({ simulation: simulations, customer: customers })
      .from(simulations)
      .innerJoin(customers, eq(customers.id, simulations.customerId))
      .where(where)
      .orderBy(desc(simulations.createdAt))
      .limit(limit);
    const results = await this.resultsFor(rows.map((r) => r.simulation.id));
    return rows.map((r) => ({
      simulation: toSimulation(r.simulation),
      customer: toCustomer(r.customer),
      results: results.get(r.simulation.id) ?? [],
    }));
  }

  async setInterest(id: string, bankSlug: string, at: Date): Promise<Simulation> {
    const [row] = await this.db
      .update(simulations)
      .set({ chosenBankSlug: bankSlug, interestAt: at })
      .where(eq(simulations.id, id))
      .returning();
    if (!row) throw new Error(`simulação ${id} não encontrada`);
    return toSimulation(row);
  }
}

export class DrizzleBankResultRepository implements BankResultRepository {
  constructor(private readonly db: Database) {}

  async findById(id: string): Promise<BankResult | null> {
    const [row] = await this.db.select().from(bankResults).where(eq(bankResults.id, id));
    return row ? toBankResult(row) : null;
  }

  async completeIfPending(
    id: string,
    completion: BankResultCompletion,
  ): Promise<BankResult | null> {
    const offer = completion.status === 'APPROVED' ? completion.offer : null;
    const [row] = await this.db
      .update(bankResults)
      .set({
        status: completion.status,
        monthlyRate: offer?.monthlyRate ?? null,
        approvedAmountCents: offer?.approvedAmountCents ?? null,
        installmentCents: offer?.installmentCents ?? null,
        totalCents: offer?.totalCents ?? null,
        termMonths: offer?.termMonths ?? null,
        rejectionReason: completion.status === 'REJECTED' ? completion.reason : null,
        failureReason: completion.status === 'FAILED' ? completion.reason : null,
        rawResponse: completion.raw ?? null,
        respondedAt: completion.respondedAt,
        durationMs: completion.durationMs,
      })
      .where(and(eq(bankResults.id, id), eq(bankResults.status, 'PENDING')))
      .returning();
    return row ? toBankResult(row) : null;
  }

  async restartIfFailed(id: string, startedAt: Date): Promise<BankResult | null> {
    const [row] = await this.db
      .update(bankResults)
      .set({
        status: 'PENDING',
        monthlyRate: null,
        approvedAmountCents: null,
        installmentCents: null,
        totalCents: null,
        termMonths: null,
        rejectionReason: null,
        failureReason: null,
        rawResponse: null,
        startedAt,
        respondedAt: null,
        durationMs: null,
      })
      .where(and(eq(bankResults.id, id), eq(bankResults.status, 'FAILED')))
      .returning();
    return row ? toBankResult(row) : null;
  }

  async failStalePending(
    startedBefore: Date,
    reason: string,
    at: Date,
    simulationId?: string,
  ): Promise<number> {
    const conditions = [
      eq(bankResults.status, 'PENDING'),
      lt(bankResults.startedAt, startedBefore),
    ];
    if (simulationId) conditions.push(eq(bankResults.simulationId, simulationId));
    const rows = await this.db
      .update(bankResults)
      .set({ status: 'FAILED', failureReason: reason, respondedAt: at })
      .where(and(...conditions))
      .returning({ id: bankResults.id });
    return rows.length;
  }
}
