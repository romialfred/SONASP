/**
 * Primitives d'interface SONASP.
 *
 * Elles encapsulent le design system (`src/styles/design-system.css`) pour que chaque
 * page refondue se compose d'éléments identiques : même en-tête, mêmes sections de
 * formulaire, mêmes tableaux, mêmes états vides. Aucune page ne redéfinit ces styles.
 */
import type { ChangeEvent, ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { ChevronDown, Inbox, Loader2, Search } from 'lucide-react';
import { Link } from 'react-router-dom';
import '@/styles/design-system.css';

export type Tone = 'emerald' | 'blue' | 'amber' | 'violet' | 'slate';
export type StatTone = 'green' | 'gold' | 'blue' | 'violet' | 'red';
export type BadgeTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

/* ------------------------------------------------------------------ Page */

export interface BreadcrumbEntry {
  label: string;
  to?: string;
}

export function Breadcrumb({ entries }: { entries: BreadcrumbEntry[] }) {
  return (
    <nav className="sn-breadcrumb" aria-label="Fil d’Ariane">
      {entries.map((entry, index) => (
        <span key={entry.label} style={{ display: 'contents' }}>
          {entry.to ? <Link to={entry.to}>{entry.label}</Link> : <strong aria-current="page">{entry.label}</strong>}
          {index < entries.length - 1 && <span aria-hidden="true">/</span>}
        </span>
      ))}
    </nav>
  );
}

export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  breadcrumb?: BreadcrumbEntry[];
  actions?: ReactNode;
  /** Tuiles de contexte affichées à droite (code généré, complétude, indicateur…). */
  aside?: ReactNode;
}

export function PageHeader({ title, subtitle, icon: Icon, breadcrumb, actions, aside }: PageHeaderProps) {
  return (
    <>
      {breadcrumb && <Breadcrumb entries={breadcrumb} />}
      <header className="sn-page__head">
        {Icon && (
          <span className="sn-page__icon">
            <Icon aria-hidden="true" />
          </span>
        )}
        <div>
          <h2>{title}</h2>
          {subtitle && <p className="sn-page__subtitle">{subtitle}</p>}
        </div>
        {aside}
        {actions && <div className="sn-page__actions">{actions}</div>}
      </header>
    </>
  );
}

/* ------------------------------------------------------------------ Sections */

export interface SectionProps {
  id: string;
  title: string;
  description?: string;
  icon: LucideIcon;
  tone?: Tone;
  children: ReactNode;
}

export function Section({ id, title, description, icon: Icon, tone = 'emerald', children }: SectionProps) {
  return (
    <section className={`sn-section sn-section--${tone}`} aria-labelledby={`${id}-title`}>
      <header className="sn-section__head">
        <span className="sn-section__icon">
          <Icon aria-hidden="true" />
        </span>
        <div>
          <h3 id={`${id}-title`}>{title}</h3>
          {description && <p>{description}</p>}
        </div>
      </header>
      <div className="sn-section__body">{children}</div>
    </section>
  );
}

export function Card({ title, hint, actions, children, className = '' }: {
  title?: string;
  hint?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <article className={`sn-card ${className}`.trim()}>
      {(title || actions) && (
        <div className="sn-card__head">
          <div>
            {title && <h3>{title}</h3>}
            {hint && <p className="sn-card__hint">{hint}</p>}
          </div>
          {actions}
        </div>
      )}
      {children}
    </article>
  );
}

/* ------------------------------------------------------------------ Champs */

export function Field({ label, required, hint, error, wide, htmlFor, children }: {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  wide?: boolean;
  htmlFor?: string;
  children: ReactNode;
}) {
  return (
    <label className={`sn-field${wide ? ' sn-field--wide' : ''}`} htmlFor={htmlFor}>
      <span className="sn-field__label">
        {label}
        {required && <i aria-hidden="true">*</i>}
      </span>
      {children}
      {error ? <small className="is-error">{error}</small> : hint ? <small>{hint}</small> : null}
    </label>
  );
}

export function SelectControl({ value, onChange, children, ariaLabel }: {
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
  ariaLabel?: string;
}) {
  return (
    <div className="sn-select">
      <select value={value} onChange={(event: ChangeEvent<HTMLSelectElement>) => onChange(event.target.value)} aria-label={ariaLabel}>
        {children}
      </select>
      <ChevronDown aria-hidden="true" />
    </div>
  );
}

export function SearchInput({ value, onChange, placeholder, onSubmit, ariaLabel }: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  onSubmit?: () => void;
  ariaLabel?: string;
}) {
  return (
    <label className="sn-search">
      <Search aria-hidden="true" />
      <input
        type="search"
        value={value}
        placeholder={placeholder}
        aria-label={ariaLabel || placeholder}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => event.key === 'Enter' && onSubmit?.()}
      />
    </label>
  );
}

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  icon?: LucideIcon;
}

