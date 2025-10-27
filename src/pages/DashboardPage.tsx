import { MainLayout } from '@/components/layout/MainLayout';
import { Card } from '@/components/ui/Card';
import { Loading } from '@/components/ui/Loading';
import { GoldPriceLive } from '@/components/dashboard/GoldPriceLive';
import { DollarSign, Package, Users, ShoppingCart } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

interface Batch {
  id: string;
  batch_number: string;
  status: string;
  weight_grams: number;
  created_at: string;
}

interface Sale {
  id: string;
  sale_number: string;
  customer_id: string;
  quantity_oz: number;
  london_am_rate: number;
  final_proceeds: number;
  created_at: string;
}

interface Customer {
  id: string;
  name: string;
  segment?: string;
}


export function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);

  useEffect(() => {
    async function fetchDashboardData() {
      setLoading(true);

      try {
        const [batchesRes, salesRes, customersRes] = await Promise.all([
          supabase.from('batches').select('id, batch_number, status, weight_grams, created_at').order('created_at', { ascending: false }),
          supabase.from('sales').select('id, sale_number, customer_id, quantity_oz, london_am_rate, final_proceeds, created_at').order('created_at', { ascending: false }),
          supabase.from('customers').select('id, name, segment'),
        ]);

        if (!batchesRes.error && batchesRes.data) {
          setBatches(batchesRes.data);
        }

        if (!salesRes.error && salesRes.data) {
          setSales(salesRes.data);
        }

        if (!customersRes.error && customersRes.data) {
          setCustomers(customersRes.data);
        }
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchDashboardData();
  }, []);

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loading size="lg" />
        </div>
      </MainLayout>
    );
  }

  const totalBatches = batches.length;
  const totalSales = sales.length;
  const totalCustomers = customers.length;
  const totalRevenue = sales.reduce((sum, sale) => sum + (sale.final_proceeds || 0), 0);
  const totalWeight = sales.reduce((sum, sale) => sum + (sale.quantity_oz || 0), 0);

  const statusData = [
    { name: 'Shipped', value: batches.filter(b => b.status === 'shipped').length, color: '#3b82f6' },
    { name: 'Airport Received', value: batches.filter(b => b.status === 'airport_received').length, color: '#f59e0b' },
    { name: 'Refinery Received', value: batches.filter(b => b.status === 'refinery_received').length, color: '#8b5cf6' },
    { name: 'Refined', value: batches.filter(b => b.status === 'refined').length, color: '#10b981' },
    { name: 'Sold', value: batches.filter(b => b.status === 'sold').length, color: '#059669' },
  ].filter(item => item.value > 0);

  const segmentSales = customers.reduce((acc, customer) => {
    const customerSales = sales.filter(s => s.customer_id === customer.id);
    const revenue = customerSales.reduce((sum, sale) => sum + (sale.final_proceeds || 0), 0);

    if (revenue > 0) {
      const segment = customer.segment || 'Other';
      const existing = acc.find(item => item.segment === segment);
      if (existing) {
        existing.revenue += revenue;
      } else {
        acc.push({ segment, revenue });
      }
    }
    return acc;
  }, [] as { segment: string; revenue: number }[]);

  const salesTrend = sales.slice(0, 7).reverse().map(sale => ({
    date: new Date(sale.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    revenue: sale.final_proceeds || 0,
  }));

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600 mt-1">Overview of gold sales operations</p>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <div className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Revenue</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">
                    ${totalRevenue > 0 ? (totalRevenue / 1000).toFixed(0) + 'K' : '0'}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">From {totalSales} sales</p>
                </div>
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <DollarSign className="w-6 h-6 text-green-600" />
                </div>
              </div>
            </div>
          </Card>

          <GoldPriceLive />

          <Card>
            <div className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Active Batches</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{totalBatches}</p>
                  <p className="text-xs text-gray-500 mt-1">{totalWeight.toFixed(1)} oz total</p>
                </div>
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Package className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </div>
          </Card>

          <Card>
            <div className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Customers</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{totalCustomers}</p>
                  <p className="text-xs text-gray-500 mt-1">{totalSales} sales completed</p>
                </div>
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                  <Users className="w-6 h-6 text-purple-600" />
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Sales Trend */}
          <Card>
            <div className="p-6">
              <h3 className="text-lg font-semibold mb-4">Recent Sales Trend</h3>
              {salesTrend.length > 0 ? (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={salesTrend}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip formatter={(value: number) => [`$${value.toLocaleString()}`, 'Revenue']} />
                      <Bar dataKey="revenue" fill="#f59e0b" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-64 flex items-center justify-center text-gray-500">
                  No sales data available
                </div>
              )}
            </div>
          </Card>

          {/* Batch Status Distribution */}
          <Card>
            <div className="p-6">
              <h3 className="text-lg font-semibold mb-4">Batch Status Distribution</h3>
              {statusData.length > 0 ? (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={statusData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {statusData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-64 flex items-center justify-center text-gray-500">
                  No batch data available
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* Revenue by Customer Segment */}
        <Card>
          <div className="p-6">
            <h3 className="text-lg font-semibold mb-4">Revenue by Customer Segment</h3>
            {segmentSales.length > 0 ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={segmentSales} layout="horizontal">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="category" dataKey="segment" />
                    <YAxis type="number" />
                    <Tooltip formatter={(value: number) => [`$${value.toLocaleString()}`, 'Revenue']} />
                    <Legend />
                    <Bar dataKey="revenue" fill="#8b5cf6" name="Revenue (USD)" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-gray-500">
                No revenue data available
              </div>
            )}
          </div>
        </Card>

        {/* Recent Activity */}
        <Card>
          <div className="p-6">
            <h3 className="text-lg font-semibold mb-4">Recent Sales Activity</h3>
            {sales.length > 0 ? (
              <div className="space-y-3">
                {sales.slice(0, 5).map(sale => {
                  const customer = customers.find(c => c.id === sale.customer_id);
                  return (
                    <div key={sale.id} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                          <ShoppingCart className="w-5 h-5 text-amber-600" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{customer?.name || 'Unknown Customer'}</p>
                          <p className="text-sm text-gray-500">
                            {sale.quantity_oz.toFixed(2)} oz @ ${sale.london_am_rate.toFixed(2)}/oz
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-gray-900">${sale.final_proceeds.toLocaleString()}</p>
                        <p className="text-xs text-gray-500">{new Date(sale.created_at).toLocaleDateString()}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-8 text-center text-gray-500">
                No recent sales activity
              </div>
            )}
          </div>
        </Card>
      </div>
    </MainLayout>
  );
}
