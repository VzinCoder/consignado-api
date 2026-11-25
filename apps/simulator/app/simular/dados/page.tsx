import { PersonalDataStep } from '@/components/personal-data-step';
import { SiteHeader } from '@/components/site-header';

export default function PersonalDataPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-[1312px] px-6 py-12 lg:py-16">
        <PersonalDataStep />
      </main>
    </>
  );
}