export function Segmented<T extends string>({ name, value, options, onChange, ariaLabel }: {
  name: string;
  value: T;
  options: SegmentedOption<T>[];
  onChange: (value: T) => void;
  ariaLabel: string;
}) {
  return (
    <div className="sn-segmented" role="radiogroup" aria-label={ariaLabel}>
      {options.map((option) => {
        const Icon = option.icon;
        return (
          <label key={option.value} className={value === option.value ? 'is-active' : ''}>
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
            />
            {Icon && <Icon aria-hidden="true" />}
            {option.label}
          </label>
        );
      })}
    </div>
  );
}

export interface ChoiceOption<T extends string> {
  value: T;
  label: string;
  description?: string;
  icon: LucideIcon;
}

export function ChoiceCards<T extends string>({ name, value, options, onChange, legend }: {
  name: string;
  value: T;
  options: ChoiceOption<T>[];
  onChange: (value: T) => void;
  legend?: string;
}) {
  return (
    <fieldset style={{ margin: 0, padding: 0, border: 0 }}>
      {legend && <legend className="sn-field__label">{legend}</legend>}
      <div className="sn-choices">
        {options.map((option) => {
          const Icon = option.icon;
          return (
            <label key={option.value} className={value === option.value ? 'is-checked' : ''}>
              <input
                type="radio"
                name={name}
                value={option.value}
                checked={value === option.value}
                onChange={() => onChange(option.value)}
              />
              <span className="sn-choices__icon">
                <Icon aria-hidden="true" />
              </span>
              <span>
                <strong>{option.label}</strong>
                {option.description && <small>{option.description}</small>}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

/* ------------------------------------------------------------------ Indicateurs */

export interface StatItem {
  label: string;
  value: ReactNode;
  hint?: string;
  icon: LucideIcon;
  tone?: StatTone;
}

export function StatGrid({ items, ariaLabel }: { items: StatItem[]; ariaLabel: string }) {
  return (
    <section className="sn-stats" aria-label={ariaLabel}>
      {items.map(({ label, value, hint, icon: Icon, tone = 'green' }) => (
        <article key={label} className={`sn-stat sn-stat--${tone}`}>
          <span className="sn-stat__icon">
            <Icon aria-hidden="true" />
          </span>
          <div>
            <h3>{label}</h3>
            <strong>{value}</strong>
            {hint && <small>{hint}</small>}
          </div>
        </article>
      ))}
    </section>
  );
}

export function Badge({ tone = 'neutral', icon: Icon, children }: {
  tone?: BadgeTone;
  icon?: LucideIcon;
  children: ReactNode;
}) {
  return (
    <span className={`sn-badge sn-badge--${tone}`}>
      {Icon && <Icon aria-hidden="true" />}
      {children}
    </span>
  );
}

export function Note({ tone = 'success', icon: Icon, children }: {
  tone?: 'success' | 'info' | 'warning' | 'danger';
  icon?: LucideIcon;
  children: ReactNode;
}) {
  const modifier = tone === 'success' ? '' : ` sn-note--${tone}`;
  return (
    <p className={`sn-note${modifier}`} role={tone === 'danger' ? 'alert' : undefined} style={{ margin: 0 }}>
      {Icon && <Icon aria-hidden="true" />}
      <span>{children}</span>
    </p>
  );
}

/* ------------------------------------------------------------------ Tableau */

export interface Column<T> {
  key: string;
  header: string;
  /** Cellule ; par défaut la valeur brute de la clé. */
  render?: (row: T) => ReactNode;
  numeric?: boolean;
}

export function DataTable<T extends { id?: string }>({ columns, rows, onRowClick, empty, loading, caption }: {
  columns: Column<T>[];
  rows: T[];
  onRowClick?: (row: T) => void;
  empty?: string;
  loading?: boolean;
  caption?: string;
}) {
  return (
    <div className="sn-table-wrap">
      <table className="sn-table">
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key} className={column.numeric ? 'sn-table__num' : undefined}>
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr
              key={row.id || index}
              className={onRowClick ? 'is-clickable' : undefined}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
            >
              {columns.map((column) => (
                <td key={column.key} className={column.numeric ? 'sn-table__num' : undefined}>
                  {column.render ? column.render(row) : String((row as Record<string, unknown>)[column.key] ?? '—')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {loading && <p className="sn-empty"><Loader2 className="sn-spin" aria-hidden="true" /> Chargement…</p>}
      {!loading && rows.length === 0 && <p className="sn-empty">{empty || 'Aucun résultat.'}</p>}
    </div>
  );
}

export function EmptyState({ title, description, action }: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="sn-empty">
      <Inbox aria-hidden="true" style={{ width: 26, height: 26, opacity: 0.5 }} />
      <p style={{ margin: '8px 0 0', fontWeight: 600 }}>{title}</p>
      {description && <p style={{ margin: '4px 0 0', fontSize: 11.5 }}>{description}</p>}
      {action && <div style={{ marginTop: 12 }}>{action}</div>}
    </div>
  );
}

export function FormActions({ children }: { children: ReactNode }) {
  return <footer className="sn-form-actions">{children}</footer>;
}
