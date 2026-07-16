@echo off
:: Verifica se está rodando como Administrador para poder liberar as portas no Firewall
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo Solicitando privilegios de administrador para liberar portas no Firewall e iniciar a Agenda...
    powershell -Command "Start-Process '%~dpnx0' -Verb RunAs"
    exit /b
)

title Servidor Local - FocoFacil (Agenda TDAH)
echo =======================================================
echo     INICIANDO SERVIDOR DO FOCOFACIL (AGENDA TDAH)
echo =======================================================
echo.

echo Configurando regras do Firewall do Windows...
powershell -NoProfile -ExecutionPolicy Bypass -Command "New-NetFirewallRule -DisplayName 'Vigi Central 3030' -Direction Inbound -Action Allow -Protocol TCP -LocalPort 3030 -ErrorAction SilentlyContinue; New-NetFirewallRule -DisplayName 'Vigi Agenda 8085' -Direction Inbound -Action Allow -Protocol TCP -LocalPort 8085 -ErrorAction SilentlyContinue" >nul 2>&1

echo =======================================================
echo.
echo O servidor sera executado localmente.
echo.
echo Link de Acesso: http://localhost:8085
echo.
echo Pressione Ctrl+C para encerrar o servidor.
echo =======================================================
echo.

:: Abre o navegador padrão no endereço do app
start http://localhost:8085

:: Executa o servidor Node
node server.js

pause
