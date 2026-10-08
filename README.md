# Cal Invaders

*In a conference room far, far away....*

Cal Invaders is a Chrome extension that turns your Google Calendar week into a Space Invaders–style arcade game. The meetings on screen lift off the grid, form up as an invading fleet, and march down on your lone **Focus Time** starfighter. Shoot them down and win back hours of your week.

Nothing on your real calendar is changed. The game only reads what's already on the page.

## How it plays

1. **Opening crawl:** a scrolling intro written from your own calendar: how many meetings you have, how many hours they take, and which one is the biggest villain.
2. **Title screen:** pick **Normal** or **⚠ Danger Mode**. Danger Mode claims every meeting you destroy will be declined and its organizer notified. It's a joke, and the end screen says so.
3. **Lift-off:** the real calendar shows for a moment with the invaders sitting exactly on top of your meeting chips. Then the meetings rise into formation.
4. **The fight:** each meeting you destroy adds its length to **Hours Saved**. You win when you reach the target, which is about 60% of your total meeting time and never less than 2 hours. Watch for the **ALL-HANDS** ship flying across the top: it's worth a bonus hour.
5. **End screen:** a report listing every meeting you "destroyed." Win, and the next wave is harder.

You start with three lives (**PTO days**). Lose them all and the meetings win.

If no meetings are visible, the Empire sends filler meetings instead ("Sync about the sync," "Pre-meeting prep meeting," …), so the game works on an empty week too.

## Controls

| Key | Action |
| --- | --- |
| `←` `→` / `A` `D` | Move |
| `Space` | Fire (also skips the intro crawl) |
| `P` | Pause |
| `M` | Mute |
| `F` | Toggle the FPS / performance meter |
| `Esc` | Quit and go back to your calendar |
| `N` / `D` (title screen) | Pick Normal / Danger Mode |

Launch the game with the toolbar button or **Alt+Shift+I**.

**Potato mode** (a checkbox on the title screen) renders at half resolution for slower laptops. The game also switches to a low-power mode by itself if the frame rate drops.

## Install (unpacked)

1. Clone this repo:
   ```
   git clone https://github.com/sirsigmund79/cal-invaders.git
   ```
2. Open `chrome://extensions` in Chrome.
3. Turn on **Developer mode** (top right).
4. Click **Load unpacked** and select the project folder.
5. Open [Google Calendar](https://calendar.google.com) in week view and press **Alt+Shift+I**.

## Development

You don't need Google Calendar or the extension to work on the game. Open `dev/mock-calendar.html` directly in a browser. It draws a fake week of meetings that use the same markup the scraper looks for. Click **Launch Cal Invaders** or press `I` to start. Tick **Empty week** to test the filler-meeting fallback.

The mock page reloads the game scripts each time it launches, so a browser refresh is enough to pick up your changes.

### Project layout

```
manifest.json        Manifest V3 config (activeTab + scripting permissions only)
background.js        Injects the game into the current tab when the action is clicked
game/
  ns.js              Shared namespace (window.__CI) and helpers
  audio.js           Sound effects synthesized with Web Audio (no audio files)
  scrape.js          Reads meeting chips, times, and colors from the Calendar page
  formation.js       Pre-renders all sprites to offscreen canvases and lays out the fleet
  crawl.js           Opening crawl and title / mode-select screen
  engine.js          The game: canvas rendering, fixed-step 60 Hz loop, HUD, collisions
  end.js             End-of-game report
  main.js            Runs the stages in order, handles input, and tears everything down
  game.css           Styles for the overlay, crawl, HUD, and end screen
dev/
  mock-calendar.html Standalone test page with a fake calendar
icons/               Extension icons (16, 48, 128)
```

### Design notes

- **Nothing runs until you launch it.** The extension has no content scripts. `background.js` injects the game only when you click the toolbar button, so idle tabs pay no cost.
- **Read-only.** `scrape.js` only reads the DOM. While you play, the game hides the Calendar page (visibility only) and puts everything back exactly as it was when you quit.
- **Keyboard isolation.** The game swallows all key events while it's running, so Calendar's own shortcuts (`c`, `d`, `w`, …) don't fire under it.
- **Performance.** One canvas, preallocated object pools, no allocation per frame, and the crawl is animated with CSS on the compositor.
- **If Google changes its markup**, the selectors to update are in the `SELECTORS` list at the top of `game/scrape.js`.
