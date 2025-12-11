import { FileText } from 'lucide-react';
import { formatCurrency } from '@/utils/salesUtils';

export interface InvoicePreviewData {
  // Seller Information
  sellerName: string;
  sellerAddress?: string;
  sellerCity?: string;
  sellerCountry: string;
  sellerPhone?: string;
  sellerLogo?: string;

  // Customer Information
  customerName: string;
  customerAddress?: string;
  customerCity?: string;
  customerCountry?: string;
  customerPhone?: string;
  customerLogo?: string;

  // Invoice Details
  invoiceNumber?: string;
  invoiceDate: string;
  lotNumber?: string;

  // Sale Details
  quantityOz: number;
  quantityGrams: number;
  quantityKg: number;
  pricePerOz: number;
  pricePerKg: number;
  currency: string;

  // Pricing Details
  grossProceeds: number;
  freightCost: number;
  otherCosts: number;
  netProceeds: number;
  royaltiesPercentage: number;
  royaltiesAmount: number;
  finalAmount: number;
  finalAmountInWords?: string;
  estimatedValue: number;

  // Exchange Rate
  exchangeRate?: number;
  localCurrency?: string;
  localCurrencyTotal?: number;
  usdTotal?: number;

  // Additional Info
  mechanismType?: string;
  mechanismDisplayName?: string;
  valueDate?: string;
  settlementDays?: number;
  paymentMethod?: string;
}

interface InvoicePreviewPanelProps {
  data: InvoicePreviewData | null;
  isVisible: boolean;
}

