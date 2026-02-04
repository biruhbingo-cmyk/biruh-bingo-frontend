'use client';

import { useState, useEffect } from 'react';
import { type User, type Wallet, getDeposits, getWithdrawals, getTransfers, type Transaction, type TransferTransaction } from '@/lib/api';
import { useGameStore } from '@/store/gameStore';

interface HistoryProps {
  user: User;
  wallet: Wallet;
}

type HistoryType = 'deposits' | 'withdrawals' | 'transfers';

export default function History({ user, wallet }: HistoryProps) {
  const { setCurrentView } = useGameStore();
  const [historyType, setHistoryType] = useState<HistoryType>('deposits');
  const [showAll, setShowAll] = useState(false); // Default to 10 records
  const [deposits, setDeposits] = useState<Transaction[]>([]);
  const [withdrawals, setWithdrawals] = useState<Transaction[]>([]);
  const [transfers, setTransfers] = useState<TransferTransaction[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchHistory = async () => {
      setLoading(true);
      try {
        switch (historyType) {
          case 'deposits':
            const depositData = await getDeposits(user.id, showAll);
            setDeposits(depositData);
            break;
          case 'withdrawals':
            const withdrawalData = await getWithdrawals(user.id, showAll);
            setWithdrawals(withdrawalData);
            break;
          case 'transfers':
            const transferData = await getTransfers(user.id, showAll);
            setTransfers(transferData);
            break;
        }
      } catch (err: any) {
        console.error('Error fetching history:', err);
        alert('Failed to load history');
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [historyType, user.id, showAll]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'text-green-300';
      case 'pending':
        return 'text-yellow-300';
      case 'failed':
        return 'text-red-300';
      default:
        return 'text-blue-200';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const renderDeposits = () => {
    if (loading) {
      return (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-blue-200">Loading...</p>
        </div>
      );
    }

    if (deposits.length === 0) {
      return (
        <div className="text-center py-8 text-blue-200">
          <p>No deposit history found</p>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {deposits.map((transaction) => (
          <div
            key={transaction.id}
            className="bg-blue-700 rounded-lg p-4 border-2 border-blue-500"
          >
            <div className="flex justify-between items-start mb-2">
              <div>
                <p className="text-white font-bold text-lg">+{transaction.amount.toFixed(2)} ETB</p>
                <p className="text-blue-200 text-sm">{transaction.transaction_type || 'N/A'}</p>
              </div>
              <span className={`font-semibold ${getStatusColor(transaction.status)}`}>
                {transaction.status.toUpperCase()}
              </span>
            </div>
            {transaction.transaction_id && (
              <p className="text-blue-300 text-xs mb-1">TX ID: {transaction.transaction_id}</p>
            )}
            <p className="text-blue-200 text-xs">{formatDate(transaction.created_at)}</p>
          </div>
        ))}
      </div>
    );
  };

  const renderWithdrawals = () => {
    if (loading) {
      return (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-blue-200">Loading...</p>
        </div>
      );
    }

    if (withdrawals.length === 0) {
      return (
        <div className="text-center py-8 text-blue-200">
          <p>No withdrawal history found</p>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {withdrawals.map((transaction) => (
          <div
            key={transaction.id}
            className="bg-blue-700 rounded-lg p-4 border-2 border-blue-500"
          >
            <div className="flex justify-between items-start mb-2">
              <div>
                <p className="text-white font-bold text-lg">-{transaction.amount.toFixed(2)} ETB</p>
              </div>
              <span className={`font-semibold ${getStatusColor(transaction.status)}`}>
                {transaction.status.toUpperCase()}
              </span>
            </div>
            <p className="text-blue-200 text-xs">{formatDate(transaction.created_at)}</p>
          </div>
        ))}
      </div>
    );
  };

  const renderTransfers = () => {
    if (loading) {
      return (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-blue-200">Loading...</p>
        </div>
      );
    }

    if (transfers.length === 0) {
      return (
        <div className="text-center py-8 text-blue-200">
          <p>No transfer history found</p>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {transfers.map((item) => {
          const transaction = item.transaction;
          const isOutgoing = transaction.type === 'transfer_out';
          return (
            <div
              key={transaction.id}
              className="bg-blue-700 rounded-lg p-4 border-2 border-blue-500"
            >
              <div className="flex justify-between items-start mb-2">
                <div>
                  <p className={`text-white font-bold text-lg ${isOutgoing ? '' : 'text-green-300'}`}>
                    {isOutgoing ? '-' : '+'}{transaction.amount.toFixed(2)} ETB
                  </p>
                  {item.to && (
                    <p className="text-blue-200 text-sm">
                      {isOutgoing ? 'To' : 'From'}: {item.to.first_name} {item.to.last_name || ''}
                    </p>
                  )}
                </div>
                <span className={`font-semibold ${getStatusColor(transaction.status)}`}>
                  {transaction.status.toUpperCase()}
                </span>
              </div>
              <p className="text-blue-200 text-xs">{formatDate(transaction.created_at)}</p>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <main className="min-h-screen bg-blue-600 text-white flex flex-col">
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
        {/* Show All Toggle */}
        <button
          onClick={() => setShowAll(!showAll)}
          className={`py-1.5 px-3 rounded-lg font-bold text-xs sm:text-sm transition-all ${
            showAll
              ? 'bg-yellow-500 text-white'
              : 'bg-blue-600 text-blue-200 hover:bg-blue-500'
          }`}
        >
          {showAll ? 'All' : '10'}
        </button>
      </div>

      {/* History Type Selector */}
      <div className="px-4 py-4 bg-blue-700 border-b-2 border-blue-500">
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => {
              setHistoryType('deposits');
              setShowAll(false); // Reset to default 10 when switching types
            }}
            className={`py-2 px-3 rounded-lg font-bold text-sm transition-all ${
              historyType === 'deposits'
                ? 'bg-green-500 text-white'
                : 'bg-blue-600 text-blue-200 hover:bg-blue-500'
            }`}
          >
            Deposits
          </button>
          <button
            onClick={() => {
              setHistoryType('withdrawals');
              setShowAll(false); // Reset to default 10 when switching types
            }}
            className={`py-2 px-3 rounded-lg font-bold text-sm transition-all ${
              historyType === 'withdrawals'
                ? 'bg-red-500 text-white'
                : 'bg-blue-600 text-blue-200 hover:bg-blue-500'
            }`}
          >
            Withdrawals
          </button>
          <button
            onClick={() => {
              setHistoryType('transfers');
              setShowAll(false); // Reset to default 10 when switching types
            }}
            className={`py-2 px-3 rounded-lg font-bold text-sm transition-all ${
              historyType === 'transfers'
                ? 'bg-blue-500 text-white'
                : 'bg-blue-600 text-blue-200 hover:bg-blue-500'
            }`}
          >
            Transfers
          </button>
        </div>
      </div>

      {/* History Content */}
      <div className="flex-1 px-4 py-4 overflow-y-auto">
        {historyType === 'deposits' && renderDeposits()}
        {historyType === 'withdrawals' && renderWithdrawals()}
        {historyType === 'transfers' && renderTransfers()}
      </div>
    </main>
  );
}

