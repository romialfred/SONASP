import { ReactNode } from 'react';
import { NationalDashboardLayout } from './NationalDashboardLayout';
import './main-layout.css';

export interface MainLayoutProps {
  children: ReactNode;
}

/**
 * Coquille applicative unique.
 *
 * `MainLayout` ne porte plus sa propre navigation : elle délègue à
 * `NationalDashboardLayout` pour que toutes les pages partagent le meme en-tete et la
 * meme barre laterale. Le conteneur `sn-legacy-page` restitue la gouttiere que les
 * pages non encore refondues attendaient de l'ancien layout ; les pages refondues
 * utilisent `sn-page` et neutralisent cette gouttiere.
 */
export function MainLayout({ children }: MainLayoutProps) {
  return (
    <NationalDashboardLayout>
      <div className="sn-legacy-page">{children}</div>
    </NationalDashboardLayout>
  );
}
