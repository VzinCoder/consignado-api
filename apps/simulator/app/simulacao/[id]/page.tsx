import { SimulationView } from '@/components/simulation-view';
import { SiteHeader } from '@/components/site-header';

export default async function SimulationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-[1312px] px-6 py-10">
        <SimulationView id={id} />
      </main>
    </>
  );
}
