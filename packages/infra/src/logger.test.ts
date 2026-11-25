import { Writable } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { PinoLogger, createPino } from './logger';

describe('PinoLogger', () => {
  it('censors personal fields', () => {
    const lines: string[] = [];
    const sink = new Writable({
      write(chunk: Buffer, _encoding, callback) {
        lines.push(chunk.toString());
        callback();
      },
    });
    const logger = new PinoLogger(createPino('info', sink));

    logger.info('consulta', { bank: 'ipe', cpf: '52998224725', email: 'a@b.com', durationMs: 10 });

    const output = lines.join('');
    expect(output).not.toContain('52998224725');
    expect(output).not.toContain('a@b.com');
    expect(output).toContain('"bank":"ipe"');
    expect(output).toContain('[oculto]');
  });
});
