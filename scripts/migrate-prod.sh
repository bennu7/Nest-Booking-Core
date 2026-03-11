#!/bin/bash
# ============================================
# Apply Pending Migrations (Production)
# Fungsi: Apply migration yang sudah ada ke database (tanpa create baru)
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
RED='\033[0;31m'
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

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

echo ""
print_warning "⚠️  PRODUCTION MIGRATION"
echo ""
print_info "This will apply all pending migrations to the database."
print_info "Database URL: $(grep DATABASE_URL .env | cut -d '=' -f2 | sed 's/.*@/***@/' | sed 's/:.*@/:***@/')"
echo ""
read -p "Are you sure you want to continue? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    print_info "Migration cancelled."
    exit 0
fi

echo ""
print_info "Validating schema..."
bun x prisma validate

print_info "Applying migrations..."
bun x prisma migrate deploy

print_info "Generating Prisma Client..."
bun x prisma generate

echo ""
print_success "✅ Production migration completed successfully!"
echo ""
