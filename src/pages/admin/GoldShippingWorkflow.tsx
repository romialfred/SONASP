import React, { useState } from 'react';
import { MainLayout } from '../../components/layout/MainLayout';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Download, ZoomIn, ZoomOut } from 'lucide-react';

type WorkflowView = 'batch-management' | 'sales-process' | 'depositing-process' | 'combined';

interface BPMNElement {
  id: string;
  type: 'start-event' | 'end-event' | 'task' | 'gateway' | 'intermediate-event' | 'data-object';
  name: string;
  x: number;
  y: number;
  lane: string;
  description?: string;
  validations?: string[];
  outputs?: string[];
}

interface BPMNFlow {
  id: string;
  from: string;
  to: string;
  label?: string;
  type: 'sequence' | 'message';
}

interface BPMNLane {
  id: string;
  name: string;
  color: string;
  y: number;
  height: number;
}

// BPMN Batch Management Process
const batchLanes: BPMNLane[] = [
  { id: 'factory', name: 'Factory (Mine)', color: '#34d399', y: 0, height: 150 },
  { id: 'airport', name: 'Airport Receiving', color: '#60a5fa', y: 150, height: 200 },
  { id: 'refinery', name: 'Refinery Processing', color: '#a78bfa', y: 350, height: 200 },
  { id: 'quality', name: 'Quality & Approval', color: '#f472b6', y: 550, height: 150 },
];

const batchElements: BPMNElement[] = [
  // Factory Lane
  { id: 'start', type: 'start-event', name: 'Start', x: 50, y: 75, lane: 'factory' },
  { id: 'fill_batch', type: 'task', name: 'Fill in\nBatch Details', x: 150, y: 50, lane: 'factory',
    description: 'Create new batch with shipping details',
    validations: ['Date required', 'Weight > 0 grams', 'Site selected', 'Auto-generate batch number']
  },
  { id: 'validate_batch', type: 'task', name: 'Validate\nBatch Data', x: 300, y: 50, lane: 'factory',
    validations: ['Required fields complete', 'Weight within limits', 'Transport assigned']
  },
  { id: 'batch_valid', type: 'gateway', name: 'Is batch\nvalid?', x: 450, y: 60, lane: 'factory' },
  { id: 'ship_to_airport', type: 'task', name: 'Ship to\nAirport', x: 600, y: 50, lane: 'factory',
    validations: ['Transport company', 'Expected arrival date', 'Documents attached']
  },

  // Airport Lane
  { id: 'receive_airport', type: 'task', name: 'Receive at\nAirport', x: 150, y: 200, lane: 'airport',
    description: 'Confirm receipt and record actual weight',
    validations: ['Physical inspection', 'Weight recorded', 'Condition assessed']
  },
  { id: 'check_weight', type: 'task', name: 'Check and\nCorrect Weight', x: 300, y: 200, lane: 'airport',
    validations: ['Compare expected vs actual', 'Calculate variance %']
  },
  { id: 'weight_correct', type: 'gateway', name: 'Is weight\nvariance OK?', x: 450, y: 210, lane: 'airport' },
  { id: 'categorize_hours', type: 'task', name: 'Categorize\nShipment Data', x: 300, y: 300, lane: 'airport',
    description: 'Compile shipment information'
  },
  { id: 'validate_consolidated', type: 'task', name: 'Validate\nConsolidated Data', x: 450, y: 300, lane: 'airport',
    validations: ['All weights reconciled', 'Documents complete']
  },
  { id: 'data_valid', type: 'gateway', name: 'Is data\nvalid?', x: 600, y: 210, lane: 'airport' },
  { id: 'ship_to_refinery', type: 'task', name: 'Ship to\nRefinery', x: 750, y: 200, lane: 'airport',
    outputs: ['Shipping manifest', 'Weight certificate']
  },

  // Refinery Lane
  { id: 'receive_refinery', type: 'task', name: 'Receive at\nRefinery', x: 150, y: 420, lane: 'refinery',
    validations: ['Verify seals', 'Record weight', 'Quality check']
  },
  { id: 'pre_melting', type: 'task', name: 'Pre-Melting\nWeight', x: 300, y: 420, lane: 'refinery',
    validations: ['Calibrated scale', 'Quality inspection']
  },
  { id: 'melting', type: 'intermediate-event', name: 'Melting\nProcess', x: 450, y: 430, lane: 'refinery',
    description: 'Database computation for metal retention'
  },
  { id: 'post_melting', type: 'task', name: 'Post-Melting\nAnalysis', x: 600, y: 420, lane: 'refinery',
    validations: ['Weight recorded', 'Fineness %', 'Metal retention %', 'Final fine calculated']
  },
  { id: 'melting_valid', type: 'gateway', name: 'Are results\nvalid?', x: 750, y: 430, lane: 'refinery' },

  // Quality Lane
  { id: 'quality_check', type: 'task', name: 'Quality\nApproval', x: 300, y: 600, lane: 'quality',
    description: 'Supervisor validates twice',
    validations: ['HR Superintendent approval', 'HR Manager approval', 'Quality standards met']
  },
  { id: 'quality_valid', type: 'gateway', name: 'Quality\napproved?', x: 500, y: 610, lane: 'quality' },
  { id: 'ready_sale', type: 'task', name: 'Transfer to\nSales Inventory', x: 700, y: 600, lane: 'quality',
    outputs: ['Quality certificate', 'Final weight certificate', 'Metal composition report']
  },
  { id: 'end', type: 'end-event', name: 'End', x: 900, y: 625, lane: 'quality' },
];

