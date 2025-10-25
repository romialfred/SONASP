import { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Search, Download, Mail, MapPin } from 'lucide-react';
import { demoCustomers, type Customer } from '@/lib/demoSeed';

export function CustomersPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [segmentFilter, setSegmentFilter] = useState<string>('all');

  const filteredCustomers = demoCustomers.filter((customer) => {
    const matchesSearch =
      customer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      customer.country.toLowerCase().includes(searchQuery.toLowerCase()) ||
      customer.contact_email.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesSegment = segmentFilter === 'all' || customer.segment === segmentFilter;

    return matchesSearch && matchesSegment;
  });

  const getSegmentColor = (segment: Customer['segment']) => {
    switch (segment) {
      case 'Jeweler':
        return 'bg-purple-100 text-purple-800';
      case 'Trader':
        return 'bg-blue-100 text-blue-800';
      case 'Bank':
        return 'bg-green-100 text-green-800';
      case 'Industrial':
        return 'bg-orange-100 text-orange-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Customers</h1>
            <p className="text-gray-600 mt-1">Manage customer relationships and contacts</p>
          </div>
          <button className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg flex items-center gap-2">
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>

        <Card>
          <div className="p-6 space-y-4">
            <div className="flex gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Search by name, country, or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <select
                value={segmentFilter}
                onChange={(e) => setSegmentFilter(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
              >
                <option value="all">All Segments</option>
                <option value="Jeweler">Jeweler</option>
                <option value="Trader">Trader</option>
                <option value="Bank">Bank</option>
                <option value="Industrial">Industrial</option>
              </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredCustomers.map((customer) => (
                <div
                  key={customer.customer_id}
                  className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900">{customer.name}</h3>
                      <p className="text-xs text-gray-500 mt-1">{customer.customer_id}</p>
                    </div>
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getSegmentColor(customer.segment)}`}>
                      {customer.segment}
                    </span>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <MapPin className="w-4 h-4" />
                      <span>{customer.country}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Mail className="w-4 h-4" />
                      <span className="truncate">{customer.contact_email}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {filteredCustomers.length === 0 && (
              <div className="text-center py-12">
                <p className="text-gray-500">No customers found matching your criteria.</p>
              </div>
            )}
          </div>
        </Card>
      </div>
    </MainLayout>
  );
}
