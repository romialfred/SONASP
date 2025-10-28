import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { Factory, ArrowLeft, Edit, Globe, MapPin, Mail, Phone, Building2, Calendar, Activity } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export function MiningCompanyDetails() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [company, setCompany] = useState<any>(null);
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCompanyDetails();
  }, [id]);

  const loadCompanyDetails = async () => {
    try {
      const [companyRes, accountsRes, activitiesRes] = await Promise.all([
        supabase.from('mining_companies').select('*').eq('id', id).single(),
        supabase.from('stakeholder_bank_accounts').select('*').eq('stakeholder_type', 'mining_company').eq('stakeholder_id', id),
        supabase.from('stakeholder_activities').select('*').eq('stakeholder_type', 'mining_company').eq('stakeholder_id', id).order('activity_date', { ascending: false }).limit(50)
      ]);

      if (companyRes.data) setCompany(companyRes.data);
      if (accountsRes.data) setBankAccounts(accountsRes.data);
      if (activitiesRes.data) setActivities(activitiesRes.data);
    } catch (error) {
      console.error('Error loading details:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="p-6 flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-700"></div>
        </div>
      </MainLayout>
    );
  }

  if (!company) {
    return (
      <MainLayout>
        <div className="p-6 text-center">
          <p className="text-gray-600">Company not found</p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => navigate('/stakeholders/mining-companies')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                <Factory className="h-8 w-8 text-amber-700" />
                {company.name}
              </h1>
              <p className="text-gray-600 mt-1">Code: {company.code}</p>
            </div>
          </div>
          <Button onClick={() => navigate(`/stakeholders/mining-companies/${id}/edit`)}>
            <Edit className="w-4 h-4 mr-2" />
            Edit Company
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Company Information</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="text-sm font-medium text-gray-500">Location</label>
                    <div className="mt-1 flex items-start gap-2">
                      <MapPin className="w-4 h-4 text-gray-400 mt-1" />
                      <div>
                        <div className="text-sm text-gray-900">{company.address || 'N/A'}</div>
                        <div className="text-sm text-gray-900">{company.city}, {company.country}</div>
                        {company.postal_code && <div className="text-sm text-gray-600">{company.postal_code}</div>}
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-500">Contact Person</label>
                    <div className="mt-1 space-y-2">
                      <div className="text-sm text-gray-900 font-medium">{company.contact_person_name}</div>
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Mail className="w-4 h-4" />
                        {company.contact_person_email}
                      </div>
                      {company.contact_person_phone && (
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Phone className="w-4 h-4" />
                          {company.contact_person_phone}
                        </div>
                      )}
                    </div>
                  </div>

                  {company.website && (
                    <div>
                      <label className="text-sm font-medium text-gray-500">Website</label>
                      <div className="mt-1">
                        <a href={company.website} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline flex items-center gap-1">
                          <Globe className="w-4 h-4" />
                          {company.website}
                        </a>
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="text-sm font-medium text-gray-500">Currency</label>
                    <div className="mt-1 text-sm text-gray-900">{company.default_currency}</div>
                  </div>

                  {company.tax_id && (
                    <div>
                      <label className="text-sm font-medium text-gray-500">Tax ID</label>
                      <div className="mt-1 text-sm text-gray-900">{company.tax_id}</div>
                    </div>
                  )}

                  {company.registration_number && (
                    <div>
                      <label className="text-sm font-medium text-gray-500">Registration Number</label>
                      <div className="mt-1 text-sm text-gray-900">{company.registration_number}</div>
                    </div>
                  )}

                  <div>
                    <label className="text-sm font-medium text-gray-500">Status</label>
                    <div className="mt-1">
                      <span className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full ${company.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                        {company.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-500">Created</label>
                    <div className="mt-1 text-sm text-gray-900 flex items-center gap-1">
                      <Calendar className="w-4 h-4 text-gray-400" />
                      {new Date(company.created_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>

                {company.notes && (
                  <div className="mt-6 pt-6 border-t">
                    <label className="text-sm font-medium text-gray-500">Notes</label>
                    <div className="mt-1 text-sm text-gray-900 whitespace-pre-wrap">{company.notes}</div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="w-5 h-5" />
                  Recent Activities ({activities.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {activities.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Activity className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                    <p>No activities recorded yet</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {activities.map((activity) => (
                      <div key={activity.id} className="flex gap-4 pb-4 border-b last:border-0">
                        <div className="flex-shrink-0">
                          <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                            <Activity className="w-5 h-5 text-blue-600" />
                          </div>
                        </div>
                        <div className="flex-1">
                          <div className="text-sm font-medium text-gray-900">{activity.activity_type.replace('_', ' ').toUpperCase()}</div>
                          <div className="text-sm text-gray-600 mt-1">{activity.description}</div>
                          {activity.amount && (
                            <div className="text-sm text-gray-900 mt-1 font-semibold">
                              {activity.amount.toLocaleString()} {activity.currency}
                            </div>
                          )}
                          <div className="text-xs text-gray-500 mt-2 flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {new Date(activity.activity_date).toLocaleString()}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="w-5 h-5" />
                  Bank Accounts ({bankAccounts.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {bankAccounts.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-4">No bank accounts</p>
                ) : (
                  <div className="space-y-4">
                    {bankAccounts.map((account) => (
                      <div key={account.id} className="border border-gray-200 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-gray-900">{account.account_name}</span>
                          {account.is_primary && (
                            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">Primary</span>
                          )}
                        </div>
                        <div className="space-y-1 text-sm text-gray-600">
                          <div>{account.bank_name}</div>
                          <div className="font-mono">{account.account_number}</div>
                          <div className="flex justify-between">
                            <span>{account.bank_country}</span>
                            <span className="font-semibold">{account.account_currency}</span>
                          </div>
                          {account.swift_code && (
                            <div className="text-xs text-gray-500">SWIFT: {account.swift_code}</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
