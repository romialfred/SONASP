import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import {
  Factory, ArrowLeft, Edit, Globe, MapPin, Mail, Phone, Building2, Calendar, Activity,
  FileText, Download, Scale, Truck, FileCheck, Coins, BarChart3, ScrollText, Info,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { miningCompanyDocumentService, MINING_COMPANY_DOC_TYPES, type MiningCompanyDocument } from '@/services/miningCompanyDocumentService';

const COMPANY_TYPE_LABELS: Record<string, string> = {
  production_mine: 'Mine de production',
  parent_company: 'Société mère / Groupe',
  institution: 'Institution',
};

const nf = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 });
const nf0 = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });

type TabKey = 'apercu' | 'stats' | 'documents' | 'activites';

interface Stats {
  productionGrams: number;
  productionOz: number;
  declarations: number;
  lastProduction: string | null;
  shipments: number;
  licenses: number;
}

export function MiningCompanyDetails() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [company, setCompany] = useState<any>(null);
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  const [documents, setDocuments] = useState<MiningCompanyDocument[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabKey>('apercu');

  useEffect(() => {
    loadCompanyDetails();
  }, [id]);

  const loadCompanyDetails = async () => {
    try {
      const [companyRes, accountsRes, activitiesRes, prodRes, freightRes, licRes, docs] = await Promise.all([
        supabase.from('mining_companies').select('*').eq('id', id).single(),
        supabase.from('stakeholder_bank_accounts').select('*').eq('stakeholder_type', 'mining_company').eq('stakeholder_id', id),
        supabase.from('stakeholder_activities').select('*').eq('stakeholder_type', 'mining_company').eq('stakeholder_id', id).order('activity_date', { ascending: false }).limit(50),
        supabase.from('daily_production').select('pure_gold_grams, estimated_oz, production_date').eq('mining_company_id', id),
        supabase.from('freight_shipments').select('id', { count: 'exact', head: true }).eq('mining_company_id', id),
        supabase.from('export_licenses').select('id', { count: 'exact', head: true }).eq('mining_company_id', id),
        miningCompanyDocumentService.list(id as string).catch(() => []),
      ]);

      if (companyRes.data) setCompany(companyRes.data);
      if (accountsRes.data) setBankAccounts(accountsRes.data);
      if (activitiesRes.data) setActivities(activitiesRes.data);
      setDocuments(docs);

      const prod = prodRes.data || [];
      setStats({
        productionGrams: prod.reduce((s, r: any) => s + (Number(r.pure_gold_grams) || 0), 0),
        productionOz: prod.reduce((s, r: any) => s + (Number(r.estimated_oz) || 0), 0),
        declarations: prod.length,
        lastProduction: prod.length
          ? prod.map((r: any) => r.production_date).sort().slice(-1)[0]
          : null,
        shipments: freightRes.count ?? 0,
        licenses: licRes.count ?? 0,
      });
    } catch (error) {
      console.error('Error loading details:', error);
    } finally {
      setLoading(false);
    }
  };

  const openDocument = async (doc: MiningCompanyDocument) => {
    const url = await miningCompanyDocumentService.getSignedUrl(doc.file_path);
    if (url) window.open(url, '_blank');
  };
  const docTypeLabel = (v: string | null) => MINING_COMPANY_DOC_TYPES.find((t) => t.value === v)?.label ?? 'Document';

  if (loading) {
    return (
      <MainLayout>
        <div className="p-6 flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-700"></div>
        </div>
      </MainLayout>
    );
  }

  if (!company) {
    return (
      <MainLayout>
        <div className="p-6 text-center"><p className="text-gray-600">Société introuvable</p></div>
      </MainLayout>
    );
  }

  const Field = ({ label, value }: { label: string; value?: React.ReactNode }) => (
    <div>
      <label className="text-xs font-medium uppercase tracking-wide text-gray-400">{label}</label>
      <div className="mt-0.5 text-sm text-gray-900">{value ?? <span className="text-gray-400">—</span>}</div>
    </div>
  );

  const tabs: { key: TabKey; label: string; icon: any }[] = [
    { key: 'apercu', label: 'Aperçu', icon: Building2 },
    { key: 'stats', label: 'Statistiques', icon: BarChart3 },
    { key: 'documents', label: `Documents (${documents.length})`, icon: FileText },
    { key: 'activites', label: `Activités (${activities.length})`, icon: Activity },
  ];

  return (
    <MainLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => navigate('/stakeholders/mining-companies')}>
              <ArrowLeft className="h-4 w-4 mr-2" /> Retour
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                <Factory className="h-8 w-8 text-emerald-700" />
                {company.name}
              </h1>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-gray-600">
                {company.abbreviation && (
                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700">{company.abbreviation}</span>
                )}
                <span>Code : {company.code}</span>
                <span className="text-gray-300">·</span>
                <span>{COMPANY_TYPE_LABELS[company.company_type] || company.company_type || 'Mine de production'}</span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${company.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-700'}`}>
                  {company.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>
          </div>
          <Button onClick={() => navigate(`/stakeholders/mining-companies/${id}/edit`)}>
            <Edit className="w-4 h-4 mr-2" /> Modifier
          </Button>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-1 border-b border-gray-200">
          {tabs.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                tab === key ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-gray-500 hover:text-gray-800'
              }`}
            >
              <Icon className="h-4 w-4" /> {label}
            </button>
          ))}
        </div>

        {/* ---- Aperçu ---- */}
        {tab === 'apercu' && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="space-y-6 lg:col-span-2">
              <Card>
                <CardHeader><CardTitle>Informations générales</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-2 gap-5">
                  <Field label="Nom officiel" value={company.name} />
                  <Field label="Nom usuel" value={company.abbreviation} />
                  <Field label="Code société" value={company.code} />
                  <Field label="Type" value={COMPANY_TYPE_LABELS[company.company_type] || company.company_type} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2"><ScrollText className="h-5 w-5 text-gray-400" /> Identification légale</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-2 gap-5">
                  <Field label="RCCM" value={company.registration_number} />
                  <Field label="IFU" value={company.tax_id} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2"><MapPin className="h-5 w-5 text-gray-400" /> Localisation</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-2 gap-5">
                  <Field label="Pays" value={company.country} />
                  <Field label="Région" value={company.region} />
                  <Field label="Province" value={company.province} />
                  <Field label="Localité / Commune" value={company.localite} />
                  <Field label="Adresse" value={company.address} />
                  <Field label="Ville" value={company.city} />
                  <Field label="Boîte postale" value={company.postal_code} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>Contact</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-2 gap-5">
                  <Field label="Personne de contact" value={company.contact_person_name} />
                  <Field label="Email" value={company.contact_person_email && (
                    <span className="inline-flex items-center gap-1"><Mail className="h-3.5 w-3.5 text-gray-400" />{company.contact_person_email}</span>
                  )} />
                  <Field label="Téléphone" value={company.contact_person_phone && (
                    <span className="inline-flex items-center gap-1"><Phone className="h-3.5 w-3.5 text-gray-400" />{company.contact_person_phone}</span>
                  )} />
                  <Field label="Devise par défaut" value={company.default_currency} />
                  <Field label="Site web" value={company.website && (
                    <a href={company.website} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-blue-600 hover:underline">
                      <Globe className="h-3.5 w-3.5" />{company.website}
                    </a>
                  )} />
                  <Field label="Créée le" value={company.created_at && (
                    <span className="inline-flex items-center gap-1"><Calendar className="h-3.5 w-3.5 text-gray-400" />{new Date(company.created_at).toLocaleDateString('fr-FR')}</span>
                  )} />
                </CardContent>
              </Card>

              {company.notes && (
                <Card>
                  <CardHeader><CardTitle>Notes</CardTitle></CardHeader>
                  <CardContent><p className="whitespace-pre-wrap text-sm text-gray-800">{company.notes}</p></CardContent>
                </Card>
              )}
            </div>

            <div className="space-y-6">
              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2"><Building2 className="h-5 w-5" /> Comptes bancaires ({bankAccounts.length})</CardTitle></CardHeader>
                <CardContent>
                  {bankAccounts.length === 0 ? (
                    <p className="py-4 text-center text-sm text-gray-500">Aucun compte bancaire</p>
                  ) : (
                    <div className="space-y-3">
                      {bankAccounts.map((account) => (
                        <div key={account.id} className="rounded-lg border border-gray-200 p-3">
                          <div className="mb-2 flex items-center justify-between">
                            <span className="text-sm font-medium text-gray-900">{account.account_name || account.bank_name}</span>
                            {account.is_primary && <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">Principal</span>}
                          </div>
                          <div className="space-y-1 text-sm text-gray-600">
                            <div>{account.bank_name}</div>
                            <div className="font-mono">{account.account_number}</div>
                            <div className="flex justify-between"><span>{account.bank_country}</span><span className="font-semibold">{account.account_currency}</span></div>
                            {account.swift_code && <div className="text-xs text-gray-500">SWIFT : {account.swift_code}</div>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* ---- Statistiques ---- */}
        {tab === 'stats' && stats && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
              <KpiCard icon={Scale} tone="emerald" label="Production (or pur)" value={`${nf.format(stats.productionGrams)} g`} sub={`${nf.format(stats.productionOz)} oz`} />
              <KpiCard icon={BarChart3} tone="emerald" label="Déclarations" value={nf0.format(stats.declarations)} sub={stats.lastProduction ? `Dernière : ${new Date(stats.lastProduction).toLocaleDateString('fr-FR')}` : '—'} />
              <KpiCard icon={Truck} tone="blue" label="Expéditions" value={nf0.format(stats.shipments)} />
              <KpiCard icon={FileCheck} tone="violet" label="Licences d'export" value={nf0.format(stats.licenses)} />
              <KpiCard icon={Coins} tone="amber" label="Ventes" value="—" sub="Non rattachées directement" />
              <KpiCard icon={Coins} tone="amber" label="Taxes & royalties" value="—" sub="Non rattachées directement" />
            </div>
            <div className="flex items-start gap-2 rounded-lg border border-gray-200 bg-slate-50 p-3 text-sm text-gray-600">
              <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-400" />
              <p>
                Les indicateurs de <strong>production</strong>, d'<strong>expéditions</strong> et de <strong>licences</strong> sont
                calculés à partir des données rattachées à cette société. Les <strong>ventes</strong> et
                <strong> taxes/royalties</strong> ne sont pas encore reliées directement à la société minière
                (elles transitent par les lots d'or) — affichées « — » en attendant ce rattachement.
              </p>
            </div>
          </div>
        )}

        {/* ---- Documents ---- */}
        {tab === 'documents' && (
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5" /> Documents ({documents.length})</CardTitle></CardHeader>
            <CardContent>
              {documents.length === 0 ? (
                <div className="py-10 text-center text-gray-500">
                  <FileText className="mx-auto mb-2 h-12 w-12 text-gray-300" />
                  <p>Aucun document joint</p>
                  <Button className="mt-3" variant="outline" onClick={() => navigate(`/stakeholders/mining-companies/${id}/edit`)}>
                    <Edit className="mr-2 h-4 w-4" /> Ajouter des documents
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  {documents.map((doc) => (
                    <div key={doc.id} className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2">
                      <div className="flex items-center gap-2 text-sm">
                        <FileText className="h-4 w-4 text-emerald-600" />
                        <span className="font-medium text-slate-700">{docTypeLabel(doc.doc_type)}</span>
                        <span className="text-slate-400">·</span>
                        <span className="text-slate-500">{doc.file_name}</span>
                        <span className="text-xs text-slate-400">{new Date(doc.created_at).toLocaleDateString('fr-FR')}</span>
                      </div>
                      <Button type="button" variant="ghost" size="sm" onClick={() => openDocument(doc)}>
                        <Download className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* ---- Activités ---- */}
        {tab === 'activites' && (
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Activity className="h-5 w-5" /> Activités récentes ({activities.length})</CardTitle></CardHeader>
            <CardContent>
              {activities.length === 0 ? (
                <div className="py-10 text-center text-gray-500">
                  <Activity className="mx-auto mb-2 h-12 w-12 text-gray-300" />
                  <p>Aucune activité enregistrée</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {activities.map((activity) => (
                    <div key={activity.id} className="flex gap-4 border-b pb-4 last:border-0">
                      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-emerald-100">
                        <Activity className="h-5 w-5 text-emerald-600" />
                      </div>
                      <div className="flex-1">
                        <div className="text-sm font-medium text-gray-900">{String(activity.activity_type || '').replace(/_/g, ' ').toUpperCase()}</div>
                        <div className="mt-1 text-sm text-gray-600">{activity.description}</div>
                        {activity.amount && (
                          <div className="mt-1 text-sm font-semibold text-gray-900">{Number(activity.amount).toLocaleString('fr-FR')} {activity.currency}</div>
                        )}
                        <div className="mt-2 flex items-center gap-1 text-xs text-gray-500">
                          <Calendar className="h-3 w-3" />{new Date(activity.activity_date).toLocaleString('fr-FR')}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </MainLayout>
  );
}

function KpiCard({ icon: Icon, tone, label, value, sub }: {
  icon: any; tone: 'emerald' | 'blue' | 'violet' | 'amber'; label: string; value: string; sub?: string;
}) {
  const tones: Record<string, string> = {
    emerald: 'bg-emerald-50 text-emerald-600',
    blue: 'bg-blue-50 text-blue-600',
    violet: 'bg-violet-50 text-violet-600',
    amber: 'bg-amber-50 text-amber-600',
  };
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className={`mb-3 inline-flex h-9 w-9 items-center justify-center rounded-lg ${tones[tone]}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="text-xl font-bold text-gray-900">{value}</div>
      <div className="text-xs text-gray-500">{label}</div>
      {sub && <div className="mt-0.5 text-[11px] text-gray-400">{sub}</div>}
    </div>
  );
}
