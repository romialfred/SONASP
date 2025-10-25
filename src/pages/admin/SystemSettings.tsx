import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Save, Building, DollarSign, Mail, AlertTriangle, Bell } from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { FormField } from '@/components/ui/FormField';
import { TextArea } from '@/components/ui/TextArea';
import { Alert } from '@/components/ui/Alert';

export function SystemSettings() {
  const { t } = useTranslation();

  const [activeTab, setActiveTab] = useState<'company' | 'exchange' | 'gold' | 'email' | 'thresholds' | 'notifications'>('company');
  const [hasChanges, setHasChanges] = useState(false);

  const [companySettings, setCompanySettings] = useState({
    name: 'Mansa Resources',
    address: '123 Mining Street, Conakry, Guinea',
    phone: '+224 123 456 789',
    email: 'contact@mansa.com',
    taxId: 'GN123456789',
    logo: '',
  });

  const [exchangeSettings, setExchangeSettings] = useState({
    apiProvider: 'ecb',
    apiKey: '',
    updateFrequency: 'daily',
    baseCurrency: 'USD',
  });

  const [goldPriceSettings, setGoldPriceSettings] = useState({
    apiProvider: 'alphavantage',
    apiKey: '',
    updateFrequency: 'daily',
  });

  const [thresholdSettings, setThresholdSettings] = useState({
    weightVariance: '2.0',
    priceVariance: '5.0',
    paymentDelay: '30',
    inventoryMinimum: '500',
  });

  const tabs = [
    { id: 'company', label: 'Company Info', icon: Building },
    { id: 'exchange', label: 'Exchange Rates', icon: DollarSign },
    { id: 'gold', label: 'Gold Prices', icon: DollarSign },
    { id: 'email', label: 'Email Templates', icon: Mail },
    { id: 'thresholds', label: 'Thresholds', icon: AlertTriangle },
    { id: 'notifications', label: 'Notifications', icon: Bell },
  ];

  const handleSave = () => {
    console.log('Saving settings...');
    setHasChanges(false);
  };

  const handleInputChange = (setter: Function) => {
    setHasChanges(true);
    return setter;
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="font-heading text-3xl font-bold text-gray-900">
              {t('nav.settings')}
            </h1>
            <p className="text-gray-600 mt-1">Configure system-wide settings</p>
          </div>
          {hasChanges && (
            <Button
              onClick={handleSave}
              className="flex items-center gap-2"
            >
              <Save className="h-4 w-4" />
              Save Changes
            </Button>
          )}
        </div>

        {hasChanges && (
          <Alert type="warning" title="Unsaved Changes">
            You have unsaved changes. Don't forget to save your configuration.
          </Alert>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <Card className="lg:col-span-1">
            <CardContent className="pt-6">
              <nav className="space-y-1">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as typeof activeTab)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                      activeTab === tab.id
                        ? 'bg-primary-100 text-primary-700 font-semibold'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <tab.icon className="h-5 w-5" />
                    <span>{tab.label}</span>
                  </button>
                ))}
              </nav>
            </CardContent>
          </Card>

          <div className="lg:col-span-3">
            {activeTab === 'company' && (
              <Card>
                <CardHeader>
                  <CardTitle>Company Information</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <FormField label="Company Name" required>
                      <Input
                        value={companySettings.name}
                        onChange={(e) => handleInputChange(setCompanySettings)({
                          ...companySettings,
                          name: e.target.value,
                        })}
                      />
                    </FormField>

                    <FormField label="Address" required>
                      <TextArea
                        value={companySettings.address}
                        onChange={(e) => handleInputChange(setCompanySettings)({
                          ...companySettings,
                          address: e.target.value,
                        })}
                        rows={3}
                      />
                    </FormField>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField label="Phone Number" required>
                        <Input
                          type="tel"
                          value={companySettings.phone}
                          onChange={(e) => handleInputChange(setCompanySettings)({
                            ...companySettings,
                            phone: e.target.value,
                          })}
                        />
                      </FormField>

                      <FormField label="Email Address" required>
                        <Input
                          type="email"
                          value={companySettings.email}
                          onChange={(e) => handleInputChange(setCompanySettings)({
                            ...companySettings,
                            email: e.target.value,
                          })}
                        />
                      </FormField>
                    </div>

                    <FormField label="Tax ID" required>
                      <Input
                        value={companySettings.taxId}
                        onChange={(e) => handleInputChange(setCompanySettings)({
                          ...companySettings,
                          taxId: e.target.value,
                        })}
                      />
                    </FormField>
                  </div>
                </CardContent>
              </Card>
            )}

            {activeTab === 'exchange' && (
              <Card>
                <CardHeader>
                  <CardTitle>Exchange Rate Configuration</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <FormField label="API Provider" required>
                      <Select
                        value={exchangeSettings.apiProvider}
                        onChange={(e) => handleInputChange(setExchangeSettings)({
                          ...exchangeSettings,
                          apiProvider: e.target.value,
                        })}
                      >
                        <option value="ecb">European Central Bank (ECB)</option>
                        <option value="fixer">Fixer.io</option>
                        <option value="openexchange">Open Exchange Rates</option>
                      </Select>
                    </FormField>

                    <FormField label="API Key" hint="Optional for ECB">
                      <Input
                        type="password"
                        value={exchangeSettings.apiKey}
                        onChange={(e) => handleInputChange(setExchangeSettings)({
                          ...exchangeSettings,
                          apiKey: e.target.value,
                        })}
                        placeholder="Enter API key"
                      />
                    </FormField>

                    <FormField label="Update Frequency" required>
                      <Select
                        value={exchangeSettings.updateFrequency}
                        onChange={(e) => handleInputChange(setExchangeSettings)({
                          ...exchangeSettings,
                          updateFrequency: e.target.value,
                        })}
                      >
                        <option value="hourly">Every Hour</option>
                        <option value="daily">Daily</option>
                        <option value="manual">Manual</option>
                      </Select>
                    </FormField>

                    <FormField label="Base Currency" required>
                      <Select
                        value={exchangeSettings.baseCurrency}
                        onChange={(e) => handleInputChange(setExchangeSettings)({
                          ...exchangeSettings,
                          baseCurrency: e.target.value,
                        })}
                      >
                        <option value="USD">USD - US Dollar</option>
                        <option value="EUR">EUR - Euro</option>
                      </Select>
                    </FormField>

                    <div className="p-4 bg-blue-50 rounded-lg">
                      <p className="text-sm text-gray-700">
                        <span className="font-medium">Current Rates:</span> USD/XOF: 605.50 | USD/GNF: 8,650.00
                      </p>
                      <p className="text-xs text-gray-600 mt-1">Last updated: 2 hours ago</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {activeTab === 'gold' && (
              <Card>
                <CardHeader>
                  <CardTitle>Gold Price Feed Settings</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <FormField label="API Provider" required>
                      <Select
                        value={goldPriceSettings.apiProvider}
                        onChange={(e) => handleInputChange(setGoldPriceSettings)({
                          ...goldPriceSettings,
                          apiProvider: e.target.value,
                        })}
                      >
                        <option value="alphavantage">Alpha Vantage</option>
                        <option value="goldapi">Gold API</option>
                        <option value="metals">Metals-API</option>
                      </Select>
                    </FormField>

                    <FormField label="API Key" required>
                      <Input
                        type="password"
                        value={goldPriceSettings.apiKey}
                        onChange={(e) => handleInputChange(setGoldPriceSettings)({
                          ...goldPriceSettings,
                          apiKey: e.target.value,
                        })}
                        placeholder="Enter API key"
                      />
                    </FormField>

                    <FormField label="Update Frequency" required>
                      <Select
                        value={goldPriceSettings.updateFrequency}
                        onChange={(e) => handleInputChange(setGoldPriceSettings)({
                          ...goldPriceSettings,
                          updateFrequency: e.target.value,
                        })}
                      >
                        <option value="realtime">Real-time</option>
                        <option value="hourly">Every Hour</option>
                        <option value="daily">Daily (London AM)</option>
                      </Select>
                    </FormField>

                    <div className="p-4 bg-primary-50 rounded-lg">
                      <p className="text-sm text-gray-700">
                        <span className="font-medium">Current London AM Rate:</span> $2,650.00 per oz
                      </p>
                      <p className="text-xs text-gray-600 mt-1">Last updated: Today at 10:30 AM</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {activeTab === 'email' && (
              <Card>
                <CardHeader>
                  <CardTitle>Email Template Customization</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <FormField label="Template Type">
                      <Select>
                        <option value="sale-approval">Sale Approval Request</option>
                        <option value="payment-confirmation">Payment Confirmation</option>
                        <option value="variance-alert">Variance Alert</option>
                        <option value="batch-status">Batch Status Update</option>
                      </Select>
                    </FormField>

                    <FormField label="Subject Line">
                      <Input placeholder="Enter email subject" />
                    </FormField>

                    <FormField label="Email Body" hint="Use {{variables}} for dynamic content">
                      <TextArea
                        rows={10}
                        placeholder="Enter email template..."
                      />
                    </FormField>

                    <div className="flex gap-3">
                      <Button variant="outline">Preview Template</Button>
                      <Button variant="outline">Send Test Email</Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {activeTab === 'thresholds' && (
              <Card>
                <CardHeader>
                  <CardTitle>Threshold Configuration</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <FormField
                      label="Weight Variance Threshold (%)"
                      required
                      hint="Trigger reconciliation when variance exceeds this percentage"
                    >
                      <Input
                        type="number"
                        step="0.1"
                        value={thresholdSettings.weightVariance}
                        onChange={(e) => handleInputChange(setThresholdSettings)({
                          ...thresholdSettings,
                          weightVariance: e.target.value,
                        })}
                      />
                    </FormField>

                    <FormField
                      label="Price Variance Threshold (%)"
                      required
                      hint="Alert when price deviates from market rate"
                    >
                      <Input
                        type="number"
                        step="0.1"
                        value={thresholdSettings.priceVariance}
                        onChange={(e) => handleInputChange(setThresholdSettings)({
                          ...thresholdSettings,
                          priceVariance: e.target.value,
                        })}
                      />
                    </FormField>

                    <FormField
                      label="Payment Delay Alert (days)"
                      required
                      hint="Send reminder when payment is overdue"
                    >
                      <Input
                        type="number"
                        value={thresholdSettings.paymentDelay}
                        onChange={(e) => handleInputChange(setThresholdSettings)({
                          ...thresholdSettings,
                          paymentDelay: e.target.value,
                        })}
                      />
                    </FormField>

                    <FormField
                      label="Minimum Inventory Level (grams)"
                      required
                      hint="Alert when inventory falls below this level"
                    >
                      <Input
                        type="number"
                        value={thresholdSettings.inventoryMinimum}
                        onChange={(e) => handleInputChange(setThresholdSettings)({
                          ...thresholdSettings,
                          inventoryMinimum: e.target.value,
                        })}
                      />
                    </FormField>
                  </div>
                </CardContent>
              </Card>
            )}

            {activeTab === 'notifications' && (
              <Card>
                <CardHeader>
                  <CardTitle>Notification Settings</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="border border-gray-200 rounded-lg p-4">
                      <h4 className="font-semibold text-gray-900 mb-3">System Notifications</h4>
                      <div className="space-y-2">
                        <label className="flex items-center gap-2">
                          <input type="checkbox" className="rounded" defaultChecked />
                          <span className="text-sm text-gray-700">Batch status changes</span>
                        </label>
                        <label className="flex items-center gap-2">
                          <input type="checkbox" className="rounded" defaultChecked />
                          <span className="text-sm text-gray-700">Variance alerts</span>
                        </label>
                        <label className="flex items-center gap-2">
                          <input type="checkbox" className="rounded" defaultChecked />
                          <span className="text-sm text-gray-700">Payment confirmations</span>
                        </label>
                        <label className="flex items-center gap-2">
                          <input type="checkbox" className="rounded" />
                          <span className="text-sm text-gray-700">Daily summary reports</span>
                        </label>
                      </div>
                    </div>

                    <div className="border border-gray-200 rounded-lg p-4">
                      <h4 className="font-semibold text-gray-900 mb-3">User Notifications</h4>
                      <div className="space-y-2">
                        <label className="flex items-center gap-2">
                          <input type="checkbox" className="rounded" defaultChecked />
                          <span className="text-sm text-gray-700">Approval requests</span>
                        </label>
                        <label className="flex items-center gap-2">
                          <input type="checkbox" className="rounded" defaultChecked />
                          <span className="text-sm text-gray-700">Task assignments</span>
                        </label>
                        <label className="flex items-center gap-2">
                          <input type="checkbox" className="rounded" />
                          <span className="text-sm text-gray-700">Weekly activity digest</span>
                        </label>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
