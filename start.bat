@echo off
echo Regni d'Oriente - Avvio in corso...
where node >nul 2>&1 || (
  echo ERRORE: Node.js non trovato. Installa Node.js da https://nodejs.org
  pause
  exit /b 1
)
if not exist node_modules (
  echo Prima installazione - attendere...
  call npm install
)
call npm start
