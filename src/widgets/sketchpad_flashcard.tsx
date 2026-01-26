import { usePlugin, renderWidget, useRunAsync, useSessionStorageState } from '@remnote/plugin-sdk';
import { useRef, useState, useEffect, useCallback } from 'react';

interface Point {
  x: number;
  y: number;
  pressure: number;
}

type Tool = 'pen' | 'eraser';

const SETTING_MODE = 'sketchpad-mode';
const SETTING_DISPLAY = 'sketchpad-display';
const INLINE_TOGGLE_KEY = 'sketchpad-inline-visible';

const COLORS = ['#000000', '#e53e3e', '#dd6b20', '#d69e2e', '#38a169', '#3182ce', '#805ad5'];

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column' as const,
    height: '100%',
    minHeight: '400px',
    backgroundColor: '#1a1a2e',
    fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
    userSelect: 'none' as const,
    WebkitUserSelect: 'none' as const,
    WebkitTouchCallout: 'none' as const,
  },
  toolbar: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: '8px',
    padding: '12px',
    backgroundColor: '#16213e',
    borderBottom: '2px solid #0f3460',
    alignItems: 'center',
  },
  toolGroup: {
    display: 'flex',
    gap: '4px',
    alignItems: 'center',
  },
  button: {
    padding: '8px 12px',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 600,
    transition: 'all 0.15s ease',
    backgroundColor: '#0f3460',
    color: '#e94560',
  },
  buttonActive: {
    backgroundColor: '#e94560',
    color: '#1a1a2e',
  },
  colorSwatch: {
    width: '28px',
    height: '28px',
    borderRadius: '50%',
    border: '3px solid transparent',
    cursor: 'pointer',
    transition: 'transform 0.1s ease',
  },
  colorSwatchActive: {
    border: '3px solid #e94560',
    transform: 'scale(1.15)',
  },
  canvasWrapper: {
    flex: 1,
    padding: '12px',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'flex-start',
    overflow: 'auto',
  },
  canvas: {
    backgroundColor: '#ffffff',
    borderRadius: '8px',
    boxShadow: '0 4px 20px rgba(233, 69, 96, 0.3)',
    touchAction: 'none' as const,
    cursor: 'crosshair',
  },
  actionButton: {
    padding: '8px 16px',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 600,
    transition: 'all 0.15s ease',
  },
  clearButton: {
    backgroundColor: '#0f3460',
    color: '#f39c12',
  },
  saveButton: {
    backgroundColor: '#e94560',
    color: '#ffffff',
  },
  label: {
    color: '#94a3b8',
    fontSize: '11px',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
  },
};

