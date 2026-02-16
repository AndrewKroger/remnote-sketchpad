import { usePlugin, renderWidget, useRunAsync, useAPIEventListener, AppEvents } from '@remnote/plugin-sdk';
import { useRef, useState, useEffect, useCallback } from 'react';

interface Point {
  x: number;
  y: number;
  pressure: number;
}

interface Stroke {
  points: Point[];
  color: string;
  lineWidth: number;
}

type Tool = 'pen' | 'eraser';
type EraserMode = 'pixel' | 'stroke';

const COLORS = ['#1a1a2e', '#e53e3e', '#dd6b20', '#d69e2e', '#38a169', '#3182ce', '#805ad5'];

// Setting IDs
const SETTING_ERASER_KEY = 'sketchpad-eraser-key';
const SETTING_DEFAULT_ERASER_MODE = 'sketchpad-default-eraser-mode';

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column' as const,
    height: '100%',
    minHeight: '400px',
    backgroundColor: 'var(--rn-clr-background-primary, #ffffff)',
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    overflow: 'hidden',
    userSelect: 'none' as const,
    WebkitUserSelect: 'none' as const,
    WebkitTouchCallout: 'none' as const,
  },
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 12px',
    backgroundColor: 'var(--rn-clr-background-primary, #ffffff)',
    borderBottom: '1px solid var(--rn-clr-border-opaque, #e2e8f0)',
  },
  toolButtons: {
    display: 'flex',
    gap: '4px',
    flexShrink: 0,
  },
  toolBtn: {
    padding: '6px 10px',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'var(--rn-clr-border-opaque, #e2e8f0)',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: 500,
    transition: 'all 0.15s ease',
    backgroundColor: 'var(--rn-clr-background-primary, #ffffff)',
    color: 'var(--rn-clr-content-secondary, #475569)',
    display: 'flex',
    alignItems: 'center',
    gap: '3px',
    whiteSpace: 'nowrap' as const,
  },
  toolBtnActive: {
    backgroundColor: 'var(--rn-clr-background-accent, #3b82f6)',
    color: '#ffffff',
    borderColor: 'var(--rn-clr-background-accent, #3b82f6)',
  },
  colorPicker: {
    flex: 1,
    display: 'flex',
    gap: '4px',
    alignItems: 'center',
    justifyContent: 'flex-end',
    minWidth: 0,
  },
  colorSwatch: {
    width: '22px',
    height: '22px',
    borderRadius: '50%',
    border: '2px solid transparent',
    cursor: 'pointer',
    transition: 'all 0.1s ease',
    flexShrink: 0,
  },
  colorSwatchActive: {
    border: '2px solid var(--rn-clr-background-accent, #3b82f6)',
    transform: 'scale(1.15)',
  },
  eraserModeBtn: {
    padding: '4px 8px',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'var(--rn-clr-border-opaque, #e2e8f0)',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '11px',
    fontWeight: 500,
    transition: 'all 0.15s ease',
    backgroundColor: 'var(--rn-clr-background-secondary, #f1f5f9)',
    color: 'var(--rn-clr-content-secondary, #475569)',
  },
  eraserModeBtnActive: {
    backgroundColor: 'var(--rn-clr-background-accent, #3b82f6)',
    color: '#ffffff',
    borderColor: 'var(--rn-clr-background-accent, #3b82f6)',
  },
  canvasWrapper: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column' as const,
    overflow: 'hidden',
    backgroundColor: 'var(--rn-clr-background-secondary, #f8fafc)',
    position: 'relative' as const,
  },
  canvas: {
    backgroundColor: '#ffffff',
    touchAction: 'none' as const,
    cursor: 'crosshair',
    width: '100%',
    flex: 1,
  },
  gridOverlay: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    pointerEvents: 'none' as const,
    backgroundImage: `
      linear-gradient(to right, rgba(0,0,0,0.03) 1px, transparent 1px),
      linear-gradient(to bottom, rgba(0,0,0,0.03) 1px, transparent 1px)
    `,
    backgroundSize: '20px 20px',
  },
  hintOverlay: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    pointerEvents: 'none' as const,
    opacity: 0.1,
    backgroundSize: 'contain',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
  },
  footer: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 12px',
    backgroundColor: 'var(--rn-clr-background-primary, #ffffff)',
    borderTop: '1px solid var(--rn-clr-border-opaque, #e2e8f0)',
  },
  footerBtn: {
    padding: '6px 12px',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: 500,
    transition: 'all 0.15s ease',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  saveBtn: {
    backgroundColor: 'var(--rn-clr-background-accent, #3b82f6)',
    color: '#ffffff',
  },
  hintBtn: {
    backgroundColor: 'var(--rn-clr-background-secondary, #f1f5f9)',
    color: 'var(--rn-clr-content-secondary, #64748b)',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'var(--rn-clr-border-opaque, #e2e8f0)',
  },
  hintBtnActive: {
    backgroundColor: '#fef3c7',
    color: '#d97706',
    borderColor: '#fcd34d',
  },
  clearBtn: {
    backgroundColor: 'transparent',
    color: 'var(--rn-clr-content-tertiary, #94a3b8)',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'var(--rn-clr-border-opaque, #e2e8f0)',
  },
};

