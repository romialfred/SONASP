import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Package, AlertCircle, CheckCircle, Check, Plane, Clock, MapPin, Building2, Info, TrendingUp, DollarSign } from 'lucide-react';
import { ProductionDetailsPopup } from '@/components/freight/ProductionDetailsPopup';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Input } from '@/components/ui/Input';
import { TextArea } from '@/components/ui/TextArea';
import { Loading } from '@/components/ui/Loading';
import { freightShipmentService, type AvailableShippingPreparation } from '@/services/freightShipmentService';
import { useNotification } from '@/contexts/NotificationContext';
import { supabase } from '@/lib/supabase';

interface Signatory {
  position: string;
  full_name: string;
  display_order: number;
}

interface ProductionDetail {
  id: string;
  bar_reference: string;
  production_date: string;
  bullion_grams: number;
  pure_gold_grams: number;
  estimated_oz: number;
  estimated_fineness_pct: number;
  silver_content_grams: number | null;
}

export default function FreightShipmentCreate() {
  const navigate = useNavigate();
  const { showError, showSuccess, showInfo } = useNotification();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [availableShippingPreparations, setAvailableShippingPreparations] = useState<AvailableShippingPreparation[]>([]);
  const [refineries, setRefineries] = useState<any[]>([]);
  const [authorisedDepositors, setAuthorisedDepositors] = useState<Array<{id: string; full_name: string; position: string}>>([]);

  // Form state
  const [selectedShippingPrepIds, setSelectedShippingPrepIds] = useState<Set<string>>(new Set());
  const [shipmentDate, setShipmentDate] = useState(new Date().toISOString().split('T')[0]);

  // Flight/Transport Information
  const [departureCountry, setDepartureCountry] = useState('Mali');
  const [departureCity, setDepartureCity] = useState('Bamako');
  const [departureAirport, setDepartureAirport] = useState('Bamako-Sénou International Airport (BKO)');
  const [departureTime, setDepartureTime] = useState('');
  const [arrivalCountry, setArrivalCountry] = useState('South Africa');
  const [arrivalCity, setArrivalCity] = useState('Johannesburg');
  const [arrivalAirport, setArrivalAirport] = useState('OR Tambo International Airport (JNB)');
  const [arrivalTime, setArrivalTime] = useState('');
  const [flightDuration, setFlightDuration] = useState('');
  const [transportCompanyId, setTransportCompanyId] = useState('');
  const [destinationRefineryId, setDestinationRefineryId] = useState('');

  // Customs Information
  const [goldPriceUsdPerOz, setGoldPriceUsdPerOz] = useState('');
  const [exchangeRate, setExchangeRate] = useState('');
  const [currencyPair, setCurrencyPair] = useState('USD/XOF');
  const [notes, setNotes] = useState('');

  const [signatories, setSignatories] = useState<Signatory[]>([]);
  const [transportCompanies, setTransportCompanies] = useState<any[]>([]);
  const [hoveredPrepId, setHoveredPrepId] = useState<string | null>(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [miningCompanies, setMiningCompanies] = useState<any[]>([]);

  // Selected shipping preparations summary
  const selectedShippingPreps = availableShippingPreparations.filter(sp => selectedShippingPrepIds.has(sp.id));
  const allSelectedProductions = selectedShippingPreps.flatMap(sp => sp.items.map(item => item.daily_production));
  const totalBullionGrams = allSelectedProductions.reduce((sum, p) => sum + (p?.bullion_grams || 0), 0);
  const totalPureGoldGrams = allSelectedProductions.reduce((sum, p) => sum + (p?.pure_gold_grams || 0), 0);
  const totalPureGoldOz = allSelectedProductions.reduce((sum, p) => sum + (p?.estimated_oz || 0), 0);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    // Load signatories from selected shipping preparations
    if (selectedShippingPrepIds.size > 0) {
      loadSignatoriesFromShippingPreps();
    } else {
      setAuthorisedDepositors([]);
    }
  }, [selectedShippingPrepIds]);

  const loadData = async () => {
    try {
      setLoading(true);

      // Charger les shipping preparations disponibles (status = ready_for_expedition)
      const shippingPreps = await freightShipmentService.getAvailableShippingPreparations();
      setAvailableShippingPreparations(shippingPreps);

      // Charger les raffineries
      const { data: refineriesData, error: refineriesError} = await supabase
        .from('refineries')
        .select('id, name, location, country')
        .order('name');

      if (refineriesError) throw refineriesError;
      setRefineries(refineriesData || []);

      // Charger les transport companies
      const { data: transportData, error: transportError } = await supabase
        .from('transport_companies')
        .select('id, name, country')
        .order('name');

      if (transportError) console.error('Error loading transport companies:', transportError);
      setTransportCompanies(transportData || []);

      // Set defaults
      if (refineriesData && refineriesData.length > 0) {
        const defaultRefinery = refineriesData.find(r => r.name.toLowerCase().includes('rand'));
        if (defaultRefinery) {
          setDestinationRefineryId(defaultRefinery.id);
        }
      }

      if (transportData && transportData.length > 0) {
        setTransportCompanyId(transportData[0].id);
      }

      // Charger les mining companies
      const { data: miningData, error: miningError } = await supabase
        .from('mining_companies')
        .select('id, name, abbreviation')
        .order('name');

      if (miningError) console.error('Error loading mining companies:', miningError);
      setMiningCompanies(miningData || []);

      if (shippingPreps.length === 0) {
        showInfo(
          'Aucune expédition disponible',
          'Les expéditions doivent avoir le statut "Prêt pour Expédition" dans le module Shipping Preparation.'
        );
      }
    } catch (error: any) {
      console.error('Erreur lors du chargement des données:', error);
      showError('Erreur de chargement', error.message || 'Erreur inconnue');
    } finally {
      setLoading(false);
    }
  };

  const toggleShippingPrepSelection = (shippingPrepId: string) => {
    const newSet = new Set(selectedShippingPrepIds);
    if (newSet.has(shippingPrepId)) {
      newSet.delete(shippingPrepId);
    } else {
      newSet.add(shippingPrepId);
    }
    setSelectedShippingPrepIds(newSet);
  };

  const selectAllShippingPreps = () => {
    setSelectedShippingPrepIds(new Set(availableShippingPreparations.map(sp => sp.id)));
  };

  const deselectAllShippingPreps = () => {
    setSelectedShippingPrepIds(new Set());
  };

  const loadSignatoriesFromShippingPreps = async () => {
    try {
      console.log('🔍 Loading signatories for shipping preps:', Array.from(selectedShippingPrepIds));
      const allSignatories: Array<{id: string; full_name: string; position: string}> = [];
      const seenNames = new Set<string>();

      // Load signatories from each selected shipping preparation
      for (const prepId of Array.from(selectedShippingPrepIds)) {
        console.log('📦 Loading signatories for prep ID:', prepId);

        const { data, error } = await supabase
          .from('shipping_signatories')
          .select('*')
          .eq('shipping_preparation_id', prepId)
          .order('order_index');

        if (error) {
          console.error('❌ Error loading signatories:', error);
          continue;
        }

        console.log('✅ Signatories data received:', data);

        // Add unique signatories (avoid duplicates across multiple shipping preps)
        if (data && data.length > 0) {
          for (const sig of data) {
            // Try different possible column names (database schema may vary)
            const displayName = sig.full_name || sig.name || sig.depositor_name || 'Unknown';
            // Use title as fallback if position is empty
            const displayPosition = sig.position || sig.title || sig.job_title || 'Unknown';

            console.log('👤 Processing signatory:', {
              raw: sig,
              displayName,
              displayPosition
            });

            if (!seenNames.has(displayName) && displayName !== 'Unknown') {
              allSignatories.push({
                id: sig.id,
                full_name: displayName,
                position: displayPosition
              });
              seenNames.add(displayName);
            }
          }
        } else {
          console.warn('⚠️ No signatories found for prep ID:', prepId);
        }
      }

      console.log('📊 Total unique signatories loaded:', allSignatories.length, allSignatories);

      setAuthorisedDepositors(allSignatories);
      // Also update the signatories state for PDF generation
      setSignatories(allSignatories.map((sig, index) => ({
        position: sig.position,
        full_name: sig.full_name,
        display_order: index + 1
      })));
    } catch (error) {
      console.error('💥 Error loading signatories from shipping preps:', error);
      setAuthorisedDepositors([]);
    }
  };


  const validateForm = (): boolean => {
    if (selectedShippingPrepIds.size === 0) {
      showError('Erreur de validation', 'Veuillez sélectionner au moins une expédition');
      return false;
    }

    if (!transportCompanyId) {
      showError('Erreur de validation', 'Veuillez sélectionner une compagnie de transport');
      return false;
    }

    if (!destinationRefineryId) {
      showError('Erreur de validation', 'Veuillez sélectionner une raffinerie de destination');
      return false;
    }

    if (!goldPriceUsdPerOz || parseFloat(goldPriceUsdPerOz) <= 0) {
      showError('Erreur de validation', 'Veuillez entrer un prix de l\'or valide');
      return false;
    }

    if (!exchangeRate || parseFloat(exchangeRate) <= 0) {
      showError('Erreur de validation', 'Veuillez entrer un taux de change valide');
      return false;
    }

    const validSignatories = signatories.filter((sig) => sig.position && sig.full_name);
    if (validSignatories.length === 0) {
      showError('Erreur de validation', 'Veuillez ajouter au moins un signataire avec position et nom');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    try {
      setSubmitting(true);

      const validSignatories = signatories
        .filter((sig) => sig.position && sig.full_name)
        .map((sig, index) => ({
          position: sig.position,
          full_name: sig.full_name,
          display_order: index,
        }));

      const shipment = await freightShipmentService.createShipment({
        shipping_preparation_ids: Array.from(selectedShippingPrepIds),
        shipment_date: shipmentDate,
        destination_refinery_id: destinationRefineryId || undefined,
        number_of_boxes: numberOfBoxes,
        box_type: boxType,
        gold_price_usd_per_oz: parseFloat(goldPriceUsdPerOz),
        exchange_rate: parseFloat(exchangeRate),
        local_currency: localCurrency,
        notes,
        signatories: validSignatories,
      });

      showSuccess('Expédition créée', `Expédition Freight ${shipment.reference_number} créée avec succès`);
      navigate(`/freight/shipments/${shipment.id}`);
    } catch (error: any) {
      console.error('Erreur lors de la création:', error);
      showError('Erreur de création', error.message || 'Erreur inconnue');
    } finally {
      setSubmitting(false);
    }
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
      <div className="max-w-7xl mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button variant="secondary" onClick={() => navigate('/freight')}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Retour
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Nouvelle Expédition vers Raffinerie</h1>
              <p className="text-sm text-gray-600 mt-1">
                Sélectionnez les productions prêtes pour expédition (validées par la douane)
              </p>
            </div>
          </div>
        </div>

        {availableShippingPreparations.length === 0 ? (
          <Card className="p-6">
            <div className="flex items-start gap-3 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-yellow-900">Aucune expédition disponible</h3>
                <p className="text-sm text-yellow-700 mt-1">
                  Les expéditions doivent avoir le statut "Prêt pour Expédition"
                  dans le module Shipping Preparation.
                </p>
              </div>
            </div>
          </Card>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Sélection des Shipping Preparations */}
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">
                  <Package className="w-5 h-5 inline mr-2" />
                  Sélection des Expéditions ({selectedShippingPrepIds.size} / {availableShippingPreparations.length})
                </h2>
                <div className="flex gap-2">
                  <Button type="button" variant="secondary" size="sm" onClick={selectAllShippingPreps}>
                    Tout sélectionner
                  </Button>
                  <Button type="button" variant="secondary" size="sm" onClick={deselectAllShippingPreps}>
                    Tout désélectionner
                  </Button>
                </div>
              </div>

              <div className="overflow-x-auto relative">
                <table className="w-full border-collapse">
                  <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
                    <tr>
                      <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 border border-gray-300">
                        <input
                          type="checkbox"
                          checked={selectedShippingPrepIds.size === availableShippingPreparations.length}
                          onChange={(e) => e.target.checked ? selectAllShippingPreps() : deselectAllShippingPreps()}
                          className="rounded border-gray-300"
                        />
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 border border-gray-300">
                        Lot d'Expédition
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 border border-gray-300">
                        Mining Company
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 border border-gray-300">
                        Date Production
                      </th>
                      <th className="px-3 py-3 text-right text-xs font-semibold text-gray-700 border border-gray-300">
                        Bullion (g)
                      </th>
                      <th className="px-3 py-3 text-right text-xs font-semibold text-gray-700 border border-gray-300">
                        Poids Net (g)
                      </th>
                      <th className="px-3 py-3 text-center text-xs font-semibold text-gray-700 border border-gray-300">
                        Nb Prod.
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {availableShippingPreparations.map((prep) => {
                      const productionCount = prep.items?.length || 0;
                      const productions = prep.items?.map(item => item.daily_production).filter(Boolean) || [];
                      const totalBullion = productions.reduce((sum, p: any) => sum + (p?.bullion_grams || 0), 0);
                      const firstProduction = productions[0];
                      const miningCompany = miningCompanies.find(mc => mc.id === firstProduction?.mining_company_id);

                      return (
                        <tr
                          key={prep.id}
                          className={`hover:bg-blue-50 cursor-pointer transition-colors ${
                            selectedShippingPrepIds.has(prep.id) ? 'bg-blue-100' : 'bg-white'
                          }`}
                          onClick={() => toggleShippingPrepSelection(prep.id)}
                          onMouseEnter={(e) => {
                            setHoveredPrepId(prep.id);
                            setMousePosition({ x: e.clientX, y: e.clientY });
                          }}
                          onMouseMove={(e) => {
                            if (hoveredPrepId === prep.id) {
                              setMousePosition({ x: e.clientX, y: e.clientY });
                            }
                          }}
                          onMouseLeave={() => setHoveredPrepId(null)}
                        >
                          <td className="px-3 py-3 border border-gray-200">
                            <input
                              type="checkbox"
                              checked={selectedShippingPrepIds.has(prep.id)}
                              onChange={() => toggleShippingPrepSelection(prep.id)}
                              onClick={(e) => e.stopPropagation()}
                              className="rounded border-gray-300"
                            />
                          </td>
                          <td className="px-3 py-3 text-sm font-bold text-blue-900 border border-gray-200">
                            {prep.expedition_lot_number || prep.id.substring(0, 8)}
                          </td>
                          <td className="px-3 py-3 text-sm text-gray-900 border border-gray-200">
                            <div className="flex items-center gap-2">
                              <Building2 className="w-4 h-4 text-gray-500" />
                              <span className="font-medium">
                                {miningCompany?.abbreviation || miningCompany?.name || 'N/A'}
                              </span>
                            </div>
                          </td>
                          <td className="px-3 py-3 text-sm text-gray-700 border border-gray-200">
                            {firstProduction?.production_date
                              ? new Date(firstProduction.production_date).toLocaleDateString('fr-FR')
                              : 'N/A'}
                          </td>
                          <td className="px-3 py-3 text-sm text-right font-medium text-gray-900 border border-gray-200">
                            {totalBullion.toLocaleString('fr-FR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}
                          </td>
                          <td className="px-3 py-3 text-sm text-right font-bold text-green-700 border border-gray-200">
                            {prep.total_net_weight_grams?.toLocaleString('fr-FR', { minimumFractionDigits: 3, maximumFractionDigits: 3 }) || '0.000'}
                          </td>
                          <td className="px-3 py-3 text-sm text-center border border-gray-200">
                            <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-900 font-bold text-xs">
                              {productionCount}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {/* Popup avec détails productions au survol */}
                {hoveredPrepId && (() => {
                  const prep = availableShippingPreparations.find(p => p.id === hoveredPrepId);
                  if (!prep) return null;
                  const productions = prep.items?.map(item => item.daily_production).filter(Boolean) || [];
                  return (
                    <ProductionDetailsPopup
                      expeditionLotNumber={prep.expedition_lot_number || prep.id.substring(0, 8)}
                      productions={productions as any}
                      visible={true}
                      position={mousePosition}
                    />
                  );
                })()}
              </div>

              {selectedShippingPreps.length > 0 && (
                <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <h4 className="font-medium text-green-900">Résumé de la Sélection</h4>
                      <div className="mt-2 grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <span className="text-green-700">Productions:</span>
                          <span className="ml-2 font-semibold text-green-900">{allSelectedProductions.length}</span>
                        </div>
                        <div>
                          <span className="text-green-700">Poids Brut Total:</span>
                          <span className="ml-2 font-semibold text-green-900">{totalBullionGrams.toFixed(3)} g</span>
                        </div>
                        <div>
                          <span className="text-green-700">Or Pur Total:</span>
                          <span className="ml-2 font-semibold text-green-900">
                            {totalPureGoldGrams.toFixed(3)} g / {totalPureGoldOz.toFixed(6)} oz
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </Card>

            {/* Section Informations de Vol - Départ et Arrivée */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Informations de Départ */}
              <Card className="p-6">
                <div className="flex items-center gap-2 mb-4">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Plane className="w-5 h-5 text-blue-700 transform -rotate-45" />
                  </div>
                  <h2 className="text-lg font-semibold text-gray-900">Informations de Départ</h2>
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      label="Pays de Départ"
                      value={departureCountry}
                      onChange={(e) => setDepartureCountry(e.target.value)}
                      placeholder="Ex: Mali"
                    />
                    <Input
                      label="Ville de Départ"
                      value={departureCity}
                      onChange={(e) => setDepartureCity(e.target.value)}
                      placeholder="Ex: Bamako"
                    />
                  </div>

                  <Input
                    label="Aéroport de Départ"
                    value={departureAirport}
                    onChange={(e) => setDepartureAirport(e.target.value)}
                    placeholder="Ex: Bamako-Sénou International (BKO)"
                  />

                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      label="Date d'Expédition"
                      type="date"
                      value={shipmentDate}
                      onChange={(e) => setShipmentDate(e.target.value)}
                      required
                    />
                    <Input
                      label="Heure de Départ (Local)"
                      type="time"
                      value={departureTime}
                      onChange={(e) => setDepartureTime(e.target.value)}
                      placeholder="HH:MM"
                    />
                  </div>
                </div>
              </Card>

              {/* Informations d'Arrivée */}
              <Card className="p-6">
                <div className="flex items-center gap-2 mb-4">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <MapPin className="w-5 h-5 text-green-700" />
                  </div>
                  <h2 className="text-lg font-semibold text-gray-900">Informations d'Arrivée</h2>
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      label="Pays d'Arrivée"
                      value={arrivalCountry}
                      onChange={(e) => setArrivalCountry(e.target.value)}
                      placeholder="Ex: South Africa"
                    />
                    <Input
                      label="Ville d'Arrivée"
                      value={arrivalCity}
                      onChange={(e) => setArrivalCity(e.target.value)}
                      placeholder="Ex: Johannesburg"
                    />
                  </div>

                  <Input
                    label="Aéroport d'Arrivée"
                    value={arrivalAirport}
                    onChange={(e) => setArrivalAirport(e.target.value)}
                    placeholder="Ex: OR Tambo International (JNB)"
                  />

                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      label="Heure d'Arrivée Prévue"
                      type="time"
                      value={arrivalTime}
                      onChange={(e) => setArrivalTime(e.target.value)}
                      placeholder="HH:MM"
                    />
                    <Input
                      label="Durée du Trajet"
                      value={flightDuration}
                      onChange={(e) => setFlightDuration(e.target.value)}
                      placeholder="Ex: 4h 30min"
                    />
                  </div>
                </div>
              </Card>
            </div>

            {/* Compagnies de Transport et Raffinage */}
            <Card className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Building2 className="w-5 h-5 text-purple-700" />
                </div>
                <h2 className="text-lg font-semibold text-gray-900">Compagnies</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Select
                  label="Transport Company"
                  value={transportCompanyId}
                  onChange={(e) => setTransportCompanyId(e.target.value)}
                  required
                >
                  <option value="">-- Sélectionner --</option>
                  {transportCompanies.map((company) => (
                    <option key={company.id} value={company.id}>
                      {company.name} {company.country ? `(${company.country})` : ''}
                    </option>
                  ))}
                </Select>

                <Select
                  label="Refinery Company"
                  value={destinationRefineryId}
                  onChange={(e) => setDestinationRefineryId(e.target.value)}
                  required
                >
                  <option value="">-- Sélectionner --</option>
                  {refineries.map((refinery) => (
                    <option key={refinery.id} value={refinery.id}>
                      {refinery.name} - {refinery.location}, {refinery.country}
                    </option>
                  ))}
                </Select>
              </div>
            </Card>

            {/* Informations Douanières */}
            <Card className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <div className="p-2 bg-amber-100 rounded-lg">
                  <DollarSign className="w-5 h-5 text-amber-700" />
                </div>
                <h2 className="text-lg font-semibold text-gray-900">Informations Douanières</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Prix de Vente de l'Or ($/oz) *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">$</span>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={goldPriceUsdPerOz}
                      onChange={(e) => setGoldPriceUsdPerOz(e.target.value)}
                      required
                      placeholder="2650.00"
                      className="pl-8"
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Prix du marché London AM</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Paire de Devises *
                  </label>
                  <Select
                    value={currencyPair}
                    onChange={(e) => setCurrencyPair(e.target.value)}
                    required
                  >
                    <option value="USD/XOF">USD/XOF (Franc CFA BCEAO)</option>
                    <option value="EUR/XOF">EUR/XOF (Franc CFA BCEAO)</option>
                    <option value="USD/GNF">USD/GNF (Franc Guinéen)</option>
                    <option value="EUR/GNF">EUR/GNF (Franc Guinéen)</option>
                  </Select>
                  <p className="text-xs text-gray-500 mt-1">Sélectionnez la paire de conversion</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Taux de Change *
                  </label>
                  <div className="relative">
                    <TrendingUp className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 w-4 h-4" />
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={exchangeRate}
                      onChange={(e) => setExchangeRate(e.target.value)}
                      required
                      placeholder="656.50"
                      className="pl-10"
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Pour {currencyPair.split('/')[1]}
                  </p>
                </div>
              </div>

              {/* Calculs Automatiques */}
              {goldPriceUsdPerOz && exchangeRate && totalPureGoldOz > 0 && (
                <div className="mt-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
                  <h3 className="text-sm font-semibold text-blue-900 mb-3 flex items-center gap-2">
                    <Info className="w-4 h-4" />
                    Calculs Automatiques
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <span className="text-xs text-gray-600 block">Valeur en USD:</span>
                      <span className="text-lg font-bold text-blue-900">
                        ${(parseFloat(goldPriceUsdPerOz) * totalPureGoldOz).toLocaleString('fr-FR', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2
                        })}
                      </span>
                    </div>
                    <div>
                      <span className="text-xs text-gray-600 block">
                        Valeur en {currencyPair.split('/')[1]}:
                      </span>
                      <span className="text-lg font-bold text-green-700">
                        {(parseFloat(goldPriceUsdPerOz) * totalPureGoldOz * parseFloat(exchangeRate)).toLocaleString('fr-FR', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2
                        })} {currencyPair.split('/')[1]}
                      </span>
                    </div>
                    <div>
                      <span className="text-xs text-gray-600 block">Total Onces:</span>
                      <span className="text-lg font-bold text-purple-700">
                        {totalPureGoldOz.toFixed(3)} oz
                      </span>
                    </div>
                  </div>
                </div>
              )}

              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes ou Observations
                </label>
                <TextArea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  placeholder="Informations complémentaires pour cette expédition..."
                />
              </div>
            </Card>

            {/* Authorised Depositors */}
            <Card className="p-6">
              <div className="mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Authorised Depositors</h2>
                <p className="text-sm text-gray-600 mt-1">
                  Signataires chargés automatiquement depuis les expéditions sélectionnées
                </p>
              </div>

              {selectedShippingPrepIds.size === 0 ? (
                <div className="p-6 bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg text-center">
                  <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-sm text-gray-600">
                    Veuillez sélectionner au moins une expédition pour voir les signataires autorisés
                  </p>
                </div>
              ) : authorisedDepositors.length === 0 ? (
                <div className="p-6 bg-amber-50 border border-amber-200 rounded-lg text-center">
                  <AlertCircle className="w-12 h-12 text-amber-600 mx-auto mb-3" />
                  <p className="text-sm text-amber-800 font-medium mb-2">
                    Aucun signataire trouvé
                  </p>
                  <p className="text-xs text-amber-700">
                    Les expéditions sélectionnées n'ont pas de signataires configurés dans Shipping Preparation.
                  </p>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gradient-to-r from-slate-50 to-slate-100 border-b-2 border-slate-200">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                            #
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                            Position / Title
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                            Full Name
                          </th>
                          <th className="px-4 py-3 text-center text-xs font-semibold text-slate-700 uppercase tracking-wider">
                            Signature
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {authorisedDepositors.map((depositor, index) => (
                          <tr key={depositor.id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-4 py-3 text-sm text-gray-700 font-medium">
                              {index + 1}
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-sm font-medium text-gray-900">{depositor.position}</span>
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-sm font-semibold text-blue-900">{depositor.full_name}</span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-50 border border-blue-200 rounded-full">
                                <Check className="w-4 h-4 text-blue-600" />
                                <span className="text-xs font-medium text-blue-700">Authorized</span>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-start gap-3">
                      <CheckCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-blue-900">
                          {authorisedDepositors.length} {authorisedDepositors.length === 1 ? 'signataire chargé' : 'signataires chargés'}
                        </p>
                        <p className="text-xs text-blue-700 mt-1">
                          Ces signataires apparaîtront automatiquement sur les documents PDF (Bullion Summary et Facture Customs)
                        </p>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </Card>

            {/* Informations importantes */}
            <Card className="p-6 bg-blue-50 border-blue-200">
              <h3 className="font-semibold text-blue-900 mb-2">Génération Automatique des Documents</h3>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>
                  <Check className="w-4 h-4 inline mr-1" />
                  Bullion Summary PDF: Liste détaillée de toutes les productions sélectionnées
                </li>
                <li>
                  <Check className="w-4 h-4 inline mr-1" />
                  Facture Customs (Invoice pour besoins de la douane)
                </li>
                <li>
                  <Check className="w-4 h-4 inline mr-1" />
                  Référence unique auto-générée: HUM-SMK-XXX/YYYY
                </li>
                <li>
                  <Check className="w-4 h-4 inline mr-1" />
                  Statut initial: En Attente (Pending)
                </li>
              </ul>
            </Card>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-4">
              <Button type="button" variant="secondary" onClick={() => navigate('/freight')}>
                Annuler
              </Button>
              <Button type="submit" disabled={submitting || selectedShippingPrepIds.size === 0}>
                {submitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                    Création en cours...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Créer l'Expédition
                  </>
                )}
              </Button>
            </div>
          </form>
        )}
      </div>
    </MainLayout>
  );
}
