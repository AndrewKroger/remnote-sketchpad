import { declareIndexPlugin, type ReactRNPlugin, WidgetLocation } from '@remnote/plugin-sdk';
import '../style.css';
import '../index.css';

// Setting IDs
const SETTING_MODE = 'sketchpad-mode';
const SETTING_DISPLAY = 'sketchpad-display';
const SETTING_ERASER_KEY = 'sketchpad-eraser-key';
const SETTING_DEFAULT_ERASER_MODE = 'sketchpad-default-eraser-mode';

async function onActivate(plugin: ReactRNPlugin) {
  console.log('[Sketchpad] Plugin activating...');

  // Register mode setting (button vs tag)
  await plugin.settings.registerDropdownSetting({
    id: SETTING_MODE,
    title: 'Activation Mode',
    description: 'How the sketchpad is activated during flashcard review',
    defaultValue: 'button',
    options: [
      { key: '1', label: 'Button (click pencil icon to open)', value: 'button' },
      { key: '2', label: 'Tag Mode (auto-show under cards tagged "sketch")', value: 'tag' },
    ],
  });

  // Register display type setting (how sketchpad appears when opened)
  await plugin.settings.registerDropdownSetting({
    id: SETTING_DISPLAY,
    title: 'Display Type (for Button Mode)',
    description: 'How the sketchpad appears when you click the pencil button. Try different options to find what works best on your device.',
    defaultValue: 'sidebar',
    options: [
      { key: '1', label: 'Right Sidebar - Opens in right sidebar', value: 'sidebar' },
      { key: '2', label: 'Left Sidebar - Opens in left sidebar', value: 'left-sidebar' },
      { key: '3', label: 'Split Pane - Opens as side-by-side pane', value: 'pane' },
      { key: '4', label: 'Floating Window - Opens as popup window', value: 'floating' },
      { key: '5', label: 'Inline Under Card - Shows/hides under flashcard', value: 'inline' },
      { key: '6', label: 'Inline Extra Detail - Shows in card extra detail area', value: 'extra-detail' },
      { key: '7', label: 'Below Queue Toolbar - Shows below the queue top bar', value: 'below-toolbar' },
      { key: '8', label: 'Inside Flashcard - Renders within the flashcard itself', value: 'flashcard' },
      { key: '9', label: 'Rem Popup Right - Shows in rem reference popup (right)', value: 'rem-popup-right' },
      { key: '10', label: 'Rem Popup Start - Shows in rem reference popup (start)', value: 'rem-popup-start' },
    ],
  });

  // Register eraser shortcut key setting
  await plugin.settings.registerDropdownSetting({
    id: SETTING_ERASER_KEY,
    title: 'Hold-to-Erase Shortcut Key',
    description: 'Hold this key while drawing to temporarily switch to eraser mode',
    defaultValue: 'shift',
    options: [
      { key: '1', label: 'Shift', value: 'shift' },
      { key: '2', label: 'Control', value: 'control' },
      { key: '3', label: 'Alt/Option', value: 'alt' },
      { key: '4', label: 'Meta/Command', value: 'meta' },
      { key: '5', label: 'Disabled', value: 'none' },
    ],
  });

  // Register default eraser mode setting
  await plugin.settings.registerDropdownSetting({
    id: SETTING_DEFAULT_ERASER_MODE,
    title: 'Default Eraser Mode',
    description: 'Choose how the eraser works by default',
    defaultValue: 'pixel',
    options: [
      { key: '1', label: 'Pixel Erase - Erase parts of strokes', value: 'pixel' },
      { key: '2', label: 'Stroke Erase - Remove entire strokes', value: 'stroke' },
    ],
  });

  // Using SVG data URL for pencil icon since emojis don't work
  const pencilIconSvg = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>')}`;
  
  // Register for Right Sidebar
  await plugin.app.registerWidget('sketchpad', WidgetLocation.RightSidebar, {
    dimensions: { height: 'auto', width: '100%' },
    widgetTabTitle: 'Sketchpad',
    widgetTabIcon: pencilIconSvg,
  });

  // Register for Left Sidebar
  await plugin.app.registerWidget('sketchpad', WidgetLocation.LeftSidebar, {
    dimensions: { height: 'auto', width: '100%' },
    widgetTabTitle: 'Sketchpad',
    widgetTabIcon: pencilIconSvg,
  });

  // Register as a Pane widget (for split pane mode)
  await plugin.app.registerWidget('sketchpad', WidgetLocation.Pane, {
    dimensions: { height: 'auto', width: '100%' },
  });

  // Register the floating widget (for floating window mode)
  await plugin.app.registerWidget('sketchpad_floating', WidgetLocation.FloatingWidget, {
    dimensions: { height: 'auto', width: 400 },
  });

  // Register toolbar button in queue
  await plugin.app.registerWidget('sketchpad_toolbar', WidgetLocation.QueueToolbar, {
    dimensions: { height: 'auto', width: 'auto' },
  });

  // Register under flashcard (for tag mode AND inline toggle mode)
  await plugin.app.registerWidget('sketchpad_flashcard', WidgetLocation.FlashcardUnder, {
    dimensions: { height: 'auto', width: '100%' },
  });

  // Register in FlashcardExtraDetail (alternative inline position)
  await plugin.app.registerWidget('sketchpad_flashcard', WidgetLocation.FlashcardExtraDetail, {
    dimensions: { height: 'auto', width: '100%' },
  });

  // Register below queue top bar
  await plugin.app.registerWidget('sketchpad_flashcard', WidgetLocation.QueueBelowTopBar, {
    dimensions: { height: 'auto', width: '100%' },
  });

  // Register inside the Flashcard itself
  await plugin.app.registerWidget('sketchpad_flashcard', WidgetLocation.Flashcard, {
    dimensions: { height: 'auto', width: '100%' },
  });

  // Register in rem reference popup (right side)
  await plugin.app.registerWidget('sketchpad_flashcard', WidgetLocation.RemReferencePopupRight, {
    dimensions: { height: 'auto', width: '100%' },
  });

  // Register in rem reference popup (start)
  await plugin.app.registerWidget('sketchpad_flashcard', WidgetLocation.RemReferencePopupStart, {
    dimensions: { height: 'auto', width: '100%' },
  });

  await plugin.app.toast('Sketchpad plugin loaded!');
  console.log('[Sketchpad] Plugin activated successfully');
}

async function onDeactivate(_: ReactRNPlugin) {
  console.log('[Sketchpad] Plugin deactivating...');
}

declareIndexPlugin(onActivate, onDeactivate);
