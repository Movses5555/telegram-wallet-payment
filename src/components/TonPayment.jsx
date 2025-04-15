import React, { useEffect, useState } from "react";
import { getTonConnectUI } from "../ton-connect-ui";
import "../styles/TonPayment.css";

export function TonPayment({
  userId,
  itemId="4a2c283b-7bab-470a-9ab9-df5378efe485",
  itemType='upgrade',
  onPaymentComplete
}) {
  const [wallet, setWallet] = useState(null);
  const [amount, setAmount] = useState("0.01");
  const [recipient, setRecipient] = useState("UQCLgHupBFquXlSxVUPm66DAR_HADugKgtclvEjaVoQesyar");
  const [txInProgress, setTxInProgress] = useState(false);
  const [txResult, setTxResult] = useState(null);
  const [tonConnectUI, setTonConnectUI] = useState(null);
  const [paymentId, setPaymentId] = useState(null);

  const BASE_URL = 'http://localhost:3030'

  // Initialize
  useEffect(() => {
    if (window.Telegram?.WebApp?.initData !== undefined) {
      window.Telegram.WebApp.expand();
      window.Telegram.WebApp.enableClosingConfirmation();
      document.body.style.backgroundColor = window.Telegram.WebApp.backgroundColor;
    }

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

      // First call backend to initialize payment
      const initResponse = await fetch(`${BASE_URL}/user/buy/init-ton-payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          id: itemId,
          type: itemType
        })
      });

      console.log('initResponse', initResponse);
      

      if (!initResponse.ok) {
        throw new Error('Failed to initialize payment');
      }

      const { paymentId, tonAmount } = await initResponse.json();
      console.log('paymentId', paymentId);
      console.log('tonAmount', tonAmount);
      
      setPaymentId(paymentId);
      setAmount(amount.toString());

      // Validate inputs
      if (!validateTonAddress(recipient)) {
        throw new Error("Invalid TON address format");
      }

      const amountInNano = toNano(amount);

      const payload = {
        paymentId,
        itemId,
        itemType,
        userId
      };
      
      // Prepare transaction with paymentId in payload
      const transaction = {
        validUntil: Math.floor(Date.now() / 1000) + 300,
        messages: [{
          address: recipient,
          amount: amountInNano.toString(),
        }]
      };
      console.log('transaction', transaction);
      

      // Send transaction
      const result = await tonConnectUI.sendTransaction(transaction);
      alert(JSON.stringify(result));

      setTxResult({
        success: true,
        boc: result.boc,
        message: "Payment processing...",
      });

      // Poll for payment completion (or wait for webhook)
      await checkPaymentStatus(paymentId);

    } catch (error) {
      setTxResult({
        success: false,
        message: error.message || "Payment failed",
      });
    } finally {
      setTxInProgress(false);
    }
  };

  const checkPaymentStatus = async (paymentId) => {
    try {
      let attempts = 0;
      const maxAttempts = 10;
      
      while (attempts < maxAttempts) {
        const response = await fetch(`/user/buy/verify-ton-payment?paymentId=${paymentId}`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });
        
        const { status } = await response.json();
        
        if (status === 'completed') {
          if (onPaymentComplete) onPaymentComplete();
          return;
        }
        
        if (status === 'failed') {
          throw new Error('Payment verification failed');
        }
        
        attempts++;
        await new Promise(resolve => setTimeout(resolve, 3000)); // Wait 3 seconds
      }
      
      throw new Error('Payment verification timeout');
    } catch (error) {
      console.error('Payment verification error:', error);
      throw error;
    }
  };

  return (
    <div className="ton-payment-container">
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
                disabled
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
                disabled
              />
            </label>

            <button
              onClick={handlePayment}
              disabled={txInProgress}
            >
              {txInProgress ? "Processing..." : "Confirm Payment"}
            </button>
          </div>

          {txResult && (
            <div className={`tx-result ${txResult.success ? "success" : "error"}`}>
              {txResult.message}
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
