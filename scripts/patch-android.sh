#!/usr/bin/env bash
# Runs after "npx cap add android": installs the native helper, makes finnish appear in "Open with", sets version.
set -euo pipefail
PKG_DIR=android/app/src/main/java/app/finnish/writer
mkdir -p "$PKG_DIR"
cp android-patch/MainActivity.java "$PKG_DIR/MainActivity.java"
cp android-patch/FinnishPrintPlugin.java "$PKG_DIR/FinnishPrintPlugin.java"
# androidx.webkit is needed by the print plugin
if ! grep -q "androidx.webkit" android/app/build.gradle; then
  sed -i 's#dependencies {#dependencies {\n    implementation "androidx.webkit:webkit:1.12.1"#' android/app/build.gradle
fi
sed -i 's/versionName ".*"/versionName "2.0.0"/' android/app/build.gradle || true
# "Open with finnish" for .finnish / .fdx / .fountain / .screenplay files
python3 - <<'PY'
p = 'android/app/src/main/AndroidManifest.xml'
s = open(p, encoding='utf-8').read()
if 'finnish-open-with' not in s:
    f = '''
            <!-- finnish-open-with -->
            <intent-filter>
                <action android:name="android.intent.action.VIEW" />
                <category android:name="android.intent.category.DEFAULT" />
                <category android:name="android.intent.category.BROWSABLE" />
                <data android:scheme="content" />
                <data android:scheme="file" />
                <data android:mimeType="application/octet-stream" />
                <data android:mimeType="application/json" />
                <data android:mimeType="application/xml" />
                <data android:mimeType="text/xml" />
                <data android:mimeType="text/plain" />
                <data android:mimeType="text/*" />
                <data android:mimeType="application/x-finnish" />
            </intent-filter>
'''
    s = s.replace('</activity>', f + '        </activity>', 1)
    open(p, 'w', encoding='utf-8').write(s)
print('manifest patched')
PY
echo "Android patch applied."
