'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import GameSelection from '@/components/GameSelection';
import CardSelection from '@/components/CardSelection';
import GamePlay from '@/components/GamePlay';
import { useGameStore } from '@/store/gameStore';

function HomeContent() {
  const searchParams = useSearchParams();
  const [userId, setUserId] = useState<string | null>(null);
  const { currentView } = useGameStore();

  useEffect(() => {
    const userIdParam = searchParams.get('userId');
    const token = searchParams.get('token');
    
    if (userIdParam) {
      setUserId(userIdParam);
    }
  }, [searchParams]);

  if (!userId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-500 to-purple-600">
        <div className="text-white text-center">
          <h1 className="text-2xl font-bold mb-4">Loading...</h1>
          <p>Please wait while we load your game.</p>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-500 to-purple-600">
      {currentView === 'selection' && <GameSelection userId={userId} />}
      {currentView === 'cards' && <CardSelection userId={userId} />}
      {currentView === 'play' && <GamePlay userId={userId} />}
    </main>
  );
}

export default function Home() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-500 to-purple-600">
        <div className="text-white text-center">
          <h1 className="text-2xl font-bold mb-4">Loading...</h1>
        </div>
      </div>
    }>
      <HomeContent />
    </Suspense>
  );
}

