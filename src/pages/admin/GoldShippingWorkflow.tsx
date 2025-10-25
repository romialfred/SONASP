import React, { useState } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';

type WorkflowTab = 'batches' | 'sales' | 'all';

interface WorkflowStep {
  id: string;
  name: string;
  type: 'start' | 'activity' | 'gateway' | 'end';
  activity?: string;
  validation?: string[];
  actor?: string;
  conditions?: string[];
}

const batchWorkflowSteps: WorkflowStep[] = [
  {
    id: 'start',
    name: 'Start',
    type: 'start',
    activity: 'Batch creation initiated',
    actor: 'Factory User'
  },
  {
    id: 'create_batch',
    name: 'Create Batch',
    type: 'activity',
    activity: 'Register new batch with shipping details',
    validation: [
      'Shipping date is required',
      'Weight in grams must be > 0',
      'Site selection is required',
      'Batch number auto-generated'
    ],
    actor: 'Factory User'
  },
  {
    id: 'ship_batch',
    name: 'Ship from Mine',
    type: 'activity',
    activity: 'Batch shipped to airport',
    validation: [
      'Transport company assigned',
      'Expected arrival date set',
      'Shipping documents attached'
    ],
    actor: 'Factory User'
  },
  {
    id: 'airport_receive',
    name: 'Airport Receipt',
    type: 'activity',
    activity: 'Confirm receipt at airport',
    validation: [
      'Actual weight recorded',
      'Variance calculated automatically',
      'Receipt timestamp captured'
    ],
    actor: 'Airport User'
  },
  {
    id: 'variance_check',
    name: 'Variance Check',
    type: 'gateway',
    activity: 'Check if variance exceeds threshold',
    conditions: [
      'If variance ≤ threshold: Proceed to confirm',
      'If variance > threshold: Require reconciliation'
    ],
    actor: 'System'
  },
  {
    id: 'reconciliation',
    name: 'Reconciliation',
    type: 'activity',
    activity: 'Document and justify variance',
    validation: [
      'Justification provided',
      'Supporting documents uploaded',
      'Supervisor approval required'
    ],
    actor: 'Airport Supervisor'
  },
  {
    id: 'ship_to_refinery',
    name: 'Ship to Refinery',
    type: 'activity',
    activity: 'Transport to refinery',
    validation: [
      'Transport company assigned',
      'Expected arrival date set'
    ],
    actor: 'Airport User'
  },
  {
    id: 'refinery_receive',
    name: 'Refinery Receipt',
    type: 'activity',
    activity: 'Confirm receipt at refinery',
    validation: [
      'Actual weight recorded',
      'Variance calculated',
      'Receipt confirmed'
    ],
    actor: 'Refinery User'
  },
  {
    id: 'pre_melting',
    name: 'Pre-Melting Weight',
    type: 'activity',
    activity: 'Record pre-melting weight',
    validation: [
      'Weight in grams recorded',
      'Quality inspection done'
    ],
    actor: 'Refinery User'
  },
  {
    id: 'melting_process',
    name: 'Melting Process',
    type: 'activity',
    activity: 'Process batch through melting',
    validation: [
      'Temperature logs maintained',
      'Process time recorded'
    ],
    actor: 'Refinery User'
  },
  {
    id: 'post_melting',
    name: 'Post-Melting Analysis',
    type: 'activity',
    activity: 'Record final measurements',
    validation: [
      'Post-melting weight recorded',
      'Fineness percentage determined',
      'Metal retention calculated',
      'Final fine calculated automatically'
    ],
    actor: 'Refinery User'
  },
  {
    id: 'quality_approval',
    name: 'Quality Approval',
    type: 'activity',
    activity: 'Approve processed metal for sale',
    validation: [
      'Quality standards met',
      'Documentation complete',
      'Supervisor approval'
    ],
    actor: 'Refinery Supervisor'
  },
  {
    id: 'ready_for_sale',
    name: 'Ready for Sale',
    type: 'end',
    activity: 'Batch available for sales',
    actor: 'System'
  }
];

