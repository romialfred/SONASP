import type { CSSProperties } from 'react';
import type { AccountType } from '@/lib/routeAccessRegistry';

export interface PortalTheme {
  id: string;
  label: string;
  space: string;
  icon: 'shield' | 'landmark' | 'mine' | 'building' | 'collector' | 'factory' | 'shipping' | 'refinery' | 'client';
  sidebar: string;
  hover: string;
  primary: string;
  accent: string;
  active: string;
  header: string;
  prescribed: boolean;
}

const palettes = {
  admin: ['#10352F', '#1A463D', '#00513D', '#B58B3A', '#F0D786', '#F4ECD9'],
  direction: ['#28372B', '#394B36', '#385A3F', '#8B995C', '#E6ECD5', '#F0F3E8'],
  dgmg: ['#153447', '#244C61', '#1F5070', '#4F889F', '#DDECF2', '#EDF4F7'],
  dgi: ['#123C3C', '#205252', '#0B665C', '#47988E', '#D9EEEA', '#EDF6F3'],
  mine: ['#30271E', '#483927', '#805614', '#B58B3A', '#EEDDBC', '#F7F0E3'],
  comptoir: ['#202F46', '#304662', '#284972', '#6D8BAE', '#DFE7F1', '#EEF2F8'],
  collector: ['#402B25', '#583B31', '#8B431F', '#B67959', '#F0DED2', '#FAF0E9'],
  customer: ['#29353F', '#3C4B57', '#475A6A', '#8196A8', '#E3E9EE', '#F1F4F7'],
  legacy: ['#1B2A3A', '#2B4359', '#0F7A56', '#B58B3A', '#E2ECE8', '#F2F5F6'],
} as const;

function theme(id: string, label: string, icon: PortalTheme['icon'], palette: keyof typeof palettes, prescribed = true): PortalTheme {
  const [sidebar, hover, primary, accent, active, header] = palettes[palette];
  return { id, label, space: `ESPACE ${label.toLocaleUpperCase('fr-FR')}`, icon, sidebar, hover, primary, accent, active, header, prescribed };
}

/** Presentation only. The existing account resolver remains the authorization boundary. */
export const PORTAL_THEMES: Record<AccountType, PortalTheme> = {
  owner: theme('admin', 'Administrateur', 'shield', 'admin'),
  admin: theme('admin', 'Administrateur', 'shield', 'admin'),
  sonasp: theme('sonasp', 'SONASP', 'building', 'direction'),
  direction: theme('direction', 'Direction SONASP', 'landmark', 'direction'),
  dgmg: theme('dgmg', 'Mines · DGMG', 'mine', 'dgmg'),
  dgi: theme('dgi', 'Finances · DGI', 'landmark', 'dgi'),
  mine: theme('mine', 'Société minière', 'mine', 'mine'),
  comptoir: theme('comptoir', 'Comptoir', 'building', 'comptoir'),
  collector: theme('collector', 'Agent collecteur', 'collector', 'collector'),
  customer: theme('customer', 'Client', 'client', 'customer'),
  factory: theme('factory', 'Production', 'factory', 'legacy', false),
  airport: theme('airport', 'Expéditions', 'shipping', 'legacy', false),
  refinery: theme('refinery', 'Raffinerie', 'refinery', 'legacy', false),
  unknown: theme('unknown', 'Accès sécurisé', 'shield', 'customer', false),
};

export function portalThemeVariables(value: PortalTheme): CSSProperties {
  return {
    '--sidebar-bg': value.sidebar, '--sidebar-hover-bg': value.hover,
    '--portal-primary': value.primary, '--portal-accent': value.accent,
    '--nav-active-bg': 'rgba(240, 199, 80, 0.22)', '--nav-active-text': '#FFE39A',
    '--header-bg-end': value.header, '--header-wave-color': value.accent,
    '--focus-ring': value.primary,
  } as CSSProperties;
}
