import React, { useEffect, useState } from "react";
import { getTonConnectUI } from "../ton-connect-ui";
import "../styles/TonPayment.css";
import { initTelegramWebApp } from "../telegram-webapp";

export function TonPayment() {
  const [wallet, setWallet] = useState(null);
  const [amount, setAmount] = useState("0.1");
  const [recipient, setRecipient] = useState("");
  const [txInProgress, setTxInProgress] = useState(false);
  const [txResult, setTxResult] = useState(null);
  const [tgUser, setTgUser] = useState(null);

  useEffect(() => {
    const tgWebApp = initTelegramWebApp();
    setTgUser(tgWebApp.getUser());
    tgWebApp.expand();

    const tonConnectUI = getTonConnectUI(
      "http://localhost:3000/tonconnect-manifest.json"
    );

    const unsubscribe = tonConnectUI.onStatusChange((wallet) => {
      setWallet(wallet);
      setTxResult(null);
    });

    tonConnectUI.connectionRestored.then(() => {
      setWallet(tonConnectUI.wallet);
    });

    return () => unsubscribe();
  }, []);

  const validateTonAddress = (address) => {
    // Basic TON address validation
    if (!address) return false;
    if (!address.startsWith("EQ") && !address.startsWith("0Q")) return false;
    if (address.length < 48) return false;
    return true;
  };

  const toNano = (amount) => {
    // Convert TON to nanoTON (1 TON = 10^9 nanoTON)
    return Math.floor(Number(amount) * 1000000000);
  };

  const handlePayment = async () => {
    if (!wallet || !recipient) return;

    try {
      setTxInProgress(true);
      setTxResult(null);

      // Validate recipient address
      if (!validateTonAddress(recipient)) {
        throw new Error("Invalid TON address format");
      }

      // Validate amount
      if (isNaN(amount) || Number(amount) <= 0) {
        throw new Error("Amount must be a positive number");
      }

      const amountInNano = toNano(amount);

      const transaction = {
        validUntil: Math.floor(Date.now() / 1000) + 300,
        messages: [
          {
            address: recipient,
            amount: amountInNano.toString(),
            payload: undefined, // Add payload for comments if needed
          },
        ],
      };

      const result = await tonConnectUI.sendTransaction(transaction);

      setTxResult({
        success: true,
        boc: result.boc,
        message: "Payment successful!",
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

  const disconnect = () => {
    const tonConnectUI = getTonConnectUI();
    tonConnectUI.disconnect();
    setWallet(null);
  };

  return (
    <div className="ton-payment-container">
      {tgUser && (
        <div className="tg-user-info">
          <p>Hello, {tgUser.first_name || "User"}!</p>
        </div>
      )}

      <h2>TON Payment Gateway</h2>

      <div id="ton-connect-button"></div>

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

            <button
              onClick={handlePayment}
              disabled={txInProgress || !recipient || !amount}
            >
              {txInProgress ? "Processing..." : "Send Payment"}
            </button>
          </div>

          {txResult && (
            <div
              className={`tx-result ${txResult.success ? "success" : "error"}`}
            >
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
    </div>
  );
}
