$ErrorActionPreference = "Stop"

$projectId = "demo-dontlift-admin"
$firebaseConfig = Join-Path $PSScriptRoot "..\firebase.admin-test.json"
$firestoreRules = Join-Path $PSScriptRoot "..\..\dontlift-mobile\firestore.rules"
$firebaseCli = Join-Path $PSScriptRoot "..\node_modules\firebase-tools\lib\bin\firebase.js"

if ($env:FIREBASE_RUNTIME_MODE -and $env:FIREBASE_RUNTIME_MODE -ne "demo") {
  throw "Refusing to start the local emulator while FIREBASE_RUNTIME_MODE is not demo."
}
if ($env:FIREBASE_PROJECT_ID -and $env:FIREBASE_PROJECT_ID -ne $projectId) {
  throw "Refusing to start the emulator with a mismatched project ID."
}
if (!(Test-Path -LiteralPath $firebaseConfig) -or !(Test-Path -LiteralPath $firestoreRules)) {
  throw "Firebase emulator configuration or the existing mobile Rules file is missing."
}
if (!(Test-Path -LiteralPath $firebaseCli)) {
  throw "Firebase CLI is not installed in this project. Run pnpm install first."
}

$env:FIREBASE_RUNTIME_MODE = "demo"
$env:NEXT_PUBLIC_FIREBASE_RUNTIME_MODE = "demo"
$env:FIREBASE_PROJECT_ID = $projectId
$env:NEXT_PUBLIC_FIREBASE_PROJECT_ID = $projectId
$env:FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099"
$env:FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080"
$env:NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_URL = "http://127.0.0.1:9099"
$env:ADMIN_OPERATOR_MODE = "emulator"
$env:ADMIN_OPERATOR_PROJECT_ID = $projectId
$env:ADMIN_OPERATOR_ID = "local-test"

$node = (Get-Command node -ErrorAction Stop).Source
& $node $firebaseCli emulators:start --config $firebaseConfig --project $projectId --only auth,firestore
exit $LASTEXITCODE
