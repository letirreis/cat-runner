import React, { useState } from 'react';
import { X, Play, Lock, Sparkles, Clock, Check, Star, ShieldAlert } from 'lucide-react';
import { STAGES } from '../game/stages';
import { StageId } from '../types/game';

interface StageSelectModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentStageId: StageId;
  treatRushUnlocked: boolean;
  onSelectStage: (stageId: StageId) => void;
}

const STAGE_EMOJIS: Record<StageId, string> = {
  living_room: '🛋️',
  kitchen: '🍳',
  bathroom: '🛁',
  hallway: '🧹',
  bedroom: '🛏️',
  attic: '🕸️',
  garden: '🌳',
  mansion: '🏰',
  treat_rush: '👑',
};

const STAGE_THEME_LABELS: Record<StageId, string> = {
  living_room: 'Tutorial de Controles Felinos',
  kitchen: 'Móveis & Bichinhos Rápidos',
  bathroom: 'Terror da Água & Secador',
  hallway: 'Vassouras & Pepinos da Surpresa',
  bedroom: 'Robô Aspirador & Laser Vermelho',
  attic: 'Teias, Traças & Rato Ninja',
  garden: 'Pássaros Rasantes & Aspirador Perseguidor',
  mansion: 'Desafio Supremo da Mansão',
  treat_rush: 'Chuva Infinita de Atum Dourado',
};

type FilterCategory = 'all' | 'easy' | 'fears' | 'hard';

