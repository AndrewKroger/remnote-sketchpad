import { usePlugin, renderWidget, useRunAsync, useAPIEventListener, AppEvents, QueueInteractionScore } from '@remnote/plugin-sdk';
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
type GestureType = 'checkmark' | 'cross' | 'double-line' | null;

interface GestureResult {
  type: GestureType;
  confidence: number;
}

const COLORS = ['#1a1a2e', '#e53e3e', '#dd6b20', '#d69e2e', '#38a169', '#3182ce', '#805ad5'];

// Gesture detection constants
const GESTURE_ZONE_RATIO = 0.5; // Center 50% of canvas
const MIN_GESTURE_SIZE = 80; // Minimum size in pixels for a gesture
const CONFIDENCE_THRESHOLD = 0.80; // 80% confidence required

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
  gestureZone: {
    position: 'absolute' as const,
    border: '2px dashed rgba(59, 130, 246, 0.3)',
    borderRadius: '12px',
    pointerEvents: 'none' as const,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gestureZoneLabel: {
    fontSize: '10px',
    color: 'rgba(59, 130, 246, 0.4)',
    textAlign: 'center' as const,
    fontWeight: 500,
    padding: '4px 8px',
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: '4px',
  },
  gestureFeedback: {
    position: 'absolute' as const,
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    fontSize: '72px',
    pointerEvents: 'none' as const,
    animation: 'gesturePopIn 0.3s ease-out',
    zIndex: 100,
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
  const [canvasDimensions, setCanvasDimensions] = useState({ width: 0, height: 0 });
  const [gestureDetected, setGestureDetected] = useState<GestureType>(null);
  const [gestureMode, setGestureMode] = useState(false);
  const [showGestureZone, setShowGestureZone] = useState(false);
  
  // Track recent strokes for gesture detection (last 2 strokes within gesture zone)
  const gestureStrokesRef = useRef<Stroke[]>([]);
  const gestureTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const gestureZoneTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Show gesture zone for 5 seconds when gesture mode is enabled
  useEffect(() => {
    if (gestureMode) {
      setShowGestureZone(true);
      // Clear any existing timeout
      if (gestureZoneTimeoutRef.current) {
        clearTimeout(gestureZoneTimeoutRef.current);
      }
      // Hide after 5 seconds
      gestureZoneTimeoutRef.current = setTimeout(() => {
        setShowGestureZone(false);
        gestureZoneTimeoutRef.current = null;
      }, 5000);
    } else {
      setShowGestureZone(false);
      if (gestureZoneTimeoutRef.current) {
        clearTimeout(gestureZoneTimeoutRef.current);
        gestureZoneTimeoutRef.current = null;
      }
    }
    
    return () => {
      if (gestureZoneTimeoutRef.current) {
        clearTimeout(gestureZoneTimeoutRef.current);
      }
    };
  }, [gestureMode]);

  // Toggle gesture mode handler
  const toggleGestureMode = useCallback(() => {
    setGestureMode(prev => !prev);
    gestureStrokesRef.current = [];
  }, []);

  // Calculate gesture zone bounds
  const getGestureZone = useCallback(() => {
    const { width, height } = canvasDimensions;
    const zoneWidth = width * GESTURE_ZONE_RATIO;
    const zoneHeight = height * GESTURE_ZONE_RATIO;
    return {
      left: (width - zoneWidth) / 2,
      top: (height - zoneHeight) / 2,
      right: (width + zoneWidth) / 2,
      bottom: (height + zoneHeight) / 2,
      width: zoneWidth,
      height: zoneHeight,
    };
  }, [canvasDimensions]);

  // Check if a stroke is within the gesture zone
  const isStrokeInGestureZone = useCallback((stroke: Stroke): boolean => {
    const zone = getGestureZone();
    if (stroke.points.length < 2) return false;
    
    // Check if majority of points are in the zone
    let pointsInZone = 0;
    for (const point of stroke.points) {
      if (point.x >= zone.left && point.x <= zone.right &&
          point.y >= zone.top && point.y <= zone.bottom) {
        pointsInZone++;
      }
    }
    return pointsInZone / stroke.points.length >= 0.7; // 70% of points must be in zone
  }, [getGestureZone]);

  // Get stroke bounding box and size
  const getStrokeBounds = useCallback((stroke: Stroke) => {
    if (stroke.points.length === 0) return { minX: 0, maxX: 0, minY: 0, maxY: 0, width: 0, height: 0 };
    
    let minX = stroke.points[0].x, maxX = stroke.points[0].x;
    let minY = stroke.points[0].y, maxY = stroke.points[0].y;
    
    for (const point of stroke.points) {
      minX = Math.min(minX, point.x);
      maxX = Math.max(maxX, point.x);
      minY = Math.min(minY, point.y);
      maxY = Math.max(maxY, point.y);
    }
    
    return { minX, maxX, minY, maxY, width: maxX - minX, height: maxY - minY };
  }, []);

  // Detect checkmark gesture (✓) - down-right then up-right, or V shape
  const detectCheckmark = useCallback((stroke: Stroke): number => {
    if (stroke.points.length < 5) return 0;
    
    const bounds = getStrokeBounds(stroke);
    const size = Math.max(bounds.width, bounds.height);
    if (size < MIN_GESTURE_SIZE) return 0;
    
    // Find the lowest point (vertex of checkmark)
    let lowestIdx = 0;
    let lowestY = stroke.points[0].y;
    for (let i = 1; i < stroke.points.length; i++) {
      if (stroke.points[i].y > lowestY) {
        lowestY = stroke.points[i].y;
        lowestIdx = i;
      }
    }
    
    // Vertex should be roughly in the middle-ish of the stroke
    const vertexRatio = lowestIdx / stroke.points.length;
    if (vertexRatio < 0.2 || vertexRatio > 0.6) return 0;
    
    // Check that stroke goes down to vertex then up
    const start = stroke.points[0];
    const vertex = stroke.points[lowestIdx];
    const end = stroke.points[stroke.points.length - 1];
    
    // First part should go down-right
    const firstPartGoesDown = vertex.y > start.y;
    // Second part should go up-right
    const secondPartGoesUp = end.y < vertex.y;
    const endsHigher = end.y < start.y || Math.abs(end.y - start.y) < bounds.height * 0.3;
    const endsToRight = end.x > start.x;
    
    if (firstPartGoesDown && secondPartGoesUp && endsToRight) {
      // Calculate confidence based on shape quality
      const downAngle = Math.atan2(vertex.y - start.y, vertex.x - start.x);
      const upAngle = Math.atan2(end.y - vertex.y, end.x - vertex.x);
      
      // Ideal checkmark: down angle ~45-90°, up angle ~-30 to -60°
      const downScore = 1 - Math.abs(downAngle - Math.PI / 3) / (Math.PI / 2);
      const upScore = 1 - Math.abs(upAngle + Math.PI / 4) / (Math.PI / 2);
      
      return Math.min(1, (downScore + upScore) / 2 + 0.3);
    }
    
    return 0;
  }, [getStrokeBounds]);

  // Detect X cross gesture - single stroke with direction change or two crossing strokes
  const detectCross = useCallback((strokes: Stroke[]): number => {
    // Single stroke X detection
    if (strokes.length === 1) {
      const stroke = strokes[0];
      if (stroke.points.length < 5) return 0;
      
      const bounds = getStrokeBounds(stroke);
      const size = Math.max(bounds.width, bounds.height);
      if (size < MIN_GESTURE_SIZE) return 0;
      
      // Look for direction change (zigzag pattern)
      const midIdx = Math.floor(stroke.points.length / 2);
      const start = stroke.points[0];
      const mid = stroke.points[midIdx];
      const end = stroke.points[stroke.points.length - 1];
      
      // X pattern: diagonal one way, then diagonal the other
      const firstDx = mid.x - start.x;
      const firstDy = mid.y - start.y;
      const secondDx = end.x - mid.x;
      const secondDy = end.y - mid.y;
      
      // Check for opposite vertical directions (zigzag)
      if ((firstDy > 0 && secondDy < 0) || (firstDy < 0 && secondDy > 0)) {
        const aspectRatio = bounds.width / bounds.height;
        if (aspectRatio > 0.5 && aspectRatio < 2) {
          return 0.85;
        }
      }
    }
    
    // Two stroke X detection
    if (strokes.length === 2) {
      const bounds1 = getStrokeBounds(strokes[0]);
      const bounds2 = getStrokeBounds(strokes[1]);
      
      const size1 = Math.max(bounds1.width, bounds1.height);
      const size2 = Math.max(bounds2.width, bounds2.height);
      if (size1 < MIN_GESTURE_SIZE * 0.6 || size2 < MIN_GESTURE_SIZE * 0.6) return 0;
      
      // Check if strokes are diagonal and cross
      const s1Start = strokes[0].points[0];
      const s1End = strokes[0].points[strokes[0].points.length - 1];
      const s2Start = strokes[1].points[0];
      const s2End = strokes[1].points[strokes[1].points.length - 1];
      
      // Both strokes should be diagonal
      const s1Diagonal = Math.abs(s1End.x - s1Start.x) > 30 && Math.abs(s1End.y - s1Start.y) > 30;
      const s2Diagonal = Math.abs(s2End.x - s2Start.x) > 30 && Math.abs(s2End.y - s2Start.y) > 30;
      
      // Check opposite directions
      const s1GoesDownRight = (s1End.x - s1Start.x) * (s1End.y - s1Start.y) > 0;
      const s2GoesDownRight = (s2End.x - s2Start.x) * (s2End.y - s2Start.y) > 0;
      
      if (s1Diagonal && s2Diagonal && s1GoesDownRight !== s2GoesDownRight) {
        // Check if they overlap/cross
        const centerDist = Math.sqrt(
          Math.pow((bounds1.minX + bounds1.width/2) - (bounds2.minX + bounds2.width/2), 2) +
          Math.pow((bounds1.minY + bounds1.height/2) - (bounds2.minY + bounds2.height/2), 2)
        );
        const avgSize = (Math.max(bounds1.width, bounds1.height) + Math.max(bounds2.width, bounds2.height)) / 2;
        
        if (centerDist < avgSize * 0.5) {
          return 0.9;
        }
      }
    }
    
    return 0;
  }, [getStrokeBounds]);

  // Detect double horizontal line gesture (═) for disable card
  const detectDoubleLine = useCallback((strokes: Stroke[]): number => {
    if (strokes.length !== 2) return 0;
    
    const bounds1 = getStrokeBounds(strokes[0]);
    const bounds2 = getStrokeBounds(strokes[1]);
    
    // Both strokes should be primarily horizontal
    const isHorizontal1 = bounds1.width > bounds1.height * 2 && bounds1.width > MIN_GESTURE_SIZE * 0.6;
    const isHorizontal2 = bounds2.width > bounds2.height * 2 && bounds2.width > MIN_GESTURE_SIZE * 0.6;
    
    if (!isHorizontal1 || !isHorizontal2) return 0;
    
    // Strokes should be roughly parallel (similar Y position, different)
    const y1 = (bounds1.minY + bounds1.maxY) / 2;
    const y2 = (bounds2.minY + bounds2.maxY) / 2;
    const yDiff = Math.abs(y1 - y2);
    
    // They should be separate but not too far apart
    const avgHeight = (bounds1.height + bounds2.height) / 2;
    if (yDiff < avgHeight * 0.5 || yDiff > MIN_GESTURE_SIZE) return 0;
    
    // Check horizontal overlap
    const overlapLeft = Math.max(bounds1.minX, bounds2.minX);
    const overlapRight = Math.min(bounds1.maxX, bounds2.maxX);
    const overlap = overlapRight - overlapLeft;
    const avgWidth = (bounds1.width + bounds2.width) / 2;
    
    if (overlap > avgWidth * 0.5) {
      return 0.9;
    }
    
    return 0;
  }, [getStrokeBounds]);

  // Main gesture detection function
  const detectGesture = useCallback((strokes: Stroke[]): GestureResult => {
    if (strokes.length === 0) return { type: null, confidence: 0 };
    
    // Try checkmark (single stroke)
    if (strokes.length === 1) {
      const checkmarkConf = detectCheckmark(strokes[0]);
      if (checkmarkConf >= CONFIDENCE_THRESHOLD) {
        return { type: 'checkmark', confidence: checkmarkConf };
      }
    }
    
    // Try cross (single or double stroke)
    const crossConf = detectCross(strokes);
    if (crossConf >= CONFIDENCE_THRESHOLD) {
      return { type: 'cross', confidence: crossConf };
    }
    
    // Try double line (two strokes)
    if (strokes.length === 2) {
      const doubleLineConf = detectDoubleLine(strokes);
      if (doubleLineConf >= CONFIDENCE_THRESHOLD) {
        return { type: 'double-line', confidence: doubleLineConf };
      }
    }
    
    return { type: null, confidence: 0 };
  }, [detectCheckmark, detectCross, detectDoubleLine]);

  // Clear canvas helper (needed by executeGesture)
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

  // Execute gesture action
  const executeGesture = useCallback(async (gestureType: GestureType) => {
    if (!gestureType) return;
    
    setGestureDetected(gestureType);
    
    // Clear after showing feedback
    setTimeout(() => setGestureDetected(null), 800);
    
    try {
      const currentCard = await plugin.queue.getCurrentCard();
      if (!currentCard) {
        await plugin.app.toast('No card in queue');
        return;
      }

      switch (gestureType) {
        case 'checkmark':
          // Good - recalled with effort
          await currentCard.updateCardRepetitionStatus(QueueInteractionScore.GOOD);
          await plugin.app.toast('✓ Good!');
          // Advance to next card
          await plugin.queue.removeCurrentCardFromQueue(false);
          clearCanvasNow();
          strokesRef.current = [];
          gestureStrokesRef.current = [];
          break;
        case 'cross':
          // Again - wrong
          await currentCard.updateCardRepetitionStatus(QueueInteractionScore.AGAIN);
          await plugin.app.toast('✗ Again');
          // Advance to next card (add to back of queue for retry)
          await plugin.queue.removeCurrentCardFromQueue(true);
          clearCanvasNow();
          strokesRef.current = [];
          gestureStrokesRef.current = [];
          break;
        case 'double-line':
          // Disable card
          const rem = await plugin.rem.findOne(currentCard.remId);
          if (rem) {
            await rem.setEnablePractice(false);
            await plugin.app.toast('═ Card disabled');
          }
          // Advance to next card (don't add to back stack)
          await plugin.queue.removeCurrentCardFromQueue(false);
          clearCanvasNow();
          strokesRef.current = [];
          gestureStrokesRef.current = [];
          break;
      }
    } catch (error) {
      console.error('[Sketchpad] Gesture action error:', error);
    }
  }, [plugin, clearCanvasNow]);

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
      
      // Update dimensions for gesture zone calculation
      setCanvasDimensions({ width, height });

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
    gestureStrokesRef.current = [];
    if (gestureTimeoutRef.current) {
      clearTimeout(gestureTimeoutRef.current);
      gestureTimeoutRef.current = null;
    }
  }, [clearCanvasNow]);

  // Cleanup gesture timeout on unmount
  useEffect(() => {
    return () => {
      if (gestureTimeoutRef.current) {
        clearTimeout(gestureTimeoutRef.current);
      }
    };
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
      const completedStroke = currentStrokeRef.current;
      strokesRef.current.push(completedStroke);
      currentStrokeRef.current = null;
      
      // Only check for gestures when gesture mode is enabled
      if (gestureMode && isStrokeInGestureZone(completedStroke)) {
        // Add to gesture strokes
        gestureStrokesRef.current.push(completedStroke);
        
        // Keep only last 2 strokes for gesture detection
        if (gestureStrokesRef.current.length > 2) {
          gestureStrokesRef.current = gestureStrokesRef.current.slice(-2);
        }
        
        // Clear any existing timeout
        if (gestureTimeoutRef.current) {
          clearTimeout(gestureTimeoutRef.current);
        }
        
        // Check for gesture after a short delay (to allow for multi-stroke gestures)
        gestureTimeoutRef.current = setTimeout(() => {
          const result = detectGesture(gestureStrokesRef.current);
          if (result.type && result.confidence >= CONFIDENCE_THRESHOLD) {
            // Remove gesture strokes from regular strokes
            for (const gs of gestureStrokesRef.current) {
              const idx = strokesRef.current.indexOf(gs);
              if (idx > -1) {
                strokesRef.current.splice(idx, 1);
              }
            }
            redrawStrokes();
            executeGesture(result.type);
          }
          gestureTimeoutRef.current = null;
        }, 400);
      } else if (gestureMode) {
        // Stroke outside gesture zone - clear gesture tracking
        gestureStrokesRef.current = [];
      }
    }
    
    setIsDrawing(false);
    lastPointRef.current = null;
  }, [activeTool, isStrokeInGestureZone, detectGesture, executeGesture, redrawStrokes]);

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
          
          {/* Gesture mode toggle */}
          <button
            style={{
              ...styles.eraserModeBtn,
              marginLeft: '8px',
              ...(gestureMode ? styles.eraserModeBtnActive : {}),
            }}
            onClick={toggleGestureMode}
            title="Toggle gesture mode (✓ Good, ✗ Again, ═ Disable)"
          >
            👆
          </button>
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
        
        {/* Gesture zone indicator - only show for 5 seconds after enabling gesture mode */}
        {showGestureZone && canvasDimensions.width > 0 && (
          <div
            style={{
              ...styles.gestureZone,
              left: `${(100 - GESTURE_ZONE_RATIO * 100) / 2}%`,
              top: `${(100 - GESTURE_ZONE_RATIO * 100) / 2}%`,
              width: `${GESTURE_ZONE_RATIO * 100}%`,
              height: `${GESTURE_ZONE_RATIO * 100}%`,
            }}
          >
            <span style={styles.gestureZoneLabel}>
              Gesture Zone<br/>
              ✓ Good &nbsp; ✗ Again &nbsp; ═ Disable
            </span>
          </div>
        )}
        
        {/* Gesture feedback */}
        {gestureDetected && (
          <div style={styles.gestureFeedback}>
            {gestureDetected === 'checkmark' && '✓'}
            {gestureDetected === 'cross' && '✗'}
            {gestureDetected === 'double-line' && '═'}
          </div>
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