const batchFlows: BPMNFlow[] = [
  { id: 'f1', from: 'start', to: 'fill_batch', type: 'sequence' },
  { id: 'f2', from: 'fill_batch', to: 'validate_batch', type: 'sequence' },
  { id: 'f3', from: 'validate_batch', to: 'batch_valid', type: 'sequence' },
  { id: 'f4', from: 'batch_valid', to: 'ship_to_airport', label: 'Yes', type: 'sequence' },
  { id: 'f5', from: 'batch_valid', to: 'fill_batch', label: 'No', type: 'sequence' },
  { id: 'f6', from: 'ship_to_airport', to: 'receive_airport', type: 'message' },
  { id: 'f7', from: 'receive_airport', to: 'check_weight', type: 'sequence' },
  { id: 'f8', from: 'check_weight', to: 'weight_correct', type: 'sequence' },
  { id: 'f9', from: 'weight_correct', to: 'categorize_hours', label: 'Yes', type: 'sequence' },
  { id: 'f10', from: 'weight_correct', to: 'check_weight', label: 'No\n(Reconcile)', type: 'sequence' },
  { id: 'f11', from: 'categorize_hours', to: 'validate_consolidated', type: 'sequence' },
  { id: 'f12', from: 'validate_consolidated', to: 'data_valid', type: 'sequence' },
  { id: 'f13', from: 'data_valid', to: 'ship_to_refinery', label: 'Yes', type: 'sequence' },
  { id: 'f14', from: 'data_valid', to: 'categorize_hours', label: 'No', type: 'sequence' },
  { id: 'f15', from: 'ship_to_refinery', to: 'receive_refinery', type: 'message' },
  { id: 'f16', from: 'receive_refinery', to: 'pre_melting', type: 'sequence' },
  { id: 'f17', from: 'pre_melting', to: 'melting', type: 'sequence' },
  { id: 'f18', from: 'melting', to: 'post_melting', type: 'sequence' },
  { id: 'f19', from: 'post_melting', to: 'melting_valid', type: 'sequence' },
  { id: 'f20', from: 'melting_valid', to: 'quality_check', label: 'Yes', type: 'sequence' },
  { id: 'f21', from: 'melting_valid', to: 'pre_melting', label: 'No', type: 'sequence' },
  { id: 'f22', from: 'quality_check', to: 'quality_valid', type: 'sequence' },
  { id: 'f23', from: 'quality_valid', to: 'ready_sale', label: 'Yes', type: 'sequence' },
  { id: 'f24', from: 'quality_valid', to: 'quality_check', label: 'No', type: 'sequence' },
  { id: 'f25', from: 'ready_sale', to: 'end', type: 'sequence' },
];

// BPMN Sales Process
const salesLanes: BPMNLane[] = [
  { id: 'sales', name: 'Sales Department', color: '#fbbf24', y: 0, height: 150 },
  { id: 'management', name: 'Management Approval', color: '#f97316', y: 150, height: 150 },
  { id: 'customer', name: 'Customer', color: '#8b5cf6', y: 300, height: 150 },
  { id: 'finance', name: 'Finance Department', color: '#10b981', y: 450, height: 200 },
];

