/**
 * Integration tests against a real Postgres. Skipped when DATABASE_URL is not set
 * (CI provides a Postgres service and runs migrations first).
 */
import { inArray } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDatabase, type DatabaseConnection } from '../../../src/database/client';
import {
  DrizzleBankResultRepository,
  DrizzleCustomerRepository,
  DrizzleSimulationRepository,
} from '../../../src/database/repositories';
import { customers, simulations } from '../../../src/database/schema';

const DATABASE_URL = process.env.DATABASE_URL;
// Valid fictional CPFs reserved for these tests.
const CPF_A = '39053344705';
const CPF_B = '15350946056';

describe.skipIf(!DATABASE_URL)('Drizzle repositories', () => {
  let connection: DatabaseConnection;
  let customerRepo: DrizzleCustomerRepository;
  let simulationRepo: DrizzleSimulationRepository;
  let resultRepo: DrizzleBankResultRepository;

  async function cleanup() {
    const rows = await connection.db
      .select({ id: customers.id })
      .from(customers)
      .where(inArray(customers.cpf, [CPF_A, CPF_B]));
    const ids = rows.map((r) => r.id);
    if (ids.length === 0) return;
    await connection.db.delete(simulations).where(inArray(simulations.customerId, ids));
    await connection.db.delete(customers).where(inArray(customers.id, ids));
  }

  beforeAll(async () => {
    connection = createDatabase(DATABASE_URL ?? '');
    customerRepo = new DrizzleCustomerRepository(connection.db);
    simulationRepo = new DrizzleSimulationRepository(connection.db);
    resultRepo = new DrizzleBankResultRepository(connection.db);
    await cleanup();
  });

  afterAll(async () => {
    await cleanup();
    await connection.close();
  });

  const now = new Date();
  const newSimulation = (customerId: string, createdAt = now) => ({
    customerId,
    employerCnpj: '11222333000181',
    salaryCents: 500_000,
    requestedAmountCents: 1_000_000,
    termMonths: 48,
    origin: 'CUSTOMER' as const,
    createdAt,
    expiresAt: new Date(createdAt.getTime() + 72 * 3_600_000),
  });

  it('upserts customers by CPF', async () => {
    const first = await customerRepo.upsertByCpf({
      cpf: CPF_A,
      name: 'Teste Repo',
      email: 'repo@exemplo.com',
      phone: '11900000001',
    });
    const second = await customerRepo.upsertByCpf({
      cpf: CPF_A,
      name: 'Teste Repo',
      email: 'repo@exemplo.com',
      phone: '11900000002',
    });
    expect(second.id).toBe(first.id);
    expect(second.phone).toBe('11900000002');
  });

  it('creates a simulation with PENDING results and completes them conditionally', async () => {
    const customer = await customerRepo.upsertByCpf({
      cpf: CPF_A,
      name: 'Teste Repo',
      email: 'repo@exemplo.com',
      phone: '11900000001',
    });
    const { simulation, results } = await simulationRepo.create(newSimulation(customer.id), [
      'ipe',
      'carcara',
    ]);
    expect(results.map((r) => r.status)).toEqual(['PENDING', 'PENDING']);
    const [ipe, carcara] = results;
    if (!ipe || !carcara) throw new Error('missing results');

    const offer = {
      monthlyRate: 0.0183,
      approvedAmountCents: 1_000_000,
      installmentCents: 31_484,
      totalCents: 1_511_232,
      termMonths: 48,
    };
    const approved = await resultRepo.completeIfPending(ipe.id, {
      status: 'APPROVED',
      offer,
      raw: { ok: true },
      respondedAt: new Date(),
      durationMs: 120,
    });
    expect(approved?.offer).toEqual(offer);

    const again = await resultRepo.completeIfPending(ipe.id, {
      status: 'FAILED',
      reason: 'x',
      raw: null,
      respondedAt: new Date(),
      durationMs: 1,
    });
    expect(again).toBeNull();

    await resultRepo.completeIfPending(carcara.id, {
      status: 'FAILED',
      reason: 'HTTP 503',
      raw: null,
      respondedAt: new Date(),
      durationMs: 10,
    });
    expect(await resultRepo.restartIfFailed(ipe.id, new Date())).toBeNull();
    const restarted = await resultRepo.restartIfFailed(carcara.id, new Date());
    expect(restarted).toMatchObject({ status: 'PENDING', failureReason: null });

    const updated = await simulationRepo.setInterest(simulation.id, 'ipe', new Date());
    expect(updated.chosenBankSlug).toBe('ipe');

    const details = await simulationRepo.findDetails(simulation.id);
    expect(details?.customer.cpf).toBe(CPF_A);
    expect(details?.results).toHaveLength(2);
  });

  it('fails stale PENDING results', async () => {
    const customer = await customerRepo.upsertByCpf({
      cpf: CPF_B,
      name: 'Outro Cliente',
      email: 'outro@exemplo.com',
      phone: '11900000003',
    });
    const old = new Date(Date.now() - 10 * 60_000);
    const { results } = await simulationRepo.create(newSimulation(customer.id, old), ['jangada']);
    const count = await resultRepo.failStalePending(
      new Date(Date.now() - 60_000),
      'timeout',
      new Date(),
    );
    expect(count).toBeGreaterThanOrEqual(1);
    expect((await resultRepo.findById(results[0]?.id ?? ''))?.status).toBe('FAILED');
  });

  it('lists most recent first and searches by name and CPF digits', async () => {
    const byName = await simulationRepo.list({ search: 'outro cli', limit: 10 });
    expect(byName.every((d) => d.customer.cpf === CPF_B)).toBe(true);
    expect(byName.length).toBeGreaterThan(0);

    const byCpf = await simulationRepo.list({ search: '390.533', limit: 10 });
    expect(byCpf.every((d) => d.customer.cpf === CPF_A)).toBe(true);
    expect(byCpf.length).toBeGreaterThan(0);

    const withInterest = await simulationRepo.list({ onlyWithInterest: true, limit: 200 });
    expect(withInterest.some((d) => d.customer.cpf === CPF_A)).toBe(true);
    const dates = withInterest.map((d) => d.simulation.createdAt.getTime());
    expect([...dates].sort((a, b) => b - a)).toEqual(dates);
  });
});
