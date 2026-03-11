#!/bin/bash
# ============================================
# Prisma Migration Script
# Fungsi: Create & apply migration untuk development
# ============================================

set -e  # Exit on error

# Get the directory where the script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
# Navigate to project root (one level up from scripts/)
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Change to project root directory
cd "$PROJECT_ROOT"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
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

# Check if migration name is provided
if [ -z "$1" ]; then
    print_warning "Migration name not provided. Using 'init' as default."
    MIGRATION_NAME="init"
else
    MIGRATION_NAME="$1"
fi

print_info "Starting Prisma migration creation..."
print_info "Migration name: $MIGRATION_NAME"

# Validate schema first
print_info "Validating Prisma schema..."
bun x prisma validate

# Create and apply migration
print_info "Creating migration..."
bun x prisma migrate dev --name "$MIGRATION_NAME"

# Generate Prisma Client
print_info "Generating Prisma Client..."
bun x prisma generate

echo ""
print_success "Migration completed successfully!"
echo ""
print_info "Next steps:"
echo "  1. Check the generated migration file in prisma/migrations/"
echo "  2. Run your NestJS app: bun run start:dev"
echo "  3. View database: bun x prisma studio"
