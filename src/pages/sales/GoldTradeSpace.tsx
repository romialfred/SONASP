import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Loading } from '@/components/ui/Loading';
import { LiveGoldMarketPanel } from '@/components/sales/LiveGoldMarketPanel';
import { PricingCalculator } from '@/components/sales/PricingCalculator';
import { FinancialComparison } from '@/components/sales/FinancialComparison';
import { GoldSalesFlowDiagram } from '@/components/sales/GoldSalesFlowDiagram';
import {
  Store,
  TrendingUp,
  CheckCircle,
  Lightbulb,
} from 'lucide-react';
import {
  getQuantityRecommendation,
  getApprovedRefineries,
  type PricingMechanism,
  type QuantityRecommendation,
} from '@/services/goldTradeSpaceService';
import { stockSonaspService, type StockSonasp } from '@/services/stockSonaspService';
import { mineStockService, type MineExportableStock } from '@/services/mineStockService';
import { getAuthorizedCustomersForMine } from '@/services/goldSalesSettingsService';
import { supabase } from '@/lib/supabase';
import { useAlert } from '@/hooks/useAlert';
import { useAuth } from '@/contexts/AuthContext';

interface Customer {
  id: string;
  name: string;
}

interface MiningCompany {
  id: string;
  name: string;
  abbreviation: string;
  country: string;
  code: string;
  company_type: 'production_mine' | 'institution' | 'parent_company';
}

