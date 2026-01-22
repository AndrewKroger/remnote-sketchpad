import { usePlugin, renderWidget, useRunAsync } from '@remnote/plugin-sdk';
import { useCallback } from 'react';

const SETTING_MODE = 'sketchpad-mode';

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
};

export const SketchpadToolbar = () => {
  const plugin = usePlugin();

  // Check if we're in floating mode
  const mode = useRunAsync(
    () => plugin.settings.getSetting<string>(SETTING_MODE),
    []
  );

  const openSketchpad = useCallback(async () => {
    // Check if on mobile (iOS/Android) - use Pane to properly displace content
    const os = await plugin.app.getOperatingSystem();
    const isMobile = os === 'ios' || os === 'android';
    
    if (isMobile) {
      // Pane widget properly displaces content on mobile instead of floating
      await plugin.window.openWidgetInPane('sketchpad');
    } else {
      await plugin.window.openWidgetInRightSidebar('sketchpad');
    }
  }, [plugin]);

  // Only show button in floating mode
  if (mode !== 'floating') {
    return null;
  }

  return (
    <button
      style={styles.button}
      onClick={openSketchpad}
      title="Open Sketchpad"
      onMouseOver={(e) => {
        e.currentTarget.style.backgroundColor = 'var(--rn-clr-background-secondary, #f1f5f9)';
      }}
      onMouseOut={(e) => {
        e.currentTarget.style.backgroundColor = 'transparent';
      }}
    >
      ✏️
    </button>
  );
};

renderWidget(SketchpadToolbar);
