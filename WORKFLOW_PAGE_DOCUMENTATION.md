# Gold Shipping Workflow Page - Documentation

## Overview
A comprehensive BPMN-style workflow visualization page has been added to the administration section. This page provides interactive workflow diagrams for batch management, sales management, and the complete end-to-end process.

## Features

### 1. Three Workflow Views
- **Batch Management**: Complete workflow from batch creation through refinery processing
- **Gold Sales**: Complete sales workflow from inventory check to payment completion
- **All Processes**: Combined end-to-end workflow showing the entire journey

### 2. Interactive BPMN Diagram
- Visual representation of each process step
- Color-coded step types:
  - **Green (●)**: Start events
  - **Blue (▭)**: Activities/Tasks
  - **Yellow (◆)**: Decision gateways
  - **Red (◉)**: End events
- Sequential flow indicators with arrows
- Click any step to view detailed information

### 3. Detailed Step Information Panel
When a step is selected, the right panel displays:
- **Activity**: Description of what happens in this step
- **Validation Rules**: Required checks and validations
- **Conditions**: Decision criteria for gateway steps
- **Actor/Responsible**: Who performs this step

### 4. Process Summary
- Total number of steps
- Count of activities and decision points
- List of all actors involved in the process

## Workflow Steps

### Batch Management Workflow (13 steps)
1. Start - Batch creation initiated
2. Create Batch - Register new batch with shipping details
3. Ship from Mine - Batch shipped to airport
4. Airport Receipt - Confirm receipt at airport
5. Variance Check - Decision gateway for variance threshold
6. Reconciliation - Document variance if threshold exceeded
7. Ship to Refinery - Transport to refinery
8. Refinery Receipt - Confirm receipt at refinery
9. Pre-Melting Weight - Record pre-melting weight
10. Melting Process - Process batch through melting
11. Post-Melting Analysis - Record final measurements
12. Quality Approval - Approve processed metal
13. Ready for Sale - Batch available for sales

### Sales Management Workflow (13 steps)
1. Start - Sales process initiated
2. Check Inventory - Review available processed batches
3. Create Sale - Prepare sale details
4. Calculate Proceeds - Automatic financial calculations
5. Multi-Customer Check - Decision for single/multiple customers
6. Management Review - Management approval required
7. Management Decision - Approve or reject sale
8. Customer Notification - Email sale details to customer
9. Customer Decision - Customer approves or rejects
10. Payment Details - Customer submits payment information
11. Payment Verification - Verify payment received
12. Final Approval - Management approves payment
13. Complete Sale - Sale closed successfully

### All Processes Workflow (24+ steps)
Combines both workflows showing the complete journey from mine extraction to final payment.

## Key Features by Step Type

### Activities
- Required validations clearly listed
- Actor assignments for accountability
- Automatic calculations highlighted

### Decision Gateways
- Clear conditions for each path
- Threshold-based decisions
- Approval/rejection flows

### Validation Rules
Each activity includes specific validation requirements:
- Required fields
- Business rule checks
- Approval requirements
- Documentation needs

## Access
- **Route**: `/admin/workflow`
- **Navigation**: Available in the Management sidebar under "Workflow"
- **Icon**: GitBranch (workflow tree icon)
- **Permission**: Management role required

## Technical Implementation
- **Component**: `GoldShippingWorkflow.tsx`
- **Location**: `/src/pages/admin/GoldShippingWorkflow.tsx`
- **Dependencies**:
  - React hooks for state management
  - Card and Button UI components
  - Lucide React icons

## User Interactions
1. **Tab Selection**: Switch between Batch, Sales, or All Processes views
2. **Step Selection**: Click any step in the workflow to view details
3. **Visual Feedback**: Selected steps highlighted with blue ring
4. **Responsive Design**: Works on desktop and mobile devices

## Benefits
- **Process Transparency**: Clear visualization of all workflow steps
- **Training Tool**: Helps new users understand the complete process
- **Documentation**: Self-documenting workflows with all conditions
- **Quality Assurance**: Shows all validation requirements
- **Accountability**: Clear actor assignments for each step
- **Decision Support**: Explicit conditions for all decision points

## Future Enhancements
- Export workflow diagrams as PDF
- Process metrics and timing
- Real-time status tracking
- Workflow customization by site
- Integration with actual batch/sale data
