$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $projectRoot '.env.local'
if (-not (Test-Path -LiteralPath $envFile)) {
  throw 'Missing .env.local. Set EXPO_PUBLIC_FIREBASE_RUNTIME_MODE=emulator and EXPO_PUBLIC_FIREBASE_PROJECT_ID before starting dev.'
}

$firebaseSettings = @{}
foreach ($line in Get-Content -LiteralPath $envFile) {
  if ($line -match '^\s*(EXPO_PUBLIC_FIREBASE_[A-Z_]+)\s*=\s*(.*?)\s*$') {
    $firebaseSettings[$Matches[1]] = $Matches[2].Trim().Trim('"').Trim("'")
  }
}

if ($firebaseSettings['EXPO_PUBLIC_FIREBASE_RUNTIME_MODE'] -ne 'emulator') {
  throw 'pnpm run dev starts local Firebase emulators; set EXPO_PUBLIC_FIREBASE_RUNTIME_MODE=emulator in .env.local.'
}
$projectId = $firebaseSettings['EXPO_PUBLIC_FIREBASE_PROJECT_ID']
if ([string]::IsNullOrWhiteSpace($projectId)) {
  throw 'EXPO_PUBLIC_FIREBASE_PROJECT_ID is missing from .env.local.'
}
if (-not (Get-Command java -ErrorAction SilentlyContinue)) {
  $jbrCandidates = @(
    (Join-Path $env:ProgramFiles 'Android\Android Studio\jbr'),
    (Join-Path $env:LOCALAPPDATA 'Programs\Android Studio\jbr')
  )
  $androidStudioJdk = $jbrCandidates | Where-Object { Test-Path -LiteralPath (Join-Path $_ 'bin\java.exe') } | Select-Object -First 1
  if ($androidStudioJdk) {
    $env:JAVA_HOME = $androidStudioJdk
    $env:PATH = "$(Join-Path $androidStudioJdk 'bin');$env:PATH"
  }
}
if (-not (Get-Command java -ErrorAction SilentlyContinue)) {
  throw 'Firebase Emulator Suite needs Java. Add JDK 11 or newer to PATH (Android Studio JDK was not found), then run pnpm run dev again.'
}


$functionsDir = Join-Path $projectRoot 'functions'
Push-Location $functionsDir
try {
  & pnpm exec firebase emulators:exec --config ..\firebase.emulator.json --project $projectId --only auth,firestore,functions 'pnpm --dir .. run dev:expo'
  $exitCode = $LASTEXITCODE
} finally {
  Pop-Location
}
exit $exitCode