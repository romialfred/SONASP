import '@testing-library/jest-dom';
import { configure } from '@testing-library/react';

/**
 * Delai d'attente des utilitaires asynchrones (`waitFor`, `findBy*`).
 *
 * Par defaut Testing Library abandonne au bout d'une seconde. Lorsque la suite
 * complete s'execute en parallele, un rendu peut depasser ce seuil sans traduire
 * la moindre regression : des tests differents echouaient d'une execution a l'autre.
 */
configure({ asyncUtilTimeout: 5_000 });
