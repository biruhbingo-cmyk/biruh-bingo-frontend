'use client';

import { useState, useEffect } from 'react';
import { type User, type Wallet, withdraw, getWalletByTelegramId, getDeposits } from '@/lib/api';
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
  const [hasDeposits, setHasDeposits] = useState<boolean | null>(null); // null = checking, true = has deposits, false = no deposits
  const [checkingDeposits, setCheckingDeposits] = useState(true);

  // Check if user has at least one deposit
  useEffect(() => {
    const checkDeposits = async () => {
      try {
        const deposits = await getDeposits(user.id, true); // Check all deposits
        setHasDeposits(deposits.length > 0);
      } catch (err) {
        console.error('Error checking deposits:', err);
        setHasDeposits(false); // Default to false on error
      } finally {
        setCheckingDeposits(false);
      }
    };

    checkDeposits();
  }, [user.id]);

  const amountNum = parseFloat(amount) || 0;
  const remainingBalance = wallet.balance - amountNum;
  const isValidAmount = amountNum >= WITHDRAW_CONFIG.MIN_AMOUNT && remainingBalance >= WITHDRAW_CONFIG.MIN_REMAINING;
  const canWithdraw = hasDeposits && withdrawType && accountNumber.trim() !== '' && isValidAmount;

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

        {/* Checking Deposits Loading */}
        {checkingDeposits && (
          <div className="bg-blue-700 rounded-lg p-4 border-2 border-blue-400 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-2"></div>
            <p className="text-blue-200 text-sm">Checking deposit history...</p>
          </div>
        )}

        {/* No Deposits Warning */}
        {!checkingDeposits && !hasDeposits && (
          <div className="bg-red-500 rounded-lg p-4 border-2 border-red-400">
            <div className="flex items-center gap-2 mb-2">
              <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <h3 className="text-white font-bold text-lg">Withdrawal Not Available</h3>
            </div>
            <p className="text-white text-sm">
              You must make at least one deposit before you can withdraw funds. Please make a deposit first.
            </p>
            <button
              onClick={() => setCurrentView('deposit')}
              className="mt-3 bg-white text-red-500 font-bold px-4 py-2 rounded-lg hover:bg-red-50 transition-all"
            >
              Go to Deposit
            </button>
          </div>
        )}

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
            disabled={!hasDeposits || checkingDeposits}
            className={`w-full bg-white text-gray-900 px-4 py-3 rounded-lg text-lg font-semibold border-0 appearance-none ${
              !hasDeposits || checkingDeposits ? 'opacity-50 cursor-not-allowed' : ''
            }`}
            style={{ backgroundColor: 'white', color: '#111827' }}
          >
            <option value="" style={{ backgroundColor: 'white', color: '#111827' }}>አይነት ይምረጡ</option>
            {WITHDRAW_TYPES.map((type) => (
              <option key={type.value} value={type.value} style={{ backgroundColor: 'white', color: '#111827' }}>
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
              disabled={!hasDeposits || checkingDeposits}
              className={`w-full bg-white text-gray-900 px-4 py-3 rounded-lg text-lg font-semibold ${
                !hasDeposits || checkingDeposits ? 'opacity-50 cursor-not-allowed' : ''
              }`}
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
            disabled={!hasDeposits || checkingDeposits}
            className={`w-full bg-white text-gray-900 px-4 py-3 rounded-lg text-lg font-semibold ${
              !hasDeposits || checkingDeposits ? 'opacity-50 cursor-not-allowed' : ''
            }`}
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

