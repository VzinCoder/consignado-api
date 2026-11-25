import { ArrowLeft, Lock } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { PersonalDataForm } from '@/components/personal-data-form';
import { SiteHeader } from '@/components/site-header';
import { Card } from '@/components/ui/card';
import { formatMoney } from '@/lib/format';
import { hasLoanTermsParams, loanTermsQuery, parseLoanTermsParams } from '@/lib/search-params';

export default async function PersonalDataPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  if (!hasLoanTermsParams(params)) redirect('/');
  const terms = parseLoanTermsParams(params);

  const summary: [string, string][] = [
    ['Valor', formatMoney(terms.requestedAmountCents)],
    ['Prazo', `${terms.termMonths} meses`],
    ['Salário', formatMoney(terms.salaryCents)],
  ];

  return (
    <>
      <SiteHeader />
      <main className="mx-auto grid max-w-[1312px] items-start gap-12 px-6 py-12 lg:grid-cols-[1fr_440px] lg:py-16">
        <div className="flex flex-col gap-6 lg:pt-6">
          <Link
            href={`/?${loanTermsQuery(terms)}`}
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
            Usamos esses dados apenas para consultar os bancos parceiros. Nada é contratado sem a
            sua confirmação.
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
            Ao continuar, você concorda com os Termos e a Política de Privacidade.
          </p>
        </div>
      </main>
    </>
  );
}
