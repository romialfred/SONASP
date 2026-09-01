import postcss from 'postcss';
import { describe, expect, it } from 'vitest';
import buttonCss from './portal-access-button.css?raw';
import publicCss from './public-site.css?raw';

const buttonStyles = postcss.parse(buttonCss);
const publicStyles = postcss.parse(publicCss);

function declaration(styles: postcss.Root, selector: string, property: string, reducedMotion = false) {
  let result: string | undefined;
  styles.walkRules((rule) => {
    if (!rule.selectors.includes(selector)) return;
    const parent = rule.parent;
    const inReducedMotion = parent?.type === 'atrule'
      && (parent as postcss.AtRule).params === '(prefers-reduced-motion: reduce)';
    if (reducedMotion ? !inReducedMotion : parent?.type !== 'root') return;
    rule.walkDecls(property, (decl) => { result = decl.value; });
  });
  return result;
}

describe('contrats CSS du bouton public doré', () => {
  it('réserve deux colonnes identiques autour du texte centré', () => {
    expect(declaration(buttonStyles, '.public-button.public-portal-button', 'grid-template-columns'))
      .toBe('20px minmax(0, 1fr) 20px');
    expect(declaration(buttonStyles, '.public-portal-button__label', 'text-align')).toBe('center');
  });

  it('préserve le fond doré au survol face aux anciens styles verts du hero', () => {
    expect(declaration(buttonStyles, '.public-site .public-button.public-portal-button:hover', 'background'))
      .toBe('var(--public-gold-gradient)');
  });

  it('supprime le déplacement et le reflet en mouvement réduit', () => {
    expect(declaration(buttonStyles, '.public-site .public-button.public-portal-button:hover', 'transform', true))
      .toBe('none');
    expect(declaration(buttonStyles, '.public-portal-button::before', 'display', true)).toBe('none');
  });

  it('aligne la hauteur des deux actions sans neutraliser les largeurs responsive', () => {
    expect(declaration(buttonStyles, '.public-site .public-button.public-portal-button', 'min-height')).toBe('54px');
    expect(declaration(publicStyles, '.public-hero .public-button.public-button--secondary', 'min-height')).toBe('54px');
    expect(declaration(publicStyles, '.public-hero .public-button.public-button--secondary', 'min-width')).toBeUndefined();
  });
});
