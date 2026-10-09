import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.connectgrow.app',
  appName: 'Bible Connect',
  webDir: 'dist/client',
  server: {
    allowNavigation: ['connectgrow.com', 'www.connectgrow.com', 'connectgrow.bible', 'www.connectgrow.bible', 'https://tawanda1985-connect-grow.bibleconnect.workers.dev']
  }
};

export default config;
