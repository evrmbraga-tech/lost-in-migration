
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Direction, GameStatus, FlockState, RankingEntry } from './types';
import { GAME_DURATION } from './constants';
import Flock from './components/Flock';
import { getGameSummary } from './services/geminiService';
import { supabase, getGlobalLeaderboard, saveRanking, checkConnection } from './services/supabaseClient';

const DIRECTIONS = [Direction.UP, Direction.DOWN, Direction.LEFT, Direction.RIGHT];
const LEADERBOARD_KEY = 'migration_mind_leaderboard';
const SETTINGS_KEY = 'migration_mind_settings';

const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();

const playSound = (type: 'success' | 'failure') => {
  if (audioContext.state === 'suspended') audioContext.resume();
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();
  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);

  if (type === 'success') {
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(880, audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(1320, audioContext.currentTime + 0.1);
    gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.1);
  } else {
    oscillator.type = 'sawtooth';
    oscillator.frequency.setValueAtTime(150, audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(40, audioContext.currentTime + 0.2);
    gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.2);
  }
};

const App: React.FC = () => {
  const [status, setStatus] = useState<GameStatus>('IDLE');
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [maxStreak, setMaxStreak] = useState(0);
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION);
  const [flock, setFlock] = useState<FlockState>({ center: Direction.UP, others: Direction.UP });
  const [stats, setStats] = useState({ correct: 0, total: 0 });
  const [aiMessage, setAiMessage] = useState<string>('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [leaderboard, setLeaderboard] = useState<RankingEntry[]>([]);
  const [currentEntryId, setCurrentEntryId] = useState<string | null>(null);
  const [autoRestartOnWrong, setAutoRestartOnWrong] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isConnected, setIsConnected] = useState<boolean | null>(null);

  const correctRef = useRef<Direction>(Direction.UP);
  const statusRef = useRef<GameStatus>('IDLE');
  const scoreRef = useRef(0);
  const statsRef = useRef({ correct: 0, total: 0 });
  const maxStreakRef = useRef(0);
  const autoRestartRef = useRef(false);

  useEffect(() => { scoreRef.current = score; }, [score]);
  useEffect(() => { statsRef.current = stats; }, [stats]);
  useEffect(() => { maxStreakRef.current = maxStreak; }, [maxStreak]);
  useEffect(() => { autoRestartRef.current = autoRestartOnWrong; }, [autoRestartOnWrong]);

  const fetchLeaderboard = useCallback(async () => {
    setIsSyncing(true);
    const globalData = await getGlobalLeaderboard();
    if (globalData) {
      setIsConnected(true);
      const formatted = globalData.map(d => ({
        id: d.id,
        score: d.score,
        correct: d.correct,
        accuracy: d.accuracy,
        maxStreak: d.max_streak,
        timestamp: d.timestamp ? new Date(d.timestamp).getTime() : Date.now()
      }));
      setLeaderboard(formatted);
      localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(formatted));
    } else {
      setIsConnected(false);
      const raw = localStorage.getItem(LEADERBOARD_KEY);
      if (raw) setLeaderboard(JSON.parse(raw));
    }
    setIsSyncing(false);
  }, []);

  const generateNewFlock = useCallback(() => {
    const center = DIRECTIONS[Math.floor(Math.random() * DIRECTIONS.length)];
    const match = Math.random() > 0.5;
    let others = center;
    if (!match) {
      const remaining = DIRECTIONS.filter(d => d !== center);
      others = remaining[Math.floor(Math.random() * remaining.length)];
    }
    correctRef.current = center;
    setFlock({ center, others });
  }, []);

  const endGame = useCallback(async () => {
    setStatus('GAMEOVER');
    statusRef.current = 'GAMEOVER';
    
    const finalScore = scoreRef.current;
    const finalStats = statsRef.current;
    const finalMaxStreak = maxStreakRef.current;
    const accuracy = finalStats.total > 0 ? finalStats.correct / finalStats.total : 0;

    setIsSyncing(true);
    const result = await saveRanking({
      score: finalScore,
      correct: finalStats.correct,
      accuracy,
      max_streak: finalMaxStreak
    });

    if (result) {
      setCurrentEntryId(result.id);
      await fetchLeaderboard();
    } else {
      console.warn("Saving to Supabase failed. Saving locally instead.");
      const newEntryId = crypto.randomUUID();
      setCurrentEntryId(newEntryId);
      const localEntry = {
        id: newEntryId,
        score: finalScore,
        correct: finalStats.correct,
        accuracy,
        maxStreak: finalMaxStreak,
        timestamp: Date.now()
      };
      const raw = localStorage.getItem(LEADERBOARD_KEY);
      let entries: RankingEntry[] = raw ? JSON.parse(raw) : [];
      entries.push(localEntry);
      entries.sort((a, b) => b.score - a.score || b.accuracy - a.accuracy);
      const top5 = entries.slice(0, 5);
      localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(top5));
      setLeaderboard(top5);
    }

    setIsAiLoading(true);
    const summary = await getGameSummary(finalScore, accuracy, finalMaxStreak);
    setAiMessage(summary);
    setIsAiLoading(false);
    setIsSyncing(false);
  }, [fetchLeaderboard]);

  const startGame = useCallback(() => {
    if (audioContext.state === 'suspended') audioContext.resume();
    setScore(0);
    setStreak(0);
    setMaxStreak(0);
    setTimeLeft(GAME_DURATION);
    setStats({ correct: 0, total: 0 });
    setStatus('PLAYING');
    statusRef.current = 'PLAYING';
    setAiMessage('');
    setCurrentEntryId(null);
    generateNewFlock();
  }, [generateNewFlock]);

  const handleInput = useCallback((key: string) => {
    if (statusRef.current !== 'PLAYING') return;

    if (DIRECTIONS.includes(key as Direction)) {
      const isCorrect = key === correctRef.current;
      
      setStats(prev => ({ 
        correct: prev.correct + (isCorrect ? 1 : 0),
        total: prev.total + 1 
      }));

      if (isCorrect) {
        playSound('success');
        setScore(s => s + 100 + (streak * 10));
        setStreak(s => {
          const next = s + 1;
          if (next > maxStreak) setMaxStreak(next);
          return next;
        });
        generateNewFlock();
      } else {
        playSound('failure');
        setStreak(0);
        if (autoRestartRef.current) {
          startGame();
        } else {
          generateNewFlock();
        }
      }
    }
  }, [generateNewFlock, streak, maxStreak, startGame]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key.startsWith('Arrow')) {
        e.preventDefault();
        handleInput(e.key);
      } else if (e.key.toLowerCase() === 'r') {
        startGame();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleInput, startGame]);

  useEffect(() => {
    let timerId: number;
    if (status === 'PLAYING') {
      timerId = window.setInterval(() => {
        setTimeLeft(t => {
          if (t <= 1) return 0;
          return t - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timerId);
  }, [status]);

  useEffect(() => {
    if (timeLeft === 0 && status === 'PLAYING') {
      endGame();
    }
  }, [timeLeft, status, endGame]);

  useEffect(() => {
    const init = async () => {
      const ok = await checkConnection();
      setIsConnected(ok);
      fetchLeaderboard();
    };
    init();

    const rawSettings = localStorage.getItem(SETTINGS_KEY);
    if (rawSettings) {
      const settings = JSON.parse(rawSettings);
      setAutoRestartOnWrong(!!settings.autoRestart);
    }
  }, [fetchLeaderboard]);

  const toggleAutoRestart = () => {
    const newValue = !autoRestartOnWrong;
    setAutoRestartOnWrong(newValue);
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ autoRestart: newValue }));
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-slate-900 text-white">
      {/* Header Info */}
      <div className="w-full max-w-3xl flex justify-between items-center mb-6 px-4">
        <div className="flex flex-col items-start min-w-[80px]">
          <span className="text-slate-400 text-[10px] uppercase tracking-widest font-bold">Score</span>
          <span className="text-xl font-extrabold text-white">{score.toLocaleString()}</span>
        </div>
        <div className="flex flex-col items-center min-w-[80px]">
          <span className="text-slate-400 text-[10px] uppercase tracking-widest font-bold">Correct</span>
          <span className="text-xl font-extrabold text-cyan-400">{stats.correct}</span>
        </div>
        <div className="flex flex-col items-center min-w-[80px]">
          <span className="text-slate-400 text-[10px] uppercase tracking-widest font-bold">Time Left</span>
          <span className={`text-2xl font-extrabold tabular-nums ${timeLeft <= 5 ? 'text-red-500 animate-pulse' : 'text-white'}`}>
            {timeLeft}s
          </span>
        </div>
        <div className="flex flex-col items-end min-w-[80px]">
          <span className="text-slate-400 text-[10px] uppercase tracking-widest font-bold">Streak</span>
          <span className="text-xl font-extrabold text-orange-400">×{streak}</span>
        </div>
      </div>

      {/* Main Game Area */}
      <div className="relative bg-slate-800/50 rounded-3xl w-full max-w-2xl flex items-center justify-center border border-slate-700 shadow-2xl backdrop-blur-sm overflow-hidden min-h-[360px]">
        {status === 'IDLE' && (
          <div className="text-center p-8">
            <h1 className="text-5xl font-black mb-4 bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
              MIGRATION MIND
            </h1>
            <p className="text-slate-300 text-lg mb-8 max-w-md mx-auto">
              Focus on the <span className="text-cyan-400 font-bold">central arrow</span>. 
              Ignore decoys. Use your arrow keys.
            </p>
            <button 
              onClick={startGame}
              className="px-10 py-4 bg-cyan-500 hover:bg-cyan-400 text-slate-900 font-bold text-xl rounded-full transition-all transform hover:scale-105 active:scale-95 shadow-lg shadow-cyan-500/20"
            >
              Start Mission
            </button>
          </div>
        )}

        {status === 'PLAYING' && (
          <div className="transform scale-[2]">
             <Flock center={flock.center} others={flock.others} />
          </div>
        )}

        {status === 'GAMEOVER' && (
          <div className="text-center p-6 w-full flex flex-col items-center h-full max-h-[100%] overflow-y-auto">
            <h2 className="text-3xl font-black mb-2 text-white">MISSION COMPLETE</h2>
            <div className="mb-4 min-h-[3rem] px-6 max-w-md">
              {isAiLoading ? (
                <div className="flex items-center justify-center space-x-2">
                  <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-bounce"></div>
                  <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-bounce [animation-delay:0.2s]"></div>
                  <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-bounce [animation-delay:0.4s]"></div>
                </div>
              ) : (
                <p className="text-cyan-300 italic text-sm leading-relaxed font-semibold">
                  "{aiMessage}"
                </p>
              )}
            </div>

            {/* Rankings Table */}
            <div className="w-full max-w-lg bg-slate-900/50 rounded-2xl border border-slate-700 overflow-hidden mb-4">
              <div className="bg-slate-700/30 px-4 py-2 border-b border-slate-700 flex justify-between items-center">
                <div className="flex items-center space-x-2">
                  <h3 className="text-xs uppercase font-black text-slate-400 tracking-widest">Global Leaderboard</h3>
                  <div className={`flex items-center space-x-1.5 px-2 py-0.5 rounded-full text-[8px] font-black ${isConnected ? 'bg-green-500/20 text-green-400' : 'bg-amber-500/20 text-amber-400'}`}>
                    <span className={`w-1 h-1 rounded-full ${isConnected ? 'bg-green-400 animate-pulse' : 'bg-amber-400'}`}></span>
                    <span>{isConnected ? 'LIVE' : 'OFFLINE'}</span>
                  </div>
                </div>
              </div>
              <table className="w-full text-xs text-left">
                <thead className="text-slate-500 border-b border-slate-800 bg-slate-900/40">
                  <tr>
                    <th className="px-4 py-2 font-medium">Rank</th>
                    <th className="px-4 py-2 font-medium">Score</th>
                    <th className="px-4 py-2 font-medium text-center">Correct</th>
                    <th className="px-4 py-2 font-medium text-center">Accuracy</th>
                    <th className="px-4 py-2 font-medium text-center">Streak</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {leaderboard.length > 0 ? leaderboard.map((entry, idx) => (
                    <tr key={entry.id} className={`transition-colors ${entry.id === currentEntryId ? 'bg-cyan-500/20 text-cyan-300 font-bold' : 'text-slate-300 hover:bg-slate-800/30'}`}>
                      <td className="px-4 py-2 font-bold">{idx + 1}</td>
                      <td className="px-4 py-2 font-black">{entry.score.toLocaleString()}</td>
                      <td className="px-4 py-2 text-center">{entry.correct}</td>
                      <td className="px-4 py-2 text-center">{Math.round(entry.accuracy * 100)}%</td>
                      <td className="px-4 py-2 text-center">×{entry.maxStreak}</td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-slate-500 italic">No rankings found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <button onClick={startGame} className="px-8 py-3 bg-cyan-500 hover:bg-cyan-400 text-slate-900 font-bold rounded-full transition-all shadow-lg shadow-cyan-500/10">
              Restart Mission
            </button>
          </div>
        )}
      </div>

      {/* Settings and Controls */}
      <div className="mt-8 w-full max-w-2xl flex flex-col sm:flex-row items-center justify-between gap-6 px-4">
        <div className="flex items-center space-x-6 text-slate-500">
          <div className="flex items-center space-x-2">
            <div className="flex space-x-1">
              {['↑', '←', '↓', '→'].map(key => (
                <kbd key={key} className="px-3 py-1 bg-slate-800 border border-slate-700 rounded-md text-slate-400 font-mono text-xs shadow-sm">{key}</kbd>
              ))}
            </div>
            <span className="text-xs font-semibold uppercase tracking-tighter">Respond</span>
          </div>
          <div className="flex items-center space-x-2">
            <kbd className="px-3 py-1 bg-slate-800 border border-slate-700 rounded-md text-slate-400 font-mono text-xs shadow-sm">R</kbd>
            <span className="text-xs font-semibold uppercase tracking-tighter">Reset</span>
          </div>
        </div>

        <div className="flex items-center space-x-3 bg-slate-800/30 px-4 py-2 rounded-full border border-slate-700/50">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-tighter">Auto-restart</span>
          <button 
            onClick={toggleAutoRestart}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${autoRestartOnWrong ? 'bg-cyan-500' : 'bg-slate-700'}`}
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${autoRestartOnWrong ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default App;
