import React from 'react';
import { RotateCcw, Video, Star, Award, Heart, ArrowRight } from 'lucide-react';
import { StageConfig } from '../types/game';

interface GameOverModalProps {
  isOpen: boolean;
  isVictory: boolean;
  score: number;
  coinsEarned: number;
  livesRemaining: number;
  stageConfig: StageConfig;
  onRestart: () => void;
  onReviveWithAd: () => void;
  onNextStage: () => void;
  onOpenStageSelect: () => void;
}

export const GameOverModal: React.FC<GameOverModalProps> = ({
  isOpen,
  isVictory,
  score,
  coinsEarned,
  livesRemaining,
  stageConfig,
  onRestart,
  onReviveWithAd,
  onNextStage,
  onOpenStageSelect,
}) => {
  if (!isOpen) return null;

  // Star rating calculation
  const stars = isVictory ? (livesRemaining >= 5 ? 3 : livesRemaining >= 2 ? 2 : 1) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
      <div className="relative w-full max-w-sm bg-stone-900 border-2 border-amber-500/50 rounded-2xl p-6 text-stone-100 shadow-2xl overflow-hidden text-center">
        {/* Header Icon */}
        <div className="mb-3">
          {isVictory ? (
            <div className="inline-flex items-center justify-center w-16 h-16 bg-amber-500/20 text-amber-300 rounded-2xl border border-amber-400/40 animate-bounce">
              <Award className="w-9 h-9" />
            </div>
          ) : (
            <div className="inline-flex items-center justify-center w-16 h-16 bg-rose-500/20 text-rose-400 rounded-2xl border border-rose-500/40">
              <Heart className="w-9 h-9 fill-rose-500/30" />
            </div>
          )}
        </div>

        {/* Title */}
        <h2 className="font-display text-2xl font-bold text-amber-100">
          {isVictory
            ? stageConfig.isTutorial
              ? 'Tutorial Concluído! 🎓'
              : 'Petisco Conquistado!'
            : 'Suas 7 Vidas Acabaram!'}
        </h2>
        <p className="text-xs text-stone-300 mt-1 mb-4">
          {isVictory
            ? stageConfig.isTutorial
              ? 'Parabéns! Você dominou o Pulo, o Deslize e o Bote felino e está pronto para correr pela casa toda!'
              : `Você atravessou a ${stageConfig.name} com maestria e devorou o petisco supremo!`
            : 'O gato tropeçou nos obstáculos pelo caminho, mas você pode reviver agora!'}
        </p>

        {/* Star Rating for victory */}
        {isVictory && (
          <div className="flex items-center justify-center gap-2 mb-4">
            {[1, 2, 3].map((s) => (
              <Star
                key={s}
                className={`w-7 h-7 ${
                  s <= stars
                    ? 'text-yellow-400 fill-yellow-400 animate-pulse'
                    : 'text-stone-700 fill-stone-800'
                }`}
              />
            ))}
          </div>
        )}

        {/* Score & Coins Summary Panel */}
        <div className="bg-stone-800/80 border border-stone-700 rounded-xl p-3 mb-5 space-y-2 text-xs">
          <div className="flex items-center justify-between text-stone-300">
            <span>Pontuação Total:</span>
            <span className="font-display font-bold text-sm text-amber-300 tabular-nums">{score}</span>
          </div>
          <div className="flex items-center justify-between text-stone-300">
            <span>Peixinhos Coletados:</span>
            <span className="font-display font-bold text-sm text-yellow-300 tabular-nums">+{coinsEarned} 🐟</span>
          </div>
          {isVictory && (
            <>
              <div className="flex items-center justify-between text-stone-300">
                <span>Vidas Restantes:</span>
                <span className="font-display font-bold text-rose-300 tabular-nums">{livesRemaining} / 7 ❤️</span>
              </div>
              {stageConfig.rewardDescription && (
                <div className="flex items-center justify-between text-stone-300 pt-2 border-t border-stone-700/60">
                  <span className="text-amber-300 font-semibold">🎁 Recompensa:</span>
                  <span className="font-display text-xs text-yellow-200">{stageConfig.rewardDescription}</span>
                </div>
              )}
            </>
          )}
        </div>

        {/* Action Buttons */}
        <div className="space-y-2">
          {!isVictory ? (
            /* Defeat Actions */
            <>
              {/* Primary Rewarded Ad Revive */}
              <button
                onClick={onReviveWithAd}
                className="w-full bg-gradient-to-r from-pink-500 to-amber-500 hover:from-pink-400 hover:to-amber-400 text-white font-display font-bold text-sm py-3 px-4 rounded-xl shadow-lg transition-transform active:scale-95 flex items-center justify-center gap-2"
              >
                <Video className="w-4 h-4" /> Reviver com Anúncio (+3 Vidas)
              </button>

              {/* Try Again */}
              <button
                onClick={onRestart}
                className="w-full bg-stone-800 hover:bg-stone-700 text-stone-200 font-display font-semibold text-xs py-2.5 px-4 rounded-xl border border-stone-700 transition-colors flex items-center justify-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Recomeçar do Início
              </button>
            </>
          ) : (
            /* Victory Actions */
            <>
              <button
                onClick={onNextStage}
                className="w-full bg-gradient-to-r from-emerald-500 to-amber-500 hover:from-emerald-400 hover:to-amber-400 text-stone-950 font-display font-bold text-sm py-3 px-4 rounded-xl shadow-lg transition-transform active:scale-95 flex items-center justify-center gap-1.5"
              >
                Avançar Próxima Fase <ArrowRight className="w-4 h-4" />
              </button>

              <button
                onClick={onRestart}
                className="w-full bg-stone-800 hover:bg-stone-700 text-stone-200 font-display font-semibold text-xs py-2.5 px-4 rounded-xl border border-stone-700 transition-colors flex items-center justify-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Jogar Novamente
              </button>
            </>
          )}

          <button
            onClick={onOpenStageSelect}
            className="w-full text-stone-400 hover:text-amber-200 text-[11px] py-1 transition-colors"
          >
            Escolher Outra Fase
          </button>
        </div>
      </div>
    </div>
  );
};
