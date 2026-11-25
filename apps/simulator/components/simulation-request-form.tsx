'use client';

import { ArrowRight, Calendar, Coins, Loader2, ReceiptText } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Field, inputClass } from '@/components/field';
import { MoneyInput } from '@/components/money-input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ApiError, api } from '@/lib/api-client';
import { TERM_OPTIONS, formatMoney } from '@/lib/format';
import type { LoanTerms } from '@/lib/schemas';
import { loanTermsQuery } from '@/lib/search-params';

interface Props {
  initial: LoanTerms;
}

type FieldErrors = Partial<Record<keyof LoanTerms, string>>;

export function SimulationRequestForm({ initial }: Props) {
  const router = useRouter();
  const { control, handleSubmit, watch } = useForm<LoanTerms>({ defaultValues: initial });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const salaryCents = watch('salaryCents');
  const marginBlocked = Boolean(errors.requestedAmountCents);

  const onSubmit = handleSubmit(async (terms) => {
    setSubmitting(true);
    setFormError(null);
    try {
      const margin = await api.checkMargin(terms);
      if (!margin.fits) {
        setErrors({
          requestedAmountCents: `O valor pedido passa do limite para o seu salário. Com ${formatMoney(terms.salaryCents)}, você pode simular até ${formatMoney(margin.maxAmountCents)}.`,
        });
        return;
      }
      router.push(`/simular/dados?${loanTermsQuery(terms)}`);
    } catch (error) {
      if (error instanceof ApiError && Object.keys(error.fields).length > 0) {
        setErrors(error.fields);
      } else {
        setFormError(error instanceof Error ? error.message : 'Algo deu errado.');
      }
    } finally {
      setSubmitting(false);
    }
  });

  const clearError = (field: keyof LoanTerms) => {
    setErrors((current) => ({ ...current, [field]: undefined }));
  };

  return (
    <form onSubmit={(event) => void onSubmit(event)} className="flex flex-col gap-4" noValidate>
      <Field id="salary" label="Salário mensal" icon={Coins} error={errors.salaryCents}>
        <Controller
          control={control}
          name="salaryCents"
          render={({ field }) => (
            <MoneyInput
              id="salary"
              placeholder="R$ 0,00"
              className={inputClass(true, errors.salaryCents)}
              valueCents={field.value}
              onValueChange={(cents) => {
                field.onChange(cents);
                clearError('salaryCents');
                clearError('requestedAmountCents');
              }}
            />
          )}
        />
      </Field>

      <Field
        id="amount"
        label="Valor desejado"
        icon={ReceiptText}
        error={errors.requestedAmountCents}
      >
        <Controller
          control={control}
          name="requestedAmountCents"
          render={({ field }) => (
            <MoneyInput
              id="amount"
              placeholder="R$ 0,00"
              aria-invalid={Boolean(errors.requestedAmountCents)}
              className={inputClass(true, errors.requestedAmountCents)}
              valueCents={field.value}
              onValueChange={(cents) => {
                field.onChange(cents);
                clearError('requestedAmountCents');
              }}
            />
          )}
        />
      </Field>

      <Field id="term" label="Prazo" icon={Calendar} error={errors.termMonths}>
        <Controller
          control={control}
          name="termMonths"
          render={({ field }) => (
            <Select
              value={String(field.value)}
              onValueChange={(value) => {
                field.onChange(Number(value));
                clearError('termMonths');
                clearError('requestedAmountCents');
              }}
            >
              <SelectTrigger id="term" className={`${inputClass(true)} w-full`}>
                <SelectValue placeholder="Escolha o prazo" />
              </SelectTrigger>
              <SelectContent>
                {TERM_OPTIONS.map((months) => (
                  <SelectItem key={months} value={String(months)}>
                    {months} meses
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </Field>

      {formError && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {formError}
        </p>
      )}

      <Button
        type="submit"
        size="lg"
        className="mt-1 h-12 text-[15px] font-semibold"
        disabled={submitting || marginBlocked || salaryCents <= 0}
      >
        {submitting ? <Loader2 className="animate-spin" /> : null}
        Comparar ofertas <ArrowRight />
      </Button>
    </form>
  );
}
