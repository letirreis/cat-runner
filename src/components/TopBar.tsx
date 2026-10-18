import React from 'react';
import { Heart, Volume2, VolumeX, Pause, Play, ShoppingBag, Flame, Sparkles } from 'lucide-react';
import { StageConfig } from '../types/game';

interface TopBarProps {
  lives: number;
  maxLives: number;
  score: number;
  fishCoins: number;
  currentDistance: number;
  stageConfig: StageConfig;
  isPaused: boolean;
  isMuted: boolean;
  currentStreak: number;
  onTogglePause: () => void;
  onToggleMute: () => void;
  onOpenShop: () => void;
  onOpenStreak: () => void;
  onOpenStageSelect?: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  lives,
  maxLives,
  score,
  fishCoins,
  currentDistance,
  stageConfig,
  isPaused,
  isMuted,
  currentStreak,
  onTogglePause,
  onToggleMute,
  onOpenShop,
  onOpenStreak,
  onOpenStageSelect,
}) => {
  const progressPercent = Math.min(100, Math.floor((currentDistance / stageConfig.targetDistance) * 100));

  return (
    <header className="w-full bg-amber-900/90 backdrop-blur-md text-amber-50 px-3 py-2 border-b border-amber-800/80 shadow-md">
      <div className="flex items-center justify-between gap-2 max-w-4xl mx-auto">
        {/* Lives & Streak */}
        <div className="flex items-center gap-2">
          {/* Lives display */}
          <div className="flex items-center gap-1 bg-black/25 px-2 py-1 rounded-lg border border-amber-700/40" title={`${lives} de ${maxLives} vidas`}>
            <Heart className={`w-4 h-4 ${lives <= 2 ? 'text-red-500 animate-pulse' : 'text-red-400 fill-red-400'}`} />
            <span className="font-bold text-xs tracking-tight tabular-nums">{lives}</span>
            <span className="text-[10px] text-amber-200/80">/ {maxLives}</span>
          </div>

          {/* Daily Streak Badge */}
          <button
            onClick={onOpenStreak}
            className="flex items-center gap-1 bg-orange-500/30 hover:bg-orange-500/40 text-orange-200 border border-orange-500/40 px-2 py-1 rounded-lg text-xs font-semibold transition-transform active:scale-95"
            title="Sequência Diária (Streak)"
          >
            <Flame className="w-3.5 h-3.5 text-orange-400 fill-orange-400" />
            <span className="tabular-nums font-bold">{currentStreak}d</span>
            {currentStreak >= 7 && <Sparkles className="w-3 h-3 text-amber-300" />}
          </button>
        </div>

        {/* Stage Progress Bar (Clickable to switch stages) */}
        <button
          onClick={onOpenStageSelect}
          className="flex-1 max-w-[200px] flex flex-col items-center group text-left px-1.5 py-0.5 rounded-lg hover:bg-black/20 transition-colors"
          title="Clique para escolher outra fase"
        >
          <div className="flex items-center justify-between w-full text-[10px] font-medium text-amber-200/90 mb-0.5">
            <span className="truncate max-w-[110px] font-display group-hover:text-amber-100 flex items-center gap-1">
              {stageConfig.name}
            </span>
            <span className="tabular-nums font-mono text-[9px] text-amber-300/80">{progressPercent}%</span>
          </div>
          <div className="w-full h-2 bg-black/40 rounded-full overflow-hidden border border-amber-700/50 p-0.5 group-hover:border-amber-400/50 transition-colors">
            <div
              className="h-full bg-gradient-to-r from-amber-400 to-emerald-400 rounded-full transition-all duration-200"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </button>

        {/* Currency & Score & Controls */}
        <div className="flex items-center gap-1.5">
          {/* Fish Coins */}
          <button
            onClick={onOpenShop}
            className="flex items-center gap-1 bg-amber-600/30 hover:bg-amber-600/50 border border-amber-500/40 px-2 py-1 rounded-lg text-xs font-semibold transition-transform active:scale-95"
            title="Loja de Acessórios & Peixinhos"
          >
            <span className="text-xs">🐟</span>
            <span className="tabular-nums text-amber-200 font-bold">{fishCoins}</span>
          </button>

          {/* Score */}
          <div className="hidden sm:flex flex-col items-end px-1.5">
            <span className="text-[9px] uppercase tracking-wider text-amber-300/80 leading-none">Pontos</span>
            <span className="font-display text-xs font-bold text-white tabular-nums">{score}</span>
          </div>

          {/* Audio toggle */}
          <button
            onClick={onToggleMute}
            className="p-1.5 rounded-lg bg-black/25 hover:bg-black/40 text-amber-200 transition-colors"
            title={isMuted ? 'Ativar Som' : 'Desativar Som'}
            aria-label="Controle de Áudio"
          >
            {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
          </button>

          {/* Pause */}
          <button
            onClick={onTogglePause}
            className="p-1.5 rounded-lg bg-black/25 hover:bg-black/40 text-amber-200 transition-colors"
            title={isPaused ? 'Continuar' : 'Pausar'}
            aria-label="Pausar Jogo"
          >
            {isPaused ? <Play className="w-3.5 h-3.5 text-emerald-400" /> : <Pause className="w-3.5 h-3.5" />}
          </button>

          {/* Shop */}
          <button
            onClick={onOpenShop}
            className="p-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white transition-colors"
            title="Loja de Itens"
            aria-label="Abrir Loja"
          >
            <ShoppingBag className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </header>
  );
};
