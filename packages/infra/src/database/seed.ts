/**
 * Development seed: replaces all data with fictional customers and simulations.
 * Dates are relative to "now" so the demo always has fresh and expired offers.
 */
import { priceInstallmentCents } from '@zelafin/core';
import { sql } from 'drizzle-orm';
import { getEnv } from '../env';
import { createDatabase } from './client';
import { isLocalDatabase } from './local-database';
import { bankResults, customers, simulations } from './schema';

type NewBankResult = Omit<typeof bankResults.$inferInsert, 'simulationId'>;
type BankSlug = 'ipe' | 'mandacaru' | 'jangada' | 'carcara';

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const INTEREST_DELAY_MS = 10 * MINUTE_MS;

const SEED_RATES: Record<BankSlug, number> = {
  ipe: 0.0179,
  mandacaru: 0.0165,
  jangada: 0.0189,
  carcara: 0.0215,
};

function respondedAfter(startedAt: Date, durationMs: number) {
  return { startedAt, respondedAt: new Date(startedAt.getTime() + durationMs), durationMs };
}

function approved(bank: BankSlug, amountCents: number, months: number, at: Date): NewBankResult {
  const rate = SEED_RATES[bank];
  const installmentCents = priceInstallmentCents(amountCents, rate, months);
  return {
    bankSlug: bank,
    status: 'APPROVED',
    monthlyRate: rate,
    approvedAmountCents: amountCents,
    installmentCents,
    totalCents: installmentCents * months,
    termMonths: months,
    rawResponse: { seed: true, bank, status: 'approved' },
    ...respondedAfter(at, 1200),
  };
}

function rejected(bank: BankSlug, reason: string, at: Date): NewBankResult {
  return {
    bankSlug: bank,
    status: 'REJECTED',
    rejectionReason: reason,
    rawResponse: { seed: true, bank, status: 'rejected', reason },
    ...respondedAfter(at, 900),
  };
}

function failed(bank: BankSlug, reason: string, at: Date): NewBankResult {
  return { bankSlug: bank, status: 'FAILED', failureReason: reason, ...respondedAfter(at, 5000) };
}

type ResultsBuilder = (amountCents: number, months: number, at: Date) => NewBankResult[];

interface SeedSimulation {
  cpf: string;
  ageMs: number;
  salaryCents: number;
  amountCents: number;
  months: number;
  origin?: 'CUSTOMER' | 'ADMIN';
  chosenBank?: BankSlug;
  results: ResultsBuilder;
}

const CUSTOMERS = [
  { cpf: '52998224725', name: 'Ana Souza', email: 'ana.souza@exemplo.com', phone: '11987650001' },
  { cpf: '11144477735', name: 'Bruno Lima', email: 'bruno.lima@exemplo.com', phone: '21987650002' },
  {
    cpf: '12345678143',
    name: 'Carla Mendes',
    email: 'carla.mendes@exemplo.com',
    phone: '31987650003',
  },
  {
    cpf: '74697131401',
    name: 'Diego Rocha',
    email: 'diego.rocha@exemplo.com',
    phone: '41987650004',
  },
  {
    cpf: '28625587887',
    name: 'Elisa Prado',
    email: 'elisa.prado@exemplo.com',
    phone: '51987650005',
  },
];

const EMPLOYER_CNPJS = ['11222333000181', '45271012000199', '60512047000166'] as const;

const allApproved: ResultsBuilder = (amount, months, at) => [
  approved('ipe', amount, months, at),
  approved('mandacaru', amount, months, at),
  approved('jangada', amount, months, at),
  approved('carcara', amount, months, at),
];

