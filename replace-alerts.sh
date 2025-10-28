#!/bin/bash

# Script to replace all alert() calls with useAlert hook

# Files to process (excluding test files, node_modules, and specific UI components)
FILES=$(grep -rl "alert(" src --include="*.tsx" --include="*.ts" | grep -v "useAlert\|AlertBox\|AlertCircle\|Alert.tsx\|test\|spec")

echo "Found $(echo "$FILES" | wc -l) files with alert() calls"
echo "Files to process:"
echo "$FILES"
echo ""
echo "This script will:"
echo "1. Add 'import { useAlert } from '@/hooks/useAlert';' if not present"
echo "2. Add 'const alert = useAlert();' in the component"
echo "3. Replace alert('message') with alert.info('message')"
echo ""
echo "Manual review will be needed after to determine correct alert types (success/error/warning/info)"