const salesWorkflowSteps: WorkflowStep[] = [
  {
    id: 'start',
    name: 'Start',
    type: 'start',
    activity: 'Sales process initiated',
    actor: 'Sales User'
  },
  {
    id: 'check_inventory',
    name: 'Check Inventory',
    type: 'activity',
    activity: 'Review available processed batches',
    validation: [
      'Available balance > 0',
      'Quality approved batches only'
    ],
    actor: 'Sales User'
  },
  {
    id: 'create_sale',
    name: 'Create Sale',
    type: 'activity',
    activity: 'Prepare sale details',
    validation: [
      'Customer selected from approved list',
      'Quantity ≤ available balance',
      'London AM rate entered',
      'Freight and costs specified',
      'All calculations auto-computed'
    ],
    actor: 'Sales User'
  },
  {
    id: 'calculate_proceeds',
    name: 'Calculate Proceeds',
    type: 'activity',
    activity: 'Automatic financial calculations',
    validation: [
      'Gross proceeds = Quantity × Price',
      'Net proceeds = Gross - Freight - Costs',
      'Net smelted royalties (3%) calculated',
      'Final amount determined'
    ],
    actor: 'System'
  },
  {
    id: 'multi_customer_check',
    name: 'Multi-Customer?',
    type: 'gateway',
    activity: 'Check if selling to multiple customers',
    conditions: [
      'If 100% to single customer: Proceed',
      'If partial sale: Add more customers'
    ],
    actor: 'System'
  },
  {
    id: 'management_review',
    name: 'Management Review',
    type: 'activity',
    activity: 'Management approval required',
    validation: [
      'Sale details reviewed',
      'Pricing verified',
      'Customer credit checked'
    ],
    actor: 'Management'
  },
  {
    id: 'management_decision',
    name: 'Management Decision',
    type: 'gateway',
    activity: 'Approve or reject sale',
    conditions: [
      'If approved: Notify customer',
      'If rejected: Return to sales with notes'
    ],
    actor: 'Management'
  },
  {
    id: 'customer_notification',
    name: 'Customer Notification',
    type: 'activity',
    activity: 'Email sale details to customer',
    validation: [
      'Email includes all sale details',
      'Approve/Reject links provided',
      'Expiration date set'
    ],
    actor: 'System'
  },
  {
    id: 'customer_decision',
    name: 'Customer Decision',
    type: 'gateway',
    activity: 'Customer approves or rejects',
    conditions: [
      'If approved: Proceed to payment',
      'If rejected: Return to sales for renegotiation',
      'If expired: Sale cancelled'
    ],
    actor: 'Customer'
  },
  {
    id: 'payment_form',
    name: 'Payment Details',
    type: 'activity',
    activity: 'Customer submits payment information',
    validation: [
      'Expected payment date provided',
      'Amount and currency confirmed',
      'Bank information complete',
      'FX rate recorded',
      'Payment proof uploaded'
    ],
    actor: 'Customer'
  },
  {
    id: 'payment_verification',
    name: 'Payment Verification',
    type: 'activity',
    activity: 'Verify payment received',
    validation: [
      'Payment proof reviewed',
      'Bank confirmation received',
      'Amount matches invoice',
      'FX rate validated'
    ],
    actor: 'Finance Team'
  },
  {
    id: 'final_approval',
    name: 'Final Approval',
    type: 'activity',
    activity: 'Management approves payment',
    validation: [
      'Payment verified',
      'Documentation complete'
    ],
    actor: 'Management'
  },
  {
    id: 'complete_sale',
    name: 'Complete Sale',
    type: 'end',
    activity: 'Sale closed successfully',
    actor: 'System'
  }
];

const allProcessSteps: WorkflowStep[] = [
  {
    id: 'start',
    name: 'Start',
    type: 'start',
    activity: 'Mine extraction complete',
    actor: 'Mining Team'
  },
  ...batchWorkflowSteps.slice(1, -1),
  {
    id: 'transition',
    name: 'Transition to Sales',
    type: 'gateway',
    activity: 'Batch ready for sale',
    conditions: [
      'Quality approved',
      'Available in inventory'
    ],
    actor: 'System'
  },
  ...salesWorkflowSteps.slice(1),
];

