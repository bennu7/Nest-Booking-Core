#!/bin/bash
# ============================================
# 01. Database Setup
# Fungsi: Setup database dari 0 (create DB + migrate + generate)
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
print_info "🚀 Database Setup"
echo ""

if [ ! -f .env ]; then
    print_error ".env file not found!"
    exit 1
fi

print_info "Validating Prisma schema..."
bun x prisma validate

print_info "Generating Prisma Client..."
bun x prisma generate

echo ""
print_warning "This will apply ALL migrations to the database."
read -p "Continue? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    print_info "Setup cancelled."
    exit 0
fi

print_info "Running migrations..."
bun x prisma migrate dev

echo ""
print_success "✅ Database setup completed!"