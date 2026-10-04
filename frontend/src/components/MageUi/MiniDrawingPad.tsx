/**
 * @file MiniDrawingPad.tsx
 * @description Mage UI mini drawing pad powered by Atrament via the unified DrawingCanvas.
 * Features:
 * - Antique parchment scroll design with wooden dowel rollers.
 * - Cardinal arrow guidelines (North, South, East, West dashed lines with outward arrowheads).
 * - Horizontal Workshop toolbar at the top (Pen, Eraser, Undo, Redo, Clear, Close).
 * - High line smoothness (Atrament smoothing 0.88 + adaptive stroke).
 * - Closed state where the two wooden sticks come together touching each other.
 * - Open button badge on closed scroll to easily unroll.
 * - Canvas permanently mounted in the DOM so opening/closing never clears drawn strokes.
 */

import React, { useRef, useState, useEffect, useCallback, useImperativeHandle, forwardRef } from 'react';
import {
  PenIcon,
  EraserIcon,
  ArrowArcLeftIcon,
  ArrowArcRightIcon,
  TrashIcon,
  ScrollIcon,
  CaretUpIcon,
  Sparkle as SparkleIcon,
  CircleNotch as SpinnerIcon,
  CaretRightIcon,
} from '@phosphor-icons/react';
import type { StrokeData } from 'atrament';
import { DrawingCanvas, DrawingCanvasRef } from '../DrawingCanvas';
import { GlyphDiagnosticsOverlay } from '../DrawingPad/GlyphDiagnosticsOverlay';
import type { CanvasSigilError } from '../../lib/glyph_helpers/glyph_solidity';
import { useMiniPadDraftStore } from '../../lib/stores/minipad_draft_store';
import { removeImageBackground, BackgroundRemovalOptions } from '../../lib/admin_utils/background_remover';
import toast from 'react-hot-toast';

export interface MiniDrawingPadProps {
  className?: string;
  width?: number;
  height?: number;
  onStrokesChange?: (strokes: StrokeData[]) => void;
  onCastRune?: (canvas: HTMLCanvasElement, strokes: StrokeData[], trimmedSnapshot?: string) => void;
  isProcessing?: boolean;
  errors?: CanvasSigilError[];
  dismissedErrors?: Record<string, boolean>;
  onDismissError?: (errorKey: string) => void;
  sessionId?: string | number;
}

export interface MiniDrawingPadRef {
  getCanvasElement: () => HTMLCanvasElement | null;
  getSnapshot: (options?: BackgroundRemovalOptions) => Promise<string | null>;
  clear: () => void;
  undo: () => void;
  redo: () => void;
  getStrokes: () => StrokeData[];
  isEmpty: () => boolean;
  openScroll: () => void;
  closeScroll: () => void;
  loadStrokes: (strokes: StrokeData[]) => void;
}

