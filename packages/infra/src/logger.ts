import type { LogContext, Logger } from '@zelafin/core';
import { pino, type Logger as Pino } from 'pino';

/** Safety net: personal fields are censored even if someone logs them by mistake. */
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

/** Adapter from pino to the core Logger port. */
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
