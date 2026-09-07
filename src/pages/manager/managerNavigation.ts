import { BarChart3, Bell, Building2, ClipboardCheck, FileSignature, LayoutDashboard, ReceiptText, TrendingUp, UserRound, WalletCards, type LucideIcon } from 'lucide-react';
export type Section = 'synthese' | 'production' | 'previsions' | 'achats' | 'contrats' | 'finances' | 'performance' | 'rapports' | 'alertes' | 'compte';
type NavItem = { id: Section; label: string; icon: LucideIcon };

export const navigation: NavItem[] = [
  { id: 'synthese', label: 'Vue exécutive', icon: LayoutDashboard },
  { id: 'production', label: 'Production nationale', icon: BarChart3 },
  { id: 'previsions', label: 'Budgets et prévisions', icon: TrendingUp },
  { id: 'achats', label: 'Achats et demandes', icon: ClipboardCheck },
  { id: 'contrats', label: 'Contrats', icon: FileSignature },
  { id: 'finances', label: 'Factures et paiements', icon: WalletCards },
  { id: 'performance', label: 'Performance des sociétés', icon: Building2 },
  { id: 'rapports', label: 'Rapports', icon: ReceiptText },
  { id: 'alertes', label: 'Alertes', icon: Bell },
  { id: 'compte', label: 'Mon compte', icon: UserRound },
];
