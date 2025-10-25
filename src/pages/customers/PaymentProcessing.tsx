import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Upload, AlertCircle } from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { FormField } from '@/components/ui/FormField';
import { DatePicker } from '@/components/ui/DatePicker';
import { FileUpload } from '@/components/ui/FileUpload';
import { Alert } from '@/components/ui/Alert';
import { formatCurrency, calculateFXSpread } from '@/utils/salesUtils';

export function PaymentProcessing() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams();

  const [formData, setFormData] = useState({
    saleId: '',
    expectedDate: '',
    actualDate: '',
    amount: '',
    currency: 'USD',
    bankName: '',
    accountNumber: '',
    referenceNumber: '',
    fxRate: '',
    notes: '',
  });

  const [paymentProof, setPaymentProof] = useState<File | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const currentFXRates = {
    USD_CFA: 605.50,
    USD_GNF: 8650.00,
    USD_EUR: 0.92,
    USD_CHF: 0.88,
  };

  const sale = {
    saleNumber: 'SL-2024-042',
    customer: 'Premium Gold Ltd.',
    amount: 156450,
    expectedPaymentDate: '2024-11-20',
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: '' }));
    }
  };

  const handleFileUpload = (files: File[]) => {
    if (files.length > 0) {
      setPaymentProof(files[0]);
      setErrors((prev) => ({ ...prev, paymentProof: '' }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.actualDate) {
      newErrors.actualDate = 'Payment date is required';
    }

    const amount = parseFloat(formData.amount);
    if (!formData.amount || isNaN(amount) || amount <= 0) {
      newErrors.amount = 'Please enter a valid amount';
    }

    if (!formData.bankName) {
      newErrors.bankName = 'Bank name is required';
    }

    if (!formData.referenceNumber) {
      newErrors.referenceNumber = 'Reference number is required';
    }

    if (!paymentProof) {
      newErrors.paymentProof = 'Payment proof is required';
    }

    const fxRate = parseFloat(formData.fxRate);
    if (formData.currency !== 'USD' && (!formData.fxRate || isNaN(fxRate) || fxRate <= 0)) {
      newErrors.fxRate = 'FX rate is required for non-USD payments';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (validateForm()) {
      navigate(`/customers/${id}`);
    }
  };

  const enteredFXRate = parseFloat(formData.fxRate);
  const referenceFXRate = currentFXRates[`USD_${formData.currency}` as keyof typeof currentFXRates];
  const fxSpread = enteredFXRate && referenceFXRate ? calculateFXSpread(enteredFXRate, referenceFXRate) : 0;

  return (
    <MainLayout>
      <div className="space-y-6 max-w-4xl">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            onClick={() => navigate(`/customers/${id}`)}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <div>
            <h1 className="font-heading text-3xl font-bold text-gray-900">
              Payment Processing
            </h1>
            <p className="text-gray-600 mt-1">Record customer payment details</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Sale Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-gray-500">Sale Number</p>
                <p className="text-base font-semibold text-gray-900 mt-1">{sale.saleNumber}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Customer</p>
                <p className="text-base font-semibold text-gray-900 mt-1">{sale.customer}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Sale Amount</p>
                <p className="text-base font-semibold text-primary-700 mt-1">
                  {formatCurrency(sale.amount)}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Expected Payment</p>
                <p className="text-base font-semibold text-gray-900 mt-1">
                  {new Date(sale.expectedPaymentDate).toLocaleDateString()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Payment Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  label="Expected Payment Date"
                  required
                >
                  <DatePicker
                    value={formData.expectedDate}
                    onChange={(value) => handleInputChange('expectedDate', value)}
                  />
                </FormField>

                <FormField
                  label="Actual Payment Date"
                  required
                  error={errors.actualDate}
                >
                  <DatePicker
                    value={formData.actualDate}
                    onChange={(value) => handleInputChange('actualDate', value)}
                    error={!!errors.actualDate}
                  />
                </FormField>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  label="Amount Received"
                  required
                  error={errors.amount}
                >
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.amount}
                    onChange={(e) => handleInputChange('amount', e.target.value)}
                    error={!!errors.amount}
                    placeholder="0.00"
                  />
                </FormField>

                <FormField
                  label="Currency"
                  required
                >
                  <Select
                    value={formData.currency}
                    onChange={(e) => handleInputChange('currency', e.target.value)}
                  >
                    <option value="USD">USD - US Dollar</option>
                    <option value="EUR">EUR - Euro</option>
                    <option value="CHF">CHF - Swiss Franc</option>
                    <option value="CFA">XOF - West African CFA</option>
                    <option value="GNF">GNF - Guinean Franc</option>
                  </Select>
                </FormField>
              </div>

              {formData.currency !== 'USD' && (
                <>
                  <FormField
                    label={`FX Rate (USD/${formData.currency})`}
                    required
                    error={errors.fxRate}
                    hint={referenceFXRate ? `Current market rate: ${referenceFXRate.toFixed(2)}` : ''}
                  >
                    <Input
                      type="number"
                      step="0.0001"
                      value={formData.fxRate}
                      onChange={(e) => handleInputChange('fxRate', e.target.value)}
                      error={!!errors.fxRate}
                      placeholder="0.0000"
                    />
                  </FormField>

                  {enteredFXRate && referenceFXRate && fxSpread > 0.05 && (
                    <Alert type="warning" title="FX Rate Variance">
                      The entered FX rate differs from the current market rate by {(fxSpread * 100).toFixed(2)}%.
                      Please verify this rate is correct.
                    </Alert>
                  )}
                </>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Bank Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <FormField
                label="Bank Name"
                required
                error={errors.bankName}
              >
                <Input
                  value={formData.bankName}
                  onChange={(e) => handleInputChange('bankName', e.target.value)}
                  error={!!errors.bankName}
                  placeholder="Enter bank name"
                />
              </FormField>

              <FormField
                label="Account Number"
                hint="Optional"
              >
                <Input
                  value={formData.accountNumber}
                  onChange={(e) => handleInputChange('accountNumber', e.target.value)}
                  placeholder="Enter account number"
                />
              </FormField>

              <FormField
                label="Transaction Reference Number"
                required
                error={errors.referenceNumber}
              >
                <Input
                  value={formData.referenceNumber}
                  onChange={(e) => handleInputChange('referenceNumber', e.target.value)}
                  error={!!errors.referenceNumber}
                  placeholder="Enter reference number"
                />
              </FormField>

              <FormField
                label="Notes"
                hint="Optional"
              >
                <textarea
                  value={formData.notes}
                  onChange={(e) => handleInputChange('notes', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
                  rows={3}
                  placeholder="Add any additional notes..."
                />
              </FormField>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Payment Proof</CardTitle>
          </CardHeader>
          <CardContent>
            <FormField
              label="Upload Payment Receipt"
              required
              error={errors.paymentProof}
              hint="Accepted formats: PDF, JPG, PNG (Max 10MB)"
            >
              <FileUpload
                accept=".pdf,.jpg,.jpeg,.png"
                maxSize={10 * 1024 * 1024}
                onUpload={handleFileUpload}
                multiple={false}
              />
            </FormField>

            {paymentProof && (
              <div className="mt-3 p-3 bg-accent-50 rounded-lg flex items-center gap-3">
                <Upload className="h-5 w-5 text-accent-600" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">{paymentProof.name}</p>
                  <p className="text-xs text-gray-600">
                    {(paymentProof.size / 1024).toFixed(2)} KB
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Alert type="info" title="Approval Required">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
            <p className="text-sm">
              This payment will be submitted for management approval. You will be notified once the payment has been reviewed.
            </p>
          </div>
        </Alert>

        <div className="flex justify-end gap-3">
          <Button
            variant="outline"
            onClick={() => navigate(`/customers/${id}`)}
          >
            {t('common.cancel')}
          </Button>
          <Button onClick={handleSubmit}>
            Submit for Approval
          </Button>
        </div>
      </div>
    </MainLayout>
  );
}
