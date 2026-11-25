import { hasErrorCode, type AdminBankResultView, type AdminSimulationView } from '@zelafin/core';
import { ChevronRight, HandHeart, MessageCircle } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AutoRefresh } from '@/components/admin/auto-refresh';
import { Avatar } from '@/components/admin/avatar';
import { RetryControl } from '@/components/admin/retry-control';
import { StatusBadge } from '@/components/admin/status-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { bankIcon } from '@/lib/banks';
import { getSimulatorEnv } from '@/lib/env';
import { formatCnpj, formatMoney, formatPhone, formatRelative, formatTime } from '@/lib/format';
import { getContainer, parseId } from '@/lib/server';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const BRAZIL_COUNTRY_CODE = '55';

/** Unknown or malformed id: answer 404 with the not-found page, not a 500. */
async function loadDetails(rawId: string): Promise<AdminSimulationView> {
  try {
    return await getContainer().simulationService.getDetails(parseId(rawId));
  } catch (error) {
    if (hasErrorCode(error, 'NOT_FOUND')) notFound();
    throw error;
  }
}

function offerLine(result: AdminBankResultView): string {
  if (!result.offer) return '';
  return `${result.offer.termMonths}x de ${formatMoney(result.offer.installmentCents)} · total ${formatMoney(result.offer.totalCents)}`;
}

function resultDetail(result: AdminBankResultView): string {
  switch (result.status) {
    case 'APPROVED':
      return offerLine(result);
    case 'REJECTED':
      return result.rejectionReason ?? 'Recusado pelo banco';
    case 'FAILED':
      return `Falha técnica${result.respondedAt ? ` às ${formatTime(result.respondedAt)}` : ''}: ${result.failureReason ?? 'sem detalhe'}`;
    default:
      return 'Consultando o banco...';
  }
}

interface HistoryEvent {
  at: Date;
  title: string;
  text: string;
  tone: 'primary' | 'destructive' | 'muted';
}

/** Timeline built from timestamps we already store (there is no event table in the MVP). */
function buildHistory(view: AdminSimulationView): HistoryEvent[] {
  const events: HistoryEvent[] = [
    {
      at: view.createdAt,
      title: view.origin === 'ADMIN' ? 'Simulação criada pelo atendimento' : 'Simulação criada',
      text: `${formatMoney(view.requestedAmountCents)} em ${view.termMonths} meses.`,
      tone: 'muted',
    },
  ];
  const answered = view.results.filter(
    (r) => (r.status === 'APPROVED' || r.status === 'REJECTED') && r.respondedAt,
  );
  const lastAnswer = answered.reduce<Date | null>(
    (latest, r) => (r.respondedAt && (!latest || r.respondedAt > latest) ? r.respondedAt : latest),
    null,
  );
  if (lastAnswer) {
    const approved = answered.filter((r) => r.status === 'APPROVED').length;
    events.push({
      at: lastAnswer,
      title: `${answered.length} ${answered.length === 1 ? 'banco respondeu' : 'bancos responderam'}`,
      text: `${approved} ${approved === 1 ? 'aprovado' : 'aprovados'}, ${answered.length - approved} ${answered.length - approved === 1 ? 'recusado' : 'recusados'}.`,
      tone: 'primary',
    });
  }
  for (const r of view.results) {
    if (r.status === 'FAILED' && r.respondedAt) {
      events.push({
        at: r.respondedAt,
        title: `${r.bankName} falhou`,
        text: 'Banco fora do ar.',
        tone: 'destructive',
      });
    }
  }
  const chosen = view.results.find((r) => r.bankSlug === view.chosenBankSlug);
  if (view.interestAt && chosen) {
    events.push({
      at: view.interestAt,
      title: `Interesse no ${chosen.bankName}`,
      text: 'O cliente confirmou pelo site.',
      tone: 'primary',
    });
  }
  return events.sort((a, b) => b.at.getTime() - a.at.getTime());
}

const DOT_TONE = {
  primary: 'bg-primary',
  destructive: 'bg-destructive',
  muted: 'bg-muted-foreground',
} as const;

const RESULT_BADGE = {
  APPROVED: ['Aprovado', 'bg-accent text-primary'],
  REJECTED: ['Não aprovado', 'bg-destructive-muted text-destructive'],
  PENDING: ['Consultando', 'bg-muted text-muted-foreground'],
  FAILED: ['Falhou', 'bg-destructive-muted text-destructive'],
} as const;

