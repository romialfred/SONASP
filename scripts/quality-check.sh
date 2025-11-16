#!/bin/bash

# Quality Control Check Script
# Ce script doit être exécuté avant chaque commit

echo "🔍 Gold Shipper - Quality Control Check"
echo "========================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

ERRORS=0
WARNINGS=0

# Function to print colored output
print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
    ((ERRORS++))
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
    ((WARNINGS++))
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# 1. Check for TypeScript errors
echo "1️⃣  Checking TypeScript..."
if npm run typecheck 2>&1 | grep -q "error TS"; then
    print_error "TypeScript errors found"
    npm run typecheck 2>&1 | grep "error TS" | head -5
else
    print_success "No TypeScript errors"
fi
echo ""

# 2. Build the project
echo "2️⃣  Building project..."
if npm run build > /tmp/build.log 2>&1; then
    print_success "Build successful"
else
    print_error "Build failed"
    tail -20 /tmp/build.log
fi
echo ""

# 3. Check for common code issues
echo "3️⃣  Checking for common code issues..."

# Check for console.log in production code (exclude test files)
if grep -r "console\.log" src/ --exclude-dir=test --exclude="*.test.tsx" --exclude="*.test.ts" | grep -v "console.error" | grep -v "console.warn" > /dev/null; then
    print_warning "console.log found in source code (consider removing for production)"
    grep -r "console\.log" src/ --exclude-dir=test --exclude="*.test.tsx" --exclude="*.test.ts" | grep -v "console.error" | grep -v "console.warn" | head -3
else
    print_success "No console.log in production code"
fi
echo ""

# Check for TODO comments
TODO_COUNT=$(grep -r "TODO" src/ --exclude-dir=node_modules | wc -l)
if [ "$TODO_COUNT" -gt 0 ]; then
    print_info "Found $TODO_COUNT TODO comments in code"
fi
echo ""

# 4. Check for common React anti-patterns
echo "4️⃣  Checking for React anti-patterns..."

# Check for setState in render (common cause of infinite loops)
if grep -r "setState" src/ | grep -v "useEffect" | grep -v "onClick" | grep -v "onChange" | grep -v "onSubmit" > /dev/null 2>&1; then
    print_warning "Potential setState in render detected (may cause infinite loop)"
fi

# Check for missing key props in map
if grep -r "\.map(" src/ | grep -v "key=" > /tmp/map_check.log 2>&1; then
    MISSING_KEY_COUNT=$(wc -l < /tmp/map_check.log)
    if [ "$MISSING_KEY_COUNT" -gt 0 ]; then
        print_warning "Potential missing 'key' prop in .map() ($MISSING_KEY_COUNT occurrences)"
    fi
fi

print_success "React anti-pattern check complete"
echo ""

# 5. Check for unused imports (basic check)
echo "5️⃣  Checking for potential unused imports..."
if grep -r "import.*from" src/ | grep -v "type" | wc -l > /dev/null; then
    print_info "Import analysis complete (run ESLint for detailed unused imports)"
fi
echo ""

# 6. Check file sizes
echo "6️⃣  Checking large files..."
LARGE_FILES=$(find src/ -name "*.tsx" -o -name "*.ts" | xargs wc -l | sort -rn | head -5 | awk '$1 > 500 {print $2 " (" $1 " lines)"}')
if [ ! -z "$LARGE_FILES" ]; then
    print_warning "Large files found (>500 lines):"
    echo "$LARGE_FILES"
else
    print_success "No excessively large files"
fi
echo ""

# 7. Check for proper error boundaries
echo "7️⃣  Checking error handling..."
if grep -r "ErrorBoundary" src/ > /dev/null; then
    print_success "Error boundary components found"
else
    print_warning "No error boundary components found (consider adding)"
fi
echo ""

# 8. Summary
echo "========================================"
echo "📊 Quality Check Summary"
echo "========================================"
echo ""

if [ $ERRORS -eq 0 ]; then
    print_success "All critical checks passed!"
else
    print_error "Found $ERRORS error(s)"
fi

if [ $WARNINGS -gt 0 ]; then
    print_warning "Found $WARNINGS warning(s)"
fi

echo ""

if [ $ERRORS -eq 0 ]; then
    echo -e "${GREEN}✅ Ready to commit!${NC}"
    exit 0
else
    echo -e "${RED}❌ Please fix errors before committing${NC}"
    exit 1
fi
