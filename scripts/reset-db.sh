#!/bin/bash
# ============================================
# Reset Database (DEVELOPMENT ONLY!)
# Fungsi: Drop semua tables dan recreate dari scratch
# ⚠️  WARNING: Ini akan MENGHAPUS semua data!
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
print_error "⚠️  ⚠️  ⚠️  DANGER ZONE  ⚠️  ⚠️  ⚠️"
echo ""
print_error "This will COMPLETELY RESET your database!"
print_error "ALL DATA WILL BE LOST FOREVER!"
echo ""
print_warning "Database: $(grep DATABASE_URL .env | cut -d '=' -f2 | sed 's/.*\///' | sed 's/?.*//')"
echo ""
read -p "Type 'RESET_DATABASE' to confirm: " CONFIRM

if [ "$CONFIRM" != "RESET_DATABASE" ]; then
    print_info "Reset cancelled."
    exit 0
fi

echo ""
print_warning "You've been warned. This is your last chance!"
read -p "Are you ABSOLUTELY SURE? Type 'I_AM_SURE': " FINAL_CONFIRM

if [ "$FINAL_CONFIRM" != "I_AM_SURE" ]; then
    print_info "Reset cancelled."
    exit 0
fi

echo ""
print_info "Resetting database..."
bun x prisma migrate reset --force

echo ""
print_success "✅ Database reset completed!"
print_info "All tables have been recreated from scratch."
print_info "All data has been permanently deleted."