export function GoldShippingWorkflow() {
  const [activeTab, setActiveTab] = useState<WorkflowTab>('batches');
  const [selectedStep, setSelectedStep] = useState<WorkflowStep | null>(null);

  const getStepsForTab = (tab: WorkflowTab): WorkflowStep[] => {
    switch (tab) {
      case 'batches':
        return batchWorkflowSteps;
      case 'sales':
        return salesWorkflowSteps;
      case 'all':
        return allProcessSteps;
      default:
        return [];
    }
  };

  const currentSteps = getStepsForTab(activeTab);

  const getStepColor = (type: string) => {
    switch (type) {
      case 'start':
        return 'bg-green-100 border-green-500';
      case 'activity':
        return 'bg-blue-100 border-blue-500';
      case 'gateway':
        return 'bg-yellow-100 border-yellow-500';
      case 'end':
        return 'bg-red-100 border-red-500';
      default:
        return 'bg-gray-100 border-gray-500';
    }
  };

  const getStepIcon = (type: string) => {
    switch (type) {
      case 'start':
        return '●';
      case 'activity':
        return '▭';
      case 'gateway':
        return '◆';
      case 'end':
        return '◉';
      default:
        return '○';
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Gold Shipping Workflow</h1>
          <p className="text-gray-600 mt-2">
            Complete BPMN workflow diagrams for batch management and sales processes
          </p>
        </div>
      </div>

      <div className="flex gap-2 border-b border-gray-200">
        <Button
          variant={activeTab === 'batches' ? 'primary' : 'secondary'}
          onClick={() => {
            setActiveTab('batches');
            setSelectedStep(null);
          }}
          className="rounded-b-none"
        >
          Batch Management
        </Button>
        <Button
          variant={activeTab === 'sales' ? 'primary' : 'secondary'}
          onClick={() => {
            setActiveTab('sales');
            setSelectedStep(null);
          }}
          className="rounded-b-none"
        >
          Gold Sales
        </Button>
        <Button
          variant={activeTab === 'all' ? 'primary' : 'secondary'}
          onClick={() => {
            setActiveTab('all');
            setSelectedStep(null);
          }}
          className="rounded-b-none"
        >
          All Processes
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card>
            <div className="p-6">
              <h2 className="text-xl font-semibold mb-4">
                {activeTab === 'batches' && 'Batch Management Workflow'}
                {activeTab === 'sales' && 'Sales Management Workflow'}
                {activeTab === 'all' && 'Complete End-to-End Workflow'}
              </h2>

              <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                <h3 className="font-semibold mb-2">Legend</h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl text-green-600">●</span>
                    <span>Start Event</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl text-blue-600">▭</span>
                    <span>Activity/Task</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl text-yellow-600">◆</span>
                    <span>Decision Gateway</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl text-red-600">◉</span>
                    <span>End Event</span>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                {currentSteps.map((step, index) => (
                  <div key={step.id}>
                    <button
                      onClick={() => setSelectedStep(step)}
                      className={`w-full text-left p-4 rounded-lg border-2 transition-all ${getStepColor(
                        step.type
                      )} ${
                        selectedStep?.id === step.id
                          ? 'ring-2 ring-offset-2 ring-blue-500'
                          : 'hover:shadow-md'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-3xl">{getStepIcon(step.type)}</span>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <h3 className="font-semibold">{step.name}</h3>
                            {step.actor && (
                              <span className="text-sm px-2 py-1 bg-white bg-opacity-70 rounded">
                                {step.actor}
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-700 mt-1">{step.activity}</p>
                        </div>
                      </div>
                    </button>
                    {index < currentSteps.length - 1 && (
                      <div className="flex justify-center py-1">
                        <div className="text-2xl text-gray-400">↓</div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>

        <div className="lg:col-span-1">
          <Card>
            <div className="p-6">
              <h2 className="text-xl font-semibold mb-4">Step Details</h2>

              {selectedStep ? (
                <div className="space-y-4">
                  <div>
                    <h3 className="font-semibold text-lg mb-2">{selectedStep.name}</h3>
                    <div className="flex items-center gap-2 mb-3">
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                        selectedStep.type === 'start' ? 'bg-green-100 text-green-800' :
                        selectedStep.type === 'activity' ? 'bg-blue-100 text-blue-800' :
                        selectedStep.type === 'gateway' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {selectedStep.type.charAt(0).toUpperCase() + selectedStep.type.slice(1)}
                      </span>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold text-sm text-gray-700 mb-2">Activity</h4>
                    <p className="text-sm text-gray-600">{selectedStep.activity}</p>
                  </div>

                  {selectedStep.validation && selectedStep.validation.length > 0 && (
                    <div>
                      <h4 className="font-semibold text-sm text-gray-700 mb-2">Validation Rules</h4>
                      <ul className="space-y-1">
                        {selectedStep.validation.map((rule, idx) => (
                          <li key={idx} className="text-sm text-gray-600 flex items-start gap-2">
                            <span className="text-green-600 mt-0.5">✓</span>
                            <span>{rule}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {selectedStep.conditions && selectedStep.conditions.length > 0 && (
                    <div>
                      <h4 className="font-semibold text-sm text-gray-700 mb-2">Conditions</h4>
                      <ul className="space-y-1">
                        {selectedStep.conditions.map((condition, idx) => (
                          <li key={idx} className="text-sm text-gray-600 flex items-start gap-2">
                            <span className="text-yellow-600 mt-0.5">▸</span>
                            <span>{condition}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {selectedStep.actor && (
                    <div>
                      <h4 className="font-semibold text-sm text-gray-700 mb-2">Actor/Responsible</h4>
                      <p className="text-sm px-3 py-2 bg-gray-50 rounded font-medium">
                        {selectedStep.actor}
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <p className="text-sm">Select a step from the workflow to view details</p>
                </div>
              )}
            </div>
          </Card>

          <Card className="mt-6">
            <div className="p-6">
              <h2 className="text-xl font-semibold mb-4">Process Summary</h2>
              <div className="space-y-3 text-sm">
                <div>
                  <span className="font-semibold">Total Steps:</span>
                  <span className="ml-2">{currentSteps.length}</span>
                </div>
                <div>
                  <span className="font-semibold">Activities:</span>
                  <span className="ml-2">
                    {currentSteps.filter((s) => s.type === 'activity').length}
                  </span>
                </div>
                <div>
                  <span className="font-semibold">Decision Points:</span>
                  <span className="ml-2">
                    {currentSteps.filter((s) => s.type === 'gateway').length}
                  </span>
                </div>
                <div>
                  <span className="font-semibold">Key Actors:</span>
                  <div className="mt-2 space-y-1">
                    {Array.from(new Set(currentSteps.map((s) => s.actor).filter(Boolean))).map(
                      (actor) => (
                        <div key={actor} className="px-2 py-1 bg-gray-50 rounded text-xs">
                          {actor}
                        </div>
                      )
                    )}
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
