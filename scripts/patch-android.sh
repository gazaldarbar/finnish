#!/usr/bin/env bash
# Runs after "npx cap add android": installs the print plugin + MainActivity and makes the app an English/Malayalam-friendly, portrait-free app.
set -euo pipefail
PKG_DIR=android/app/src/main/java/app/finnish/writer
mkdir -p "$PKG_DIR"
cp android-patch/MainActivity.java "$PKG_DIR/MainActivity.java"
cp android-patch/FinnishPrintPlugin.java "$PKG_DIR/FinnishPrintPlugin.java"
# androidx.webkit is needed by the print plugin
if ! grep -q "androidx.webkit" android/app/build.gradle; then
  sed -i 's#dependencies {#dependencies {\n    implementation "androidx.webkit:webkit:1.12.1"#' android/app/build.gradle
fi
# version
sed -i 's/versionName ".*"/versionName "2.0.0"/' android/app/build.gradle || true
echo "Android patch applied."
