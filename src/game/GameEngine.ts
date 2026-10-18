import { Entity, ObstacleType, Particle, PlayerCustomization, StageConfig, StageId } from '../types/game';
import { audio } from '../utils/audio';
import { STAGES } from './stages';

export type TutorialStep = 'none' | 'intro' | 'jump' | 'duck' | 'pounce' | 'treats';

export interface GameEngineCallbacks {
  onScoreChange: (score: number) => void;
  onLivesChange: (lives: number) => void;
  onCoinsCollected: (coins: number) => void;
  onDistanceChange: (distance: number, target: number) => void;
  onGameOver: (finalScore: number, coinsEarned: number) => void;
  onStageComplete: (finalScore: number, coinsEarned: number, livesLeft: number) => void;
  onPounceSuccess: (points: number, targetType: string) => void;
  onTutorialStepChange?: (step: TutorialStep, title: string, instruction: string) => void;
}

export class GameEngine {
  public canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private callbacks: GameEngineCallbacks;

  // Configuration & State
  public stageConfig: StageConfig;
  public customization: PlayerCustomization;
  public isRunning: boolean = false;
  public isPaused: boolean = false;
  private animationFrameId: number | null = null;
  private lastTimestamp: number = 0;

  // Responsive Ground & Positioning
  public groundY: number = 360;
  public dpr: number = 1;
  public logicalWidth: number = 480;
  public logicalHeight: number = 720;

  // Cat State & Physics
  public cat = {
    x: 100,
    y: 316,
    baseY: 316,
    width: 68,
    height: 44,
    duckHeight: 24,
    vx: 0,
    vy: 0,
    jumpForce: -620,
    gravity: 1650,
    isGrounded: true,
    isDucking: false,
    duckTimer: 0,
    isPouncing: false,
    pounceTimer: 0,
    pounceTarget: null as Entity | null,
    lives: 7,
    maxLives: 7,
    invincibleTimer: 0,
    zoomiesTimer: 0,
    runCycle: 0,
  };

  // Stage & Progression
  public currentDistance: number = 0;
  public score: number = 0;
  public coinsEarnedThisRun: number = 0;
  public vacuumDistance: number = -180;
  public stageFinished: boolean = false;
  private goalReached: boolean = false;
  private goalObject: { x: number; y: number; reached: boolean } | null = null;

  // Tutorial State Machine for Stage 1
  public isTutorialStage: boolean = false;
  public tutorialStep: TutorialStep = 'none';
  private tutorialSpawnedCurrentStep: boolean = false;
  private tutorialTargetEntityId: number | null = null;

  // World Entities & Spawner
  public entities: Entity[] = [];
  public particles: Particle[] = [];
  private nextEntityId: number = 1;
  private spawnCooldown: number = 0;

  // Visuals & Parallax
  private bgOffsetX: number = 0;
  private midOffsetX: number = 0;
  private foreOffsetX: number = 0;

  constructor(
    canvas: HTMLCanvasElement,
    stageId: StageId,
    customization: PlayerCustomization,
    callbacks: GameEngineCallbacks
  ) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get 2D canvas context');
    this.ctx = ctx;
    this.stageConfig = STAGES[stageId] || STAGES.living_room;
    this.customization = customization;
    this.callbacks = callbacks;

