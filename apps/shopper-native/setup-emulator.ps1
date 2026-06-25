$sdk = "$env:LOCALAPPDATA\Android\Sdk"
$zip = "$env:TEMP\sysimg_android34.zip"
$avd = "United_Pixel7_API34"

Write-Host "`n=== United Pharmacies — Android Emulator Setup ===" -ForegroundColor Cyan

# Step 1: Wait for BITS download or use existing zip
Import-Module BitsTransfer -ErrorAction SilentlyContinue
$bitsJob = Get-BitsTransfer -DisplayName "Android34_SysImg" -ErrorAction SilentlyContinue | Select-Object -First 1

if ($bitsJob -and $bitsJob.JobState -ne "Transferred") {
    Write-Host "`n[1/4] Waiting for system image download to complete..." -ForegroundColor Yellow
    do {
        Start-Sleep -Seconds 10
        $bitsJob = Get-BitsTransfer -JobId $bitsJob.JobId
        $pct = if ($bitsJob.BytesTotal -gt 0) { [math]::Round($bitsJob.BytesTransferred/$bitsJob.BytesTotal*100,1) } else { 0 }
        Write-Host "  $pct% ($([math]::Round($bitsJob.BytesTransferred/1MB,0)) MB / $([math]::Round($bitsJob.BytesTotal/1MB,0)) MB)" -NoNewline
        Write-Host "`r" -NoNewline
    } while ($bitsJob.JobState -notin @("Transferred","Error"))

    if ($bitsJob.JobState -eq "Error") {
        Write-Host "`nBITS download failed: $($bitsJob.ErrorDescription)" -ForegroundColor Red
        exit 1
    }
    Complete-BitsTransfer -BitsJob $bitsJob
    Write-Host "`n  Download complete!" -ForegroundColor Green
}

# Step 2: Install system image from zip
Write-Host "`n[2/4] Installing system image from zip..." -ForegroundColor Yellow
$destDir = "$sdk\system-images\android-34\google_apis\x86_64"
if (-not (Test-Path "$destDir\build.prop")) {
    if (-not (Test-Path $zip)) {
        Write-Host "  Error: zip not found at $zip" -ForegroundColor Red
        exit 1
    }
    New-Item -ItemType Directory -Force -Path $destDir | Out-Null
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    Write-Host "  Extracting..." -NoNewline
    [System.IO.Compression.ZipFile]::ExtractToDirectory($zip, "$sdk\system-images\android-34\google_apis")
    Write-Host " done" -ForegroundColor Green
    # Tell sdkmanager it's installed
    "4" | Out-File "$destDir\.installer\installData.json" -Encoding utf8 -ErrorAction SilentlyContinue
} else {
    Write-Host "  System image already installed." -ForegroundColor Green
}

# Step 3: Create AVD
Write-Host "`n[3/4] Creating AVD: $avd..." -ForegroundColor Yellow
$avdExists = & "$sdk\cmdline-tools\latest\bin\avdmanager.bat" list avd 2>&1 | Select-String $avd
if (-not $avdExists) {
    "no" | & "$sdk\cmdline-tools\latest\bin\avdmanager.bat" create avd `
        -n $avd `
        -k "system-images;android-34;google_apis;x86_64" `
        --device "pixel_7" --force 2>&1
    Write-Host "  AVD created." -ForegroundColor Green
} else {
    Write-Host "  AVD already exists." -ForegroundColor Green
}

# Step 4: Start emulator + Expo
Write-Host "`n[4/4] Starting emulator..." -ForegroundColor Yellow
Start-Process -FilePath "$sdk\emulator\emulator.exe" -ArgumentList "-avd $avd -no-snapshot-load" -WindowStyle Normal

Write-Host "  Waiting for device to come online (60-90s)..." -ForegroundColor Yellow
$timeout = 120
$elapsed = 0
do {
    Start-Sleep -Seconds 5
    $elapsed += 5
    $online = & "$sdk\platform-tools\adb.exe" devices 2>&1 | Select-String "emulator.*\bdevice\b"
} while (-not $online -and $elapsed -lt $timeout)

if ($online) {
    Write-Host "  Emulator online!" -ForegroundColor Green
    Write-Host "`nStarting Expo on Android..." -ForegroundColor Cyan
    Set-Location "I:\United-Motaheda\apps\shopper-native"
    npx expo start --android
} else {
    Write-Host "  Emulator did not come online in time. Start Expo manually:" -ForegroundColor Yellow
    Write-Host "  cd I:\United-Motaheda\apps\shopper-native && npx expo start --android"
}
