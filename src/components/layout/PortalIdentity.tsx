import { Building2, Factory, FlaskConical, Landmark, Mountain, ShieldCheck, Truck, UserRound, UsersRound } from 'lucide-react';
import type { PortalTheme } from './portalThemes';

const icons = { shield: ShieldCheck, landmark: Landmark, mine: Mountain, building: Building2, collector: UsersRound, factory: Factory, shipping: Truck, refinery: FlaskConical, client: UserRound };
export function PortalIdentity({ theme }: { theme: PortalTheme }) {
  const Icon = icons[theme.icon];
  return <div className="national-header__portal" aria-label={`Portail ${theme.label}`}><Icon aria-hidden="true" /><div><small>Portail</small><strong>{theme.label}</strong></div></div>;
}

export function PlatformTraceIcon() {
  return <svg className="national-header__trace" viewBox="0 0 64 58" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinejoin="round" aria-hidden="true"><path d="m5 29 7-15 22 2 6 15-20 5-15-7Zm7-15 7 8 20 1M19 22l1 14M32 39l16-3 8-10M38 9l5-4M47 16l7-5"/><circle cx="47" cy="4" r="3"/><circle cx="57" cy="9" r="3"/><circle cx="57" cy="23" r="3"/><path d="M7 42h24l8 8h13"/><circle cx="56" cy="50" r="3"/></svg>;
}

export function GoldBarsIcon() {
  return <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" aria-hidden="true"><path d="m10 6-3 9 10 2 8-3-3-8H10Zm-5 9-3 10 12 3 2-11M17 17l-3 11 15-4-4-10M7 15l10 2" /></svg>;
}

export function HeaderWaves() {
  return <svg className="national-header__waves" viewBox="0 0 1536 102" preserveAspectRatio="none" aria-hidden="true"><path d="M0 84C210 134 267 53 457 89S770 68 960 94 1295-25 1450 8s119 65 180 33V102H0Z" fill="currentColor" opacity=".07"/><path d="M0 90C253 130 283 68 473 94S771 70 972 99 1297 12 1430 43s122 16 160-5" stroke="currentColor" opacity=".18" fill="none"/><path d="M470 102C659 63 757 125 955 97S1288 49 1400 80s153-20 170-11V102Z" fill="currentColor" opacity=".06"/></svg>;
}
