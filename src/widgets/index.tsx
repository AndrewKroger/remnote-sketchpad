import { declareIndexPlugin, type ReactRNPlugin, WidgetLocation } from '@remnote/plugin-sdk';
import '../style.css';
import '../index.css';

// Setting IDs
const SETTING_MODE = 'sketchpad-mode';

async function onActivate(plugin: ReactRNPlugin) {
  console.log('[Sketchpad] Plugin activating...');

  // Register mode setting
  await plugin.settings.registerDropdownSetting({
    id: SETTING_MODE,
    title: 'Sketchpad Mode',
    description: 'Choose how the sketchpad appears during flashcard review',
    defaultValue: 'floating',
    options: [
      { key: '1', label: 'Floating Sidebar (toggle with button)', value: 'floating' },
      { key: '2', label: 'Tag Mode (appears under cards tagged "sketch")', value: 'tag' },
    ],
  });

  // Always register the right sidebar widget (for non-review use)
  // Using SVG data URL for pencil icon since emojis don't work
  const pencilIconSvg = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>')}`;
  
  await plugin.app.registerWidget('sketchpad', WidgetLocation.RightSidebar, {
    dimensions: { height: 'auto', width: '100%' },
    widgetTabTitle: 'Sketchpad',
    widgetTabIcon: pencilIconSvg,
  });

  // Register the floating widget
  await plugin.app.registerWidget('sketchpad_floating', WidgetLocation.FloatingWidget, {
    dimensions: { height: 'auto', width: 400 },
  });

  // Register toolbar button in queue
  await plugin.app.registerWidget('sketchpad_toolbar', WidgetLocation.QueueToolbar, {
    dimensions: { height: 'auto', width: 'auto' },
  });

  // Register tag-mode widget (FlashcardUnder) - only shows if setting is 'tag'
  await plugin.app.registerWidget('sketchpad_flashcard', WidgetLocation.FlashcardUnder, {
    dimensions: { height: 'auto', width: '100%' },
  });

  await plugin.app.toast('Sketchpad plugin loaded!');
  console.log('[Sketchpad] Plugin activated successfully');
}

async function onDeactivate(_: ReactRNPlugin) {
  console.log('[Sketchpad] Plugin deactivating...');
}

declareIndexPlugin(onActivate, onDeactivate);
