import { usePlugin, renderWidget, useRunAsync } from '@remnote/plugin-sdk';
import { useRef, useState, useEffect, useCallback } from 'react';

interface Point {
  x: number;
  y: number;
  pressure: number;
}

type Tool = 'pen' | 'eraser';

const COLORS = ['#1a1a2e', '#e53e3e', '#dd6b20', '#d69e2e', '#38a169', '#3182ce', '#805ad5', '#ffffff'];

const styles = {
  // Main container - mimics AI Tutor sidebar
  container: {
    display: 'flex',
    flexDirection: 'column' as const,
    width: '380px',
    height: '100vh',
    maxHeight: '100vh',
    backgroundColor: 'var(--rn-clr-background-elevation-5, #ffffff)',
    borderRadius: '16px',
    boxShadow: 'var(--rn-clr-shadow-modal, 0 8px 32px rgba(0, 0, 0, 0.12))',
    overflow: 'hidden',
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    boxSizing: 'border-box' as const,
    userSelect: 'none' as const,
    WebkitUserSelect: 'none' as const,
    WebkitTouchCallout: 'none' as const,
  },
  // Header bar
  header: {
    position: 'relative' as const,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0 16px',
    height: '60px',
    minHeight: '60px',
    borderBottom: '2px solid var(--rn-clr-background-secondary, #f1f5f9)',
  },
  headerTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  titleIcon: {
    fontSize: '22px',
  },
  titleText: {
    fontSize: '16px',
    fontWeight: 500,
    color: 'var(--rn-clr-content-primary, #1e293b)',
  },
  closeButton: {
    position: 'absolute' as const,
    right: '16px',
    top: '50%',
    transform: 'translateY(-50%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '28px',
    height: '28px',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    backgroundColor: 'transparent',
    color: 'var(--rn-clr-content-secondary, #64748b)',
    fontSize: '18px',
    transition: 'background-color 0.15s ease',
  },
  // Divider
  divider: {
    height: '2px',
    width: '100%',
    backgroundColor: 'var(--rn-clr-background-secondary, #f1f5f9)',
  },
  // Main content area with scroll
  content: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column' as const,
    overflow: 'hidden',
    backgroundColor: 'var(--rn-clr-background-secondary, #f8fafc)',
  },
  // Toolbar
  toolbar: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: '12px',
    padding: '16px',
    alignItems: 'center',
    backgroundColor: 'var(--rn-clr-background-primary, #ffffff)',
    borderBottom: '1px solid var(--rn-clr-border-opaque, #e2e8f0)',
  },
  toolGroup: {
    display: 'flex',
    gap: '6px',
    alignItems: 'center',
  },
  toolLabel: {
    fontSize: '11px',
    fontWeight: 600,
    color: 'var(--rn-clr-content-tertiary, #94a3b8)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
    marginRight: '4px',
  },
  button: {
    padding: '8px 12px',
    border: '1px solid var(--rn-clr-border-opaque, #e2e8f0)',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 500,
    transition: 'all 0.15s ease',
    backgroundColor: 'var(--rn-clr-background-primary, #ffffff)',
    color: 'var(--rn-clr-content-secondary, #475569)',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  buttonActive: {
    backgroundColor: 'var(--rn-clr-background-accent, #3b82f6)',
    color: '#ffffff',
    borderColor: 'var(--rn-clr-background-accent, #3b82f6)',
  },
  colorRow: {
    display: 'flex',
    gap: '6px',
    alignItems: 'center',
    flexWrap: 'wrap' as const,
  },
  colorSwatch: {
    width: '26px',
    height: '26px',
    borderRadius: '50%',
    border: '2px solid var(--rn-clr-border-opaque, #e2e8f0)',
    cursor: 'pointer',
    transition: 'all 0.1s ease',
  },
  colorSwatchActive: {
    border: '2px solid var(--rn-clr-background-accent, #3b82f6)',
    transform: 'scale(1.1)',
    boxShadow: '0 0 0 3px rgba(59, 130, 246, 0.2)',
  },
  // Canvas area
  canvasWrapper: {
    flex: 1,
    padding: '16px',
    display: 'flex',
    flexDirection: 'column' as const,
    overflow: 'auto',
  },
  canvas: {
    backgroundColor: '#ffffff',
    borderRadius: '12px',
    border: '1px solid var(--rn-clr-border-opaque, #e2e8f0)',
    touchAction: 'none' as const,
    cursor: 'crosshair',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
    flex: 1,
    minHeight: '300px',
  },
  // Footer with actions
  footer: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '12px',
    padding: '16px',
    backgroundColor: 'var(--rn-clr-background-primary, #ffffff)',
    borderTop: '1px solid var(--rn-clr-border-opaque, #e2e8f0)',
  },
  actionButton: {
    padding: '10px 16px',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 600,
    transition: 'all 0.15s ease',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  clearButton: {
    backgroundColor: 'var(--rn-clr-background-secondary, #f1f5f9)',
    color: 'var(--rn-clr-content-secondary, #64748b)',
    border: '1px solid var(--rn-clr-border-opaque, #e2e8f0)',
  },
  saveButton: {
    backgroundColor: 'var(--rn-clr-background-accent, #3b82f6)',
    color: '#ffffff',
    boxShadow: '0 1px 2px rgba(59, 130, 246, 0.3)',
  },
};

