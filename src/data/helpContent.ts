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
        content: '# Welcome to Gold Shipper\n\nGold Shipper is a comprehensive platform for managing gold and silver shipments across West African operations.\n\n## **Key Features**\n\n- **Batch Management** - Track gold shipments from mine to sale\n- **Pre-Sales** - Sell validated batches before inventory arrives\n- **Sales Management** - Complete sales workflow with approvals\n- **Inventory Tracking** - Real-time inventory management\n- **Analytics** - Comprehensive reporting and insights\n\n## **User Roles**\n\n- **Factory** - Create and ship batches\n- **Airport** - Receive and validate shipments\n- **Refinery** - Process and refine gold\n- **Management** - Approve sales and monitor operations\n- **Customer** - View and approve sales',
        lastUpdated: '2025-11-03',
      },
      {
        id: 'navigation',
        title: 'Navigating the Platform',
        category: 'getting-started',
        tags: ['navigation', 'menu', 'interface'],
        content: '# Navigating the Platform\n\n## **Main Navigation**\n\nThe sidebar contains all main modules grouped by category.\n\n### **Batches Section**\n- **Batches** - View and manage all gold batches\n- **Shipping** - Track shipments and transportation\n- **Refining** - Monitor refining process\n\n### **Marketplace Section**\n- **Trade Space** - Gold trading and pricing simulation\n- **Gold Prices** - Track London AM rates\n- **FX Rates** - Monitor exchange rates\n\n### **Sales Section**\n- **Pre-Sales** - Create and manage pre-sales\n- **Sales** - Regular sales management\n- **Payments** - Track customer payments',
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
        content: '# Creating a New Batch\n\n---\n\n## **Prerequisites**\n\n**Required Permissions:**\n- User must have **Factory** role\n- Must have **BATCHES_CREATE** permission\n\n---\n\n## **Step-by-Step Process**\n\n### **Step 1: Navigate to Batches**\n\nNavigate to **Batches** in the sidebar menu and click the **New Batch** button.\n\n**Location:** Menu → Batches → New Batch\n\n---\n\n### **Step 2: Fill Basic Information**\n\nComplete the following required fields:\n\n| Field | Description | Format | Example |\n|-------|-------------|--------|-------|\n| **Shipping Date** | Date when batch leaves the mine | DD/MM/YYYY | 03/11/2025 |\n| **Mining Company** | Select the origin mining company | Dropdown | Mansa Resources |\n| **Weight** | Enter weight in grams | Numeric (g) | 5000 |\n\n> **Note:** Weight conversion to troy ounces is automatic\n>\n> **Formula:** oz = grams ÷ 31.1035\n\n---\n\n### **Step 3: Add Documents** *(Optional)*\n\nUpload supporting documentation:\n\n- **Shipping documents** - Transport manifest\n- **Customs documents** - Export certificates  \n- **Quality certificates** - Assay reports\n\n**Supported formats:** PDF, DOCX, PNG, JPG (Max 10MB per file)\n\n---\n\n### **Step 4: Review and Submit**\n\nBefore submitting, verify:\n\n✓ **Batch Number** - Auto-generated (Format: B-YYMM-####)\n✓ **Weight Conversion** - Grams to ounces calculated\n✓ **Notes** - Any additional information\n✓ **All Required Fields** - Marked with red asterisk\n\nClick **Create Batch** to submit.\n\n---\n\n## **Automatic System Actions**\n\nUpon successful creation, the system automatically:\n\n1. ✅ **Generates** unique batch number\n2. ✅ **Sets** initial status to SHIPPED\n3. ✅ **Calculates** weight in troy ounces\n4. ✅ **Creates** audit log entry\n5. ✅ **Notifies** airport receiving team\n6. ✅ **Updates** dashboard metrics',
        lastUpdated: '2025-11-03',
      },
      {
        id: 'batch-workflow',
        title: 'Batch Workflow & Status Flow',
        category: 'batch-management',
        tags: ['workflow', 'status', 'process'],
        relatedModules: ['batches', 'receiving', 'refining'],
        content: '# Batch Workflow & Status Flow\n\n---\n\n## **BPMN 2.0 Workflow Diagram**\n\n```\n┌─────────────┐\n│   START     │ Factory Creates Batch\n│  (Factory)  │\n└──────┬──────┘\n       │\n       ▼\n┌─────────────────────┐\n│    SHIPPED          │ ◉ Start Event\n│ (Initial Status)    │ Batch leaves mine\n└──────┬──────────────┘\n       │ Automatic\n       ▼\n┌─────────────────────┐\n│ WAITING_AIRPORT     │ ⧗ Timer Event\n│     RECEIPT         │ In transit\n└──────┬──────────────┘\n       │ Manual Action\n       ▼\n┌─────────────────────┐\n│ RECEIVED_AT_AIRPORT │ ✓ User Task\n│   (Airport Team)    │ Receipt confirmed\n└──────┬──────────────┘\n       │ Validation\n       ▼\n┌─────────────────────┐\n│ VALIDATED_FOR       │ ✓ User Task\n│    TRANSPORT        │ ⚡ PRE-SALES OK ⚡\n└──────┬──────────────┘\n       │ Transport\n       ▼\n┌─────────────────────┐\n│ RECEIVED_AT_REFINERY│ ✓ User Task\n│   (Refinery Team)   │ Batch at refinery\n└──────┬──────────────┘\n       │ Processing\n       ▼\n┌─────────────────────┐\n│    PROCESSING       │ ⚙ Service Task\n│  (Refining Gold)    │ Melting & Refining\n└──────┬──────────────┘\n       │ Complete\n       ▼\n┌─────────────────────┐\n│    INVENTORY        │ ✓ User Task\n│ (Processed Gold)    │ Added to stock\n└──────┬──────────────┘\n       │ Approve\n       ▼\n┌─────────────────────┐\n│  READY_FOR_SALE     │ ✓ User Task\n│ (Available Stock)   │ Ready to sell\n└──────┬──────────────┘\n       │ Allocate\n       ▼\n┌─────────────────────┐\n│ ALLOCATED_TO_SALE   │ ⚙ Business Rule\n│  (Reserved)         │ Linked to customer\n└──────┬──────────────┘\n       │ Payment\n       ▼\n┌─────────────────────┐\n│       SOLD          │ ◉ End Event\n│  (Final Status)     │ Complete\n└─────────────────────┘\n```\n\n---\n\n## **BPMN Legend**\n\n| Symbol | Meaning | Description |\n|--------|---------|-------------|\n| **◉** | Start/End Event | Beginning or completion of process |\n| **✓** | User Task | Requires manual user action |\n| **⚙** | Service Task | Automated system action |\n| **⧗** | Timer Event | Time-based waiting period |\n| **◆** | Gateway | Decision point or parallel paths |\n| **⚡** | Important Note | Critical information |\n\n---\n\n## **Status Descriptions**\n\n### **1. SHIPPED** [Factory]\n\n**Triggered by:** Factory user creates batch\n**Actor:** Factory Manager\n**Next Status:** WAITING_AIRPORT_RECEIPT\n\n**Description:**\nBatch has left the mining site and is in transit to airport facility.\n\n---\n\n### **2. WAITING_AIRPORT_RECEIPT** [In Transit]\n\n**Triggered by:** Automatic (after SHIPPED)\n**Actor:** System / Transport\n**Next Status:** RECEIVED_AT_AIRPORT\n\n**Description:**\nBatch is expected at airport. Airport team notified.\n\n**Duration:** Typically 1-3 days\n\n---\n\n### **3. RECEIVED_AT_AIRPORT** [Airport]\n\n**Triggered by:** Airport team confirmation\n**Actor:** Airport Receiving Officer\n**Next Status:** VALIDATED_FOR_TRANSPORT\n\n**Description:**\nPhysical receipt confirmed. Weight variance check performed.\n\n**Required Actions:**\n- ✓ Physical inspection\n- ✓ Weight verification\n- ✓ Document validation\n- ✓ Variance report (if needed)\n\n---\n\n### **4. VALIDATED_FOR_TRANSPORT** [Airport]\n\n**Triggered by:** Airport validation\n**Actor:** Airport Supervisor\n**Next Status:** WAITING_REFINERY_RECEIPT\n\n**⚡ SPECIAL:** Batch is **PRE-SALES ELIGIBLE** at this stage\n\n**Description:**\nBatch validated and ready for refinery transport. Can be sold before processing.\n\n**Business Rule:**\nPre-sales allowed for validated batches with estimated fineness.',
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
        content: '# Pre-Sales Overview\n\n## **What is a Pre-Sale?**\n\nA pre-sale allows you to sell a validated batch **before** it arrives at the factory. This enables:\n\n- **Locking in prices early**\n- **Securing customer commitments**\n- **Improving cash flow**\n- **Reducing market risk**\n\n---\n\n## **Eligibility Criteria**\n\n### **Batch Requirements**\n\n✓ Status must be **VALIDATED_FOR_TRANSPORT**\n✓ Must be from **airport validation**\n✓ No existing active pre-sale\n✓ Weight variance within tolerance\n\n---\n\n## **Process Flow**\n\n1. **Batch Validated** - Airport confirms batch ready\n2. **Create Pre-Sale** - Sales team creates pre-sale\n3. **Management Approval** - Management reviews and approves\n4. **Customer Approval** - Customer confirms purchase\n5. **Batch Arrives** - Physical batch arrives at factory\n6. **Reconciliation** - Compare estimated vs actual\n7. **Conversion** - Pre-sale converts to regular sale\n8. **Payment** - Payment processed',
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
        content: '# Sales Process Overview\n\n## **Sales Workflow**\n\n### **1. CREATE_SALES** (Initial)\n\nSales person creates a new sale from available inventory.\n\n### **2. PENDING_MANAGEMENT_APPROVAL**\n\nManagement reviews sale details and pricing.\n\n### **3. PENDING_CUSTOMER_APPROVAL**\n\nCustomer receives notification and approves purchase.\n\n### **4. PENDING_PAYMENT**\n\nWaiting for customer payment confirmation.\n\n### **5. PAYMENT_RECEIVED**\n\nPayment confirmed. Transaction complete.\n\n---\n\n## **Key Features**\n\n- **Price Calculation** - Automatic calculation with London AM rates\n- **Multi-Currency** - Support for USD, EUR, XOF, GNF\n- **Approval Workflow** - Management and customer approval\n- **Payment Tracking** - Complete payment lifecycle\n- **Commission Calculation** - Automatic royalties (3%)\n- **FX Rate Tracking** - Real-time exchange rates',
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
        content: '# Inventory Management\n\n## **Inventory Sources**\n\n### **From Batches**\n\nWhen a batch completes refining:\n- Status changes to "processed" or "inventory"\n- Gold automatically added to inventory\n- Weight and fineness recorded\n- Ready for sale\n\n### **From Pre-Sales**\n\nWhen pre-sale converts:\n- Inventory allocated to customer\n- Remaining balance available\n- Reconciliation complete\n\n---\n\n## **Stock Types**\n\n### **Available Stock**\n\nGold ready for sale, not allocated to any sale.\n\n### **Allocated Stock**\n\nGold reserved for specific sales, awaiting payment.\n\n### **Sold Stock**\n\nGold sold and paid for, awaiting delivery.\n\n---\n\n## **Tracking**\n\n- **Real-time balances** - Current stock levels\n- **Batch traceability** - Complete audit trail\n- **Valuation** - Current market value\n- **Movement history** - All transactions logged',
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
        content: '# User Roles & Permissions\n\n## **Available Roles**\n\n### **Factory**\n\n**Responsibilities:**\n- Create new batches\n- Ship batches to airport\n- Upload documents\n- View batch status\n\n### **Airport**\n\n**Responsibilities:**\n- Confirm batch receipt\n- Validate for transport\n- Manage variance reports\n- Track shipments\n\n### **Refinery**\n\n**Responsibilities:**\n- Confirm batch receipt\n- Process and refine gold\n- Record fineness data\n- Manage inventory\n\n### **Management**\n\n**Responsibilities:**\n- Approve sales\n- Monitor all operations\n- Access analytics\n- Manage users\n- Configure system\n\n### **Customer**\n\n**Responsibilities:**\n- View assigned sales\n- Approve purchases\n- Submit payment proof\n- Download invoices',
        lastUpdated: '2025-11-03',
      },
    ],
  },
];

