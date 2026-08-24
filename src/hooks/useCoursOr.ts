import { useCallback, useEffect, useState } from 'react';
import { clearPriceCache, fetchLiveGoldPrice, type LiveGoldPrice } from '@/services/liveGoldPriceService';
import { supabase } from '@/lib/supabase';

export const GRAMMES_PAR_ONCE = 31.1034768;
const INTERVALLE_COURS = 60_000;
const INTERVALLE_TAUX = 300_000;

export interface CoursOr {
  cours: LiveGoldPrice | null;
  /** Taux USD/XOF du référentiel ; `null` s'il n'y en a pas. */
  tauxUsdXof: number | null;
  /** Cours du gramme en FCFA ; `null` dès qu'une des deux entrées manque. */
  prixGrammeFcfa: number | null;
  derniereMaj: Date | null;
  chargement: boolean;
  erreur: string | null;
  actualiser: () => Promise<void>;
}

interface OptionsCoursOr {
  /** Active les sondages périodiques. Les vues de consultation ponctuelle peuvent les désactiver. */
  actualisationAutomatique?: boolean;
}

/** Cours du gramme en FCFA. `null` si le cours ou le taux fait défaut. */
export function prixGrammeDepuisOnce(prixOnceUsd: number | null, tauxUsdXof: number | null): number | null {
  if (prixOnceUsd === null || tauxUsdXof === null) return null;
  if (!(prixOnceUsd > 0) || !(tauxUsdXof > 0)) return null;
  return (prixOnceUsd * tauxUsdXof) / GRAMMES_PAR_ONCE;
}

/**
 * Écart d'un prix négocié au cours du marché, en pourcentage.
 * `null` quand le cours n'est pas connu ou qu'aucun prix n'est saisi : sans
 * référence, il n'y a pas d'écart à annoncer.
 */
export function ecartAuCours(prixSaisi: number, prixMarche: number | null): number | null {
  if (prixMarche === null || !(prixMarche > 0) || !(prixSaisi > 0)) return null;
  return ((prixSaisi - prixMarche) / prixMarche) * 100;
}

/**
 * Lit le dernier taux USD/XOF du référentiel officiel de la plateforme.
 *
 * Cette lecture reste facultative : une table momentanément indisponible ne
 * doit jamais empêcher une page métier de s'afficher.
 */
export async function chargerDernierTauxUsdXof(): Promise<number | null> {
  try {
    const { data, error } = await supabase
      .from('fx_rates_daily')
      .select('rate')
      .eq('currency_pair', 'USD/XOF')
      .order('rate_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) return null;
    const rate = Number(data.rate);
    return Number.isFinite(rate) && rate > 0 ? rate : null;
  } catch {
    return null;
  }
}

/**
 * Source unique du cours de l'or pour la plateforme.
 *
 * Le panneau de cours et le formulaire de vente interrogeaient chacun leur côté ;
 * deux sondages, et deux valeurs susceptibles de diverger sur un même écran.
 */
export function useCoursOr({ actualisationAutomatique = true }: OptionsCoursOr = {}): CoursOr {
  const [cours, setCours] = useState<LiveGoldPrice | null>(null);
  const [tauxUsdXof, setTauxUsdXof] = useState<number | null>(null);
  const [derniereMaj, setDerniereMaj] = useState<Date | null>(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);

  const chargerTaux = useCallback(async () => {
    // Aucun taux de repli : une conversion approximative vaut moins que pas de conversion.
    setTauxUsdXof(await chargerDernierTauxUsdXof());
  }, []);

  const chargerCours = useCallback(async (manuel = false) => {
    if (manuel) clearPriceCache();
    try {
      const donnees = await fetchLiveGoldPrice();
      if (donnees) {
        setCours(donnees);
        setDerniereMaj(new Date());
        setErreur(null);
      } else {
        setErreur('Cours indisponible auprès de la source.');
      }
    } catch {
      setErreur('Cours indisponible : la source n’a pas répondu.');
    } finally {
      setChargement(false);
    }
  }, []);

  const actualiser = useCallback(async () => {
    await Promise.all([chargerCours(true), chargerTaux()]);
  }, [chargerCours, chargerTaux]);

  useEffect(() => {
    void chargerCours();
    void chargerTaux();
    if (!actualisationAutomatique) return undefined;

    const cadenceCours = setInterval(() => void chargerCours(), INTERVALLE_COURS);
    const cadenceTaux = setInterval(() => void chargerTaux(), INTERVALLE_TAUX);
    return () => {
      clearInterval(cadenceCours);
      clearInterval(cadenceTaux);
    };
  }, [actualisationAutomatique, chargerCours, chargerTaux]);

  return {
    cours,
    tauxUsdXof,
    prixGrammeFcfa: prixGrammeDepuisOnce(cours?.price ?? null, tauxUsdXof),
    derniereMaj,
    chargement,
    erreur,
    actualiser,
  };
}