const salesElements: BPMNElement[] = [
  // Sales Lane
  { id: 's_start', type: 'start-event', name: 'Start', x: 50, y: 75, lane: 'sales' },
  { id: 's_check_inventory', type: 'task', name: 'Check Available\nInventory', x: 150, y: 50, lane: 'sales',
    validations: ['Available balance > 0', 'Quality approved only']
  },
  { id: 's_create_sale', type: 'task', name: 'Create Sale\nOrder', x: 300, y: 50, lane: 'sales',
    validations: ['Customer selected', 'Quantity ≤ balance', 'London AM rate', 'Costs entered']
  },
  { id: 's_calculate', type: 'intermediate-event', name: 'Calculate\nProceeds', x: 450, y: 60, lane: 'sales',
    description: 'Auto-compute gross/net proceeds, royalties'
  },
  { id: 's_multi_customer', type: 'gateway', name: 'Multiple\ncustomers?', x: 600, y: 60, lane: 'sales' },

  // Management Lane
  { id: 'm_review', type: 'task', name: 'Management\nReview', x: 150, y: 200, lane: 'management',
    description: 'Validate pricing and terms',
    validations: ['Price verified', 'Credit check', 'Terms acceptable']
  },
  { id: 'm_decision', type: 'gateway', name: 'Approved?', x: 350, y: 210, lane: 'management' },
  { id: 'm_notify', type: 'task', name: 'Notify\nCustomer', x: 550, y: 200, lane: 'management',
    outputs: ['Email with sale details', 'Approve/Reject links']
  },

  // Customer Lane
  { id: 'c_receive', type: 'task', name: 'Receive Sale\nNotification', x: 150, y: 350, lane: 'customer' },
  { id: 'c_decision', type: 'gateway', name: 'Customer\napproves?', x: 350, y: 360, lane: 'customer' },
  { id: 'c_payment', type: 'task', name: 'Submit Payment\nDetails', x: 550, y: 350, lane: 'customer',
    validations: ['Payment date', 'Amount', 'Bank info', 'FX rate', 'Proof uploaded']
  },

  // Finance Lane
  { id: 'f_receive', type: 'task', name: 'Receive Payment\nData', x: 150, y: 520, lane: 'finance' },
  { id: 'f_process', type: 'task', name: 'Process\nPayment', x: 300, y: 520, lane: 'finance',
    validations: ['Bank confirmation', 'Amount verified']
  },
  { id: 'f_validate', type: 'task', name: 'Validate Payment\n(Bank Wire)', x: 450, y: 520, lane: 'finance',
    description: 'Validation performed twice'
  },
  { id: 'f_payment_valid', type: 'gateway', name: 'Payment\nvalid?', x: 650, y: 530, lane: 'finance' },
  { id: 'f_complete', type: 'task', name: 'Complete Sale\nTransaction', x: 800, y: 520, lane: 'finance',
    outputs: ['Payment confirmation', 'Invoice', 'Completion certificate']
  },
  { id: 's_end', type: 'end-event', name: 'End', x: 950, y: 545, lane: 'finance' },
];

const salesFlows: BPMNFlow[] = [
  { id: 'sf1', from: 's_start', to: 's_check_inventory', type: 'sequence' },
  { id: 'sf2', from: 's_check_inventory', to: 's_create_sale', type: 'sequence' },
  { id: 'sf3', from: 's_create_sale', to: 's_calculate', type: 'sequence' },
  { id: 'sf4', from: 's_calculate', to: 's_multi_customer', type: 'sequence' },
  { id: 'sf5', from: 's_multi_customer', to: 'm_review', label: 'Single/Complete', type: 'sequence' },
  { id: 'sf6', from: 's_multi_customer', to: 's_create_sale', label: 'Add Customer', type: 'sequence' },
  { id: 'sf7', from: 'm_review', to: 'm_decision', type: 'sequence' },
  { id: 'sf8', from: 'm_decision', to: 'm_notify', label: 'Yes', type: 'sequence' },
  { id: 'sf9', from: 'm_decision', to: 's_create_sale', label: 'No', type: 'message' },
  { id: 'sf10', from: 'm_notify', to: 'c_receive', type: 'message' },
  { id: 'sf11', from: 'c_receive', to: 'c_decision', type: 'sequence' },
  { id: 'sf12', from: 'c_decision', to: 'c_payment', label: 'Approve', type: 'sequence' },
  { id: 'sf13', from: 'c_decision', to: 'm_review', label: 'Reject', type: 'message' },
  { id: 'sf14', from: 'c_payment', to: 'f_receive', type: 'message' },
  { id: 'sf15', from: 'f_receive', to: 'f_process', type: 'sequence' },
  { id: 'sf16', from: 'f_process', to: 'f_validate', type: 'sequence' },
  { id: 'sf17', from: 'f_validate', to: 'f_payment_valid', type: 'sequence' },
  { id: 'sf18', from: 'f_payment_valid', to: 'f_complete', label: 'Yes', type: 'sequence' },
  { id: 'sf19', from: 'f_payment_valid', to: 'f_validate', label: 'No', type: 'sequence' },
  { id: 'sf20', from: 'f_complete', to: 's_end', type: 'sequence' },
];

