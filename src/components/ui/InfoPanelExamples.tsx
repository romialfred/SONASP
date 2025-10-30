/**
 * InfoPanel Examples - Ready-to-use panels for different contexts
 * Copy and paste these into your forms and pages
 */

import {
  Info,
  Building2,
  FileText,
  Shield,
  TrendingUp,
  Package,
  Users,
  DollarSign,
  AlertCircle,
  CheckCircle,
  Clock,
  MapPin,
  Settings,
  Truck,
  Factory,
  Zap
} from 'lucide-react';
import { InfoPanel, InfoPanelGroup } from './InfoPanel';

// BATCH CREATION PANELS
export function BatchCreationInfoPanels() {
  return (
    <InfoPanelGroup>
      <InfoPanel
        title="Batch Guidelines"
        icon={Package}
        variant="blue"
        items={[
          { text: 'Batch number is auto-generated upon creation' },
          { text: 'Weight must be entered in grams (auto-converted to oz)' },
          { text: 'All batches start with "Draft" status' },
          { text: 'Save draft anytime before final submission' },
        ]}
      />

      <InfoPanel
        title="Quality Standards"
        icon={Shield}
        variant="purple"
        items={[
          { text: 'Minimum fineness: 99.5% for gold processing', icon: '✓' },
          { text: 'Moisture content below 2%', icon: '✓' },
          { text: 'Proper packaging and labeling required', icon: '✓' },
          { text: 'Photos mandatory for high-value batches', icon: '✓' },
        ]}
      />

      <InfoPanel
        title="Next Steps"
        icon={TrendingUp}
        variant="teal"
        items={[
          { text: 'Airport team will be notified automatically' },
          { text: 'Expected processing time: 24-48 hours' },
          { text: 'Track status in real-time on dashboard' },
          { text: 'Receive email notifications at each stage' },
        ]}
      />
    </InfoPanelGroup>
  );
}

// SALES CREATION PANELS
export function SalesCreationInfoPanels() {
  return (
    <InfoPanelGroup>
      <InfoPanel
        title="Pricing Information"
        icon={DollarSign}
        variant="amber"
        items={[
          { text: 'Prices based on London AM fixing rate' },
          { text: 'Automatic conversion to customer currency' },
          { text: 'Net smelted royalties (3%) applied' },
          { text: 'Final proceeds calculated automatically' },
        ]}
      />

      <InfoPanel
        title="Customer Approval"
        icon={Users}
        variant="blue"
        items={[
          { text: 'Customer receives email notification' },
          { text: 'Approval required within 48 hours' },
          { text: 'Payment terms as per customer agreement' },
          { text: 'Documents generated upon approval' },
        ]}
      />

      <InfoPanel
        title="Important Notes"
        icon={AlertCircle}
        variant="red"
        items={[
          { text: 'Verify available inventory before creating sale', icon: '⚠' },
          { text: 'Check customer credit limit status', icon: '⚠' },
          { text: 'Confirm current FX rates for accuracy', icon: '⚠' },
          { text: 'Multiple customers allowed for partial sales', icon: '⚠' },
        ]}
      />
    </InfoPanelGroup>
  );
}

// PAYMENT PROCESSING PANELS
export function PaymentProcessingInfoPanels() {
  return (
    <InfoPanelGroup>
      <InfoPanel
        title="Payment Details"
        icon={DollarSign}
        variant="green"
        items={[
          { text: 'Multiple payment methods supported' },
          { text: 'Upload payment proof (required)' },
          { text: 'Bank details must match customer records' },
          { text: 'Management approval required for completion' },
        ]}
      />

      <InfoPanel
        title="Processing Time"
        icon={Clock}
        variant="orange"
        items={[
          { text: 'Standard processing: 2-3 business days' },
          { text: 'Express processing available on request' },
          { text: 'Verification may extend timeline' },
          { text: 'Notifications sent at each step' },
        ]}
      />

      <InfoPanel
        title="Security"
        icon={Shield}
        variant="slate"
        items={[
          { text: 'All transactions encrypted end-to-end', icon: '🔒' },
          { text: 'Complete audit trail maintained', icon: '🔒' },
          { text: 'Multi-level approval workflow', icon: '🔒' },
          { text: 'Fraud detection monitoring active', icon: '🔒' },
        ]}
      />
    </InfoPanelGroup>
  );
}

// REFINING PROCESS PANELS
export function RefiningProcessInfoPanels() {
  return (
    <InfoPanelGroup>
      <InfoPanel
        title="Process Guidelines"
        icon={Factory}
        variant="purple"
        items={[
          { text: 'Record pre-melting and post-melting weights' },
          { text: 'Calculate fineness percentage accurately' },
          { text: 'Metal retention percentage must be documented' },
          { text: 'Final fine calculated automatically' },
        ]}
      />

      <InfoPanel
        title="Quality Control"
        icon={CheckCircle}
        variant="green"
        items={[
          { text: 'Minimum 3 assay tests required', icon: '✓' },
          { text: 'Photos at each processing stage', icon: '✓' },
          { text: 'Supervisor approval mandatory', icon: '✓' },
          { text: 'Certificates issued upon completion', icon: '✓' },
        ]}
      />

      <InfoPanel
        title="Safety Notes"
        icon={AlertCircle}
        variant="red"
        items={[
          { text: 'Follow proper safety protocols at all times', icon: '⚠' },
          { text: 'Protective equipment mandatory', icon: '⚠' },
          { text: 'Temperature monitoring critical', icon: '⚠' },
          { text: 'Emergency procedures posted on-site', icon: '⚠' },
        ]}
      />
    </InfoPanelGroup>
  );
}

