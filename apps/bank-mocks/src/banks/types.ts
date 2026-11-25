import type { BankBehavior, Runtime } from '../engine';

export interface BankRouteDeps {
  behavior: BankBehavior;
  runtime: Runtime;
}
