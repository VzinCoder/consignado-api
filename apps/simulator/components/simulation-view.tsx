'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarX, Info, Loader2, Pencil, Radio, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { BankRow } from '@/components/bank-row';
import { InterestDialog } from '@/components/interest-dialog';
import { OfferCard } from '@/components/offer-card';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ApiError, api, type BankResultView, type PublicSimulation } from '@/lib/api-client';
import { formatMoney, formatShortDate } from '@/lib/format';
import { loanTermsQuery } from '@/lib/search-params';

const POLL_INTERVAL_MS = 2000;
const HOUR_MS = 3_600_000;
const HOURS_PER_DAY = 24;

function validityText(simulation: PublicSimulation): string {
  const hours = Math.round(
    (new Date(simulation.expiresAt).getTime() - new Date(simulation.createdAt).getTime()) / HOUR_MS,
  );
  return hours % HOURS_PER_DAY === 0 ? `${hours / HOURS_PER_DAY} dias` : `${hours} horas`;
}

const byTotal = (a: BankResultView, b: BankResultView) =>
  (a.offer?.totalCents ?? 0) - (b.offer?.totalCents ?? 0);

export function SimulationView({ id }: { id: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<BankResultView | null>(null);

  const query = useQuery({
    queryKey: ['simulation', id],
    queryFn: () => api.getSimulation(id),
    // Polls only while some bank is still answering.
    refetchInterval: (q) => (q.state.data?.status === 'PROCESSING' ? POLL_INTERVAL_MS : false),
  });

  const interest = useMutation({
    mutationFn: (bank: BankResultView) => api.registerInterest(id, bank.bankSlug),
    onSuccess: (data, bank) => {
      queryClient.setQueryData(['simulation', id], data);
      setSelected(null);
      toast.success('Pronto! Vamos falar com você em breve.', {
        description: `Interesse registrado no ${bank.bankName}.`,
      });
    },
    onError: (error) => {
      setSelected(null);
      toast.error(error instanceof Error ? error.message : 'Não foi possível registrar.');
      void query.refetch();
    },
  });

  const renew = useMutation({
    mutationFn: () => api.renewSimulation(id),
    onSuccess: ({ id: newId }) => router.push(`/simulacao/${newId}`),
    onError: () => toast.error('Não foi possível renovar. Tente novamente.'),
  });

  if (query.isPending) {
    return (
      <div className="flex items-center gap-2 py-24 text-muted-foreground">
        <Loader2 className="animate-spin" /> Carregando sua simulação...
      </div>
    );
  }

  if (query.isError) {
    const notFound = query.error instanceof ApiError && query.error.status === 404;
    return (
      <Card className="items-center gap-4 p-12 text-center">
        <h2 className="text-xl font-bold">
          {notFound ? 'Simulação não encontrada' : 'Não foi possível carregar'}
        </h2>
        <p className="text-muted-foreground">
          {notFound ? 'Confira o link ou faça uma nova simulação.' : 'Tente de novo em instantes.'}
        </p>
        <Button asChild>
          <Link href="/">Fazer nova simulação</Link>
        </Button>
      </Card>
    );
  }

  const simulation = query.data;
  const expired = simulation.status === 'EXPIRED';
  const processing = simulation.status === 'PROCESSING';
  const approved = simulation.results.filter((r) => r.status === 'APPROVED').sort(byTotal);
  const others = simulation.results.filter((r) => r.status !== 'APPROVED');
  const subtitle = `${formatMoney(simulation.requestedAmountCents)} em ${simulation.termMonths} meses · simulação de ${
    expired ? formatShortDate(simulation.createdAt) : simulation.customerFirstName
  }`;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-4xl font-extrabold tracking-tight">Compare suas ofertas</h1>
          <p className="text-muted-foreground">{subtitle}</p>
        </div>
        {!expired && (
          <Button variant="outline" asChild>
            <Link
              href={`/?${loanTermsQuery({
                salaryCents: simulation.salaryCents,
                requestedAmountCents: simulation.requestedAmountCents,
                termMonths: simulation.termMonths,
              })}`}
            >
              <Pencil /> Editar simulação
            </Link>
          </Button>
        )}
      </div>

      {expired ? (
        <Card className="items-center gap-4 rounded-xl px-8 py-16 text-center shadow-none">
          <div className="flex size-12 items-center justify-center rounded-full bg-accent">
            <CalendarX className="size-6 text-primary" aria-hidden />
          </div>
          <h2 className="text-[22px] font-bold">Suas ofertas expiraram</h2>
          <p className="max-w-[440px] text-[15px] text-muted-foreground">
            As propostas dos bancos valem por {validityText(simulation)}. Renove a simulação e
            consultamos tudo de novo, com os mesmos dados.
          </p>
          <Button onClick={() => renew.mutate()} disabled={renew.isPending}>
            {renew.isPending && <Loader2 className="animate-spin" />}
            Renovar simulação <RefreshCw />
          </Button>
        </Card>
      ) : (
        <>
          <div className="flex gap-3 rounded-lg bg-muted px-4 py-3" role="status">
            {processing ? (
              <Radio className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
            ) : (
              <Info className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
            )}
            <div className="flex flex-col gap-0.5">
              <p className="text-sm font-semibold">
                {processing
                  ? 'Os bancos estão respondendo.'
                  : 'Compare pelo custo total, não só pela parcela.'}
              </p>
              <p className="text-[13px] text-muted-foreground">
                {processing
                  ? 'Você pode acompanhar aqui. Cada resposta aparece assim que chega — pode levar alguns minutos.'
                  : 'A aprovação final é confirmada pelo banco escolhido após a análise dos seus dados.'}
              </p>
            </div>
          </div>

          {approved.length > 0 && (
            <div className="grid gap-5 md:grid-cols-2">
              {approved.map((result) => (
                <OfferCard
                  key={result.bankSlug}
                  result={result}
                  chosen={simulation.chosenBankSlug === result.bankSlug}
                  disabled={interest.isPending}
                  onInterest={() => setSelected(result)}
                />
              ))}
            </div>
          )}

          {others.length > 0 && (
            <div className="grid gap-4 md:grid-cols-2">
              {others.map((result) => (
                <BankRow key={result.bankSlug} result={result} />
              ))}
            </div>
          )}
        </>
      )}

      <InterestDialog
        result={selected}
        pending={interest.isPending}
        onCancel={() => setSelected(null)}
        onConfirm={() => selected && interest.mutate(selected)}
      />
    </div>
  );
}
