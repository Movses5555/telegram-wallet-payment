import React, { useEffect, useState } from 'react';

import { getTonConnectUI } from '../ton-connect-ui';


let tonConnectUI = null;

export function TonWalletConnector() {
    const [wallet, setWallet] = useState(null);
    const [balance, setBalance] = useState(null);

    useEffect(() => {
        const tonConnectUI = getTonConnectUI('https://your-website.com/tonconnect-manifest.json');

        const unsubscribe = tonConnectUI.onStatusChange((wallet) => {
            setWallet(wallet);
            if (wallet) {
                console.log('Connected wallet:', wallet);
            } else {
                setBalance(null);
            }
        });

        tonConnectUI.connectionRestored.then(() => {
            setWallet(tonConnectUI.wallet);
        });

        return () => {
            unsubscribe();
        };
    }, []);


    const disconnect = () => {
        if (tonConnectUI) {
            tonConnectUI.disconnect();
        }
    };

    return (
        <div>
            <div id="ton-connect-button"></div>
            
            {wallet && (
                <div>
                    <p>Connected Wallet: {wallet.name}</p>
                    <p>Address: {wallet.account.address}</p>
                    {balance && <p>Balance: {balance} TON</p>}
                    <button onClick={disconnect}>Disconnect</button>
                </div>
            )}
        </div>
    );
}