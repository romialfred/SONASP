import { Calculator, CheckCircle2, FileText, Truck } from 'lucide-react';

const STEPS = [
  { title: 'Simulation', description: 'Paramétrage et estimation', icon: Calculator },
  { title: 'Validation', description: 'Revue et approbation', icon: CheckCircle2 },
  { title: 'Contrat & paiement', description: 'Émission et règlement', icon: FileText },
  { title: 'Expédition & conciliation', description: 'Expédition et rapprochement', icon: Truck },
];

export function SaleJourney() {
  return (
    <section className="sale-simulator__journey" aria-labelledby="sale-journey-title">
      <h2 id="sale-journey-title">Parcours de la vente</h2>
      <ol>
        {STEPS.map(({ title, description, icon: Icon }, index) => (
          <li key={title} className={index === 0 ? 'is-active' : ''}>
            <span className="sale-simulator__journey-icon"><Icon aria-hidden="true" /></span>
            <div><strong>{title}</strong><small>{description}</small></div>
            {index < STEPS.length - 1 && <span className="sale-simulator__journey-arrow" aria-hidden="true">→</span>}
          </li>
        ))}
      </ol>
    </section>
  );
}