export function InvoicePreviewPanel({ data, isVisible }: InvoicePreviewPanelProps) {
  if (!isVisible || !data) return null;

  // Format conversion values
  const troyOzToGrams = 31.1035;
  const gramsToKg = 1000;

  return (
    <div className="fixed right-0 top-0 h-screen w-[580px] bg-white border-l border-gray-300 shadow-2xl z-50 overflow-y-auto">
      {/* Sticky Header */}
      <div className="sticky top-0 bg-white border-b border-gray-300 px-3 py-2 shadow-md z-10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gray-100 border border-gray-300 rounded flex items-center justify-center">
            <FileText className="w-4 h-4 text-gray-900" />
          </div>
          <div>
            <h2 className="text-base text-gray-900">Invoice Preview</h2>
            <p className="text-xs text-gray-600">Live calculation</p>
          </div>
        </div>
      </div>

      <div className="p-3">
        {/* Main Invoice Container */}
        <div className="bg-white border border-gray-300">

          {/* Seller and Client Header Section */}
          <div className="grid grid-cols-2 border-b border-gray-300">
            {/* Seller */}
            <div className="px-3 py-2 border-r border-gray-300">
              <div className="text-xs mb-1 text-gray-600">SELLER</div>
              <div className="text-xs space-y-0.5 leading-tight ml-2">
                <div>{data.sellerName}</div>
                {data.sellerAddress && <div className="text-gray-600">{data.sellerAddress}</div>}
                {data.sellerCity && <div className="text-gray-600">{data.sellerCity}</div>}
                {!data.sellerCity && <div className="text-gray-600">{data.sellerCountry}</div>}
                {data.sellerPhone && <div className="text-gray-600">Tel: {data.sellerPhone}</div>}
              </div>
            </div>

            {/* Client */}
            <div className="px-3 py-2">
              <div className="text-xs mb-1 text-gray-600">CUSTOMER</div>
              <div className="text-xs space-y-0.5 leading-tight ml-2">
                <div>{data.customerName}</div>
                {data.customerAddress && <div className="text-gray-600">{data.customerAddress}</div>}
                {data.customerCity && data.customerCountry && <div className="text-gray-600">{data.customerCity} - {data.customerCountry}</div>}
                {!data.customerCity && data.customerCountry && <div className="text-gray-600">{data.customerCountry}</div>}
                {data.customerPhone && <div className="text-gray-600">Tel: {data.customerPhone}</div>}
              </div>
            </div>
          </div>

          {/* Logo Row (if logos available) */}
          {(data.sellerLogo || data.customerLogo) && (
            <div className="grid grid-cols-2 border-b border-gray-300">
              <div className="p-3 border-r border-gray-300 flex items-center justify-center min-h-[80px]">
                {data.sellerLogo && (
                  <img src={data.sellerLogo} alt="Seller Logo" className="max-h-16 max-w-full object-contain" />
                )}
              </div>
              <div className="p-3 flex items-center justify-center min-h-[80px]">
                {data.customerLogo && (
                  <img src={data.customerLogo} alt="Customer Logo" className="max-h-16 max-w-full object-contain" />
                )}
              </div>
            </div>
          )}

          {/* Invoice Number and Date */}
          <div className="px-3 py-1.5 border-b border-gray-300 bg-white">
            <div className="flex justify-between items-center text-xs">
              <div>
                <span className="text-gray-600">Facture N° : </span>
                <span>{data.invoiceNumber || `DRAFT-${Date.now().toString().slice(-6)}`}</span>
              </div>
              <div>
                <span className="text-gray-600">Invoice Date </span>
                <span>
                  {new Date(data.invoiceDate || Date.now()).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                  })}
                </span>
              </div>
            </div>
          </div>

          {/* Product Details Table */}
          <div>
            {/* Table Header */}
            <div className="grid grid-cols-6 bg-[#B8860B] text-white border-b border-gray-300 text-xs">
              <div className="px-2 py-1.5 border-r border-gray-300 text-center">Lot #</div>
              <div className="px-2 py-1.5 border-r border-gray-300 text-center">Description</div>
              <div className="px-2 py-1.5 border-r border-gray-300 text-center">Unit Price<br/>$/Oz</div>
              <div className="px-2 py-1.5 border-r border-gray-300 text-center">Net Weight<br/>(kg)</div>
              <div className="px-2 py-1.5 border-r border-gray-300 text-center">Weight<br/>(Troy Oz)</div>
              <div className="px-2 py-1.5 text-center">Metal Price<br/>({data.currency}/kg)</div>
            </div>

            {/* Table Header - Estimated Value (Second Row) */}
            <div className="bg-[#B8860B] text-white border-b border-gray-300">
              <div className="px-2 py-1.5 text-xs text-center">Estimated Value ({data.currency})</div>
            </div>

            {/* Product Row */}
            <div className="grid grid-cols-6 border-b border-gray-300 text-xs">
              <div className="px-2 py-1.5 border-r border-gray-300 text-center">
                {data.lotNumber || `${new Date().getFullYear()}/${Date.now().toString().slice(-4)}`}
              </div>
              <div className="px-2 py-1.5 border-r border-gray-300">Fine Gold (Au)</div>
              <div className="px-2 py-1.5 border-r border-gray-300 text-right">{data.pricePerOz.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
              <div className="px-2 py-1.5 border-r border-gray-300 text-right">{data.quantityKg.toFixed(3)}</div>
              <div className="px-2 py-1.5 border-r border-gray-300 text-right">{data.quantityOz.toFixed(2)}</div>
              <div className="px-2 py-1.5 text-right">{data.pricePerKg.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div>
            </div>

            {/* Estimated Value Row */}
            <div className="border-b border-gray-300">
              <div className="px-2 py-1.5 text-xs text-right">{data.grossProceeds.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div>
            </div>

            {/* Royalties Row */}
            <div className="grid grid-cols-6 border-b border-gray-300 text-xs">
              <div className="col-span-1 px-2 py-1.5 border-r border-gray-300">Royalties</div>
              <div className="col-span-4 px-2 py-1.5 border-r border-gray-300 text-right">{data.royaltiesPercentage}%</div>
              <div className="px-2 py-1.5 text-right">{data.royaltiesAmount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div>
            </div>

            {/* Empty Row (spacing) */}
            <div className="border-b border-gray-300">
              <div className="p-1">&nbsp;</div>
            </div>

            {/* Totals Section - Header Rows */}
            <div className="bg-[#B8860B] text-white border-b border-gray-300">
              <div className="grid grid-cols-2 text-xs">
                <div className="px-2 py-1.5 border-r border-gray-300 text-right" style={{ gridColumn: '1 / -2' }}>
                  {data.localCurrency ? `Total prix ${data.localCurrency}` : `Total prix ${data.currency}`}
                </div>
                <div className="px-2 py-1.5 text-right">
                  {data.localCurrencyTotal
                    ? data.localCurrencyTotal.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
                    : data.grossProceeds.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
                  }
                </div>
              </div>
            </div>

            <div className="bg-[#B8860B] text-white border-b border-gray-300">
              <div className="grid grid-cols-2 text-xs">
                <div className="px-2 py-1.5 border-r border-gray-300 text-right" style={{ gridColumn: '1 / -2' }}>Total prix US$</div>
                <div className="px-2 py-1.5 text-right">
                  {(data.usdTotal || data.grossProceeds).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </div>
              </div>
            </div>

            <div className="bg-[#B8860B] text-white border-b border-gray-300">
              <div className="grid grid-cols-2 text-xs">
                <div className="px-2 py-1.5 border-r border-gray-300 text-right" style={{ gridColumn: '1 / -2' }}>Net Proceed</div>
                <div className="px-2 py-1.5 text-right">
                  {data.finalAmount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </div>
              </div>
            </div>
          </div>

          {/* Footer Text */}
          <div className="px-3 py-2 border-b border-gray-300 text-center text-xs italic">
            <p>Finalize the present invoice for the amount of {formatCurrency(data.finalAmount)} ({data.finalAmountInWords || 'amount in words'})</p>
          </div>

          {/* Bottom Section - Conversion and Payment Terms */}
          <div className="grid grid-cols-2">
            {/* Left: Conversion Info */}
            <div className="px-3 py-2 border-r border-gray-300 text-xs space-y-0.5">
              <div>1 troy oz = {troyOzToGrams.toFixed(4)} g</div>
              <div>1 kg = {(1000 / troyOzToGrams).toFixed(4)} troy oz</div>
              {data.exchangeRate && (
                <div>Exchange Rate {data.localCurrency}/USD: {data.exchangeRate}</div>
              )}
            </div>

            {/* Right: Payment Terms */}
            <div className="p-2">
              <table className="w-full text-xs border border-gray-300">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border border-gray-300 px-2 py-1 text-center" colSpan={2}>
                      Payment Terms
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border border-gray-300 px-2 py-1">Method</td>
                    <td className="border border-gray-300 px-2 py-1">{data.paymentMethod || data.mechanismDisplayName || 'Spot Basis'}</td>
                  </tr>
                  {data.valueDate && (
                    <tr>
                      <td className="border border-gray-300 px-2 py-1">Value Date</td>
                      <td className="border border-gray-300 px-2 py-1">
                        {new Date(data.valueDate).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric'
                        })}
                      </td>
                    </tr>
                  )}
                  {data.settlementDays && (
                    <tr>
                      <td className="border border-gray-300 px-2 py-1">Settlement Period</td>
                      <td className="border border-gray-300 px-2 py-1">{data.settlementDays} days</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Footer Note */}
        <div className="mt-4 bg-gray-50 border-l-4 border-slate-400 rounded-r p-3">
          <p className="text-xs text-gray-700 leading-relaxed">
            <strong className="font-bold text-gray-900">Note:</strong> This is a live preview.
            The final PDF invoice will include company logos and complete legal terms.
          </p>
        </div>
      </div>
    </div>
  );
}
