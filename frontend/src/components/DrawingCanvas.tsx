import React, { useEffect, useRef, useState, useImperativeHandle, forwardRef, useCallback } from 'react';
import {
  PenIcon,
  EraserIcon,
  ArrowArcLeftIcon,
  ArrowArcRightIcon,
  TrashIcon,
  Icon,
} from '@phosphor-icons/react';
import Atrament, { StrokeData } from 'atrament';
import { useIsMobile, getIsMobile } from '../lib/useIsMobile';
import { centerStrokesOnCanvas } from '../lib/glyph_helpers/glyph_canvas_loader';

export interface DrawingCanvasRef {
  getCanvasElement: () => HTMLCanvasElement | null;
  getAtramentInstance: () => Atrament | null;
  clear: () => void;
  undo: () => void;
  redo: () => void;
  getStrokes: () => StrokeData[];
  isEmpty: () => boolean;
  loadStrokes: (strokes: StrokeData[], autoCenter?: boolean) => void;
  toDataURL: (type?: string, quality?: any) => string;
  toBlob: (callback: BlobCallback, type?: string, quality?: any) => void;
}

export interface DrawingCanvasProps {
  width?: number | string;
  height?: number | string;
  showToolbar?: boolean;
  toolbarPosition?: 'left' | 'right' | 'top' | 'bottom' | 'none';
  toolbarOrientation?: 'horizontal' | 'vertical';
  toolbarExtraContent?: React.ReactNode;
  toolbarClassName?: string;
  showGuide?: boolean;
  guideColor?: string;
  guideSize?: string | number;
  onStrokesChange?: (strokes: StrokeData[]) => void;
  className?: string;
  canvasClassName?: string;
  defaultBrushSize?: number;
  fixedBrushSize?: boolean;
  brushColor?: string;
  backgroundColor?: string;
  backgroundImage?: string;
  smoothing?: number;
  adaptiveStroke?: boolean;
  style?: React.CSSProperties;
}

interface ToolBarItemRef {
  icon: Icon;
  name: string;
  position: number;
  keybind?: string;
}

const defaultToolBar: Array<ToolBarItemRef> = [
  { icon: PenIcon, name: 'Pen', position: 1, keybind: 'd' },
  { icon: EraserIcon, name: 'Eraser', position: 2, keybind: 'e' },
  { icon: ArrowArcLeftIcon, name: 'Undo', position: 3, keybind: 'ctrl+z' },
  { icon: ArrowArcRightIcon, name: 'Redo', position: 4, keybind: 'ctrl+shift+z' },
  { icon: TrashIcon, name: 'Clear', position: 5, keybind: 'c' },
];

interface TooltipProps {
  name: string;
  keybind?: string;
  description?: string;
  hideShortcut?: boolean;
  children: React.ReactNode;
}

const Tooltip: React.FC<TooltipProps> = ({ name, keybind, description, hideShortcut, children }) => {
  const isMobile = useIsMobile();
  const shouldHideShortcut = hideShortcut ?? isMobile;

  return (
    <div className="tooltip-wrapper">
      <div className="tooltip-children">{children}</div>
      <div className="tooltip-bubble" role="tooltip">
        <span className="tooltip-name">{name}</span>
        {!shouldHideShortcut && keybind && <span className="tooltip-keybind">({keybind})</span>}
        {description && <div className="tooltip-description">{description}</div>}
      </div>
    </div>
  );
};

interface TooltipMenuProps {
  name: string;
  keybind?: string;
  size: number;
  minSize?: number;
  maxSize?: number;
  onSizeChange: (newSize: number) => void;
  hideShortcut?: boolean;
  isOpen?: boolean;
  onToggleOpen?: () => void;
  onClose?: () => void;
  children: React.ReactNode;
}

