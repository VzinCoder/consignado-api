import { Badge } from '@/components/ui/badge';
import type { BankResultView } from '@/lib/api-client';
import { bankIcon } from '@/lib/banks';
import { cn } from '@/lib/utils';

const COPY = {
  PENDING: {
    text: 'Aguardando resposta do banco.',
    badge: 'Consultando',
    tone: 'bg-muted text-muted-foreground',
  },
  REJECTED: {
    text: 'O banco não aprovou esta simulação.',
    badge: 'Não aprovado',
    tone: 'bg-destructive-muted text-destructive',
  },
  FAILED: {
    text: 'Fora do ar agora. Nossa equipe vai reconsultar para você.',
    badge: 'Indisponível',
    tone: 'bg-muted text-muted-foreground',
  },
} as const;

/** Linha compacta para bancos pendentes, recusados e indisponíveis (componente "Bank Row" no Pencil). */
export function BankRow({ result }: { result: BankResultView }) {
  if (result.status === 'APPROVED') return null;
  const copy = COPY[result.status];
  const Icon = bankIcon(result.bankSlug);

  return (
    <div
      data-testid={`bank-row-${result.bankSlug}`}
      className="flex items-center gap-3 rounded-xl border border-border bg-card px-5 py-4"
    >
      <Icon className="size-5 text-muted-foreground" aria-hidden />
      <div className="flex flex-1 flex-col gap-0.5">
        <p className="text-sm font-bold">{result.bankName}</p>
        <p className="text-[13px] text-muted-foreground">{copy.text}</p>
      </div>
      <Badge className={cn('rounded-full font-medium', copy.tone)}>
        {result.status === 'PENDING' && (
          <span className="size-1.5 animate-pulse rounded-full bg-current" aria-hidden />
        )}
        {copy.badge}
      </Badge>
    </div>
  );
}
