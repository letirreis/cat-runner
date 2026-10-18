import React, { useEffect, useRef, useState } from 'react';
import { GameCanvas } from './components/GameCanvas';
import { TopBar } from './components/TopBar';
import { StreakModal } from './components/StreakModal';
import { ShopModal } from './components/ShopModal';
import { StageSelectModal } from './components/StageSelectModal';
import { GameOverModal } from './components/GameOverModal';
import { AdModal, AdType } from './components/AdModal';
import { GameEngine } from './game/GameEngine';
import { STAGES } from './game/stages';
import { CosmeticItem, GameStats, PlayerCustomization, StageId, StreakData } from './types/game';
import { audio } from './utils/audio';
import {
  loadCustomization,
  loadGameStats,
  loadStreakData,
  recordPlayToday,
  saveCustomization,
  saveGameStats,
  saveStreakData,
} from './utils/storage';
import { Flame, Sparkles, Smartphone, Monitor } from 'lucide-react';

export default function App() {
  // Loaded persistence states
  const [stats, setStats] = useState<GameStats>(() => loadGameStats());
  const [customization, setCustomization] = useState<PlayerCustomization>(() => loadCustomization());
  const [streakData, setStreakData] = useState<StreakData>(() => loadStreakData());

  // Game gameplay states
  const [currentStageId, setCurrentStageId] = useState<StageId>('living_room');
  const [lives, setLives] = useState(7);
  const [score, setScore] = useState(0);
  const [coinsEarnedThisRun, setCoinsEarnedThisRun] = useState(0);
  const [currentDistance, setCurrentDistance] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isMobileFrameView, setIsMobileFrameView] = useState(true);

  // Modals
  const [isStreakOpen, setIsStreakOpen] = useState(false);
  const [isShopOpen, setIsShopOpen] = useState(false);
  const [isStageSelectOpen, setIsStageSelectOpen] = useState(false);
  const [isGameOverOpen, setIsGameOverOpen] = useState(false);
  const [gameOverIsVictory, setGameOverIsVictory] = useState(false);
  const [isAdOpen, setIsAdOpen] = useState(false);
  const [currentAdType, setCurrentAdType] = useState<AdType>('interstitial');
  const [pendingRevive, setPendingRevive] = useState(false);
  const [roundsCount, setRoundsCount] = useState(0);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const engineRef = useRef<GameEngine | null>(null);

  const stageConfig = STAGES[currentStageId] || STAGES.living_room;

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Sound mute sync
  const handleToggleMute = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    audio.setMuted(nextMuted);
  };

  // Pause toggle
  const handleTogglePause = () => {
    setIsPaused((prev) => !prev);
  };

  // Stage selection
  const handleSelectStage = (stageId: StageId) => {
    if (engineRef.current && stageId === currentStageId) {
      engineRef.current.stop();
      engineRef.current.reset(7);
      engineRef.current.start();
    }
    setCurrentStageId(stageId);
    setLives(7);
    setScore(0);
    setCoinsEarnedThisRun(0);
    setCurrentDistance(0);
    setIsGameOverOpen(false);
    setIsPaused(false);
  };

  // Next stage after victory
  const handleNextStage = () => {
    setIsGameOverOpen(false);
    const order: StageId[] = [
      'living_room',
      'kitchen',
      'bathroom',
      'hallway',
      'bedroom',
      'attic',
      'garden',
      'mansion',
    ];
    if (streakData.treatRushUnlocked) {
      order.push('treat_rush');
    }
    const idx = order.indexOf(currentStageId);
    const next = idx !== -1 && idx + 1 < order.length ? order[idx + 1] : order[0];
    handleSelectStage(next);
  };

  // Game over triggered by engine (lives hit 0)
  const handleGameOver = (finalScore: number, coinsEarned: number) => {
    setGameOverIsVictory(false);
    setIsGameOverOpen(true);

    const nextRounds = roundsCount + 1;
    setRoundsCount(nextRounds);

    // Update overall stats
    const updatedStats: GameStats = {
      ...stats,
      totalRuns: stats.totalRuns + 1,
      highScore: Math.max(stats.highScore, finalScore),
      fishCoins: stats.fishCoins + coinsEarned,
    };
    setStats(updatedStats);
    saveGameStats(updatedStats);

    // Check interstitial ad condition: every 10 rounds if ads not removed
    if (!stats.adsRemoved && nextRounds % 10 === 0) {
      setTimeout(() => {
        setCurrentAdType('interstitial');
        setIsAdOpen(true);
      }, 600);
    }
  };

  // Stage completed (reached goal feast bowl)
  const handleStageComplete = (finalScore: number, coinsEarned: number, livesLeft: number) => {
    setGameOverIsVictory(true);
    setIsGameOverOpen(true);

    // Record daily streak check-in
    const { updated: newStreak, streakIncreased, justUnlockedTreatRush } = recordPlayToday(streakData);
    setStreakData(newStreak);

    if (justUnlockedTreatRush) {
      showToast('🎉 Parabéns! Você completou o 7º Dia e desbloqueou a fase TREAT RUSH!');
    } else if (streakIncreased) {
      showToast(`🔥 Sequência diária atualizada: Dia ${newStreak.currentStreak}!`);
    }

    const nextRounds = roundsCount + 1;
    setRoundsCount(nextRounds);

    const updatedStats: GameStats = {
      ...stats,
      totalRuns: stats.totalRuns + 1,
      highScore: Math.max(stats.highScore, finalScore),
      fishCoins: stats.fishCoins + coinsEarned,
      totalTreatsCollected: stats.totalTreatsCollected + 1,
    };
    setStats(updatedStats);
    saveGameStats(updatedStats);

    // Check interstitial ad every 10 rounds
    if (!stats.adsRemoved && nextRounds % 10 === 0) {
      setTimeout(() => {
        setCurrentAdType('interstitial');
        setIsAdOpen(true);
      }, 600);
    }
  };

  // Rewarded Ad Revive
  const handleReviveWithAd = () => {
    setPendingRevive(true);
    setCurrentAdType('rewarded_revive');
    setIsAdOpen(true);
  };

  // Rewarded Ad for Coins
  const handleWatchRewardedAdForCoins = () => {
    setCurrentAdType('rewarded_coins');
    setIsAdOpen(true);
  };

  // Rewarded Ad for Streak repair
  const handleWatchAdToRepairStreak = () => {
    setCurrentAdType('rewarded_streak');
    setIsAdOpen(true);
  };

  // Ad completed callback
  const handleAdCompleted = () => {
    if (currentAdType === 'rewarded_revive') {
      setIsGameOverOpen(false);
      setPendingRevive(false);
      if (engineRef.current) {
        engineRef.current.revive(3);
      }
      showToast('❤️ Revivido com +3 vidas extras!');
    } else if (currentAdType === 'rewarded_coins') {
      const updatedStats = {
        ...stats,
        fishCoins: stats.fishCoins + 250,
      };
      setStats(updatedStats);
      saveGameStats(updatedStats);
      showToast('🐟 +250 Peixinhos adicionados!');
    } else if (currentAdType === 'rewarded_streak') {
      const updatedStreak: StreakData = {
        ...streakData,
        currentStreak: Math.max(1, streakData.currentStreak + 1),
        lastPlayedDate: new Date().toISOString().split('T')[0],
      };
      setStreakData(updatedStreak);
      saveStreakData(updatedStreak);
      showToast('🔥 Sequência reparada com sucesso!');
    }
  };

  // Restart current stage
  const handleRestart = () => {
    setIsGameOverOpen(false);
    setLives(7);
    setScore(0);
    setCoinsEarnedThisRun(0);
    setCurrentDistance(0);
    if (engineRef.current) {
      engineRef.current.stop();
      engineRef.current.reset(7);
      engineRef.current.start();
    }
  };

  // Buy cosmetic item
  const handleBuyCosmetic = (item: CosmeticItem) => {
    if (stats.fishCoins < item.price) {
      showToast('🐟 Peixinhos insuficientes! Jogue mais ou assista a um anúncio premiado.');
      return;
    }

    const updatedStats: GameStats = {
      ...stats,
      fishCoins: stats.fishCoins - item.price,
      unlockedCosmetics: [...stats.unlockedCosmetics, item.id],
    };
    setStats(updatedStats);
    saveGameStats(updatedStats);

    // Equip newly bought item
    const updatedCustom = { ...customization };
    if (item.category === 'coat') updatedCustom.coat = item.id as any;
    if (item.category === 'hat') updatedCustom.hat = item.id as any;
    if (item.category === 'collar') updatedCustom.collar = item.id as any;
    setCustomization(updatedCustom);
    saveCustomization(updatedCustom);

    showToast(`✨ ${item.name} desbloqueado e equipado!`);
  };

  // Equip already unlocked item
  const handleEquipCosmetic = (c: PlayerCustomization) => {
    setCustomization(c);
    saveCustomization(c);
  };

  // In-app purchase: Remove Ads
  const handleRemoveAdsPurchase = () => {
    const updatedStats: GameStats = {
      ...stats,
      adsRemoved: true,
      fishCoins: stats.fishCoins + 500, // VIP bonus
    };
    setStats(updatedStats);
    saveGameStats(updatedStats);
    showToast('🎉 Anúncios removidos com sucesso! Você ganhou +500 Peixinhos VIP!');
  };

  return (
    <div className="min-h-screen bg-stone-950 flex flex-col items-center justify-center p-2 sm:p-4 text-stone-100 font-sans selection:bg-amber-500 selection:text-stone-900">
      {/* Toast feedback */}
      {toastMessage && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-amber-500 text-stone-950 px-4 py-2 rounded-xl shadow-xl font-display font-bold text-xs sm:text-sm animate-bounce border-2 border-amber-300">
          {toastMessage}
        </div>
      )}

      {/* Main Container / Responsive Mobile Device Frame */}
      <main
        className={`w-full transition-all duration-300 flex flex-col bg-stone-950 shadow-2xl overflow-hidden ${
          isMobileFrameView
            ? 'max-w-[420px] h-[92vh] max-h-[850px] min-h-[580px] rounded-[38px] border-[8px] border-stone-800 ring-1 ring-white/10 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.85)]'
            : 'max-w-4xl h-[90vh] max-h-[820px] min-h-[560px] rounded-2xl border-2 border-stone-800 shadow-2xl'
        }`}
      >
        {/* Device Speaker & Camera Notch (when in mobile frame view) */}
        {isMobileFrameView && (
          <div className="w-full bg-stone-950 py-1.5 flex items-center justify-center relative shrink-0 border-b border-stone-900">
            <div className="w-16 h-1.5 bg-stone-800 rounded-full" />
            <div className="absolute right-4 text-[10px] text-stone-500 font-mono">100% 🔋</div>
          </div>
        )}

        {/* Top HUD Bar */}
        <TopBar
          lives={lives}
          maxLives={7}
          score={score}
          fishCoins={stats.fishCoins}
          currentDistance={currentDistance}
          stageConfig={stageConfig}
          isPaused={isPaused}
          isMuted={isMuted}
          currentStreak={streakData.currentStreak}
          onTogglePause={handleTogglePause}
          onToggleMute={handleToggleMute}
          onOpenShop={() => setIsShopOpen(true)}
          onOpenStreak={() => setIsStreakOpen(true)}
          onOpenStageSelect={() => setIsStageSelectOpen(true)}
        />

        {/* Game Canvas Area (Fills 100% edge-to-edge) */}
        <div className="flex-1 w-full h-full relative overflow-hidden flex flex-col p-0 bg-stone-950">
          <GameCanvas
            stageId={currentStageId}
            stageConfig={stageConfig}
            customization={customization}
            isPaused={isPaused}
            onLivesChange={(l) => setLives(l)}
            onScoreChange={(s) => setScore(s)}
            onCoinsCollected={(c) => setCoinsEarnedThisRun(c)}
            onDistanceChange={(d) => setCurrentDistance(d)}
            onGameOver={handleGameOver}
            onStageComplete={handleStageComplete}
            engineRef={engineRef}
          />

          {/* Sleek floating stage indicator chip */}
          <div className="absolute top-2 right-2 pointer-events-auto z-10">
            <button
              onClick={() => setIsStageSelectOpen(true)}
              className="bg-black/60 hover:bg-black/80 text-amber-300 hover:text-amber-200 text-[10px] font-semibold px-2.5 py-1 rounded-full border border-amber-600/40 backdrop-blur-xs transition-colors flex items-center gap-1 shadow-md"
              title="Trocar Fase"
            >
              <span>Fase:</span>
              <strong className="text-white truncate max-w-[120px]">{stageConfig.name}</strong>
            </button>
          </div>
        </div>

        {/* Bottom Phone Bar & Micro Stats */}
        {isMobileFrameView && (
          <div className="w-full bg-stone-950 py-1.5 px-4 flex items-center justify-between shrink-0 border-t border-stone-900">
            <div className="flex items-center gap-2 text-[10px] text-stone-500">
              <span className="flex items-center gap-0.5 text-orange-400">
                <Flame className="w-3 h-3" /> {streakData.currentStreak}d
              </span>
              <span>·</span>
              <span className="text-amber-400">🐟 {stats.fishCoins}</span>
            </div>

            <div className="w-24 h-1 bg-stone-700 rounded-full" />

            <button
              onClick={() => setIsStageSelectOpen(true)}
              className="text-[10px] text-stone-400 hover:text-amber-300 transition-colors"
            >
              Fases
            </button>
          </div>
        )}
      </main>

      {/* Outer Desktop Utilities & Game Info */}
      <footer className="mt-4 flex flex-wrap items-center justify-center gap-3 text-xs text-stone-400">
        <button
          onClick={() => setIsMobileFrameView(!isMobileFrameView)}
          className="flex items-center gap-1.5 bg-stone-800 hover:bg-stone-700 text-stone-200 px-3 py-1.5 rounded-lg border border-stone-700 transition-colors"
        >
          {isMobileFrameView ? (
            <>
              <Monitor className="w-3.5 h-3.5 text-amber-400" /> Modo Tela Expandida
            </>
          ) : (
            <>
              <Smartphone className="w-3.5 h-3.5 text-amber-400" /> Modo Simulador Mobile
            </>
          )}
        </button>

        <button
          onClick={() => setIsStreakOpen(true)}
          className="flex items-center gap-1.5 bg-stone-800 hover:bg-stone-700 text-stone-200 px-3 py-1.5 rounded-lg border border-stone-700 transition-colors"
        >
          <Sparkles className="w-3.5 h-3.5 text-yellow-400" /> Abrir Painel Streak & Treat Rush
        </button>

        <span className="text-stone-500 text-[11px]">
          Cat Runner · Auto-runner Mobile de Um Dedo Só · 7 Vidas
        </span>
      </footer>

      {/* Modals */}
      <StreakModal
        isOpen={isStreakOpen}
        onClose={() => setIsStreakOpen(false)}
        streakData={streakData}
        onUpdateStreak={(u) => setStreakData(u)}
        onWatchAdToRepair={handleWatchAdToRepairStreak}
        onPlayTreatRush={() => handleSelectStage('treat_rush')}
      />

      <ShopModal
        isOpen={isShopOpen}
        onClose={() => setIsShopOpen(false)}
        stats={stats}
        customization={customization}
        onEquip={handleEquipCosmetic}
        onBuyItem={handleBuyCosmetic}
        onRemoveAdsPurchase={handleRemoveAdsPurchase}
        onWatchRewardedAdForCoins={handleWatchRewardedAdForCoins}
      />

      <StageSelectModal
        isOpen={isStageSelectOpen}
        onClose={() => setIsStageSelectOpen(false)}
        currentStageId={currentStageId}
        treatRushUnlocked={streakData.treatRushUnlocked}
        onSelectStage={handleSelectStage}
      />

      <GameOverModal
        isOpen={isGameOverOpen}
        isVictory={gameOverIsVictory}
        score={score}
        coinsEarned={coinsEarnedThisRun}
        livesRemaining={lives}
        stageConfig={stageConfig}
        onRestart={handleRestart}
        onReviveWithAd={handleReviveWithAd}
        onNextStage={handleNextStage}
        onOpenStageSelect={() => {
          setIsGameOverOpen(false);
          setIsStageSelectOpen(true);
        }}
      />

      <AdModal
        isOpen={isAdOpen}
        adType={currentAdType}
        onAdCompleted={handleAdCompleted}
        onClose={() => setIsAdOpen(false)}
        adsRemoved={stats.adsRemoved}
      />
    </div>
  );
}
