#!/bin/bash
# ============================================
# Show Migration Status
# Fungsi: Cek status migration yang sudah/sedang/belum di-apply
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

echo ""
print_info "Checking migration status..."
echo ""
echo "─────────────────────────────────────"

# Show migration history
bun x prisma migrate status

echo ""
echo "─────────────────────────────────────"
echo ""
print_info "To view migration files:"
echo "  ls -la prisma/migrations/"
echo ""
print_info "To view specific migration SQL:"
echo "  cat prisma/migrations/<migration_name>/migration.sql"
