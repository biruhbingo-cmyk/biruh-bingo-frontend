'use client';

import { type User, type Wallet } from '@/lib/api';
import { useGameStore } from '@/store/gameStore';

interface WalletProps {
  user: User;
  wallet: Wallet;
  onWalletUpdate?: (wallet: Wallet) => void;
}

export default function Wallet({ user, wallet, onWalletUpdate }: WalletProps) {
  const { setCurrentView } = useGameStore();

  return (
    <main className="min-h-screen bg-blue-600 text-white flex flex-col">
      {/* Header */}
      <div className="px-4 py-2 flex items-center justify-between bg-blue-700">
        <button
          onClick={() => setCurrentView('selection')}
          className="hover:text-blue-200 text-white text-sm sm:text-base flex items-center gap-2 px-2 sm:px-3 py-1 sm:py-2 font-bold"
        >
          <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          <span>ተመለስ</span>
        </button>
        {/* Balance */}
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
            <path d="M4 4a2 2 0 00-2 2v1a16.94 16.94 0 0012 6 16.94 16.94 0 0012-6V6a2 2 0 00-2-2H4z" />
            <path fillRule="evenodd" d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z" clipRule="evenodd" />
          </svg>
          <span className="text-yellow-400 font-semibold text-lg">
            {wallet.balance.toFixed(2)} ETB
          </span>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 px-4 py-6 space-y-4">
        {/* Deposit Button */}
        <button
          onClick={() => setCurrentView('deposit')}
          className="w-full bg-green-500 hover:bg-green-600 text-white font-bold text-lg py-4 rounded-lg flex items-center justify-center gap-3 transition-all shadow-lg"
        >
          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
            <path d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          <span>ገቢ</span>
        </button>

        {/* Withdraw Button */}
        <button
          onClick={() => setCurrentView('withdraw')}
          className="w-full bg-red-500 hover:bg-red-600 text-white font-bold text-lg py-4 rounded-lg flex items-center justify-center gap-3 transition-all shadow-lg"
        >
          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
            <path d="M4 4a2 2 0 00-2 2v1a16.94 16.94 0 0012 6 16.94 16.94 0 0012-6V6a2 2 0 00-2-2H4z" />
            <path fillRule="evenodd" d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z" clipRule="evenodd" />
          </svg>
          <span>ወጪ</span>
        </button>

        {/* History Button */}
        <button
          onClick={() => setCurrentView('history')}
          className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold text-lg py-4 rounded-lg flex items-center justify-center gap-3 transition-all shadow-lg"
        >
          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
          </svg>
          <span>ታሪክ</span>
        </button>
      </div>


    </main>
  );
}

