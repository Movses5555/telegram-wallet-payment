import React, { useEffect, useState } from "react";
import { getTonConnectUI } from "../ton-connect-ui";
import "../styles/TonPayment.css";

export function TonPayment() {
  const [wallet, setWallet] = useState(null);
  const [amount, setAmount] = useState("0.1");
  const [recipient, setRecipient] = useState("");
  const [txInProgress, setTxInProgress] = useState(false);
  const [txResult, setTxResult] = useState(null);

  // Check if running in Telegram WebApp
  const isTelegram = () => window.Telegram?.WebApp?.initData !== undefined;

  // Initialize Telegram WebApp and TON Connect
  useEffect(() => {
    // Telegram WebApp setup
    if (isTelegram()) {
      window.Telegram.WebApp.expand();
      window.Telegram.WebApp.enableClosingConfirmation();
      document.body.style.backgroundColor = window.Telegram.WebApp.backgroundColor;
      
      // Setup Telegram MainButton
      window.Telegram.WebApp.MainButton.setText("Send TON Payment");
      window.Telegram.WebApp.MainButton.onClick(handlePayment);
    }

    // TON Connect initialization
    const tonConnectUI = getTonConnectUI(
      "https://telegram-wallet-payment.vercel.app/tonconnect-manifest.json"
    );

    const unsubscribe = tonConnectUI.onStatusChange((wallet) => {
      setWallet(wallet);
      setTxResult(null);
      
      // Update Telegram MainButton visibility
      if (isTelegram()) {
        if (wallet && recipient && amount) {
          window.Telegram.WebApp.MainButton.show();
        } else {
          window.Telegram.WebApp.MainButton.hide();
        }
      }
    });

    tonConnectUI.connectionRestored.then(() => {
      setWallet(tonConnectUI.wallet);
    });

    return () => {
      unsubscribe();
      if (isTelegram()) {
        window.Telegram.WebApp.MainButton.offClick(handlePayment);
      }
    };
  }, []);

  // Update Telegram MainButton when form changes
  useEffect(() => {
    if (isTelegram() && wallet) {
      if (recipient && amount) {
        window.Telegram.WebApp.MainButton.show();
      } else {
        window.Telegram.WebApp.MainButton.hide();
      }
    }
  }, [recipient, amount, wallet]);

  const validateTonAddress = (address) => {
    if (!address) return false;
    if (!address.startsWith("EQ") && !address.startsWith("0Q")) return false;
    return address.length >= 48;
  };

  const toNano = (amount) => {
    return Math.floor(Number(amount) * 1000000000);
  };

  const handlePayment = async () => {
    if (!wallet || !recipient) return;

    try {
      setTxInProgress(true);
      setTxResult(null);

      // Validate inputs
      if (!validateTonAddress(recipient)) {
        throw new Error("Invalid TON address format");
      }

      if (isNaN(amount) || Number(amount) <= 0) {
        throw new Error("Amount must be a positive number");
      }

      const amountInNano = toNano(amount);

      // Prepare transaction
      const transaction = {
        validUntil: Math.floor(Date.now() / 1000) + 300, // 5 minutes
        messages: [
          {
            address: recipient,
            amount: amountInNano.toString(),
          },
        ],
      };

      // Send transaction
      const result = await tonConnectUI.sendTransaction(transaction);

      // Send confirmation to Telegram bot
      if (isTelegram()) {
        window.Telegram.WebApp.sendData(JSON.stringify({
          status: "success",
          amount: amount,
          recipient: recipient,
          transactionBoc: result.boc,
          timestamp: new Date().toISOString(),
          user: window.Telegram.WebApp.initDataUnsafe?.user
        }));
      }

      setTxResult({
        success: true,
        boc: result.boc,
        message: "Payment successful!",
      });

      // Close WebApp after delay (optional)
      if (isTelegram()) {
        setTimeout(() => window.Telegram.WebApp.close(), 2000);
      }
    } catch (error) {
      setTxResult({
        success: false,
        message: error.message || "Payment failed",
      });
    } finally {
      setTxInProgress(false);
    }
  };

  const disconnect = () => {
    const tonConnectUI = getTonConnectUI();
    tonConnectUI.disconnect();
    setWallet(null);
    
    if (isTelegram()) {
      window.Telegram.WebApp.MainButton.hide();
    }
  };

  // Get Telegram user info if available
  const tgUser = isTelegram() ? window.Telegram.WebApp.initDataUnsafe?.user : null;

  return (
    <div className="ton-payment-container">
      {/* Telegram User Info */}
      {tgUser && (
        <div className="tg-user-info">
          <p>Hello, {tgUser.first_name || "User"}!</p>
          {tgUser.username && <p>@{tgUser.username}</p>}
        </div>
      )}

      <h2>TON Payment Gateway</h2>

      {/* TON Connect Button */}
      <div id="ton-connect-button"></div>

      {/* Payment Form */}
      {wallet ? (
        <div className="payment-form">
          <div className="wallet-info">
            <p>Connected: {wallet.name}</p>
            <p>Address: {wallet.account.address}</p>
            <button onClick={disconnect}>Disconnect</button>
          </div>

          <div className="payment-fields">
            <label>
              Recipient TON Address:
              <input
                type="text"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                placeholder="EQABC... (TON address)"
              />
            </label>

            <label>
              Amount (TON):
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                min="0.01"
                step="0.01"
              />
            </label>

            {/* Regular button (hidden in Telegram) */}
            {!isTelegram() && (
              <button
                onClick={handlePayment}
                disabled={txInProgress || !recipient || !amount}
              >
                {txInProgress ? "Processing..." : "Send Payment"}
              </button>
            )}
          </div>

          {/* Transaction Result */}
          {txResult && (
            <div className={`tx-result ${txResult.success ? "success" : "error"}`}>
              {txResult.message}
              {txResult.boc && (
                <div className="tx-details">
                  <p>Transaction BOC:</p>
                  <code>{txResult.boc}</code>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <p className="connect-prompt">
          Connect your TON wallet to make payments
        </p>
      )}

      {/* Debug Info (remove in production) */}
      {isTelegram() && (
        <div className="debug-info">
          <p>Theme: {window.Telegram.WebApp.colorScheme}</p>
          <p>Platform: {window.Telegram.WebApp.platform}</p>
        </div>
      )}
    </div>
  );
}