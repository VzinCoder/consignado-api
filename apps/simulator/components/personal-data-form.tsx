'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowRight, Building2, IdCard, Loader2, Mail, Phone, User } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Field, inputClass } from '@/components/field';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ApiError, api } from '@/lib/api-client';
import { formatCnpj, formatCpf, formatPhone } from '@/lib/format';
import { personalDataSchema, type LoanTerms, type PersonalData } from '@/lib/schemas';

interface Props {
  terms: LoanTerms;
}

const FIELDS = ['name', 'cpf', 'phone', 'email', 'employerCnpj'] as const;
type FieldName = (typeof FIELDS)[number];
const isFieldName = (key: string): key is FieldName => FIELDS.some((f) => f === key);

export function PersonalDataForm({ terms }: Props) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<PersonalData>({
    resolver: zodResolver(personalDataSchema),
    defaultValues: { name: '', cpf: '', phone: '', email: '', employerCnpj: '' },
  });

  const onSubmit = handleSubmit(async (data) => {
    setFormError(null);
    try {
      const { id } = await api.createSimulation({ ...data, ...terms });
      router.push(`/simulacao/${id}`);
    } catch (error) {
      if (error instanceof ApiError) {
        const fieldEntries = Object.entries(error.fields);
        for (const [key, message] of fieldEntries) {
          if (isFieldName(key)) setError(key, { message });
        }
        if (!fieldEntries.some(([key]) => isFieldName(key))) setFormError(error.message);
        return;
      }
      setFormError('Não foi possível enviar. Tente novamente.');
    }
  });

  const masked = (name: FieldName, mask: (value: string) => string) =>
    register(name, {
      onChange: (event: React.ChangeEvent<HTMLInputElement>) => {
        setValue(name, mask(event.target.value));
      },
    });

  return (
    <form onSubmit={(event) => void onSubmit(event)} className="flex flex-col gap-4" noValidate>
      <Field id="name" label="Nome completo" icon={User} error={errors.name?.message}>
        <Input
          id="name"
          autoComplete="name"
          placeholder="Maria Souza"
          className={inputClass(true, errors.name?.message)}
          {...register('name')}
        />
      </Field>
      <Field id="cpf" label="CPF" icon={IdCard} error={errors.cpf?.message}>
        <Input
          id="cpf"
          inputMode="numeric"
          placeholder="000.000.000-00"
          className={inputClass(true, errors.cpf?.message)}
          {...masked('cpf', formatCpf)}
        />
      </Field>
      <Field id="phone" label="Telefone (WhatsApp)" icon={Phone} error={errors.phone?.message}>
        <Input
          id="phone"
          inputMode="tel"
          autoComplete="tel"
          placeholder="(87) 99999-0000"
          className={inputClass(true, errors.phone?.message)}
          {...masked('phone', formatPhone)}
        />
      </Field>
      <Field id="email" label="E-mail" icon={Mail} error={errors.email?.message}>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          placeholder="maria.souza@email.com"
          className={inputClass(true, errors.email?.message)}
          {...register('email')}
        />
      </Field>
      <Field
        id="employerCnpj"
        label="CNPJ do empregador"
        icon={Building2}
        error={errors.employerCnpj?.message}
      >
        <Input
          id="employerCnpj"
          inputMode="numeric"
          placeholder="00.000.000/0000-00"
          className={inputClass(true, errors.employerCnpj?.message)}
          {...masked('employerCnpj', formatCnpj)}
        />
      </Field>

      {formError && (
        <p
          role="alert"
          className="rounded-md bg-destructive-muted px-3 py-2 text-sm font-medium text-destructive"
        >
          {formError}
        </p>
      )}

      <Button
        type="submit"
        size="lg"
        className="mt-1 h-12 text-[15px] font-semibold"
        disabled={isSubmitting}
      >
        {isSubmitting && <Loader2 className="animate-spin" />}
        Continuar <ArrowRight />
      </Button>
    </form>
  );
}
