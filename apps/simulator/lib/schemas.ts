import { z } from 'zod';

/**
 * Shape-only validation shared by forms and route handlers.
 * Business rules (CPF digits, margin, limits) live in @zelafin/core.
 */

export const loanTermsSchema = z.object({
  salaryCents: z.number().int(),
  requestedAmountCents: z.number().int(),
  termMonths: z.number().int(),
});

export const personalDataSchema = z.object({
  name: z.string().trim().min(1, 'Informe seu nome completo.'),
  cpf: z.string().min(1, 'Informe seu CPF.'),
  phone: z.string().min(1, 'Informe seu telefone.'),
  email: z.string().min(1, 'Informe seu e-mail.'),
  employerCnpj: z.string().min(1, 'Informe o CNPJ do empregador.'),
});

export const createSimulationSchema = loanTermsSchema.extend(personalDataSchema.shape);

export const interestSchema = z.object({ bankSlug: z.string().min(1) });

export type LoanTerms = z.infer<typeof loanTermsSchema>;
export type PersonalData = z.infer<typeof personalDataSchema>;
export type CreateSimulationBody = z.infer<typeof createSimulationSchema>;
