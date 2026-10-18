export type StageId = 
  | 'living_room' 
  | 'kitchen' 
  | 'bathroom' 
  | 'hallway' 
  | 'bedroom' 
  | 'attic' 
  | 'garden' 
  | 'mansion' 
  | 'treat_rush';

export interface StageConfig {
  id: StageId;
  name: string;
  theme: string;
  durationSeconds: number;
  targetDistance: number;
  speed: number;
  unlockedByDefault: boolean;
  requiredStreakDay?: number;
  description: string;
  elementsIntroduced: string[];
  ambientColor: string;
  isTutorial?: boolean;
  difficulty: number; // 1 to 5
  rewardDescription: string;
  coinReward: number;
}

export type CatCoat = 'orange_tabby' | 'tuxedo' | 'siamese' | 'white_persian' | 'calico';
export type CatHat = 'none' | 'red_bow' | 'witch_hat' | 'cap' | 'sunglasses' | 'crown';
export type CatCollar = 'bell_collar' | 'blue_harness' | 'bowtie';

export interface CosmeticItem {
  id: string;
  name: string;
  category: 'coat' | 'hat' | 'collar';
  price: number;
  previewColor: string;
  description: string;
}

export interface PlayerCustomization {
  coat: CatCoat;
  hat: CatHat;
  collar: CatCollar;
}

export interface StreakData {
  currentStreak: number;
  highestStreak: number;
  lastPlayedDate: string | null; // ISO YYYY-MM-DD
  treatRushUnlocked: boolean;
  hasFreezeActive: boolean;
  streakFrozenToday: boolean;
  daysHistory: Record<string, boolean>; // date -> completed
}

export interface GameStats {
  highScore: number;
  totalRuns: number;
  totalTreatsCollected: number;
  totalPounces: number;
  fishCoins: number;
  adsRemoved: boolean;
  unlockedCosmetics: string[];
}

export type ObstacleType = 
  | 'cardboard_box' 
  | 'cushion' 
  | 'low_shelf' 
  | 'table_edge' 
  | 'mouse' 
  | 'insect' 
  | 'swooping_bird' 
  | 'vacuum' 
  | 'dog'
  | 'broom'
  | 'robot_vacuum'
  | 'cucumber'
  | 'water_spray'
  | 'soap_puddle'
  | 'hair_dryer'
  | 'laser_dot'
  | 'treat_kibble'
  | 'treat_sachet'
  | 'treat_golden_tuna'
  | 'catnip';

export interface Entity {
  id: number;
  type: ObstacleType;
  x: number;
  y: number;
  width: number;
  height: number;
  vx: number;
  vy: number;
  isCollectible: boolean;
  isPounceable: boolean;
  isHighObstacle: boolean; // Needs duck/slide
  isLowObstacle: boolean;  // Needs jump
  isChaser?: boolean;      // Chasing from behind like vacuum
  collected?: boolean;
  hit?: boolean;
  points: number;
  animFrame?: number;
  glow?: boolean;
  specialAction?: 'pounce' | 'duck' | 'jump';
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  alpha: number;
  decay: number;
  text?: string;
}
