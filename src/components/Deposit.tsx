'use client';

import { useState } from 'react';
import { type User, type Wallet, deposit, getWalletByTelegramId, API_URL } from '@/lib/api';
import { useGameStore } from '@/store/gameStore';
import axios from 'axios';

interface DepositProps {
  user: User;
  wallet: Wallet;
  onWalletUpdate?: (wallet: Wallet) => void;
}

/**
 * Deposit configuration
 * Update these values to change deposit limits and account numbers
 */
export const DEPOSIT_CONFIG = {
  // Deposit amount limits
  MIN_AMOUNT: 50, // Minimum deposit amount in Birr
  MAX_AMOUNT: 1000, // Maximum deposit amount in Birr

  // Payment account numbers
  TELEBIRR_ACCOUNT: '0933495168', // Telebirr account number for deposits
  CBE_ACCOUNT: '1000127006702', // CBE (Commercial Bank of Ethiopia) account number for deposits
};

// Account numbers for different payment types
// Note: Keys must match the API's expected transaction_type values ('Telebirr' | 'CBE')
const PAYMENT_ACCOUNTS: Record<string, string> = {
  'Telebirr': DEPOSIT_CONFIG.TELEBIRR_ACCOUNT,
  'CBE': DEPOSIT_CONFIG.CBE_ACCOUNT,
};

// Payment types with display names and API values
const PAYMENT_TYPES = [
  { value: 'Telebirr', label: 'Telebirr' },
  { value: 'CBE', label: 'CBE' },
] as const;

