'use client';

import {
  ArrowRight,
  Building2,
  Calendar,
  Coins,
  IdCard,
  Loader2,
  Mail,
  Phone,
  ReceiptText,
  User,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { Field, errorProps, inputClass } from '@/components/field';
import { MoneyInput } from '@/components/money-input';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ApiError, request } from '@/lib/api-client';
import { TERM_OPTIONS, formatCnpj, formatCpf, formatPhone } from '@/lib/format';
import type { CreateSimulationBody } from '@/lib/schemas';

const FIELD_NAMES = [
  'name',
  'cpf',
  'phone',
  'email',
  'employerCnpj',
  'salaryCents',
  'requestedAmountCents',
  'termMonths',
] as const;
type FieldName = (typeof FIELD_NAMES)[number];
const isFieldName = (key: string): key is FieldName => FIELD_NAMES.some((f) => f === key);
type TextField = 'name' | 'cpf' | 'phone' | 'email' | 'employerCnpj';

const idSchema = z.object({ id: z.string() });

/** Screen 14: the team creates a simulation for a customer served by phone or WhatsApp. */
export function NewSimulationForm() {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    control,
    handleSubmit,
    setError,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CreateSimulationBody>({
    defaultValues: {
      name: '',
      cpf: '',
      phone: '',
      email: '',
      employerCnpj: '',
      salaryCents: 0,
      requestedAmountCents: 0,
      termMonths: 24,
    },
  });

  const onSubmit = handleSubmit(async (data) => {
    setFormError(null);
    try {
      const { id } = await request('/api/admin/simulations', idSchema, {
        method: 'POST',
        body: data,
      });
      toast.success('Simulação criada.', {
        description: 'Os bancos estão sendo consultados. Envie o link ao cliente pelo WhatsApp.',
      });
      router.push(`/admin/simulacoes/${id}`);
    } catch (error) {
      if (error instanceof ApiError) {
        const entries = Object.entries(error.fields).filter(([key]) => isFieldName(key));
        for (const [key, message] of entries) {
          if (isFieldName(key)) setError(key, { message });
        }
        if (entries.length === 0) setFormError(error.message);
        return;
      }
      setFormError('Não foi possível criar a simulação.');
    }
  });

  const masked = (name: TextField, mask: (value: string) => string) =>
    register(name, {
      onChange: (event: React.ChangeEvent<HTMLInputElement>) => {
        setValue(name, mask(event.target.value));
      },
    });

  return (
    <form onSubmit={(event) => void onSubmit(event)} noValidate>
      <Card className="gap-6 rounded-xl p-7 shadow-none">
        <section className="flex flex-col gap-4">
          <h2 className="text-base font-bold">Dados do cliente</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <Field id="name" label="Nome completo" icon={User} error={errors.name?.message}>
              <Input
                id="name"
                {...errorProps('name', errors.name?.message)}
                placeholder="Nome do cliente"
                className={inputClass(true, errors.name?.message)}
                {...register('name')}
              />
            </Field>
            <Field id="cpf" label="CPF" icon={IdCard} error={errors.cpf?.message}>
              <Input
                id="cpf"
                {...errorProps('cpf', errors.cpf?.message)}
                inputMode="numeric"
                placeholder="000.000.000-00"
                className={inputClass(true, errors.cpf?.message)}
                {...masked('cpf', formatCpf)}
              />
            </Field>
            <Field
              id="phone"
              label="Telefone (WhatsApp)"
              icon={Phone}
              error={errors.phone?.message}
            >
              <Input
                id="phone"
                {...errorProps('phone', errors.phone?.message)}
                inputMode="tel"
                placeholder="(00) 00000-0000"
                className={inputClass(true, errors.phone?.message)}
                {...masked('phone', formatPhone)}
              />
            </Field>
            <Field id="email" label="E-mail" icon={Mail} error={errors.email?.message}>
              <Input
                id="email"
                {...errorProps('email', errors.email?.message)}
                type="email"
                placeholder="cliente@email.com"
                className={inputClass(true, errors.email?.message)}
                {...register('email')}
              />
            </Field>
            <div className="md:col-span-2">
              <Field
                id="employerCnpj"
                label="CNPJ do empregador"
                icon={Building2}
                error={errors.employerCnpj?.message}
              >
                <Input
                  id="employerCnpj"
                  {...errorProps('employerCnpj', errors.employerCnpj?.message)}
                  inputMode="numeric"
                  placeholder="00.000.000/0000-00"
                  className={inputClass(true, errors.employerCnpj?.message)}
                  {...masked('employerCnpj', formatCnpj)}
                />
              </Field>
            </div>
          </div>
        </section>

        <section className="flex flex-col gap-4 border-t border-border pt-6">
          <h2 className="text-base font-bold">Simulação</h2>
          <div className="grid gap-4 md:grid-cols-3">
            <Field
              id="salary"
              label="Salário mensal"
              icon={Coins}
              error={errors.salaryCents?.message}
            >
              <Controller
                control={control}
                name="salaryCents"
                render={({ field }) => (
                  <MoneyInput
                    id="salary"
                    {...errorProps('salary', errors.salaryCents?.message)}
                    placeholder="R$ 0,00"
                    className={inputClass(true, errors.salaryCents?.message)}
                    valueCents={field.value}
                    onValueChange={field.onChange}
                  />
                )}
              />
            </Field>
            <Field
              id="amount"
              label="Valor desejado"
              icon={ReceiptText}
              error={errors.requestedAmountCents?.message}
            >
              <Controller
                control={control}
                name="requestedAmountCents"
                render={({ field }) => (
                  <MoneyInput
                    id="amount"
                    {...errorProps('amount', errors.requestedAmountCents?.message)}
                    placeholder="R$ 0,00"
                    className={inputClass(true, errors.requestedAmountCents?.message)}
                    valueCents={field.value}
                    onValueChange={field.onChange}
                  />
                )}
              />
            </Field>
            <Field id="term" label="Prazo" icon={Calendar} error={errors.termMonths?.message}>
              <Controller
                control={control}
                name="termMonths"
                render={({ field }) => (
                  <Select
                    value={String(field.value)}
                    onValueChange={(value) => field.onChange(Number(value))}
                  >
                    <SelectTrigger
                      id="term"
                      {...errorProps('term', errors.termMonths?.message)}
                      className={`${inputClass(true)} w-full`}
                    >
                      <SelectValue placeholder="Selecione" />
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
          </div>
        </section>

        {formError && (
          <p
            role="alert"
            className="rounded-md bg-destructive-muted px-3 py-2 text-sm font-medium text-destructive"
          >
            {formError}
          </p>
        )}

        <div className="flex justify-end gap-3">
          <Button variant="outline" asChild>
            <Link href="/admin">Cancelar</Link>
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="animate-spin" />}
            Simular e enviar ao cliente <ArrowRight />
          </Button>
        </div>
      </Card>
    </form>
  );
}
