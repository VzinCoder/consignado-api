'use client';

import { ArrowRight, Eye, EyeOff, Loader2, Lock, Mail } from 'lucide-react';
import { useState } from 'react';
import { Field, inputClass } from '@/components/field';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function LoginForm() {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ username: form.get('username'), password: form.get('password') }),
      });
      if (!response.ok) {
        setError(
          response.status === 401 ? 'E-mail ou senha incorretos.' : 'Não foi possível entrar.',
        );
        setPending(false);
        return;
      }
      // Navegação completa limpa o Router Cache e evita corrida com o redirect do servidor.
      window.location.replace('/admin');
    } catch {
      setError('Não foi possível entrar. Tente novamente.');
      setPending(false);
    }
  }

  return (
    <form onSubmit={(event) => void onSubmit(event)} className="flex flex-col gap-4">
      <Field id="username" label="E-mail" icon={Mail}>
        <Input
          id="username"
          name="username"
          type="email"
          autoComplete="username"
          placeholder="voce@zelafin.com.br"
          required
          className={inputClass(true)}
        />
      </Field>
      <Field id="password" label="Senha" icon={Lock}>
        <Input
          id="password"
          name="password"
          type={showPassword ? 'text' : 'password'}
          autoComplete="current-password"
          placeholder="••••••••"
          required
          className={`${inputClass(true)} pr-10`}
        />
        <button
          type="button"
          onClick={() => setShowPassword((v) => !v)}
          aria-label={showPassword ? 'Esconder senha' : 'Mostrar senha'}
          className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground"
        >
          {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </Field>
      {error && (
        <p
          role="alert"
          className="rounded-md bg-destructive-muted px-3 py-2 text-sm font-medium text-destructive"
        >
          {error}
        </p>
      )}
      <Button type="submit" size="lg" className="h-11 font-semibold" disabled={pending}>
        {pending && <Loader2 className="animate-spin" />}
        Entrar <ArrowRight />
      </Button>
    </form>
  );
}
