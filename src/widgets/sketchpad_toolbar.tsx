import { usePlugin, renderWidget, useRunAsync, useSessionStorageState } from '@remnote/plugin-sdk';
import { useCallback } from 'react';

const SETTING_MODE = 'sketchpad-mode';
const SETTING_DISPLAY = 'sketchpad-display';

// Export for use by sketchpad_flashcard
export const INLINE_TOGGLE_KEY = 'sketchpad-inline-visible';

const styles = {
  button: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '36px',
    height: '36px',
    backgroundColor: 'transparent',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '18px',
    transition: 'all 0.15s ease',
    color: 'var(--rn-clr-content-primary, #1e293b)',
  },
  buttonActive: {
    backgroundColor: 'var(--rn-clr-background-accent, #3b82f6)',
  },
};

export const SketchpadToolbar = () => {
  const plugin = usePlugin();

  // Check activation mode (button vs tag)
  const mode = useRunAsync(
    () => plugin.settings.getSetting<string>(SETTING_MODE),
    []
  );

  // Check display type
  const displayType = useRunAsync(
    () => plugin.settings.getSetting<string>(SETTING_DISPLAY),
    []
  );

  // For inline toggle mode - track visibility state
  const [inlineVisible, setInlineVisible] = useSessionStorageState<boolean>(INLINE_TOGGLE_KEY, false);

  const openSketchpad = useCallback(async () => {
    const display = displayType || 'sidebar';

    switch (display) {
      case 'sidebar':
        // Open in right sidebar
        await plugin.window.openWidgetInRightSidebar('sketchpad');
        break;
      
      case 'left-sidebar':
        // Open in left sidebar (falls back to right sidebar)
        await plugin.window.openWidgetInRightSidebar('sketchpad');
        break;
      
      case 'pane':
        // Open as a separate pane (side-by-side)
        await plugin.window.openWidgetInPane('sketchpad');
        break;
      
      case 'floating':
        // Open as floating window on the right side
        await plugin.window.openFloatingWidget('sketchpad_floating', {
          top: 100,
          right: 20,
        });
        break;
      
      case 'inline':
      case 'extra-detail':
      case 'below-toolbar':
      case 'flashcard':
      case 'rem-popup-right':
      case 'rem-popup-start':
        // Toggle inline visibility (embedded widgets will react to this)
        setInlineVisible(!inlineVisible);
        break;
      
      default:
        await plugin.window.openWidgetInRightSidebar('sketchpad');
    }
  }, [plugin, displayType, inlineVisible, setInlineVisible]);

  // Only show button in button mode (not tag mode)
  if (mode !== 'button') {
    return null;
  }

  const isInlineMode = displayType === 'inline' || displayType === 'extra-detail' || displayType === 'below-toolbar' || displayType === 'flashcard' || displayType === 'rem-popup-right' || displayType === 'rem-popup-start';
  const isActive = isInlineMode && inlineVisible;

  return (
    <button
      style={{
        ...styles.button,
        ...(isActive ? styles.buttonActive : {}),
      }}
      onClick={openSketchpad}
      title="Open Sketchpad"
      onMouseOver={(e) => {
        if (!isActive) {
          e.currentTarget.style.backgroundColor = 'var(--rn-clr-background-secondary, #f1f5f9)';
        }
      }}
      onMouseOut={(e) => {
        if (!isActive) {
          e.currentTarget.style.backgroundColor = 'transparent';
        }
      }}
    >
      ✏️
    </button>
  );
};

renderWidget(SketchpadToolbar);
