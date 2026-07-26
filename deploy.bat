@echo off
REM ============================================================
REM  deploy.bat - Aggiorna e installa Turni sul telefono
REM  Catena: build web -> cap sync -> APK debug -> Turni.apk -> adb install
REM  Wireless: esegui prima wifi-setup.bat una volta (crea phone.txt).
REM  In alternativa via cavo: Debug USB attivo e telefono collegato.
REM ============================================================
setlocal enabledelayedexpansion

set ADB=%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe
if not exist "%ADB%" set ADB=adb

echo.
echo [1/5] Build web (vite)...
call npm run build || goto :error

echo.
echo [2/5] Sync Capacitor Android...
call npx cap sync android || goto :error

echo.
echo [3/5] Build APK debug (gradle)...
pushd android
call gradlew.bat assembleDebug || (popd & goto :error)
popd

echo.
echo [4/5] Copia APK in root come Turni.apk...
copy /Y "android\app\build\outputs\apk\debug\app-debug.apk" "Turni.apk" || goto :error

echo.
echo [5/5] Installazione sul telefono...
if exist "phone.txt" (
  set /p PHONE=<phone.txt
  echo Connessione wireless a !PHONE! ...
  "%ADB%" connect !PHONE!
)
"%ADB%" devices
"%ADB%" install -r "Turni.apk" || goto :error

echo.
echo ============================================================
echo  FATTO! Turni installato/aggiornato sul telefono.
echo ============================================================
goto :end

:error
echo.
echo !!! ERRORE durante il passo precedente. Controlla il messaggio sopra.
echo     - Nessun dispositivo? Esegui wifi-setup.bat (o collega il cavo).
echo     - "unauthorized"? Sblocca il telefono e accetta il popup.
echo     - Wi-Fi non risponde? Riesegui wifi-setup.bat: la porta puo' cambiare.
exit /b 1

:end
endlocal
