import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { BarChart, TrendingUp, TrendingDown, Search } from 'lucide-react';
import { analyzeFxTransaction, type FxAnalysisResult } from '@/services/fxAnalysisService';

/**
 * Analyse d'une transaction FX : compare le taux client aux sources de marché
 * (ECB / Revolut / BCEAO) et calcule le gain/manque à gagner.
 *
 * NOTE (audit) : l'ancien composant appelait `analyzeFxTransaction` avec une
 * signature erronée (customerId/dates) et lisait une forme de données inexistante
 * — il ne fonctionnait pas. Réécrit ici en accord avec le service réel.
 */
export function FxAnalysisTab() {
  const [amount, setAmount] = useState<string>('10000');
  const [currencyPair, setCurrencyPair] = useState<string>('USD/EUR');
  const [customerRate, setCustomerRate] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<FxAnalysisResult | null>(null);

  const runAnalysis = async () => {
    setError(null);
    setResult(null);

    const amountNum = parseFloat(amount);
    const rateNum = parseFloat(customerRate);

    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      setError('Veuillez saisir un montant valide.');
      return;
    }
    if (!Number.isFinite(rateNum) || rateNum <= 0) {
      setError('Veuillez saisir un taux client valide.');
      return;
    }
    if (!currencyPair.trim()) {
      setError('Veuillez saisir une paire de devises (ex. USD/EUR).');
      return;
    }

    setLoading(true);
    try {
      const res = await analyzeFxTransaction(amountNum, currencyPair.trim(), rateNum);
      if (res.success && res.data) {
        setResult(res.data);
      } else {
        setError(res.error || 'Analyse impossible.');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur inattendue.');
    } finally {
      setLoading(false);
    }
  };

  const isGain = result ? result.best_source === 'Customer' : false;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart className="w-5 h-5" />
            Analyse d'une transaction FX
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1" htmlFor="fx-amount">Montant</label>
              <input
                id="fx-amount"
                type="number"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" htmlFor="fx-pair">Paire de devises</label>
              <input
                id="fx-pair"
                type="text"
                placeholder="USD/EUR"
                value={currencyPair}
                onChange={(e) => setCurrencyPair(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" htmlFor="fx-rate">Taux client</label>
              <input
                id="fx-rate"
                type="number"
                min="0"
                step="0.0001"
                value={customerRate}
                onChange={(e) => setCustomerRate(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2"
              />
            </div>
          </div>

          <button
            type="button"
            onClick={runAnalysis}
            disabled={loading}
            className="mt-4 inline-flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-white disabled:opacity-50"
          >
            <Search className="w-4 h-4" />
            {loading ? 'Analyse…' : 'Analyser'}
          </button>

          {error && (
            <p className="mt-3 text-sm text-red-600">{error}</p>
          )}
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {isGain ? <TrendingUp className="w-5 h-5 text-emerald-600" /> : <TrendingDown className="w-5 h-5 text-amber-600" />}
              Résultat
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
              <div>
                <p className="text-xs text-gray-500">Meilleur taux</p>
                <p className="text-lg font-semibold">{result.best_rate.toFixed(4)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Meilleure source</p>
                <p className="text-lg font-semibold">{result.best_source}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Taux client</p>
                <p className="text-lg font-semibold">{result.customer_rate.toFixed(4)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Gain / manque à gagner</p>
                <p className={`text-lg font-semibold ${isGain ? 'text-emerald-600' : 'text-amber-600'}`}>
                  {result.gain_loss_amount.toFixed(2)} ({result.gain_loss_percentage.toFixed(2)}%)
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left border-b">
                    <th className="py-2">Source</th>
                    <th className="py-2">Taux</th>
                    <th className="py-2">Montant converti</th>
                  </tr>
                </thead>
                <tbody>
                  {result.rates.map((r) => (
                    <tr key={r.source} className="border-b last:border-0">
                      <td className="py-2">{r.source}</td>
                      <td className="py-2">{r.rate.toFixed(4)}</td>
                      <td className="py-2">{r.converted_amount.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
