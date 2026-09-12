const { chromium } = require('playwright');
const path = require('path'); require('fs').mkdirSync(__dirname + '/out', { recursive: true });
const assert = (c, m) => { if (!c) { console.error('FAIL:', m); process.exitCode = 1; } else console.log('ok  -', m); };

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on('pageerror', e => { console.error('PAGE ERROR', e.message); process.exitCode = 1; });
  page.on('console', m => { if (m.type() === 'error') console.error('CONSOLE', m.text()); });
  await page.goto('file://' + path.resolve(__dirname, '../index.html'));

  const S = () => page.evaluate(() => JSON.parse(JSON.stringify(state)));
  const rem = () => page.evaluate(() => remainingMs());
  const NAV = /start|plSettlement|plRoad|roll|discardDone|robberDone|knight|endTurn|sbDone|win|undo/;
  const click = async sel => { if (NAV.test(sel)) await page.waitForTimeout(720); await page.click(sel); };

  // Setup: 5 players, Normal
  await click('[data-act="playerAdd"]');
  let s = await S();
  assert(s.settings.players.length === 5 && s.settings.extension === true, 'adding 5th player enables extension');
  await click('[data-act="preset"][data-k="fast"]');
  s = await S();
  assert(s.settings.times.turn === 60 && s.settings.times.settlement === 120 && s.settings.times.road === 30, 'fast preset loaded');
  assert(s.settings.times.monopoly === 35 && s.settings.times.discard === 35, 'fast preset scales bonuses (' + s.settings.times.monopoly + ')');
  await click('[data-act="preset"][data-k="normal"]');
  await click('[data-act="start"]');

  // Placement
  s = await S();
  assert(s.phase === 'placement' && s.placement.order.join(',') === '0,1,2,3,4,4,3,2,1,0', 'snake order');
  assert(Math.abs((await rem()) - 180000) < 1500, 'settlement timer 3 min');
  await click('[data-act="plSettlement"]');
  assert(Math.abs((await rem()) - 225000) < 1500, 'road adds 45s → 3:45');
  for (let i = 0; i < 10; i++) {
    s = await S();
    if (s.placement && s.placement.step === 'settlement') { await click('[data-act="plSettlement"]'); await page.waitForTimeout(720); }
    await click('[data-act="plRoad"]'); await page.waitForTimeout(720);
  }
  s = await S();
  assert(s.phase === 'turn' && s.turn.player === 0 && s.turn.sub === 'preroll' && s.turnNumber === 1, 'placement done → turn 1 preroll');
  assert(Math.abs((await rem()) - 120000) < 1500, 'turn timer 2 min');

  // Roll normally, trade, build, monopoly
  await click('[data-act="roll"][data-seven="0"]');
  await click('[data-act="action"][data-id="playerTrade"]');
  await click('[data-act="action"][data-id="buildSettlement"]');
  assert(Math.abs((await rem()) - 165000) < 2000, 'trade +30, settlement +15 → ~2:45');
  await click('[data-act="action"][data-id="monopoly"]');
  s = await S();
  assert(s.turn.devPlayed && s.turn.banner, 'monopoly sets devPlayed + banner');
  assert(await page.isDisabled('[data-act="action"][data-id="yearOfPlenty"]'), 'other dev cards locked');
  assert(await page.isDisabled('[data-act="knight"]'), 'knight locked after dev card');

  // Extra time, limited to 1
  await click('[data-act="extra"]');
  assert(await page.isDisabled('[data-act="extra"]'), 'extra time limited per turn');

  // Undo
  const before = await rem();
  await click('[data-act="undo"]');
  assert((await rem()) < before - 25000, 'undo removed the +30 extra time');

  // End turn → special build (5 players)
  await click('[data-act="endTurn"]');
  s = await S();
  assert(s.phase === 'specialBuild' && s.turn.nextPlayer === 1, 'special building phase after turn');
  assert(Math.abs((await rem()) - 45000) < 1500, 'special build 45s');
  await click('[data-act="sbDone"]');
  s = await S();
  assert(s.phase === 'turn' && s.turn.player === 1 && s.players[0].stats.turns === 1, 'next player, stats counted');

  // Knight before roll
  await click('[data-act="knight"]');
  s = await S();
  assert(s.phase === 'robber' && s.robber.returnTo === 'preroll', 'knight before roll → robber, returns to preroll');
  assert(Math.abs((await rem()) - 30000) < 1500, 'robber timer 30s');
  await click('[data-act="robberDone"]');
  s = await S();
  assert(s.phase === 'turn' && s.turn.sub === 'preroll' && s.turn.devPlayed, 'back to preroll with dev played');
  assert(Math.abs((await rem()) - 120000) < 3000, 'turn clock restored (~2:00)');

  // Roll a 7 → discard → robber → main
  await click('[data-act="roll"][data-seven="1"]');
  s = await S();
  assert(s.phase === 'discard' && Math.abs((await rem()) - 45000) < 1500, 'discard phase 45s');
  await click('[data-act="discardDone"]');
  s = await S();
  assert(s.phase === 'robber' && s.robber.returnTo === 'main', '7 → robber → main');
  await click('[data-act="robberDone"]');
  s = await S();
  assert(s.phase === 'turn' && s.turn.sub === 'main', 'after robber, main phase');

  // Pause / resume
  await click('[data-act="pause"]');
  const r1 = await rem();
  await page.waitForTimeout(700);
  const r2 = await rem();
  assert(r1 === r2, 'paused clock does not move');
  await click('[data-act="pause"]');
  await page.waitForTimeout(500);
  assert((await rem()) < r2, 'resumed clock moves');

  // Persistence: reload lands paused with the same remaining
  const beforeReload = await rem();
  await page.reload();
  s = await S();
  assert(s.paused && s.phase === 'turn' && Math.abs((await rem()) - beforeReload) < 1500, 'reload restores game, paused');
  await click('[data-act="pause"]');

  // Overtime: force timer to expire
  await page.evaluate(() => { state.timer.endAt = Date.now() - 100; });
  await page.waitForTimeout(600);
  s = await S();
  assert(s.timer.expired && s.turn.wentOver && s.players[1].stats.overtimeTurns === 1, 'overtime detected and logged');
  assert((await page.getAttribute('#timer', 'class')).includes('over'), 'timer card goes red');
  await click('[data-act="action"][data-id="buildRoad"]');
  assert((await rem()) > 0 && !(await S()).timer.expired, 'action bonus pulls player out of overtime');

  // Win
  await click('[data-act="menu"]');
  await click('[data-act="overlay"][data-o="winner"]');
  await click('[data-act="win"][data-i="1"]');
  s = await S();
  assert(s.phase === 'finished' && s.winner === 1, 'winner declared');
  assert((await page.textContent('body')).includes('Slowest player'), 'slowest player award shown');
  await page.screenshot({ path: __dirname + '/out/finished.png', fullPage: true });
  await click('[data-act="newGame"]');
  s = await S();
  assert(s.phase === 'setup' && s.settings.players.length === 5, 'new game keeps players');

  // Screenshots of main screens
  await click('[data-act="start"]');
  await page.screenshot({ path: __dirname + '/out/placement.png' });
  for (let i = 0; i < 10; i++) { await click('[data-act="plSettlement"]'); await page.waitForTimeout(720); await click('[data-act="plRoad"]'); await page.waitForTimeout(720); }
  await click('[data-act="roll"][data-seven="0"]');
  // Double-tap guard: two rapid End turn taps must only end one turn
  await page.evaluate(() => { state.settings.extension = false; });
  await click('[data-act="action"][data-id="buildRoad"]');
  const p0 = (await S()).turn.player;
  await page.waitForTimeout(720);
  await page.click('[data-act="endTurn"]', { clickCount: 2 });
  await page.waitForTimeout(100);
  s = await S();
  assert(s.turn.player === (p0 + 1) % 5 && s.turnNumber === 2, 'double tap on End turn ends only one turn');
  await page.waitForTimeout(800);

  await page.screenshot({ path: __dirname + '/out/turn.png', fullPage: true });
  await browser.close();
  console.log(process.exitCode ? 'SMOKE FAILED' : 'SMOKE PASSED');
})().catch(e => { console.error(e); process.exit(1); });
