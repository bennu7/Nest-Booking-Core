#!/bin/bash
# ============================================
# 07. Database Reset
# Fungsi: Reset database (drop all tables + re-run migrations + seed)
# ============================================

set -e

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

echo ""
print_warning "⚠️  WARNING: This will DROP ALL TABLES and recreate from scratch!"
print_warning "All data will be LOST!"
echo ""
read -p "Type 'yes' to confirm: " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    print_info "Reset cancelled."
    exit 0
fi

print_info "Resetting database..."
bun x prisma migrate reset --force

print_info "Generating Prisma Client..."
bun x prisma generate

echo ""
print_success "✅ Database reset completed!"