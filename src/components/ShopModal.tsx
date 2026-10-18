import React, { useState } from 'react';
import { X, Check, ShoppingBag, Sparkles, Video, ShieldCheck, Tag } from 'lucide-react';
import { CosmeticItem, GameStats, PlayerCustomization } from '../types/game';
import { COSMETIC_ITEMS } from '../utils/storage';

interface ShopModalProps {
  isOpen: boolean;
  onClose: () => void;
  stats: GameStats;
  customization: PlayerCustomization;
  onEquip: (c: PlayerCustomization) => void;
  onBuyItem: (item: CosmeticItem) => void;
  onRemoveAdsPurchase: () => void;
  onWatchRewardedAdForCoins: () => void;
}

export const ShopModal: React.FC<ShopModalProps> = ({
  isOpen,
  onClose,
  stats,
  customization,
  onEquip,
  onBuyItem,
  onRemoveAdsPurchase,
  onWatchRewardedAdForCoins,
}) => {
  const [activeTab, setActiveTab] = useState<'coat' | 'hat' | 'collar' | 'iap'>('coat');

  if (!isOpen) return null;

  const currentTabItems = COSMETIC_ITEMS.filter((i) => i.category === activeTab);

  const isUnlocked = (itemId: string) => {
    return stats.unlockedCosmetics.includes(itemId);
  };

  const isEquipped = (item: CosmeticItem) => {
    if (item.category === 'coat') return customization.coat === item.id;
    if (item.category === 'hat') return customization.hat === item.id;
    if (item.category === 'collar') return customization.collar === item.id;
    return false;
  };

  const handleItemClick = (item: CosmeticItem) => {
    if (isUnlocked(item.id)) {
      // Equip item
      const updated = { ...customization };
      if (item.category === 'coat') updated.coat = item.id as any;
      if (item.category === 'hat') updated.hat = item.id as any;
      if (item.category === 'collar') updated.collar = item.id as any;
      onEquip(updated);
    } else {
      // Try purchase
      onBuyItem(item);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-xs">
      <div className="relative w-full max-w-lg bg-stone-900 border-2 border-amber-500/40 rounded-2xl p-6 text-stone-100 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-stone-800">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-amber-500/20 text-amber-400 rounded-xl border border-amber-500/40">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-display text-xl font-bold text-amber-200">Guarda-Roupa Felino</h2>
              <p className="text-xs text-stone-400">Personalize a pelagem e os acessórios do seu gato!</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Currency balance */}
            <div className="flex items-center gap-1.5 bg-amber-950/80 border border-amber-500/50 px-3 py-1.5 rounded-xl">
              <span className="text-sm">🐟</span>
              <span className="font-display font-bold text-amber-300 tabular-nums">{stats.fishCoins}</span>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 text-stone-400 hover:text-white rounded-lg bg-stone-800/80 transition-colors"
              aria-label="Fechar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Categories Tabs */}
        <div className="flex items-center gap-1.5 my-3 bg-stone-950/60 p-1 rounded-xl border border-stone-800">
          <button
            onClick={() => setActiveTab('coat')}
            className={`flex-1 py-1.5 text-xs font-display font-semibold rounded-lg transition-all ${
              activeTab === 'coat' ? 'bg-amber-500 text-stone-950 shadow-sm' : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            Pelagens
          </button>
          <button
            onClick={() => setActiveTab('hat')}
            className={`flex-1 py-1.5 text-xs font-display font-semibold rounded-lg transition-all ${
              activeTab === 'hat' ? 'bg-amber-500 text-stone-950 shadow-sm' : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            Chapéus
          </button>
          <button
            onClick={() => setActiveTab('collar')}
            className={`flex-1 py-1.5 text-xs font-display font-semibold rounded-lg transition-all ${
              activeTab === 'collar' ? 'bg-amber-500 text-stone-950 shadow-sm' : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            Coleiras
          </button>
          <button
            onClick={() => setActiveTab('iap')}
            className={`flex-1 py-1.5 text-xs font-display font-semibold rounded-lg transition-all ${
              activeTab === 'iap' ? 'bg-gradient-to-r from-pink-500 to-rose-500 text-white shadow-sm' : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            Vantagens
          </button>
        </div>

        {/* Content list */}
        <div className="flex-1 overflow-y-auto pr-1 space-y-2.5 my-1">
          {activeTab !== 'iap' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {currentTabItems.map((item) => {
                const unlocked = isUnlocked(item.id);
                const equipped = isEquipped(item);
                const canAfford = stats.fishCoins >= item.price;

                return (
                  <div
                    key={item.id}
                    onClick={() => handleItemClick(item)}
                    className={`cursor-pointer p-3 rounded-xl border transition-all flex items-center justify-between ${
                      equipped
                        ? 'bg-amber-500/20 border-amber-400 ring-1 ring-amber-400/50'
                        : unlocked
                        ? 'bg-stone-800/80 border-stone-700 hover:border-amber-500/60'
                        : 'bg-stone-900/90 border-stone-800 hover:border-stone-700'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {/* Color Preview Circle */}
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center shadow-inner border border-white/20 shrink-0"
                        style={{ backgroundColor: item.previewColor }}
                      >
                        {equipped && <Check className="w-5 h-5 text-white drop-shadow-md stroke-[3]" />}
                      </div>

                      <div className="min-w-0">
                        <div className="font-display font-bold text-sm text-stone-100 truncate">
                          {item.name}
                        </div>
                        <div className="text-[11px] text-stone-400 line-clamp-1">
                          {item.description}
                        </div>
                      </div>
                    </div>

                    <div className="shrink-0 ml-2">
                      {equipped ? (
                        <span className="text-[10px] font-bold text-amber-300 bg-amber-950/80 px-2 py-0.5 rounded-md border border-amber-500/40">
                          Equipado
                        </span>
                      ) : unlocked ? (
                        <button className="text-[10px] font-bold text-stone-300 bg-stone-700 hover:bg-stone-600 px-2.5 py-1 rounded-md transition-colors">
                          Usar
                        </button>
                      ) : (
                        <button
                          disabled={!canAfford}
                          className={`text-xs font-display font-bold px-2.5 py-1 rounded-md border flex items-center gap-1 transition-all ${
                            canAfford
                              ? 'bg-amber-500 hover:bg-amber-400 text-stone-950 border-amber-400 active:scale-95'
                              : 'bg-stone-800 text-stone-500 border-stone-700 cursor-not-allowed'
                          }`}
                        >
                          <span>🐟</span> {item.price}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* Monetization & Advantages tab */
            <div className="space-y-3">
              {/* Rewarded Video Ad Offer */}
              <div className="bg-gradient-to-r from-amber-950/60 to-orange-950/60 border border-amber-500/40 rounded-xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-amber-500/20 text-amber-300 rounded-xl border border-amber-500/40">
                    <Video className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="font-display font-bold text-sm text-amber-200">Assistir Anúncio Premiado</h4>
                    <p className="text-xs text-stone-300">Ganhe instantaneamente <strong>+250 Peixinhos</strong> para desbloquear cosméticos!</p>
                  </div>
                </div>

                <button
                  onClick={onWatchRewardedAdForCoins}
                  className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-stone-950 font-display font-bold text-xs px-3 py-2 rounded-xl shadow-md transition-transform active:scale-95 flex items-center gap-1.5 whitespace-nowrap"
                >
                  <Sparkles className="w-4 h-4" /> Ganhar +250
                </button>
              </div>

              {/* Remove Ads In-App Purchase */}
              <div className="bg-stone-800/80 border border-stone-700 rounded-xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-rose-500/20 text-rose-300 rounded-xl border border-rose-500/40">
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="font-display font-bold text-sm text-rose-200">Compra Única: Remover Anúncios</h4>
                    <p className="text-xs text-stone-300">
                      Elimina anúncios intersticiais a cada 10 rodadas e concede recompensas de vidas imediatamente sem comerciais.
                    </p>
                  </div>
                </div>

                <div>
                  {stats.adsRemoved ? (
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-300 bg-emerald-950/80 border border-emerald-500/40 px-3 py-1.5 rounded-xl">
                      <Check className="w-4 h-4" /> Ativado
                    </span>
                  ) : (
                    <button
                      onClick={onRemoveAdsPurchase}
                      className="bg-rose-600 hover:bg-rose-500 text-white font-display font-bold text-xs px-3.5 py-2 rounded-xl shadow-md transition-transform active:scale-95 flex items-center gap-1.5 whitespace-nowrap"
                    >
                      <Tag className="w-4 h-4" /> Comprar (R$ 4,90)
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="pt-3 border-t border-stone-800 text-[11px] text-stone-400 text-center">
          Os cosméticos alteram as cores e acessórios do gato em tempo real durante as corridas!
        </div>
      </div>
    </div>
  );
};
