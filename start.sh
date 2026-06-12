#!/bin/bash
echo "Regni d'Oriente - Avvio in corso..."
if ! command -v node &> /dev/null; then
  echo "ERRORE: Node.js non trovato. Installa Node.js da https://nodejs.org"
  exit 1
fi
if [ ! -d "node_modules" ]; then
  echo "Prima installazione - attendere..."
  npm install
fi
npm start
