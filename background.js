// Nothing runs in the page until the user clicks the toolbar button (or Alt+Shift+I),
// so the extension costs zero memory on idle tabs.
const GAME_FILES = [
  'game/ns.js',
  'game/audio.js',
  'game/scrape.js',
  'game/formation.js',
  'game/crawl.js',
  'game/engine.js',
  'game/end.js',
  'game/main.js',
];

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab || tab.id == null) return;
  const target = { tabId: tab.id };
  try {
    const [check] = await chrome.scripting.executeScript({ target, func: () => !!window.__CI });
    if (check && check.result) return; // a game is already running in this tab
    await chrome.scripting.insertCSS({ target, files: ['game/game.css'] });
    await chrome.scripting.executeScript({ target, files: GAME_FILES });
  } catch (err) {
    console.warn('Cal Invaders could not start on this page:', err);
  }
});
