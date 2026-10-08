# Cal Invaders

*In a conference room far, far away....*

Cal Invaders is a Chrome extension that turns your Google Calendar week into a Space Invaders–style arcade game. The meetings on screen lift off the grid, form up as an invading fleet, and march down on your lone **Focus Time** starfighter. Shoot them down and win back hours of your week.

Don't worry, you won't actually delete anything on your calendar.

## How it plays

1. **Opening crawl:** a scrolling intro written from your own calendar: how many meetings you have, how many hours they take, and which one is the biggest villain.
2. **Title screen:** pick **Normal** or **⚠ Danger Mode**. Danger Mode claims every meeting you destroy will be declined and its organizer notified. This isn't working yet.
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

Launch the game with the toolbar button.

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

### Design notes

- **Nothing runs until you launch it.** The extension has no content scripts. `background.js` injects the game only when you click the toolbar button, so idle tabs pay no cost.
- **Read-only.** `scrape.js` only reads the DOM. While you play, the game hides the Calendar page (visibility only) and puts everything back exactly as it was when you quit.
- **If Google changes its markup**, the selectors to update are in the `SELECTORS` list at the top of `game/scrape.js`.

---

*Built quickly as part of a Claude Build Day event by [Parker Nolan](https://www.linkedin.com/in/parkernolan).*
