@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
 echo Instale o Node.js 24 ou superior e abra este arquivo novamente.
 pause
 exit /b 1
)
node scripts/check-node.mjs
if errorlevel 1 (
 pause
 exit /b 1
)
if not exist node_modules (
 echo Instalando dependencias. Aguarde...
 call npm install
 if errorlevel 1 (
  echo A instalacao falhou. Verifique sua conexao.
  pause
  exit /b 1
 )
)
echo Abra http://localhost:3000 quando aparecer Ready.
echo Para encerrar, pressione Ctrl+C.
call npm run dev
pause
