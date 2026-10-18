import { CosmeticItem, GameStats, PlayerCustomization, StreakData } from '../types/game';

const STATS_KEY = 'cat_runner_stats_v1';
const CUSTOMIZATION_KEY = 'cat_runner_customization_v1';
const STREAK_KEY = 'cat_runner_streak_v1';

export const COSMETIC_ITEMS: CosmeticItem[] = [
  // Coats
  { id: 'orange_tabby', name: 'Laranja Malhado', category: 'coat', price: 0, previewColor: '#F97316', description: 'O clássico gatinho cor de abóbora, ágil e travesso.' },
  { id: 'tuxedo', name: 'Frajola (Tuxedo)', category: 'coat', price: 150, previewColor: '#18181B', description: 'Sempre vestido a rigor de preto e branco para aprontar.' },
  { id: 'siamese', name: 'Siamês Elegante', category: 'coat', price: 280, previewColor: '#D97706', description: 'Pelagem creme com orelhinhas escuras e olhos expressivos.' },
  { id: 'white_persian', name: 'Branco Felpudo', category: 'coat', price: 400, previewColor: '#F4F4F5', description: 'Puro pelo macio e dignidade felina inquestionável.' },
  { id: 'calico', name: 'Calico Tricolor', category: 'coat', price: 550, previewColor: '#EA580C', description: 'Manchas harmoniosas de branco, preto e laranja da sorte.' },
  // Hats
  { id: 'none', name: 'Sem Chapéu', category: 'hat', price: 0, previewColor: '#9CA3AF', description: 'Orelhinhas livres e ao vento.' },
  { id: 'red_bow', name: 'Lacinho Vermelho', category: 'hat', price: 120, previewColor: '#EF4444', description: 'Um laço charmoso no topo da cabeça.' },
  { id: 'cap', name: 'Boné Streetwear', category: 'hat', price: 220, previewColor: '#3B82F6', description: 'Estilo skatista para o gato mais descolado da casa.' },
  { id: 'witch_hat', name: 'Chapéu Mágico', category: 'hat', price: 350, previewColor: '#8B5CF6', description: 'Miau místico com ponta estrelada.' },
  { id: 'sunglasses', name: 'Óculos Escuros', category: 'hat', price: 420, previewColor: '#111827', description: 'Frio, calculista e 100% irresistível.' },
  { id: 'crown', name: 'Coroa Imperial', category: 'hat', price: 600, previewColor: '#F59E0B', description: 'O verdadeiro rei da casa e senhor dos sachês.' },
  // Collars
  { id: 'bell_collar', name: 'Guizo Dourado', category: 'collar', price: 0, previewColor: '#EF4444', description: 'Coleira vermelha com guizo brilhante.' },
  { id: 'blue_harness', name: 'Peitoral Aventura', category: 'collar', price: 160, previewColor: '#0EA5E9', description: 'Coleira peitoral resistente para grandes explorações.' },
  { id: 'bowtie', name: 'Gravata Borboleta', category: 'collar', price: 290, previewColor: '#10B981', description: 'Formalidade impecável para jantares com sachê.' },
];

export const DEFAULT_STATS: GameStats = {
  highScore: 0,
  totalRuns: 0,
  totalTreatsCollected: 0,
  totalPounces: 0,
  fishCoins: 100, // Starting bonus
  adsRemoved: false,
  unlockedCosmetics: ['orange_tabby', 'none', 'bell_collar'],
};

export const DEFAULT_CUSTOMIZATION: PlayerCustomization = {
  coat: 'orange_tabby',
  hat: 'none',
  collar: 'bell_collar',
};

// Formats date to YYYY-MM-DD
export function getTodayDateString(offsetDays = 0): string {
  const d = new Date();
  if (offsetDays !== 0) {
    d.setDate(d.getDate() + offsetDays);
  }
  return d.toISOString().split('T')[0];
}

export function loadGameStats(): GameStats {
  try {
    const raw = localStorage.getItem(STATS_KEY);
    if (raw) {
      return { ...DEFAULT_STATS, ...JSON.parse(raw) };
    }
  } catch (e) {
    console.warn('Failed to load stats', e);
  }
  return DEFAULT_STATS;
}

export function saveGameStats(stats: GameStats) {
  try {
    localStorage.setItem(STATS_KEY, JSON.stringify(stats));
  } catch (e) {
    console.warn('Failed to save stats', e);
  }
}

export function loadCustomization(): PlayerCustomization {
  try {
    const raw = localStorage.getItem(CUSTOMIZATION_KEY);
    if (raw) {
      return { ...DEFAULT_CUSTOMIZATION, ...JSON.parse(raw) };
    }
  } catch (e) {
    console.warn('Failed to load customization', e);
  }
  return DEFAULT_CUSTOMIZATION;
}

export function saveCustomization(c: PlayerCustomization) {
  try {
    localStorage.setItem(CUSTOMIZATION_KEY, JSON.stringify(c));
  } catch (e) {
    console.warn('Failed to save customization', e);
  }
}

export function loadStreakData(): StreakData {
  try {
    const raw = localStorage.getItem(STREAK_KEY);
    if (raw) {
      const data: StreakData = JSON.parse(raw);
      return data;
    }
  } catch (e) {
    console.warn('Failed to load streak', e);
  }

  // Initial fresh streak: day 1
  return {
    currentStreak: 1,
    highestStreak: 1,
    lastPlayedDate: null,
    treatRushUnlocked: false,
    hasFreezeActive: true, // Bonus 1 streak freeze to start!
    streakFrozenToday: false,
    daysHistory: {},
  };
}

export function saveStreakData(streak: StreakData) {
  try {
    localStorage.setItem(STREAK_KEY, JSON.stringify(streak));
  } catch (e) {
    console.warn('Failed to save streak', e);
  }
}

/**
 * Updates streak upon finishing or playing at least 1 stage today
 */
export function recordPlayToday(currentStreakData: StreakData): { updated: StreakData; streakIncreased: boolean; justUnlockedTreatRush: boolean } {
  const today = getTodayDateString();
  const updated = { ...currentStreakData };
  let streakIncreased = false;
  let justUnlockedTreatRush = false;

  if (updated.lastPlayedDate === today) {
    // Already checked in today
    return { updated, streakIncreased: false, justUnlockedTreatRush: false };
  }

  const yesterday = getTodayDateString(-1);

  if (!updated.lastPlayedDate) {
    // First ever check-in
    updated.currentStreak = 1;
    updated.highestStreak = Math.max(updated.highestStreak, 1);
    streakIncreased = true;
  } else if (updated.lastPlayedDate === yesterday) {
    // Consecutive day!
    updated.currentStreak += 1;
    if (updated.currentStreak > updated.highestStreak) {
      updated.highestStreak = updated.currentStreak;
    }
    streakIncreased = true;
  } else {
    // Missed at least one day
    if (updated.hasFreezeActive) {
      // Streak Freeze saved the day!
      updated.hasFreezeActive = false;
      updated.streakFrozenToday = true;
      updated.currentStreak += 1;
      streakIncreased = true;
    } else {
      // Streak broke, reset to 1
      updated.currentStreak = 1;
      streakIncreased = false;
    }
  }

  updated.lastPlayedDate = today;
  updated.daysHistory[today] = true;

  // Day 7 milestone triggers Treat Rush special level!
  if (updated.currentStreak >= 7 && !updated.treatRushUnlocked) {
    updated.treatRushUnlocked = true;
    justUnlockedTreatRush = true;
  }

  saveStreakData(updated);
  return { updated, streakIncreased, justUnlockedTreatRush };
}
