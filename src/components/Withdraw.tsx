'use client';

import { useState } from 'react';
import { type User, type Wallet, withdraw, getWalletByTelegramId } from '@/lib/api';
import { useGameStore } from '@/store/gameStore';

interface WithdrawProps {
  user: User;
  wallet: Wallet;
  onWalletUpdate?: (wallet: Wallet) => void;
}

/**
 * Withdrawal configuration
 * Update these values to change withdrawal limits
 */
export const WITHDRAW_CONFIG = {
  // Withdrawal amount limits
  MIN_AMOUNT: 50, // Minimum withdrawal amount in Birr
  MIN_REMAINING: 10, // Minimum balance that must remain after withdrawal
};

// Withdraw types with display names and API values
// Note: API expects 'Telebirr' (capital T) and 'CBE'
const WITHDRAW_TYPES = [
  { value: 'Telebirr', label: 'Telebirr' },
  { value: 'CBE', label: 'CBE' },
] as const;

export default function Withdraw({ user, wallet, onWalletUpdate }: WithdrawProps) {
  const { setCurrentView } = useGameStore();
  const [withdrawType, setWithdrawType] = useState<string>('');
  const [accountNumber, setAccountNumber] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  const amountNum = parseFloat(amount) || 0;
  const remainingBalance = wallet.balance - amountNum;
  const isValidAmount = amountNum >= WITHDRAW_CONFIG.MIN_AMOUNT && remainingBalance >= WITHDRAW_CONFIG.MIN_REMAINING;
  const canWithdraw = withdrawType && accountNumber.trim() !== '' && isValidAmount;

  const handleWithdraw = async () => {
    if (!canWithdraw) return;

    const withdrawAmount = parseFloat(amount);

    // Validation
    if (withdrawAmount < WITHDRAW_CONFIG.MIN_AMOUNT) {
      alert(`Minimum withdrawal amount is ${WITHDRAW_CONFIG.MIN_AMOUNT} ETB`);
      return;
    }

    if (wallet.balance - withdrawAmount < WITHDRAW_CONFIG.MIN_REMAINING) {
      alert(`You must leave at least ${WITHDRAW_CONFIG.MIN_REMAINING} ETB in your account after withdrawal`);
      return;
    }

    if (withdrawAmount > wallet.balance) {
      alert('Insufficient balance');
      return;
    }

    setSubmitting(true);

    try {
      await withdraw(user.id, withdrawAmount, accountNumber.trim(), withdrawType);
      
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
      console.error('Error withdrawing:', err);
      const errorMessage = err.response?.data?.error || err.response?.data?.message || 'Failed to submit withdrawal request';
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
              Withdrawal request submitted successfully!
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
        {/* Current Balance */}
        <div className="bg-blue-700 rounded-lg p-4 border-2 border-blue-400 text-center">
          <p className="text-blue-200 text-sm mb-1">Current Balance</p>
          <p className="text-white font-bold text-2xl">{wallet.balance.toFixed(2)} ETB</p>
        </div>

        {/* Withdraw Type Dropdown */}
        <div>
          <label className="block text-white font-bold text-sm sm:text-base mb-2">
            የወጪ አማራጭ ይምረጡ
          </label>
          <select
            value={withdrawType}
            onChange={(e) => {
              setWithdrawType(e.target.value);
              setAccountNumber(''); // Reset account number when withdraw type changes
            }}
            className="w-full bg-white text-gray-900 px-4 py-3 rounded-lg text-lg font-semibold"
          >
            <option value="">አይነት ይምረጡ</option>
            {WITHDRAW_TYPES.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </div>

        {/* Account Number - Only show when withdraw type is selected */}
        {withdrawType && (
          <div>
            <label className="block text-white font-bold text-sm sm:text-base mb-2">
            የሂሳብ ቁጥር
            </label>
            <input
              type="text"
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value)}
              placeholder="Enter account number"
              className="w-full bg-white text-gray-900 px-4 py-3 rounded-lg text-lg font-semibold"
            />
          </div>
        )}

        {/* Amount Input */}
        <div>
          <label className="block text-white font-bold text-sm sm:text-base mb-2">
            የብር መጠን
          </label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="ያስገቡት የብር መጠን"
            min={WITHDRAW_CONFIG.MIN_AMOUNT}
            max={wallet.balance - WITHDRAW_CONFIG.MIN_REMAINING}
            className="w-full bg-white text-gray-900 px-4 py-3 rounded-lg text-lg font-semibold"
          />
          {amount && (
            <div className="mt-2 text-sm">
              {amountNum < WITHDRAW_CONFIG.MIN_AMOUNT ? (
                <p className="text-red-300">Minimum withdrawal is {WITHDRAW_CONFIG.MIN_AMOUNT} ETB</p>
              ) : remainingBalance < WITHDRAW_CONFIG.MIN_REMAINING ? (
                <p className="text-red-300">You must leave at least {WITHDRAW_CONFIG.MIN_REMAINING} ETB remaining</p>
              ) : (
                <p className="text-green-300">Remaining balance: {remainingBalance.toFixed(2)} ETB</p>
              )}
            </div>
          )}
        </div>

        {/* Withdraw Button */}
        <button
          onClick={handleWithdraw}
          disabled={!canWithdraw || submitting}
          className={`w-full font-bold text-lg py-4 rounded-lg transition-all shadow-lg ${
            canWithdraw && !submitting
              ? 'bg-red-500 hover:bg-red-600 text-white'
              : 'bg-gray-500 text-gray-300 cursor-not-allowed'
          }`}
        >
          {submitting ? 'Submitting...' : 'ወጪ'}
        </button>
      </div>
    </main>
  );
}