export const SketchpadWidget = () => {
  const plugin = usePlugin();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lastPointRef = useRef<Point | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const [tool, setTool] = useState<Tool>('pen');
  const [color, setColor] = useState('#000000');
  const [isDrawing, setIsDrawing] = useState(false);

  // For inline toggle mode - track visibility state
  const [inlineVisible] = useSessionStorageState<boolean>(INLINE_TOGGLE_KEY, false);

  // Check mode setting and display type
  const modeAndDisplay = useRunAsync(async () => {
    const mode = await plugin.settings.getSetting<string>(SETTING_MODE);
    const display = await plugin.settings.getSetting<string>(SETTING_DISPLAY);
    return { mode, display };
  }, []);

  // Check if the current card has "sketch" tag (for tag mode)
  const hasSketchTag = useRunAsync(async () => {
    try {
      // Get the current card from the queue
      const currentCard = await plugin.queue.getCurrentCard();
      if (!currentCard) {
        return false;
      }

      // Get the Rem using findOne
      const rem = await plugin.rem.findOne(currentCard.remId);
      if (!rem) {
        return false;
      }

      // Get the tags on this Rem
      const tags = await rem.getTagRems();

      // Check if any tag contains "sketch" (case insensitive)
      for (const tag of tags) {
        const tagText = await plugin.richText.toString(tag.text);
        if (tagText?.toLowerCase().includes('sketch')) {
          return true;
        }
      }
      return false;
    } catch (err) {
      console.error('[Sketchpad] Error checking tags:', err);
      return false;
    }
  }, []);

  // Get the widget context to know which location we're rendering in
  const widgetContext = useRunAsync(() => plugin.widget.getWidgetContext(), []);

  // Determine if we should show based on mode, settings, and widget location
  const shouldShow = (() => {
    if (!modeAndDisplay) return false;
    
    const { mode, display } = modeAndDisplay;
    
    // Tag mode: show if card has sketch tag (only in FlashcardUnder location)
    if (mode === 'tag' && hasSketchTag === true) {
      return true;
    }
    
    // Button mode with inline displays: show if toggle is active AND we're in the right location
    if (mode === 'button' && inlineVisible) {
      // Check which widget location we're in and match it to the display setting
      const location = widgetContext?.widgetLocation;
      
      if (display === 'inline' && location === 'FlashcardUnder') {
        return true;
      }
      if (display === 'extra-detail' && location === 'FlashcardExtraDetail') {
        return true;
      }
      if (display === 'below-toolbar' && location === 'QueueBelowTopBar') {
        return true;
      }
      if (display === 'flashcard' && location === 'Flashcard') {
        return true;
      }
      if (display === 'rem-popup-right' && location === 'RemReferencePopupRight') {
        return true;
      }
      if (display === 'rem-popup-start' && location === 'RemReferencePopupStart') {
        return true;
      }
    }
    
    return false;
  })();

  // Get point from pointer event
  const getPoint = useCallback((e: React.PointerEvent<HTMLCanvasElement>): Point => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      pressure: e.pressure || 0.5,
    };
  }, []);

  // Draw line between two points
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

  // Pointer event handlers
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
        // Ignore if pointer wasn't captured
      }
    }
    setIsDrawing(false);
    lastPointRef.current = null;
  }, []);

  // Clear canvas
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

  // Save sketch
  const saveSketch = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    try {
      const currentCard = await plugin.queue.getCurrentCard();
      if (!currentCard) {
        await plugin.app.toast('No current card');
        return;
      }

      const rem = await currentCard.getRem();
      if (!rem) {
        await plugin.app.toast('No rem found');
        return;
      }

      const dataUrl = canvas.toDataURL('image/png');
      const newRem = await plugin.rem.createRem();
      if (!newRem) {
        await plugin.app.toast('Failed to create Rem');
        return;
      }

      await newRem.setText(['Sketch: ', { i: 'i', url: dataUrl }]);
      await newRem.setParent(rem._id);
      await plugin.app.toast('Sketch saved!');
      clearCanvas();
    } catch (error) {
      console.error('[Sketchpad] Save error:', error);
      await plugin.app.toast('Failed to save sketch');
    }
  }, [plugin, clearCanvas]);

  // Canvas setup effect - MUST be after all other hooks
  useEffect(() => {
    if (shouldShow !== true) return; // Don't setup if not showing
    
    const canvas = canvasRef.current;
    const wrapper = wrapperRef.current;
    if (!canvas || !wrapper) return;

    const setupCanvas = () => {
      const dpr = window.devicePixelRatio || 1;
      const width = wrapper.clientWidth - 24;
      const height = 300;

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

    setupCanvas();

    const handleResize = () => {
      const ctx = canvas.getContext('2d');
      const imageData = ctx?.getImageData(0, 0, canvas.width, canvas.height);
      setupCanvas();
      if (imageData && ctx) {
        ctx.putImageData(imageData, 0, 0);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [shouldShow]);

  // ALL hooks must be called before this point
  // Now we can conditionally return
  if (shouldShow !== true) {
    return null;
  }

  return (
    <div style={styles.container}>
      <div style={styles.toolbar}>
        <div style={styles.toolGroup}>
          <span style={styles.label}>Tool</span>
          <button
            style={{
              ...styles.button,
              ...(tool === 'pen' ? styles.buttonActive : {}),
            }}
            onClick={() => setTool('pen')}
          >
            ✏️ Pen
          </button>
          <button
            style={{
              ...styles.button,
              ...(tool === 'eraser' ? styles.buttonActive : {}),
            }}
            onClick={() => setTool('eraser')}
          >
            🧹 Eraser
          </button>
        </div>

        <div style={styles.toolGroup}>
          <span style={styles.label}>Color</span>
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

        <div style={{ ...styles.toolGroup, marginLeft: 'auto' }}>
          <button
            style={{ ...styles.actionButton, ...styles.clearButton }}
            onClick={clearCanvas}
          >
            🗑️ Clear
          </button>
          <button
            style={{ ...styles.actionButton, ...styles.saveButton }}
            onClick={saveSketch}
          >
            💾 Save
          </button>
        </div>
      </div>

      <div ref={wrapperRef} style={styles.canvasWrapper}>
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
    </div>
  );
};

renderWidget(SketchpadWidget);