export const MiniDrawingPad = forwardRef<MiniDrawingPadRef, MiniDrawingPadProps>(
  (
    {
      className = '',
      width = 420,
      height = 420,
      onStrokesChange,
      onCastRune,
      isProcessing = false,
      errors = [],
      dismissedErrors = {},
      onDismissError,
      sessionId = 'mini-diag',
    },
    ref
  ) => {
    const drawingCanvasRef = useRef<DrawingCanvasRef>(null);
    const isClosed = useMiniPadDraftStore((state) => state.isClosed);
    const setIsClosed = useMiniPadDraftStore((state) => state.setIsClosed);
    const setLiveStrokes = useMiniPadDraftStore((state) => state.setLiveStrokes);
    const clearLiveSession = useMiniPadDraftStore((state) => state.clearLiveSession);

    const [hasStrokes, setHasStrokes] = useState(false);
    const [localDismissed, setLocalDismissed] = useState<Record<string, boolean>>({});

    const activeDismissed = dismissedErrors ?? localDismissed;
    const handleDismiss = onDismissError ?? ((key: string) => setLocalDismissed((prev) => ({ ...prev, [key]: true })));

    // Restore live draft strokes from persistent session on mount
    useEffect(() => {
      const initialStrokes = useMiniPadDraftStore.getState().activeStrokes;
      if (initialStrokes && initialStrokes.length > 0) {
        const timer = setTimeout(() => {
          if (drawingCanvasRef.current) {
            drawingCanvasRef.current.loadStrokes(initialStrokes);
            setHasStrokes(true);
          }
        }, 60);
        return () => clearTimeout(timer);
      }
    }, []);

    const getSnapshot = useCallback(async (options?: BackgroundRemovalOptions): Promise<string | null> => {
      const canvas = drawingCanvasRef.current?.getCanvasElement();
      if (!canvas || drawingCanvasRef.current?.isEmpty()) return null;
      let snapshot = canvas.toDataURL('image/png');
      try {
        snapshot = await removeImageBackground(snapshot, {
          autoTrim: true,
          removeHalo: false,
          contiguousOnly: false,
          tolerance: 0,
          ...options,
        });
      } catch (err) {
        console.warn('[MiniDrawingPad] Failed to trim preview canvas snapshot:', err);
      }
      return snapshot;
    }, []);

    // Forward imperative ref
    useImperativeHandle(
      ref,
      () => ({
        getCanvasElement: () => drawingCanvasRef.current?.getCanvasElement() ?? null,
        getSnapshot,
        clear: () => {
          drawingCanvasRef.current?.clear();
          clearLiveSession();
          setHasStrokes(false);
        },
        undo: () => drawingCanvasRef.current?.undo(),
        redo: () => drawingCanvasRef.current?.redo(),
        getStrokes: () => drawingCanvasRef.current?.getStrokes() ?? [],
        isEmpty: () => drawingCanvasRef.current?.isEmpty() ?? true,
        openScroll: () => setIsClosed(false),
        closeScroll: () => setIsClosed(true),
        loadStrokes: (strokes: StrokeData[]) => {
          drawingCanvasRef.current?.loadStrokes(strokes);
          setHasStrokes(strokes.length > 0);
          setLiveStrokes(strokes);
        },
      }),
      [getSnapshot, setIsClosed, setLiveStrokes, clearLiveSession]
    );

    const handleStrokesChange = (strokes: StrokeData[]) => {
      const active = strokes.length > 0;
      setHasStrokes(active);
      setLiveStrokes(strokes);
      if (onStrokesChange) {
        onStrokesChange(strokes);
      }
    };

    const handleTriggerCast = async () => {
      const canvas = drawingCanvasRef.current?.getCanvasElement();
      const strokes = drawingCanvasRef.current?.getStrokes() ?? [];
      if (canvas && onCastRune) {
        const trimmedSnapshot = await getSnapshot();
        if (!trimmedSnapshot) return toast.error("No Glyph Snapshot!");
        onCastRune(canvas, strokes, trimmedSnapshot);
      }
    };

    return (
      <div
        className={`mini-scrollpad-container ${className} ${isClosed ? 'is-closed' : ''}`}
        style={{
          '--scroll-w': `${width}px`,
          '--scroll-h': `${height + 60}px`,
        } as React.CSSProperties}
      >
        {/* Open Scroll Icon Button: Only element shown when scroll is rolled up and slid away */}
        <button
          type="button"
          className={`gameplay-scroll-open-icon-btn ${isClosed ? 'is-visible' : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            setIsClosed(false);
          }}
          title="Open Arcane Drawing Pad"
          aria-label="Open drawing pad"
        >
          <ScrollIcon size={24} weight="bold" />
        </button>

        <div
          className={`gameplay-scroll-frame ${isClosed ? 'is-closed' : ''}`}
          onClick={() => {
            if (isClosed) setIsClosed(false);
          }}
          role={isClosed ? 'button' : undefined}
          tabIndex={isClosed ? 0 : undefined}
          title={isClosed ? 'Click to unroll scroll' : undefined}
        >
          {/* Wooden Roller Top */}
          <div className="gameplay-scroll-roller-top" />

          {/* Parchment Canvas Area: Canvas stays mounted so closing/opening NEVER clears strokes */}
          <div className="gameplay-scroll-parchment-body">
            <DrawingCanvas
              ref={drawingCanvasRef}
              width={width}
              height={height}
              showToolbar={true}
              toolbarPosition="left"
              toolbarOrientation="vertical"
              showGuide={true}
              guideColor="rgba(145, 95, 30, 0.48)"
              guideSize={`min(${Math.round(height * 0.76)}px, 80%)`}
              brushColor="#221a14"
              backgroundColor="transparent"
              backgroundImage="/assets/parchment.png"
              fixedBrushSize={true}
              defaultBrushSize={4}
              smoothing={0.88}
              adaptiveStroke={true}
              toolbarExtraContent={
                <>
                  <button
                    type="button"
                    className="tool-bar-item btn-cast-spell"
                    disabled={!hasStrokes || isProcessing}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleTriggerCast()
                    }}
                    title={hasStrokes ? "Recognize & Cast Spell" : "Draw a glyph on parchment to cast"}
                    aria-label="Cast Spell"
                    style={{
                      background: hasStrokes ? 'rgba(0, 136, 255, 0.2)' : 'transparent',
                      color: hasStrokes ? '#00e5ff' : '#666',
                      borderColor: hasStrokes ? '#00e5ff' : 'transparent',
                      cursor: hasStrokes && !isProcessing ? 'pointer' : 'not-allowed',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {isProcessing ? (
                      <SpinnerIcon size={18} className="spin" />
                    ) : (
                      <SparkleIcon size={18} weight="fill" />
                    )}
                  </button>
                  <button
                    type="button"
                    className="tool-bar-item btn-toggle-scroll"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsClosed(true);
                    }}
                    title="Roll up scroll"
                    aria-label="Roll up scroll"
                  >
                    <CaretRightIcon size={18} weight="bold" />
                  </button>
                </>
              }
              onStrokesChange={handleStrokesChange}
            />

            {/* Modular SVG Error Bounding Boxes & Directional Suggestion Speech Bubbles Overlay */}
            {errors && errors.length > 0 && (
              <GlyphDiagnosticsOverlay
                errors={errors}
                canvasElement={drawingCanvasRef.current?.getCanvasElement()}
                canvasWidth={width}
                canvasHeight={height}
                dismissedErrors={activeDismissed}
                onDismissError={handleDismiss}
                sessionId={sessionId}
              />
            )}
          </div>

          {/* Wooden Roller Bottom */}
          <div className="gameplay-scroll-roller-bottom" />
        </div>
      </div>
    );
  }
);

MiniDrawingPad.displayName = 'MiniDrawingPad';
