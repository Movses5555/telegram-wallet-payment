import { TonConnect } from '@tonconnect/sdk';

const manifestUrl = 'https://your-website.com/tonconnect-manifest.json';

export const connector = new TonConnect({
    manifestUrl: manifestUrl
});