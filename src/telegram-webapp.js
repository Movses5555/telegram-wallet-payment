import { onEvent, sendData, init } from '@twa-dev/sdk';

export const initTelegramWebApp = () => {
  init();
  
  return {
    onEvent,
    sendData,
    getUser: () => window.Telegram.WebApp.initDataUnsafe.user,
    getTheme: () => window.Telegram.WebApp.colorScheme,
    expand: () => window.Telegram.WebApp.expand(),
    close: () => window.Telegram.WebApp.close(),
    isTelegram: () => !!window.Telegram?.WebApp?.initData
  };
};
