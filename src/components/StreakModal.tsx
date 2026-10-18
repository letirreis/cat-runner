import React from 'react';
import { X, Flame, Shield, Sparkles, Gift, PlayCircle, RefreshCw, CheckCircle2 } from 'lucide-react';
import { StreakData } from '../types/game';
import { getTodayDateString, saveStreakData } from '../utils/storage';

interface StreakModalProps {
  isOpen: boolean;
  onClose: () => void;
  streakData: StreakData;
  onUpdateStreak: (updated: StreakData) => void;
  onWatchAdToRepair: () => void;
  onPlayTreatRush: () => void;
}

export const StreakModal: React.FC<StreakModalProps> = ({
  isOpen,
  onClose,
  streakData,
  onUpdateStreak,
  onWatchAdToRepair,
  onPlayTreatRush,
}) => {
  if (!isOpen) return null;

  const today = getTodayDateString();
  const checkedInToday = streakData.lastPlayedDate === today;
  const isBroken = !checkedInToday && streakData.lastPlayedDate !== getTodayDateString(-1) && streakData.lastPlayedDate !== null;

  const handleSimulateNextDay = () => {
    const updated: StreakData = {
      ...streakData,
      currentStreak: streakData.currentStreak + 1,
      highestStreak: Math.max(streakData.highestStreak, streakData.currentStreak + 1),
      lastPlayedDate: today,
      treatRushUnlocked: streakData.currentStreak + 1 >= 7 || streakData.treatRushUnlocked,
    };
    onUpdateStreak(updated);
    saveStreakData(updated);
  };

  const handleSimulateMissedDay = () => {
    // Set last played date 3 days in past to break streak
    const pastDate = getTodayDateString(-3);
    const updated: StreakData = {
      ...streakData,
      lastPlayedDate: pastDate,
      hasFreezeActive: false,
    };
    onUpdateStreak(updated);
    saveStreakData(updated);
  };

  const handleSimulateDay7Directly = () => {
    const updated: StreakData = {
      ...streakData,
      currentStreak: 7,
      highestStreak: Math.max(streakData.highestStreak, 7),
      lastPlayedDate: today,
      treatRushUnlocked: true,
    };
    onUpdateStreak(updated);
    saveStreakData(updated);
  };

  const handleToggleFreeze = () => {
    const updated: StreakData = {
      ...streakData,
      hasFreezeActive: !streakData.hasFreezeActive,
    };
    onUpdateStreak(updated);
    saveStreakData(updated);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="relative w-full max-w-md bg-stone-900 border-2 border-amber-500/40 rounded-2xl p-6 text-stone-100 shadow-2xl overflow-hidden">
        {/* Decorative corner glow */}
        <div className="absolute -top-12 -right-12 w-36 h-36 bg-orange-500/20 rounded-full blur-2xl pointer-events-none" />

        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-stone-400 hover:text-white p-1 rounded-lg bg-stone-800/80 transition-colors"
          aria-label="Fechar"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="text-center mb-5">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-orange-500/20 border border-orange-500/40 rounded-2xl mb-2 text-orange-400">
            <Flame className="w-7 h-7 fill-orange-400 animate-pulse" />
          </div>
          <h2 className="font-display text-2xl font-bold text-amber-200">Sequência Diária (Streak)</h2>
          <p className="text-xs text-stone-300 mt-1">
            Jogue pelo menos 1 fase por dia antes da meia-noite para manter o ritmo e desbloquear o <strong>Treat Rush</strong> no 7º dia!
          </p>
        </div>

        {/* Current streak banner */}
        <div className="bg-gradient-to-r from-orange-950/60 to-amber-950/60 border border-orange-600/40 rounded-xl p-3 mb-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="text-3xl font-display font-extrabold text-orange-400 tabular-nums">
              {streakData.currentStreak}
            </div>
            <div>
              <div className="text-xs font-semibold text-amber-100">
                {streakData.currentStreak === 1 ? 'Dia em sequência' : 'Dias seguidos correndo!'}
              </div>
              <div className="text-[11px] text-stone-400">
                Recorde: <strong className="text-amber-300">{streakData.highestStreak} dias</strong>
              </div>
            </div>
          </div>

          <div className="text-right">
            {checkedInToday ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-950/60 border border-emerald-500/40 px-2 py-0.5 rounded-full">
                <CheckCircle2 className="w-3.5 h-3.5" /> Check-in Feito!
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-300 bg-amber-950/60 border border-amber-500/40 px-2 py-0.5 rounded-full">
                Pendente Hoje
              </span>
            )}
          </div>
        </div>

        {/* 7-Day Visual Progress Track */}
        <div className="mb-6">
          <div className="flex items-center justify-between text-xs font-semibold text-stone-300 mb-2">
            <span>Progresso da Semana</span>
            <span className="text-amber-400 font-mono">Dia {Math.min(7, streakData.currentStreak)} de 7</span>
          </div>

          <div className="grid grid-cols-7 gap-1.5">
            {[1, 2, 3, 4, 5, 6, 7].map((day) => {
              const isPast = streakData.currentStreak >= day;
              const isCurrent = streakData.currentStreak === day;
              const isDay7 = day === 7;

              return (
                <div
                  key={day}
                  className={`flex flex-col items-center justify-between p-1.5 rounded-xl border text-center transition-all ${
                    isDay7
                      ? isPast
                        ? 'bg-gradient-to-b from-amber-500/40 to-yellow-600/40 border-yellow-400 text-yellow-200 shadow-md shadow-yellow-500/20'
                        : 'bg-stone-800/80 border-amber-500/50 text-amber-300'
                      : isPast
                      ? 'bg-orange-600/30 border-orange-500 text-orange-200'
                      : 'bg-stone-800/40 border-stone-700/50 text-stone-500'
                  }`}
                >
                  <span className="text-[10px] font-medium">D{day}</span>
                  <div className="my-1">
                    {isDay7 ? (
                      <Sparkles className={`w-4 h-4 ${isPast ? 'text-yellow-300 animate-spin' : 'text-amber-400'}`} />
                    ) : isPast ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <div className="w-4 h-4 rounded-full border border-stone-600 flex items-center justify-center text-[9px]">
                        🐾
                      </div>
                    )}
                  </div>
                  <span className="text-[9px] font-bold">
                    {isDay7 ? 'Festa!' : `+${day * 10}p`}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Treat Rush Special Unlock Status */}
        {streakData.treatRushUnlocked ? (
          <div className="bg-gradient-to-r from-amber-500/20 to-pink-500/20 border border-amber-400/60 rounded-xl p-3 mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Gift className="w-6 h-6 text-yellow-300" />
              <div>
                <h4 className="font-display text-xs font-bold text-yellow-200">Treat Rush Desbloqueado!</h4>
                <p className="text-[11px] text-stone-300">A fase especial dos sonhos com atum dourado infinito está disponível!</p>
              </div>
            </div>
            <button
              onClick={() => {
                onClose();
                onPlayTreatRush();
              }}
              className="bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-stone-900 font-display font-bold text-xs px-3 py-1.5 rounded-lg shadow-md transition-transform active:scale-95 whitespace-nowrap"
            >
              Jogar Agora!
            </button>
          </div>
        ) : (
          <div className="bg-stone-800/60 border border-stone-700/60 rounded-xl p-3 mb-4 flex items-center gap-2 text-xs text-stone-300">
            <Gift className="w-5 h-5 text-amber-400 shrink-0" />
            <div>
              <strong className="text-amber-200">Marco do Dia 7:</strong> Atinja 7 dias para desbloquear a fase secreta <strong>Treat Rush</strong> cheia de atum dourado e multiplicadores!
            </div>
          </div>
        )}

        {/* Missed Day / Streak Repair / Streak Freeze */}
        <div className="bg-stone-800/80 border border-stone-700/80 rounded-xl p-3 mb-4 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5">
              <Shield className={`w-4 h-4 ${streakData.hasFreezeActive ? 'text-sky-400 fill-sky-400' : 'text-stone-500'}`} />
              <span className="font-semibold text-stone-200">Protetor de Sequência (Streak Freeze)</span>
            </div>
            <button
              onClick={handleToggleFreeze}
              className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                streakData.hasFreezeActive
                  ? 'bg-sky-500/20 text-sky-300 border-sky-400/50'
                  : 'bg-stone-700 text-stone-300 border-stone-600'
              }`}
            >
              {streakData.hasFreezeActive ? 'Ativo (Protegido)' : 'Ativar Proteção'}
            </button>
          </div>

          {/* Missed Day Repair button */}
          {isBroken && (
            <div className="pt-2 border-t border-stone-700/60 flex items-center justify-between">
              <div className="text-[11px] text-red-300">
                Você perdeu um dia de corrida!
              </div>
              <button
                onClick={onWatchAdToRepair}
                className="flex items-center gap-1 bg-red-600 hover:bg-red-500 text-white font-display text-xs font-bold px-2.5 py-1 rounded-lg transition-transform active:scale-95 shadow-md"
              >
                <PlayCircle className="w-3.5 h-3.5" /> Reparar com Anúncio
              </button>
            </div>
          )}
        </div>

        {/* Simulation / Testing Tools for evaluation */}
        <div className="border-t border-stone-800 pt-3">
          <div className="text-[10px] font-semibold text-stone-400 uppercase tracking-wider mb-1.5">
            Ferramentas de Teste Rápido (Simulador de Dias)
          </div>
          <div className="grid grid-cols-3 gap-1.5 text-[11px]">
            <button
              onClick={handleSimulateNextDay}
              className="bg-stone-800 hover:bg-stone-700 text-amber-200 py-1.5 px-2 rounded-lg border border-stone-700 transition-colors flex items-center justify-center gap-1"
              title="Avançar 1 dia na sequência"
            >
              <RefreshCw className="w-3 h-3" /> +1 Dia
            </button>
            <button
              onClick={handleSimulateMissedDay}
              className="bg-stone-800 hover:bg-stone-700 text-rose-300 py-1.5 px-2 rounded-lg border border-stone-700 transition-colors"
              title="Simular dia perdido para testar reparo de sequência"
            >
              Dia Perdido
            </button>
            <button
              onClick={handleSimulateDay7Directly}
              className="bg-stone-800 hover:bg-stone-700 text-yellow-300 py-1.5 px-2 rounded-lg border border-stone-700 transition-colors"
              title="Ir direto para o Dia 7"
            >
              Dia 7 Imediato
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