// SHIPPING & LOGISTICS PANELS
export function ShippingLogisticsInfoPanels() {
  return (
    <InfoPanelGroup>
      <InfoPanel
        title="Shipping Details"
        icon={Truck}
        variant="blue"
        items={[
          { text: 'Select approved transport company only' },
          { text: 'Insurance coverage verified automatically' },
          { text: 'GPS tracking enabled on all shipments' },
          { text: 'Real-time location updates available' },
        ]}
      />

      <InfoPanel
        title="Documentation"
        icon={FileText}
        variant="amber"
        items={[
          { text: 'Waybill generated automatically', icon: '✓' },
          { text: 'Export permits attached to shipment', icon: '✓' },
          { text: 'Manifest includes all batch details', icon: '✓' },
          { text: 'Customs declarations pre-filled', icon: '✓' },
        ]}
      />

      <InfoPanel
        title="Delivery Tracking"
        icon={MapPin}
        variant="teal"
        items={[
          { text: 'Estimated delivery time calculated' },
          { text: 'SMS alerts at key checkpoints' },
          { text: 'Proof of delivery required' },
          { text: 'Automatic receipt confirmation' },
        ]}
      />
    </InfoPanelGroup>
  );
}

// USER MANAGEMENT PANELS
export function UserManagementInfoPanels() {
  return (
    <InfoPanelGroup>
      <InfoPanel
        title="Access Control"
        icon={Shield}
        variant="slate"
        items={[
          { text: 'Role-based permissions enforced' },
          { text: 'Multi-factor authentication available' },
          { text: 'Session timeout: 30 minutes of inactivity' },
          { text: 'Password strength requirements enforced' },
        ]}
      />

      <InfoPanel
        title="User Roles"
        icon={Users}
        variant="purple"
        items={[
          { text: 'Factory: Batch creation and shipping' },
          { text: 'Airport: Receiving and validation' },
          { text: 'Refinery: Processing and quality control' },
          { text: 'Management: Full system access and reports' },
        ]}
      />

      <InfoPanel
        title="Audit Trail"
        icon={FileText}
        variant="blue"
        items={[
          { text: 'All user actions logged automatically', icon: '✓' },
          { text: 'IP addresses and timestamps recorded', icon: '✓' },
          { text: 'Login history maintained for 2 years', icon: '✓' },
          { text: 'Compliance reports generated monthly', icon: '✓' },
        ]}
      />
    </InfoPanelGroup>
  );
}

// SYSTEM SETTINGS PANELS
export function SystemSettingsInfoPanels() {
  return (
    <InfoPanelGroup>
      <InfoPanel
        title="Configuration"
        icon={Settings}
        variant="slate"
        items={[
          { text: 'Changes apply immediately to all users' },
          { text: 'Backup created before major changes' },
          { text: 'Test in staging environment first' },
          { text: 'Admin approval required for critical settings' },
        ]}
      />

      <InfoPanel
        title="Integrations"
        icon={Zap}
        variant="amber"
        items={[
          { text: 'Gold price feed: Updated every 15 minutes' },
          { text: 'FX rates: ECB API (daily updates)' },
          { text: 'Email service: Supabase Edge Functions' },
          { text: 'SMS gateway: Configured per region' },
        ]}
      />

      <InfoPanel
        title="Maintenance"
        icon={AlertCircle}
        variant="orange"
        items={[
          { text: 'Automatic backups: Daily at 2:00 AM UTC', icon: '🕐' },
          { text: 'System updates: Scheduled weekends only', icon: '🕐' },
          { text: 'Database optimization: Weekly', icon: '🕐' },
          { text: 'Uptime monitoring: 24/7', icon: '🕐' },
        ]}
      />
    </InfoPanelGroup>
  );
}

// ANALYTICS & REPORTS PANELS
export function AnalyticsReportsInfoPanels() {
  return (
    <InfoPanelGroup>
      <InfoPanel
        title="Data Insights"
        icon={TrendingUp}
        variant="blue"
        items={[
          { text: 'Real-time data updates every 5 minutes' },
          { text: 'Historical data available up to 2 years' },
          { text: 'Custom date ranges supported' },
          { text: 'Export to Excel, PDF, or CSV' },
        ]}
      />

      <InfoPanel
        title="Report Types"
        icon={FileText}
        variant="purple"
        items={[
          { text: 'Sales Performance: Monthly and annual' },
          { text: 'Inventory: Real-time stock levels' },
          { text: 'Customer Analytics: Payment trends' },
          { text: 'Operational: Efficiency metrics' },
        ]}
      />

      <InfoPanel
        title="Scheduling"
        icon={Clock}
        variant="green"
        items={[
          { text: 'Automated reports can be scheduled', icon: '📅' },
          { text: 'Email delivery to multiple recipients', icon: '📅' },
          { text: 'Frequency: Daily, weekly, or monthly', icon: '📅' },
          { text: 'Custom filters saved per schedule', icon: '📅' },
        ]}
      />
    </InfoPanelGroup>
  );
}