export function GoldTradeSpace() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const alert = useAlert();
  const { user } = useAuth();
  const mineCompanyId = user?.mining_company_id || null;
  const isMine = Boolean(mineCompanyId);

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [refineries, setRefineries] = useState<any[]>([]);
  const [vendeur, setVendeur] = useState<MiningCompany | null>(null);
  const [stockExport, setStockExport] = useState<StockSonasp | null>(null);
  const [stockMine, setStockMine] = useState<MineExportableStock | null>(null);

  const [selectedMiningCompany, setSelectedMiningCompany] = useState('');
  const [availableStock, setAvailableStock] = useState(0);
  const [quantityRecommendation, setQuantityRecommendation] = useState<QuantityRecommendation | null>(null);

  const [selectedMechanism, setSelectedMechanism] = useState<PricingMechanism | null>(null);
  const [comparisonData, setComparisonData] = useState<any>(null);

  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [selectedRefinery, setSelectedRefinery] = useState('');

  const [loading, setLoading] = useState(true);

  const [, setIsPanelCollapsed] = useState(false);

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (selectedMiningCompany) {
      fetchInventoryByMiningCompany();
    }
  }, [selectedMiningCompany]);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const [refineriesRes, miningCompaniesRes] = await Promise.all([
        getApprovedRefineries(),
        supabase
          .from('mining_companies')
          .select('id, name, abbreviation, country, code, company_type')
          .eq('is_active', true)
          .order('name'),
      ]);

      if (refineriesRes.success && refineriesRes.data) {
        setRefineries(refineriesRes.data);
      }

      if (miningCompaniesRes.error) throw miningCompaniesRes.error;

      // Le vendeur n'est jamais choisi par le navigateur : pour une mine il
      // vient du profil authentifié, pour l'administration il s'agit de la SONASP.
      const seller = isMine
        ? (miningCompaniesRes.data || []).find((company) => company.id === mineCompanyId)
        : (miningCompaniesRes.data || []).find(
            (company) => company.code?.toUpperCase() === 'SONASP'
              && company.company_type === 'institution'
          );
      if (seller) {
        setVendeur(seller);
        setSelectedMiningCompany(seller.id);

        const authorizedCustomers = await getAuthorizedCustomersForMine(seller.id);
        if (!authorizedCustomers.success) {
          throw new Error(authorizedCustomers.error?.message || 'Clients autorisés indisponibles.');
        }
        setCustomers(
          authorizedCustomers.data.map((customer) => ({
            id: customer.customer_id,
            name: customer.customer_name,
          }))
        );
      } else {
        alert.error(
          isMine
            ? "Votre compte n'est rattaché à aucune mine active."
            : "La SONASP active n'est pas enregistrée comme institution dans le référentiel."
        );
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      alert.error("Impossible de charger l'espace de négoce.");
    } finally {
      setLoading(false);
    }
  };

  const fetchInventoryByMiningCompany = async () => {
    if (!selectedMiningCompany) {
      setAvailableStock(0);
      setQuantityRecommendation(null);
      return;
    }

    try {
      const stock = isMine
        ? await mineStockService.stock()
        : await stockSonaspService.stock(selectedMiningCompany);
      if (isMine) {
        setStockMine(stock as MineExportableStock);
        setStockExport(null);
      } else {
        setStockExport(stock as StockSonasp);
        setStockMine(null);
      }
      const availableOz = isMine
        ? (stock as MineExportableStock).availableOz
        : (stock as StockSonasp).disponibleOz;
      const result = { success: true, availableOz, error: null };

      if (result.success) {
        const totalStock = result.availableOz || 0;
        setAvailableStock(totalStock);

        if (totalStock > 0) {
          const recResult = await getQuantityRecommendation(totalStock);
          if (recResult.success && recResult.data) {
            setQuantityRecommendation(recResult.data);
          }
        } else {
          setQuantityRecommendation(null);
        }
      } else {
        console.error('Error fetching inventory:', result.error);
        setAvailableStock(0);
        setQuantityRecommendation(null);
      }
    } catch (error) {
      console.error('Error fetching inventory:', error);
      setAvailableStock(0);
      setQuantityRecommendation(null);
    }
  };

  const handleMechanismSelect = (mechanism: PricingMechanism) => {
    setSelectedMechanism(mechanism);
  };

  const handleCreateSale = () => {
    if (!selectedMechanism || !comparisonData) {
      alert.error('Effectuez d’abord le calcul et sélectionnez un mécanisme de vente.');
      return;
    }
    if (!selectedCustomer) {
      alert.error('Sélectionnez un client autorisé avant de poursuivre.');
      return;
    }
    if (selectedMechanism.mechanism === 'in_process' && !selectedRefinery) {
      alert.error('Sélectionnez la raffinerie de destination avant de poursuivre.');
      return;
    }

    // Navigate to sale creation with pre-filled data
    navigate('/sales/new', {
      state: {
        mechanismData: selectedMechanism,
        quantityOz: comparisonData.quantityOz,
        availableStockOz: availableStock,
        preselectedSellerId: selectedMiningCompany,
        lockSeller: true,
        preselectedCustomerId: selectedCustomer || null,
        preselectedRefineryId: selectedRefinery || null,
      }
    });
  };

  const handleCalculationComplete = (comparison: any) => {
    setComparisonData(comparison);
  };

  if (loading) {
    return (
      <MainLayout>
        <Loading />
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
              <Store className="w-7 h-7 text-amber-600" />
              {t('tradeSpace.title')}
            </h1>
            <p className="text-gray-600 mt-1 text-sm">
              {t('tradeSpace.subtitle')}
            </p>
          </div>
        </div>

        {/* Live Gold Market Panel - Fixed Right Side */}
        <LiveGoldMarketPanel onCollapseChange={setIsPanelCollapsed} />

        {/* Main Content Area - Adjusts based on panel state */}
        <div className="space-y-6 max-w-full">
          {/* Vendeur et stock exportable dérivés du compte authentifié */}
          <Card className="bg-amber-50 border-amber-200">
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-3">
                <Store className="w-6 h-6 text-amber-700" />
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    Vendeur : {vendeur?.name || (isMine ? 'Société minière' : 'SONASP')}
                  </h3>
                  <p className="text-sm text-gray-600">
                    {isMine
                      ? "Vente internationale du reliquat de production non racheté par la SONASP."
                      : "Ventes hors du Burkina, avec l’or acheté aux mines industrielles et aux artisans miniers."}
                  </p>
                </div>
              </div>

              <div className="bg-white rounded-lg p-4 border border-amber-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-600 mb-1">Stock exportable</p>
                    <p className={`text-2xl font-bold ${availableStock > 0 ? 'text-amber-700' : 'text-gray-400'}`}>
                      {availableStock.toFixed(3)} oz
                    </p>
                    <p className="text-xs text-gray-500 mt-1">{(availableStock * 31.1034768).toFixed(2)} g</p>
                  </div>
                  {availableStock > 0 && <CheckCircle className="w-8 h-8 text-green-500" />}
                </div>

                {stockExport && (
                  <div className="mt-4 pt-4 border-t border-amber-100 grid grid-cols-3 gap-4 text-xs">
                    <div>
                      <p className="text-gray-600">Acheté aux mines</p>
                      <p className="text-gray-900">{stockExport.achatMinesOz.toFixed(3)} oz</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Acheté aux artisans</p>
                      <p className="text-gray-900">{stockExport.achatArtisansOz.toFixed(3)} oz</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Déjà vendu à l’export</p>
                      <p className="text-gray-900">{stockExport.venduOz.toFixed(3)} oz</p>
                    </div>
                  </div>
                )}

                {stockMine && (
                  <div className="mt-4 pt-4 border-t border-amber-100 grid grid-cols-3 gap-4 text-xs">
                    <div>
                      <p className="text-gray-600">Production déclarée</p>
                      <p className="text-gray-900">{stockMine.productionOz.toFixed(3)} oz</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Racheté par la SONASP</p>
                      <p className="text-gray-900">{stockMine.purchasedBySonaspOz.toFixed(3)} oz</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Déjà engagé à l’export</p>
                      <p className="text-gray-900">{stockMine.soldByMineOz.toFixed(3)} oz</p>
                    </div>
                  </div>
                )}
              </div>

              {stockExport?.decouvert && (
                <p className="text-sm text-red-700">
                  Ventes enregistrées supérieures aux achats : régularisez les achats avant toute nouvelle vente.
                </p>
              )}

              {stockMine?.overAllocated && (
                <p className="text-sm text-red-700">
                  La production est déjà surallouée. Régularisez les rachats ou les ventes avant toute nouvelle opération.
                </p>
              )}

              {!stockExport && !stockMine && !loading && (
                <p className="text-sm text-gray-600">Stock indisponible : source « achats et ventes » non lue.</p>
              )}
            </div>
          </Card>


          {quantityRecommendation && selectedMiningCompany && (
            <Card className="bg-gradient-to-r from-purple-50 to-blue-50 border-purple-200">
              <div className="p-5 space-y-3">
                <div className="flex items-start gap-3">
                  <Lightbulb className="w-6 h-6 text-purple-600 flex-shrink-0" />
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 text-lg">{t('tradeSpace.aiQuantityRecommendation')}</h3>
                    <div className="mt-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-700">{t('tradeSpace.recommendedQuantity')}</span>
                        <span className="text-xl font-bold text-purple-900">
                          {quantityRecommendation.recommendedQuantityOz.toFixed(2)} {t('tradeSpace.oz')}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-700">{t('tradeSpace.stockPercentage')}</span>
                        <span className="font-semibold text-purple-800">
                          {quantityRecommendation.recommendedPercentage}%
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${
                          quantityRecommendation.riskLevel === 'low'
                            ? 'bg-green-100 text-green-800'
                            : quantityRecommendation.riskLevel === 'medium'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {t('tradeSpace.risk')} {quantityRecommendation.riskLevel === 'low' ? t('tradeSpace.lowRisk') : quantityRecommendation.riskLevel === 'medium' ? t('tradeSpace.mediumRisk') : t('tradeSpace.highRisk')}
                        </span>
                        <span className="px-2 py-1 rounded text-xs font-semibold bg-blue-100 text-blue-800">
                          {quantityRecommendation.confidenceScore}% {t('tradeSpace.confidence')}
                        </span>
                      </div>
                      </div>
                      <p className="text-sm text-gray-700 mt-3 leading-relaxed">
                      {quantityRecommendation.reasoning}
                      </p>
                      <div className="text-xs text-gray-600 mt-2 flex items-center gap-2">
                      <TrendingUp className="w-4 h-4" />
                      <span><strong>{t('tradeSpace.optimalTiming')}</strong> {quantityRecommendation.optimalTiming}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            )}

            {selectedMiningCompany && availableStock > 0 && (
              <PricingCalculator
                availableStockOz={availableStock}
                onMechanismSelect={(mechanism, comparison) => {
                  handleMechanismSelect(mechanism);
                  handleCalculationComplete(comparison);
                }}
              />
            )}

            {comparisonData && comparisonData.mechanisms && (
              <FinancialComparison
                mechanisms={comparisonData.mechanisms}
                recommendedMechanism={comparisonData.recommendedMechanism}
              />
            )}

            {selectedMechanism && comparisonData && (
              <Card className="border-blue-500 border-2">
                <div className="p-6 space-y-4">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-6 h-6 text-blue-600" />
                    <h3 className="text-lg font-semibold text-gray-900">{t('tradeSpace.finalizeOrder')}</h3>
                  </div>

                  <div className="bg-blue-50 p-4 rounded-lg space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-700">{t('tradeSpace.selectedMechanism')}</span>
                      <span className="font-semibold text-gray-900">{selectedMechanism.displayName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-700">{t('tradeSpace.quantity')}</span>
                      <span className="font-semibold text-gray-900">{comparisonData.quantityOz.toFixed(2)} {t('tradeSpace.oz')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-700">{t('tradeSpace.pricePerOz')}</span>
                      <span className="font-semibold text-gray-900">${selectedMechanism.pricePerOz.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between border-t border-blue-200 pt-2">
                      <span className="text-base font-semibold text-gray-700">{t('tradeSpace.totalValue')}</span>
                      <span className="text-xl font-bold text-blue-900">
                      ${selectedMechanism.totalValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t('tradeSpace.selectCustomer')} <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <Select
                          value={selectedCustomer}
                          onChange={(e) => setSelectedCustomer(e.target.value)}
                        >
                          <option value="">{t('tradeSpace.selectCustomerPlaceholder')}</option>
                          {customers.map((customer) => (
                            <option key={customer.id} value={customer.id}>
                              {customer.name}
                            </option>
                          ))}
                        </Select>
                      </div>
                    </div>

                    {selectedMechanism.mechanism === 'in_process' && (
                      <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {t('tradeSpace.selectRefinery')} <span className="text-red-500">*</span>
                      </label>
                      <Select
                        value={selectedRefinery}
                        onChange={(e) => setSelectedRefinery(e.target.value)}
                      >
                        <option value="">{t('tradeSpace.selectRefineryPlaceholder')}</option>
                        {refineries.map((refinery) => (
                          <option key={refinery.id} value={refinery.id}>
                            {refinery.refinery_name} - {refinery.refinery_location}
                          </option>
                        ))}
                      </Select>
                      </div>
                    )}

                    <Button
                      onClick={handleCreateSale}
                      disabled={!comparisonData || !selectedCustomer || (selectedMechanism.mechanism === 'in_process' && !selectedRefinery)}
                      className="w-full"
                      size="lg"
                    >
                      {t('tradeSpace.continueToSaleForm')}
                    </Button>
                  </div>
                </div>
              </Card>
            )}

        </div>

        {/* Gold Sales Flow Diagram - Always visible at bottom */}
        <div className="max-w-full">
          <GoldSalesFlowDiagram />
        </div>
      </div>
    </MainLayout>
  );
}