export const SketchpadWidget = () => {
  const plugin = usePlugin();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const lastPointRef = useRef<Point | null>(null);
  const strokesRef = useRef<Stroke[]>([]);
  const currentStrokeRef = useRef<Stroke | null>(null);

  const [tool, setTool] = useState<Tool>('pen');
  const [eraserMode, setEraserMode] = useState<EraserMode>('pixel');
  const [color, setColor] = useState('#1a1a2e');
  const [isDrawing, setIsDrawing] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [hintImageUrl, setHintImageUrl] = useState<string | null>(null);
  const [currentRemId, setCurrentRemId] = useState<string | null>(null);
  const [isHoldingEraserKey, setIsHoldingEraserKey] = useState(false);

  // Load settings
  const eraserKey = useRunAsync(
    () => plugin.settings.getSetting<string>(SETTING_ERASER_KEY),
    []
  );
  
  const defaultEraserMode = useRunAsync(
    () => plugin.settings.getSetting<string>(SETTING_DEFAULT_ERASER_MODE),
    []
  );

  // Set default eraser mode from settings
  useEffect(() => {
    if (defaultEraserMode === 'stroke' || defaultEraserMode === 'pixel') {
      setEraserMode(defaultEraserMode);
    }
  }, [defaultEraserMode]);

  // Listen for eraser shortcut key
  useEffect(() => {
    if (!eraserKey || eraserKey === 'none') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const keyMatches = 
        (eraserKey === 'shift' && e.shiftKey) ||
        (eraserKey === 'control' && e.ctrlKey) ||
        (eraserKey === 'alt' && e.altKey) ||
        (eraserKey === 'meta' && e.metaKey);
      
      if (keyMatches && !isHoldingEraserKey) {
        setIsHoldingEraserKey(true);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const keyReleased = 
        (eraserKey === 'shift' && !e.shiftKey) ||
        (eraserKey === 'control' && !e.ctrlKey) ||
        (eraserKey === 'alt' && !e.altKey) ||
        (eraserKey === 'meta' && !e.metaKey);
      
      if (keyReleased && isHoldingEraserKey) {
        setIsHoldingEraserKey(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [eraserKey, isHoldingEraserKey]);

  // Determine active tool (pen or eraser based on tool state + shortcut key)
  const activeTool = isHoldingEraserKey ? 'eraser' : tool;

  // Listen for card completion
  useAPIEventListener(AppEvents.QueueCompleteCard, undefined, async () => {
    clearCanvasNow();
    strokesRef.current = [];
    setShowHint(false);
    setHintImageUrl(null);
    
    setTimeout(async () => {
      const card = await plugin.queue.getCurrentCard();
      setCurrentRemId(card?.remId || null);
    }, 100);
  });

  useAPIEventListener(AppEvents.QueueEnter, undefined, async () => {
    const card = await plugin.queue.getCurrentCard();
    setCurrentRemId(card?.remId || null);
  });

  useEffect(() => {
    const loadCurrentCard = async () => {
      const card = await plugin.queue.getCurrentCard();
      setCurrentRemId(card?.remId || null);
    };
    loadCurrentCard();
  }, [plugin]);

  const clearCanvasNow = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx || !canvas) return;

    const dpr = window.devicePixelRatio || 1;
    const width = canvas.width / dpr;
    const height = canvas.height / dpr;

    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
  }, []);

  const redrawStrokes = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx || !canvas) return;

    const dpr = window.devicePixelRatio || 1;
    const width = canvas.width / dpr;
    const height = canvas.height / dpr;

    // Clear canvas
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    // Redraw all strokes
    for (const stroke of strokesRef.current) {
      if (stroke.points.length < 2) continue;
      
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.lineWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      
      ctx.beginPath();
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
      for (let i = 1; i < stroke.points.length; i++) {
        ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
      }
      ctx.stroke();
    }
  }, []);

  // Load hint image
  useEffect(() => {
    const loadHintImage = async () => {
      if (!currentRemId) {
        setHintImageUrl(null);
        return;
      }

      try {
        const rem = await plugin.rem.findOne(currentRemId);
        if (!rem?.backText) {
          setHintImageUrl(null);
          return;
        }

        for (const item of rem.backText) {
          if (typeof item === 'object' && item.i === 'i' && item.url) {
            let url = item.url;
            if (url.startsWith('%LOCAL_FILE%')) {
              const fileId = url.replace('%LOCAL_FILE%', '');
              url = `https://remnote-user-data.s3.amazonaws.com/${fileId}`;
            }
            setHintImageUrl(url);
            return;
          }
        }
        setHintImageUrl(null);
      } catch {
        setHintImageUrl(null);
      }
    };

    loadHintImage();
  }, [currentRemId, plugin]);

  // Canvas setup
  useEffect(() => {
    const canvas = canvasRef.current;
    const wrapper = wrapperRef.current;
    if (!canvas || !wrapper) return;

    const setupCanvas = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = wrapper.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;

      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      canvas.width = width * dpr;
      canvas.height = height * dpr;

      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.scale(dpr, dpr);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
      }
      
      // Redraw existing strokes after resize
      redrawStrokes();
    };

    setTimeout(setupCanvas, 100);

    const resizeObserver = new ResizeObserver(() => {
      setTimeout(setupCanvas, 50);
    });
    resizeObserver.observe(wrapper);

    return () => resizeObserver.disconnect();
  }, [redrawStrokes]);

  const clearCanvas = useCallback(() => {
    clearCanvasNow();
    strokesRef.current = [];
  }, [clearCanvasNow]);

  const getPoint = useCallback((e: React.PointerEvent<HTMLCanvasElement>): Point => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      pressure: e.pressure || 0.5,
    };
  }, []);

  // Check if a point is near a stroke (for stroke erasing)
  const isPointNearStroke = useCallback((point: Point, stroke: Stroke, threshold: number = 15): boolean => {
    for (const strokePoint of stroke.points) {
      const dx = point.x - strokePoint.x;
      const dy = point.y - strokePoint.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance < threshold) {
        return true;
      }
    }
    return false;
  }, []);

  const drawLine = useCallback((from: Point, to: Point, currentTool: Tool) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;

    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (currentTool === 'eraser') {
      if (eraserMode === 'stroke') {
        // Check for stroke intersection and remove whole strokes
        const strokesRemoved = strokesRef.current.filter(stroke => !isPointNearStroke(to, stroke));
        if (strokesRemoved.length !== strokesRef.current.length) {
          strokesRef.current = strokesRemoved;
          redrawStrokes();
        }
      } else {
        // Pixel erase
        ctx.globalCompositeOperation = 'destination-out';
        ctx.lineWidth = 20;
        ctx.stroke();
      }
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = color;
      ctx.lineWidth = 2 + to.pressure * 4;
      ctx.stroke();
    }
  }, [color, eraserMode, isPointNearStroke, redrawStrokes]);

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Palm rejection: only respond to pen (Apple Pencil), ignore touch
    if (e.pointerType === 'touch') {
      return; // Ignore palm/finger touches
    }
    
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.setPointerCapture(e.pointerId);
    const point = getPoint(e);
    lastPointRef.current = point;
    setIsDrawing(true);

    // Start new stroke if using pen
    if (activeTool === 'pen') {
      currentStrokeRef.current = {
        points: [point],
        color: color,
        lineWidth: 2 + point.pressure * 4,
      };
    }

    drawLine(point, point, activeTool);
  }, [getPoint, drawLine, activeTool, color]);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    // Palm rejection: only respond to pen, ignore touch
    if (e.pointerType === 'touch') return;
    
    if (!isDrawing || !lastPointRef.current) return;
    e.preventDefault();
    e.stopPropagation();

    const point = getPoint(e);
    drawLine(lastPointRef.current, point, activeTool);
    
    // Add point to current stroke
    if (activeTool === 'pen' && currentStrokeRef.current) {
      currentStrokeRef.current.points.push(point);
    }
    
    lastPointRef.current = point;
  }, [isDrawing, getPoint, drawLine, activeTool]);

  const handlePointerUp = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (canvas && e.pointerId !== undefined) {
      try {
        canvas.releasePointerCapture(e.pointerId);
      } catch {
        // Ignore
      }
    }
    
    // Save completed stroke
    if (activeTool === 'pen' && currentStrokeRef.current && currentStrokeRef.current.points.length > 0) {
      strokesRef.current.push(currentStrokeRef.current);
      currentStrokeRef.current = null;
    }
    
    setIsDrawing(false);
    lastPointRef.current = null;
  }, [activeTool]);

  // Prevent context menu (iOS text selection menu)
  const handleContextMenu = useCallback((e: React.MouseEvent | React.TouchEvent | Event) => {
    e.preventDefault();
    e.stopPropagation();
    return false;
  }, []);

  // Prevent all touch-related menus and selection
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    e.stopPropagation();
    // Prevent iOS callout menu
    if (e.touches.length > 1) {
      e.preventDefault();
    }
  }, []);

  // Prevent selection on long press
  const handleSelectStart = useCallback((e: Event) => {
    e.preventDefault();
    return false;
  }, []);

  // Add document-level prevention when canvas is active
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Prevent context menu at document level when interacting with canvas
    const preventContextMenu = (e: Event) => {
      if (e.target === canvas || canvas.contains(e.target as Node)) {
        e.preventDefault();
        return false;
      }
    };

    const preventSelect = (e: Event) => {
      if (e.target === canvas || canvas.contains(e.target as Node)) {
        e.preventDefault();
        return false;
      }
    };

    document.addEventListener('contextmenu', preventContextMenu, { capture: true });
    document.addEventListener('selectstart', preventSelect, { capture: true });
    
    return () => {
      document.removeEventListener('contextmenu', preventContextMenu, { capture: true });
      document.removeEventListener('selectstart', preventSelect, { capture: true });
    };
  }, []);

  const saveSketch = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    try {
      let targetRemId: string | null = currentRemId;
      
      if (!targetRemId) {
        const focusedRem = await plugin.focus.getFocusedRem();
        if (focusedRem) {
          targetRemId = focusedRem._id;
        }
      }

      if (!targetRemId) {
        await plugin.app.toast('Focus on a Rem or review a card first');
        return;
      }

      const dataUrl = canvas.toDataURL('image/png');
      const newRem = await plugin.rem.createRem();
      if (!newRem) {
        await plugin.app.toast('Failed to create Rem');
        return;
      }

      await newRem.setText(['Sketch: ', { i: 'i', url: dataUrl }]);
      await newRem.setParent(targetRemId);
      await plugin.app.toast('✓ Saved!');
      clearCanvas();
    } catch (error) {
      console.error('[Sketchpad] Save error:', error);
      await plugin.app.toast('Failed to save');
    }
  }, [plugin, clearCanvas, currentRemId]);

  return (
    <div 
      style={styles.container}
      onContextMenu={handleContextMenu}
      onTouchStart={handleTouchStart}
    >
      {/* Toolbar */}
      <div style={styles.toolbar}>
        <div style={styles.toolButtons}>
          <button
            style={{
              ...styles.toolBtn,
              ...(tool === 'pen' && !isHoldingEraserKey ? styles.toolBtnActive : {}),
            }}
            onClick={() => setTool('pen')}
          >
            ✏️
          </button>
          <button
            style={{
              ...styles.toolBtn,
              ...(tool === 'eraser' || isHoldingEraserKey ? styles.toolBtnActive : {}),
            }}
            onClick={() => setTool('eraser')}
          >
            🧹
          </button>
        </div>
        
        {/* Show color palette for pen, eraser mode buttons for eraser */}
        <div style={styles.colorPicker}>
          {tool === 'eraser' || isHoldingEraserKey ? (
            // Eraser mode buttons
            <>
              <button
                style={{
                  ...styles.eraserModeBtn,
                  ...(eraserMode === 'pixel' ? styles.eraserModeBtnActive : {}),
                }}
                onClick={() => setEraserMode('pixel')}
              >
                Pixel
              </button>
              <button
                style={{
                  ...styles.eraserModeBtn,
                  ...(eraserMode === 'stroke' ? styles.eraserModeBtnActive : {}),
                }}
                onClick={() => setEraserMode('stroke')}
              >
                Stroke
              </button>
            </>
          ) : (
            // Color palette
            COLORS.map((c) => (
              <div
                key={c}
                style={{
                  ...styles.colorSwatch,
                  backgroundColor: c,
                  ...(color === c ? styles.colorSwatchActive : {}),
                }}
                onClick={() => setColor(c)}
              />
            ))
          )}
        </div>
      </div>

      {/* Canvas area */}
      <div 
        ref={wrapperRef} 
        style={styles.canvasWrapper}
        onContextMenu={handleContextMenu}
      >
        <div style={styles.gridOverlay} />
        {showHint && hintImageUrl && (
          <div
            style={{
              ...styles.hintOverlay,
              backgroundImage: `url(${hintImageUrl})`,
            }}
          />
        )}
        <canvas
          ref={canvasRef}
          style={styles.canvas}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onContextMenu={handleContextMenu}
          onTouchStart={handleTouchStart}
          onSelect={handleSelectStart as any}
        />
      </div>

      {/* Footer */}
      <div style={styles.footer}>
        <button
          style={{ ...styles.footerBtn, ...styles.saveBtn }}
          onClick={saveSketch}
        >
          💾 Save
        </button>
        <button
          style={{
            ...styles.footerBtn,
            ...styles.hintBtn,
            ...(showHint ? styles.hintBtnActive : {}),
          }}
          onClick={() => setShowHint(!showHint)}
          disabled={!hintImageUrl}
          title={hintImageUrl ? 'Show answer image as hint' : 'No image on back of card'}
        >
          💡 Hint
        </button>
        <button
          style={{ ...styles.footerBtn, ...styles.clearBtn }}
          onClick={clearCanvas}
        >
          Clear
        </button>
      </div>
    </div>
  );
};

renderWidget(SketchpadWidget);
