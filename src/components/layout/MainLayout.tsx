import { ReactNode } from 'react';
import { Header } from './Header';
import { AccordionSidebar } from './AccordionSidebar';
import { ProfileErrorBanner } from '@/components/ui/ProfileErrorBanner';

export interface MainLayoutProps {
  children: ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50 flex">
      <ProfileErrorBanner />
      <AccordionSidebar />

      <div className="flex-1 flex flex-col">
        <Header />

        <main className="flex-1 p-6 overflow-auto">
          <div className="min-h-[calc(100vh-64px)]">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