export const StageSelectModal: React.FC<StageSelectModalProps> = ({
  isOpen,
  onClose,
  currentStageId,
  treatRushUnlocked,
  onSelectStage,
}) => {
  const [filter, setFilter] = useState<FilterCategory>('all');

  if (!isOpen) return null;

  const stageKeys = Object.keys(STAGES) as StageId[];

  const filteredStages = stageKeys.filter((key) => {
    const stage = STAGES[key];
    if (filter === 'easy') return stage.difficulty <= 2;
    if (filter === 'fears') return ['bathroom', 'hallway', 'bedroom'].includes(key);
    if (filter === 'hard') return stage.difficulty >= 4 || key === 'treat_rush';
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-xs">
      <div className="relative w-full max-w-lg bg-stone-900 border-2 border-amber-500/50 rounded-2xl p-4 sm:p-6 text-stone-100 shadow-2xl overflow-hidden flex flex-col max-h-[88vh]">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-stone-800 shrink-0">
          <div>
            <h2 className="font-display text-lg sm:text-xl font-bold text-amber-200 flex items-center gap-2">
              <span>🏠</span> Fases da Casa Felina
            </h2>
            <p className="text-xs text-stone-400">
              Escolha a fase: enfrente vassouras, aspiradores, borrifadores e ganhe petiscos!
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-stone-400 hover:text-white rounded-lg bg-stone-800/80 transition-colors"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 py-2.5 overflow-x-auto shrink-0 border-b border-stone-800/60 no-scrollbar">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
              filter === 'all'
                ? 'bg-amber-500 text-stone-950 font-bold'
                : 'bg-stone-800 text-stone-300 hover:bg-stone-700'
            }`}
          >
            Todas ({stageKeys.length})
          </button>
          <button
            onClick={() => setFilter('easy')}
            className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
              filter === 'easy'
                ? 'bg-amber-500 text-stone-950 font-bold'
                : 'bg-stone-800 text-stone-300 hover:bg-stone-700'
            }`}
          >
            🌱 Início (Fácil)
          </button>
          <button
            onClick={() => setFilter('fears')}
            className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
              filter === 'fears'
                ? 'bg-amber-500 text-stone-950 font-bold'
                : 'bg-stone-800 text-stone-300 hover:bg-stone-700'
            }`}
          >
            😱 Medos Felinos (Água, Vassouras, Robôs)
          </button>
          <button
            onClick={() => setFilter('hard')}
            className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
              filter === 'hard'
                ? 'bg-amber-500 text-stone-950 font-bold'
                : 'bg-stone-800 text-stone-300 hover:bg-stone-700'
            }`}
          >
            🔥 Desafios & Treat Rush
          </button>
        </div>

        {/* Stage List */}
        <div className="flex-1 overflow-y-auto py-3 space-y-3 pr-1">
          {filteredStages.map((key) => {
            const stage = STAGES[key];
            const isTreatRush = key === 'treat_rush';
            const isLocked = isTreatRush && !treatRushUnlocked;
            const isSelected = currentStageId === key;
            const emoji = STAGE_EMOJIS[key] || '🐾';
            const themeSubtitle = STAGE_THEME_LABELS[key] || stage.theme;

            return (
              <div
                key={key}
                onClick={() => {
                  if (!isLocked) {
                    onSelectStage(key);
                    onClose();
                  }
                }}
                className={`p-3.5 rounded-xl border transition-all flex flex-col gap-2.5 ${
                  isSelected
                    ? 'bg-amber-950/70 border-amber-400 ring-2 ring-amber-400/30'
                    : isLocked
                    ? 'bg-stone-900/60 border-stone-800 opacity-60 cursor-not-allowed'
                    : 'bg-stone-800/70 border-stone-700/80 hover:border-amber-500/60 hover:bg-stone-800 cursor-pointer'
                }`}
              >
                {/* Header row */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <span className="text-2xl p-2 rounded-xl bg-stone-950/60 border border-stone-700/50 flex items-center justify-center shrink-0">
                      {emoji}
                    </span>
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h3 className="font-display font-bold text-sm text-stone-100">
                          {stage.name}
                        </h3>
                        {stage.isTutorial && (
                          <span className="text-[9px] font-bold bg-amber-500/30 text-amber-300 border border-amber-400/50 px-1.5 py-0.5 rounded-full">
                            Tutorial
                          </span>
                        )}
                        {isTreatRush && (
                          <span className="flex items-center gap-1 text-[9px] font-bold bg-pink-500/30 text-pink-300 border border-pink-400/50 px-1.5 py-0.5 rounded-full">
                            <Sparkles className="w-2.5 h-2.5 text-pink-300" /> Dia 7 Streak
                          </span>
                        )}
                      </div>

                      <p className="text-[11px] text-amber-300/80 font-medium">
                        {themeSubtitle}
                      </p>

                      <div className="flex items-center gap-2 text-[11px] text-stone-400 mt-0.5">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-stone-500" />
                          <span>~{stage.durationSeconds}s ({stage.targetDistance}m)</span>
                        </span>
                        <span>·</span>
                        {/* Difficulty stars */}
                        <span className="flex items-center gap-0.5 text-yellow-400" title={`Dificuldade ${stage.difficulty}/5`}>
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star
                              key={i}
                              className={`w-2.5 h-2.5 ${
                                i < stage.difficulty ? 'fill-yellow-400 text-yellow-400' : 'text-stone-700'
                              }`}
                            />
                          ))}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Play or status button */}
                  <div className="shrink-0 pt-0.5">
                    {isLocked ? (
                      <span className="flex items-center gap-1 text-[10px] font-bold text-stone-400 bg-stone-800 px-2.5 py-1.5 rounded-lg border border-stone-700">
                        <Lock className="w-3 h-3 text-amber-400" /> Bloqueado
                      </span>
                    ) : isSelected ? (
                      <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-300 bg-emerald-950/80 px-2.5 py-1.5 rounded-lg border border-emerald-500/40">
                        <Check className="w-3.5 h-3.5" /> Selecionada
                      </span>
                    ) : (
                      <button className="flex items-center gap-1 text-[11px] font-bold text-stone-950 bg-gradient-to-r from-amber-400 to-yellow-400 hover:from-amber-300 hover:to-yellow-300 px-3 py-1.5 rounded-lg shadow transition-transform active:scale-95">
                        <Play className="w-3 h-3 fill-stone-950" /> Jogar
                      </button>
                    )}
                  </div>
                </div>

                {/* Description */}
                <p className="text-xs text-stone-300 leading-relaxed pl-1">
                  {stage.description}
                </p>

                {/* Rewards and Elements Introduced */}
                <div className="bg-stone-950/50 rounded-lg p-2 flex flex-col gap-1 border border-stone-800/80">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-amber-300 font-semibold flex items-center gap-1">
                      <span>🎁</span> Recompensa:
                    </span>
                    <span className="text-yellow-300 font-bold tabular-nums">
                      +{stage.coinReward} 🐟 ({stage.rewardDescription})
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-1 text-[10px] text-stone-400 pt-1 border-t border-stone-800">
                    <span className="text-rose-400 font-medium flex items-center gap-0.5">
                      <ShieldAlert className="w-3 h-3" /> Obstáculos & Medos:
                    </span>
                    {stage.elementsIntroduced.map((elem, i) => (
                      <span key={i} className="text-stone-300 bg-stone-900 px-1.5 py-0.5 rounded border border-stone-800">
                        {elem}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