// BPMN Depositing Process (High Level)
const depositingLanes: BPMNLane[] = [
  { id: 'receipt', name: 'Receipt & Weighing', color: '#a78bfa', y: 0, height: 200 },
  { id: 'melt_sample', name: 'Melt & Sample', color: '#34d399', y: 200, height: 180 },
  { id: 'evaluate', name: 'Evaluate', color: '#60a5fa', y: 380, height: 180 },
];

const depositingElements: BPMNElement[] = [
  // Receipt & Weighing Lane
  { id: 'd_start', type: 'start-event', name: 'Doré From Depositor', x: 50, y: 100, lane: 'receipt',
    description: 'With Waybill and Mine Weight or Depositor Wet Weigh'
  },
  { id: 'd_packaging', type: 'task', name: 'Packaging\nInspected', x: 180, y: 80, lane: 'receipt',
    validations: ['Visual inspection', 'Seal check', 'Documentation verified']
  },
  { id: 'd_gross_mass', type: 'task', name: 'Gross Mass\n& Count Recon\nwith Waybill', x: 330, y: 80, lane: 'receipt',
    validations: ['Weight recorded', 'Count verified', 'Waybill reconciliation']
  },
  { id: 'd_unpack', type: 'task', name: 'Unpack bars\nand Inspection', x: 480, y: 80, lane: 'receipt',
    description: 'Physical inspection of each bar'
  },
  { id: 'd_deposit_num', type: 'task', name: 'Deposit Number\nAssigned', x: 630, y: 80, lane: 'receipt',
    outputs: ['Unique deposit ID', 'Tracking number']
  },
  { id: 'd_barcode', type: 'task', name: 'Bar Code\nLabelling', x: 780, y: 80, lane: 'receipt',
    outputs: ['Individual bar labels', 'Tracking system entry']
  },
  { id: 'd_weighing_1', type: 'task', name: 'Weighing', x: 930, y: 80, lane: 'receipt',
    description: 'RR Wet Weight',
    validations: ['Calibrated scale', 'Recorded weight']
  },
  { id: 'd_driers', type: 'task', name: '2 x conveyor\ndriers at 350°C', x: 930, y: 150, lane: 'receipt',
    description: 'Drying process'
  },
  { id: 'd_weighing_2', type: 'task', name: 'Weighing', x: 780, y: 150, lane: 'receipt',
    description: 'RR Dry Weight',
    validations: ['Post-drying weight', 'Moisture loss calculated']
  },
  { id: 'd_compare', type: 'task', name: 'Mine vs RR\nWet & Dry\nWeight Compare', x: 630, y: 150, lane: 'receipt',
    description: 'Weight discrepancy form',
    validations: ['Variance within tolerance', 'Discrepancy documented']
  },

  // Melt & Sample Lane
  { id: 'd_sample_trigger', type: 'intermediate-event', name: 'Once samples\ntaken\nmaterial released', x: 930, y: 240, lane: 'melt_sample',
    description: 'Drill Sample Results - Mine Assay'
  },
  { id: 'd_melt', type: 'task', name: 'Melt in one lot\nin dedicated\ncrucible', x: 480, y: 270, lane: 'melt_sample',
    validations: ['Temperature controlled', 'Dedicated equipment', 'Safety protocols']
  },
  { id: 'd_samples', type: 'task', name: 'Samples =\nRR, Umpire', x: 630, y: 270, lane: 'melt_sample',
    description: 'Sample collection for analysis'
  },
  { id: 'd_official_weight', type: 'task', name: 'Official Weight =\nSamples +\nIngots', x: 780, y: 270, lane: 'melt_sample',
    validations: ['Combined weight', 'Recorded officially']
  },

  // Evaluate Lane
  { id: 'd_xrf_ag', type: 'task', name: 'XRF for Ag', x: 180, y: 450, lane: 'evaluate',
    description: 'Silver content analysis'
  },
  { id: 'd_fire_assay', type: 'task', name: 'Fire Assay\nfor Au', x: 330, y: 450, lane: 'evaluate',
    description: 'Gold content determination'
  },
  { id: 'd_official_au', type: 'task', name: 'Official Weight x\nFire Assay % =\nOfficial Au Content', x: 480, y: 450, lane: 'evaluate',
    description: 'Calculate final gold content'
  },
  { id: 'd_assay_limits', type: 'task', name: 'Assay Exchange\n& Splitting Limits', x: 630, y: 450, lane: 'evaluate',
    description: 'Assay discrepancy form',
    validations: ['Within acceptable range', 'Documented variances']
  },
  { id: 'd_umpire', type: 'task', name: 'Umpire\nAssay', x: 780, y: 450, lane: 'evaluate',
    description: 'Independent verification'
  },
  { id: 'd_final', type: 'task', name: 'Final Official\nAu Content & To\nBe Accounted for\nAu', x: 930, y: 450, lane: 'evaluate',
    outputs: ['Final gold content', 'Accounting records', 'Quality certificate']
  },
  { id: 'd_end', type: 'end-event', name: 'End', x: 1050, y: 475, lane: 'evaluate',
    description: 'Material released for refining'
  },
];