    this.updateDimensions();
  }

  public updateDimensions(customWidth?: number, customHeight?: number) {
    const currentDpr = this.dpr || window.devicePixelRatio || 1;
    const width = customWidth || this.logicalWidth || (this.canvas.width ? this.canvas.width / currentDpr : 480);
    const height = customHeight || this.logicalHeight || (this.canvas.height ? this.canvas.height / currentDpr : 720);
    this.logicalWidth = width;
    this.logicalHeight = height;

    this.groundY = Math.round(height - Math.max(105, height * 0.23));
    this.cat.baseY = this.groundY - 44;
    if (this.cat.isGrounded) {
      this.cat.y = this.cat.baseY;
      this.cat.vy = 0;
    }
    this.cat.x = Math.max(65, Math.min(130, Math.round(width * 0.2)));
  }

  public resize(width: number, height: number, dpr = window.devicePixelRatio || 1) {
    this.dpr = dpr;
    this.logicalWidth = width;
    this.logicalHeight = height;
    this.canvas.width = Math.round(width * dpr);
    this.canvas.height = Math.round(height * dpr);
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.scale(dpr, dpr);
    this.updateDimensions(width, height);
  }

  public setCustomization(c: PlayerCustomization) {
    this.customization = c;
  }

  public setStage(stageId: StageId) {
    this.stageConfig = STAGES[stageId] || STAGES.living_room;
    this.reset();
  }

  public start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.isPaused = false;
    this.lastTimestamp = performance.now();
    audio.playMeow();
    audio.startBGM();
    this.loop(this.lastTimestamp);
  }

  public pause() {
    this.isPaused = true;
  }

  public resume() {
    if (!this.isRunning) {
      this.start();
      return;
    }
    if (!this.isPaused) return; // Already running, avoid duplicate loop
    this.isPaused = false;
    this.lastTimestamp = performance.now();
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    this.animationFrameId = requestAnimationFrame(this.loop);
  }

  public stop() {
    this.isRunning = false;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  public reset(startingLives: number = 7) {
    this.cat.isGrounded = true;
    this.cat.vy = 0;
    this.updateDimensions();
    this.cat.y = this.cat.baseY;
    this.cat.isDucking = false;
    this.cat.duckTimer = 0;
    this.cat.isPouncing = false;
    this.cat.pounceTimer = 0;
    this.cat.pounceTarget = null;
    this.cat.lives = startingLives;
    this.cat.invincibleTimer = 0;
    this.cat.zoomiesTimer = 0;

    this.currentDistance = 0;
    this.score = 0;
    this.coinsEarnedThisRun = 0;
    this.vacuumDistance = -180;
    this.stageFinished = false;
    this.goalReached = false;
    this.goalObject = null;

    this.entities = [];
    this.particles = [];
    this.spawnCooldown = 0;
    this.bgOffsetX = 0;
    this.midOffsetX = 0;
    this.foreOffsetX = 0;

    // Tutorial Init
    this.isTutorialStage = this.stageConfig.id === 'living_room';
    if (this.isTutorialStage) {
      this.setTutorialStep('intro');
      this.tutorialSpawnedCurrentStep = false;
      this.tutorialTargetEntityId = null;
    } else {
      this.tutorialStep = 'none';
    }

    this.callbacks.onLivesChange(this.cat.lives);
    this.callbacks.onScoreChange(this.score);
    this.callbacks.onCoinsCollected(this.coinsEarnedThisRun);
    this.callbacks.onDistanceChange(0, this.stageConfig.targetDistance);
  }

  public revive(extraLives: number = 3) {
    this.cat.lives = Math.min(this.cat.maxLives, this.cat.lives + extraLives);
    this.cat.invincibleTimer = 2.5;
    this.vacuumDistance = -250;
    this.callbacks.onLivesChange(this.cat.lives);
    this.addFloatingText(this.cat.x + 20, this.cat.y - 20, `+${extraLives} VIDAS! ❤️`, '#EC4899');
    this.resume();
  }

  // --- Tutorial Progression Helpers ---
  private setTutorialStep(step: TutorialStep) {
    this.tutorialStep = step;
    this.tutorialSpawnedCurrentStep = false;

    let title = '';
    let instruction = '';

    switch (step) {
      case 'intro':
        title = '🐾 TUTORIAL: CONTROLES FELINOS';
        instruction = 'Aprenda os movimentos de um dedo só para guiar o gatinho!';
        break;
      case 'jump':
        title = 'PASSO 1: PULAR 📦';
        instruction = 'Toque na tela ou no botão PULAR para saltar sobre a caixa!';
        break;
      case 'duck':
        title = 'PASSO 2: AGACHAR 🛋️';
        instruction = 'Deslize o dedo para baixo (ou aperte Agachar) para passar sob o móvel!';
        break;
      case 'pounce':
        title = 'PASSO 3: DAR O BOTE ⚡';
        instruction = 'Toque na mariposa ou aperte DAR O BOTE na hora certa!';
        break;
      case 'treats':
        title = 'PASSO 4: PETISCO SUPREMO 👑';
        instruction = 'Colete os petiscos e alcance a tigela dourada!';
        break;
      default:
        break;
    }

    if (this.callbacks.onTutorialStepChange) {
      this.callbacks.onTutorialStepChange(step, title, instruction);
    }
  }

  // --- Controls ---
  public jump(): boolean {
    if (!this.isRunning || this.isPaused || this.stageFinished) return false;

    if (this.cat.isDucking) {
      this.cat.isDucking = false;
      this.cat.duckTimer = 0;
    }

    if (this.cat.isGrounded) {
      this.cat.vy = this.cat.jumpForce;
      this.cat.isGrounded = false;
      audio.playJump();
      this.createPuff(this.cat.x + 20, this.cat.baseY + 40, '#D1D5DB');

      // Check tutorial jump step success
      if (this.isTutorialStage && this.tutorialStep === 'jump') {
        const target = this.entities.find((e) => e.id === this.tutorialTargetEntityId);
        if (target && target.x > this.cat.x - 20 && target.x < this.cat.x + 180) {
          this.triggerTutorialSuccess('jump', '✨ ÓTIMO PULO! +50');
        }
      }

      return true;
    }
    return false;
  }

  public duck() {
    if (!this.isRunning || this.isPaused || this.stageFinished) return;

    this.cat.isDucking = true;
    this.cat.duckTimer = 0.7;

    if (!this.cat.isGrounded) {
      this.cat.vy = Math.max(this.cat.vy, 450);
    }
    audio.playSlide();
    this.createPuff(this.cat.x + 10, this.cat.baseY + 40, '#D1D5DB');

    // Check tutorial duck step success
    if (this.isTutorialStage && this.tutorialStep === 'duck') {
      const target = this.entities.find((e) => e.id === this.tutorialTargetEntityId);
      if (target && target.x > this.cat.x - 30 && target.x < this.cat.x + 220) {
        this.triggerTutorialSuccess('duck', '💨 DESLIZE PERFEITO! +50');
      }
    }
  }

  public pounce(targetEntity?: Entity): boolean {
    if (!this.isRunning || this.isPaused || this.stageFinished) return false;

    let target = targetEntity;
    if (!target) {
      const pounceCandidates = this.entities.filter(
        (e) => e.isPounceable && !e.collected && e.x > this.cat.x - 40 && e.x < this.cat.x + 300
      );
      if (pounceCandidates.length > 0) {
        pounceCandidates.sort((a, b) => Math.abs(a.x - this.cat.x) - Math.abs(b.x - this.cat.x));
        target = pounceCandidates[0];
      }
    }

    this.cat.isPouncing = true;
    this.cat.pounceTimer = 0.45;
    this.cat.pounceTarget = target || null;
    this.cat.vy = -380;
    this.cat.isGrounded = false;
    audio.playPounce();

    if (target) {
      this.executePounceCatch(target);
      if (this.isTutorialStage && this.tutorialStep === 'pounce') {
        this.triggerTutorialSuccess('pounce', '⚡ BOTE MAGISTRAL! +100');
      }
      return true;
    } else {
      this.addFloatingText(this.cat.x + 40, this.cat.y - 10, 'BOTE! 🐾', '#F59E0B');
      return true;
    }
  }

  private triggerTutorialSuccess(fromStep: TutorialStep, feedback: string) {
    audio.playCollect();
    audio.playMeow();
    this.score += fromStep === 'pounce' ? 100 : 50;
    this.callbacks.onScoreChange(this.score);
    this.addFloatingText(this.cat.x + 20, this.cat.y - 35, feedback, '#10B981', 22);

    setTimeout(() => {
      if (fromStep === 'jump') this.setTutorialStep('duck');
      else if (fromStep === 'duck') this.setTutorialStep('pounce');
      else if (fromStep === 'pounce') this.setTutorialStep('treats');
    }, 700);
  }

  public handleCanvasClick(clickX: number, clickY: number): boolean {
    if (!this.isRunning || this.isPaused || this.stageFinished) return false;

    for (const ent of this.entities) {
      if (ent.isPounceable && !ent.collected) {
        const dx = clickX - (ent.x + ent.width / 2);
        const dy = clickY - (ent.y + ent.height / 2);
        const dist = Math.hypot(dx, dy);
        if (dist <= Math.max(ent.width, ent.height) + 36) {
          this.pounce(ent);
          return true;
        }
      }
    }

    const canvasHeight = this.logicalHeight || (this.canvas.height / (this.dpr || 1));
    if (clickY > canvasHeight * 0.72) {
      this.duck();
    } else {
      this.jump();
    }
    return true;
  }

  private executePounceCatch(target: Entity) {
    target.collected = true;
    const bonus = target.points * 2;
    this.score += bonus;
    this.coinsEarnedThisRun += target.type === 'laser_dot' ? 5 : 3;
    this.callbacks.onScoreChange(this.score);
    this.callbacks.onCoinsCollected(this.coinsEarnedThisRun);
    this.callbacks.onPounceSuccess(bonus, target.type);

    if (target.type === 'laser_dot') {
      audio.playLaserChime();
      this.addFloatingText(target.x, target.y - 15, `PEGOU O LASER! +${bonus} 🔴`, '#EF4444', 24);
    } else {
      this.addFloatingText(target.x, target.y - 15, `BOTE PERFEITO! +${bonus}`, '#EC4899', 24);
    }

    for (let i = 0; i < 14; i++) {
      this.particles.push({
        x: target.x + target.width / 2,
        y: target.y + target.height / 2,
        vx: (Math.random() - 0.5) * 260,
        vy: (Math.random() - 0.5) * 260,
        color: ['#F59E0B', '#EC4899', '#38BDF8', '#FDE047', '#EF4444'][Math.floor(Math.random() * 5)],
        size: Math.random() * 5 + 3,
        alpha: 1,
        decay: 1.8,
      });
    }
  }

  // --- Game Loop ---
  private loop = (timestamp: number) => {
    if (!this.isRunning || this.isPaused) return;

    const dt = Math.min((timestamp - this.lastTimestamp) / 1000, 0.1);
    this.lastTimestamp = timestamp;

    this.update(dt);
    this.render();

    this.animationFrameId = requestAnimationFrame(this.loop);
  };

  private update(dt: number) {
    if (this.stageFinished) {
      this.cat.runCycle += dt * 4;
      if (this.goalObject && this.cat.x < this.goalObject.x + 10) {
        this.cat.x += 120 * dt;
      }
      return;
    }

    let currentSpeed = this.stageConfig.speed;
    if (this.cat.zoomiesTimer > 0) {
      this.cat.zoomiesTimer -= dt;
      currentSpeed *= 1.35;
      this.createPuff(this.cat.x, this.cat.y + 20, '#F472B6');
    }

    const distDelta = currentSpeed * dt * 0.5;
    this.currentDistance += distDelta;
    this.callbacks.onDistanceChange(Math.floor(this.currentDistance), this.stageConfig.targetDistance);

    const width = this.logicalWidth || (this.canvas.width / (this.dpr || 1));
    this.bgOffsetX = (this.bgOffsetX + currentSpeed * dt * 0.15) % width;
    this.midOffsetX = (this.midOffsetX + currentSpeed * dt * 0.45) % width;
    this.foreOffsetX = (this.foreOffsetX + currentSpeed * dt) % width;

    this.cat.runCycle += dt * (currentSpeed / 28);

    if (this.cat.invincibleTimer > 0) {
      this.cat.invincibleTimer -= dt;
    }

    if (this.cat.isDucking) {
      this.cat.duckTimer -= dt;
      if (this.cat.duckTimer <= 0) {
        this.cat.isDucking = false;
      }
    }

    if (this.cat.isPouncing) {
      this.cat.pounceTimer -= dt;
      if (this.cat.pounceTimer <= 0) {
        this.cat.isPouncing = false;
        this.cat.pounceTarget = null;
      }
    }

    // Vertical Jump & Gravity
    if (!this.cat.isGrounded) {
      this.cat.vy += this.cat.gravity * dt;
      this.cat.y += this.cat.vy * dt;

      if (this.cat.y >= this.cat.baseY) {
        this.cat.y = this.cat.baseY;
        this.cat.vy = 0;
        this.cat.isGrounded = true;
      }
    } else {
      this.cat.y = this.cat.baseY;
      this.cat.vy = 0;
    }

    // Tutorial Flow or Standard Goal Check
    if (this.isTutorialStage) {
      this.updateTutorialFlow(dt, currentSpeed);
    } else {
      if (this.currentDistance >= this.stageConfig.targetDistance && !this.goalReached) {
        this.goalReached = true;
        this.goalObject = {
          x: width + 100,
          y: this.cat.baseY + 8,
          reached: false,
        };
      }
      this.updateSpawning(dt, currentSpeed);
    }

    if (this.goalObject) {
      this.goalObject.x -= currentSpeed * dt;
      if (this.goalObject.x <= this.cat.x + 35 && !this.stageFinished) {
        this.finishStage();
      }
    }

    // Vacuum cleaner logic in Garden and Mansion stages
    if (this.stageConfig.id === 'garden' || this.stageConfig.id === 'mansion') {
      if (this.cat.zoomiesTimer > 0) {
        this.vacuumDistance = Math.max(-200, this.vacuumDistance - 40 * dt);
      } else {
        this.vacuumDistance += (this.stageConfig.id === 'mansion' ? 16 : 12) * dt;
      }

      if (this.vacuumDistance > -130 && Math.random() < 0.03) {
        audio.playVacuumPulse();
      }

      if (this.vacuumDistance > this.cat.x - 40 && this.cat.invincibleTimer <= 0) {
        this.takeDamage('vacuum');
        this.vacuumDistance = -120;
      }
    }

    this.updateEntities(dt, currentSpeed);
    this.updateParticles(dt);
  }

  // Tutorial Flow
  private updateTutorialFlow(dt: number, currentSpeed: number) {
    const width = this.logicalWidth || (this.canvas.width / (this.dpr || 1));
    const spawnX = width + 50;
    const groundY = this.cat.baseY;

    if (this.tutorialStep === 'intro') {
      if (this.currentDistance > 35) {
        this.setTutorialStep('jump');
      }
    } else if (this.tutorialStep === 'jump') {
      if (!this.tutorialSpawnedCurrentStep) {
        this.tutorialSpawnedCurrentStep = true;
        const boxId = this.nextEntityId++;
        this.tutorialTargetEntityId = boxId;
        this.entities.push({
          id: boxId,
          type: 'cardboard_box',
          x: spawnX + 40,
          y: groundY + 4,
          width: 48,
          height: 44,
          vx: 0,
          vy: 0,
          isCollectible: false,
          isPounceable: false,
          isHighObstacle: false,
          isLowObstacle: true,
          points: 0,
          specialAction: 'jump',
        });
      }
    } else if (this.tutorialStep === 'duck') {
      if (!this.tutorialSpawnedCurrentStep) {
        this.tutorialSpawnedCurrentStep = true;
        const shelfId = this.nextEntityId++;
        this.tutorialTargetEntityId = shelfId;
        this.entities.push({
          id: shelfId,
          type: 'low_shelf',
          x: spawnX + 40,
          y: groundY - 44,
          width: 90,
          height: 52,
          vx: 0,
          vy: 0,
          isCollectible: false,
          isPounceable: false,
          isHighObstacle: true,
          isLowObstacle: false,
          points: 0,
          specialAction: 'duck',
        });
      }
    } else if (this.tutorialStep === 'pounce') {
      if (!this.tutorialSpawnedCurrentStep) {
        this.tutorialSpawnedCurrentStep = true;
        const mothId = this.nextEntityId++;
        this.tutorialTargetEntityId = mothId;
        this.entities.push({
          id: mothId,
          type: 'insect',
          x: spawnX + 60,
          y: groundY - 55,
          width: 36,
          height: 36,
          vx: -15,
          vy: 0,
          isCollectible: false,
          isPounceable: true,
          isHighObstacle: false,
          isLowObstacle: false,
          points: 60,
          glow: true,
          specialAction: 'pounce',
        });
      }
    } else if (this.tutorialStep === 'treats') {
      if (!this.goalReached) {
        this.spawnCollectible(spawnX + 20);
        this.spawnCollectible(spawnX + 90);
        this.goalReached = true;
        this.goalObject = {
          x: spawnX + 220,
          y: this.cat.baseY + 8,
          reached: false,
        };
      }
    }
  }

  private updateSpawning(dt: number, currentSpeed: number) {
    if (this.goalReached) return;

    this.spawnCooldown -= dt;
    if (this.spawnCooldown <= 0) {
      this.spawnCooldown = Math.max(0.75, 1.6 - (this.currentDistance / this.stageConfig.targetDistance) * 0.6);
      this.spawnRandomPattern();
    }
  }

  private spawnRandomPattern() {
    const stageId = this.stageConfig.id;
    const width = this.logicalWidth || (this.canvas.width / (this.dpr || 1));
    const spawnX = width + 50;
    const groundY = this.cat.baseY;

    // Snack treats on path
    if (Math.random() < 0.45) {
      this.spawnCollectible(spawnX + 40);
    }

    // 1. TREAT RUSH
    if (stageId === 'treat_rush') {
      const treatType: ObstacleType = Math.random() < 0.4 ? 'treat_golden_tuna' : 'treat_sachet';
      const floatingY = groundY - 20 - Math.random() * 90;
      this.entities.push({
        id: this.nextEntityId++,
        type: treatType,
        x: spawnX,
        y: floatingY,
        width: 38,
        height: 38,
        vx: 0,
        vy: 0,
        isCollectible: true,
        isPounceable: false,
        isHighObstacle: false,
        isLowObstacle: false,
        points: treatType === 'treat_golden_tuna' ? 200 : 50,
        glow: true,
      });
      if (Math.random() < 0.25) {
        this.entities.push({
          id: this.nextEntityId++,
          type: 'catnip',
          x: spawnX + 80,
          y: groundY + 8,
          width: 32,
          height: 32,
          vx: 0,
          vy: 0,
          isCollectible: true,
          isPounceable: false,
          isHighObstacle: false,
          isLowObstacle: false,
          points: 100,
        });
      }
      return;
    }

    // 2. KITCHEN
    if (stageId === 'kitchen') {
      const roll = Math.random();
      if (roll < 0.38) {
        this.entities.push({
          id: this.nextEntityId++,
          type: 'low_shelf',
          x: spawnX,
          y: groundY - 45,
          width: 90,
          height: 52,
          vx: 0,
          vy: 0,
          isCollectible: false,
          isPounceable: false,
          isHighObstacle: true,
          isLowObstacle: false,
          points: 0,
          specialAction: 'duck',
        });
      } else if (roll < 0.68) {
        this.entities.push({
          id: this.nextEntityId++,
          type: 'mouse',
          x: spawnX,
          y: groundY + 14,
          width: 38,
          height: 24,
          vx: -50,
          vy: 0,
          isCollectible: false,
          isPounceable: true,
          isHighObstacle: false,
          isLowObstacle: true,
          points: 50,
          specialAction: 'jump',
        });
      } else {
        this.entities.push({
          id: this.nextEntityId++,
          type: 'insect',
          x: spawnX,
          y: groundY - 50 - Math.random() * 40,
          width: 34,
          height: 34,
          vx: -20,
          vy: 0,
          isCollectible: false,
          isPounceable: true,
          isHighObstacle: false,
          isLowObstacle: false,
          points: 60,
          specialAction: 'pounce',
        });
      }
      return;
    }

    // 3. BATHROOM (O Terror da Água! Borrifador, Poça de Sabão, Secador)
    if (stageId === 'bathroom') {
      const roll = Math.random();
      if (roll < 0.38) {
        // Borrifador de Água no ar (Duck!)
        this.entities.push({
          id: this.nextEntityId++,
          type: 'water_spray',
          x: spawnX,
          y: groundY - 48,
          width: 65,
          height: 48,
          vx: 0,
          vy: 0,
          isCollectible: false,
          isPounceable: false,
          isHighObstacle: true,
          isLowObstacle: false,
          points: 0,
          specialAction: 'duck',
        });
        audio.playWaterSpritz();
      } else if (roll < 0.72) {
        // Poça de Sabão escorregadia no chão (Jump!)
        this.entities.push({
          id: this.nextEntityId++,
          type: 'soap_puddle',
          x: spawnX,
          y: groundY + 18,
          width: 60,
          height: 24,
          vx: 0,
          vy: 0,
          isCollectible: false,
          isPounceable: false,
          isHighObstacle: false,
          isLowObstacle: true,
          points: 0,
          specialAction: 'jump',
        });
      } else {
        // Secador de Cabelo soprando vento (Duck!)
        this.entities.push({
          id: this.nextEntityId++,
          type: 'hair_dryer',
          x: spawnX,
          y: groundY - 50,
          width: 68,
          height: 46,
          vx: 0,
          vy: 0,
          isCollectible: false,
          isPounceable: false,
          isHighObstacle: true,
          isLowObstacle: false,
          points: 0,
          specialAction: 'duck',
        });
      }
      return;
    }

    // 4. HALLWAY (Corredor das Vassouras & Pepinos!)
    if (stageId === 'hallway') {
      const roll = Math.random();
      if (roll < 0.42) {
        // Vassoura varrendo (Jump!)
        this.entities.push({
          id: this.nextEntityId++,
          type: 'broom',
          x: spawnX,
          y: groundY - 4,
          width: 50,
          height: 52,
          vx: 0,
          vy: 0,
          isCollectible: false,
          isPounceable: false,
          isHighObstacle: false,
          isLowObstacle: true,
          points: 0,
          specialAction: 'jump',
        });
      } else if (roll < 0.78) {
        // O famoso Pepino da Surpresa no chão! (Jump!)
        this.entities.push({
          id: this.nextEntityId++,
          type: 'cucumber',
          x: spawnX,
          y: groundY + 14,
          width: 44,
          height: 26,
          vx: 0,
          vy: 0,
          isCollectible: false,
          isPounceable: false,
          isHighObstacle: false,
          isLowObstacle: true,
          points: 0,
          specialAction: 'jump',
        });
      } else {
        // Ratinho veloz do corredor
        this.entities.push({
          id: this.nextEntityId++,
          type: 'mouse',
          x: spawnX,
          y: groundY + 14,
          width: 38,
          height: 24,
          vx: -55,
          vy: 0,
          isCollectible: false,
          isPounceable: true,
          isHighObstacle: false,
          isLowObstacle: true,
          points: 50,
          specialAction: 'jump',
        });
      }
      return;
    }

    // 5. BEDROOM (Quarto & O Robô Aspirador Roombinha)
    if (stageId === 'bedroom') {
      const roll = Math.random();
      if (roll < 0.45) {
        // Aspirador Robô patrulhando o chão com LED azul
        this.entities.push({
          id: this.nextEntityId++,
          type: 'robot_vacuum',
          x: spawnX,
          y: groundY + 8,
          width: 52,
          height: 36,
          vx: -35,
          vy: 0,
          isCollectible: false,
          isPounceable: false,
          isHighObstacle: false,
          isLowObstacle: true,
          points: 0,
          specialAction: 'jump',
        });
        audio.playRoombAlert();
      } else if (roll < 0.75) {
        // Laser vermelho veloz saltitando (Pounce target bônus!)
        this.entities.push({
          id: this.nextEntityId++,
          type: 'laser_dot',
          x: spawnX,
          y: groundY - 30 - Math.random() * 55,
          width: 30,
          height: 30,
          vx: -75,
          vy: 0,
          isCollectible: false,
          isPounceable: true,
          isHighObstacle: false,
          isLowObstacle: false,
          points: 150,
          glow: true,
          specialAction: 'pounce',
        });
      } else {
        // Mariposa de abajur
        this.entities.push({
          id: this.nextEntityId++,
          type: 'insect',
          x: spawnX,
          y: groundY - 50,
          width: 34,
          height: 34,
          vx: -20,
          vy: 0,
          isCollectible: false,
          isPounceable: true,
          isHighObstacle: false,
          isLowObstacle: false,
          points: 60,
          specialAction: 'pounce',
        });
      }
      return;
    }

    // 6. ATTIC (O Sótão Misterioso: Teias, Rato Ninja, Traças Noturnas)
    if (stageId === 'attic') {
      const roll = Math.random();
      if (roll < 0.42) {
        // Teias de aranha e vassourão suspenso (Duck!)
        this.entities.push({
          id: this.nextEntityId++,
          type: 'low_shelf',
          x: spawnX,
          y: groundY - 45,
          width: 90,
          height: 52,
          vx: 0,
          vy: 0,
          isCollectible: false,
          isPounceable: false,
          isHighObstacle: true,
          isLowObstacle: false,
          points: 0,
          specialAction: 'duck',
        });
      } else if (roll < 0.74) {
        // Rato Ninja ultra rápido!
        this.entities.push({
          id: this.nextEntityId++,
          type: 'mouse',
          x: spawnX,
          y: groundY + 14,
          width: 38,
          height: 24,
          vx: -85,
          vy: 0,
          isCollectible: false,
          isPounceable: true,
          isHighObstacle: false,
          isLowObstacle: true,
          points: 80,
          specialAction: 'jump',
        });
      } else {
        // Traça noturna gigante
        this.entities.push({
          id: this.nextEntityId++,
          type: 'insect',
          x: spawnX,
          y: groundY - 60,
          width: 36,
          height: 36,
          vx: -25,
          vy: 0,
          isCollectible: false,
          isPounceable: true,
          isHighObstacle: false,
          isLowObstacle: false,
          points: 75,
          specialAction: 'pounce',
        });
      }
      return;
    }

    // 7. GARDEN
    if (stageId === 'garden') {
      const roll = Math.random();
      if (roll < 0.4) {
        this.entities.push({
          id: this.nextEntityId++,
          type: 'swooping_bird',
          x: spawnX,
          y: groundY - 80,
          width: 42,
          height: 36,
          vx: -80,
          vy: 40,
          isCollectible: false,
          isPounceable: true,
          isHighObstacle: true,
          isLowObstacle: false,
          points: 100,
          specialAction: 'pounce',
        });
      } else if (roll < 0.72) {
        this.entities.push({
          id: this.nextEntityId++,
          type: 'dog',
          x: spawnX,
          y: groundY - 10,
          width: 62,
          height: 58,
          vx: 0,
          vy: 0,
          isCollectible: false,
          isPounceable: false,
          isHighObstacle: false,
          isLowObstacle: true,
          points: 0,
          specialAction: 'jump',
        });
        audio.playBark();
      } else {
        this.entities.push({
          id: this.nextEntityId++,
          type: 'insect',
          x: spawnX,
          y: groundY - 60,
          width: 34,
          height: 34,
          vx: -20,
          vy: 0,
          isCollectible: false,
          isPounceable: true,
          isHighObstacle: false,
          isLowObstacle: false,
          points: 60,
          specialAction: 'pounce',
        });
      }
      return;
    }

    // 8. MANSION (Desafio Supremo: todos os medos juntos!)
    if (stageId === 'mansion') {
      const roll = Math.random();
      if (roll < 0.22) {
        // Robô aspirador
        this.entities.push({
          id: this.nextEntityId++,
          type: 'robot_vacuum',
          x: spawnX,
          y: groundY + 8,
          width: 52,
          height: 36,
          vx: -40,
          vy: 0,
          isCollectible: false,
          isPounceable: false,
          isHighObstacle: false,
          isLowObstacle: true,
          points: 0,
          specialAction: 'jump',
        });
      } else if (roll < 0.44) {
        // Borrifador de água
        this.entities.push({
          id: this.nextEntityId++,
          type: 'water_spray',
          x: spawnX,
          y: groundY - 48,
          width: 65,
          height: 48,
          vx: 0,
          vy: 0,
          isCollectible: false,
          isPounceable: false,
          isHighObstacle: true,
          isLowObstacle: false,
          points: 0,
          specialAction: 'duck',
        });
      } else if (roll < 0.64) {
        // Vassoura
        this.entities.push({
          id: this.nextEntityId++,
          type: 'broom',
          x: spawnX,
          y: groundY - 4,
          width: 50,
          height: 52,
          vx: 0,
          vy: 0,
          isCollectible: false,
          isPounceable: false,
          isHighObstacle: false,
          isLowObstacle: true,
          points: 0,
          specialAction: 'jump',
        });
      } else if (roll < 0.82) {
        // Pepino surpresa
        this.entities.push({
          id: this.nextEntityId++,
          type: 'cucumber',
          x: spawnX,
          y: groundY + 14,
          width: 44,
          height: 26,
          vx: 0,
          vy: 0,
          isCollectible: false,
          isPounceable: false,
          isHighObstacle: false,
          isLowObstacle: true,
          points: 0,
          specialAction: 'jump',
        });
      } else {
        // Laser dot bônus
        this.entities.push({
          id: this.nextEntityId++,
          type: 'laser_dot',
          x: spawnX,
          y: groundY - 40,
          width: 30,
          height: 30,
          vx: -80,
          vy: 0,
          isCollectible: false,
          isPounceable: true,
          isHighObstacle: false,
          isLowObstacle: false,
          points: 150,
          glow: true,
          specialAction: 'pounce',
        });
      }
    }
  }

  private spawnCollectible(x: number) {
    const isSachet = Math.random() < 0.3;
    const yOffset = Math.random() < 0.5 ? 12 : -50;
    this.entities.push({
      id: this.nextEntityId++,
      type: isSachet ? 'treat_sachet' : 'treat_kibble',
      x,
      y: this.cat.baseY + yOffset,
      width: isSachet ? 30 : 22,
      height: isSachet ? 30 : 22,
      vx: 0,
      vy: 0,
      isCollectible: true,
      isPounceable: false,
      isHighObstacle: false,
      isLowObstacle: false,
      points: isSachet ? 25 : 10,
    });
  }

  private updateEntities(dt: number, currentSpeed: number) {
    const catBox = this.getCatHitbox();

    for (let i = this.entities.length - 1; i >= 0; i--) {
      const e = this.entities[i];
      e.x -= (currentSpeed + (e.vx ? -e.vx : 0)) * dt;
      if (e.vy) {
        e.y += e.vy * dt;
        if (e.type === 'swooping_bird' && e.y > this.cat.baseY - 20) {
          e.vy = -e.vy;
        }
      }

      if (e.x < -120) {
        if (this.isTutorialStage && e.id === this.tutorialTargetEntityId && !e.collected) {
          this.tutorialSpawnedCurrentStep = false;
        }
        this.entities.splice(i, 1);
        continue;
      }

      if (!e.collected && !e.hit) {
        const entBox = {
          x: e.x + 4,
          y: e.y + 4,
          width: e.width - 8,
          height: e.height - 8,
        };

        if (this.checkAABB(catBox, entBox)) {
          if (e.isCollectible) {
            e.collected = true;
            this.handleCollect(e);
          } else if (e.isPounceable && this.cat.isPouncing) {
            e.collected = true;
            this.executePounceCatch(e);
            if (this.isTutorialStage && this.tutorialStep === 'pounce') {
              this.triggerTutorialSuccess('pounce', '⚡ BOTE MAGISTRAL! +100');
            }
          } else {
            // Harmful collision
            if (this.cat.invincibleTimer <= 0) {
              e.hit = true;
              if (this.isTutorialStage) {
                audio.playHit();
                this.cat.invincibleTimer = 1.4;
                if (e.specialAction === 'jump') {
                  this.addFloatingText(this.cat.x + 20, this.cat.y - 25, 'Ops! Toque para PULAR!', '#F59E0B', 20);
                } else if (e.specialAction === 'duck') {
                  this.addFloatingText(this.cat.x + 20, this.cat.y - 25, 'Ops! Deslize para baixo!', '#F59E0B', 20);
                }
                setTimeout(() => {
                  this.tutorialSpawnedCurrentStep = false;
                }, 800);
              } else {
                this.takeDamage(e.type);
              }
            }
          }
        }
      }
    }
  }

  private handleCollect(e: Entity) {
    audio.playCollect();
    this.score += e.points;
    this.coinsEarnedThisRun += e.type === 'treat_golden_tuna' ? 10 : (e.type === 'treat_sachet' ? 2 : 1);
    this.callbacks.onScoreChange(this.score);
    this.callbacks.onCoinsCollected(this.coinsEarnedThisRun);

    if (e.type === 'catnip') {
      this.cat.zoomiesTimer = 5.0;
      this.addFloatingText(this.cat.x + 30, this.cat.y - 30, 'ZOOMIES! ⚡⚡', '#10B981', 22);
    } else {
      this.addFloatingText(e.x, e.y - 10, `+${e.points}`, '#F59E0B');
    }

    for (let p = 0; p < 6; p++) {
      this.particles.push({
        x: e.x + e.width / 2,
        y: e.y + e.height / 2,
        vx: (Math.random() - 0.5) * 120,
        vy: (Math.random() - 0.5) * 120,
        color: '#FDE047',
        size: Math.random() * 4 + 2,
        alpha: 1,
        decay: 2.2,
      });
    }
  }

  private takeDamage(source: string) {
    this.cat.lives -= 1;
    this.cat.invincibleTimer = 1.6;
    audio.playHit();
    this.callbacks.onLivesChange(this.cat.lives);

    let hurtMsg = '-1 VIDA! 💔';
    if (source === 'cucumber') hurtMsg = 'SUSTO DO PEPINO! 🥒';
    else if (source === 'water_spray') hurtMsg = 'MOLHOU O PELO! 🚿';
    else if (source === 'broom') hurtMsg = 'VARREU O GATO! 🧹';
    else if (source === 'robot_vacuum') hurtMsg = 'ROBÔ ATROPELOU! 🤖';

    this.addFloatingText(this.cat.x + 20, this.cat.y - 25, hurtMsg, '#EF4444', 20);

    for (let i = 0; i < 8; i++) {
      this.particles.push({
        x: this.cat.x + 25,
        y: this.cat.y + 15,
        vx: (Math.random() - 0.5) * 180,
        vy: (Math.random() - 0.5) * 180,
        color: '#EF4444',
        size: Math.random() * 5 + 3,
        alpha: 1,
        decay: 2.0,
      });
    }

    if (this.cat.lives <= 0) {
      this.handleGameOver();
    }
  }

  private handleGameOver() {
    this.pause();
    this.callbacks.onGameOver(this.score, this.coinsEarnedThisRun);
  }

  private finishStage() {
    this.stageFinished = true;
    audio.playVictory();
    audio.playMeow();
    const finalBonus = this.cat.lives * 100;
    this.score += finalBonus;
    this.coinsEarnedThisRun += this.stageConfig.coinReward || 15;
    this.callbacks.onScoreChange(this.score);
    this.callbacks.onCoinsCollected(this.coinsEarnedThisRun);

    const victoryMsg = this.isTutorialStage ? 'TUTORIAL CONCLUÍDO! 🎓' : 'FASE CONCLUÍDA! 🎉';
    this.addFloatingText(this.cat.x + 20, this.cat.y - 40, victoryMsg, '#10B981', 26);

    setTimeout(() => {
      this.callbacks.onStageComplete(this.score, this.coinsEarnedThisRun, this.cat.lives);
    }, 1400);
  }

  private getCatHitbox() {
    const isDuck = this.cat.isDucking;
    return {
      x: this.cat.x + 10,
      y: isDuck ? this.cat.y + 20 : this.cat.y + 4,
      width: this.cat.width - 18,
      height: isDuck ? this.cat.duckHeight : this.cat.height - 8,
    };
  }

  private checkAABB(
    r1: { x: number; y: number; width: number; height: number },
    r2: { x: number; y: number; width: number; height: number }
  ): boolean {
    return (
      r1.x < r2.x + r2.width &&
      r1.x + r1.width > r2.x &&
      r1.y < r2.y + r2.height &&
      r1.y + r1.height > r2.y
    );
  }

  private updateParticles(dt: number) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.alpha -= p.decay * dt;
      if (p.alpha <= 0) {
        this.particles.splice(i, 1);
      }
    }
  }

  private addFloatingText(x: number, y: number, text: string, color: string, size: number = 18) {
    this.particles.push({
      x,
      y,
      vx: 0,
      vy: -55,
      color,
      size,
      alpha: 1,
      decay: 0.9,
      text,
    });
  }

  private createPuff(x: number, y: number, color: string) {
    for (let i = 0; i < 3; i++) {
      this.particles.push({
        x: x + (Math.random() - 0.5) * 10,
        y: y + (Math.random() - 0.5) * 4,
        vx: -60 - Math.random() * 50,
        vy: -15 - Math.random() * 20,
        color,
        size: Math.random() * 4 + 3,
        alpha: 0.7,
        decay: 1.8,
      });
    }
  }

  // --- Rendering ---
  public render() {
    const { ctx, canvas } = this;
    const width = this.logicalWidth || (canvas.width / (this.dpr || 1));
    const height = this.logicalHeight || (canvas.height / (this.dpr || 1));

    ctx.clearRect(0, 0, width, height);

    this.renderParallaxBackground(width, height);
    this.renderGround(width, height);
    this.renderEntities();

    if (this.goalObject) {
      this.renderGoalBowl(this.goalObject.x, this.goalObject.y);
    }

    if ((this.stageConfig.id === 'garden' || this.stageConfig.id === 'mansion') && this.vacuumDistance > -170) {
      this.renderVacuumCleaner(this.vacuumDistance, this.cat.baseY - 10);
    }

    this.renderCat();

    if (this.isTutorialStage) {
      this.renderTutorialOverlay(width, height);
    }

    this.renderParticles();
  }

  private renderTutorialOverlay(w: number, h: number) {
    const { ctx } = this;
    const groundY = this.groundY;

    ctx.save();

    if (this.tutorialStep === 'jump') {
      const target = this.entities.find((e) => e.id === this.tutorialTargetEntityId);
      if (target && target.x > this.cat.x) {
        const bounce = Math.sin(Date.now() / 150) * 8;
        ctx.fillStyle = '#EF4444';
        ctx.font = 'bold 13px Fredoka, cursive';
        ctx.textAlign = 'center';
        ctx.fillText('PULAR! ⬆️', target.x + target.width / 2, target.y - 18 + bounce);

        ctx.strokeStyle = 'rgba(239, 68, 68, 0.5)';
        ctx.lineWidth = 2.5;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(this.cat.x + 30, groundY);
        ctx.quadraticCurveTo((this.cat.x + target.x) / 2, groundY - 90, target.x + target.width + 40, groundY);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    } else if (this.tutorialStep === 'duck') {
      const target = this.entities.find((e) => e.id === this.tutorialTargetEntityId);
      if (target && target.x > this.cat.x) {
        const bounce = Math.sin(Date.now() / 150) * 6;
        ctx.fillStyle = '#3B82F6';
        ctx.font = 'bold 13px Fredoka, cursive';
        ctx.textAlign = 'center';
        ctx.fillText('DESLIZAR! ⬇️', target.x + target.width / 2, target.y + target.height + 22 + bounce);

        ctx.strokeStyle = 'rgba(59, 130, 246, 0.6)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(target.x - 20, groundY);
        ctx.lineTo(target.x + target.width + 20, groundY);
        ctx.stroke();
      }
    } else if (this.tutorialStep === 'pounce') {
      const target = this.entities.find((e) => e.id === this.tutorialTargetEntityId);
      if (target && !target.collected) {
        const pulse = 1 + Math.sin(Date.now() / 100) * 0.2;
        ctx.strokeStyle = '#EC4899';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(target.x + target.width / 2, target.y + target.height / 2, 28 * pulse, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = '#EC4899';
        ctx.font = 'bold 12px Fredoka, cursive';
        ctx.textAlign = 'center';
        ctx.fillText('BOTE AQUI! 🎯', target.x + target.width / 2, target.y - 20);
      }
    }

    ctx.restore();
  }

  private renderParallaxBackground(w: number, h: number) {
    const { ctx } = this;
    const stageId = this.stageConfig.id;
    const groundY = this.groundY;

    if (stageId === 'living_room') {
      const grad = ctx.createLinearGradient(0, 0, 0, groundY);
      grad.addColorStop(0, '#FEF3C7');
      grad.addColorStop(1, '#FDE68A');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, groundY);

      ctx.fillStyle = 'rgba(245, 158, 11, 0.07)';
      for (let x = -this.bgOffsetX % 50; x < w; x += 50) {
        ctx.fillRect(x, 0, 25, groundY);
      }

      ctx.fillStyle = '#92400E';
      ctx.fillRect(0, 0, w, 8);
      ctx.fillStyle = '#B45309';
      ctx.fillRect(0, 8, w, 4);

      const lampSpacing = Math.max(260, w * 0.65);
      for (let x = -this.midOffsetX % lampSpacing; x < w; x += lampSpacing) {
        ctx.strokeStyle = '#78350F';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x + 80, 0);
        ctx.lineTo(x + 80, 50);
        ctx.stroke();

        ctx.fillStyle = '#F59E0B';
        ctx.beginPath();
        ctx.arc(x + 80, 56, 18, Math.PI, 0);
        ctx.fill();

        const frameY = Math.max(30, groundY * 0.28);
        ctx.fillStyle = '#FBBF24';
        ctx.fillRect(x + 170, frameY, 48, 38);
        ctx.fillStyle = '#78350F';
        ctx.fillRect(x + 174, frameY + 4, 40, 30);
      }
    } else if (stageId === 'kitchen') {
      const grad = ctx.createLinearGradient(0, 0, 0, groundY);
      grad.addColorStop(0, '#F0F9FF');
      grad.addColorStop(1, '#E0F2FE');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, groundY);

      ctx.strokeStyle = 'rgba(186, 230, 253, 0.45)';
      ctx.lineWidth = 1;
      for (let y = 0; y < groundY; y += 36) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }
      for (let x = -this.bgOffsetX % 36; x < w; x += 36) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, groundY);
        ctx.stroke();
      }

      const kitchenSpacing = Math.max(320, w * 0.75);
      for (let x = -this.midOffsetX % kitchenSpacing; x < w; x += kitchenSpacing) {
        ctx.fillStyle = '#CBD5E1';
        ctx.fillRect(x + 20, 10, 110, 50);
        ctx.fillStyle = '#CBD5E1';
        ctx.fillRect(x + 180, groundY - 170, 75, 170);
      }
    } else if (stageId === 'bathroom') {
      // Banheiro: azulejos menta/turquesa e espelho com vapor
      const grad = ctx.createLinearGradient(0, 0, 0, groundY);
      grad.addColorStop(0, '#E0F2FE');
      grad.addColorStop(1, '#A5F3FC');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, groundY);

      // Linhas de azulejo
      ctx.strokeStyle = 'rgba(103, 232, 249, 0.4)';
      ctx.lineWidth = 1;
      for (let y = 0; y < groundY; y += 32) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      // Espelho e banheira no midground
      for (let x = -this.midOffsetX % 360; x < w; x += 360) {
        // Espelho oval com vapor
        ctx.fillStyle = '#CFFAFE';
        ctx.strokeStyle = '#0891B2';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.ellipse(x + 120, groundY * 0.35, 40, 55, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Toalheiro e toalha azul
        ctx.fillStyle = '#64748B';
        ctx.fillRect(x + 240, groundY * 0.3, 50, 6);
        ctx.fillStyle = '#38BDF8';
        ctx.fillRect(x + 246, groundY * 0.3 + 6, 38, 70);
      }
    } else if (stageId === 'hallway') {
      // Corredor: lambril e arandelas elegantes
      const grad = ctx.createLinearGradient(0, 0, 0, groundY);
      grad.addColorStop(0, '#FEF9C3');
      grad.addColorStop(1, '#FDE047');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, groundY);

      for (let x = -this.midOffsetX % 300; x < w; x += 300) {
        // Porta branca no corredor
        ctx.fillStyle = '#F8FAFC';
        ctx.fillRect(x + 60, groundY - 180, 80, 180);
        ctx.strokeStyle = '#D97706';
        ctx.lineWidth = 3;
        ctx.strokeRect(x + 60, groundY - 180, 80, 180);
        // Maçaneta dourada
        ctx.fillStyle = '#F59E0B';
        ctx.beginPath();
        ctx.arc(x + 72, groundY - 90, 5, 0, Math.PI * 2);
        ctx.fill();

        // Arandela iluminando
        ctx.fillStyle = '#F59E0B';
        ctx.beginPath();
        ctx.arc(x + 220, 60, 14, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (stageId === 'bedroom') {
      // Quarto aconchegante com papel de parede lilás
      const grad = ctx.createLinearGradient(0, 0, 0, groundY);
      grad.addColorStop(0, '#F5F3FF');
      grad.addColorStop(1, '#DDD6FE');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, groundY);

      for (let x = -this.midOffsetX % 340; x < w; x += 340) {
        // Janela com cortina roxa
        ctx.fillStyle = '#1E1B4B';
        ctx.fillRect(x + 80, 40, 70, 90);
        // Lua pela janela
        ctx.fillStyle = '#FEF08A';
        ctx.beginPath();
        ctx.arc(x + 115, 75, 16, 0, Math.PI * 2);
        ctx.fill();
        // Estante de livros
        ctx.fillStyle = '#7C3AED';
        ctx.fillRect(x + 220, groundY - 140, 85, 140);
        ctx.fillStyle = '#C4B5FD';
        ctx.fillRect(x + 226, groundY - 120, 73, 8);
        ctx.fillRect(x + 226, groundY - 70, 73, 8);
      }
    } else if (stageId === 'attic') {
      // Sótão misterioso de madeira com vigas e luar
      const grad = ctx.createLinearGradient(0, 0, 0, groundY);
      grad.addColorStop(0, '#1E1B4B');
      grad.addColorStop(1, '#3B0764');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, groundY);

      // Vigas de carvalho no teto
      ctx.strokeStyle = '#581C87';
      ctx.lineWidth = 14;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(w, groundY * 0.4);
      ctx.stroke();

      for (let x = -this.midOffsetX % 380; x < w; x += 380) {
        // Claraboia redonda deixando passar luz prateada
        ctx.fillStyle = '#E9D5FF';
        ctx.beginPath();
        ctx.arc(x + 150, 70, 36, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#9333EA';
        ctx.lineWidth = 4;
        ctx.stroke();

        // Feixe de luz
        ctx.fillStyle = 'rgba(233, 213, 255, 0.12)';
        ctx.beginPath();
        ctx.moveTo(x + 150, 70);
        ctx.lineTo(x + 90, groundY);
        ctx.lineTo(x + 210, groundY);
        ctx.closePath();
        ctx.fill();
      }
    } else if (stageId === 'garden') {
      const grad = ctx.createLinearGradient(0, 0, 0, groundY);
      grad.addColorStop(0, '#7DD3FC');
      grad.addColorStop(0.65, '#BAE6FD');
      grad.addColorStop(1, '#FEF08A');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, groundY);

      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      for (let x = -this.bgOffsetX % 280; x < w; x += 280) {
        const cloudY = 40 + (x % 3) * 15;
        ctx.beginPath();
        ctx.arc(x + 40, cloudY, 20, 0, Math.PI * 2);
        ctx.arc(x + 65, cloudY - 10, 28, 0, Math.PI * 2);
        ctx.arc(x + 95, cloudY, 18, 0, Math.PI * 2);
        ctx.fill();
      }

      const fenceTop = groundY - 80;
      ctx.fillStyle = '#FDE68A';
      for (let x = -this.midOffsetX % 32; x < w; x += 32) {
        ctx.fillRect(x, fenceTop, 22, 80);
        ctx.beginPath();
        ctx.moveTo(x, fenceTop);
        ctx.lineTo(x + 11, fenceTop - 12);
        ctx.lineTo(x + 22, fenceTop);
        ctx.fill();
      }
      ctx.fillStyle = '#D97706';
      ctx.fillRect(0, fenceTop + 24, w, 8);
      ctx.fillRect(0, fenceTop + 55, w, 8);
    } else if (stageId === 'mansion') {
      // Mansão Imperial de Ouro e Veludo
      const grad = ctx.createLinearGradient(0, 0, 0, groundY);
      grad.addColorStop(0, '#FEF08A');
      grad.addColorStop(0.5, '#FDE047');
      grad.addColorStop(1, '#CA8A04');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, groundY);

      for (let x = -this.midOffsetX % 360; x < w; x += 360) {
        // Colunas de mármore imperial
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(x + 60, 0, 36, groundY);
        ctx.fillStyle = '#F59E0B';
        ctx.fillRect(x + 54, 0, 48, 16);
        ctx.fillRect(x + 54, groundY - 20, 48, 20);

        // Grande lustre de cristal dourado
        ctx.strokeStyle = '#D97706';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(x + 220, 0);
        ctx.lineTo(x + 220, 50);
        ctx.stroke();

        ctx.fillStyle = '#F59E0B';
        ctx.beginPath();
        ctx.arc(x + 220, 60, 24, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      // Treat Rush
      const grad = ctx.createLinearGradient(0, 0, 0, groundY);
      grad.addColorStop(0, '#FBCFE8');
      grad.addColorStop(0.5, '#DDD6FE');
      grad.addColorStop(1, '#FEF08A');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, groundY);

      ctx.strokeStyle = 'rgba(244, 114, 182, 0.45)';
      ctx.lineWidth = 16;
      ctx.beginPath();
      ctx.arc(w / 2, groundY, w * 0.55, Math.PI, 0);
      ctx.stroke();

      ctx.fillStyle = '#FDE047';
      for (let x = -this.bgOffsetX % 140; x < w; x += 140) {
        ctx.beginPath();
        ctx.arc(x + 30, 60, 5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  private renderGround(w: number, h: number) {
    const { ctx } = this;
    const groundY = this.groundY;
    const stageId = this.stageConfig.id;
    const floorHeight = h - groundY;

    if (stageId === 'living_room') {
      ctx.fillStyle = '#B45309';
      ctx.fillRect(0, groundY, w, floorHeight);
      ctx.strokeStyle = '#92400E';
      ctx.lineWidth = 2;
      for (let x = -this.foreOffsetX % 75; x < w; x += 75) {
        ctx.beginPath();
        ctx.moveTo(x, groundY);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      ctx.fillStyle = '#F43F5E';
      ctx.fillRect(0, groundY - 4, w, 6);
    } else if (stageId === 'kitchen') {
      ctx.fillStyle = '#334155';
      ctx.fillRect(0, groundY, w, floorHeight);
      ctx.fillStyle = '#F8FAFC';
      const tileSize = 32;
      for (let y = groundY; y < h; y += tileSize) {
        for (let x = -this.foreOffsetX % (tileSize * 2); x < w; x += tileSize * 2) {
          const isOddRow = Math.floor((y - groundY) / tileSize) % 2 === 1;
          const shiftX = isOddRow ? tileSize : 0;
          ctx.fillRect(x + shiftX, y, tileSize, tileSize);
        }
      }
      ctx.fillStyle = '#0284C7';
      ctx.fillRect(0, groundY - 3, w, 4);
    } else if (stageId === 'bathroom') {
      // Piso de cerâmica brilhante azul claro com reflexo e tapetinho azul
      ctx.fillStyle = '#0891B2';
      ctx.fillRect(0, groundY, w, floorHeight);
      ctx.fillStyle = '#67E8F9';
      for (let x = -this.foreOffsetX % 60; x < w; x += 60) {
        ctx.fillRect(x, groundY, 28, floorHeight);
      }
      // Tapete felpudo de banheiro azul
      ctx.fillStyle = '#0284C7';
      ctx.fillRect(0, groundY - 5, w, 6);
    } else if (stageId === 'hallway') {
      // Piso de madeira nobre com passadeira vermelha e bordas douradas
      ctx.fillStyle = '#78350F';
      ctx.fillRect(0, groundY, w, floorHeight);
      // Passadeira vermelha real
      ctx.fillStyle = '#DC2626';
      ctx.fillRect(0, groundY - 4, w, 8);
      ctx.fillStyle = '#F59E0B';
      ctx.fillRect(0, groundY - 5, w, 2);
      ctx.fillRect(0, groundY + 3, w, 2);
    } else if (stageId === 'bedroom') {
      // Carpete fofo roxo suave
      ctx.fillStyle = '#581C87';
      ctx.fillRect(0, groundY, w, floorHeight);
      ctx.fillStyle = '#7C3AED';
      for (let x = -this.foreOffsetX % 40; x < w; x += 40) {
        ctx.fillRect(x, groundY, 20, floorHeight);
      }
      ctx.fillStyle = '#A78BFA';
      ctx.fillRect(0, groundY - 4, w, 5);
    } else if (stageId === 'attic') {
      // Tábuas de madeira rústica com nós
      ctx.fillStyle = '#3E2723';
      ctx.fillRect(0, groundY, w, floorHeight);
      ctx.strokeStyle = '#271711';
      ctx.lineWidth = 3;
      for (let x = -this.foreOffsetX % 80; x < w; x += 80) {
        ctx.beginPath();
        ctx.moveTo(x, groundY);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
    } else if (stageId === 'garden') {
      ctx.fillStyle = '#16A34A';
      ctx.fillRect(0, groundY, w, floorHeight);
      ctx.fillStyle = '#22C55E';
      for (let x = -this.foreOffsetX % 24; x < w; x += 24) {
        ctx.beginPath();
        ctx.moveTo(x, groundY);
        ctx.lineTo(x + 4, groundY - 7);
        ctx.lineTo(x + 8, groundY);
        ctx.fill();
      }
      ctx.fillStyle = '#15803D';
      ctx.fillRect(0, groundY + 14, w, floorHeight - 14);
    } else if (stageId === 'mansion') {
      // Mármore espelhado com tapete persa imperial
      ctx.fillStyle = '#F59E0B';
      ctx.fillRect(0, groundY, w, floorHeight);
      ctx.fillStyle = '#991B1B';
      ctx.fillRect(0, groundY - 6, w, 8);
      ctx.fillStyle = '#FEF08A';
      ctx.fillRect(0, groundY - 6, w, 2);
      ctx.fillRect(0, groundY + 1, w, 2);
    } else {
      // Treat Rush
      ctx.fillStyle = '#F59E0B';
      ctx.fillRect(0, groundY, w, floorHeight);
      ctx.fillStyle = '#FCD34D';
      for (let x = -this.foreOffsetX % 44; x < w; x += 44) {
        ctx.beginPath();
        ctx.arc(x + 22, groundY, 16, 0, Math.PI);
        ctx.fill();
      }
    }
  }

  private renderEntities() {
    const { ctx } = this;

    for (const ent of this.entities) {
      if (ent.collected) continue;

      ctx.save();
      ctx.translate(ent.x, ent.y);

      switch (ent.type) {
        case 'cardboard_box': {
          ctx.fillStyle = '#D97706';
          ctx.fillRect(0, 0, ent.width, ent.height);
          ctx.fillStyle = '#B45309';
          ctx.fillRect(0, 0, ent.width, 10);
          ctx.fillStyle = '#FDE68A';
          ctx.fillRect(ent.width / 2 - 4, 0, 8, ent.height);
          ctx.fillStyle = '#78350F';
          ctx.beginPath();
          ctx.arc(ent.width / 2, ent.height / 2 + 4, 5, 0, Math.PI * 2);
          ctx.fill();
          break;
        }

        case 'cushion': {
          ctx.fillStyle = '#EC4899';
          ctx.beginPath();
          ctx.roundRect(0, 0, ent.width, ent.height, 14);
          ctx.fill();
          ctx.fillStyle = '#BE185D';
          ctx.beginPath();
          ctx.arc(ent.width / 2, ent.height / 2, 5, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#F472B6';
          ctx.lineWidth = 2;
          ctx.stroke();
          break;
        }

        case 'low_shelf': {
          ctx.fillStyle = '#78350F';
          ctx.fillRect(0, 0, ent.width, 14);
          ctx.fillStyle = '#64748B';
          ctx.fillRect(8, -20, 6, 20);
          ctx.fillRect(ent.width - 14, -20, 6, 20);
          ctx.fillStyle = '#EF4444';
          ctx.fillRect(16, 14, 18, 16);
          ctx.fillStyle = '#3B82F6';
          ctx.fillRect(52, 14, 18, 16);
          ctx.fillStyle = '#EF4444';
          ctx.font = 'bold 10px Plus Jakarta Sans';
          ctx.fillText('▼ ABAIXE!', 12, 44);
          break;
        }

        case 'mouse': {
          const wobble = Math.sin(Date.now() / 80) * 3;
          ctx.fillStyle = '#9CA3AF';
          ctx.beginPath();
          ctx.ellipse(ent.width / 2, ent.height / 2 + wobble, 16, 10, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#F472B6';
          ctx.beginPath();
          ctx.arc(ent.width / 2 - 6, ent.height / 2 - 8 + wobble, 5, 0, Math.PI * 2);
          ctx.arc(ent.width / 2 - 14, ent.height / 2 + wobble, 3, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#F472B6';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(ent.width / 2 + 14, ent.height / 2 + wobble);
          ctx.quadraticCurveTo(ent.width + 8, ent.height / 2 - 6, ent.width + 12, ent.height / 2);
          ctx.stroke();
          break;
        }

        case 'insect': {
          const wingFlap = Math.sin(Date.now() / 40) * 8;
          ctx.fillStyle = '#1E293B';
          ctx.beginPath();
          ctx.ellipse(ent.width / 2, ent.height / 2, 7, 5, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
          ctx.beginPath();
          ctx.ellipse(ent.width / 2 - 3, ent.height / 2 - 6 + wingFlap, 9, 5, -0.4, 0, Math.PI * 2);
          ctx.ellipse(ent.width / 2 + 3, ent.height / 2 - 6 + wingFlap, 9, 5, 0.4, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#F59E0B';
          ctx.lineWidth = 2;
          ctx.setLineDash([4, 3]);
          ctx.beginPath();
          ctx.arc(ent.width / 2, ent.height / 2, 18, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);
          break;
        }

        case 'swooping_bird': {
          const wing = Math.sin(Date.now() / 60) * 10;
          ctx.fillStyle = '#0284C7';
          ctx.beginPath();
          ctx.ellipse(ent.width / 2, ent.height / 2, 16, 10, -0.2, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#38BDF8';
          ctx.beginPath();
          ctx.moveTo(ent.width / 2 - 4, ent.height / 2);
          ctx.lineTo(ent.width / 2 - 10, ent.height / 2 - 14 + wing);
          ctx.lineTo(ent.width / 2 + 8, ent.height / 2);
          ctx.fill();
          ctx.fillStyle = '#F59E0B';
          ctx.beginPath();
          ctx.moveTo(ent.width / 2 - 16, ent.height / 2);
          ctx.lineTo(ent.width / 2 - 24, ent.height / 2 + 2);
          ctx.lineTo(ent.width / 2 - 16, ent.height / 2 + 5);
          ctx.fill();
          ctx.strokeStyle = '#EC4899';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(ent.width / 2, ent.height / 2, 22, 0, Math.PI * 2);
          ctx.stroke();
          break;
        }

        case 'dog': {
          ctx.fillStyle = '#78350F';
          ctx.beginPath();
          ctx.roundRect(0, 0, ent.width, ent.height, 12);
          ctx.fill();
          ctx.fillStyle = '#451A03';
          ctx.beginPath();
          ctx.ellipse(14, 18, 8, 14, 0.4, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#171717';
          ctx.beginPath();
          ctx.arc(6, 32, 5, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#F43F5E';
          ctx.beginPath();
          ctx.ellipse(10, 42, 6, 8, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#DC2626';
          ctx.fillRect(4, 22, 10, 6);
          break;
        }

        // --- NOVO: VASSOURA QUE VARRE O CHÃO ---
        case 'broom': {
          const sweep = Math.sin(Date.now() / 120) * 8;
          // Cabo de madeira
          ctx.strokeStyle = '#B45309';
          ctx.lineWidth = 5;
          ctx.beginPath();
          ctx.moveTo(ent.width - 8, -25);
          ctx.lineTo(ent.width / 2 + sweep, ent.height - 22);
          ctx.stroke();

          // Fita de união
          ctx.fillStyle = '#DC2626';
          ctx.fillRect(ent.width / 2 - 12 + sweep, ent.height - 24, 24, 6);

          // Cerdas de palha amarela varrendo
          ctx.fillStyle = '#FBBF24';
          ctx.beginPath();
          ctx.moveTo(ent.width / 2 - 14 + sweep, ent.height - 20);
          ctx.lineTo(ent.width / 2 + 14 + sweep, ent.height - 20);
          ctx.lineTo(ent.width / 2 + 22 + sweep, ent.height);
          ctx.lineTo(ent.width / 2 - 22 + sweep, ent.height);
          ctx.closePath();
          ctx.fill();

          // Poeirinha da vassoura
          ctx.fillStyle = 'rgba(217, 119, 6, 0.4)';
          ctx.beginPath();
          ctx.arc(ent.width / 2 - 25 + sweep, ent.height - 2, 4, 0, Math.PI * 2);
          ctx.arc(ent.width / 2 + 25 + sweep, ent.height - 2, 4, 0, Math.PI * 2);
          ctx.fill();
          break;
        }

        // --- NOVO: ROBÔ ASPIRADOR (ROOMBA COM LED AZUL) ---
        case 'robot_vacuum': {
          const pulse = Math.sin(Date.now() / 140) * 0.3 + 0.7;
          // Chassis circular preto
          ctx.fillStyle = '#1E293B';
          ctx.beginPath();
          ctx.ellipse(ent.width / 2, ent.height / 2 + 4, 24, 14, 0, 0, Math.PI * 2);
          ctx.fill();

          // Borda cromo
          ctx.strokeStyle = '#64748B';
          ctx.lineWidth = 2;
          ctx.stroke();

          // Anel de LED azul neon pulsante
          ctx.strokeStyle = `rgba(14, 165, 233, ${pulse})`;
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.ellipse(ent.width / 2, ent.height / 2 + 4, 14, 8, 0, 0, Math.PI * 2);
          ctx.stroke();

          // Luz de LED central
          ctx.fillStyle = '#38BDF8';
          ctx.beginPath();
          ctx.arc(ent.width / 2, ent.height / 2 + 4, 3.5, 0, Math.PI * 2);
          ctx.fill();

          // Sensor frontal
          ctx.fillStyle = '#0F172A';
          ctx.fillRect(ent.width / 2 - 16, ent.height / 2 - 6, 12, 6);
          break;
        }

        // --- NOVO: PEPINO DA SURPRESA (O VIRAL DO GATO!) ---
        case 'cucumber': {
          const shake = Math.sin(Date.now() / 90) * 2;
          // Corpo do pepino curvado
          ctx.fillStyle = '#15803D';
          ctx.beginPath();
          ctx.ellipse(ent.width / 2, ent.height / 2 + shake, 20, 10, -0.15, 0, Math.PI * 2);
          ctx.fill();

          // Pontinhos amarelos e listras
          ctx.fillStyle = '#86EFAC';
          ctx.beginPath();
          ctx.arc(ent.width / 2 - 8, ent.height / 2 - 2 + shake, 2, 0, Math.PI * 2);
          ctx.arc(ent.width / 2 + 4, ent.height / 2 - 4 + shake, 2, 0, Math.PI * 2);
          ctx.arc(ent.width / 2 + 10, ent.height / 2 + 2 + shake, 2, 0, Math.PI * 2);
          ctx.fill();

          // Olhinhos cartunescos do pepino
          ctx.fillStyle = '#FFFFFF';
          ctx.beginPath();
          ctx.arc(ent.width / 2 - 12, ent.height / 2 - 3 + shake, 3.5, 0, Math.PI * 2);
          ctx.arc(ent.width / 2 - 6, ent.height / 2 - 4 + shake, 3.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#000000';
          ctx.beginPath();
          ctx.arc(ent.width / 2 - 13, ent.height / 2 - 3 + shake, 1.8, 0, Math.PI * 2);
          ctx.arc(ent.width / 2 - 7, ent.height / 2 - 4 + shake, 1.8, 0, Math.PI * 2);
          ctx.fill();
          break;
        }

        // --- NOVO: BORRIFADOR DE ÁGUA SUSPENSO (JATOS D'ÁGUA) ---
        case 'water_spray': {
          // Garrafa borrifadora
          ctx.fillStyle = '#0284C7';
          ctx.beginPath();
          ctx.roundRect(0, 4, 22, 34, 6);
          ctx.fill();

          // Gatilho vermelho
          ctx.fillStyle = '#EF4444';
          ctx.fillRect(8, -6, 18, 12);
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(16, -2, 6, 14);

          // Jato de gotículas d'água no ar
          const dropWiggle = Math.sin(Date.now() / 70) * 4;
          ctx.fillStyle = '#38BDF8';
          for (let d = 0; d < 4; d++) {
            ctx.beginPath();
            ctx.arc(28 + d * 9, 4 + dropWiggle + (d % 2) * 5, 3 + d * 0.5, 0, Math.PI * 2);
            ctx.fill();
          }

          ctx.fillStyle = '#EF4444';
          ctx.font = 'bold 9px Plus Jakarta Sans';
          ctx.fillText('▼ ÁGUA!', 0, 48);
          break;
        }

        // --- NOVO: POÇA DE SABÃO ESCORREGADIA ---
        case 'soap_puddle': {
          const bubbleRise = (Date.now() / 100) % 20;
          // Poça ciano no chão
          ctx.fillStyle = 'rgba(56, 189, 248, 0.7)';
          ctx.beginPath();
          ctx.ellipse(ent.width / 2, ent.height / 2, 26, 9, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#BAE6FD';
          ctx.lineWidth = 1.5;
          ctx.stroke();

          // Bolhas de sabão translúcidas
          ctx.fillStyle = 'rgba(224, 242, 254, 0.85)';
          ctx.beginPath();
          ctx.arc(ent.width / 2 - 10, ent.height / 2 - bubbleRise, 5, 0, Math.PI * 2);
          ctx.arc(ent.width / 2 + 10, ent.height / 2 - (bubbleRise * 0.8), 4, 0, Math.PI * 2);
          ctx.fill();
          break;
        }

        // --- NOVO: SECADOR DE CABELO SOPRANDO VENTO ---
        case 'hair_dryer': {
          // Corpo do secador
          ctx.fillStyle = '#DC2626';
          ctx.beginPath();
          ctx.roundRect(0, 0, 32, 22, 6);
          ctx.fill();
          // Cabo
          ctx.fillStyle = '#1E293B';
          ctx.fillRect(4, 20, 10, 18);
          // Bocal
          ctx.fillStyle = '#334155';
          ctx.fillRect(28, 4, 10, 14);

          // Rajadas de ar quente onduladas
          ctx.strokeStyle = 'rgba(251, 146, 60, 0.6)';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.arc(46, 11, 8, -Math.PI / 3, Math.PI / 3);
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(54, 11, 12, -Math.PI / 3, Math.PI / 3);
          ctx.stroke();

          ctx.fillStyle = '#EF4444';
          ctx.font = 'bold 9px Plus Jakarta Sans';
          ctx.fillText('▼ VENTO!', 0, 46);
          break;
        }

        // --- NOVO: PONTEIRO LASER VERMELHO (ALVO BÔNUS VELOZ) ---
        case 'laser_dot': {
          const pulse = Math.sin(Date.now() / 60) * 0.4 + 0.8;
          // Ponto vermelho brilhante
          ctx.fillStyle = 'rgba(239, 68, 68, 0.4)';
          ctx.beginPath();
          ctx.arc(ent.width / 2, ent.height / 2, 14 * pulse, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#EF4444';
          ctx.beginPath();
          ctx.arc(ent.width / 2, ent.height / 2, 6, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#FFFFFF';
          ctx.beginPath();
          ctx.arc(ent.width / 2, ent.height / 2, 2.5, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#EF4444';
          ctx.font = 'bold 10px Fredoka, cursive';
          ctx.textAlign = 'center';
          ctx.fillText('LASER! 🔴', ent.width / 2, -4);
          break;
        }

        case 'treat_kibble': {
          ctx.fillStyle = '#D97706';
          ctx.beginPath();
          ctx.arc(ent.width / 2, ent.height / 2, 8, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#FDE68A';
          ctx.beginPath();
          ctx.arc(ent.width / 2 - 2, ent.height / 2 - 2, 3, 0, Math.PI * 2);
          ctx.fill();
          break;
        }

        case 'treat_sachet': {
          ctx.fillStyle = '#E11D48';
          ctx.beginPath();
          ctx.roundRect(0, 0, ent.width, ent.height, 6);
          ctx.fill();
          ctx.fillStyle = '#FFE4E6';
          ctx.fillRect(4, 8, ent.width - 8, 12);
          ctx.fillStyle = '#F59E0B';
          ctx.beginPath();
          ctx.arc(ent.width / 2, ent.height / 2, 4, 0, Math.PI * 2);
          ctx.fill();
          break;
        }

        case 'treat_golden_tuna': {
          const shine = ((Date.now() / 200) % Math.PI) * 2;
          ctx.fillStyle = '#F59E0B';
          ctx.beginPath();
          ctx.ellipse(ent.width / 2, ent.height / 2, 18, 14, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#FEF08A';
          ctx.lineWidth = 3;
          ctx.stroke();
          ctx.fillStyle = '#FFF';
          ctx.beginPath();
          ctx.arc(ent.width / 2 + Math.cos(shine) * 8, ent.height / 2 + Math.sin(shine) * 6, 3, 0, Math.PI * 2);
          ctx.fill();
          break;
        }

        case 'catnip': {
          ctx.fillStyle = '#10B981';
          ctx.beginPath();
          ctx.arc(ent.width / 2, ent.height / 2, 12, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#34D399';
          ctx.beginPath();
          ctx.arc(ent.width / 2 - 4, ent.height / 2 - 6, 8, 0, Math.PI * 2);
          ctx.arc(ent.width / 2 + 4, ent.height / 2 - 6, 8, 0, Math.PI * 2);
          ctx.fill();
          break;
        }
      }

      ctx.restore();
    }
  }

  private renderGoalBowl(x: number, y: number) {
    const { ctx } = this;
    ctx.save();
    ctx.translate(x, y);

    ctx.fillStyle = '#F59E0B';
    ctx.beginPath();
    ctx.ellipse(40, 30, 42, 18, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#B45309';
    ctx.fillRect(10, 30, 60, 16);

    ctx.fillStyle = '#FB7185';
    for (let i = 0; i < 7; i++) {
      ctx.beginPath();
      ctx.arc(20 + i * 7, 24 - (i % 2) * 5, 6, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.strokeStyle = '#FEF08A';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(40, 10, 20, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = '#D97706';
    ctx.font = 'bold 14px Fredoka';
    ctx.textAlign = 'center';
    ctx.fillText('PETISCO SUPREMO! 👑', 40, -12);

    ctx.restore();
  }

  private renderVacuumCleaner(x: number, y: number) {
    const { ctx } = this;
    ctx.save();
    ctx.translate(x, y);

    ctx.fillStyle = '#DC2626';
    ctx.beginPath();
    ctx.roundRect(0, 0, 60, 48, 14);
    ctx.fill();

    ctx.fillStyle = '#171717';
    ctx.fillRect(52, 12, 22, 28);

    ctx.fillStyle = '#FEF08A';
    ctx.beginPath();
    ctx.arc(38, 16, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#7F1D1D';
    ctx.beginPath();
    ctx.arc(40, 16, 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#334155';
    ctx.beginPath();
    ctx.arc(16, 46, 8, 0, Math.PI * 2);
    ctx.arc(44, 46, 8, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(76, 24);
    ctx.lineTo(95, 24);
    ctx.moveTo(76, 32);
    ctx.lineTo(90, 32);
    ctx.stroke();

    ctx.restore();
  }

  private renderCat() {
    const { ctx, cat } = this;
    const isDuck = cat.isDucking;
    const isPounce = cat.isPouncing;
    const isBlinking = cat.invincibleTimer > 0 && Math.floor(Date.now() / 100) % 2 === 0;

    if (isBlinking) return;

    ctx.save();
    ctx.translate(cat.x, cat.y);

    const colors = this.getCoatColors();
    const legOffset1 = Math.sin(cat.runCycle) * 14;
    const legOffset2 = Math.sin(cat.runCycle + Math.PI) * 14;

    // Tail wave
    const tailWiggle = Math.sin(cat.runCycle * 1.5) * 16;
    ctx.strokeStyle = colors.primary;
    ctx.lineWidth = 7;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(8, isDuck ? 28 : 20);
    ctx.quadraticCurveTo(-14, isDuck ? 24 : 10 + tailWiggle, -24, isDuck ? 14 : -4 + tailWiggle);
    ctx.stroke();

    // Back legs
    ctx.fillStyle = colors.secondary;
    if (!cat.isGrounded) {
      ctx.fillRect(10, isDuck ? 22 : 28, 9, 14);
      ctx.fillRect(44, isDuck ? 22 : 28, 9, 14);
    } else {
      ctx.fillRect(12 + legOffset2, 28, 9, 16);
      ctx.fillRect(44 + legOffset1, 28, 9, 16);
    }

    // Cat Body
    ctx.fillStyle = colors.primary;
    if (isDuck) {
      ctx.beginPath();
      ctx.ellipse(32, 26, 34, 12, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (isPounce) {
      ctx.beginPath();
      ctx.ellipse(34, 18, 32, 16, -0.2, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.ellipse(30, 20, 28, 18, 0.05, 0, Math.PI * 2);
      ctx.fill();
    }

    this.renderCoatPatterns(colors, isDuck);

    // Front legs
    ctx.fillStyle = colors.primary;
    if (cat.isGrounded && !isDuck) {
      ctx.fillRect(18 + legOffset1, 28, 9, 16);
      ctx.fillRect(50 + legOffset2, 28, 9, 16);
    } else if (isPounce) {
      ctx.fillRect(52, 10, 14, 8);
      ctx.fillRect(52, 22, 14, 8);
    }

    // Cat Head
    const headX = isDuck ? 54 : isPounce ? 56 : 48;
    const headY = isDuck ? 22 : isPounce ? 14 : 10;
    const headRadius = isDuck ? 14 : 17;

    ctx.fillStyle = colors.primary;
    ctx.beginPath();
    ctx.arc(headX, headY, headRadius, 0, Math.PI * 2);
    ctx.fill();

    // Cat Ears
    const earTilt = isDuck ? 0.4 : isPounce ? -0.2 : 0;
    ctx.fillStyle = colors.primary;
    ctx.beginPath();
    ctx.moveTo(headX - 10, headY - 10);
    ctx.lineTo(headX - 8, headY - 24 + earTilt * 10);
    ctx.lineTo(headX + 2, headY - 12);
    ctx.fill();

    ctx.fillStyle = '#F472B6';
    ctx.beginPath();
    ctx.moveTo(headX - 8, headY - 10);
    ctx.lineTo(headX - 7, headY - 20 + earTilt * 8);
    ctx.lineTo(headX, headY - 12);
    ctx.fill();

    ctx.fillStyle = colors.primary;
    ctx.beginPath();
    ctx.moveTo(headX + 4, headY - 12);
    ctx.lineTo(headX + 12, headY - 24 + earTilt * 10);
    ctx.lineTo(headX + 16, headY - 10);
    ctx.fill();

    ctx.fillStyle = '#F472B6';
    ctx.beginPath();
    ctx.moveTo(headX + 6, headY - 11);
    ctx.lineTo(headX + 12, headY - 20 + earTilt * 8);
    ctx.lineTo(headX + 14, headY - 10);
    ctx.fill();

    // Eyes
    ctx.fillStyle = colors.eyeColor;
    const eyeX = headX + (isDuck ? 6 : 5);
    const eyeY = headY - 2;
    ctx.beginPath();
    ctx.arc(eyeX, eyeY, isDuck ? 2.5 : 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#FFF';
    ctx.beginPath();
    ctx.arc(eyeX + 1.2, eyeY - 1.2, 1.6, 0, Math.PI * 2);
    ctx.fill();

    // Nose & whiskers
    ctx.fillStyle = '#F472B6';
    ctx.beginPath();
    ctx.arc(headX + 12, headY + 3, 2.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(headX + 11, headY + 3);
    ctx.lineTo(headX + 24, headY);
    ctx.moveTo(headX + 11, headY + 5);
    ctx.lineTo(headX + 24, headY + 7);
    ctx.stroke();

    this.renderCollar(headX - 4, headY + 12);
    this.renderHat(headX, headY);

    ctx.restore();
  }

  private getCoatColors() {
    switch (this.customization.coat) {
      case 'tuxedo':
        return { primary: '#18181B', secondary: '#27272A', belly: '#FFFFFF', eyeColor: '#22C55E' };
      case 'siamese':
        return { primary: '#FEF3C7', secondary: '#78350F', belly: '#FEF3C7', eyeColor: '#0284C7' };
      case 'white_persian':
        return { primary: '#FFFFFF', secondary: '#F4F4F5', belly: '#FFFFFF', eyeColor: '#38BDF8' };
      case 'calico':
        return { primary: '#EA580C', secondary: '#18181B', belly: '#FFFFFF', eyeColor: '#10B981' };
      case 'orange_tabby':
      default:
        return { primary: '#F97316', secondary: '#EA580C', belly: '#FED7AA', eyeColor: '#15803D' };
    }
  }

  private renderCoatPatterns(colors: ReturnType<typeof GameEngine.prototype.getCoatColors>, isDuck: boolean) {
    const { ctx } = this;
    if (this.customization.coat === 'tuxedo') {
      ctx.fillStyle = colors.belly;
      ctx.beginPath();
      ctx.ellipse(34, isDuck ? 26 : 22, 14, 9, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (this.customization.coat === 'orange_tabby') {
      ctx.fillStyle = '#C2410C';
      ctx.fillRect(24, isDuck ? 18 : 12, 4, 10);
      ctx.fillRect(32, isDuck ? 18 : 12, 4, 12);
      ctx.fillRect(40, isDuck ? 18 : 12, 4, 10);
    } else if (this.customization.coat === 'siamese') {
      ctx.fillStyle = '#78350F';
      ctx.beginPath();
      ctx.arc(58, isDuck ? 22 : 10, 8, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private renderCollar(x: number, y: number) {
    const { ctx } = this;
    const collar = this.customization.collar;

    if (collar === 'bell_collar') {
      ctx.fillStyle = '#EF4444';
      ctx.fillRect(x - 6, y - 2, 12, 4);
      ctx.fillStyle = '#F59E0B';
      ctx.beginPath();
      ctx.arc(x, y + 5, 4, 0, Math.PI * 2);
      ctx.fill();
    } else if (collar === 'blue_harness') {
      ctx.fillStyle = '#0284C7';
      ctx.fillRect(x - 8, y - 2, 16, 5);
    } else if (collar === 'bowtie') {
      ctx.fillStyle = '#10B981';
      ctx.beginPath();
      ctx.moveTo(x - 7, y - 2);
      ctx.lineTo(x + 7, y + 4);
      ctx.lineTo(x + 7, y - 2);
      ctx.lineTo(x - 7, y + 4);
      ctx.fill();
      ctx.fillStyle = '#047857';
      ctx.beginPath();
      ctx.arc(x, y + 1, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private renderHat(headX: number, headY: number) {
    const { ctx } = this;
    const hat = this.customization.hat;
    if (hat === 'none') return;

    if (hat === 'red_bow') {
      ctx.fillStyle = '#EF4444';
      ctx.beginPath();
      ctx.ellipse(headX - 6, headY - 16, 6, 4, -0.3, 0, Math.PI * 2);
      ctx.ellipse(headX + 6, headY - 16, 6, 4, 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#B91C1C';
      ctx.beginPath();
      ctx.arc(headX, headY - 16, 3, 0, Math.PI * 2);
      ctx.fill();
    } else if (hat === 'witch_hat') {
      ctx.fillStyle = '#7C3AED';
      ctx.beginPath();
      ctx.ellipse(headX + 2, headY - 14, 18, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(headX - 10, headY - 14);
      ctx.lineTo(headX + 4, headY - 36);
      ctx.lineTo(headX + 14, headY - 14);
      ctx.fill();
      ctx.fillStyle = '#F59E0B';
      ctx.fillRect(headX - 6, headY - 17, 14, 4);
    } else if (hat === 'cap') {
      ctx.fillStyle = '#2563EB';
      ctx.beginPath();
      ctx.arc(headX + 2, headY - 14, 12, Math.PI, 0);
      ctx.fill();
      ctx.fillStyle = '#1D4ED8';
      ctx.fillRect(headX - 14, headY - 14, 14, 4);
    } else if (hat === 'sunglasses') {
      ctx.fillStyle = '#111827';
      ctx.beginPath();
      ctx.roundRect(headX + 1, headY - 5, 13, 8, 3);
      ctx.fill();
      ctx.fillStyle = '#374151';
      ctx.fillRect(headX - 2, headY - 4, 4, 2);
    } else if (hat === 'crown') {
      ctx.fillStyle = '#F59E0B';
      ctx.beginPath();
      ctx.moveTo(headX - 8, headY - 14);
      ctx.lineTo(headX - 10, headY - 26);
      ctx.lineTo(headX - 3, headY - 20);
      ctx.lineTo(headX + 2, headY - 28);
      ctx.lineTo(headX + 7, headY - 20);
      ctx.lineTo(headX + 12, headY - 26);
      ctx.lineTo(headX + 10, headY - 14);
      ctx.fill();
      ctx.fillStyle = '#EF4444';
      ctx.beginPath();
      ctx.arc(headX + 2, headY - 28, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private renderParticles() {
    const { ctx } = this;
    for (const p of this.particles) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.alpha);

      if (p.text) {
        ctx.fillStyle = p.color;
        ctx.font = `bold ${p.size}px Fredoka, cursive`;
        ctx.textAlign = 'center';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
        ctx.shadowBlur = 4;
        ctx.fillText(p.text, p.x, p.y);
      } else {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }
  }
}
