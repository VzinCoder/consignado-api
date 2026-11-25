import { BankQueryService, SimulationService, type BankProvider, type Logger } from '@zelafin/core';
import {
  CarcaraProvider,
  IpeProvider,
  JangadaProvider,
  MandacaruProvider,
} from './banks/providers';
import { createDatabase } from './database/client';
import {
  DrizzleBankResultRepository,
  DrizzleCustomerRepository,
  DrizzleSimulationRepository,
} from './database/repositories';
import { getEnv, type Env } from './env';
import { PinoLogger, createPino } from './logger';

export interface Container {
  simulationService: SimulationService;
  bankQueryService: BankQueryService;
  logger: Logger;
  close: () => Promise<void>;
}

const systemClock = { now: () => new Date() };

/** The only place that instantiates implementations and wires the services. */
export function createContainer(env: Env): Container {
  const { db, close } = createDatabase(env.DATABASE_URL);
  const logger = new PinoLogger(createPino(env.LOG_LEVEL));

  const providerOptions = { baseUrl: env.BANK_MOCKS_URL, timeoutMs: env.BANK_TIMEOUT_MS };
  // New bank = new provider + one line here.
  const providers: BankProvider[] = [
    new IpeProvider(providerOptions),
    new MandacaruProvider(providerOptions),
    new JangadaProvider(providerOptions),
    new CarcaraProvider(providerOptions),
  ];

  const customers = new DrizzleCustomerRepository(db);
  const simulations = new DrizzleSimulationRepository(db);
  const bankResults = new DrizzleBankResultRepository(db);

  return {
    simulationService: new SimulationService({
      customers,
      simulations,
      bankResults,
      providers,
      clock: systemClock,
      config: { offerTtlHours: env.OFFER_TTL_HOURS, bankTimeoutMs: env.BANK_TIMEOUT_MS },
    }),
    bankQueryService: new BankQueryService({
      simulations,
      bankResults,
      providers,
      clock: systemClock,
      logger,
    }),
    logger,
    close,
  };
}

declare global {
  // Survives Next.js hot reload in dev so we don't open a new pool on every change.
  var __zelafinContainer: Container | undefined;
}

/** Lazily creates the container on first use (never at import time: `next build` has no database). */
export function getContainer(): Container {
  globalThis.__zelafinContainer ??= createContainer(getEnv());
  return globalThis.__zelafinContainer;
}
