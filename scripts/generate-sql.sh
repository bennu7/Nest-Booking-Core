#!/bin/bash
# ============================================
# Generate SQL from Prisma Schema
# Fungsi: Generate SQL tanpa apply migration (untuk review/manual execution)
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

echo ""
print_info "Generating SQL from Prisma schema..."
echo ""

# Generate migration SQL without applying it
print_info "Creating draft migration..."
bun x prisma migrate dev --create-only --name manual_review

# Find the latest migration directory
MIGRATION_DIR=$(ls -td prisma/migrations/*/ | head -n 1)

if [ -f "${MIGRATION_DIR}migration.sql" ]; then
    echo ""
    print_success "SQL generated successfully!"
    echo ""
    print_info "SQL file location: ${MIGRATION_DIR}migration.sql"
    echo ""
    print_info "Preview first 50 lines:"
    echo "─────────────────────────────────────"
    head -n 50 "${MIGRATION_DIR}migration.sql"
    echo "─────────────────────────────────────"
    echo ""
    print_warning "Note: This is a DRAFT migration. It has NOT been applied to the database."
    echo ""
    print_info "To apply this migration, run: bun run db:migrate"
    print_info "To view full SQL: cat ${MIGRATION_DIR}migration.sql"
else
    print_error "Migration SQL file not found!"
    exit 1
fi
