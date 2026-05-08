#!/bin/bash
# ============================================
# 08. Database Pull
# Fungsi: Pull database schema to preview (read-only, tidak mengubah database)
# ============================================

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_ROOT"

BLUE='\033[0;34m'
GREEN='\033[0;32m'
NC='\033[0m'

print_info() { echo -e "${BLUE}ℹ️  $1${NC}"; }
print_success() { echo -e "${GREEN}✅ $1${NC}"; }

echo ""
print_info "📥 Pulling database schema (preview only)..."
echo ""

# Pull schema and save to prisma/schema.pulled.prisma for review
bun x prisma db pull --print

echo ""
print_success "✅ Schema pulled! (Database tidak diubah)"