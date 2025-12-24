# How to Create an APK for MediRemind

The project has been updated with **PWA** (Progressive Web App) support and **Capacitor** configuration to build Android APKs.

## Method 1: Install as PWA (Recommended for Quick Testing)
1. Upload these files to a web server (e.g., GitHub Pages, Netlify, Vercel).
2. Open the URL in Chrome on Android.
3. Tap the "Three Dots" menu -> "Add to Home Screen" or "Install App".
4. This installs it like a native app on Android 13/14/15.

## Method 2: Build Real APK using Capacitor
You need **Node.js** and **Android Studio** installed on your computer.

### Steps:
1. **Open Terminal** in this folder.
2. **Install Dependencies**:
   ```bash
   npm install
   ```
3. **Initialize Android Platform**:
   ```bash
   npx cap add android
   ```
4. **Sync Project**:
   ```bash
   npx cap sync
   ```
5. **Open in Android Studio**:
   ```bash
   npx cap open android
   ```
6. **Build APK**:
   - In Android Studio, wait for Gradle sync to finish.
   - Go to `Build` -> `Build Bundle(s) / APK(s)` -> `Build APK(s)`.
   - The APK will be generated in `android/app/build/outputs/apk/debug/`.

### Targeted Android Versions
- The default configuration supports Android 13, 14, and 15 automatically via the Capacitor Android platform.
- You can change the minimum SDK version in `android/variables.gradle` (created after step 3) if needed, but the default is usually fine for modern devices.
