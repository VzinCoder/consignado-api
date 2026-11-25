import {
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

const CPF_LENGTH = 11;
const CNPJ_LENGTH = 14;
const BANK_SLUG_MAX_LENGTH = 32;

const timestamptz = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' });

export const bankResultStatus = pgEnum('bank_result_status', [
  'PENDING',
  'APPROVED',
  'REJECTED',
  'FAILED',
]);

export const simulationOrigin = pgEnum('simulation_origin', ['CUSTOMER', 'ADMIN']);

export const customers = pgTable('customers', {
  id: uuid('id').primaryKey().defaultRandom(),
  cpf: varchar('cpf', { length: CPF_LENGTH }).notNull().unique(),
  name: text('name').notNull(),
  email: text('email').notNull(),
  phone: text('phone').notNull(),
  createdAt: timestamptz('created_at').notNull().defaultNow(),
  updatedAt: timestamptz('updated_at').notNull().defaultNow(),
});

export const simulations = pgTable(
  'simulations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    customerId: uuid('customer_id')
      .notNull()
      .references(() => customers.id),
    employerCnpj: varchar('employer_cnpj', { length: CNPJ_LENGTH }).notNull(),
    salaryCents: integer('salary_cents').notNull(),
    requestedAmountCents: integer('requested_amount_cents').notNull(),
    termMonths: integer('term_months').notNull(),
    origin: simulationOrigin('origin').notNull().default('CUSTOMER'),
    chosenBankSlug: varchar('chosen_bank_slug', { length: BANK_SLUG_MAX_LENGTH }),
    interestAt: timestamptz('interest_at'),
    expiresAt: timestamptz('expires_at').notNull(),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
  },
  (table) => [
    index('simulations_created_at_idx').on(table.createdAt),
    index('simulations_customer_id_idx').on(table.customerId),
  ],
);

export const bankResults = pgTable(
  'bank_results',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    simulationId: uuid('simulation_id')
      .notNull()
      .references(() => simulations.id, { onDelete: 'cascade' }),
    bankSlug: varchar('bank_slug', { length: BANK_SLUG_MAX_LENGTH }).notNull(),
    status: bankResultStatus('status').notNull().default('PENDING'),
    monthlyRate: doublePrecision('monthly_rate'),
    approvedAmountCents: integer('approved_amount_cents'),
    installmentCents: integer('installment_cents'),
    totalCents: integer('total_cents'),
    termMonths: integer('term_months'),
    rejectionReason: text('rejection_reason'),
    failureReason: text('failure_reason'),
    rawResponse: jsonb('raw_response'),
    startedAt: timestamptz('started_at').notNull().defaultNow(),
    respondedAt: timestamptz('responded_at'),
    durationMs: integer('duration_ms'),
  },
  (table) => [
    unique('bank_results_simulation_bank_unique').on(table.simulationId, table.bankSlug),
    index('bank_results_status_idx').on(table.status),
  ],
);
