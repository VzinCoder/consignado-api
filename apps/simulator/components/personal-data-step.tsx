'use client';

import { ArrowLeft, Loader2, Lock } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { PersonalDataForm } from '@/components/personal-data-form';
import { Card } from '@/components/ui/card';
import { formatMoney } from '@/lib/format';
import { loadLoanTerms } from '@/lib/loan-terms';
import type { LoanTerms } from '@/lib/schemas';

/** Tela 02. Lê os dados da simulação salvos pela Landing nesta aba (nunca pela URL). */
export function PersonalDataStep() {
  const router = useRouter();
  // undefined = ainda lendo o armazenamento da aba (evita divergência na hidratação).
  const [terms, setTerms] = useState<LoanTerms | null | undefined>(undefined);

  useEffect(() => {
    const stored = loadLoanTerms();
    if (!stored || stored.salaryCents <= 0) {
      router.replace('/');
      return;
    }
    setTerms(stored);
  }, [router]);

  if (!terms) {
    return (
      <div className="flex items-center gap-2 py-24 text-muted-foreground">
        <Loader2 className="animate-spin" /> Carregando...
      </div>
    );
  }

  const summary: [string, string][] = [
    ['Valor', formatMoney(terms.requestedAmountCents)],
    ['Prazo', `${terms.termMonths} meses`],
    ['Salário', formatMoney(terms.salaryCents)],
  ];

  return (
    <div className="grid items-start gap-12 lg:grid-cols-[1fr_440px]">
      <div className="flex flex-col gap-6 lg:pt-6">
        <Link
          href="/"
          className="flex w-fit items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Voltar à simulação
        </Link>
        <span className="w-fit rounded-full bg-accent px-3 py-1 text-xs font-medium text-primary">
          Etapa 2 de 3
        </span>
        <h1 className="max-w-[560px] text-4xl leading-[1.1] font-extrabold tracking-tight lg:text-5xl">
          Falta pouco para ver suas ofertas.
        </h1>
        <p className="max-w-[520px] text-lg text-muted-foreground">
          Usamos esses dados apenas para consultar os bancos parceiros. Nada é contratado sem a sua
          confirmação.
        </p>
        <dl className="grid w-fit grid-cols-3 gap-6 rounded-lg bg-muted px-5 py-4">
          {summary.map(([label, value]) => (
            <div key={label} className="flex flex-col gap-0.5">
              <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
              <dd className="text-[15px] font-bold">{value}</dd>
            </div>
          ))}
        </dl>
        <p className="flex items-center gap-2 text-[13px] font-medium text-muted-foreground">
          <Lock className="size-4" aria-hidden /> Seus dados são protegidos conforme a LGPD.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <Card className="gap-5 rounded-xl p-7 shadow-sm">
          <div className="flex flex-col gap-1">
            <h2 className="text-xl font-bold">Informe seus dados</h2>
            <p className="text-sm text-muted-foreground">
              Preencha para compararmos as melhores ofertas para você.
            </p>
          </div>
          <PersonalDataForm terms={terms} />
        </Card>
        <p className="text-center text-xs text-muted-foreground">
          Ao continuar, você autoriza a consulta aos bancos parceiros com estes dados.
        </p>
      </div>
    </div>
  );
}
