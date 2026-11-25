import { BUSINESS_TIME_ZONE } from '@zelafin/core';
import { FileText, HandHeart, Hourglass, MessageCircle, Plus, type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { Avatar } from '@/components/admin/avatar';
import { StatusBadge } from '@/components/admin/status-badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { formatMoney, formatRelative } from '@/lib/format';
import { getContainer } from '@/lib/server';

export const dynamic = 'force-dynamic';

const PERCENT = 100;
const COLUMNS = [
  'Cliente',
  'Valor solicitado',
  'Prazo',
  'Banco escolhido',
  'Recebido',
  'Status',
  'Ação',
];
const longDate = new Intl.DateTimeFormat('pt-BR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  timeZone: BUSINESS_TIME_ZONE,
});
const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

function comparedToYesterday(todayCount: number, yesterday: number): string {
  if (yesterday === 0) return 'Nenhuma simulação ontem';
  const change = Math.round(((todayCount - yesterday) / yesterday) * PERCENT);
  return `${change >= 0 ? '+' : ''}${change}% em relação a ontem`;
}

function Metric(props: { icon: LucideIcon; label: string; value: number; hint: string }) {
  const { icon: Icon, label, value, hint } = props;
  return (
    <Card className="gap-2 rounded-xl p-6 shadow-none">
      <div className="flex items-center justify-between text-sm font-medium text-muted-foreground">
        {label} <Icon className="size-4" aria-hidden />
      </div>
      <p className="text-[34px] leading-tight font-extrabold">{value}</p>
      <p className="text-xs text-muted-foreground">{hint}</p>
    </Card>
  );
}

export default async function AdminOverviewPage() {
  const overview = await getContainer().simulationService.overview();
  const now = new Date();

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-extrabold">Visão geral</h1>
          <p className="text-sm text-muted-foreground">{capitalize(longDate.format(now))}</p>
        </div>
        <Button asChild>
          <Link href="/admin/nova">
            Nova simulação <Plus />
          </Link>
        </Button>
      </div>

      <div className="grid gap-5 md:grid-cols-3">
        <Metric
          icon={FileText}
          label="Simulações hoje"
          value={overview.simulationsToday}
          hint={comparedToYesterday(overview.simulationsToday, overview.simulationsYesterday)}
        />
        <Metric
          icon={HandHeart}
          label="Interessados"
          value={overview.interestedCount}
          hint={`${overview.interestedToday} escolheram uma oferta hoje`}
        />
        <Metric
          icon={Hourglass}
          label="Pendentes"
          value={overview.needsRetryCount}
          hint="Bancos fora do ar para reconsultar"
        />
      </div>

      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">Interessados recentes</h2>
          <Link href="/admin/simulacoes" className="text-[13px] font-medium text-primary">
            Ver todas as simulações
          </Link>
        </div>
        <Card className="gap-0 overflow-hidden rounded-xl p-0 shadow-none">
          <table className="w-full text-sm">
            <thead className="bg-muted text-left text-xs text-muted-foreground">
              <tr>
                {COLUMNS.map((title) => (
                  <th key={title} className="px-5 py-3 font-medium">
                    {title}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {overview.interested.length === 0 && (
                <tr>
                  <td
                    colSpan={COLUMNS.length}
                    className="px-5 py-8 text-center text-muted-foreground"
                  >
                    Nenhum cliente escolheu uma oferta ainda.
                  </td>
                </tr>
              )}
              {overview.interested.map((s) => (
                <tr key={s.id} className="border-t border-border">
                  <td className="px-5 py-3.5">
                    <span className="flex items-center gap-3 font-semibold">
                      <Avatar name={s.customerName} /> {s.customerName}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 font-medium">{formatMoney(s.requestedAmountCents)}</td>
                  <td className="px-5 py-3.5 font-medium">{s.termMonths} meses</td>
                  <td className="px-5 py-3.5 font-medium">{s.chosenBank?.bankName ?? '—'}</td>
                  <td className="px-5 py-3.5 font-medium">
                    {s.interestAt ? formatRelative(s.interestAt, now) : '—'}
                  </td>
                  <td className="px-5 py-3.5">
                    <StatusBadge status={s.status} needsRetry={s.needsRetry} />
                  </td>
                  <td className="px-5 py-3.5">
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/admin/simulacoes/${s.id}`}>
                        <MessageCircle /> Atender
                      </Link>
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </section>
    </div>
  );
}
