# Capacitor Setup — ReHorse Mobile

## Prerequisites

```bash
npm install @capacitor/core @capacitor/cli @capacitor/android @capacitor/ios @capacitor/push-notifications @capacitor/splash-screen
```

## First-time setup

```bash
npx cap init
npx cap add android
npx cap add ios
```

## Development (live reload via deployed URL)

The `capacitor.config.ts` points to the production URL. Just sync and open:

```bash
npm run cap:sync
npm run cap:android   # opens Android Studio
npm run cap:ios       # opens Xcode
```

## Production build

For App Store / Play Store releases, remove the `server.url` from `capacitor.config.ts`, then:

```bash
next build
npm run cap:sync
```

Then archive from Android Studio / Xcode.

## Push Notifications

Push notifications use VAPID (web push) via the service worker — they work identically in the browser and in the Capacitor web view. No native plugin needed for the current implementation.

To use native push (for better iOS support), install `@capacitor/push-notifications` and update `PushNotificationToggle.tsx` to use the Capacitor API when running natively.

## App IDs

- Android: `com.rehorse.app`
- iOS: `com.rehorse.app`
- App Name: `ReHorse`

Register these IDs in the Google Play Console and Apple Developer Portal before submitting.
