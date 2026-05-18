import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.rehorse.app',
  appName: 'ReHorse',
  webDir: 'out',
  bundledWebRuntime: false,
  server: {
    // For development: point to your deployed URL so the app always has fresh data
    // Remove this for production builds
    url: 'https://rehorse.icecoldlime.com',
    cleartext: true,
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    SplashScreen: {
      launchShowDuration: 1500,
      backgroundColor: '#030712',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
    },
  },
  ios: {
    contentInset: 'always',
  },
  android: {
    allowMixedContent: true,
  },
}

export default config
