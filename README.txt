finnish  –  offline Malayalam & English screenplay writer          Creator: Nishan
==========================================================================
www/            the whole app (plain HTML/JS/CSS, no frameworks)
electron/       Windows .exe shell        package.json  (npm scripts + electron-builder)
android-patch/  print-to-PDF plugin for the Android APK   capacitor.config.json
.github/workflows/  build-apk.yml, build-exe.yml, pages.yml  (GitHub builds the APK and EXE for you)
scripts/        fetch-fonts.mjs (Manjari/Chilanka/Gayathri), patch-android.sh
GITHUB_GUIDE.md  every click needed to publish this on GitHub and get the APK + EXE

Try it right now on a computer:   cd www  &&  python3 -m http.server 8000   → open http://localhost:8000
