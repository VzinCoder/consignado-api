import Fastify, { type FastifyInstance } from 'fastify';
import { carcaraRoutes } from './banks/carcara';
import { ipeRoutes } from './banks/ipe';
import { jangadaRoutes } from './banks/jangada';
import { mandacaruRoutes } from './banks/mandacaru';
import type { MocksConfig } from './config';
import { realRuntime, type Runtime } from './engine';

export interface BuildAppOptions {
  config: Pick<MocksConfig, 'banks' | 'logLevel'>;
  runtime?: Runtime;
}

export function buildApp({ config, runtime = realRuntime }: BuildAppOptions): FastifyInstance {
  const app = Fastify({ logger: { level: config.logLevel } });

  app.get('/health', () => ({ status: 'ok' }));

  void app.register(ipeRoutes({ behavior: config.banks.ipe, runtime }), { prefix: '/ipe' });
  void app.register(mandacaruRoutes({ behavior: config.banks.mandacaru, runtime }), {
    prefix: '/mandacaru',
  });
  void app.register(jangadaRoutes({ behavior: config.banks.jangada, runtime }), {
    prefix: '/jangada/v2',
  });
  void app.register(carcaraRoutes({ behavior: config.banks.carcara, runtime }), {
    prefix: '/carcara',
  });

  return app;
}
