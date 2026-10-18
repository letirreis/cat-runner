import React, { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Zap, Sparkles, Hand, ChevronDown } from 'lucide-react';
import { GameEngine, TutorialStep } from '../game/GameEngine';
import { PlayerCustomization, StageConfig, StageId } from '../types/game';

interface GameCanvasProps {
  stageId: StageId;
  stageConfig: StageConfig;
  customization: PlayerCustomization;
  isPaused: boolean;
  onLivesChange: (lives: number) => void;
  onScoreChange: (score: number) => void;
  onCoinsCollected: (coins: number) => void;
  onDistanceChange: (dist: number, target: number) => void;
  onGameOver: (score: number, coins: number) => void;
  onStageComplete: (score: number, coins: number, livesLeft: number) => void;
  engineRef: React.MutableRefObject<GameEngine | null>;
}

export const GameCanvas: React.FC<GameCanvasProps> = ({
  stageId,
  stageConfig,
  customization,
  isPaused,
  onLivesChange,
  onScoreChange,
  onCoinsCollected,
  onDistanceChange,
  onGameOver,
  onStageComplete,
  engineRef,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const touchHandledRef = useRef(false);

  const [hasPounceTargetNear, setHasPounceTargetNear] = useState(false);
  const [lastActionFeedback, setLastActionFeedback] = useState<string | null>(null);
  const [tutorialInfo, setTutorialInfo] = useState<{ step: TutorialStep; title: string; instruction: string } | null>(null);

  // Initialize and mount GameEngine with dynamic size
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const rect = container.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);

    const engine = new GameEngine(canvas, stageId, customization, {
      onLivesChange,
      onScoreChange,
      onCoinsCollected,
      onDistanceChange,
      onGameOver,
      onStageComplete,
      onPounceSuccess: (points) => {
        setLastActionFeedback(`Bote certeiro! +${points}`);
        setTimeout(() => setLastActionFeedback(null), 1200);
      },
      onTutorialStepChange: (step, title, instruction) => {
        if (step === 'none') {
          setTutorialInfo(null);
        } else {
          setTutorialInfo({ step, title, instruction });
        }
      },
    });

    engine.resize(rect.width, rect.height, dpr);
    engineRef.current = engine;
    engine.start();

    // Check periodically for pounce target proximity
    const pounceCheckInterval = setInterval(() => {
      if (!engineRef.current) return;
      const catX = engineRef.current.cat.x;
      const targetNear = engineRef.current.entities.some(
        (e) => e.isPounceable && !e.collected && e.x > catX - 30 && e.x < catX + 260
      );
      setHasPounceTargetNear(targetNear);
    }, 100);

    // Responsive ResizeObserver to adapt canvas dynamically to any screen/device orientation
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect && engineRef.current) {
          const { width, height } = entry.contentRect;
          if (width > 0 && height > 0) {
            engineRef.current.resize(width, height, dpr);
          }
        }
      }
    });

    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      clearInterval(pounceCheckInterval);
      engine.stop();
      engineRef.current = null;
    };
  }, [stageId]);

  // Sync customization
  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.setCustomization(customization);
    }
  }, [customization]);

  // Sync pause state
  useEffect(() => {
    if (!engineRef.current) return;
    if (isPaused) {
      engineRef.current.pause();
    } else {
      engineRef.current.resume();
    }
  }, [isPaused]);

  // Keyboard controls for desktop
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!engineRef.current || isPaused) return;

      if (e.code === 'Space' || e.code === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
        e.preventDefault();
        engineRef.current.jump();
      } else if (e.code === 'ArrowDown' || e.key === 's' || e.key === 'S') {
        e.preventDefault();
        engineRef.current.duck();
      } else if (e.code === 'KeyP' || e.code === 'KeyB' || e.code === 'Enter') {
        e.preventDefault();
        engineRef.current.pounce();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPaused]);

  // Touch gesture handling
  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length === 0) return;
    const touch = e.touches[0];
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    touchStartRef.current = {
      x: touch.clientX - rect.left,
      y: touch.clientY - rect.top,
      time: Date.now(),
    };
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (!touchStartRef.current || !engineRef.current || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const touch = e.changedTouches[0];
    if (!touch) return;

    const currentX = touch.clientX - rect.left;
    const currentY = touch.clientY - rect.top;
    const deltaX = currentX - touchStartRef.current.x;
    const deltaY = currentY - touchStartRef.current.y;
    const deltaTime = Date.now() - touchStartRef.current.time;

    // Check vertical swipe down for duck
    if (deltaY > 30 && Math.abs(deltaY) > Math.abs(deltaX)) {
      touchHandledRef.current = true;
      setTimeout(() => { touchHandledRef.current = false; }, 400);
      engineRef.current.duck();
    } else if (deltaY < -35 && Math.abs(deltaY) > Math.abs(deltaX)) {
      // Swipe up for jump
      touchHandledRef.current = true;
      setTimeout(() => { touchHandledRef.current = false; }, 400);
      engineRef.current.jump();
    } else if (deltaTime < 350) {
      // Tap gesture
      touchHandledRef.current = true;
      setTimeout(() => { touchHandledRef.current = false; }, 400);
      engineRef.current.handleCanvasClick(touchStartRef.current.x, touchStartRef.current.y);
    }

    touchStartRef.current = null;
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (touchHandledRef.current) return;
    if (!engineRef.current || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
    engineRef.current.handleCanvasClick(clickX, clickY);
  };

  const isTutorial = stageConfig.id === 'living_room';
  const tutStep = tutorialInfo?.step;

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full flex-1 overflow-hidden select-none bg-stone-950 flex flex-col"
    >
      {/* Dynamic 2D Game Canvas (Edge-to-Edge) */}
      <canvas
        ref={canvasRef}
        onClick={handleCanvasClick}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        className="w-full h-full block cursor-pointer touch-none"
      />

      {/* Floating Action Feedback */}
      {lastActionFeedback && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 pointer-events-none bg-amber-500/95 text-stone-950 font-display font-bold text-xs sm:text-sm px-4 py-1.5 rounded-full shadow-xl border-2 border-white animate-bounce z-20">
          {lastActionFeedback}
        </div>
      )}

      {/* Stage 1: Guided Tutorial Banner Overlay */}
      {isTutorial && tutorialInfo && (
        <div className="absolute top-2 left-3 right-3 pointer-events-none z-20 flex flex-col items-center">
          <div className="w-full max-w-sm bg-gradient-to-r from-amber-950/90 via-stone-900/95 to-amber-950/90 text-amber-50 px-3.5 py-2 rounded-2xl border-2 border-amber-400 shadow-xl backdrop-blur-md text-center transition-all animate-pulse">
            <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-amber-300 font-display tracking-wide uppercase">
              <Sparkles className="w-3.5 h-3.5 text-yellow-300 animate-spin" />
              <span>{tutorialInfo.title}</span>
            </div>
            <p className="text-[11px] sm:text-xs text-stone-200 mt-0.5 leading-snug font-medium">
              {tutorialInfo.instruction}
            </p>
          </div>

          {/* Tutorial Step Animated Gesture Callout */}
          {tutStep === 'jump' && (
            <div className="mt-2 flex items-center gap-1.5 bg-orange-500 text-stone-950 font-display font-bold text-[11px] px-3 py-1 rounded-full shadow-lg border border-yellow-200 animate-bounce">
              <Hand className="w-3.5 h-3.5 animate-pulse" /> Toque em qualquer lugar ou aperte Pular!
            </div>
          )}

          {tutStep === 'duck' && (
            <div className="mt-2 flex items-center gap-1.5 bg-sky-500 text-white font-display font-bold text-[11px] px-3 py-1 rounded-full shadow-lg border border-white animate-bounce">
              <ChevronDown className="w-4 h-4 animate-bounce" /> Deslize para baixo ou aperte Agachar!
            </div>
          )}

          {tutStep === 'pounce' && (
            <div className="mt-2 flex items-center gap-1.5 bg-pink-500 text-white font-display font-bold text-[11px] px-3 py-1 rounded-full shadow-lg border border-yellow-200 animate-pulse">
              <Zap className="w-3.5 h-3.5 fill-yellow-200 text-yellow-200" /> Toque na mariposa voadora ou no botão!
            </div>
          )}
        </div>
      )}

      {/* Non-Tutorial Stage Intro Reminder */}
      {!isTutorial && (
        <div className="absolute top-2 left-3 pointer-events-none bg-black/45 backdrop-blur-xs text-[11px] text-amber-200/90 px-2.5 py-1 rounded-lg border border-amber-700/40 z-10 shadow-sm">
          Toque para <strong className="text-white">Pular</strong> · Deslize para <strong className="text-white">Agachar</strong> · Toque no bicho para <strong className="text-pink-300">Dar o Bote</strong>
        </div>
      )}

      {/* Tactile On-Screen One-Finger Controls (Bottom Thumb Area) */}
      <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between pointer-events-none px-1 z-20">
        {/* Left: Agachar / Duck Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            engineRef.current?.duck();
          }}
          className={`pointer-events-auto flex items-center justify-center gap-1.5 px-4 py-3 rounded-2xl shadow-xl backdrop-blur-md transition-all active:scale-90 ${
            tutStep === 'duck'
              ? 'bg-sky-600 text-white border-2 border-white ring-4 ring-sky-400/50 animate-pulse scale-105'
              : 'bg-stone-900/85 hover:bg-stone-800 text-amber-100 border border-amber-600/40'
          }`}
          title="Agachar / Deslizar (ou deslize para baixo)"
        >
          <ArrowDown className="w-5 h-5 text-amber-300" />
          <span className="font-display font-bold text-xs tracking-wide">Agachar</span>
        </button>

        {/* Center: Dynamic Pounce Button (Lights up when bug or bird is in range or in pounce tutorial!) */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            engineRef.current?.pounce();
          }}
          className={`pointer-events-auto flex items-center justify-center gap-1.5 px-4 py-3 rounded-2xl shadow-xl backdrop-blur-md transition-all active:scale-90 ${
            tutStep === 'pounce' || hasPounceTargetNear
              ? 'bg-gradient-to-r from-pink-500 via-rose-500 to-amber-500 text-white border-2 border-white ring-4 ring-pink-500/50 animate-pulse scale-105 shadow-pink-500/60'
              : 'bg-stone-900/85 hover:bg-stone-800 text-amber-200 border border-amber-600/40'
          }`}
          title="Dar o Bote em insetos e pássaros!"
        >
          <Zap className={`w-5 h-5 ${tutStep === 'pounce' || hasPounceTargetNear ? 'text-yellow-200 fill-yellow-200 animate-bounce' : 'text-amber-400'}`} />
          <span className="font-display font-bold text-xs tracking-wider">
            {tutStep === 'pounce' || hasPounceTargetNear ? 'BOTE AGORA!' : 'Dar o Bote'}
          </span>
          {(tutStep === 'pounce' || hasPounceTargetNear) && <Sparkles className="w-4 h-4 text-yellow-300" />}
        </button>

        {/* Right: Pular / Jump Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            engineRef.current?.jump();
          }}
          className={`pointer-events-auto flex items-center justify-center gap-1.5 px-5 py-3 rounded-2xl shadow-xl backdrop-blur-md transition-all active:scale-90 ${
            tutStep === 'jump'
              ? 'bg-orange-500 text-white border-2 border-white ring-4 ring-orange-400/50 animate-pulse scale-105'
              : 'bg-orange-600/90 hover:bg-orange-500 text-white border border-orange-400/60'
          }`}
          title="Pular (ou toque na tela)"
        >
          <ArrowUp className="w-5 h-5 text-yellow-200" />
          <span className="font-display font-bold text-xs tracking-wide">Pular</span>
        </button>
      </div>
    </div>
  );
};
