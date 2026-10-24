# Mobile Platform Setup

## iOS and Android Development
Mobile developers configure:
1. macOS Sonoma or later with Xcode 15+ and Command Line Tools
2. Android Studio Hedgehog or newer with Android SDK Platform 34
3. Node.js 20 and Watchman (`brew install watchman`)
4. CocoaPods (`sudo gem install cocoapods`)

## Running the Mobile App
From the root of `mobile-client`:
```bash
git clone https://github.com/company/mobile-client.git
cd mobile-client
npm install
cd ios && pod install && cd ..
npm run ios     # Launches iOS Simulator (iPhone 15)
npm run android # Launches Android Emulator
```

## Testing & Offline Sync Architecture
Run mobile unit tests with Jest:
```bash
npm run test:unit
```
Our app uses an offline-first SQLite database that syncs deltas when network connectivity resumes. Inspect the sync manager in `src/sync/ConflictResolver.ts`.
