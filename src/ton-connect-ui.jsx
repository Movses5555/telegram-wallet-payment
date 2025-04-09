import { TonConnectUI } from '@tonconnect/ui';

let tonConnectUI = null;

export const getTonConnectUI = (manifestUrl) => {
    if (!tonConnectUI) {
        tonConnectUI = new TonConnectUI({
            manifestUrl: manifestUrl,
            buttonRootId: 'ton-connect-button'
        });
    }
    return tonConnectUI;
};