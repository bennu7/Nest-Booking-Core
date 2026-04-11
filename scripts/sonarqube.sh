#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$PROJECT_ROOT/.env"

if [ -f "$ENV_FILE" ]; then
  # Export semua variabel dari .env (format KEY=value) agar SONARQUBE_TOKEN tersedia
  set -a
  # shellcheck disable=SC1091
  source "$ENV_FILE"
  set +a
else
  echo "⚠️  File .env tidak ditemukan: $ENV_FILE"
  echo "   Set SONARQUBE_TOKEN di environment atau buat .env di root proyek."
fi

if [ -z "${SONARQUBE_TOKEN:-}" ]; then
  echo "❌ SONARQUBE_TOKEN kosong. Tambahkan di .env atau: export SONARQUBE_TOKEN=..."
  exit 1
fi

SONAR_SCANNER_BIN="$HOME/sonar-scanner-6.2.1/bin/sonar-scanner"

if [ ! -f "$SONAR_SCANNER_BIN" ]; then
  echo "❌ SonarScanner CLI 6.2.1 tidak ditemukan di: $SONAR_SCANNER_BIN"
  echo "💡 Download dengan perintah:"
  echo "   curl -L -o /tmp/sonar-scanner-cli.zip https://binaries.sonarsource.com/Distribution/sonar-scanner-cli/sonar-scanner-cli-6.2.1.4610-macosx-aarch64.zip"
  echo "   unzip /tmp/sonar-scanner-cli.zip -d ~/"
  echo "   mv ~/sonar-scanner-6.2.1.4610-macosx-aarch64 ~/sonar-scanner-6.2.1"
  exit 1
fi

cd "$PROJECT_ROOT"

echo "🔍 Menjalankan SonarQube analysis..."

"$SONAR_SCANNER_BIN" \
  -Dsonar.projectKey=Nest-Booking-Core \
  -Dsonar.sources=. \
  -Dsonar.host.url=http://localhost:9000 \
  -Dsonar.token="$SONARQUBE_TOKEN"
