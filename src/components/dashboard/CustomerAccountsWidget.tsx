import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DollarSign, TrendingUp, Users, AlertCircle } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Loading } from '@/components/ui/Loading';
import {
  getCustomerAccountsReceivable,
  type CustomerAccountBalance,
} from '@/services/preSalesService';

export function CustomerAccountsWidget() {
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState<CustomerAccountBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalBalance, setTotalBalance] = useState(0);

  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
    setLoading(true);
    try {
      const result = await getCustomerAccountsReceivable();
      if (result.success && result.data) {
        setAccounts(result.data);
        const total = result.data.reduce((sum, acc) => sum + acc.balance, 0);
        setTotalBalance(total);
      }
    } catch (error) {
      console.error('Error loading customer accounts:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  if (loading) {
    return (
      <Card className="p-6">
        <Loading />
      </Card>
    );
  }

  if (accounts.length === 0) {
    return null;
  }

  const topAccounts = accounts.slice(0, 5);

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <DollarSign className="h-5 w-5 text-green-600" />
          <h3 className="text-lg font-semibold text-gray-900">Customer Accounts Receivable</h3>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => navigate('/presales')}
        >
          View All
        </Button>
      </div>

      {/* Total Balance */}
      <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-green-700 font-medium">Total We Owe Customers</p>
            <p className="text-2xl font-bold text-green-900 mt-1">
              {formatCurrency(totalBalance)}
            </p>
          </div>
          <div className="rounded-full bg-green-100 p-3">
            <TrendingUp className="h-6 w-6 text-green-600" />
          </div>
        </div>
        <p className="text-xs text-green-600 mt-2">
          From {accounts.length} customer{accounts.length !== 1 ? 's' : ''} with pre-sales
        </p>
      </div>

      {/* Top Accounts List */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-xs font-medium text-gray-500 uppercase tracking-wider pb-2 border-b">
          <Users className="h-3 w-3" />
          <span>Top Customer Balances</span>
        </div>

        {topAccounts.map((account) => (
          <div
            key={account.customer_id}
            className="flex items-center justify-between py-2 hover:bg-gray-50 rounded px-2 transition-colors cursor-pointer"
            onClick={() => navigate(`/customers/${account.customer_id}`)}
          >
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900">{account.customer_name}</p>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-xs text-gray-500">
                  {account.pending_pre_sales} pending
                </span>
                <span className="text-xs text-gray-400">•</span>
                <span className="text-xs text-gray-500">
                  {account.completed_pre_sales} completed
                </span>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold text-green-600">
                {formatCurrency(account.balance)}
              </p>
              {account.last_transaction_date && (
                <p className="text-xs text-gray-400">
                  {new Date(account.last_transaction_date).toLocaleDateString()}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      {accounts.length > 5 && (
        <div className="mt-4 pt-4 border-t">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => navigate('/presales')}
            className="w-full"
          >
            View All {accounts.length} Accounts
          </Button>
        </div>
      )}

      {/* Info Box */}
      <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-3">
        <div className="flex items-start gap-2">
          <AlertCircle className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-blue-800">
            These amounts represent what we owe customers from pre-sales. Balances will be settled
            when inventory arrives and is converted to regular sales.
          </p>
        </div>
      </div>
    </Card>
  );
}
