'use client';

import { Input } from '@/components/ui/input';
import { digitsToCents, formatMoney } from '@/lib/format';

interface MoneyInputProps extends Omit<React.ComponentProps<'input'>, 'value' | 'onChange'> {
  valueCents: number;
  onValueChange: (cents: number) => void;
}

/** Typed digits fill the value from the cents up: "350000" shows R$ 3.500,00. */
export function MoneyInput({ valueCents, onValueChange, ...props }: MoneyInputProps) {
  return (
    <Input
      {...props}
      inputMode="numeric"
      value={valueCents > 0 ? formatMoney(valueCents) : ''}
      onChange={(event) => {
        onValueChange(digitsToCents(event.target.value));
      }}
    />
  );
}
