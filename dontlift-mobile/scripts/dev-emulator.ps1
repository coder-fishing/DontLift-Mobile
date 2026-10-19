$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
# Chỉ dành cho local test; pnpm run dev mặc định dùng Expo Go và Firebase Cloud.
$env:EXPO_PUBLIC_FIREBASE_RUNTIME_MODE = 'emulator'
$env:EXPO_PUBLIC_FIREBASE_PROJECT_ID = 'demo-dontlift-expo-go'
$env:EXPO_PUBLIC_FIREBASE_FUNCTIONS_EMULATOR_PORT = '5001'
Push-Location (Join-Path $projectRoot 'functions')
try {
  & pnpm exec firebase emulators:exec --config ..\firebase.emulator.json --project demo-dontlift-expo-go --only auth,firestore,functions 'pnpm --dir .. run dev:expo'
  $exitCode = $LASTEXITCODE
} finally {
  Pop-Location
}
exit $exitCode
