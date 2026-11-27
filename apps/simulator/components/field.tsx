import type { LucideIcon } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

interface FieldProps {
  id: string;
  label: string;
  icon?: LucideIcon;
  error?: string;
  children: React.ReactNode;
}

/** Rótulo + campo de entrada com ícone à esquerda e erro inline, conforme o "Input Group" no Pencil. */
export function Field({ id, label, icon: Icon, error, children }: FieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id} className={cn('text-[13px] font-medium', error && 'text-destructive')}>
        {label}
      </Label>
      <div className="relative">
        {Icon && (
          <Icon
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          />
        )}
        {children}
      </div>
      {error && (
        <p
          id={`${id}-error`}
          role="alert"
          className="rounded-md bg-destructive-muted px-3 py-2 text-[13px] font-medium text-destructive"
        >
          {error}
        </p>
      )}
    </div>
  );
}

/** Vincula o campo à sua mensagem de erro para que leitores de tela a anunciem junto com o campo. */
export const errorProps = (id: string, error?: string) => ({
  'aria-invalid': error ? true : undefined,
  'aria-describedby': error ? `${id}-error` : undefined,
});

export const inputClass = (hasIcon: boolean, error?: string) =>
  cn(
    'h-11 bg-card text-[15px] font-medium',
    hasIcon && 'pl-9',
    error && 'border-destructive focus-visible:ring-destructive/30',
  );
