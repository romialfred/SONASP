import type { ReactNode } from 'react';
import { Bell, ChevronDown, CircleDollarSign, Gauge, Landmark, Layers3, Settings, UsersRound } from 'lucide-react';
import './visual-shell.css';

const groups = [
  ['MINE SEMI-MÉCANISÉE', 'Sites miniers', 'Artisans miniers'],
  ['MINE INDUSTRIELLE', 'Prévisions & licences', 'Gestion de la production', 'Achat aux mines industrielles', 'Gestion des expéditions'],
  ['VENTE & ACHAT D’OR', 'Marché d’or artisanal'],
  ['RAFFINAGE & STOCKS', 'Gestion du raffinage', 'Suivi du stock d’or'],
  ['RÉSERVE D’OR DU BURKINA FASO', 'Réserve nationale d’or'],
  ['VENTE INTERNATIONALE', 'Simulateur de vente', 'Espace de négoce', 'Cours de l’or', 'Taux de change', 'Ventes d’or internationales', 'Parties prenantes', 'Documents'],
  ['PARAMÈTRES ET CONFIGURATION', 'Paramètres', 'Administration'],
];

export function MainLayout({ children }: { children: ReactNode }) {
  return (
    <div className="visual-shell">
      <aside className="visual-shell__sidebar">
        <div className="visual-shell__logo"><img src="/logo_transparent_sonasp.png" alt="SONASP" /></div>
        <p className="visual-shell__navigation">NAVIGATION</p>
        <a className="visual-shell__dashboard" href="#"><Gauge /> Tableau de bord</a>
        {groups.map(([title, ...items]) => (
          <section key={title}>
            <h2>{title}</h2>
            {items.map((item, index) => (
              <a key={item} href="#" className={item === 'Simulateur de vente' ? 'is-active' : ''}>
                {index % 3 === 0 ? <CircleDollarSign /> : index % 3 === 1 ? <Layers3 /> : <UsersRound />}
                <span>{item}</span>{item !== 'Simulateur de vente' && <span className="visual-shell__plus">+</span>}
              </a>
            ))}
          </section>
        ))}
      </aside>
      <div className="visual-shell__body">
        <header className="visual-shell__header">
          <div><strong>Plateforme SONASP</strong><span>Collecte, traçabilité et valorisation de l’or</span></div>
          <div className="visual-shell__account"><button>FR <ChevronDown /></button><Bell /><i /><Landmark /><span><strong>TIEGNAN Romuald</strong><small>Owner</small></span><ChevronDown /></div>
        </header>
        <div className="visual-shell__content">{children}</div>
      </div>
    </div>
  );
}
