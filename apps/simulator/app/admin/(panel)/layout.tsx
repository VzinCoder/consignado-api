import { AdminSidebar } from '@/components/admin/sidebar';
import { requireAdminPage } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requireAdminPage();
  return (
    <div className="flex min-h-screen">
      <AdminSidebar username={session.username} />
      <main className="min-w-0 flex-1 px-10 py-9">{children}</main>
    </div>
  );
}
