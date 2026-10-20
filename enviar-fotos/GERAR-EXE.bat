@echo off
rem Gera dist\EnviarFotos.exe com o token.json embutido. Rode na maquina do DONO.
cd /d "%~dp0"
if not exist token.json (
  echo Falta o token.json. Rode antes:  python autorizar.py
  pause & exit /b 1
)
python -m pip install -r requirements.txt || (pause & exit /b 1)
python teste_enviador.py || (echo Os testes falharam. Nao gerei o .exe. & pause & exit /b 1)
python -m PyInstaller --noconfirm --clean --onefile --windowed --name EnviarFotos ^
  --collect-data googleapiclient --add-data "token.json;." enviar_fotos.py || (pause & exit /b 1)
echo.
echo Pronto: dist\EnviarFotos.exe  (contem o token: NAO publique este arquivo)
pause