export function searchHelpContent(query: string): HelpArticle[] {
  const lowercaseQuery = query.toLowerCase();
  const results: HelpArticle[] = [];

  helpCategories.forEach((category) => {
    category.articles.forEach((article) => {
      const matchesTitle = article.title.toLowerCase().includes(lowercaseQuery);
      const matchesTags = article.tags.some((tag) =>
        tag.toLowerCase().includes(lowercaseQuery)
      );
      const matchesContent = article.content.toLowerCase().includes(lowercaseQuery);
      const matchesCategory = category.title.toLowerCase().includes(lowercaseQuery);

      if (matchesTitle || matchesTags || matchesContent || matchesCategory) {
        results.push(article);
      }
    });
  });

  return results;
}

export function getArticleById(id: string): HelpArticle | null {
  for (const category of helpCategories) {
    const article = category.articles.find((a) => a.id === id);
    if (article) return article;
  }
  return null;
}

export function getRelatedArticles(articleId: string): HelpArticle[] {
  const article = getArticleById(articleId);
  if (!article || !article.relatedModules) return [];

  const related: HelpArticle[] = [];
  helpCategories.forEach((category) => {
    category.articles.forEach((a) => {
      if (a.id !== articleId && a.relatedModules) {
        const hasCommonModule = a.relatedModules.some((module) =>
          article.relatedModules?.includes(module)
        );
        if (hasCommonModule) {
          related.push(a);
        }
      }
    });
  });

  return related.slice(0, 3);
}