export default function Deposit({ user, wallet, onWalletUpdate }: DepositProps) {
  const { setCurrentView } = useGameStore();
  const [amount, setAmount] = useState<string>('');
  const [paymentType, setPaymentType] = useState<string>('');
  const [transactionId, setTransactionId] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  const accountNumber = paymentType ? PAYMENT_ACCOUNTS[paymentType] || '' : '';
  const amountNum = parseFloat(amount) || 0;
  const canDeposit = paymentType && accountNumber && amount && 
    amountNum >= DEPOSIT_CONFIG.MIN_AMOUNT && 
    amountNum <= DEPOSIT_CONFIG.MAX_AMOUNT && 
    transactionId.trim() !== '';

  const handleCopyAccount = () => {
    if (accountNumber) {
      navigator.clipboard.writeText(accountNumber);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDeposit = async () => {
    if (!canDeposit || !paymentType) return;

    const depositAmount = parseFloat(amount);
    if (depositAmount < DEPOSIT_CONFIG.MIN_AMOUNT) {
      alert(`Minimum deposit amount is ${DEPOSIT_CONFIG.MIN_AMOUNT} ETB`);
      return;
    }
    if (depositAmount > DEPOSIT_CONFIG.MAX_AMOUNT) {
      alert(`Maximum deposit amount is ${DEPOSIT_CONFIG.MAX_AMOUNT} ETB`);
      return;
    }

    setSubmitting(true);

    try {
      await deposit(user.id, depositAmount, paymentType, transactionId);
      
      // Refresh wallet
      const updatedWallet = await getWalletByTelegramId(user.telegram_id.toString());
      if (onWalletUpdate) {
        onWalletUpdate(updatedWallet);
      }

      // Show success modal
      setShowSuccessModal(true);
      
      // Auto-close and navigate after 3 seconds
      setTimeout(() => {
        setShowSuccessModal(false);
        setCurrentView('wallet');
      }, 3000);
    } catch (err: any) {
      console.error('Error depositing:', err);
      const errorMessage = err.response?.data?.error || err.response?.data?.message || 'Failed to submit deposit request';
      alert(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-blue-600 text-white flex flex-col">
      {/* Success Modal */}
      {showSuccessModal && (
        <div className="fixed inset-0 bg-blue-600 bg-opacity-95 flex items-center justify-center z-50">
          <div className="bg-blue-700 border-2 border-blue-400 rounded-lg p-6 sm:p-8 max-w-md mx-4 text-center shadow-xl">
            <div className="text-4xl sm:text-5xl mb-4">✅</div>
            <h2 className="text-xl sm:text-2xl font-bold text-white mb-4">
              Deposit request submitted successfully!
            </h2>
            <p className="text-blue-200 text-sm sm:text-base mb-6">
              It will be processed after admin approval.
            </p>
            <button
              onClick={() => {
                setShowSuccessModal(false);
                setCurrentView('wallet');
              }}
              className="bg-green-500 hover:bg-green-600 text-white font-bold text-sm sm:text-base px-6 sm:px-8 py-2 sm:py-3 rounded-lg transition-all"
            >
              OK
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="px-4 py-2 flex items-center justify-between bg-blue-700">
        <button
          onClick={() => setCurrentView('wallet')}
          className="hover:text-blue-200 text-white text-sm sm:text-base flex items-center gap-2 px-2 sm:px-3 py-1 sm:py-2 font-bold"
        >
          <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          <span>ተመለስ</span>
        </button>
        <h1 className="text-xl sm:text-2xl font-bold"></h1>
        <div className="w-20"></div>
      </div>

      {/* Main Content */}
      <div className="flex-1 px-4 py-6 space-y-4 overflow-y-auto">
        {/* Instructions Box */}
        <div className="bg-blue-500 rounded-lg p-4 border-2 border-blue-400">
          <h2 className="text-white font-bold text-base sm:text-lg mb-2">
            ገንዘብ Deposit ለማደረግ መሟላት ያለባቸው ነገሮች
          </h2>
          <div className="text-white text-sm space-y-1">
            <p>• ተቀማጭ የሆነው መጠን እና ወደ ሂሳቡ የላኩት መጠን እኩል መሆን አለባቸው።</p>
            <p>• ገንዘብ ሲላኩ "Transaction ID" ወይም "FT Number" ያስፈልጋል</p>
            <p>• ዝቅተኛው የገንዘብ መጠን {DEPOSIT_CONFIG.MIN_AMOUNT} ብር ነው</p>
            <p>• ከፍተኛው የገንዘብ መጠን {DEPOSIT_CONFIG.MAX_AMOUNT} ብር ነው</p>
          </div>
        </div>

        {/* Payment Type Dropdown */}
        <div>
          <label className="block text-white font-bold text-sm sm:text-base mb-2">
            የመክፈያ አማራጭ ይምረጡ
          </label>
          <select
            value={paymentType}
            onChange={(e) => {
              setPaymentType(e.target.value);
              setTransactionId(''); // Reset transaction ID when payment type changes
            }}
            className="w-full bg-white text-gray-900 px-4 py-3 rounded-lg text-lg font-semibold"
          >
            <option value="">አይነት ይምረጡ</option>
            {PAYMENT_TYPES.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </div>

        {/* Account Number Display - Only show when payment type is selected */}
        {paymentType && accountNumber && (
          <div className="bg-blue-700 rounded-lg p-4 border-2 border-blue-400">
            <div className="text-center">
              <p className="text-blue-200 text-sm mb-2">Account Number:</p>
              <p className="text-white font-bold text-2xl mb-2">{accountNumber}</p>
              <button
                onClick={handleCopyAccount}
                className="text-blue-300 underline text-sm hover:text-blue-200"
              >
                {copied ? 'Copied!' : 'ኮፒ'}
              </button>
            </div>
          </div>
        )}

        {/* Amount Input */}
        <div>
          <label className="block text-white font-bold text-sm sm:text-base mb-2">
            ያስገቡት የብር መጠን
          </label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="ያስገቡት የብር መጠን"
            min={DEPOSIT_CONFIG.MIN_AMOUNT}
            max={DEPOSIT_CONFIG.MAX_AMOUNT}
            className="w-full bg-white text-gray-900 px-4 py-3 rounded-lg text-lg font-semibold"
          />
          {amount && (
            <div className="mt-2 text-sm">
              {amountNum < DEPOSIT_CONFIG.MIN_AMOUNT ? (
                <p className="text-red-300">Minimum deposit is {DEPOSIT_CONFIG.MIN_AMOUNT} ETB</p>
              ) : amountNum > DEPOSIT_CONFIG.MAX_AMOUNT ? (
                <p className="text-red-300">Maximum deposit is {DEPOSIT_CONFIG.MAX_AMOUNT} ETB</p>
              ) : null}
            </div>
          )}
        </div>

        {/* Transaction ID Field - Only show when payment type is selected */}
        {paymentType && (
          <div>
            <label className="block text-white font-bold text-sm sm:text-base mb-2">
              Transaction ID / FT Number
            </label>
            <input
              type="text"
              value={transactionId}
              onChange={(e) => setTransactionId(e.target.value)}
              placeholder="Enter transaction ID or FT Number"
              className="w-full bg-white text-gray-900 px-4 py-3 rounded-lg text-lg font-semibold"
            />
          </div>
        )}

        {/* Deposit Button */}
        <button
          onClick={handleDeposit}
          disabled={!canDeposit || submitting}
          className={`w-full font-bold text-lg py-4 rounded-lg transition-all shadow-lg ${
            canDeposit && !submitting
              ? 'bg-green-500 hover:bg-green-600 text-white'
              : 'bg-gray-500 text-gray-300 cursor-not-allowed'
          }`}
        >
          {submitting ? 'Submitting...' : 'ገቢ ያድርጉ'}
        </button>
      </div>
    </main>
  );
}

