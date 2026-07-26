@echo off
REM ============================================================
REM  deploy.bat - Aggiorna e installa Turni sul telefono
REM  Catena: build web -> cap sync -> APK debug -> Turni.apk -> adb install
REM  Prerequisiti sul telefono: Opzioni sviluppatore + Debug USB attivo,
REM  telefono collegato via cavo (o via Wi-Fi, vedi note in fondo).
REM ============================================================
setlocal

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
echo     - Nessun dispositivo? Collega il cavo e attiva il Debug USB.
echo     - "unauthorized"? Sblocca il telefono e accetta il popup di autorizzazione.
exit /b 1

:end
REM Note Wi-Fi (una volta, telefono collegato via cavo):
REM   adb tcpip 5555
REM   adb connect IP_DEL_TELEFONO:5555
REM Poi puoi staccare il cavo e rilanciare questo script senza cavo.
endlocal
