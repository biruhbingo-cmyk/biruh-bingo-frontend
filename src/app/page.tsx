'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { getUserByTelegramId, getWalletByTelegramId, type User, type Wallet } from '@/lib/api';
import { useGameStore } from '@/store/gameStore';
import GameSelection from '@/components/GameSelection';
import CardSelection from '@/components/CardSelection';
import GamePlay from '@/components/GamePlay';
import WalletPage from '@/components/Wallet';
import Deposit from '@/components/Deposit';
import Withdraw from '@/components/Withdraw';
import History from '@/components/History';

function HomeContent() {
  const searchParams = useSearchParams();
  const [user, setUser] = useState<User | null>(null);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { currentView } = useGameStore();

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        // Get telegram_id from token parameter (or userId if numeric)
        const token = searchParams.get('token');
        const userIdParam = searchParams.get('userId');
        
        const telegramId = token || (userIdParam && /^\d+$/.test(userIdParam) ? userIdParam : null);
        
        if (!telegramId) {
          setError('Missing telegram_id parameter');
          setLoading(false);
          return;
        }

        // Fetch user and wallet data
        const [userData, walletData] = await Promise.all([
          getUserByTelegramId(telegramId),
          getWalletByTelegramId(telegramId),
        ]);

        setUser(userData);
        setWallet(walletData);
      } catch (err: any) {
        console.error('Error fetching user data:', err);
        setError(err.response?.data?.error || 'Failed to load user data');
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, [searchParams]);

  // Refetch wallet when returning to selection view (e.g., after a game finishes)
  useEffect(() => {
    const refetchWallet = async () => {
      if (currentView === 'selection' && user) {
        try {
          const updatedWallet = await getWalletByTelegramId(user.telegram_id.toString());
          setWallet(updatedWallet);
          console.log('💰 Wallet balance refreshed:', updatedWallet.balance);
        } catch (err: any) {
          console.error('Error refetching wallet:', err);
        }
      }
    };

    refetchWallet();
  }, [currentView, user]);

  if (loading) {
    return (
      <main className="min-h-screen bg-blue-600 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p>Loading...</p>
        </div>
      </main>
    );
  }

  if (error || !user || !wallet) {
    return (
      <main className="min-h-screen bg-blue-600 text-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4 text-red-400">Error</h1>
          <p className="text-gray-400">{error || 'Failed to load user data'}</p>
        </div>
      </main>
    );
  }

  // Render based on current view
  if (currentView === 'cards') {
    return <CardSelection user={user} wallet={wallet} />;
  }

  if (currentView === 'play') {
    return <GamePlay user={user} wallet={wallet} onWalletUpdate={setWallet} />;
  }

  if (currentView === 'wallet') {
    return <WalletPage user={user} wallet={wallet} onWalletUpdate={setWallet} />;
  }

  if (currentView === 'deposit') {
    return <Deposit user={user} wallet={wallet} onWalletUpdate={setWallet} />;
  }

  if (currentView === 'withdraw') {
    return <Withdraw user={user} wallet={wallet} onWalletUpdate={setWallet} />;
  }

  if (currentView === 'history') {
    return <History user={user} wallet={wallet} />;
  }

  // Default to game selection
  return <GameSelection user={user} wallet={wallet} />;
}

export default function Home() {
  return (
    <Suspense fallback={
      <main className="min-h-screen bg-blue-600 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p>Loading...</p>
        </div>
      </main>
    }>
      <HomeContent />
    </Suspense>
  );
}
