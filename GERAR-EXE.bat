@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
title Gerar executavel - GradeFacil

echo ==================================================
echo   GradeFacil - gerando o executavel (.exe)
echo ==================================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo [ERRO] O Node.js nao esta instalado.
  echo Baixe a versao LTS em https://nodejs.org , instale e rode este arquivo de novo.
  echo.
  pause
  exit /b 1
)

echo [1/4] Instalando dependencias (a primeira vez demora alguns minutos)...
call npm install --no-audit --no-fund
if errorlevel 1 goto :falhou

echo.
echo [2/4] Rodando os testes...
call npm test
if errorlevel 1 goto :falhou

echo.
echo [3/4] Limpando builds antigos...
if exist release rmdir /s /q release
if exist dist rmdir /s /q dist

echo.
echo [4/4] Compilando o instalador e a versao portatil...
call npm run dist
if errorlevel 1 goto :falhou

echo.
echo ==================================================
echo   PRONTO! Os arquivos estao na pasta "release":
echo ==================================================
dir /b release\*.exe
echo.
echo   - "...Setup..." = instalador (cria atalho na area de trabalho)
echo   - o outro .exe = versao portatil (roda sem instalar)
echo.
start "" explorer "%~dp0release"
pause
exit /b 0

:falhou
echo.
echo [ERRO] Algo deu errado na etapa acima. Leia a mensagem e tente de novo.
echo Se o erro for de permissao, execute este arquivo como Administrador.
echo.
pause
exit /b 1
