#!/bin/bash
# ============================================
# 02. Database Migrate
# Fungsi: Apply schema changes ke database
# Pencegahan: Cek schema changes sebelum migrate
# ============================================

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_ROOT"

BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

print_info() { echo -e "${BLUE}ℹ️  $1${NC}"; }
print_success() { echo -e "${GREEN}✅ $1${NC}"; }
print_warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }
print_error() { echo -e "${RED}❌ $1${NC}"; }

MIGRATION_NAME="${1:-auto_migration}"

echo ""
print_info "🔄 Applying migrations to database..."
print_info "Migration name: $MIGRATION_NAME"
echo ""

# Step 1: Validate schema first
print_info "Validating Prisma schema..."
if ! bun x prisma validate 2>/dev/null; then
    print_error "Schema validation failed!"
    exit 1
fi

# Step 2: Check migration status - apakah ada perubahan schema?
print_info "Checking migration status..."

# Simpan output status ke variable
MIGRATE_STATUS_OUTPUT=$(bun x prisma migrate status 2>&1)

# Cek apakah schema sudah up to date
if echo "$MIGRATE_STATUS_OUTPUT" | grep -q "Database schema is up to date"; then
    echo ""
    print_warning "⚠️  No schema changes detected!"
    print_info "Your database is already in sync with Prisma schema."
    echo ""
    print_info "If you only need to update TypeScript client, run:"
    print_info "  → bun run db:generate"
    echo ""
    read -p "Continue with migration anyway? (yes/no): " CONFIRM
    
    if [ "$CONFIRM" != "yes" ]; then
        print_info "Migration cancelled. No changes made."
        exit 0
    fi
    
    echo ""
    print_info "Continuing with migration..."
fi

echo ""
print_info "Pending migrations or schema changes found! Proceeding..."

# Step 3: Run migration
print_info "Running migrations..."
bun x prisma migrate dev --name "$MIGRATION_NAME"

# Step 4: Generate client
print_info "Generating Prisma Client..."
bun x prisma generate

echo ""
print_success "✅ Migration completed!"
print_info "Database schema is now in sync with Prisma schema."