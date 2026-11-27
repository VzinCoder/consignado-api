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

/** Único lugar que instancia implementações e conecta os serviços. */
export function createContainer(env: Env): Container {
  const { db, close } = createDatabase(env.DATABASE_URL);
  const logger = new PinoLogger(createPino(env.LOG_LEVEL));

  const providerOptions = { baseUrl: env.BANK_MOCKS_URL, timeoutMs: env.BANK_TIMEOUT_MS };
  // Novo banco = novo provider + uma linha aqui.
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
  // Sobrevive ao hot reload do Next.js em dev para não abrir um novo pool a cada alteração.
  var __zelafinContainer: Container | undefined;
}

/** Cria o container sob demanda no primeiro uso (nunca no import: `next build` não tem banco). */
export function getContainer(): Container {
  globalThis.__zelafinContainer ??= createContainer(getEnv());
  return globalThis.__zelafinContainer;
}
