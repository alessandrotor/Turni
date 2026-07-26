@echo off
REM ============================================================
REM  wifi-setup.bat - Abbina il telefono via Wi-Fi (una tantum)
REM  Richiede Android 11+ (Debug wireless). Nessun cavo necessario.
REM  Al termine crea phone.txt: dopo, usa solo deploy.bat.
REM ============================================================
setlocal

set ADB=%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe
if not exist "%ADB%" set ADB=adb

echo.
echo === SETUP WIRELESS (una volta sola) ===
echo.
echo Sul telefono:
echo   1. Impostazioni -^> Opzioni sviluppatore -^> Debug wireless -^> ON
echo   2. PC e telefono devono essere sulla STESSA rete Wi-Fi
echo   3. Tocca "Abbina dispositivo con codice di abbinamento"
echo      (mostra un IP:PORTA e un codice di 6 cifre)
echo.
set /p PAIRADDR="Inserisci IP:PORTA di ABBINAMENTO (es. 192.168.1.50:37123): "
set /p PAIRCODE="Inserisci il CODICE di 6 cifre: "
echo.
echo Abbinamento in corso...
"%ADB%" pair %PAIRADDR% %PAIRCODE%
if errorlevel 1 (
  echo.
  echo !!! Abbinamento fallito.
  echo     - Codice/porta scadono in ~1 minuto: rigenerali e riprova subito.
  echo     - Controlla di aver copiato bene IP:PORTA e le 6 cifre.
  echo.
  pause
  exit /b 1
)

echo.
echo Abbinamento OK.
echo Torna alla schermata principale di "Debug wireless" del telefono
echo e leggi il campo "Indirizzo IP e porta" (PORTA DIVERSA da quella sopra).
echo.
set /p CONNADDR="Inserisci IP:PORTA di CONNESSIONE (es. 192.168.1.50:41567): "
echo.
echo Connessione in corso...
"%ADB%" connect %CONNADDR%
if errorlevel 1 (
  echo.
  echo !!! Connessione fallita. Verifica IP:PORTA e la rete Wi-Fi.
  echo.
  pause
  exit /b 1
)

> phone.txt echo %CONNADDR%
echo.
echo ============================================================
echo  ABBINATO! Indirizzo salvato in phone.txt
echo  Da ora usa solo deploy.bat (build + installazione wireless).
echo ============================================================
echo.
pause
endlocal
