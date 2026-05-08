#!/bin/bash
# ============================================
# 03. Database Generate
# Fungsi: Generate TypeScript client dari schema
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
print_info "🔧 Generating Prisma Client..."
echo ""

print_info "Validating schema..."
bun x prisma validate

print_info "Generating client..."
bun x prisma generate

echo ""
print_success "✅ Prisma Client generated!"