const TooltipMenu: React.FC<TooltipMenuProps> = ({
  name,
  keybind,
  size,
  minSize = 2,
  maxSize = 60,
  onSizeChange,
  hideShortcut,
  isOpen: controlledIsOpen,
  onToggleOpen,
  onClose,
  children,
}) => {
  const isMobile = useIsMobile();
  const shouldHideShortcut = hideShortcut ?? isMobile;
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalIsOpen;
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Close when tapping/clicking outside on touch/mobile devices
  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDownOutside = (e: PointerEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        if (onClose) onClose();
        else setInternalIsOpen(false);
      }
    };

    window.addEventListener('pointerdown', handlePointerDownOutside);
    return () => window.removeEventListener('pointerdown', handlePointerDownOutside);
  }, [isOpen, onClose]);

  const handleMouseEnter = () => {
    if (!isMobile) {
      if (onToggleOpen && !isOpen) onToggleOpen();
      else setInternalIsOpen(true);
    }
  };

  const handleMouseLeave = () => {
    if (!isMobile) {
      if (onClose) onClose();
      else setInternalIsOpen(false);
    }
  };

  return (
    <div
      ref={wrapperRef}
      className={`tooltip-wrapper tooltip-menu-wrapper ${isOpen ? 'tooltip-menu-open' : ''}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div
        className="tooltip-children"
        onClick={() => {
          if (isMobile) {
            if (onToggleOpen) onToggleOpen();
            else setInternalIsOpen((prev) => !prev);
          }
        }}
      >
        {children}
      </div>
      <div className="tooltip-bubble tooltip-menu-bubble" role="tooltip">
        <div className="tooltip-menu-header">
          <span className="tooltip-name">{name}</span>
          {!shouldHideShortcut && keybind && <span className="tooltip-keybind">({keybind})</span>}
        </div>
        <div className="tooltip-menu-slider-group">
          <label htmlFor={`slider-${name}`} className="tooltip-slider-label">
            Size <span className="tooltip-slider-value">{size}px</span>
          </label>
          <input
            id={`slider-${name}`}
            type="range"
            min={minSize}
            max={maxSize}
            value={size}
            onChange={(e) => onSizeChange(Number(e.target.value))}
            className="tooltip-slider"
          />
        </div>
      </div>
    </div>
  );
};

function resolveCssColor(color: string): string {
  if (typeof window !== 'undefined' && color.startsWith('var(')) {
    const inner = color.slice(4, -1).trim();
    const commaIdx = inner.indexOf(',');
    const varName = commaIdx !== -1 ? inner.substring(0, commaIdx).trim() : inner;
    const fallback = commaIdx !== -1 ? inner.substring(commaIdx + 1).trim() : '';
    const resolved = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
    if (resolved) return resolved;
    if (fallback) return fallback;
  }
  return color;
}

export const DrawingCanvas = forwardRef<DrawingCanvasRef, DrawingCanvasProps>(
  (
    {
      width,
      height,
      showToolbar = true,
      toolbarPosition = 'left',
      toolbarOrientation,
      toolbarExtraContent,
      toolbarClassName = '',
      showGuide = false,
      guideColor,
      guideSize,
      onStrokesChange,
      className = '',
      canvasClassName = '',
      defaultBrushSize,
      fixedBrushSize = false,
      brushColor = 'var(--admin-brush, #000000)',
      backgroundColor,
      backgroundImage,
      smoothing = 0.88,
      adaptiveStroke = true,
      style,
    },
    ref
  ) => {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const atramentRef = useRef<Atrament | null>(null);
    const isMobile = useIsMobile();

    const [selectedTool, setSelectedTool] = useState<'pen' | 'eraser'>('pen');
    const [strokes, setStrokes] = useState<StrokeData[]>([]);
    const [redoStrokes, setRedoStrokes] = useState<StrokeData[]>([]);
    // Default pen size is 3px on mobile and 8px on desktop if not explicitly overridden
    const [brushSize, setBrushSize] = useState<number>(() => defaultBrushSize ?? (getIsMobile() ? 3 : 8));
    const [eraserWeight, setEraserWeight] = useState<number>(() => (defaultBrushSize ?? (getIsMobile() ? 3 : 8)) + 5);
    const [activeMenuTool, setActiveMenuTool] = useState<string | null>(null);
    const userAdjustedBrushRef = useRef(false);

    // Sync default brush size only if switching between mobile/desktop and user hasn't explicitly set their own size
    useEffect(() => {
      if (defaultBrushSize === undefined && !userAdjustedBrushRef.current) {
        const targetSize = isMobile ? 3 : 8;
        setBrushSize(targetSize);
        setEraserWeight(targetSize + 10);
      }
    }, [isMobile, defaultBrushSize]);

    const drawStroke = useCallback((stroke: StrokeData, atrament: Atrament) => {
      const segments = [...stroke.segments];
      if (segments.length === 0) return;

      atrament.mode = stroke.mode;
      atrament.weight = stroke.weight;
      atrament.color = stroke.color;

      const firstSegment = segments.shift();
      if (firstSegment) {
        atrament.beginStroke(firstSegment.point.x, firstSegment.point.y);
        let prevPoint = firstSegment.point;

        for (const segment of segments) {
          const { x, y } = atrament.draw(
            segment.point.x,
            segment.point.y,
            prevPoint.x,
            prevPoint.y,
            segment.pressure
          );
          prevPoint = { x, y };
        }
        atrament.endStroke(prevPoint.x, prevPoint.y);
      }
    }, []);

    // Track the dimensions used when strokes were recorded, so we can rescale on resize.
    const canvasDimsRef = useRef<{ w: number; h: number }>({ w: 0, h: 0 });
    // Store strokes in a ref so the resize callback can access the latest without re-subscribing.
    const strokesRef = useRef<StrokeData[]>(strokes);
    strokesRef.current = strokes;

    // Replay strokes helper (pure, no state side-effects)
    const replayStrokesOnAtrament = useCallback(
      (atrament: Atrament, strokesToReplay: StrokeData[]) => {
        atrament.clear();
        atrament.recordStrokes = false;
        strokesToReplay.forEach((stroke) => drawStroke(stroke, atrament));
        atrament.recordStrokes = true;
        // Restore active tool state
        const isEraser = selectedTool === 'eraser';
        atrament.mode = isEraser ? 'erase' : 'draw';
        atrament.weight = isEraser ? eraserWeight : brushSize;
        atrament.color = resolveCssColor(brushColor);
      },
      [drawStroke, selectedTool, eraserWeight, brushSize, brushColor]
    );

    // Rescale all stroke coordinates from oldDims → newDims proportionally (no warping)
    const rescaleStrokes = useCallback(
      (
        source: StrokeData[],
        oldW: number,
        oldH: number,
        newW: number,
        newH: number
      ): StrokeData[] => {
        if (!source || source.length === 0) return source;
        if (oldW <= 0 || oldH <= 0 || newW <= 0 || newH <= 0) return source;
        if (oldW === newW && oldH === newH) return source;

        // Proportional uniform scaling: preserves circular aspect ratio and prevents warping
        const scale = Math.min(newW / oldW, newH / oldH);
        const oldCx = oldW / 2;
        const oldCy = oldH / 2;
        const newCx = newW / 2;
        const newCy = newH / 2;

        return source.map((stroke) => ({
          ...stroke,
          segments: stroke.segments.map((seg) => ({
            ...seg,
            point: {
              x: Math.round(newCx + (seg.point.x - oldCx) * scale),
              y: Math.round(newCy + (seg.point.y - oldCy) * scale),
            },
          })),
        }));
      },
      []
    );

    // Initialize Atrament + ResizeObserver for responsive canvas dimensions
    useEffect(() => {
      if (!canvasRef.current) return;

      const canvas = canvasRef.current;
      const container = canvas.parentElement;

      // Helper: size the canvas buffer to match CSS layout size
      const syncCanvasSize = (): { w: number; h: number } => {
        const rect = canvas.getBoundingClientRect();
        const parentRect = container?.getBoundingClientRect();
        const cssW = typeof width === 'number'
          ? width
          : Math.round(rect.width || parentRect?.width || container?.clientWidth || 500);
        const cssH = typeof height === 'number'
          ? height
          : Math.round(rect.height || parentRect?.height || container?.clientHeight || 500);
        canvas.width = cssW;
        canvas.height = cssH;
        return { w: cssW, h: cssH };
      };

      // Initial size
      const dims = syncCanvasSize();
      canvasDimsRef.current = dims;

      const actualColor = resolveCssColor(brushColor);
      const sketchpad = new Atrament(canvas, {
        width: dims.w,
        height: dims.h,
        color: actualColor,
        adaptiveStroke,
        smoothing,
      });

      sketchpad.weight = selectedTool === 'eraser' ? eraserWeight : brushSize;
      sketchpad.mode = selectedTool === 'eraser' ? 'erase' : 'draw';
      sketchpad.smoothing = smoothing;
      sketchpad.adaptiveStroke = adaptiveStroke;
      sketchpad.recordStrokes = true;
      atramentRef.current = sketchpad;

      sketchpad.addEventListener('strokerecorded', ({ stroke }) => {
        setStrokes((prev) => {
          const updated = [...prev, stroke];
          strokesRef.current = updated;
          if (onStrokesChange) onStrokesChange(updated);
          return updated;
        });
        setRedoStrokes([]);
      });

      // --- Resize handler: re-sync canvas + rescale & replay strokes on resize ---
      const handleResize = () => {
        if (!canvasRef.current || !atramentRef.current) return;

        const oldDims = canvasDimsRef.current;
        const rect = canvasRef.current.getBoundingClientRect();
        const parentRect = container?.getBoundingClientRect();
        const newCssW = typeof width === 'number'
          ? width
          : Math.round(rect.width || parentRect?.width || container?.clientWidth || 500);
        const newCssH = typeof height === 'number'
          ? height
          : Math.round(rect.height || parentRect?.height || container?.clientHeight || 500);

        // Skip if size hasn't actually changed or dimensions are non-positive
        if (newCssW === oldDims.w && newCssH === oldDims.h) return;
        if (newCssW <= 0 || newCssH <= 0) return;

        // 1. Rescale recorded strokes from old coordinate space → new proportionally
        const currentStrokes = strokesRef.current;
        const scaled = rescaleStrokes(currentStrokes, oldDims.w, oldDims.h, newCssW, newCssH);
        strokesRef.current = scaled;

        // 2. Destroy old Atrament and create fresh with new dimensions
        atramentRef.current.destroy();

        canvasRef.current.width = newCssW;
        canvasRef.current.height = newCssH;
        canvasDimsRef.current = { w: newCssW, h: newCssH };

        const resized = new Atrament(canvasRef.current, {
          width: newCssW,
          height: newCssH,
          color: resolveCssColor(brushColor),
          adaptiveStroke,
          smoothing,
        });

        resized.weight = selectedTool === 'eraser' ? eraserWeight : brushSize;
        resized.mode = selectedTool === 'eraser' ? 'erase' : 'draw';
        resized.smoothing = smoothing;
        resized.adaptiveStroke = adaptiveStroke;
        resized.recordStrokes = true;
        atramentRef.current = resized;

        // Re-register the stroke listener
        resized.addEventListener('strokerecorded', ({ stroke }) => {
          setStrokes((prev) => {
            const updated = [...prev, stroke];
            strokesRef.current = updated;
            if (onStrokesChange) onStrokesChange(updated);
            return updated;
          });
          setRedoStrokes([]);
        });

        // 3. Replay rescaled strokes and update state
        replayStrokesOnAtrament(resized, scaled);
        setStrokes(scaled);
        setRedoStrokes([]);
        if (onStrokesChange) onStrokesChange(scaled);
      };

      let resizeRafId: number | null = null;
      const onResize = () => {
        if (resizeRafId !== null) cancelAnimationFrame(resizeRafId);
        resizeRafId = requestAnimationFrame(handleResize);
      };

      const observer = new ResizeObserver(onResize);
      if (container) observer.observe(container);
      window.addEventListener('resize', onResize);

      return () => {
        observer.disconnect();
        window.removeEventListener('resize', onResize);
        if (resizeRafId !== null) cancelAnimationFrame(resizeRafId);
        sketchpad.destroy();
        atramentRef.current = null;
      };
    }, [width, height, brushColor, smoothing, adaptiveStroke]);


    const redrawAllStrokes = useCallback(
      (strokesToDraw: StrokeData[], atrament: Atrament) => {
        atrament.clear();
        atrament.recordStrokes = false;

        strokesToDraw.forEach((stroke) => {
          drawStroke(stroke, atrament);
        });

        atrament.recordStrokes = true;

        const isEraser = selectedTool === 'eraser';
        atrament.mode = isEraser ? 'erase' : 'draw';
        atrament.weight = isEraser ? eraserWeight : brushSize;
        atrament.color = brushColor;
      },
      [drawStroke, selectedTool, eraserWeight, brushSize, brushColor]
    );

    const undo = useCallback(() => {
      const atrament = atramentRef.current;
      if (!atrament || strokes.length === 0) return;

      const nextStrokes = [...strokes];
      const popped = nextStrokes.pop();
      if (!popped) return;

      strokesRef.current = nextStrokes;
      setStrokes(nextStrokes);
      setRedoStrokes((prev) => [...prev, popped]);
      redrawAllStrokes(nextStrokes, atrament);
      if (onStrokesChange) onStrokesChange(nextStrokes);
    }, [strokes, redrawAllStrokes, onStrokesChange]);

    const redo = useCallback(() => {
      const atrament = atramentRef.current;
      if (!atrament || redoStrokes.length === 0) return;

      const nextRedo = [...redoStrokes];
      const popped = nextRedo.pop();
      if (!popped) return;

      const nextStrokes = [...strokes, popped];
      strokesRef.current = nextStrokes;
      setRedoStrokes(nextRedo);
      setStrokes(nextStrokes);
      redrawAllStrokes(nextStrokes, atrament);
      if (onStrokesChange) onStrokesChange(nextStrokes);
    }, [redoStrokes, strokes, redrawAllStrokes, onStrokesChange]);

    const clear = useCallback(() => {
      const atrament = atramentRef.current;
      if (atrament) {
        atrament.clear();
      }
      strokesRef.current = [];
      setStrokes([]);
      setRedoStrokes([]);
      if (onStrokesChange) onStrokesChange([]);
    }, [onStrokesChange]);

    // Sync active tool state with Atrament
    useEffect(() => {
      if (!atramentRef.current) return;
      const isEraser = selectedTool === 'eraser';
      atramentRef.current.mode = isEraser ? 'erase' : 'draw';
      atramentRef.current.weight = isEraser ? eraserWeight : brushSize;
    }, [selectedTool, brushSize, eraserWeight]);

    // Handle tool changes
    const handleToolChange = (toolName: string) => {
      const norm = toolName.toLowerCase();
      if (norm === 'undo') {
        undo();
        setActiveMenuTool(null);
      } else if (norm === 'redo') {
        redo();
        setActiveMenuTool(null);
      } else if (norm === 'clear') {
        clear();
        setActiveMenuTool(null);
      } else if (norm === 'eraser') {
        if (selectedTool === 'eraser' && isMobile) {
          setActiveMenuTool((prev) => (prev === 'eraser' ? null : 'eraser'));
        } else {
          setSelectedTool('eraser');
          if (isMobile) setActiveMenuTool('eraser');
        }
      } else if (norm === 'pen') {
        if (selectedTool === 'pen' && isMobile) {
          setActiveMenuTool((prev) => (prev === 'pen' ? null : 'pen'));
        } else {
          setSelectedTool('pen');
          if (isMobile) setActiveMenuTool('pen');
        }
      }
    };

    const handleBrushSizeChange = (toolName: string, newSize: number) => {
      userAdjustedBrushRef.current = true;
      const norm = toolName.toLowerCase();
      if (norm !== selectedTool) {
        setSelectedTool(norm as 'pen' | 'eraser');
      }
      if (norm === 'eraser') {
        setEraserWeight(newSize);
      } else if (norm === 'pen') {
        setBrushSize(newSize);
      }
    };

    // Keyboard shortcuts
    useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

        const isCtrlOrCmd = e.ctrlKey || e.metaKey;
        const key = e.key.toLowerCase();

        if (isCtrlOrCmd && key === 'z') {
          e.preventDefault();
          if (e.shiftKey) {
            redo();
          } else {
            undo();
          }
        } else if (isCtrlOrCmd && key === 'y') {
          e.preventDefault();
          redo();
        } else if (key === 'd') {
          setSelectedTool('pen');
        } else if (key === 'e') {
          setSelectedTool('eraser');
        } else if (key === 'c' && !isCtrlOrCmd) {
          clear();
        }
      };

      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }, [undo, redo, clear]);

    const loadStrokes = useCallback(
      (strokesToLoad: StrokeData[], autoCenter = true) => {
        const atrament = atramentRef.current;
        const canvas = canvasRef.current;
        if (!atrament || !canvas) return;

        // Ensure canvas internal pixel buffer matches actual layout
        const container = canvas.parentElement;
        const rect = canvas.getBoundingClientRect();
        const parentRect = container?.getBoundingClientRect();
        const currentW = typeof width === 'number'
          ? width
          : Math.round(rect.width || parentRect?.width || container?.clientWidth || canvas.clientWidth || canvas.width || 500);
        const currentH = typeof height === 'number'
          ? height
          : Math.round(rect.height || parentRect?.height || container?.clientHeight || canvas.clientHeight || canvas.height || 500);

        if (currentW > 0 && currentH > 0 && (canvas.width !== currentW || canvas.height !== currentH)) {
          canvas.width = currentW;
          canvas.height = currentH;
        }

        canvasDimsRef.current = { w: currentW, h: currentH };

        // Center strokes if requested and strokes exist
        const finalStrokes = autoCenter && strokesToLoad.length > 0
          ? centerStrokesOnCanvas(strokesToLoad, currentW, currentH)
          : strokesToLoad;

        strokesRef.current = finalStrokes;
        replayStrokesOnAtrament(atrament, finalStrokes);
        setStrokes(finalStrokes);
        setRedoStrokes([]);
        if (onStrokesChange) onStrokesChange(finalStrokes);
      },
      [replayStrokesOnAtrament, onStrokesChange, width, height]
    );

    // Expose imperative handle
    useImperativeHandle(
      ref,
      () => ({
        getCanvasElement: () => canvasRef.current,
        getAtramentInstance: () => atramentRef.current,
        clear,
        undo,
        redo,
        getStrokes: () => strokes,
        isEmpty: () => strokes.length === 0,
        loadStrokes,
        toDataURL: (type?: string, quality?: any) => {
          return canvasRef.current ? canvasRef.current.toDataURL(type, quality) : '';
        },
        toBlob: (callback: BlobCallback, type?: string, quality?: any) => {
          if (canvasRef.current) {
            canvasRef.current.toBlob(callback, type, quality);
          }
        },
      }),
      [clear, undo, redo, strokes, loadStrokes]
    );

    const effectiveOrientation =
      toolbarOrientation ??
      (toolbarPosition === 'top' || toolbarPosition === 'bottom' ? 'horizontal' : 'vertical');

    return (
      <div
        className={`drawing-canvas-wrapper ${className}`}
        style={{
          position: 'relative',
          width: typeof width === 'number' ? `${width}px` : (width ?? '100%'),
          height: typeof height === 'number' ? `${height}px` : (height ?? '100%'),
          backgroundImage: backgroundImage ? `url(${backgroundImage})` : undefined,
          backgroundSize: backgroundImage ? 'cover' : undefined,
          backgroundPosition: backgroundImage ? 'center' : undefined,
          ...style,
        }}
      >
        <canvas
          ref={canvasRef}
          className={`drawing-canvas ${canvasClassName}`}
          onPointerDown={() => setActiveMenuTool(null)}
          style={{
            display: 'block',
            width: '100%',
            height: '100%',
            touchAction: 'none',
            background: backgroundColor ?? (backgroundImage ? 'transparent' : 'var(--admin-paper, #ffffff)'),
          }}
        />

        {showGuide && (
          <svg
            viewBox="0 0 500 500"
            className="drawing-area-guide"
            aria-hidden="true"
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: typeof guideSize === 'number' ? `${guideSize}px` : (guideSize || 'min(440px, 80%)'),
              height: typeof guideSize === 'number' ? `${guideSize}px` : (guideSize || 'min(440px, 80%)'),
              pointerEvents: 'none',
              zIndex: 1,
            }}
          >
            {/* Outer dashed circle (radius R = 220px) */}
            <circle
              cx="250"
              cy="250"
              r="220"
              fill="none"
              stroke={guideColor || 'var(--admin-diagram-guide-accent, rgba(201, 162, 39, 0.75))'}
              strokeWidth="6"
              strokeDasharray="14 10"
            />
            {/* Cardinal dashed lines */}
            <line x1="250" y1="60" x2="250" y2="148" stroke={guideColor || 'var(--admin-diagram-guide-accent, rgba(201, 162, 39, 0.75))'} strokeWidth="6" strokeDasharray="10 8" />
            <line x1="250" y1="440" x2="250" y2="352" stroke={guideColor || 'var(--admin-diagram-guide-accent, rgba(201, 162, 39, 0.75))'} strokeWidth="6" strokeDasharray="10 8" />
            <line x1="60" y1="250" x2="148" y2="250" stroke={guideColor || 'var(--admin-diagram-guide-accent, rgba(201, 162, 39, 0.75))'} strokeWidth="6" strokeDasharray="10 8" />
            <line x1="440" y1="250" x2="352" y2="250" stroke={guideColor || 'var(--admin-diagram-guide-accent, rgba(201, 162, 39, 0.75))'} strokeWidth="6" strokeDasharray="10 8" />
            {/* Outward arrowheads */}
            <path d="M 236 76 L 250 60 L 264 76" fill="none" stroke={guideColor || 'var(--admin-diagram-guide-accent, rgba(201, 162, 39, 0.75))'} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M 236 424 L 250 440 L 264 424" fill="none" stroke={guideColor || 'var(--admin-diagram-guide-accent, rgba(201, 162, 39, 0.75))'} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M 76 236 L 60 250 L 76 264" fill="none" stroke={guideColor || 'var(--admin-diagram-guide-accent, rgba(201, 162, 39, 0.75))'} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M 424 236 L 440 250 L 424 264" fill="none" stroke={guideColor || 'var(--admin-diagram-guide-accent, rgba(201, 162, 39, 0.75))'} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}

        {showToolbar && toolbarPosition !== 'none' && (
          <div className={`tool-box tool-box--${toolbarPosition} tool-box--${effectiveOrientation} ${toolbarClassName}`}>
            {defaultToolBar.map((tool) => {
              const isSelected = selectedTool.toLowerCase() === tool.name.toLowerCase();
              const isInteractiveTool = tool.name.toLowerCase() === 'eraser' || tool.name.toLowerCase() === 'pen';

              if (isInteractiveTool) {
                if (fixedBrushSize) {
                  return (
                    <Tooltip key={tool.name} name={tool.name} keybind={tool.keybind} hideShortcut={isMobile}>
                      <button
                        type="button"
                        className={`tool-bar-item ${isSelected ? 'selected' : ''}`}
                        onClick={() => handleToolChange(tool.name)}
                        aria-label={`${tool.name} (${tool.keybind})`}
                      >
                        <tool.icon size={20} />
                      </button>
                    </Tooltip>
                  );
                }

                const toolKey = tool.name.toLowerCase();
                const isMenuOpen = activeMenuTool === toolKey;

                return (
                  <TooltipMenu
                    key={tool.name}
                    name={tool.name}
                    keybind={tool.keybind}
                    hideShortcut={isMobile}
                    isOpen={isMenuOpen}
                    onToggleOpen={() => setActiveMenuTool((prev) => (prev === toolKey ? null : toolKey))}
                    onClose={() => setActiveMenuTool(null)}
                    size={toolKey === 'pen' ? brushSize : eraserWeight}
                    onSizeChange={(newSize) => handleBrushSizeChange(tool.name, newSize)}
                  >
                    <button
                      type="button"
                      className={`tool-bar-item ${isSelected ? 'selected' : ''}`}
                      onClick={() => handleToolChange(tool.name)}
                      aria-label={`${tool.name} (${tool.keybind})`}
                    >
                      <tool.icon size={20} />
                    </button>
                  </TooltipMenu>
                );
              }

              return (
                <Tooltip key={tool.name} name={tool.name} keybind={tool.keybind} hideShortcut={isMobile}>
                  <button
                    type="button"
                    className={`tool-bar-item ${isSelected ? 'selected' : ''}`}
                    onClick={() => handleToolChange(tool.name)}
                    aria-label={`${tool.name} (${tool.keybind})`}
                  >
                    <tool.icon size={20} />
                  </button>
                </Tooltip>
              );
            })}
            {toolbarExtraContent}
          </div>
        )}
      </div>
    );
  }
);

DrawingCanvas.displayName = 'DrawingCanvas';
