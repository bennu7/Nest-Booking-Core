#!/bin/bash

SONAR_SCANNER_BIN="$HOME/sonar-scanner-6.2.1/bin/sonar-scanner"

if [ ! -f "$SONAR_SCANNER_BIN" ]; then
  echo "❌ SonarScanner CLI 6.2.1 tidak ditemukan di: $SONAR_SCANNER_BIN"
  echo "💡 Download dengan perintah:"
  echo "   curl -L -o /tmp/sonar-scanner-cli.zip https://binaries.sonarsource.com/Distribution/sonar-scanner-cli/sonar-scanner-cli-6.2.1.4610-macosx-aarch64.zip"
  echo "   unzip /tmp/sonar-scanner-cli.zip -d ~/"
  echo "   mv ~/sonar-scanner-6.2.1.4610-macosx-aarch64 ~/sonar-scanner-6.2.1"
  exit 1
fi

echo "🔍 Menjalankan SonarQube analysis..."

$SONAR_SCANNER_BIN \
  -Dsonar.projectKey=Nest-Booking-Core \
  -Dsonar.sources=. \
  -Dsonar.host.url=http://localhost:9000 \
  -Dsonar.token=sqp_646a2a99dfc51ee0d5989745d3b18972a3fa27c1