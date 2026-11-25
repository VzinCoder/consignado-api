import { ADMIN_LIST_LIMIT } from '@zelafin/core';
import { ListFilter, Search } from 'lucide-react';
import Link from 'next/link';
import { Avatar } from '@/components/admin/avatar';
import { STATUS_FILTERS, StatusBadge, toCoreFilter } from '@/components/admin/status-badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { formatDateTime, formatMoney } from '@/lib/format';
import { getContainer } from '@/lib/server';

export const dynamic = 'force-dynamic';

type Params = Record<string, string | string[] | undefined>;
const single = (value: string | string[] | undefined) => (typeof value === 'string' ? value : '');
const COLUMNS = ['Cliente', 'Valor', 'Prazo', 'Criada em', 'Status'];

export default async function AdminSimulationsPage({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  const params = await searchParams;
  const search = single(params.q).trim();
  const status = single(params.status) || 'todos';

  const simulations = await getContainer().simulationService.list({
    search: search || undefined,
    ...toCoreFilter(status),
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-[28px] font-extrabold">Simulações</h1>
        <p className="text-sm text-muted-foreground">
          {simulations.length} {simulations.length === 1 ? 'simulação' : 'simulações'} · busca e
          filtros entre as {ADMIN_LIST_LIMIT} mais recentes
        </p>
      </div>

      {/* Plain GET form: filters live in the URL, no client state needed. */}
      <form className="flex flex-wrap items-center gap-3" role="search">
        <div className="relative w-full max-w-[360px]">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            name="q"
            defaultValue={search}
            placeholder="Buscar cliente, CPF ou telefone"
            aria-label="Buscar cliente, CPF ou telefone"
            className="h-10 bg-card pl-9"
          />
        </div>
        <div className="relative">
          <ListFilter className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <select
            name="status"
            defaultValue={status}
            aria-label="Filtrar por status"
            className="h-10 appearance-none rounded-md border border-input bg-card pr-8 pl-9 text-sm font-medium"
          >
            {STATUS_FILTERS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        </div>
        <Button type="submit" variant="outline">
          Filtrar
        </Button>
      </form>

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
            {simulations.length === 0 && (
              <tr>
                <td
                  colSpan={COLUMNS.length}
                  className="px-5 py-8 text-center text-muted-foreground"
                >
                  Nenhuma simulação encontrada.
                </td>
              </tr>
            )}
            {simulations.map((s) => (
              <tr key={s.id} className="border-t border-border hover:bg-muted/50">
                <td className="px-5 py-3">
                  <Link
                    href={`/admin/simulacoes/${s.id}`}
                    className="flex items-center gap-3 font-semibold hover:underline"
                  >
                    <Avatar name={s.customerName} />
                    <span className="flex flex-col">
                      {s.customerName}
                      <span className="text-xs font-normal text-muted-foreground">
                        {s.maskedCpf}
                      </span>
                    </span>
                  </Link>
                </td>
                <td className="px-5 py-3 font-medium">{formatMoney(s.requestedAmountCents)}</td>
                <td className="px-5 py-3 font-medium">{s.termMonths} meses</td>
                <td className="px-5 py-3 font-medium">
                  {formatDateTime(s.createdAt.toISOString())}
                </td>
                <td className="px-5 py-3">
                  <StatusBadge status={s.status} needsRetry={s.needsRetry} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
