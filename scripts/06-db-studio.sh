#!/bin/bash
# ============================================
# 06. Database Studio
# Fungsi: Open Prisma Studio (visual DB browser)
# ============================================

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_ROOT"

BLUE='\033[0;34m'
NC='\033[0m'

print_info() { echo -e "${BLUE}ℹ️  $1${NC}"; }

echo ""
print_info "🎨 Opening Prisma Studio..."
echo ""

bun x prisma studio