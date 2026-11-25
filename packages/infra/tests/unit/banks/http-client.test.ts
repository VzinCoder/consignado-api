import { describe, expect, it } from 'vitest';
import { postJson, type FetchFn } from '../../../src/banks/http-client';
import {
  BASE_URL,
  TIMEOUT_MS,
  failureReason,
  hanging,
  networkDown,
} from '../../helpers/fake-fetch';

describe('postJson', () => {
  it('times out using the configured limit', async () => {
    expect(
      await failureReason(postJson(BASE_URL, {}, { timeoutMs: TIMEOUT_MS, fetch: hanging })),
    ).toBe('timeout após 20 ms');
  });

  it('converts network errors', async () => {
    expect(
      await failureReason(postJson(BASE_URL, {}, { timeoutMs: TIMEOUT_MS, fetch: networkDown })),
    ).toBe('erro de rede ao chamar o banco');
  });

  it('rejects bodies that are not JSON', async () => {
    const html: FetchFn = () => Promise.resolve(new Response('<html>', { status: 502 }));
    expect(
      await failureReason(postJson(BASE_URL, {}, { timeoutMs: TIMEOUT_MS, fetch: html })),
    ).toBe('HTTP 502 com corpo que não é JSON');
  });
});
