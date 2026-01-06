import { usePlugin, renderWidget, useRunAsync, useAPIEventListener, AppEvents } from '@remnote/plugin-sdk';
import { useRef, useState, useEffect, useCallback } from 'react';

interface Point {
  x: number;
  y: number;
  pressure: number;
}

type Tool = 'pen' | 'eraser';

const COLORS = ['#1a1a2e', '#e53e3e', '#dd6b20', '#d69e2e', '#38a169', '#3182ce', '#805ad5'];

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column' as const,
    height: '100%',
    minHeight: '400px',
    backgroundColor: 'var(--rn-clr-background-primary, #ffffff)',
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    overflow: 'hidden',
  },
  // Compact toolbar
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
  // Color slider/picker
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
  // Canvas area - full width
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
  // Grid overlay
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
  // Hint image overlay
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
  // Compact footer
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
  const lastCardIdRef = useRef<string | null>(null);

  const [tool, setTool] = useState<Tool>('pen');
  const [color, setColor] = useState('#1a1a2e');
  const [isDrawing, setIsDrawing] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [hintImageUrl, setHintImageUrl] = useState<string | null>(null);

  const [currentRemId, setCurrentRemId] = useState<string | null>(null);

  // Listen for card completion - clear canvas when user rates a card
  useAPIEventListener(AppEvents.QueueCompleteCard, undefined, async () => {
    console.log('[Sketchpad] Card completed, clearing canvas');
    clearCanvasNow();
    setShowHint(false);
    setHintImageUrl(null);
    
    // Update to new card's remId after a short delay (card changes after event)
    setTimeout(async () => {
      const card = await plugin.queue.getCurrentCard();
      setCurrentRemId(card?.remId || null);
    }, 100);
  });

  // Get current card's remId on mount and when entering queue
  useAPIEventListener(AppEvents.QueueEnter, undefined, async () => {
    const card = await plugin.queue.getCurrentCard();
    setCurrentRemId(card?.remId || null);
  });

  // Initial load of current card
  useEffect(() => {
    const loadCurrentCard = async () => {
      const card = await plugin.queue.getCurrentCard();
      setCurrentRemId(card?.remId || null);
    };
    loadCurrentCard();
  }, [plugin]);

  // Direct clear function that doesn't depend on state
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

  // Load hint image from back of card
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

        // Find image in backText
        for (const item of rem.backText) {
          if (typeof item === 'object' && item.i === 'i' && item.url) {
            let url = item.url;
            
            // Convert LOCAL_FILE paths to S3 URLs
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
    };

    setTimeout(setupCanvas, 100);

    const resizeObserver = new ResizeObserver(() => {
      setTimeout(setupCanvas, 50);
    });
    resizeObserver.observe(wrapper);

    return () => resizeObserver.disconnect();
  }, []);

  const clearCanvas = useCallback(() => {
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

  const getPoint = useCallback((e: React.PointerEvent<HTMLCanvasElement>): Point => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      pressure: e.pressure || 0.5,
    };
  }, []);

  const drawLine = useCallback((from: Point, to: Point) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;

    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (tool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.lineWidth = 20;
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = color;
      ctx.lineWidth = 2 + to.pressure * 4;
    }

    ctx.stroke();
  }, [tool, color]);

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.setPointerCapture(e.pointerId);
    const point = getPoint(e);
    lastPointRef.current = point;
    setIsDrawing(true);
    drawLine(point, point);
  }, [getPoint, drawLine]);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !lastPointRef.current) return;
    e.preventDefault();

    const point = getPoint(e);
    drawLine(lastPointRef.current, point);
    lastPointRef.current = point;
  }, [isDrawing, getPoint, drawLine]);

  const handlePointerUp = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (canvas && e.pointerId !== undefined) {
      try {
        canvas.releasePointerCapture(e.pointerId);
      } catch {
        // Ignore
      }
    }
    setIsDrawing(false);
    lastPointRef.current = null;
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
    <div style={styles.container}>
      {/* Compact toolbar */}
      <div style={styles.toolbar}>
        <div style={styles.toolButtons}>
          <button
            style={{
              ...styles.toolBtn,
              ...(tool === 'pen' ? styles.toolBtnActive : {}),
            }}
            onClick={() => setTool('pen')}
          >
            ✏️
          </button>
          <button
            style={{
              ...styles.toolBtn,
              ...(tool === 'eraser' ? styles.toolBtnActive : {}),
            }}
            onClick={() => setTool('eraser')}
          >
            🧹
          </button>
        </div>
        <div style={styles.colorPicker}>
          {COLORS.map((c) => (
            <div
              key={c}
              style={{
                ...styles.colorSwatch,
                backgroundColor: c,
                ...(color === c ? styles.colorSwatchActive : {}),
              }}
              onClick={() => setColor(c)}
            />
          ))}
        </div>
      </div>

      {/* Canvas area with grid and hint */}
      <div ref={wrapperRef} style={styles.canvasWrapper}>
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
        />
      </div>

      {/* Compact footer - Save left, Hint middle, Clear right */}
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
