# Catan Turn Timer

A Colonist-style turn timer for playing **Catan in person**. One phone at the table, big buttons, a
clock that everyone can read from across the board. Every action a player takes adds time to their
clock, exactly the way Colonist does it online, but the numbers are tuned for physical cards, dice
and pieces.

It is a single `index.html` file with no dependencies. Open it in any phone browser, or host it on
GitHub Pages and "Add to Home Screen" for a full-screen app.

## Quick start

1. Open `index.html` on a phone (or visit the GitHub Pages URL once enabled).
2. Enter players in **seating order**, pick a speed, tap **Start game**.
3. Pass the phone with the dice. Whoever is on the clock taps what they do; the clock adjusts.

## What the timer knows about Catan

The app follows the official base-game turn structure and the 5–6 player extension.

| Phase | What happens | Timer |
|---|---|---|
| Initial placement | Snake order 1→N then N→1. Settlement first, then the road. Second settlement collects starting resources. | Settlement time, then **+road time** once the settlement is down (Colonist's model). |
| Pre-roll | You must roll before anything else. A Knight may be played before rolling. | Base turn time starts. |
| Roll a 7 | Everyone with more than 7 cards discards half (rounded down). Then the roller moves the robber and steals. | Turn clock **freezes**. Group discard timer, then a robber timer. Turn resumes with the time it had. |
| Trade & build | Player trades (active player only), bank/harbor trades, roads, settlements, cities, dev cards, in any order. | Each action **adds seconds** to the running clock. |
| Development cards | One per turn, never one bought this turn. VP cards may be revealed any time on your turn. | Knight: separate robber timer. Road Building / Year of Plenty / Monopoly: added seconds. Other dev buttons lock after one is played. |
| Monopoly | Every other player counts and hands over all of one resource, slow at a real table. | Biggest bonus of any action. |
| Special building phase (5–6 players) | After each turn, all other players may build (no trading). | One shared timer. |
| End of game | You can only win on your own turn. | Menu → Declare win, then a stats screen. |

When a clock hits zero the card turns red, an alarm sounds, the phone vibrates and the overtime is
logged against that player. The app never forces a turn to end. Your table decides the penalty
(suggestion: no more trading once you are in the red).

## Speeds

Base turn and placement times match Colonist's presets. The per-action bonuses are the in-person
"Normal" values below, scaled by the preset (Blitz ×0.5, Fast ×0.75, Slow ×1.5). Everything is
editable under **All timings** or from the in-game menu, which switches the preset to Custom.

| | Blitz | Fast | Normal | Slow |
|---|---|---|---|---|
| Turn | 30s | 1m | 2m | 4m |
| Initial settlement | 1m | 2m | 3m | 6m |
| + initial road | 15s | 30s | 45s | 1m 30s |

Normal-speed action bonuses (seconds added to the clock):

| Action | Bonus |
|---|---|
| Trade with a player | +30 |
| Bank / harbor trade | +10 |
| Build road | +10 |
| Build settlement | +15 |
| Build city | +15 |
| Buy development card | +10 |
| Road Building | +20 |
| Year of Plenty | +10 |
| Monopoly | +45 |
| "Extra time" button (1 per turn by default) | +30 |
| Knight / robber after a 7 | separate 30s clock |
| Discard phase after a 7 | 45s for the whole table |
| Special building phase | 45s |
| Warning sound | 15s left |

## Dice

Setup has a **Dice** switch:

- **In-app** (default): one tap rolls two dice with a short tumble animation. A 7 goes straight to the
  discard phase; anything else goes to trade & build. The roll stays on the timer card for the rest
  of the turn. Undo takes a roll back.
- **Physical**: use real dice and tap "Rolled" or "Rolled a 7".

In-app dice come in two flavours, chosen in setup:

- **True random** (default): each die is drawn independently from the browser's cryptographic
  random source using rejection sampling, so there is no rounding bias toward any face. Behaves
  exactly like real dice, streaks included.
- **Balanced deck**: all 36 face combinations are shuffled into a deck and drawn without
  replacement, reshuffled when 5 cards remain so the deck cannot be counted. Over each deck every
  total appears as often as probability dictates. This is the Catan dice deck / Colonist
  "balanced dice" model.

With in-app dice the stats screen adds a roll histogram for 2–12 with the fair-dice expectation
marked on each bar, per-player sevens and average roll, and awards for the robber magnet (most 7s)
and the highest and lowest average roll.

## Other features

- Pause / resume (spacebar on a laptop), undo the last tap, event log.
- Per-player stats: turns, total time, average, longest turn, overtime count, at the end of the game.
- Game state is saved on the phone. If the browser is closed or refreshed, the game comes back paused
  where it was.
- Keeps the screen awake while a game is running (on browsers that support the Wake Lock API).
- Sounds and vibration can be turned off in setup.

## Hosting on GitHub Pages

Settings → Pages → Source: *Deploy from a branch* → `main` / root. The page is then available at
`https://<user>.github.io/Catan-timer/`. On iOS use Share → Add to Home Screen; on Android use the
browser menu → Install app.

## Development

There is no build step. `test/smoke.js` is a headless Playwright test that plays through placement,
a full turn, a 7, Monopoly, a Knight, the special building phase, pause, undo, reload, overtime and
a win, checking the clock after each step. It also drops screenshots into `test/out/`.

```
npm i -g playwright && npx playwright install chromium   # once
node test/smoke.js
```
