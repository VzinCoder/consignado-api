import Image from 'next/image';
import { redirect } from 'next/navigation';
import { LoginForm } from '@/components/admin/login-form';
import { Card } from '@/components/ui/card';
import { getAdminSession } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

export default async function AdminLoginPage() {
  if (await getAdminSession()) redirect('/admin');

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-6">
      <Card className="w-full max-w-[420px] gap-6 rounded-xl p-8 shadow-sm">
        <div className="flex flex-col items-center gap-3 text-center">
          <Image
            src="/logo.png"
            alt="Zelafin"
            width={126}
            height={28}
            className="h-7 w-auto"
            priority
          />
          <div className="flex flex-col gap-1">
            <h1 className="text-xl font-bold">Acesso à equipe Zelafin</h1>
            <p className="text-sm text-muted-foreground">Entre com a sua conta da equipe.</p>
          </div>
        </div>
        <LoginForm />
      </Card>
      <p className="text-xs text-muted-foreground">
        Área restrita à equipe. Acessos são registrados.
      </p>
    </main>
  );
}
