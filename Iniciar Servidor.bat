@echo off
title Servidor Local - FocoFacil (Agenda TDAH)
echo =======================================================
echo     INICIANDO SERVIDOR DO FOCOFACIL (AGENDA TDAH)
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
