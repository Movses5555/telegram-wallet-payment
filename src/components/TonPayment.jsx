import React, { useEffect, useState } from "react";
import { getTonConnectUI } from "../ton-connect-ui";
import "../styles/TonPayment.css";

export function TonPayment() {
  const [wallet, setWallet] = useState(null);
  const [amount, setAmount] = useState("0.01");
  const [recipient, setRecient] = useState("UQDoHIW5WIughjMyOtXibs6kZB-wVqz6C00imFFflkDINtVT");
  const [txInProgress, setTxInProgress] = useState(false);
  const [txResult, setTxResult] = useState(null);
  const [tonConnectUI, setTonConnectUI] = useState(null);
  const [webhookPayloadState, setWebhookPayloadState] = useState(null);
  const [transactionState, setTransactionState] = useState(null);
  const [resultState, setResultState] = useState(null);

  // Webhook configuration
  const WEBHOOK_URL = "https://damage-hands-publishing-church.trycloudflare.com/user/payment/webhook";
  const WEBHOOK_SECRET = "your-secret-key"; // Should be from environment variables in production

  // Check if running in Telegram WebApp
  const isTelegram = () => window.Telegram?.WebApp?.initData !== undefined;

  // Initialize
  useEffect(() => {
    // Telegram setup
    if (isTelegram()) {
      window.Telegram.WebApp.expand();
      window.Telegram.WebApp.enableClosingConfirmation();
      document.body.style.backgroundColor = window.Telegram.WebApp.backgroundColor;
    }

    // TON Connect initialization
    const tonConnectUIInstance = getTonConnectUI(
      "https://telegram-wallet-payment.vercel.app/tonconnect-manifest.json"
    );

    const unsubscribe = tonConnectUIInstance.onStatusChange((wallet) => {
      setWallet(wallet);
      setTxResult(null);
    });

    tonConnectUIInstance.connectionRestored.then(() => {
      setWallet(tonConnectUIInstance.wallet);
    });

    setTonConnectUI(tonConnectUIInstance);

    return () => unsubscribe();
  }, []);

  const validateTonAddress = (address) => {
    if (!address) return false;
    if (!address.startsWith("EQ") && !address.startsWith("UQ")) return false;
    return address.length >= 48;
  };

  const toNano = (amount) => Math.floor(Number(amount) * 1000000000);

  const handlePayment = async () => {
    if (!wallet || !recipient || !tonConnectUI) return;

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
      const webhookPayload = {
        telegramUser: isTelegram() ? window.Telegram.WebApp.initDataUnsafe?.user : null,
        senderAddress: wallet.account.address,
        recipientAddress: recipient,
        amount: amount,
        timestamp: new Date().toISOString()
      };
      setWebhookPayloadState(webhookPayload);
      console.log('webhookPayload', webhookPayload);
      
      // Prepare transaction with webhook reference
      const transaction = {
        validUntil: Math.floor(Date.now() / 1000) + 300,
        messages: [{
          address: recipient,
          amount: amountInNano.toString(),
          payload: createWebhookPayload(webhookPayload)
        }]
      };
      setTransactionState(transaction)
      console.log('transaction', transaction);

      // Send transaction
      const result = await tonConnectUI.sendTransaction(transaction);

      setResultState(result);
      console.log('result', result);

      // Immediately notify backend via webhook
      await sendWebhookNotification({
        ...webhookPayload,
        transactionBoc: result.boc,
        status: "pending"
      });

      setTxResult({
        success: true,
        boc: result.boc,
        message: "Payment processing...",
      });

    } catch (error) {
      setTxResult({
        success: false,
        message: error.message || "Payment failed",
      });
    } finally {
      setTxInProgress(false);
    }
  };

  // Create transaction payload with webhook reference
  const createWebhookPayload = (data) => {
    // This would need to be implemented using @ton/core or similar
    // For simplicity, we'll just include a reference
    return {
      webhook: WEBHOOK_URL,
      data: btoa(JSON.stringify(data)) // Simple encoding for demo
    };
  };

  // Send direct webhook notification
  const sendWebhookNotification = async (data) => {
    try {
      const response = await fetch(WEBHOOK_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Webhook-Signature": generateSignature(data)
        },
        body: JSON.stringify(data)
      });
      console.log('response', response);
      

      if (!response.ok) {
        console.error("Webhook failed:", await response.text());
      }
    } catch (error) {
      console.error("Webhook error:", error);
    }
  };

  // Generate HMAC signature for webhook security
  const generateSignature = (payload) => {
    // In a real app, use crypto.subtle for browser-based HMAC
    const encoder = new TextEncoder();
    const key = encoder.encode(WEBHOOK_SECRET);
    const data = encoder.encode(JSON.stringify(payload));
    return crypto.subtle.digest("SHA-256", new Uint8Array([...key, ...data]))
      .then(hash => btoa(String.fromCharCode(...new Uint8Array(hash))));
  };

  // Get Telegram user info
  const tgUser = isTelegram() ? window.Telegram.WebApp.initDataUnsafe?.user : null;

  return (
    <div className="ton-payment-container">
      {tgUser && (
        <div className="tg-user-info">
          <p>Hello, {tgUser.first_name || "User"}!</p>
          {tgUser.username && <p>@{tgUser.username}</p>}
        </div>
      )}

      <h2>TON Payment Gateway</h2>

      <div id="ton-connect-button"></div>

      {wallet ? (
        <div className="payment-form">
          <div className="wallet-info">
            <p>Connected: {wallet.name}</p>
            <p>Address: {wallet.account.address}</p>
            <button onClick={() => tonConnectUI.disconnect()}>Disconnect</button>
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

            <button
              onClick={handlePayment}
              disabled={txInProgress || !recipient || !amount}
            >
              {txInProgress ? "Processing..." : "Send Payment"}
            </button>
          </div>

          {txResult && (
            <div className={`tx-result ${txResult.success ? "success" : "error"}`}>
              {txResult.message}
              {txResult.boc && (
                <div className="tx-details">
                  <p>Transaction ID:</p>
                  <code>{txResult.boc.slice(0, 20)}...</code>
                </div>
              )}
            </div>
          )}
          <h2>webhookPayloadState</h2>
          {
            webhookPayloadState && Object.keys(webhookPayloadState)?.map((key) => {
              let item = webhookPayloadState[key];
              if(typeof item === 'object' && item !== null) {
                item = JSON.stringify(item)
              }
              return (
                <>
                  {item}
                  <br/>
                </>
              )
            })
          }
          <h2>transactionState</h2>
          {
            transactionState && Object.keys(transactionState)?.map((key) => {
              let item = transactionState[key];
              if(typeof item === 'object' && item !== null) {
                item = JSON.stringify(item)
              }
              return (
                <>
                  {item}
                  <br/>
                </>
              )
            })
          }
          <h2>resultState</h2>
          {
            resultState && Object.keys(resultState)?.map((key) => {
              let item = resultState[key];
              if(typeof item === 'object' && item !== null) {
                item = JSON.stringify(item)
              }
              return (
                <>
                  {item}
                  <br/>
                </>
              )
            })
          }
        </div>
      ) : (
        <p className="connect-prompt">
          Connect your TON wallet to make payments
        </p>
      )}
    </div>
  );
}