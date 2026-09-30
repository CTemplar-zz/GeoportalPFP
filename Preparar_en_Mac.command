#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"
if [ "$(uname -s)" != "Darwin" ]; then
  echo "La preparación nativa requiere una Mac con Xcode."
  exit 1
fi
command -v node >/dev/null || { echo "Instala Node.js 22 o superior."; exit 1; }
node -e "if(Number(process.versions.node.split('.')[0])<22)process.exit(1)" || { echo "Se requiere Node.js 22 o superior."; exit 1; }
xcodebuild -version
echo "Instalando dependencias locales y preparando el proyecto de iPhone..."
npm ci
npm run icons
npm run sync
npm run verify:ios
echo "Selecciona tu Team en Signing & Capabilities antes de compilar o archivar."
open ios/App/App.xcodeproj
