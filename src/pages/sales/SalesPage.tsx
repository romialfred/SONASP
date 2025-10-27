import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Loading } from '@/components/ui/Loading';
import { Search, Download } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface Sale {
  id: string;
  sale_number: string;
  created_at: string;
  customer_id: string;
  quantity_oz: number;
  london_am_rate: number;
  final_proceeds: number;
  currency?: string;
}

interface Customer {
  id: string;
  name: string;
}

export function SalesPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [sales, setSales] = useState<Sale[]>([]);
  const [customers, setCustomers] = useState<Record<string, Customer>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchSalesData() {
      setLoading(true);
      try {
        const [salesRes, customersRes] = await Promise.all([
          supabase.from('sales').select('id, sale_number, created_at, customer_id, quantity_oz, london_am_rate, final_proceeds, currency').order('created_at', { ascending: false }),
          supabase.from('customers').select('id, name'),
        ]);

        if (!salesRes.error && salesRes.data) {
          setSales(salesRes.data);
        }

        if (!customersRes.error && customersRes.data) {
          const customerMap = customersRes.data.reduce((acc, customer) => {
            acc[customer.id] = customer;
            return acc;
          }, {} as Record<string, Customer>);
          setCustomers(customerMap);
        }
      } catch (error) {
        console.error('Error fetching sales data:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchSalesData();
  }, []);

  const filteredSales = sales.filter((sale) => {
    const customer = customers[sale.customer_id];
    const matchesSearch =
      sale.sale_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (customer?.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (sale.currency || '').toLowerCase().includes(searchQuery.toLowerCase());

    return matchesSearch;
  });

  const totalSalesUSD = filteredSales.reduce((sum, sale) => sum + (sale.final_proceeds || 0), 0);
  const totalWeight = filteredSales.reduce((sum, sale) => sum + (sale.quantity_oz || 0), 0);
  const avgPrice = filteredSales.length > 0
    ? filteredSales.reduce((sum, s) => sum + s.london_am_rate, 0) / filteredSales.length
    : 0;

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
              <p className="text-2xl font-bold text-gray-900">{totalWeight.toFixed(2)}</p>
            </div>
          </Card>
          <Card>
            <div className="p-4">
              <p className="text-sm text-gray-600">Avg Price/oz</p>
              <p className="text-2xl font-bold text-gray-900">${avgPrice.toFixed(2)}</p>
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
                  placeholder="Search by sale number, customer, or currency..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loading size="lg" />
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sale Number</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Weight (oz)</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Price/oz (USD)</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount (USD)</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {filteredSales.map((sale) => {
                        const customer = customers[sale.customer_id];
                        return (
                          <tr key={sale.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              {sale.sale_number}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                              {new Date(sale.created_at).toLocaleDateString()}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-600">
                              {customer?.name || 'Unknown'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 text-right">
                              {sale.quantity_oz.toFixed(2)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 text-right">
                              ${sale.london_am_rate.toFixed(2)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 text-right">
                              ${sale.final_proceeds.toLocaleString()}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {filteredSales.length === 0 && (
                  <div className="text-center py-12">
                    <p className="text-gray-500">
                      {sales.length === 0 ? 'No sales records yet.' : 'No sales found matching your criteria.'}
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        </Card>
      </div>
    </MainLayout>
  );
}
