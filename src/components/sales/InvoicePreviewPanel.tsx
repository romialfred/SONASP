import { Building2, User, FileText, Calendar, Package, DollarSign } from 'lucide-react';
import { formatCurrency } from '@/utils/salesUtils';

export interface InvoicePreviewData {
  // Seller Information
  sellerName: string;
  sellerAddress?: string;
  sellerCountry: string;

  // Customer Information
  customerName: string;
  customerAddress?: string;
  customerCountry?: string;

  // Sale Details
  quantityOz: number;
  quantityGrams: number;
  pricePerOz: number;
  currency: string;

  // Pricing Details
  grossProceeds: number;
  freightCost: number;
  otherCosts: number;
  netProceeds: number;
  royaltiesPercentage: number;
  royaltiesAmount: number;
  finalAmount: number;

  // Additional Info
  mechanismType?: string;
  mechanismDisplayName?: string;
  valueDate?: string;
  settlementDays?: number;
}

interface InvoicePreviewPanelProps {
  data: InvoicePreviewData | null;
  isVisible: boolean;
}

export function InvoicePreviewPanel({ data, isVisible }: InvoicePreviewPanelProps) {
  if (!isVisible || !data) return null;

  return (
    <div className="fixed right-0 top-0 h-screen w-[480px] bg-white border-l-2 border-gray-200 shadow-2xl z-50 overflow-y-auto">
      <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-6 shadow-lg z-10">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold">Invoice Preview</h2>
            <p className="text-sm text-blue-100 mt-0.5">Live invoice calculation</p>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Invoice Header */}
        <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-6 border-2 border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Draft Invoice</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">#{`DRAFT-${Date.now().toString().slice(-6)}`}</p>
            </div>
            <div className="text-right">
              <p className="text-xs font-semibold text-gray-500 uppercase">Date</p>
              <p className="text-sm font-bold text-gray-900 mt-1">
                {new Date().toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric'
                })}
              </p>
            </div>
          </div>

          {data.mechanismDisplayName && (
            <div className="bg-emerald-100 border border-emerald-300 rounded-lg px-4 py-2.5 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse"></div>
              <span className="text-xs font-bold text-emerald-900 uppercase">
                {data.mechanismDisplayName}
              </span>
            </div>
          )}
        </div>

        {/* Parties Information */}
        <div className="grid grid-cols-2 gap-4">
          {/* Seller */}
          <div className="bg-white rounded-xl p-5 border-2 border-blue-200 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                <Building2 className="w-4 h-4 text-blue-600" />
              </div>
              <h3 className="text-xs font-bold text-gray-500 uppercase">Seller</h3>
            </div>
            <p className="font-bold text-gray-900 text-sm leading-tight">{data.sellerName}</p>
            {data.sellerAddress && (
              <p className="text-xs text-gray-600 mt-1">{data.sellerAddress}</p>
            )}
            <p className="text-xs text-gray-600 mt-1">{data.sellerCountry}</p>
          </div>

          {/* Customer */}
          <div className="bg-white rounded-xl p-5 border-2 border-purple-200 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                <User className="w-4 h-4 text-purple-600" />
              </div>
              <h3 className="text-xs font-bold text-gray-500 uppercase">Customer</h3>
            </div>
            <p className="font-bold text-gray-900 text-sm leading-tight">{data.customerName}</p>
            {data.customerAddress && (
              <p className="text-xs text-gray-600 mt-1">{data.customerAddress}</p>
            )}
            {data.customerCountry && (
              <p className="text-xs text-gray-600 mt-1">{data.customerCountry}</p>
            )}
          </div>
        </div>

        {/* Product Details */}
        <div className="bg-gradient-to-br from-amber-50 to-yellow-50 rounded-xl p-5 border-2 border-amber-200">
          <div className="flex items-center gap-2 mb-4">
            <Package className="w-5 h-5 text-amber-700" />
            <h3 className="font-bold text-amber-900 uppercase text-sm">Product Details</h3>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between items-center pb-2 border-b border-amber-200">
              <span className="text-sm text-amber-800 font-medium">Fine Gold</span>
              <div className="text-right">
                <p className="font-bold text-amber-900">{data.quantityOz.toFixed(3)} oz</p>
                <p className="text-xs text-amber-700">({data.quantityGrams.toFixed(2)} g)</p>
              </div>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-amber-800 font-medium">Price per oz</span>
              <span className="font-bold text-amber-900">{formatCurrency(data.pricePerOz)}</span>
            </div>
          </div>
        </div>

        {/* Calculations */}
        <div className="bg-white rounded-xl border-2 border-gray-200 overflow-hidden shadow-sm">
          <div className="bg-gray-50 px-5 py-3 border-b-2 border-gray-200">
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-gray-600" />
              <h3 className="font-bold text-gray-900 text-sm uppercase">Financial Summary</h3>
            </div>
          </div>

          <div className="p-5 space-y-3">
            {/* Gross Proceeds */}
            <div className="flex justify-between items-center py-3 px-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border border-green-200">
              <span className="text-sm font-semibold text-green-900">Gross Proceeds</span>
              <span className="text-lg font-bold text-green-700">{formatCurrency(data.grossProceeds)}</span>
            </div>

            {/* Deductions */}
            {data.freightCost > 0 && (
              <div className="flex justify-between items-center pl-6 py-2">
                <span className="text-xs text-gray-600">Less: Freight Cost</span>
                <span className="font-semibold text-red-600 text-sm">-{formatCurrency(data.freightCost)}</span>
              </div>
            )}

            {data.otherCosts > 0 && (
              <div className="flex justify-between items-center pl-6 py-2">
                <span className="text-xs text-gray-600">Less: Other Costs</span>
                <span className="font-semibold text-red-600 text-sm">-{formatCurrency(data.otherCosts)}</span>
              </div>
            )}

            {/* Net Proceeds */}
            <div className="flex justify-between items-center py-3 px-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
              <span className="text-sm font-semibold text-blue-900">Net Proceeds</span>
              <span className="text-lg font-bold text-blue-700">{formatCurrency(data.netProceeds)}</span>
            </div>

            {/* Royalties */}
            <div className="flex justify-between items-center pl-6 py-2">
              <span className="text-xs text-gray-600">
                Less: Royalties ({data.royaltiesPercentage}%)
              </span>
              <span className="font-semibold text-red-600 text-sm">-{formatCurrency(data.royaltiesAmount)}</span>
            </div>

            {/* Final Amount */}
            <div className="mt-4 pt-4 border-t-2 border-gray-200">
              <div className="flex justify-between items-center py-4 px-5 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl shadow-lg">
                <span className="text-base font-bold text-white uppercase tracking-wide">Total Amount</span>
                <span className="text-2xl font-bold text-white">{formatCurrency(data.finalAmount)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Payment Terms */}
        {data.valueDate && (
          <div className="bg-gradient-to-br from-slate-50 to-gray-100 rounded-xl p-5 border-2 border-slate-200">
            <div className="flex items-center gap-2 mb-3">
              <Calendar className="w-4 h-4 text-slate-600" />
              <h3 className="font-bold text-slate-900 text-sm uppercase">Payment Terms</h3>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-slate-600">Value Date</span>
                <span className="font-semibold text-slate-900">
                  {new Date(data.valueDate).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                  })}
                </span>
              </div>
              {data.settlementDays && (
                <div className="flex justify-between">
                  <span className="text-sm text-slate-600">Settlement Period</span>
                  <span className="font-semibold text-slate-900">{data.settlementDays} days</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Footer Note */}
        <div className="bg-yellow-50 border-l-4 border-yellow-400 rounded-r-lg p-4">
          <p className="text-xs text-yellow-800 leading-relaxed">
            <strong className="font-bold">Note:</strong> This is a live preview of the invoice.
            The final PDF invoice will include additional details such as company logos,
            signatures, and complete legal terms once the sale is created.
          </p>
        </div>
      </div>
    </div>
  );
}
