@echo off
chcp 65001 >nul
title Monfredini Transportes - Gestão de Rotas
cls
echo ========================================================
echo         MONFREDINI TRANSPORTES - GESTÃO DE ROTAS
echo ========================================================
echo.
echo Verificando instalação do Node.js no seu computador...
node -v >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo [ATENÇÃO] O Node.js não foi encontrado no seu computador!
    echo Para rodar o sistema, baixe e instale a versão recomendada do Node.js em:
    echo https://nodejs.org/ (versão LTS)
    echo.
    echo Após instalar o Node.js, dê dois cliques neste arquivo novamente.
    echo.
    pause
    exit /b
)

echo Node.js detectado com sucesso!
echo.
echo [1/2] Verificando e instalando pacotes necessários...
call npm install
if %errorlevel% neq 0 (
    echo.
    echo Erro ao instalar dependências. Verifique sua conexão.
    pause
    exit /b
)

echo.
echo [2/2] Iniciando o sistema Monfredini Transportes...
echo O sistema abrirá em instantes no seu navegador: http://localhost:3000
echo.
start http://localhost:3000
call npm run dev
pause