const depositingFlows: BPMNFlow[] = [
  { id: 'df1', from: 'd_start', to: 'd_packaging', type: 'sequence' },
  { id: 'df2', from: 'd_packaging', to: 'd_gross_mass', type: 'sequence' },
  { id: 'df3', from: 'd_gross_mass', to: 'd_unpack', type: 'sequence' },
  { id: 'df4', from: 'd_unpack', to: 'd_deposit_num', type: 'sequence' },
  { id: 'df5', from: 'd_deposit_num', to: 'd_barcode', type: 'sequence' },
  { id: 'df6', from: 'd_barcode', to: 'd_weighing_1', type: 'sequence' },
  { id: 'df7', from: 'd_weighing_1', to: 'd_driers', type: 'sequence' },
  { id: 'df8', from: 'd_driers', to: 'd_weighing_2', type: 'sequence' },
  { id: 'df9', from: 'd_weighing_2', to: 'd_compare', type: 'sequence' },
  { id: 'df10', from: 'd_compare', to: 'd_melt', type: 'message', label: 'Drill Sample' },
  { id: 'df11', from: 'd_melt', to: 'd_samples', type: 'sequence' },
  { id: 'df12', from: 'd_samples', to: 'd_official_weight', type: 'sequence' },
  { id: 'df13', from: 'd_official_weight', to: 'd_sample_trigger', type: 'sequence' },
  { id: 'df14', from: 'd_sample_trigger', to: 'd_final', type: 'message' },
  { id: 'df15', from: 'd_melt', to: 'd_xrf_ag', type: 'message' },
  { id: 'df16', from: 'd_samples', to: 'd_xrf_ag', type: 'message' },
  { id: 'df17', from: 'd_xrf_ag', to: 'd_fire_assay', type: 'sequence' },
  { id: 'df18', from: 'd_fire_assay', to: 'd_official_au', type: 'sequence' },
  { id: 'df19', from: 'd_official_au', to: 'd_assay_limits', type: 'sequence' },
  { id: 'df20', from: 'd_assay_limits', to: 'd_umpire', type: 'sequence' },
  { id: 'df21', from: 'd_umpire', to: 'd_final', type: 'sequence' },
  { id: 'df22', from: 'd_final', to: 'd_end', type: 'sequence' },
];

