import { ArrowRight, LogIn } from 'lucide-react';
import { Link } from 'react-router-dom';
import './portal-access-button.css';

/** One public entry point; role/tenant routing remains the login page's responsibility. */
export function PortalAccessButton({ label, compact = false }: { label: string; compact?: boolean }) {
  return (
    <Link
      className={`public-button public-button--${compact ? 'compact' : 'primary'} public-portal-button`}
      to="/login"
    >
      <LogIn className="public-portal-button__icon" aria-hidden="true" strokeWidth={1.75} />
      <span className="public-portal-button__label">{label}</span>
      <ArrowRight className="public-portal-button__arrow" aria-hidden="true" strokeWidth={1.75} />
    </Link>
  );
}