export default async function AdminSimulationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const view = await loadDetails((await params).id);
  const now = new Date();

  // Configured base URL: the request Host header can be an internal address (proxy) or forged.
  const simulationUrl = new URL(`/simulacao/${view.id}`, getSimulatorEnv().PUBLIC_APP_URL);
  const firstName = view.customer.name.split(' ')[0] ?? view.customer.name;
  const whatsappText = `Olá, ${firstName}! Aqui é da Zelafin. Suas ofertas de consignado estão em ${simulationUrl.toString()}`;
  const whatsappUrl = `https://wa.me/${BRAZIL_COUNTRY_CODE}${view.customer.phone}?text=${encodeURIComponent(whatsappText)}`;

  const chosen = view.results.find((r) => r.bankSlug === view.chosenBankSlug);
  const needsRetry = view.results.some((r) => r.retryable);
  const customerData: [string, string][] = [
    ['CPF', view.customer.maskedCpf],
    ['Telefone', formatPhone(view.customer.phone)],
    ['E-mail', view.customer.email],
    ['Salário', formatMoney(view.salaryCents)],
    ['CNPJ do empregador', formatCnpj(view.employerCnpj)],
    ['Valor pedido', `${formatMoney(view.requestedAmountCents)} · ${view.termMonths} meses`],
  ];

  return (
    <div className="flex flex-col gap-6">
      <AutoRefresh active={view.status === 'PROCESSING'} />
      <nav className="flex items-center gap-1.5 text-sm text-muted-foreground" aria-label="Trilha">
        <Link href="/admin/simulacoes" className="hover:text-foreground">
          Simulações
        </Link>
        <ChevronRight className="size-4" aria-hidden />
        <span className="font-semibold text-foreground">{view.customer.name}</span>
      </nav>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Avatar name={view.customer.name} className="size-12 bg-accent text-base text-primary" />
          <h1 className="text-[28px] font-extrabold">{view.customer.name}</h1>
          <StatusBadge status={view.status} needsRetry={needsRetry} />
        </div>
        <Button asChild>
          <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
            <MessageCircle /> Abrir WhatsApp
          </a>
        </Button>
      </div>

      {chosen?.offer && view.interestAt && (
        <div className="flex items-center justify-between gap-3 rounded-lg bg-accent px-4 py-3 text-primary">
          <p className="flex items-center gap-2 text-sm font-bold">
            <HandHeart className="size-4" aria-hidden /> Interesse: {chosen.bankName} ·{' '}
            {offerLine(chosen)}
          </p>
          <span className="text-[13px] font-medium">{formatRelative(view.interestAt, now)}</span>
        </div>
      )}

      <div className="grid items-start gap-6 xl:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-6">
          <Card className="gap-5 rounded-xl p-6 shadow-none">
            <h2 className="text-base font-bold">Dados do cliente</h2>
            <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-3">
              {customerData.map(([label, value]) => (
                <div key={label} className="flex flex-col gap-0.5">
                  <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
                  <dd className="text-sm font-semibold break-words">{value}</dd>
                </div>
              ))}
            </dl>
          </Card>

          <Card className="gap-4 rounded-xl p-6 shadow-none">
            <h2 className="text-base font-bold">Respostas dos bancos</h2>
            <ul className="flex flex-col gap-3">
              {view.results.map((result) => {
                const Icon = bankIcon(result.bankSlug);
                const [label, tone] = RESULT_BADGE[result.status];
                return (
                  <li
                    key={result.id}
                    data-testid={`admin-result-${result.bankSlug}`}
                    className="flex flex-wrap items-center gap-3 rounded-lg border border-border px-4 py-3"
                  >
                    <Icon className="size-5 text-muted-foreground" aria-hidden />
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="text-sm font-bold">{result.bankName}</span>
                      <span className="text-[13px] text-muted-foreground">
                        {resultDetail(result)}
                      </span>
                    </div>
                    {result.retryable ? (
                      <RetryControl bankResultId={result.id} bankName={result.bankName} />
                    ) : (
                      <Badge className={cn('rounded-full font-medium', tone)}>{label}</Badge>
                    )}
                  </li>
                );
              })}
            </ul>
          </Card>
        </div>

        <Card className="gap-4 rounded-xl p-6 shadow-none">
          <h2 className="text-base font-bold">Histórico</h2>
          <ol className="flex flex-col gap-4">
            {buildHistory(view).map((event) => (
              <li key={`${event.title}-${event.at.toISOString()}`} className="flex gap-3">
                <span
                  aria-hidden
                  className={cn('mt-1.5 size-2 shrink-0 rounded-full', DOT_TONE[event.tone])}
                />
                <div className="flex flex-col">
                  <span className="text-[13px] font-semibold">{event.title}</span>
                  <span className="text-xs text-muted-foreground">
                    {formatTime(event.at)} · {event.text}
                  </span>
                </div>
              </li>
            ))}
          </ol>
        </Card>
      </div>
    </div>
  );
}
