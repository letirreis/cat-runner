import React, { useEffect, useState } from 'react';
import { Sparkles, CheckCircle2, ShieldCheck, Heart, Flame } from 'lucide-react';
import { audio } from '../utils/audio';

export type AdType = 'rewarded_revive' | 'rewarded_coins' | 'rewarded_streak' | 'interstitial';

interface AdModalProps {
  isOpen: boolean;
  adType: AdType;
  onAdCompleted: () => void;
  onClose: () => void;
  adsRemoved: boolean;
}

const FUNNY_CAT_ADS = [
  {
    brand: 'Catnip Cola™',
    tagline: 'O refrigerante borbulhante que desperta o modo zoomies!',
    bgColor: 'from-emerald-900 to-teal-950',
    accentColor: '#10B981',
    emoji: '🥤🐱',
    rating: '5.0 ★ (120k miau-valiações)',
  },
  {
    brand: 'Whiskers Crunchies',
    tagline: 'Croquetes crocantes sabor salmão defumado para gatos exigentes!',
    bgColor: 'from-amber-900 to-orange-950',
    accentColor: '#F59E0B',
    emoji: '🐟✨',
    rating: '4.9 ★ (88k gatinhos satisfeitos)',
  },
  {
    brand: 'LaserPointer Pro 3000',
    tagline: 'O pontinho vermelho inalcançável que todo felino sonha pegar!',
    bgColor: 'from-red-900 to-rose-950',
    accentColor: '#EF4444',
    emoji: '🔴🐾',
    rating: '4.8 ★ (250k caçadores)',
  },
];

export const AdModal: React.FC<AdModalProps> = ({
  isOpen,
  adType,
  onAdCompleted,
  onClose,
  adsRemoved,
}) => {
  const [secondsLeft, setSecondsLeft] = useState(5);
  const [canSkip, setCanSkip] = useState(false);
  const [adContent, setAdContent] = useState(FUNNY_CAT_ADS[0]);

  useEffect(() => {
    if (!isOpen) {
      setSecondsLeft(5);
      setCanSkip(false);
      return;
    }

    // Pick random mock ad
    const randomAd = FUNNY_CAT_ADS[Math.floor(Math.random() * FUNNY_CAT_ADS.length)];
    setAdContent(randomAd);

    // If user has "Remover Anúncios" enabled, grant rewards instantly or skip immediately!
    if (adsRemoved) {
      setSecondsLeft(0);
      setCanSkip(true);
      return;
    }

    setSecondsLeft(5);
    setCanSkip(false);

    const timer = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setCanSkip(true);
          audio.playCollect();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isOpen, adsRemoved]);

  if (!isOpen) return null;

  const handleClaim = () => {
    onAdCompleted();
    onClose();
  };

  const isRewarded = adType.startsWith('rewarded');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
      <div className="relative w-full max-w-sm bg-stone-900 border-2 border-amber-500/50 rounded-2xl p-6 text-stone-100 shadow-2xl overflow-hidden flex flex-col items-center text-center">
        {/* Ad type indicator badge */}
        <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-amber-400 bg-amber-950/80 px-2.5 py-0.5 rounded-full border border-amber-600/40 mb-3">
          {adsRemoved ? (
            <>
              <ShieldCheck className="w-3 h-3 text-emerald-400" /> Benefício VIP (Sem Anúncios)
            </>
          ) : isRewarded ? (
            <>
              <Sparkles className="w-3 h-3 text-yellow-300" /> Anúncio Premiado (Rewarded)
            </>
          ) : (
            'Anúncio Intersticial (Rodada 10)'
          )}
        </div>

        {/* Ad visual banner */}
        <div
          className={`w-full aspect-[4/3] rounded-xl bg-gradient-to-b ${adContent.bgColor} border border-white/10 p-5 flex flex-col items-center justify-between shadow-inner mb-4 relative overflow-hidden`}
        >
          {/* Animated decorative bubbles */}
          <div className="text-4xl animate-bounce my-auto">{adContent.emoji}</div>

          <div>
            <h3 className="font-display text-xl font-bold text-white mb-1 drop-shadow-md">
              {adContent.brand}
            </h3>
            <p className="text-xs text-amber-100/90 leading-snug">{adContent.tagline}</p>
          </div>

          <div className="text-[10px] text-amber-300/80 font-mono">{adContent.rating}</div>
        </div>

        {/* Countdown / Reward description */}
        <div className="w-full mb-4">
          {secondsLeft > 0 ? (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs text-stone-300">
                <span>Recompensa em breve...</span>
                <span className="font-mono font-bold text-amber-400 tabular-nums">{secondsLeft}s</span>
              </div>
              <div className="w-full h-1.5 bg-stone-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-400 transition-all duration-1000 ease-linear"
                  style={{ width: `${((5 - secondsLeft) / 5) * 100}%` }}
                />
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-1.5 text-emerald-400 text-xs font-semibold">
              <CheckCircle2 className="w-4 h-4" /> Anúncio concluído! Recompensa liberada!
            </div>
          )}
        </div>

        {/* Reward Details */}
        <div className="bg-stone-800/80 rounded-xl p-2.5 w-full mb-4 text-xs flex items-center justify-center gap-2 text-stone-200">
          {adType === 'rewarded_revive' && (
            <>
              <Heart className="w-4 h-4 text-rose-400 fill-rose-400" />
              <span>Reviver agora com <strong>+3 Vidas Extras</strong>!</span>
            </>
          )}
          {adType === 'rewarded_coins' && (
            <>
              <span className="text-base">🐟</span>
              <span>Receber <strong>+250 Peixinhos</strong> na carteira!</span>
            </>
          )}
          {adType === 'rewarded_streak' && (
            <>
              <Flame className="w-4 h-4 text-orange-400 fill-orange-400" />
              <span>Reparar <strong>Sequência Diária Perdida</strong>!</span>
            </>
          )}
          {adType === 'interstitial' && <span>Obrigado por apoiar o Cat Runner!</span>}
        </div>

        {/* Action Button */}
        <div className="w-full">
          {canSkip ? (
            <button
              onClick={handleClaim}
              className="w-full bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-stone-950 font-display font-bold text-sm py-2.5 px-4 rounded-xl shadow-lg transition-transform active:scale-95 flex items-center justify-center gap-1.5"
            >
              <Sparkles className="w-4 h-4" /> {isRewarded ? 'Resgatar Recompensa!' : 'Continuar Jogo'}
            </button>
          ) : (
            <button
              disabled
              className="w-full bg-stone-800 text-stone-500 font-display font-semibold text-xs py-2.5 px-4 rounded-xl cursor-not-allowed"
            >
              Aguarde {secondsLeft} segundos...
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
