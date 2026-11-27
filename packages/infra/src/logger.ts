import type { LogContext, Logger } from '@zelafin/core';
import { pino, type Logger as Pino } from 'pino';

/** Rede de segurança: campos pessoais são censurados mesmo se alguém logá-los por engano. */
export const REDACTED_FIELDS = ['cpf', 'email', 'phone', 'salaryCents', 'name'];

export function createPino(level: string, destination?: NodeJS.WritableStream): Pino {
  const options = {
    level,
    base: { service: 'zelafin' },
    redact: {
      paths: [...REDACTED_FIELDS, ...REDACTED_FIELDS.map((field) => `*.${field}`)],
      censor: '[oculto]',
    },
  };
  return destination ? pino(options, destination) : pino(options);
}

/** Adaptador do pino para a porta Logger do core. */
export class PinoLogger implements Logger {
  constructor(private readonly pino: Pino) {}

  info(message: string, context?: LogContext): void {
    this.pino.info(context ?? {}, message);
  }
  warn(message: string, context?: LogContext): void {
    this.pino.warn(context ?? {}, message);
  }
  error(message: string, context?: LogContext): void {
    this.pino.error(context ?? {}, message);
  }
}
