export interface HelpArticle {
  id: string;
  title: string;
  content: string;
  category: string;
  subcategory?: string;
  tags: string[];
  relatedModules?: string[];
  lastUpdated: string;
}

export interface HelpCategory {
  id: string;
  title: string;
  icon: string;
  description: string;
  articles: HelpArticle[];
}

export const helpCategories: HelpCategory[] = [
  {
    id: 'getting-started',
    title: 'Getting Started',
    icon: 'Rocket',
    description: 'Introduction to Gold Shipper and basic concepts',
    articles: [
      {
        id: 'welcome',
        title: 'Welcome to Gold Shipper',
        category: 'getting-started',
        tags: ['introduction', 'overview'],
        content: `
# Welcome to Gold Shipper

Gold Shipper is a comprehensive platform for managing gold and silver shipments across West African operations. This system helps you track precious metals from mine extraction to final sale with complete traceability.

## Key Features
- **Batch Management**: Track gold shipments from mine to sale
- **Pre-Sales**: Sell validated batches before inventory arrives
- **Sales Management**: Complete sales workflow with approvals
- **Inventory Tracking**: Real-time inventory management
- **Analytics**: Comprehensive reporting and insights
- **Multi-role Access**: Different dashboards for different roles

## User Roles
- **Factory**: Create and ship batches
- **Airport**: Receive and validate shipments
- **Refinery**: Process and refine gold
- **Management**: Approve sales and monitor operations
- **Customer**: View and approve sales

## Getting Help
Use the search bar above to find specific information, or browse through the categories on the left.
        `,
        lastUpdated: '2025-11-03',
      },
      {
        id: 'navigation',
        title: 'Navigating the Platform',
        category: 'getting-started',
        tags: ['navigation', 'menu', 'interface'],
        content: `
# Navigating the Platform

## Main Navigation
The sidebar on the left contains all main modules grouped by category:

### Batches Section
- **Batches**: View and manage all gold batches
- **Shipping**: Track shipments and transportation
- **Refining**: Monitor refining process

### Inventory Section
- **Gold Inventory**: Manage available gold stock
- **Silver Inventory**: Manage silver stock

### Marketplace Section
- **Trade Space**: Gold trading and pricing simulation
- **Gold Prices**: Track London AM rates
- **FX Rates**: Monitor exchange rates

### Sales Section
- **Pre-Sales**: Create and manage pre-sales
- **Sales**: Regular sales management
- **Payments**: Track customer payments

### Stakeholders Section
- **Mining Companies**: Manage mining company information
- **Freight Companies**: Transportation companies
- **Refinery Plants**: Refinery information
- **Customers**: Customer management

## Top Bar
- **Dashboard**: Click logo to return to dashboard
- **Language Toggle**: Switch between English/French
- **User Menu**: Access profile and help center
- **Notifications**: View system notifications
        `,
        lastUpdated: '2025-11-03',
      },
    ],
  },
  {
    id: 'batch-management',
    title: 'Batch Management',
    icon: 'Package',
    description: 'Creating, tracking, and managing gold batches',
    articles: [
      {
        id: 'create-batch',
        title: 'Creating a New Batch',
        category: 'batch-management',
        tags: ['batch', 'create', 'form', 'factory'],
        relatedModules: ['batches', 'shipping'],
        content: `
# Creating a New Batch

## Prerequisites
- User must have Factory role
- Must have BATCHES_CREATE permission

## Step-by-Step Process

### 1. Navigate to Batches
Go to **Batches** in the sidebar and click **"New Batch"** button.

### 2. Fill Basic Information
- **Shipping Date**: Date when batch leaves the mine
- **Mining Company**: Select the origin mining company
- **Weight**: Enter weight in grams (automatic oz conversion)

### 3. Add Documents (Optional)
- Upload shipping documents
- Add customs documents
- Include quality certificates

### 4. Review and Submit
- Check automatic batch number generation (format: B-YYMM-####)
- Review weight conversion
- Add any notes
- Click "Create Batch"

## Automatic Actions
Upon creation, the system will:
- Generate unique batch number
- Set initial status to "shipped"
- Calculate weight in ounces
- Create audit log entry
- Notify airport team

## Field Definitions

### Weight (grams)
Enter the exact weight in grams as measured at the mine. The system automatically converts to troy ounces.

**Formula**: ounces = grams ÷ 31.1035

### Mining Company
Select the mining company that shipped this batch. This links the batch to its origin.

### Notes
Any additional information about the batch, special handling instructions, or observations.

## Common Errors

**Error: "Weight must be positive"**
- Ensure weight is greater than 0
- Check for decimal point issues

**Error: "Mining company required"**
- Select a mining company from the dropdown
- Contact admin if company is missing

## What Happens Next?
1. Batch is created with "shipped" status
2. Airport team receives notification
3. Batch appears in airport receiving dashboard
4. Tracking number can be used to follow batch progress
        `,
        lastUpdated: '2025-11-03',
      },
      {
        id: 'batch-workflow',
        title: 'Batch Workflow & Status Flow',
        category: 'batch-management',
        tags: ['workflow', 'status', 'process'],
        relatedModules: ['batches', 'receiving', 'refining'],
        content: `
# Batch Workflow & Status Flow

## Complete Status Flow

### 1. SHIPPED (Factory)
**Created by**: Factory user
**Next status**: Waiting Airport Receipt

Batch leaves the mine and is in transit to airport.

### 2. WAITING_AIRPORT_RECEIPT (In Transit)
**Automatic**: Set after creation
**Next status**: Received at Airport

Batch is expected at airport, awaiting receipt confirmation.

### 3. RECEIVED_AT_AIRPORT (Airport)
**Action**: Airport confirms receipt
**Next status**: Validated for Refinery

Airport team confirms physical receipt and validates shipment.

### 4. VALIDATED_FOR_TRANSPORT (Airport)
**Action**: Airport validates for transport to refinery
**Next status**: Waiting Refinery Receipt
**Special**: Eligible for PRE-SALES at this stage

Batch is validated and ready for transport to refinery. Can be pre-sold.

### 5. RECEIVED_AT_REFINERY (Refinery)
**Action**: Refinery confirms receipt
**Next status**: Validated for Processing

Refinery receives and validates the batch.

### 6. PROCESSING (Refinery)
**Action**: Refining process starts
**Next status**: Processed/Inventory

Gold is being refined and processed.

### 7. INVENTORY (Refinery)
**Action**: Processing complete, moved to inventory
**Next status**: Ready for Sale

Processed gold added to available inventory.

### 8. READY_FOR_SALE (Management)
**Action**: Management marks as ready
**Next status**: Allocated to Sale

Batch is available for sale to customers.

### 9. ALLOCATED_TO_SALE (Sales)
**Action**: Batch allocated to a sale
**Next status**: Sold

Batch is reserved for a specific sale.

### 10. SOLD (Complete)
**Final status**: Batch lifecycle complete

Batch has been sold to customer.

## Role Responsibilities

| Role | Actions |
|------|---------|
| Factory | Create batch, initial shipping |
| Airport | Receive, validate for transport |
| Refinery | Receive, process, add to inventory |
| Management | Approve sales, mark ready |
| Sales | Allocate to sales |

## Approval Points

### Airport Validation
- Visual inspection
- Weight verification
- Document verification

### Refinery Validation
- Weight recheck
- Quality assessment
- Processing readiness

### Pre-Sale Point
**Status Required**: validated_for_transport
- Batch can be pre-sold before arriving at factory
- System will auto-convert when inventory arrives

## Status Change Restrictions

Certain status changes require approvals:
- Only Airport can mark "Received at Airport"
- Only Refinery can mark "Processing"
- Management approval needed for "Ready for Sale"

## Tracking Your Batch

Use batch number (e.g., B-2511-0042) to:
- View current status
- See status history with timestamps
- Check who performed each action
- View related documents
        `,
        lastUpdated: '2025-11-03',
      },
    ],
  },
  {
    id: 'presales',
    title: 'Pre-Sales Module',
    icon: 'PackagePlus',
    description: 'Selling batches before inventory arrives',
    articles: [
      {
        id: 'presales-overview',
        title: 'Pre-Sales Overview',
        category: 'presales',
        tags: ['pre-sales', 'overview', 'concept'],
        relatedModules: ['presales', 'sales', 'inventory'],
        content: `
# Pre-Sales Overview

## What is a Pre-Sale?

A pre-sale allows you to sell a validated batch **before** it arrives at the factory. This enables:
- Locking in prices early
- Securing customer commitments
- Improving cash flow
- Reducing inventory holding time

## How It Works

### 1. Batch Validation
Batch must be in **"validated_for_transport"** status to be eligible for pre-sale.

### 2. Create Pre-Sale
- Select the validated batch
- Choose customer
- Set pricing (London AM rate)
- Add freight and other costs
- System calculates final amounts

### 3. Approval Workflow
Same as regular sales:
- Management approval
- Customer approval
- Payment tracking

### 4. Customer Account Tracking
When customer approves:
- System creates "Account Receivable" entry
- Tracks amount we OWE to customer
- Shows on dashboard widget

### 5. Automatic Conversion
When inventory arrives:
- System detects arrival automatically
- Compares pre-sale qty vs actual qty
- **If variance ≤ 2%**: Auto-converts to regular sale
- **If variance > 2%**: Requires manual reconciliation
- Updates customer account automatically

## Benefits

### For Sales Team
- Sell before stock arrives
- Lock in favorable prices
- Reduce sales cycle time

### For Customers
- Guaranteed allocation
- Price certainty
- Priority delivery

### For Finance
- Better cash flow
- Reduced inventory costs
- Accurate AR tracking

## Customer Account Example

**Pre-Sale Created**: $100,000
- Customer: Auramet
- Quantity: 50 oz @ $2,000/oz
- Customer Account: +$100,000 (we owe them)

**Inventory Arrives**: 49.5 oz
- Variance: -1% (acceptable)
- Auto-converts to sale
- New amount: $99,000
- Customer Account: $0 (settled)

## Dashboard Tracking

The main dashboard shows:
- Total amount owed to customers
- Pending pre-sales count
- Awaiting inventory count
- Top customer balances

## Important Notes

⚠️ **Batch Restriction**: One active pre-sale per batch
⚠️ **Status Required**: Batch must be validated_for_transport
⚠️ **Variance Tolerance**: 2% automatic, >2% needs review
✅ **Automatic**: System handles conversion seamlessly
        `,
        lastUpdated: '2025-11-03',
      },
      {
        id: 'create-presale',
        title: 'Creating a Pre-Sale',
        category: 'presales',
        tags: ['pre-sale', 'create', 'form'],
        relatedModules: ['presales', 'batches', 'customers'],
        content: `
# Creating a Pre-Sale

## Prerequisites
- Batch in "validated_for_transport" status
- Active customer account
- SALES_CREATE permission

## Step-by-Step Guide

### 1. Navigate to Pre-Sales
Go to **Sales** → **Pre-Sales** and click **"New Pre-Sale"**

### 2. Select Batch
- Choose from available validated batches
- System shows: batch number, weight, mining company
- Only batches without existing pre-sales are shown

### 3. Choose Customer
- Select from active customers
- Customer must be in "active" status

### 4. Enter Pricing
- **Quantity**: Usually matches batch weight (can adjust)
- **London AM Rate**: Current gold price per ounce
- **Freight Cost**: Transportation costs (optional)
- **Other Costs**: Additional costs (optional)

### 5. Set Expected Arrival
- Enter expected date when batch will arrive
- Helps track and manage expectations

### 6. Review Calculations
System automatically calculates:
- **Gross Proceeds**: Quantity × London AM Rate
- **Net Proceeds**: Gross - Freight - Other Costs
- **Royalty (3%)**: Net Proceeds × 0.03
- **Final Proceeds**: Net Proceeds - Royalty

### 7. Add Notes
- Any special instructions
- Customer requirements
- Delivery terms

### 8. Submit
Click **"Create Pre-Sale"** to submit for management approval

## Form Fields Explained

### Quantity (oz)
Amount of gold being pre-sold. Typically matches batch weight but can be adjusted if selling partial batch.

### London AM Rate ($/oz)
Current London AM gold price. This locks in the rate for this pre-sale.

**Tip**: Use Trade Space to simulate different rates

### Freight Cost ($)
Estimated or actual freight cost from origin to destination.

### Other Costs ($)
Any additional costs: insurance, handling, storage, etc.

### Expected Arrival Date
When you expect the batch to arrive at factory. This is for planning only - actual arrival triggers conversion.

## Calculation Example

**Example:**
- Quantity: 50 oz
- London AM Rate: $2,450/oz
- Freight Cost: $500
- Other Costs: $250

**Calculations:**
- Gross Proceeds: 50 × $2,450 = $122,500
- Less Freight: -$500
- Less Other: -$250
- Net Proceeds: $121,750
- Less Royalty (3%): -$3,653
- **Final Proceeds: $118,097**

## What Happens After Creation

1. Pre-sale created with unique number (PS-YYMM-####)
2. Status set to "pending_management_approval"
3. Management receives notification
4. Pre-sale appears in dashboard
5. Customer account NOT affected yet (waiting approval)

## Common Errors

**"Batch must be validated for transport"**
- Selected batch is not in correct status
- Check batch status in Batches module

**"Batch already has active pre-sale"**
- This batch is already pre-sold
- Choose a different batch

**"Quantity must be greater than 0"**
- Enter valid quantity
- Check decimal separator

## Tips for Success

✅ **Verify batch weight** before entering quantity
✅ **Check current gold price** for accurate rate
✅ **Include all costs** for accurate final proceeds
✅ **Set realistic arrival date** for better tracking
✅ **Add detailed notes** for context
        `,
        lastUpdated: '2025-11-03',
      },
    ],
  },
  {
    id: 'sales',
    title: 'Sales Management',
    icon: 'ShoppingCart',
    description: 'Managing regular sales and customer approvals',
    articles: [
      {
        id: 'sales-overview',
        title: 'Sales Process Overview',
        category: 'sales',
        tags: ['sales', 'workflow', 'process'],
        relatedModules: ['sales', 'customers', 'inventory'],
        content: `
# Sales Process Overview

## Sales Workflow

### 1. CREATE_SALES (Initial)
Sales person creates a new sale from available inventory.

### 2. PENDING_MANAGEMENT_APPROVAL
Management reviews and approves/rejects the sale.

### 3. MANAGEMENT_APPROVED
Sale approved by management, ready for customer.

### 4. PENDING_FOR_CUSTOMER_APPROVAL
Email sent to customer for approval.

### 5. CUSTOMER_APPROVED
Customer approves the sale via email link.

### 6. WAITING_FOR_PAYMENT
Awaiting payment from customer.

### 7. PAYMENT_RECEIVED
Payment confirmed and verified.

### 8. COMPLETED
Sale fully processed and completed.

## Sale Components

### Pricing
- **London AM Rate**: Base gold price
- **Quantity**: Amount in troy ounces
- **Gross Proceeds**: Quantity × Rate
- **Net Proceeds**: Gross - Costs
- **Royalty (3%)**: Deducted from net
- **Final Proceeds**: What customer pays

### Costs
- **Freight Cost**: Transportation
- **Other Costs**: Insurance, handling, etc.

### Stakeholders
- **Seller**: Who is selling (Mansa or Mining Company)
- **Customer**: Who is buying
- **Approvers**: Management and customer

## Seller Types

### Mansa (External Sales)
- Mansa sells to external customers
- Standard sales workflow
- Commission structure applies

### Mining Company → Mansa (Internal)
- Mining company sells to Mansa
- Marked as internal sale
- Different pricing rules

## Customer Approval

Customers receive email with:
- Sale details and amounts
- Approve/Reject buttons
- Unique secure link

They can:
- ✅ **Approve**: Proceeds to payment
- ❌ **Reject**: Returns to sales team

## Payment Process

After customer approval:
1. Customer provides payment details
2. Upload payment proof
3. Management verifies payment
4. Sale marked as "payment_received"
5. Sale completed

## Available Inventory

Sales can only be created from:
- Batches in "inventory" status
- Gold in "available" inventory
- Not already allocated to other sales

## Trade Space Integration

Use **Trade Space** to:
- Simulate pricing scenarios
- Compare mechanisms (Premium, Discount, etc.)
- Create sale directly from simulation

## Virtual Payments

For certain scenarios:
- System can create virtual payment
- Tracks internally
- Useful for inter-company transfers

## Reporting

Track sales performance:
- Monthly revenue
- Customer analytics
- Price trends
- Quantity sold
        `,
        lastUpdated: '2025-11-03',
      },
    ],
  },
  {
    id: 'inventory',
    title: 'Inventory Management',
    icon: 'Warehouse',
    description: 'Managing gold and silver inventory',
    articles: [
      {
        id: 'inventory-overview',
        title: 'Inventory System Overview',
        category: 'inventory',
        tags: ['inventory', 'stock', 'management'],
        relatedModules: ['inventory', 'batches', 'sales'],
        content: `
# Inventory Management

## Inventory Sources

### From Batches
When a batch completes refining:
- Status changes to "processed" or "inventory"
- Gold automatically added to inventory
- Tracked by batch reference

### Manual Entry
Authorized users can:
- Add inventory manually
- Adjust for corrections
- Record from external sources

## Inventory Statuses

### Available
- Ready for sale
- Can be allocated to orders
- Visible in sales creation

### Allocated
- Reserved for specific sale
- Cannot be sold to others
- Pending sale completion

### Sold
- Sale completed
- Removed from available stock
- Historical record maintained

## Weight Tracking

System tracks in dual units:
- **Grams**: Primary measurement
- **Troy Ounces**: For sales (1 oz = 31.1035g)

Automatic conversion ensures accuracy.

## Inventory Metrics

Dashboard shows:
- **Total Inventory**: All gold in system
- **Available Stock**: Ready for sale
- **Allocated Stock**: Reserved for sales
- **Value**: Based on current gold price

## Location Tracking

Track inventory by:
- Physical location (factory, vault)
- Batch origin
- Quality/fineness
- Date received

## Stock Movements

Every movement logged:
- Date and time
- Quantity
- From/To status
- User who made change
- Reason/reference

## Low Stock Alerts

System can alert when:
- Available stock below threshold
- High demand periods
- Pending deliveries delayed

## Inventory Reports

Generate reports for:
- Current stock levels
- Stock movements history
- Valuation at different dates
- Aging analysis
- Batch traceability
        `,
        lastUpdated: '2025-11-03',
      },
    ],
  },
  {
    id: 'system',
    title: 'System & Administration',
    icon: 'Settings',
    description: 'User management, permissions, and system settings',
    articles: [
      {
        id: 'user-roles',
        title: 'User Roles & Permissions',
        category: 'system',
        tags: ['users', 'roles', 'permissions', 'security'],
        content: `
# User Roles & Permissions

## Available Roles

### Factory
**Responsibilities:**
- Create new batches
- Ship batches to airport
- Upload documents
- View batch history

**Access:**
- Batch creation
- Shipping module
- Factory dashboard

### Airport
**Responsibilities:**
- Receive batches
- Validate shipments
- Confirm transport to refinery

**Access:**
- Receiving module
- Batch validation
- Airport dashboard

### Refinery
**Responsibilities:**
- Receive from airport
- Process gold
- Add to inventory
- Quality control

**Access:**
- Refining module
- Inventory management
- Refinery dashboard

### Sales
**Responsibilities:**
- Create sales
- Manage customers
- Process pre-sales

**Access:**
- Sales module
- Pre-sales module
- Customer management
- Trade space

### Management
**Responsibilities:**
- Approve sales
- Approve pre-sales
- View analytics
- Manage users
- System settings

**Access:**
- All modules (read)
- Approval workflows
- Analytics
- User management
- System settings

### Customer
**Responsibilities:**
- View assigned sales
- Approve/reject sales
- Provide payment info

**Access:**
- Customer portal
- Assigned sales only
- Payment submission

## Permission Matrix

| Action | Factory | Airport | Refinery | Sales | Management | Customer |
|--------|---------|---------|----------|-------|------------|----------|
| Create Batch | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Receive Batch | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Process Gold | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| Create Sale | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ |
| Approve Sale | ❌ | ❌ | ❌ | ❌ | ✅ | ✅* |
| View Analytics | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ |
| Manage Users | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |

*Customer can only approve their own sales

## Assigning Roles

Administrators can:
1. Go to **User Management**
2. Select user
3. Assign one or more roles
4. Set specific permissions
5. Define access restrictions

## Multi-Role Users

Users can have multiple roles:
- See combined permissions
- Switch context if needed
- Access all assigned modules

## Field-Level Permissions

Control access to specific fields:
- View-only vs editable
- Hidden fields
- Conditional display

## Data Isolation

Each user sees only:
- Their site's data
- Their assigned customers
- Their role-permitted modules
        `,
        lastUpdated: '2025-11-03',
      },
    ],
  },
];

