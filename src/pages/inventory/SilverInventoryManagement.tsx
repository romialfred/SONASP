import { useNavigate } from 'react-router-dom';
import { Package, ArrowLeft, Construction, Sparkles } from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card } from '@/components/ui/Card';
import Button from '@/components/ui/Button';

export function SilverInventoryManagement() {
  const navigate = useNavigate();

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate('/inventory')} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>

          <div className="flex-1">
            <h1 className="font-heading text-3xl font-bold text-gray-900 flex items-center gap-3">
              <Sparkles className="h-8 w-8 text-gray-400" />
              Silver Inventory Management
            </h1>
            <p className="text-gray-600 mt-1">
              Track and manage pure silver inventory
            </p>
          </div>
        </div>

        <Card className="border-2 border-gray-200">
          <div className="py-16 px-6">
            <div className="text-center max-w-md mx-auto">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full mb-6">
                <Construction className="w-10 h-10 text-gray-500" />
              </div>

              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                Coming Soon
              </h2>

              <p className="text-gray-600 mb-6">
                Silver Inventory Management is currently under development. This module will provide
                the same comprehensive inventory tracking and management features as Gold Inventory,
                specifically tailored for silver operations.
              </p>

              <div className="bg-gradient-to-br from-gray-50 to-slate-50 border border-gray-200 rounded-lg p-4 text-left">
                <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-gray-500" />
                  Planned Features
                </h3>
                <ul className="space-y-2 text-sm text-gray-700">
                  <li className="flex items-start gap-2">
                    <Package className="w-4 h-4 mt-0.5 flex-shrink-0 text-gray-500" />
                    <span>Track silver refining from batches to pure inventory</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Package className="w-4 h-4 mt-0.5 flex-shrink-0 text-gray-500" />
                    <span>Automatic calculations for fineness and final fine weight</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Package className="w-4 h-4 mt-0.5 flex-shrink-0 text-gray-500" />
                    <span>Stock allocation and sales integration (FIFO)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Package className="w-4 h-4 mt-0.5 flex-shrink-0 text-gray-500" />
                    <span>Monthly consolidation and reporting</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Package className="w-4 h-4 mt-0.5 flex-shrink-0 text-gray-500" />
                    <span>Complete audit trail and transaction history</span>
                  </li>
                </ul>
              </div>

              <div className="mt-8 flex gap-3 justify-center">
                <Button variant="primary" onClick={() => navigate('/inventory')}>
                  View Gold Inventory
                </Button>
                <Button variant="outline" onClick={() => navigate('/dashboard')}>
                  Go to Dashboard
                </Button>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </MainLayout>
  );
}
