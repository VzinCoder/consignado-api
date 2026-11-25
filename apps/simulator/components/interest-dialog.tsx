'use client';

import { CircleCheck, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { BankResultView } from '@/lib/api-client';
import { formatMoney } from '@/lib/format';

interface Props {
  result: BankResultView | null;
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

/** Screen 06: confirms the chosen offer before registering the interest. */
export function InterestDialog({ result, pending, onCancel, onConfirm }: Props) {
  const offer = result?.offer;
  return (
    <Dialog open={Boolean(result)} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="max-w-[440px] gap-5 p-7">
        <DialogHeader className="items-center gap-3 text-center sm:text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-accent">
            <CircleCheck className="size-6 text-primary" aria-hidden />
          </div>
          <DialogTitle className="text-xl font-bold">Confirmar interesse?</DialogTitle>
          <DialogDescription className="text-sm">
            Vamos registrar seu interesse na oferta do {result?.bankName}. Nossa equipe fala com
            você pelo WhatsApp para seguir com a análise.
          </DialogDescription>
        </DialogHeader>
        {offer && (
          <div className="flex justify-between rounded-lg bg-muted px-4 py-3 text-sm">
            <span className="font-bold">
              {offer.termMonths}x de {formatMoney(offer.installmentCents)}
            </span>
            <span className="font-medium text-muted-foreground">
              Total {formatMoney(offer.totalCents)}
            </span>
          </div>
        )}
        <DialogFooter className="grid grid-cols-2 gap-3">
          <Button variant="outline" onClick={onCancel} disabled={pending}>
            Cancelar
          </Button>
          <Button onClick={onConfirm} disabled={pending}>
            {pending && <Loader2 className="animate-spin" />}
            Confirmar interesse
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