export const SketchpadFloating = () => {
  const plugin = usePlugin();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const lastPointRef = useRef<Point | null>(null);

  const [tool, setTool] = useState<Tool>('pen');
  const [color, setColor] = useState('#1a1a2e');
  const [isDrawing, setIsDrawing] = useState(false);

  // Get floating widget ID to close it
  const widgetContext = useRunAsync(() => plugin.widget.getWidgetContext<{ floatingWidgetId: string }>(), []);

  // Canvas setup
  useEffect(() => {
    const canvas = canvasRef.current;
    const wrapper = wrapperRef.current;
    if (!canvas || !wrapper) return;

    const setupCanvas = () => {
      const dpr = window.devicePixelRatio || 1;
      const width = wrapper.clientWidth;
      const height = Math.max(wrapper.clientHeight, 300);

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

    // Small delay to ensure wrapper has dimensions
    setTimeout(setupCanvas, 50);

    const resizeObserver = new ResizeObserver(setupCanvas);
    resizeObserver.observe(wrapper);
    return () => resizeObserver.disconnect();
  }, []);

  const closeWidget = useCallback(async () => {
    if (widgetContext?.floatingWidgetId) {
      await plugin.window.closeFloatingWidget(widgetContext.floatingWidgetId);
    }
  }, [plugin, widgetContext]);

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
    e.stopPropagation();
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
    e.stopPropagation();

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

  const saveSketch = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    try {
      const currentCard = await plugin.queue.getCurrentCard();
      if (!currentCard) {
        await plugin.app.toast('No current card - review a card first');
        return;
      }

      const rem = await plugin.rem.findOne(currentCard.remId);
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
      await plugin.app.toast('✓ Sketch saved to card!');
      clearCanvas();
    } catch (error) {
      console.error('[Sketchpad] Save error:', error);
      await plugin.app.toast('Failed to save sketch');
    }
  }, [plugin, clearCanvas]);

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.headerTitle}>
          <span style={styles.titleIcon}>✏️</span>
          <span style={styles.titleText}>Sketchpad</span>
        </div>
        <button
          style={styles.closeButton}
          onClick={closeWidget}
          onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'var(--rn-clr-background-secondary, #f1f5f9)'}
          onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
        >
          ✕
        </button>
      </div>

      {/* Content */}
      <div style={styles.content}>
        {/* Toolbar */}
        <div style={styles.toolbar}>
          <div style={styles.toolGroup}>
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
          <div style={styles.colorRow}>
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

        {/* Canvas */}
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

      {/* Footer */}
      <div style={styles.footer}>
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
          💾 Save to Card
        </button>
      </div>
    </div>
  );
};

renderWidget(SketchpadFloating);
