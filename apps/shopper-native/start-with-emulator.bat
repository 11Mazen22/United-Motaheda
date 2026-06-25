@echo off
setlocal

set SDK=%LOCALAPPDATA%\Android\Sdk
set EMULATOR=%SDK%\emulator\emulator.exe
set AVD_NAME=Pixel_7_API34

echo === United Pharmacies — Native App Dev Server ===
echo.

REM Step 1: Install emulator + system image if not present
if not exist "%EMULATOR%" (
  echo [1/4] Installing Android Emulator...
  call "%SDK%\cmdline-tools\latest\bin\sdkmanager.bat" "emulator" "platforms;android-34" "system-images;android-34;google_apis;x86_64"
)

REM Step 2: Create AVD if not present
"%SDK%\cmdline-tools\latest\bin\avdmanager.bat" list avd 2>nul | findstr /C:"%AVD_NAME%" >nul
if errorlevel 1 (
  echo [2/4] Creating AVD %AVD_NAME%...
  echo no | "%SDK%\cmdline-tools\latest\bin\avdmanager.bat" create avd -n %AVD_NAME% -k "system-images;android-34;google_apis;x86_64" --device "pixel_7" --force
)

REM Step 3: Start emulator (in background)
echo [3/4] Starting Android Emulator...
start /b "" "%EMULATOR%" -avd %AVD_NAME% -no-snapshot-load

REM Wait for device to come online
echo [4/4] Waiting for emulator to boot (30-60s)...
:WAIT_LOOP
"%SDK%\platform-tools\adb.exe" devices | findstr "emulator.*device" >nul
if errorlevel 1 (
  timeout /t 5 /nobreak >nul
  goto WAIT_LOOP
)

echo.
echo Emulator is online! Starting Expo...
cd /d "%~dp0"
npx expo start --android

endlocal
