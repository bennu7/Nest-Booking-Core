#!/bin/bash
# ============================================
# Create Empty Migration (Manual SQL)
# Fungsi: Create migration kosong untuk manual SQL editing
# ============================================

set -e

# Get the directory where the script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_ROOT"

# Colors
BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

# Check if migration name is provided
if [ -z "$1" ]; then
    print_warning "Migration name not provided."
    read -p "Enter migration name: " MIGRATION_NAME
else
    MIGRATION_NAME="$1"
fi

echo ""
print_info "Creating empty migration: $MIGRATION_NAME"
echo ""

# Create empty migration
bun x prisma migrate dev --create-only --name "$MIGRATION_NAME"

# Find the latest migration directory
MIGRATION_DIR=$(ls -td prisma/migrations/*/ | head -n 1)

echo ""
print_success "Empty migration created!"
echo ""
print_info "Migration file: ${MIGRATION_DIR}migration.sql"
print_warning "⚠️  Don't forget to edit the SQL file manually!"
echo ""
print_info "Opening migration file for editing..."

# Try to open with default editor (VS Code, vim, or nano)
if command -v code &> /dev/null; then
    code "${MIGRATION_DIR}migration.sql"
elif command -v vim &> /dev/null; then
    vim "${MIGRATION_DIR}migration.sql"
else
    nano "${MIGRATION_DIR}migration.sql"
fi

echo ""
print_info "After editing, apply migration with: bun run db:migrate"