const SIMULATIONS: SeedSimulation[] = [
  {
    cpf: '52998224725',
    ageMs: 2 * HOUR_MS,
    salaryCents: 650000,
    amountCents: 1500000,
    months: 48,
    chosenBank: 'mandacaru',
    results: allApproved,
  },
  {
    cpf: '11144477735',
    ageMs: DAY_MS,
    salaryCents: 420000,
    amountCents: 800000,
    months: 36,
    results: (a, m, at) => [
      approved('ipe', a, m, at),
      approved('mandacaru', a, m, at),
      approved('jangada', a, m, at),
      failed('carcara', 'timeout', at),
    ],
  },
  {
    cpf: '12345678143',
    ageMs: 30 * MINUTE_MS,
    salaryCents: 310000,
    amountCents: 1000000,
    months: 60,
    chosenBank: 'ipe',
    results: (a, m, at) => [
      approved('ipe', a, m, at),
      rejected('mandacaru', 'Salário abaixo do mínimo exigido pelo banco', at),
      approved('jangada', a, m, at),
      failed('carcara', 'Resposta fora do contrato', at),
    ],
  },
  {
    cpf: '74697131401',
    ageMs: 5 * DAY_MS,
    salaryCents: 900000,
    amountCents: 3000000,
    months: 72,
    results: allApproved,
  },
  {
    cpf: '28625587887',
    ageMs: 4 * DAY_MS,
    salaryCents: 500000,
    amountCents: 1200000,
    months: 48,
    results: (a, m, at) => [
      approved('ipe', a, m, at),
      approved('mandacaru', a, m, at),
      rejected('jangada', 'Valor acima do limite do banco', at),
      approved('carcara', a, m, at),
    ],
  },
  {
    cpf: '28625587887',
    ageMs: 3 * HOUR_MS,
    salaryCents: 500000,
    amountCents: 600000,
    months: 24,
    origin: 'ADMIN',
    results: allApproved,
  },
  {
    cpf: '52998224725',
    ageMs: 10 * DAY_MS,
    salaryCents: 650000,
    amountCents: 2000000,
    months: 60,
    chosenBank: 'ipe',
    results: allApproved,
  },
];

async function seed(): Promise<void> {
  const env = getEnv();
  // NODE_ENV defaults to development, so it alone is not enough: also require a local database.
  if (env.NODE_ENV === 'production' || !isLocalDatabase(env.DATABASE_URL)) {
    throw new Error('O seed apaga todos os dados e só roda num banco local, fora de produção.');
  }
  const offerTtlMs = env.OFFER_TTL_HOURS * HOUR_MS;

  const { db, close } = createDatabase(env.DATABASE_URL);
  try {
    await db.transaction(async (tx) => {
      await tx.execute(sql`truncate table bank_results, simulations, customers cascade`);

      const inserted = await tx.insert(customers).values(CUSTOMERS).returning();
      const customerIdByCpf = new Map(inserted.map((c) => [c.cpf, c.id]));

      const now = Date.now();
      for (const [index, s] of SIMULATIONS.entries()) {
        const customerId = customerIdByCpf.get(s.cpf);
        if (!customerId) throw new Error(`Cliente do seed não encontrado: ${s.cpf}`);

        const createdAt = new Date(now - s.ageMs);
        const [simulation] = await tx
          .insert(simulations)
          .values({
            customerId,
            employerCnpj: EMPLOYER_CNPJS[index % EMPLOYER_CNPJS.length] ?? EMPLOYER_CNPJS[0],
            salaryCents: s.salaryCents,
            requestedAmountCents: s.amountCents,
            termMonths: s.months,
            origin: s.origin ?? 'CUSTOMER',
            chosenBankSlug: s.chosenBank ?? null,
            interestAt: s.chosenBank ? new Date(createdAt.getTime() + INTEREST_DELAY_MS) : null,
            expiresAt: new Date(createdAt.getTime() + offerTtlMs),
            createdAt,
          })
          .returning({ id: simulations.id });
        if (!simulation) throw new Error('Falha ao inserir simulação do seed');

        const results = s.results(s.amountCents, s.months, createdAt);
        await tx
          .insert(bankResults)
          .values(results.map((r) => ({ ...r, simulationId: simulation.id })));
      }
    });
    console.log(`Seed concluído: ${CUSTOMERS.length} clientes, ${SIMULATIONS.length} simulações.`);
  } finally {
    await close();
  }
}

await seed();
