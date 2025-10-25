import { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Search, Download } from 'lucide-react';
import { demoSales, demoCustomers, getCustomerById } from '@/lib/demoSeed';

export function SalesPage() {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredSales = demoSales.filter((sale) => {
    const customer = getCustomerById(sale.customer_id);
    const matchesSearch =
      sale.sale_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      customer?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sale.fx_code.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesSearch;
  });

  const totalSalesUSD = filteredSales.reduce((sum, sale) => sum + sale.amount_usd, 0);

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Sales</h1>
            <p className="text-gray-600 mt-1">Track gold sales and revenue</p>
          </div>
          <button className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg flex items-center gap-2">
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <div className="p-4">
              <p className="text-sm text-gray-600">Total Sales</p>
              <p className="text-2xl font-bold text-gray-900">{filteredSales.length}</p>
            </div>
          </Card>
          <Card>
            <div className="p-4">
              <p className="text-sm text-gray-600">Total Revenue (USD)</p>
              <p className="text-2xl font-bold text-gray-900">${totalSalesUSD.toLocaleString()}</p>
            </div>
          </Card>
          <Card>
            <div className="p-4">
              <p className="text-sm text-gray-600">Total Weight (oz)</p>
              <p className="text-2xl font-bold text-gray-900">
                {filteredSales.reduce((sum, s) => sum + s.fine_weight_oz, 0).toFixed(2)}
              </p>
            </div>
          </Card>
          <Card>
            <div className="p-4">
              <p className="text-sm text-gray-600">Avg Price/oz</p>
              <p className="text-2xl font-bold text-gray-900">
                ${(demoSales.reduce((sum, s) => sum + s.price_per_oz_usd, 0) / demoSales.length).toFixed(2)}
              </p>
            </div>
          </Card>
        </div>

        <Card>
          <div className="p-6 space-y-4">
            <div className="flex gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Search by sale ID, customer, or currency..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sale ID</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Weight (oz)</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Price/oz (USD)</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount (USD)</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">FX</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount (FX)</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredSales.map((sale) => {
                    const customer = getCustomerById(sale.customer_id);
                    return (
                      <tr key={sale.sale_id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {sale.sale_id}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {new Date(sale.date).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {customer?.name || 'Unknown'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 text-right">
                          {sale.fine_weight_oz.toFixed(2)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 text-right">
                          ${sale.price_per_oz_usd.toFixed(2)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 text-right">
                          ${sale.amount_usd.toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 text-center">
                          {sale.fx_code}
                          <span className="block text-xs text-gray-400">@{sale.fx_rate_to_usd}</span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 text-right">
                          {sale.amount_fx.toLocaleString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </Card>
      </div>
    </MainLayout>
  );
}
