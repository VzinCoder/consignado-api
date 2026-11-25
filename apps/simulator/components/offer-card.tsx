import { ArrowRight, Check } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import type { BankResultView } from '@/lib/api-client';
import { bankIcon } from '@/lib/banks';
import { formatMoney, formatRate } from '@/lib/format';
import { cn } from '@/lib/utils';

interface Props {
  result: BankResultView;
  chosen: boolean;
  disabled: boolean;
  onInterest: () => void;
}

/** Approved offer, as the Pencil "Offer Card" component. */
export function OfferCard({ result, chosen, disabled, onInterest }: Props) {
  const { offer } = result;
  if (!offer) return null;
  const Icon = bankIcon(result.bankSlug);

  return (
    <Card
      data-testid={`offer-${result.bankSlug}`}
      className={cn(
        'gap-[18px] rounded-xl p-6 shadow-none',
        result.isBest && 'border-primary ring-1 ring-primary',
      )}
    >
      <div className="flex items-center gap-2.5">
        <div className="flex size-10 items-center justify-center rounded-lg bg-accent">
          <Icon className="size-5 text-primary" aria-hidden />
        </div>
        <h3 className="flex-1 text-[17px] font-bold">{result.bankName}</h3>
        {result.isBest && <Badge className="rounded-full">Menor total</Badge>}
        <Badge variant="secondary" className="rounded-full bg-accent text-primary">
          Aprovado
        </Badge>
      </div>

      <div className="flex flex-col gap-3">
        <p className="text-3xl font-extrabold tracking-tight">
          {offer.termMonths}x de {formatMoney(offer.installmentCents)}
        </p>
        <dl className="flex flex-col gap-1.5 border-t border-border pt-3 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Total a pagar</dt>
            <dd className="font-semibold">{formatMoney(offer.totalCents)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Taxa ao mês</dt>
            <dd className="font-semibold">{formatRate(offer.monthlyRate)}</dd>
          </div>
        </dl>
      </div>

      {chosen ? (
        <Button className="w-full font-semibold" disabled>
          <Check /> Você escolheu esta oferta
        </Button>
      ) : (
        <Button
          variant={result.isBest ? 'default' : 'outline'}
          className="w-full font-semibold"
          disabled={disabled}
          onClick={onInterest}
        >
          Tenho interesse <ArrowRight />
        </Button>
      )}
    </Card>
  );
}
