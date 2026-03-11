#!/bin/bash
# ============================================
# Database Setup Helper
# Fungsi: Setup database dari 0 (create DB + migrate)
# ============================================

set -e

# Get the directory where the script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
# Navigate to project root (one level up from scripts/)
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Change to project root directory
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
print_info "🚀 Database Setup Wizard"
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    print_error ".env file not found! Please create .env with DATABASE_URL first."
    exit 1
fi

# Check if DATABASE_URL is set
if ! grep -q "DATABASE_URL=" .env; then
    print_error "DATABASE_URL not found in .env!"
    exit 1
fi

print_info "Validating Prisma schema..."
bun x prisma validate

print_info "Generating Prisma Client..."
bun x prisma generate

echo ""
print_warning "This will create the database and apply all migrations."
read -p "Continue? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    print_info "Setup cancelled."
    exit 0
fi

echo ""
print_info "Creating database and applying migrations..."

# Try to create database (will fail if already exists, which is fine)
bun x prisma migrate dev --name init || print_warning "Database might already exist, continuing..."

echo ""
print_success "✅ Database setup completed!"
echo ""
print_info "You can now:"
echo "  - Start your app: bun run start:dev"
echo "  - View database: bun x prisma studio"
echo "  - Check tables: bun x prisma db pull"
