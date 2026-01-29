'use client';

import { useEffect, useState, useRef } from 'react';
import { getGames, getGameState, calculatePotentialWin, getCountdownSeconds, WS_URL, type Game, type Wallet } from '@/lib/api';
import { useGameStore } from '@/store/gameStore';
import { useGameWebSocket, type WebSocketMessage } from '@/hooks/useSocket';
import Header from './Header';
import { type User } from '@/lib/api';

// Game type mapping: G1-G7 to bet amounts
const GAME_TYPES = [
  { type: 'G1', bet: 5 },
  { type: 'G2', bet: 7 },
  { type: 'G3', bet: 10 },
  { type: 'G4', bet: 20 },
  { type: 'G5', bet: 50 },
  { type: 'G6', bet: 100 },
  { type: 'G7', bet: 200 },
];

// Module-level WebSocket store that persists across component mounts/unmounts
const globalSockets = new Map<string, WebSocket>();
// Track which game ID each WebSocket connection is currently watching
const wsGameIdMap = new Map<string, string>(); // gameType -> currentGameId

interface GameSelectionProps {
  user: User;
  wallet: Wallet;
}

export default function GameSelection({ user, wallet }: GameSelectionProps) {
  const [games, setGames] = useState<Game[]>([]);
  const [countdowns, setCountdowns] = useState<Record<string, number | null>>({});
  const { setCurrentView, setSelectedGameType, setSelectedGameTypeString, setCurrentGameId } = useGameStore();
  
  // Store message handlers for this component instance
  const handlersRef = useRef<Map<string, (event: MessageEvent) => void>>(new Map());
  // Track processed NEW_GAME_AVAILABLE events to prevent duplicates
  const processedGamesRef = useRef<Set<string>>(new Set());
  // Track games currently being fetched to prevent concurrent fetches
  const fetchingGamesRef = useRef<Set<string>>(new Set());
  // Track games currently being added to state (to prevent React double-invocation duplicates)
  const addingGamesRef = useRef<Set<string>>(new Set());
  // Keep a ref of current games for synchronous checks
  const gamesRef = useRef<Game[]>([]);

  // Fetch initial games data
  useEffect(() => {
    const fetchGames = async () => {
      try {
        const gamesData = await getGames();
        setGames(gamesData);
        gamesRef.current = gamesData;
      } catch (error) {
        console.error('Error fetching games:', error);
      }
    };

    fetchGames();
  }, []);

  // Keep gamesRef in sync with games state
  useEffect(() => {
    gamesRef.current = games;
  }, [games]);

  // Helper function to update games state and ref synchronously
  const updateGames = (updater: (prev: Game[]) => Game[]) => {
    setGames((prev) => {
      const updated = updater(prev);
      gamesRef.current = updated;
      return updated;
    });
  };

  // Connect WebSocket for each game type to get real-time updates
  useEffect(() => {
    const gameTypes = ['G1', 'G2', 'G3', 'G4', 'G5', 'G6', 'G7'];
    
    // Ensure WS_URL doesn't have trailing slash
    const baseUrl = WS_URL.endsWith('/') ? WS_URL.slice(0, -1) : WS_URL;
    
    // Helper function to create/reconnect WebSocket for a game type
    const createOrReconnectWebSocket = (gameType: string, forceReconnect: boolean = false) => {
      const existingWs = globalSockets.get(gameType);
      
      // Close existing connection if force reconnect
      if (forceReconnect && existingWs) {
        console.log(`🔄 Force reconnecting WebSocket for ${gameType}...`);
        existingWs.close();
        globalSockets.delete(gameType);
      }
      
      let ws = globalSockets.get(gameType);
      
      // Create new connection if it doesn't exist or is closed
      if (!ws || ws.readyState === WebSocket.CLOSED || ws.readyState === WebSocket.CLOSING) {
        const wsUrl = `${baseUrl}/api/v1/ws/game?type=${gameType}`;
        
        try {
          ws = new WebSocket(wsUrl);
          globalSockets.set(gameType, ws);

          ws.onopen = () => {
            console.log(`✅ Connected to WebSocket for ${gameType}`);
          };

          ws.onerror = (error) => {
            console.error(`WebSocket error for ${gameType}:`, error);
          };

          ws.onclose = () => {
            console.log(`WebSocket closed for ${gameType}`);
            // Remove from global store if closed
            if (globalSockets.get(gameType) === ws) {
              globalSockets.delete(gameType);
            }
          };
          
          return ws;
        } catch (error) {
          console.error(`Failed to create WebSocket for ${gameType}:`, error);
          return null;
        }
      }
      
      return ws;
    };
    
    // Message handler function for this component instance
    const handleMessage = (gameType: string, event: MessageEvent) => {
      try {
        const rawData = event.data;
        let message: WebSocketMessage;
        
        // Handle both string and already-parsed JSON
        if (typeof rawData === 'string') {
          message = JSON.parse(rawData);
        } else {
          message = rawData as WebSocketMessage;
        }
        
        console.log(`📨 Processing ${message.event} event for ${gameType}:`, message.data);
        
        switch (message.event) {
          case 'INITIAL_STATE':
            // INITIAL_STATE is sent when connecting - track the game ID and update if exists
            // NEW_GAME_AVAILABLE is the only event that should add new games
            if (message.data.game) {
              const gameId = message.data.game.id;
              // Track which game this WebSocket is watching
              wsGameIdMap.set(gameType, gameId);
              console.log(`🎮 Initial state received for ${gameType}: gameId=${gameId}, state=${message.data.game.state}`);
              
              setGames((prev) => {
                const exists = prev.some((g) => g.id === gameId);
                if (!exists) {
                  // Only add if it's a WAITING/COUNTDOWN game (initial connection) - otherwise wait for NEW_GAME_AVAILABLE
                  if (message.data.game.state === 'WAITING' || message.data.game.state === 'COUNTDOWN') {
                    console.log(`✅ Adding initial game for ${gameType} (state: ${message.data.game.state}):`, gameId);
                    // Remove any old game of this type before adding
                    const withoutType = prev.filter((g) => g.game_type !== gameType);
                    return [...withoutType, message.data.game];
                  } else {
                    console.log(`⏸️ Skipping INITIAL_STATE for ${gameType} (state: ${message.data.game.state}) - waiting for NEW_GAME_AVAILABLE`);
                    return prev;
                  }
                }
                // Update existing game
                const updated = prev.map((g) => 
                  g.id === gameId ? message.data.game : g
                );
                console.log(`🔄 Updated existing game for ${gameType}:`, gameId);
                return updated;
              });
            }
            break;

          case 'GAME_STATUS': {
            // Get current game ID for this WebSocket connection
            const currentGameId = wsGameIdMap.get(gameType);
            
            // Check if this is a FINISHED/CANCELLED status message
            if (message.data.status === 'FINISHED' || message.data.status === 'CANCELLED') {
              if (currentGameId) {
                console.log(`🔄 Game status FINISHED/CANCELLED for ${gameType}, gameId=${currentGameId}`);
                setGames((prev) => {
                  const game = prev.find((g) => g.id === currentGameId);
                  if (game) {
                    console.log(`🗑️ Removing ${message.data.status} game ${currentGameId} for ${gameType} - waiting for NEW_GAME_AVAILABLE`);
                    
                    // Clear countdown
                    setCountdowns((prevCountdowns) => {
                      const newCountdowns = { ...prevCountdowns };
                      delete newCountdowns[currentGameId];
                      return newCountdowns;
                    });
                    
                    // Clean up processed games ref
                    processedGamesRef.current.delete(currentGameId);
                    
                    // Clear the mapping - new game will set it via NEW_GAME_AVAILABLE
                    wsGameIdMap.delete(gameType);
                    
                    // Remove the finished/cancelled game from the list
                    return prev.filter((g) => g.id !== currentGameId);
                  }
                  return prev;
                });
              }
              break;
            }
            
            // Regular GAME_STATUS with state update - only update if we have a tracked game ID
            if (message.data.state && currentGameId) {
              console.log(`🔄 Game status for ${gameType}: ${message.data.state}, gameId=${currentGameId}`);
              setGames((prev) => {
                const game = prev.find((g) => g.id === currentGameId);
                if (game) {
                  const oldState = game.state;
                  
                  const updated = prev.map((g) => 
                    g.id === currentGameId
                      ? {
                          ...g,
                          state: message.data.state,
                          player_count: message.data.player_count ?? g.player_count,
                          prize_pool: message.data.prize_pool ?? g.prize_pool,
                          countdown_ends: message.data.countdown_ends ?? g.countdown_ends,
                        }
                      : g
                  );
                  
                  console.log(`📊 Updated game ${gameType}: ${oldState} -> ${message.data.state}`);
                  
                  // Handle countdown based on state change
                  if (message.data.state !== 'COUNTDOWN') {
                    // Clear countdown when state changes to DRAWING, etc.
                    setCountdowns((prevCountdowns) => {
                      const newCountdowns = { ...prevCountdowns };
                      delete newCountdowns[currentGameId];
                      return newCountdowns;
                    });
                  } else {
                    // State is COUNTDOWN - set countdown from message or calculate
                    if (message.data.secondsLeft !== undefined) {
                      if (message.data.secondsLeft > 0) {
                        setCountdowns((prevCountdowns) => ({
                          ...prevCountdowns,
                          [currentGameId]: message.data.secondsLeft,
                        }));
                      } else {
                        setCountdowns((prevCountdowns) => {
                          const newCountdowns = { ...prevCountdowns };
                          delete newCountdowns[currentGameId];
                          return newCountdowns;
                        });
                      }
                    } else if (message.data.countdown_ends) {
                      // Calculate from countdown_ends if secondsLeft not provided
                      const now = new Date().getTime();
                      const ends = new Date(message.data.countdown_ends).getTime();
                      const seconds = Math.max(0, Math.floor((ends - now) / 1000));
                      if (seconds > 0) {
                        setCountdowns((prevCountdowns) => ({
                          ...prevCountdowns,
                          [currentGameId]: seconds,
                        }));
                      } else {
                        setCountdowns((prevCountdowns) => {
                          const newCountdowns = { ...prevCountdowns };
                          delete newCountdowns[currentGameId];
                          return newCountdowns;
                        });
                      }
                    }
                  }
                  
                  return updated;
                }
                // Game not found - do nothing, wait for NEW_GAME_AVAILABLE
                return prev;
              });
            }
            // Also check if countdown_ends is set but state wasn't updated
            else if (message.data.countdown_ends && currentGameId) {
              setGames((prev) => {
                const game = prev.find((g) => g.id === currentGameId);
                if (game && game.state === 'WAITING') {
                  // If we have countdown_ends but state is still WAITING, update to COUNTDOWN
                  console.log(`🔄 Auto-updating state: WAITING -> COUNTDOWN (countdown_ends received) for ${gameType}`);
                  return prev.map((g) =>
                    g.id === currentGameId
                      ? {
                          ...g,
                          state: 'COUNTDOWN',
                          countdown_ends: message.data.countdown_ends,
                          player_count: message.data.player_count ?? g.player_count,
                          prize_pool: message.data.prize_pool ?? g.prize_pool,
                        }
                      : g
                  );
                }
                return prev;
              });
            }
            break;
          }

          case 'PLAYER_COUNT': {
            const currentGameId = wsGameIdMap.get(gameType);
            if (message.data.count !== undefined && currentGameId) {
              console.log(`👥 Player count for ${gameType}:`, message.data.count);
              setGames((prev) => {
                const game = prev.find((g) => g.id === currentGameId);
                if (game) {
                  return prev.map((g) =>
                    g.id === currentGameId ? { ...g, player_count: message.data.count } : g
                  );
                }
                return prev;
              });
            }
            break;
          }

          case 'PLAYER_JOINED':
          case 'PLAYER_LEFT': {
            const currentGameId = wsGameIdMap.get(gameType);
            console.log(`👥 Player ${message.event} for ${gameType}:`, message.data);
            if (currentGameId) {
              setGames((prev) => {
                const game = prev.find((g) => g.id === currentGameId);
                if (game) {
                  // If count is provided, use it; otherwise increment/decrement manually
                  let newPlayerCount: number;
                  if (message.data.count !== undefined) {
                    newPlayerCount = message.data.count;
                  } else {
                    // Manually increment for JOINED, decrement for LEFT
                    if (message.event === 'PLAYER_JOINED') {
                      newPlayerCount = (game.player_count || 0) + 1;
                    } else {
                      newPlayerCount = Math.max(0, (game.player_count || 0) - 1);
                    }
                  }
                  
                  return prev.map((g) =>
                    g.id === currentGameId
                      ? {
                          ...g,
                          player_count: newPlayerCount,
                          prize_pool: message.data.prize_pool ?? g.prize_pool,
                        }
                      : g
                  );
                }
                return prev;
              });
            }
            break;
          }

          case 'COUNTDOWN': {
            const currentGameId = wsGameIdMap.get(gameType);
            console.log(`⏰ Countdown update for ${gameType}:`, message.data.secondsLeft);
            if (currentGameId && message.data.secondsLeft !== undefined) {
              setGames((prev) => {
                const game = prev.find((g) => g.id === currentGameId);
                if (!game) return prev;
                
                // Don't update state if already DRAWING, FINISHED, CLOSED, or CANCELLED
                if (game.state === 'DRAWING' || game.state === 'FINISHED' || game.state === 'CLOSED' || game.state === 'CANCELLED') {
                  // Clear countdown if state is DRAWING or beyond
                  if (game.state === 'DRAWING') {
                    setCountdowns((prevCountdowns) => {
                      const newCountdowns = { ...prevCountdowns };
                      delete newCountdowns[currentGameId];
                      return newCountdowns;
                    });
                  }
                  return prev;
                }
                
                // If state is still WAITING, update it to COUNTDOWN
                const newState = game.state === 'WAITING' ? 'COUNTDOWN' : game.state;
                
                // Only set countdown if state is COUNTDOWN and secondsLeft is valid
                if (newState === 'COUNTDOWN') {
                  if (message.data.secondsLeft > 0) {
                    setCountdowns((prevCountdowns) => ({
                      ...prevCountdowns,
                      [currentGameId]: message.data.secondsLeft,
                    }));
                  } else {
                    // If countdown reaches 0, clear it
                    setCountdowns((prevCountdowns) => {
                      const newCountdowns = { ...prevCountdowns };
                      delete newCountdowns[currentGameId];
                      return newCountdowns;
                    });
                  }
                }
                
                return prev.map((g) =>
                  g.id === currentGameId
                    ? {
                        ...g,
                        state: newState,
                        countdown_ends: message.data.countdown_ends ?? g.countdown_ends,
                      }
                    : g
                );
              });
            }
            break;
          }

          case 'NUMBER_DRAWN': {
            const currentGameId = wsGameIdMap.get(gameType);
            console.log(`🎲 Number drawn for ${gameType}:`, message.data.letter, message.data.number);
            if (currentGameId) {
              setGames((prev) => {
                const game = prev.find((g) => g.id === currentGameId);
                if (!game) return prev;
                
                // If game is in COUNTDOWN or WAITING state, transition to DRAWING
                if (game.state === 'COUNTDOWN' || game.state === 'WAITING') {
                  console.log(`🔄 Updating state from ${game.state} to DRAWING (number drawn)`);
                  
                  // Clear countdown when transitioning to DRAWING
                  setCountdowns((prevCountdowns) => {
                    const newCountdowns = { ...prevCountdowns };
                    delete newCountdowns[currentGameId];
                    return newCountdowns;
                  });
                  
                  return prev.map((g) =>
                    g.id === currentGameId ? { ...g, state: 'DRAWING' } : g
                  );
                }
                
                return prev;
              });
            }
            break;
          }

          case 'WINNER': {
            const currentGameId = wsGameIdMap.get(gameType);
            console.log(`🏆 Winner announced for ${gameType}:`, message.data);
            if (currentGameId) {
              setGames((prev) => {
                const game = prev.find((g) => g.id === currentGameId);
                if (game) {
                  // Remove the finished game - backend will send NEW_GAME_AVAILABLE for new game
                  console.log(`🗑️ Removing finished game ${currentGameId} for ${gameType} - waiting for NEW_GAME_AVAILABLE`);
                  
                  // Clear countdown when game finishes
                  setCountdowns((prevCountdowns) => {
                    const newCountdowns = { ...prevCountdowns };
                    delete newCountdowns[currentGameId];
                    return newCountdowns;
                  });
                  
                  // Clean up processed games ref
                  processedGamesRef.current.delete(currentGameId);
                  
                  // Clear the mapping - new game will set it via NEW_GAME_AVAILABLE
                  wsGameIdMap.delete(gameType);
                  
                  // Remove the finished game from the list
                  return prev.filter((g) => g.id !== currentGameId);
                }
                return prev;
              });
            }
            break;
          }

          case 'NEW_GAME_AVAILABLE':
            // New game is available - THIS IS THE ONLY PLACE THAT ADDS/REPLACES GAMES
            const processingId = `${gameType}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            console.log(`🎮 [${processingId}] New game available for ${gameType}:`, message.data);
            if (message.data.gameId && message.data.gameType === gameType) {
              const gameId = message.data.gameId;
              
              // Check if we've already processed this game ID to prevent duplicates
              if (processedGamesRef.current.has(gameId)) {
                console.log(`⚠️ [${processingId}] Game ${gameId} already processed for ${gameType}, skipping duplicate`);
                return;
              }
              
              // Check if we're already fetching this game
              if (fetchingGamesRef.current.has(gameId)) {
                console.log(`⚠️ [${processingId}] Game ${gameId} already being fetched for ${gameType}, skipping duplicate fetch`);
                return;
              }
              
              // Check if game already exists in state synchronously using ref
              const alreadyExists = gamesRef.current.some((g) => g.id === gameId);
              if (alreadyExists) {
                console.log(`⚠️ Game ${gameId} already exists in state for ${gameType}, skipping`);
                processedGamesRef.current.add(gameId);
                // Update the tracking even if it exists
                wsGameIdMap.set(gameType, gameId);
                return;
              }
              
              // Mark as fetching to prevent concurrent fetches
              fetchingGamesRef.current.add(gameId);
              
              // Mark as processing to prevent duplicate processing BEFORE async call
              processedGamesRef.current.add(gameId);
              
              // Track this game ID for this WebSocket connection
              wsGameIdMap.set(gameType, gameId);
              
              console.log(`📥 [${processingId}] Fetching game state for ${gameId} (${gameType})...`);
              
              // Helper function to fetch game with retry logic
              // The backend creates the game in a goroutine, so it might not be in DB immediately
              const fetchGameWithRetry = async (retryCount: number = 0, maxRetries: number = 3): Promise<Game | null> => {
                const delay = Math.min(1000 * Math.pow(2, retryCount), 3000); // Exponential backoff: 1s, 2s, 3s
                
                if (retryCount > 0) {
                  console.log(`⏳ [${processingId}] Retrying fetch (attempt ${retryCount + 1}/${maxRetries + 1}) after ${delay}ms delay...`);
                  await new Promise(resolve => setTimeout(resolve, delay));
                }
                
                try {
                  // Try getGameState first
                  const gameState = await getGameState(gameId);
                  if (gameState?.game) {
                    return gameState.game;
                  }
                } catch (error: any) {
                  // If getGameState fails, try getGames as fallback
                  if (retryCount < maxRetries) {
                    console.warn(`⚠️ [${processingId}] getGameState failed (attempt ${retryCount + 1}), will retry:`, error.message);
                    return fetchGameWithRetry(retryCount + 1, maxRetries);
                  }
                  
                  // Last attempt: try getGames fallback
                  console.warn(`⚠️ [${processingId}] getGameState failed, trying getGames fallback...`);
                  try {
                    const games = await getGames(gameType);
                    const newGame = games.find((g) => g.id === gameId);
                    if (newGame) {
                      console.log(`✅ [${processingId}] Found new game via getGames fallback`);
                      return newGame;
                    }
                  } catch (fallbackError) {
                    console.error(`❌ [${processingId}] getGames fallback also failed:`, fallbackError);
                  }
                  
                  // If still failing and we have retries left, retry
                  if (retryCount < maxRetries) {
                    return fetchGameWithRetry(retryCount + 1, maxRetries);
                  }
                  
                  throw error;
                }
                
                return null;
              };
              
              // Fetch the new game details using getGameState, with fallback to getGames
              const addNewGame = (newGame: Game) => {
                // Double-check we haven't already processed this before calling updateGames
                if (processedGamesRef.current.has(gameId) && gamesRef.current.some((g) => g.id === gameId)) {
                  console.log(`⚠️ [${processingId}] Game ${gameId} was already added while fetching, skipping duplicate add`);
                  fetchingGamesRef.current.delete(gameId);
                  return;
                }
                
                // Check if we're already adding this game (prevents React double-invocation)
                if (addingGamesRef.current.has(gameId)) {
                  console.log(`⚠️ [${processingId}] Game ${gameId} is already being added, skipping duplicate`);
                  fetchingGamesRef.current.delete(gameId);
                  return;
                }
                
                // Mark as adding before calling updateGames
                addingGamesRef.current.add(gameId);
                
                updateGames((prevGames) => {
                  // Check both prevGames and gamesRef to catch duplicates from React double-invocation
                  const existsInPrev = prevGames.some((g) => g.id === newGame.id);
                  const existsInRef = gamesRef.current.some((g) => g.id === newGame.id);
                  
                  if (existsInPrev || existsInRef) {
                    // Game already exists - this might be a React double-invocation
                    console.log(`🔄 [${processingId}] Game ${newGame.id} already exists in state (prev=${existsInPrev}, ref=${existsInRef}), updating instead of adding`);
                    const updated = prevGames.map((g) => (g.id === newGame.id ? newGame : g));
                    gamesRef.current = updated;
                    addingGamesRef.current.delete(gameId);
                    return updated;
                  }
                  
                  // Game doesn't exist, add it
                  console.log(`✅ [${processingId}] Adding new game for ${gameType}:`, newGame.id, 'State:', newGame.state);
                  // Remove any old game of this type, then add the new one
                  const withoutOldType = prevGames.filter((g) => g.game_type !== gameType);
                  // Update the ref immediately to prevent race conditions
                  const updated = [...withoutOldType, newGame];
                  gamesRef.current = updated;
                  addingGamesRef.current.delete(gameId);
                  
                  // CRITICAL: Reconnect WebSocket to subscribe to the new game's Redis channel
                  // The old WebSocket is subscribed to the old game's channel, so it won't receive
                  // events for the new game. Reconnecting will make the backend find the new game
                  // and subscribe to its channel.
                  console.log(`🔄 [${processingId}] Reconnecting WebSocket for ${gameType} to subscribe to new game's channel...`);
                  setTimeout(() => {
                    const newWs = createOrReconnectWebSocket(gameType, true);
                    if (newWs) {
                      // Get or create the message handler
                      let handler = handlersRef.current.get(gameType);
                      if (!handler) {
                        // Create new handler if it doesn't exist
                        handler = (event: MessageEvent) => {
                          handleMessage(gameType, event);
                        };
                        handlersRef.current.set(gameType, handler);
                      }
                      
                      // Attach handler based on WebSocket state
                      const attachHandler = () => {
                        // Remove any existing handler first
                        newWs.removeEventListener('message', handler!);
                        // Add the handler
                        newWs.addEventListener('message', handler!);
                        console.log(`📌 [${processingId}] Re-attached handler to reconnected WebSocket for ${gameType}`);
                      };
                      
                      if (newWs.readyState === WebSocket.OPEN) {
                        attachHandler();
                      } else if (newWs.readyState === WebSocket.CONNECTING) {
                        newWs.addEventListener('open', () => {
                          attachHandler();
                        }, { once: true });
                      } else {
                        attachHandler();
                      }
                    }
                  }, 500); // Small delay to ensure backend has created the new game
                  
                  return updated;
                });
              };
              
              // Fetch with retry logic (handles timing issue where game might not be in DB yet)
              // Add initial delay to give backend time to commit the game to database
              setTimeout(() => {
                fetchGameWithRetry()
                  .then((newGame) => {
                    if (newGame) {
                      addNewGame(newGame);
                    } else {
                      console.error(`❌ [${processingId}] Could not fetch new game ${gameId} after all retries`);
                      // Remove from processed set so we can retry later
                      processedGamesRef.current.delete(gameId);
                      fetchingGamesRef.current.delete(gameId);
                      wsGameIdMap.delete(gameType);
                    }
                  })
                  .catch((error) => {
                    console.error(`❌ [${processingId}] Failed to fetch new game ${gameId} after all retries:`, error);
                    // Remove from processed set on error, so we can retry
                    processedGamesRef.current.delete(gameId);
                    fetchingGamesRef.current.delete(gameId);
                    wsGameIdMap.delete(gameType);
                  })
                  .finally(() => {
                    // Always remove from fetching set when done
                    fetchingGamesRef.current.delete(gameId);
                  });
              }, 1500); // Initial 1.5s delay to ensure backend has committed the game to DB
            }
            break;

          default:
            break;
        }
      } catch (error) {
        console.error(`Error parsing WebSocket message for ${gameType}:`, error);
      }
    };

    // Create or reuse WebSocket connections
    // Force reconnect to ensure fresh subscriptions when component mounts/remounts
    gameTypes.forEach((gameType) => {
      // Force reconnect to ensure we're subscribed to the current game's channel
      const ws = createOrReconnectWebSocket(gameType, true);
      if (!ws) return;

      // Add message handler for this component instance
      // Remove existing handler first to avoid duplicates (check all states)
      const existingHandler = handlersRef.current.get(gameType);
      if (existingHandler && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
        ws.removeEventListener('message', existingHandler);
        console.log(`🧹 Removed existing handler for ${gameType}`);
      }
      
      const messageHandler = (event: MessageEvent) => {
        handleMessage(gameType, event);
      };
      
      // Attach handler based on WebSocket state
      const attachHandler = () => {
        // Remove any existing handler first
        ws.removeEventListener('message', messageHandler);
        // Add the handler
        ws.addEventListener('message', messageHandler);
        handlersRef.current.set(gameType, messageHandler);
        console.log(`📌 Attached handler for ${gameType}, readyState: ${ws.readyState === WebSocket.OPEN ? 'OPEN' : ws.readyState === WebSocket.CONNECTING ? 'CONNECTING' : 'CLOSED'}`);
      };
      
      if (ws.readyState === WebSocket.OPEN) {
        // Already open, attach immediately
        attachHandler();
      } else if (ws.readyState === WebSocket.CONNECTING) {
        // Wait for connection to open, then attach handler
        ws.addEventListener('open', () => {
          attachHandler();
        }, { once: true });
      } else {
        // If closed, attach anyway (will work when it opens)
        attachHandler();
      }
      
      // Log connection state
      console.log(`🔌 WebSocket for ${gameType} readyState:`, ws.readyState === WebSocket.OPEN ? 'OPEN' : ws.readyState === WebSocket.CONNECTING ? 'CONNECTING' : 'CLOSED');
    });

    // Cleanup: remove message handlers when component unmounts (but keep WebSockets open)
    return () => {
      handlersRef.current.forEach((handler, gameType) => {
        const ws = globalSockets.get(gameType);
        if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
          ws.removeEventListener('message', handler);
        }
      });
      handlersRef.current.clear();
    };
  }, []);

  // Cleanup WebSockets only when page is unloading
  useEffect(() => {
    const handleBeforeUnload = () => {
      globalSockets.forEach((ws, gameType) => {
        if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
          ws.close();
        }
      });
      globalSockets.clear();
      wsGameIdMap.clear();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  // Ensure state is COUNTDOWN if countdown_ends is set (like GamePlay does)
  useEffect(() => {
    setGames((prev) => {
      const newGames = prev.map((game) => {
        if (game.state === 'WAITING' && game.countdown_ends) {
          console.log(`🔄 Auto-updating state: WAITING -> COUNTDOWN (countdown_ends detected) for ${game.game_type}`);
          return { ...game, state: 'COUNTDOWN' as Game['state'] };
        }
        return game;
      });
      // Only update if something changed
      const changed = newGames.some((game, idx) => game.state !== prev[idx].state);
      return changed ? newGames : prev;
    });
  }, [games.map((g) => `${g.id}-${g.state}-${g.countdown_ends}`).join('|')]);

  // Update countdown timer - initial calculation when entering COUNTDOWN state
  // WebSocket COUNTDOWN events will update it every second (like GamePlay does)
  useEffect(() => {
    games.forEach((game) => {
      // Clear countdown if state is not COUNTDOWN
      if (game.state !== 'COUNTDOWN') {
        setCountdowns((prevCountdowns) => {
          const newCountdowns = { ...prevCountdowns };
          delete newCountdowns[game.id];
          return newCountdowns;
        });
        return;
      }

      if (!game.countdown_ends) {
        return;
      }

      // Calculate initial countdown when entering COUNTDOWN state
      // WebSocket will send COUNTDOWN events to keep it updated
      const now = new Date().getTime();
      const ends = new Date(game.countdown_ends).getTime();
      const seconds = Math.max(0, Math.floor((ends - now) / 1000));
      
      // Set initial countdown only if > 0, otherwise clear it
      if (seconds > 0) {
        setCountdowns((prevCountdowns) => ({
          ...prevCountdowns,
          [game.id]: seconds,
        }));
      } else {
        setCountdowns((prevCountdowns) => {
          const newCountdowns = { ...prevCountdowns };
          delete newCountdowns[game.id];
          return newCountdowns;
        });
      }
    });
  }, [games]);

  const getStatusLabel = (state: Game['state'], countdown: number | null = null) => {
    switch (state) {
      case 'WAITING':
      case 'COUNTDOWN':
      case 'FINISHED':
      case 'CLOSED':
      case 'CANCELLED':
        if (state === 'COUNTDOWN' && countdown !== null) {
          return `ክፍት (${countdown})`;
        }
        return 'ክፍት';
      case 'DRAWING':
        return 'በመጫወት ላይ';
      default:
        return 'ክፍት';
    }
  };

  const getStatusColor = (state: Game['state']) => {
    switch (state) {
      case 'WAITING':
        return 'bg-green-500';
      case 'COUNTDOWN':
        return 'bg-yellow-500';
      case 'DRAWING':
        return 'bg-red-500';
      case 'FINISHED':
      case 'CLOSED':
      case 'CANCELLED':
        return 'bg-green-500';
      default:
        return 'bg-green-500';
    }
  };

  const handleGameClick = async (game: Game | undefined, betAmount: number, gameType: string) => {
    // Check balance first
    if (wallet.balance < betAmount) {
      alert('Insufficient balance');
      return;
    }

    // If game already exists, use it
    if (game && (game.state === 'WAITING' || game.state === 'COUNTDOWN')) {
      setCurrentGameId(game.id);
      setSelectedGameType(betAmount);
      setSelectedGameTypeString(gameType); // Store game type string for WebSocket
      setCurrentView('cards');
      return;
    }

    // Otherwise, fetch games with type filter - this will auto-create a game if none exists
    try {
      const gamesWithType = await getGames(gameType);
      const foundGame = gamesWithType.find(
        (g) => g.game_type === gameType && (g.state === 'WAITING' || g.state === 'COUNTDOWN')
      );
      
      if (foundGame) {
        setCurrentGameId(foundGame.id);
        setSelectedGameType(betAmount);
        setSelectedGameTypeString(gameType); // Store game type string for WebSocket
        setCurrentView('cards');
        // Update the games list to include the newly created game
        setGames((prev) => {
          const exists = prev.some((g) => g.id === foundGame.id);
          if (!exists) {
            return [...prev, foundGame];
          }
          return prev.map((g) => (g.id === foundGame.id ? foundGame : g));
        });
      } else {
        alert('Unable to create or find a game. Please try again.');
      }
    } catch (error) {
      console.error('Error finding/creating game:', error);
      alert('Unable to create or find a game. Please try again.');
    }
  };

  return (
    <main className="min-h-screen bg-[#0a1929] text-white">
      <Header user={user} wallet={wallet} />

      {/* Game Selection List */}
      <div className="p-2 sm:p-4 space-y-2 sm:space-y-3">
        {GAME_TYPES.map((gameType) => {
          // Find game for this type (show all states)
          const game = games.find(
            (g) => g.game_type === gameType.type
          );

          const betAmount = gameType.bet;
          const playerCount = game?.player_count || 0;
          const potentialWin = game ? calculatePotentialWin(game) : 0;
          const state = game?.state || 'WAITING';
          // Calculate countdown: use stored value or calculate from countdown_ends
          let countdown: number | null = null;
          if (game && state === 'COUNTDOWN') {
            countdown = countdowns[game.id] ?? (game.countdown_ends ? getCountdownSeconds(game.countdown_ends) : null);
          }
          const canJoin = wallet.balance >= betAmount;

          return (
            <div
              key={gameType.type}
              className="bg-[#1e3a5f] rounded-lg p-2 sm:p-5 flex flex-row items-center justify-between gap-3 sm:gap-5 flex-nowrap"
            >
              {/* Left Side - Game Info */}
              <div className="flex-1 min-w-0">
                {/* Bet Amount and Status */}
                <div className="flex items-center gap-2 sm:gap-3 mb-1.5 sm:mb-2 flex-wrap">
                  <span className="text-xl sm:text-2xl font-bold text-white">{betAmount} ብር</span>
                  <span className={`${getStatusColor(state)} text-white text-sm sm:text-base px-2 sm:px-2.5 py-0.5 sm:py-1 rounded font-bold`}>
                    {getStatusLabel(state, countdown)}
                  </span>
                </div>

                {/* Player Count and Potential Win */}
                <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
                  <div className="flex items-center gap-1 sm:gap-1.5">
                    <svg className="w-4 h-4 sm:w-4 sm:h-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
                    </svg>
                    <span className="text-base sm:text-lg text-gray-300 font-bold">{playerCount > 0 ? playerCount : '-'} players</span>
                  </div>
                  <div className="bg-yellow-500/20 text-yellow-400 text-sm sm:text-base px-2 sm:px-2.5 py-0.5 sm:py-1 rounded font-bold">
                    {potentialWin > 0 ? `${potentialWin.toFixed(2)} ብር ደራሽ` : '- ብር ደራሽ'}
                  </div>
                </div>
              </div>

              {/* Right Side - Join Button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleGameClick(game, betAmount, gameType.type);
                }}
                disabled={!canJoin}
                className={`px-4 sm:px-6 py-2 sm:py-3 rounded-lg font-bold text-lg sm:text-xl flex items-center justify-center gap-2 transition-all flex-shrink-0 whitespace-nowrap ${
                  canJoin
                    ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white hover:from-orange-600 hover:to-red-600 cursor-pointer'
                    : 'bg-gray-600 text-gray-400 cursor-not-allowed opacity-50'
                }`}
              >
                <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M8 9a3 3 0 100-6 3 3 0 000 6zM8 11a6 6 0 016 6H2a6 6 0 016-6zM16 7a1 1 0 10-2 0v1h-1a1 1 0 100 2h1v1a1 1 0 102 0v-1h1a1 1 0 100-2h-1V7z" />
                </svg>
                <span>ይግቡ</span>
              </button>
            </div>
          );
        })}
      </div>
    </main>
  );
}

