import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save, Info, Building2, FileText } from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { FormField } from '@/components/ui/FormField';
import { Alert } from '@/components/ui/Alert';
import { BankAccountForm, type BankAccount } from '@/components/customers/BankAccountForm';
import { COUNTRIES } from '@/constants/countries';

interface CustomerFormData {
  name: string;
  email: string;
  phone: string;
  country: string;
  address: string;
  contactPerson: string;
  taxId: string;
  paymentTerms: string;
  creditLimit: string;
  status: 'active' | 'inactive' | 'pending';
  banks: BankAccount[];
}
const paymentTermsOptions = ['Net 15 days', 'Net 30 days', 'Net 45 days', 'Net 60 days', 'Immediate'];
const statusOptions = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'pending', label: 'Pending' },
];

export function CustomerForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditMode = !!id;

  const [formData, setFormData] = useState<CustomerFormData>({
    name: '',
    email: '',
    phone: '',
    country: '',
    address: '',
    contactPerson: '',
    taxId: '',
    paymentTerms: 'Net 30 days',
    creditLimit: '500000',
    status: 'pending',
    banks: [],
  });

  const [errors, setErrors] = useState<Partial<Record<keyof CustomerFormData, string>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  useEffect(() => {
    if (isEditMode) {
      const mockCustomers = [
        {
          id: '1',
          name: 'Premium Gold Ltd.',
          email: 'contact@premiumgold.com',
          phone: '+41 44 123 4567',
          country: 'Switzerland',
          address: 'Bahnhofstrasse 45, 8001 Zurich',
          contactPerson: 'Hans Mueller',
          taxId: 'CHE-123.456.789',
          paymentTerms: 'Net 30 days',
          creditLimit: '500000',
          status: 'active' as const,
        },
        {
          id: '2',
          name: 'Global Metals Inc.',
          email: 'sales@globalmetals.com',
          phone: '+971 4 567 8901',
          country: 'UAE',
          address: 'Sheikh Zayed Road, Dubai',
          contactPerson: 'Ahmed Al-Maktoum',
          taxId: 'TRN-987654321',
          paymentTerms: 'Net 45 days',
          creditLimit: '750000',
          status: 'active' as const,
        },
        {
          id: '3',
          name: 'Swiss Refineries SA',
          email: 'info@swissref.ch',
          phone: '+41 22 987 6543',
          country: 'Switzerland',
          address: 'Rue du Rhone 100, 1204 Geneva',
          contactPerson: 'Pierre Dubois',
          taxId: 'CHE-987.654.321',
          paymentTerms: 'Net 30 days',
          creditLimit: '1000000',
          status: 'active' as const,
        },
        {
          id: '4',
          name: 'Asian Gold Trading',
          email: 'trading@asiangold.com',
          phone: '+65 6789 1234',
          country: 'Singapore',
          address: 'Marina Bay Financial Centre',
          contactPerson: 'Li Wei',
          taxId: 'GST-456789123',
          paymentTerms: 'Net 60 days',
          creditLimit: '600000',
          status: 'inactive' as const,
        },
      ];

      const customer = mockCustomers.find((c) => c.id === id);
      if (customer) {
        setFormData({
          name: customer.name,
          email: customer.email,
          phone: customer.phone,
          country: customer.country,
          address: customer.address,
          contactPerson: customer.contactPerson,
          taxId: customer.taxId,
          paymentTerms: customer.paymentTerms,
          creditLimit: customer.creditLimit,
          status: customer.status,
        });
      }
    }
  }, [id, isEditMode]);

  const handleChange = (field: keyof CustomerFormData, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: '' }));
    }
  };

  const handleBanksChange = (banks: BankAccount[]) => {
    setFormData((prev) => ({ ...prev, banks }));
  };

  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof CustomerFormData, string>> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Company name is required';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Invalid email format';
    }

    if (!formData.phone.trim()) {
      newErrors.phone = 'Phone number is required';
    }

    if (!formData.contactPerson.trim()) {
      newErrors.contactPerson = 'Contact person is required';
    }

    if (!formData.address.trim()) {
      newErrors.address = 'Address is required';
    }

    const creditLimit = parseFloat(formData.creditLimit);
    if (isNaN(creditLimit) || creditLimit < 0) {
      newErrors.creditLimit = 'Valid credit limit is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      await new Promise((resolve) => setTimeout(resolve, 1000));

      console.log('Customer data:', formData);

      setSubmitSuccess(true);
      setTimeout(() => {
        navigate('/customers');
      }, 1500);
    } catch (error) {
      console.error('Error saving customer:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="outline" onClick={() => navigate('/customers')}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="font-heading text-3xl font-bold text-gray-900">
                {isEditMode ? 'Edit Customer' : 'New Customer'}
              </h1>
              <p className="text-gray-600 mt-1">
                {isEditMode ? 'Update customer information' : 'Add a new customer to the system'}
              </p>
            </div>
          </div>
        </div>

        {submitSuccess && (
          <Alert type="success" title="Success">
            Customer {isEditMode ? 'updated' : 'created'} successfully! Redirecting...
          </Alert>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <form onSubmit={handleSubmit}>
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Customer Information</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField label="Company Name" required error={errors.name}>
                  <Input
                    value={formData.name}
                    onChange={(e) => handleChange('name', e.target.value)}
                    error={!!errors.name}
                    placeholder="Enter company name"
                  />
                </FormField>

                <FormField label="Email Address" required error={errors.email}>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleChange('email', e.target.value)}
                    error={!!errors.email}
                    placeholder="company@example.com"
                  />
                </FormField>

                <FormField label="Phone Number" required error={errors.phone}>
                  <Input
                    value={formData.phone}
                    onChange={(e) => handleChange('phone', e.target.value)}
                    error={!!errors.phone}
                    placeholder="+XX XXX XXX XXXX"
                  />
                </FormField>

                <FormField label="Contact Person" required error={errors.contactPerson}>
                  <Input
                    value={formData.contactPerson}
                    onChange={(e) => handleChange('contactPerson', e.target.value)}
                    error={!!errors.contactPerson}
                    placeholder="Contact person name"
                  />
                </FormField>

                <FormField label="Country" required>
                  <Select
                    value={formData.country}
                    onChange={(e) => handleChange('country', e.target.value)}
                  >
                    <option value="">Select a country</option>
                    {COUNTRIES.map((country) => (
                      <option key={country} value={country}>
                        {country}
                      </option>
                    ))}
                  </Select>
                </FormField>

                <FormField label="Tax ID / Registration Number">
                  <Input
                    value={formData.taxId}
                    onChange={(e) => handleChange('taxId', e.target.value)}
                    placeholder="Tax ID"
                  />
                </FormField>

                <FormField label="Address" required error={errors.address} className="md:col-span-2">
                  <Input
                    value={formData.address}
                    onChange={(e) => handleChange('address', e.target.value)}
                    error={!!errors.address}
                    placeholder="Full address"
                  />
                </FormField>

                <FormField label="Payment Terms">
                  <Select
                    value={formData.paymentTerms}
                    onChange={(e) => handleChange('paymentTerms', e.target.value)}
                  >
                    {paymentTermsOptions.map((term) => (
                      <option key={term} value={term}>
                        {term}
                      </option>
                    ))}
                  </Select>
                </FormField>

                <FormField label="Credit Limit (USD)" error={errors.creditLimit}>
                  <Input
                    type="number"
                    value={formData.creditLimit}
                    onChange={(e) => handleChange('creditLimit', e.target.value)}
                    error={!!errors.creditLimit}
                    placeholder="0"
                    min="0"
                  />
                </FormField>

                <FormField label="Status">
                  <Select
                    value={formData.status}
                    onChange={(e) => handleChange('status', e.target.value as typeof formData.status)}
                  >
                    {statusOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                </FormField>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Bank Accounts</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <BankAccountForm
                      banks={formData.banks}
                      onChange={handleBanksChange}
                    />
                  </CardContent>
                </Card>

                <div className="flex justify-end gap-4">
                  <Button type="button" variant="outline" onClick={() => navigate('/customers')}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? (
                      'Saving...'
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        {isEditMode ? 'Update Customer' : 'Create Customer'}
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </form>
          </div>

          <div className="lg:col-span-1">
            <div className="space-y-6 sticky top-6">
              <Card className="bg-blue-50 border-blue-200">
                <CardContent className="p-5">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                      <Info className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-2">Customer Guidelines</h3>
                      <ul className="text-sm text-gray-700 space-y-2">
                        <li className="flex items-start gap-2">
                          <span className="text-blue-600 mt-0.5">•</span>
                          <span>All fields marked with * are required</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-blue-600 mt-0.5">•</span>
                          <span>Email will be used for payment notifications</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-blue-600 mt-0.5">•</span>
                          <span>Credit limit determines maximum outstanding balance</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-blue-600 mt-0.5">•</span>
                          <span>New customers start with "Pending" status</span>
                        </li>
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-amber-50 border-amber-200">
                <CardContent className="p-5">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
                      <Building2 className="w-5 h-5 text-amber-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-2">Bank Information</h3>
                      <ul className="text-sm text-gray-700 space-y-2">
                        <li className="flex items-start gap-2">
                          <span className="text-amber-600 mt-0.5">•</span>
                          <span>Add at least one bank account for payments</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-amber-600 mt-0.5">•</span>
                          <span>Primary bank will be used as default</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-amber-600 mt-0.5">•</span>
                          <span>IBAN and SWIFT codes ensure accurate transfers</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-amber-600 mt-0.5">•</span>
                          <span>Multiple banks can be added for different currencies</span>
                        </li>
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-green-50 border-green-200">
                <CardContent className="p-5">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center flex-shrink-0">
                      <FileText className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-2">Required Documents</h3>
                      <ul className="text-sm text-gray-700 space-y-2">
                        <li className="flex items-start gap-2">
                          <span className="text-green-600 mt-0.5">✓</span>
                          <span>Business registration certificate</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-green-600 mt-0.5">✓</span>
                          <span>Tax identification documents</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-green-600 mt-0.5">✓</span>
                          <span>Bank account verification letter</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-green-600 mt-0.5">✓</span>
                          <span>Authorized signatory list</span>
                        </li>
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