export default function GoldShippingWorkflow() {
  const [activeView, setActiveView] = useState<WorkflowView>('batch-management');
  const [selectedElement, setSelectedElement] = useState<BPMNElement | null>(null);
  const [zoom, setZoom] = useState(1);

  const currentLanes = activeView === 'batch-management' ? batchLanes :
                       activeView === 'sales-process' ? salesLanes :
                       activeView === 'depositing-process' ? depositingLanes : batchLanes;
  const currentElements = activeView === 'batch-management' ? batchElements :
                         activeView === 'sales-process' ? salesElements :
                         activeView === 'depositing-process' ? depositingElements : batchElements;
  const currentFlows = activeView === 'batch-management' ? batchFlows :
                      activeView === 'sales-process' ? salesFlows :
                      activeView === 'depositing-process' ? depositingFlows : batchFlows;

  const renderBPMNElement = (element: BPMNElement) => {
    const baseClass = "cursor-pointer transition-all duration-200 hover:opacity-80";
    const isSelected = selectedElement?.id === element.id;
    const selectedClass = isSelected ? "ring-4 ring-amber-500 ring-offset-2" : "";

    switch (element.type) {
      case 'start-event':
        return (
          <g key={element.id} onClick={() => setSelectedElement(element)}>
            <circle
              cx={element.x}
              cy={element.y}
              r="20"
              fill="#10b981"
              stroke="#059669"
              strokeWidth="3"
              className={`${baseClass} ${selectedClass}`}
            />
            <text x={element.x} y={element.y + 35} textAnchor="middle" className="text-xs font-semibold fill-gray-700">
              {element.name}
            </text>
          </g>
        );

      case 'end-event':
        return (
          <g key={element.id} onClick={() => setSelectedElement(element)}>
            <circle
              cx={element.x}
              cy={element.y}
              r="20"
              fill="#ef4444"
              stroke="#dc2626"
              strokeWidth="5"
              className={`${baseClass} ${selectedClass}`}
            />
            <text x={element.x} y={element.y + 35} textAnchor="middle" className="text-xs font-semibold fill-gray-700">
              {element.name}
            </text>
          </g>
        );

      case 'task':
        return (
          <g key={element.id} onClick={() => setSelectedElement(element)}>
            <rect
              x={element.x - 60}
              y={element.y - 30}
              width="120"
              height="60"
              rx="8"
              fill="#3b82f6"
              stroke="#1e40af"
              strokeWidth="2"
              className={`${baseClass} ${selectedClass}`}
            />
            <text
              x={element.x}
              y={element.y}
              textAnchor="middle"
              dominantBaseline="middle"
              className="text-xs font-semibold fill-white pointer-events-none"
            >
              {element.name.split('\n').map((line, i) => (
                <tspan key={i} x={element.x} dy={i === 0 ? 0 : 14}>
                  {line}
                </tspan>
              ))}
            </text>
          </g>
        );

      case 'gateway':
        return (
          <g key={element.id} onClick={() => setSelectedElement(element)}>
            <path
              d={`M ${element.x} ${element.y - 35} L ${element.x + 35} ${element.y} L ${element.x} ${element.y + 35} L ${element.x - 35} ${element.y} Z`}
              fill="#fbbf24"
              stroke="#f59e0b"
              strokeWidth="3"
              className={`${baseClass} ${selectedClass}`}
            />
            <text
              x={element.x}
              y={element.y}
              textAnchor="middle"
              dominantBaseline="middle"
              className="text-xs font-bold fill-gray-800 pointer-events-none"
            >
              {element.name.split('\n').map((line, i) => (
                <tspan key={i} x={element.x} dy={i === 0 ? -5 : 12}>
                  {line}
                </tspan>
              ))}
            </text>
          </g>
        );

      case 'intermediate-event':
        return (
          <g key={element.id} onClick={() => setSelectedElement(element)}>
            <circle
              cx={element.x}
              cy={element.y}
              r="25"
              fill="#f97316"
              stroke="#ea580c"
              strokeWidth="2"
              className={`${baseClass} ${selectedClass}`}
            />
            <circle
              cx={element.x}
              cy={element.y}
              r="20"
              fill="none"
              stroke="#ea580c"
              strokeWidth="2"
            />
            <text
              x={element.x}
              y={element.y}
              textAnchor="middle"
              dominantBaseline="middle"
              className="text-xs font-semibold fill-white pointer-events-none"
            >
              {element.name.split('\n').map((line, i) => (
                <tspan key={i} x={element.x} dy={i === 0 ? -5 : 12}>
                  {line}
                </tspan>
              ))}
            </text>
          </g>
        );

      default:
        return null;
    }
  };

  const renderFlow = (flow: BPMNFlow) => {
    const fromElement = currentElements.find(e => e.id === flow.from);
    const toElement = currentElements.find(e => e.id === flow.to);

    if (!fromElement || !toElement) return null;

    const isMessage = flow.type === 'message';
    const strokeStyle = isMessage ? '5,5' : 'none';
    const color = isMessage ? '#6366f1' : '#374151';

    // Simple straight or curved arrow
    const path = `M ${fromElement.x} ${fromElement.y} L ${toElement.x} ${toElement.y}`;

    return (
      <g key={flow.id}>
        <path
          d={path}
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeDasharray={strokeStyle}
          markerEnd={`url(#arrowhead-${flow.type})`}
        />
        {flow.label && (
          <text
            x={(fromElement.x + toElement.x) / 2}
            y={(fromElement.y + toElement.y) / 2 - 10}
            textAnchor="middle"
            className="text-xs font-semibold fill-gray-700 bg-white px-1"
          >
            {flow.label.split('\n').map((line, i) => (
              <tspan key={i} x={(fromElement.x + toElement.x) / 2} dy={i === 0 ? 0 : 14}>
                {line}
              </tspan>
            ))}
          </text>
        )}
      </g>
    );
  };

  const totalHeight = currentLanes.reduce((sum, lane) => sum + lane.height, 0);

  return (
    <MainLayout>
      <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Gold Shipping Workflow - BPMN 2.0</h1>
          <p className="text-gray-600 mt-1">
            Business Process Model and Notation - Official Standard
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            onClick={() => setZoom(Math.max(0.5, zoom - 0.1))}
            leftIcon={<ZoomOut className="w-4 h-4" />}
          >
            Zoom Out
          </Button>
          <Button
            variant="secondary"
            onClick={() => setZoom(Math.min(2, zoom + 0.1))}
            leftIcon={<ZoomIn className="w-4 h-4" />}
          >
            Zoom In
          </Button>
          <Button
            variant="secondary"
            leftIcon={<Download className="w-4 h-4" />}
          >
            Export
          </Button>
        </div>
      </div>

      {/* Workflow Tabs */}
      <div className="flex gap-2 border-b border-gray-200">
        <button
          onClick={() => setActiveView('batch-management')}
          className={`px-6 py-3 font-semibold transition-colors ${
            activeView === 'batch-management'
              ? 'text-amber-600 border-b-2 border-amber-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Batch Management Process
        </button>
        <button
          onClick={() => setActiveView('sales-process')}
          className={`px-6 py-3 font-semibold transition-colors ${
            activeView === 'sales-process'
              ? 'text-amber-600 border-b-2 border-amber-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Sales & Payment Process
        </button>
        <button
          onClick={() => setActiveView('depositing-process')}
          className={`px-6 py-3 font-semibold transition-colors ${
            activeView === 'depositing-process'
              ? 'text-amber-600 border-b-2 border-amber-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Depositing Process
        </button>
        <button
          onClick={() => setActiveView('combined')}
          className={`px-6 py-3 font-semibold transition-colors ${
            activeView === 'combined'
              ? 'text-amber-600 border-b-2 border-amber-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          End-to-End Process
        </button>
      </div>

      {/* Main Workflow Area */}
      <div className="grid grid-cols-3 gap-6">
        {/* BPMN Diagram */}
        <div className="col-span-2">
          <Card className="p-6">
            <div className="overflow-auto bg-gray-50 rounded-lg border-2 border-gray-200" style={{ maxHeight: '800px' }}>
              <svg
                width={1100 * zoom}
                height={totalHeight * zoom}
                viewBox={`0 0 1100 ${totalHeight}`}
                className="bg-white"
              >
                {/* Define arrowheads */}
                <defs>
                  <marker
                    id="arrowhead-sequence"
                    markerWidth="10"
                    markerHeight="10"
                    refX="9"
                    refY="3"
                    orient="auto"
                  >
                    <polygon points="0 0, 10 3, 0 6" fill="#374151" />
                  </marker>
                  <marker
                    id="arrowhead-message"
                    markerWidth="10"
                    markerHeight="10"
                    refX="9"
                    refY="3"
                    orient="auto"
                  >
                    <polygon points="0 0, 10 3, 0 6" fill="#6366f1" />
                  </marker>
                </defs>

                {/* Swimlanes */}
                {currentLanes.map((lane) => (
                  <g key={lane.id}>
                    <rect
                      x="0"
                      y={lane.y}
                      width="1100"
                      height={lane.height}
                      fill={lane.color}
                      fillOpacity="0.1"
                      stroke={lane.color}
                      strokeWidth="2"
                    />
                    <text
                      x="20"
                      y={lane.y + 30}
                      className="text-sm font-bold fill-gray-800"
                    >
                      {lane.name}
                    </text>
                  </g>
                ))}

                {/* Flows (drawn first so they're behind elements) */}
                {currentFlows.map(renderFlow)}

                {/* BPMN Elements */}
                {currentElements.map(renderBPMNElement)}
              </svg>
            </div>

            {/* BPMN Legend */}
            <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <h3 className="text-sm font-bold text-gray-900 mb-3">BPMN 2.0 Notation Legend</h3>
              <div className="grid grid-cols-3 gap-4 text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-green-500 border-2 border-green-700"></div>
                  <span className="font-semibold">Start Event</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-red-500 border-4 border-red-700"></div>
                  <span className="font-semibold">End Event</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-6 rounded bg-blue-500 border-2 border-blue-700"></div>
                  <span className="font-semibold">Task/Activity</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 bg-yellow-400 border-2 border-yellow-600 transform rotate-45"></div>
                  <span className="font-semibold">Gateway (Decision)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-orange-500 border-2 border-orange-700"></div>
                  <span className="font-semibold">Intermediate Event</span>
                </div>
                <div className="flex items-center gap-2">
                  <svg width="30" height="10">
                    <line x1="0" y1="5" x2="30" y2="5" stroke="#374151" strokeWidth="2" markerEnd="url(#arrow-legend)" />
                    <defs>
                      <marker id="arrow-legend" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
                        <polygon points="0 0, 10 3, 0 6" fill="#374151" />
                      </marker>
                    </defs>
                  </svg>
                  <span className="font-semibold">Sequence Flow</span>
                </div>
                <div className="flex items-center gap-2">
                  <svg width="30" height="10">
                    <line x1="0" y1="5" x2="30" y2="5" stroke="#6366f1" strokeWidth="2" strokeDasharray="5,5" />
                  </svg>
                  <span className="font-semibold">Message Flow</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-10 bg-white border-2 border-gray-400 rounded-sm"></div>
                  <span className="font-semibold">Data Object</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-12 h-6 bg-gray-100 border-l-4 border-gray-600"></div>
                  <span className="font-semibold">Swimlane/Pool</span>
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Element Details Panel */}
        <div className="col-span-1">
          <Card className="p-6 sticky top-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Element Details</h3>

            {selectedElement ? (
              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 mb-1">Name</h4>
                  <p className="text-gray-900 font-medium">{selectedElement.name}</p>
                </div>

                <div>
                  <h4 className="text-sm font-semibold text-gray-700 mb-1">Type</h4>
                  <span className="inline-block px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-semibold">
                    {selectedElement.type.replace(/-/g, ' ').toUpperCase()}
                  </span>
                </div>

                <div>
                  <h4 className="text-sm font-semibold text-gray-700 mb-1">Lane</h4>
                  <p className="text-gray-900">{currentLanes.find(l => l.id === selectedElement.lane)?.name}</p>
                </div>

                {selectedElement.description && (
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 mb-1">Description</h4>
                    <p className="text-gray-900 text-sm">{selectedElement.description}</p>
                  </div>
                )}

                {selectedElement.validations && selectedElement.validations.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 mb-2">Validations</h4>
                    <ul className="space-y-1">
                      {selectedElement.validations.map((validation, index) => (
                        <li key={index} className="flex items-start gap-2 text-sm text-gray-700">
                          <span className="text-green-600 font-bold">✓</span>
                          {validation}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {selectedElement.outputs && selectedElement.outputs.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 mb-2">Outputs</h4>
                    <ul className="space-y-1">
                      {selectedElement.outputs.map((output, index) => (
                        <li key={index} className="flex items-start gap-2 text-sm text-gray-700">
                          <span className="text-blue-600 font-bold">📄</span>
                          {output}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500">
                <p className="text-sm">Click on any element in the diagram to view details</p>
              </div>
            )}
          </Card>

          {/* Process Summary */}
          <Card className="p-6 mt-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Process Summary</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Total Steps:</span>
                <span className="font-semibold text-gray-900">{currentElements.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Decision Points:</span>
                <span className="font-semibold text-gray-900">
                  {currentElements.filter(e => e.type === 'gateway').length}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Participants:</span>
                <span className="font-semibold text-gray-900">{currentLanes.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Sequence Flows:</span>
                <span className="font-semibold text-gray-900">
                  {currentFlows.filter(f => f.type === 'sequence').length}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Message Flows:</span>
                <span className="font-semibold text-gray-900">
                  {currentFlows.filter(f => f.type === 'message').length}
                </span>
              </div>
            </div>
          </Card>
        </div>
      </div>
      </div>
    </MainLayout>
  );
}
