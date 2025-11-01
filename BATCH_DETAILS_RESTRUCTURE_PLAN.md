# BATCH DETAILS PAGE - COMPLETE RESTRUCTURE

## CURRENT PROBLEMS ❌

1. **Field Guide Panel NOT integrated** - Completely missing
2. **BatchDocuments module NOT integrated** - Needs to be added
3. **Layout wrong** - Field Guide should be on RIGHT pane, not below Assay Certificates
4. **Timeline on right** - Correct (don't touch)
5. **Code too long** - 977 lines, needs modularization

## NEW STRUCTURE ✅

```
┌──────────────────────────────────────────────────────────────────┐
│ Header: Back button + Batch Number + Edit                        │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│ Status Flow: Visual timeline of batch progression                 │
└──────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────┬──────────────────────────────┐
│ LEFT PANEL (Main Content)          │ RIGHT PANEL (Reference)      │
├────────────────────────────────────┼──────────────────────────────┤
│ 1. Batch Information Card          │ ACCORDION SECTIONS:          │
│    - Metal type, weight, dates     │                              │
│    - Origin/current site           │ 1. Field Guide Panel    📖   │
│    - Created by, comments          │    - Contextual help         │
│                                    │    - Field descriptions      │
│ 2. Assay Certificates Card         │    - Examples & rules        │
│    - Upload form                   │                              │
│    - List of certificates          │ 2. Timeline Panel       🕐   │
│    - View/Download/Approve         │    - Status history          │
│                                    │    - Events with dates       │
│ 3. Batch Documents Card      NEW!  │    - Changed by info         │
│    - Upload any document           │                              │
│    - Filter by type/stage          │ (Accordion allows collapse)  │
│    - View PDFs inline              │                              │
│    - Download/Delete               │                              │
│                                    │                              │
│ 4. Validation Actions (if needed)  │                              │
│    - Validate for Transport        │                              │
│    - Reject Batch                  │                              │
│                                    │                              │
│ 5. Airport Receiving Form          │                              │
│    (if status = validated)         │                              │
│    - Weight confirmation           │                              │
│    - Freight company               │                              │
│    - Variance detection            │                              │
└────────────────────────────────────┴──────────────────────────────┘
```

## LAYOUT SPECIFICATIONS

### Left Panel (70% width)
- `lg:col-span-2` (8 columns out of 12)
- Scrollable vertically
- Spacing: `space-y-6`

### Right Panel (30% width)
- Fixed position with accordion
- 2 collapsible sections:
  1. Field Guide (expanded by default)
  2. Timeline (collapsed by default)
- Sticky top positioning

## FIELD GUIDE CONTENT

Field Guide will show contextual help for:

### Batch Information Section
- Batch Number: Auto-generated format
- Metal Type: Gold or Silver
- Weight: Grams and ounces conversion
- Shipping Date: When batch left origin
- Origin Site: Where material was mined
- Current Site: Current location

### Assay Certificates Section
- File Upload: PDF only, max 10MB
- Certificate Number: From assay lab
- Gold Content %: Purity percentage
- Fine Gold Weight: Calculated amount

### Batch Documents Section
- Document Types: 8 types available
- Lifecycle Stages: 6 stages
- File Formats: PDF, JPG, PNG, DOC
- Storage: Secure private bucket

### Airport Receiving
- Received Weight: Actual weight at airport
- Variance Tolerance: 0.5% acceptable
- Freight Company: Airport to refinery transport
- Receipt Date: When received

## COMPONENT BREAKDOWN

### Main Component: BatchDetailsWorkflow.tsx

**Responsibilities:**
- Fetch batch data
- Manage overall state
- Coordinate sub-components
- Handle status updates
- Real-time subscriptions

**Sub-components to use:**
1. `BatchInformationCard` - Display batch info
2. `AssayCertificateUpload` - Upload certs
3. `AssayCertificatesList` - List certs
4. `BatchDocuments` - NEW! Document management
5. `FieldGuidePanel` - Contextual help
6. `TimelinePanel` - Status history

## FIELD GUIDE DATA STRUCTURE

```typescript
const batchFieldGuides: FieldGuideItem[] = [
  {
    field: 'batch_number',
    label: 'Batch Number',
    description: 'Unique identifier auto-generated for each batch',
    example: 'BATCH-2024-001',
    required: true,
    section: 'Basic Information'
  },
  {
    field: 'metal_type',
    label: 'Metal Type',
    description: 'Type of precious metal in this batch',
    example: 'Gold, Silver',
    required: true,
    section: 'Basic Information'
  },
  // ... more fields
];
```

## ACCORDION IMPLEMENTATION

```typescript
const [accordionState, setAccordionState] = useState({
  fieldGuide: true,  // Expanded by default
  timeline: false,   // Collapsed by default
});

const toggleSection = (section: 'fieldGuide' | 'timeline') => {
  setAccordionState(prev => ({
    ...prev,
    [section]: !prev[section]
  }));
};
```

## MIGRATION CHECKLIST

- [x] Create BatchDocuments component
- [ ] Add Field Guide data for batch page
- [ ] Restructure layout (left/right split)
- [ ] Add accordion to right panel
- [ ] Integrate BatchDocuments in left panel
- [ ] Move Field Guide to right panel
- [ ] Keep Timeline in right panel
- [ ] Test all functionality
- [ ] Remove obsolete code

## CODE ORGANIZATION

### Keep:
- ✅ Batch data fetching logic
- ✅ Status update functions
- ✅ Airport receiving logic
- ✅ Real-time subscriptions
- ✅ Timeline rendering (move to right)

### Add:
- ✅ BatchDocuments component import
- ✅ FieldGuidePanel component
- ✅ Accordion state management
- ✅ Field guide data

### Remove:
- ❌ Inline timeline (move to component)
- ❌ Old layout structure
- ❌ Duplicate code

## FILES TO MODIFY

1. **src/pages/batches/BatchDetailsWorkflow.tsx**
   - Complete restructure
   - Add imports
   - New layout
   - Integrate components

2. **NEW: src/data/batchFieldGuides.ts**
   - Field guide data
   - Organized by sections

## ESTIMATED CHANGES

- Lines of code: 977 → ~600 (modularized)
- New imports: 2 (BatchDocuments, FieldGuidePanel)
- New data file: batchFieldGuides.ts
- Layout change: Single column → Two column grid
- Right panel: Accordion with 2 sections

## SUCCESS CRITERIA

✅ Field Guide visible on right panel
✅ Field Guide in accordion (collapsible)
✅ Timeline on right panel in accordion
✅ BatchDocuments working on left panel
✅ All filters working in BatchDocuments
✅ PDF viewer working
✅ Upload/Download/Delete working
✅ Layout responsive
✅ No console errors
✅ Build successful

---

READY TO IMPLEMENT ✅