// Search function
export function searchHelpContent(query: string): HelpArticle[] {
  const lowerQuery = query.toLowerCase();
  const results: HelpArticle[] = [];

  helpCategories.forEach(category => {
    category.articles.forEach(article => {
      const titleMatch = article.title.toLowerCase().includes(lowerQuery);
      const contentMatch = article.content.toLowerCase().includes(lowerQuery);
      const tagMatch = article.tags.some(tag => tag.toLowerCase().includes(lowerQuery));

      if (titleMatch || contentMatch || tagMatch) {
        results.push({
          ...article,
          category: category.title,
        });
      }
    });
  });

  return results;
}

// Get article by ID
export function getArticleById(id: string): HelpArticle | undefined {
  for (const category of helpCategories) {
    const article = category.articles.find(a => a.id === id);
    if (article) {
      return {
        ...article,
        category: category.title,
      };
    }
  }
  return undefined;
}

// Get articles by category
export function getArticlesByCategory(categoryId: string): HelpArticle[] {
  const category = helpCategories.find(c => c.id === categoryId);
  return category ? category.articles : [];
}

// Get related articles
export function getRelatedArticles(articleId: string): HelpArticle[] {
  const article = getArticleById(articleId);
  if (!article || !article.relatedModules) return [];

  const related: HelpArticle[] = [];
  helpCategories.forEach(category => {
    category.articles.forEach(a => {
      if (a.id !== articleId && a.relatedModules) {
        const hasCommonModule = a.relatedModules.some(
          m => article.relatedModules?.includes(m)
        );
        if (hasCommonModule) {
          related.push({ ...a, category: category.title });
        }
      }
    });
  });

  return related.slice(0, 5);
}
