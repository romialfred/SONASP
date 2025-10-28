import { ReactNode } from 'react';
import { Header } from './Header';
import { AccordionSidebar } from './AccordionSidebar';
import { ProfileErrorBanner } from '@/components/ui/ProfileErrorBanner';

export interface MainLayoutProps {
  children: ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  return (
    <div className="min-h-screen h-screen bg-gray-50 flex overflow-hidden">
      <ProfileErrorBanner />
      <AccordionSidebar />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header />

        <main className="flex-1 p-6 overflow-y-auto overflow-x-hidden">
          <div className="max-w-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
