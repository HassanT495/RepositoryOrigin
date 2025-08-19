'use strict';

let gameplay = null;

const ASSET_BASE = './src/GameAssets';

const byId = (id) => document.getElementById(id);
const delay = (ms) => new Promise((r) => setTimeout(r, ms));

/* =========================
   Asset helpers
========================= */
async function loadImageURL(folder, file) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img.src);
    img.onerror = () => resolve(null);
    img.src = `${ASSET_BASE}/${folder}/${file}`;
  });
}
const loadBackgroundURL = (file) => loadImageURL('Backgrounds', file);
const loadSpriteURL = (file) => loadImageURL('Sprites', file);

// Keep this near other DOM utilities.
const setAttackUIVisible = (show) =>
  document.querySelectorAll('.attack-ui').forEach(el => el.hidden = !show);


/* =========================
   Fade helpers
========================= */
function getFadeDurationMs() {
  const v = getComputedStyle(document.documentElement).getPropertyValue('--fade-duration').trim();
  if (v.endsWith('ms')) return parseFloat(v);
  if (v.endsWith('s')) return parseFloat(v) * 1000;
  return 1500;
}
function waitForOpacityTransition(el) {
  const timeout = getFadeDurationMs() + 50;
  return new Promise((resolve) => {
    let done = false;
    const onEnd = (e) => {
      if (!done && e.propertyName === 'opacity') {
        done = true;
        el.removeEventListener('transitionend', onEnd);
        resolve();
      }
    };
    el.addEventListener('transitionend', onEnd);
    setTimeout(() => {
      if (!done) {
        done = true;
        el.removeEventListener('transitionend', onEnd);
        resolve();
      }
    }, timeout);
  });
}
function fadeIn(overlay = byId('overlay')) {
  if (!overlay || !overlay.classList.contains('is-hidden')) return Promise.resolve();
  overlay.classList.remove('is-hidden');
  return waitForOpacityTransition(overlay);
}
function fadeOut(overlay = byId('overlay')) {
  if (!overlay || overlay.classList.contains('is-hidden')) return Promise.resolve();
  overlay.classList.add('is-hidden');
  return waitForOpacityTransition(overlay);
}

/* =========================
   Speech UI (DOM)
========================= */
function showSpeech(text, cls = 'speech') {
  // Hide the other bubble type so only one is visible.
  const other = cls === 'speech' ? '.enemy-speech' : '.speech';
  document.querySelectorAll(other).forEach(el => (el.dataset.show = 'false'));
  // Show the requested bubble type.
  document.querySelectorAll(`.${cls}`).forEach(el => {
    el.textContent = text;
    el.dataset.show = 'true';
  });
}
function hideSpeech(...classes) {
  const sels = classes.length ? classes.map(c => `.${c}`).join(',') : '.speech, .enemy-speech';
  document.querySelectorAll(sels).forEach(el => {
    el.dataset.show = 'false';
  });
}
const showEnemySpeech = (text) => showSpeech(text, 'enemy-speech');
const hideAllSpeech = () => hideSpeech(); // Hides both types ; SIKE!

// Remove any enemy-speech elements inserted by the engine so the DOM owns them fully.
function suppressEngineEnemySpeech(stage) {
  const isDomOwned = (el) => el.id === 'enemySpeech' || el.dataset.owner === 'dom';
  const purge = () => {
    document.querySelectorAll('.enemy-speech').forEach(el => {
      if (!isDomOwned(el)) el.remove();
    });
  };
  purge();
  const mo = new MutationObserver(() => purge());
  mo.observe(stage || document.body, { childList: true, subtree: true });
  return () => mo.disconnect();
}

/* =========================
   Sprite helpers
========================= */
function showPlayer() {
  const el = byId('player');
  if (el) el.style.display = 'block';
}
function hidePlayer() {
  const el = byId('player');
  if (!el) return;
  el.style.display = 'none';
  el.style.backgroundImage = 'none';
  el.style.backgroundSize = '';
  el.style.backgroundPosition = '';
  el.style.transform = '';          // Clear any transform applied during gameplay
  el.style.transformOrigin = '';
  el.dataset.scale = '1';
  el.dataset.cols = '1';
  el.dataset.rows = '1';
}
function showNext() {
  const b = byId('nextButton');
  if (b) b.style.display = 'inline-block';
}
function hideNext() {
  const b = byId('nextButton');
  if (b) b.style.display = 'none';
}
function setSpriteSheet2x2(el, url, { scale = 1 } = {}) {
  el.dataset.cols = '2';
  el.dataset.rows = '2';
  el.dataset.scale = String(scale);
  el.style.backgroundImage = `url("${url}")`;
  el.style.backgroundSize = '200% 200%';
  el.style.backgroundPosition = '0% 0%';
  el.style.transformOrigin = 'bottom center';
  el.style.transform = `scale(${scale})`;
}
function setSpriteFrame2x2(el, index) {
  if (!el) return;
  const i = ((index % 4) + 4) % 4;
  const col = i % 2;
  const row = i >> 1;
  el.style.backgroundPosition = `${col * 100}% ${row * 100}%`;
}
function placePlayerInArea(colStart = 3, colEnd = 10, rowStart = 3, rowEnd = 8) {
  const el = byId('player');
  if (!el) return;
  el.style.gridColumn = `${colStart} / ${colEnd + 1}`;
  el.style.gridRow = `${rowStart} / ${rowEnd + 1}`;
}
async function playSprite2x2(el, totalMs = 4000) {
  const frames = ['0% 0%', '100% 0%', '0% 100%', '100% 100%'];
  const hold = totalMs / frames.length;
  for (const pos of frames) {
    el.style.backgroundPosition = pos;
    await delay(hold);
  }
}

/* =========================
   Grid helpers
========================= */
function ensureSprite(id) {
  let el = byId(id);
  if (!el) {
    el = document.createElement('div');
    el.id = id;
    el.className = 'sprite';
    byId('grid').appendChild(el);
    el.style.width = '100%';
    el.style.height = '100%';
    el.style.imageRendering = 'pixelated';
  }
  return el;
}
function placeSprite(el, colStart, colEnd, rowStart, rowEnd) {
  el.style.gridColumn = `${colStart} / ${colEnd + 1}`;
  el.style.gridRow = `${rowStart} / ${rowEnd + 1}`;
}
function setSpriteSheet(el, url, { cols = 1, rows = 1, scale = 1 } = {}) {
  el.dataset.cols = String(cols);
  el.dataset.rows = String(rows);
  el.dataset.scale = String(scale);
  el.style.backgroundImage = `url("${url}")`;
  el.style.backgroundSize = `${cols * 100}% ${rows * 100}%`;
  el.style.backgroundPosition = '0% 0%';
  el.style.transformOrigin = 'bottom center';
  el.style.transform = `scale(${scale})`;
}
function setSpriteFrame(el, index) {
  const cols = +(el.dataset.cols || 1);
  const rows = +(el.dataset.rows || 1);
  const total = cols * rows;
  const i = ((index % total) + total) % total;
  const col = i % cols;
  const row = (i / cols) | 0;
  const x = cols === 1 ? 0 : (col / (cols - 1)) * 100;
  const y = rows === 1 ? 0 : (row / (rows - 1)) * 100;
  el.style.backgroundPosition = `${x}% ${y}%`;
}
function faceSprite(el, dir) {
  const s = +(el.dataset.scale || 1);
  el.style.transform = `scale(${dir === 'left' ? -s : s}, ${s})`;
}

/* =========================
   Credits
========================= */
function showCredits(lines, durationMs = 20000) {
  const el = byId('credits');
  if (!el) return Promise.resolve();
  const inner = el.querySelector('.credits__inner');
  inner.innerHTML = '';
  for (const line of lines) {
    const row = document.createElement('div');
    row.textContent = line;
    inner.appendChild(row);
  }
  document.documentElement.style.setProperty('--credits-duration', `${durationMs}ms`);
  el.dataset.show = 'true';
  return new Promise((resolve) =>
    inner.addEventListener('animationend', resolve, { once: true })
  );
}
function hideCredits() {
  const el = byId('credits');
  if (el) el.dataset.show = 'false';
}
async function runCredits(lines, durationMs = 20000) {
  hideNext();
  await showCredits(lines, durationMs);
  hideCredits();
}

/* =========================
   Next button wait
========================= */
let cancelNextWait = null;
function waitForNextClick() {
  return new Promise((resolve) => {
    const btn = byId('nextButton');
    if (!btn) { resolve(); return; }
    showNext();
    const complete = () => {
      btn.removeEventListener('click', complete);
      btn.removeEventListener('touchstart', complete);
      window.removeEventListener('keydown', onKey);
      hideNext();
      cancelNextWait = null;
      resolve();
    };
    const onKey = (e) => {
      const t = e.target;
      const tag = (t?.tagName || '').toLowerCase();
      const isTextInput = tag === 'input' || tag === 'textarea' || t?.isContentEditable;
      if (isTextInput) return;
      if ((e.key === 'Enter' || e.key === ' ' || e.code === 'Space') && !e.repeat) {
        e.preventDefault();
        complete();
      }
    };
    cancelNextWait = complete;
    btn.addEventListener('click', complete, { once: true });
    btn.addEventListener('touchstart', complete, { once: true, passive: true });
    window.addEventListener('keydown', onKey);
  });
}

/* =========================
   Layout
========================= */
function applyLayout() {
  document.body.classList.add('layout-center');
  const main = document.querySelector('main');
  main.classList.add('game-shell');
  const stage = byId('app');
  stage.classList.add('game-stage');

  // Player speech bubble (DOM-owned)
  let speech = byId('speech');
  if (!speech) {
    speech = document.createElement('div');
    speech.id = 'speech';
    speech.className = 'speech';
    main.appendChild(speech);
  } else if (speech.parentElement !== main) {
    main.appendChild(speech);
  }

  // Enemy speech bubble (DOM-owned)
  let enemySpeech = byId('enemySpeech');
  if (!enemySpeech) {
    enemySpeech = document.createElement('div');
    enemySpeech.id = 'enemySpeech';
    enemySpeech.className = 'enemy-speech';
    enemySpeech.dataset.owner = 'dom';
    main.appendChild(enemySpeech);
  } else if (enemySpeech.parentElement !== main) {
    main.appendChild(enemySpeech);
  }

  // Fade overlay
  let overlay = byId('overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'overlay';
    overlay.className = 'overlay';
    stage.appendChild(overlay);
  }

  // Credits container
  let credits = byId('credits');
  if (!credits) {
    credits = document.createElement('div');
    credits.id = 'credits';
    credits.className = 'credits';
    const inner = document.createElement('div');
    inner.className = 'credits__inner';
    credits.appendChild(inner);
    stage.appendChild(credits);
  }

  // Tile grid
  let grid = byId('grid');
  if (!grid) {
    grid = document.createElement('div');
    grid.id = 'grid';
    grid.className = 'tile-grid';
    stage.appendChild(grid);
  }
  grid.style.setProperty('--cols', 24);
  grid.style.setProperty('--rows', 18);

  // Player sprite
  let player = byId('player');
  if (!player) {
    player = document.createElement('div');
    player.id = 'player';
    player.className = 'sprite';
    grid.appendChild(player);
    player.style.width = '100%';
    player.style.height = '100%';
  }

  // Next button
  let nextBtn = byId('nextButton');
  if (!nextBtn) {
    nextBtn = document.createElement('button');
    nextBtn.id = 'nextButton';
    nextBtn.className = 'pixel-button';
    nextBtn.textContent = 'NEXT';
    nextBtn.style.display = 'none';
    stage.appendChild(nextBtn);
  }

  // Keep grid scaled to the stage size.
  function fitGridScale() {
    const cols = +getComputedStyle(grid).getPropertyValue('--cols') || 24;
    const rows = +getComputedStyle(grid).getPropertyValue('--rows') || 18;
    const tile = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--tile')) || 32;
    const gridW = cols * tile;
    const gridH = rows * tile;
    const s = Math.min(stage.clientWidth / gridW, stage.clientHeight / gridH);
    const scale = s >= 1 ? Math.floor(s) : s;
    grid.style.setProperty('--scale', scale);
  }

  fitGridScale();
  window.addEventListener('resize', fitGridScale);
  window.addEventListener('orientationchange', fitGridScale);

  const stopSpeechHijack = suppressEngineEnemySpeech(stage);

  // Cleanup listeners and observers.
  return () => {
    window.removeEventListener('resize', fitGridScale);
    window.removeEventListener('orientationchange', fitGridScale);
    stopSpeechHijack?.();
  };
}

/* =========================
   Dialogue beats (non-combat)
========================= */
async function speakSequence(lines) {
  for (const line of lines) {
    showSpeech(line);
    await waitForNextClick();
  }
  hideSpeech();
}
const STORY_BREAKS = {
  6: async () => { await speakSequence(['…That rat was tougher than it looked.']); },
  7: async () => { await speakSequence(['The streets are eerily quiet.', 'I should hurry...']); },
  8: async () => { await speakSequence(['Someone—or something—is watching...']); },
  9: async () => { await speakSequence(['The air here is colder...']); },
  10: async () => { await speakSequence(['Begone spirits! Return to where you came from!']); }
};

/* =========================
   Early story scenes 1–4
========================= */
async function scene1(bg = 'DobbyOffice.png', hold = 1000) {
  const stage = byId('app');
  const overlay = byId('overlay');
  const src = await loadBackgroundURL(bg);
  if (!src) return;
  stage.style.backgroundImage = `url("${src}")`;
  await fadeOut(overlay);
  await waitForNextClick();
  await delay(hold);
  await fadeIn(overlay);
}
async function scene2(
  bg = 'DobbyOfficeF1.png',
  sprite = 'MCdesk.png',
  hold = 1000,
  t1 = 'Mmm~ Finally, work is finished.',
  t2 = 'Thank you for your hard work, Everyone!',
  t3 = 'Tomorrow is the start of our Obon Holidays...',
  t4 = "I can't wait to go home and see my family!",
  t5 = '...',
  t6 = 'Where is my hometown again?',
  t7 = "Oh right, you don’t know...",
  t8 = "It’s a small island in the western sea. It’s called..."
) {
  const stage = byId('app');
  const overlay = byId('overlay');
  const playerEl = byId('player');
  const [bgUrl, spriteUrl] = await Promise.all([loadBackgroundURL(bg), loadSpriteURL(sprite)]);
  if (!bgUrl || !spriteUrl) return;
  stage.style.backgroundImage = `url("${bgUrl}")`;
  placePlayerInArea(1, 8, 11, 18);
  setSpriteSheet2x2(playerEl, spriteUrl);
  await fadeOut(overlay);
  await playSprite2x2(playerEl, 2000);
  await speakSequence([t1, t2, t3, t4, t5, t6, t7, t8]);
  await delay(hold);
  await fadeIn(overlay);
  hidePlayer();
}
async function scene3(bg = 'TsuMap.png', hold = 1000) {
  const stage = byId('app');
  const overlay = byId('overlay');
  const bgUrl = await loadBackgroundURL(bg);
  if (!bgUrl) return;
  stage.style.backgroundImage = `url("${bgUrl}")`;
  await fadeOut(overlay);
  await waitForNextClick();
  await delay(hold);
  await fadeIn(overlay);
}
async function scene4(
  bg = 'dock.png',
  sprite = 'MCdialogue.png',
  hold = 1000,
  t1 = 'phew.. That was a long boat ride',
  t2 = 'but it feels so good to be back home after so long...',
  t3 = 'I wonder if my family is waiting for me at home?',
  t4 = '...',
  t5 = "Strange.. I don’t see anyone around.",
  t6 = 'Anyway, I should probably head home first.'
) {
  const stage = byId('app');
  const overlay = byId('overlay');
  const playerEl = byId('player');
  const [bgUrl, spriteUrl] = await Promise.all([loadBackgroundURL(bg), loadSpriteURL(sprite)]);
  if (!bgUrl || !spriteUrl) return;
  stage.style.backgroundImage = `url("${bgUrl}")`;
  setSpriteSheet2x2(playerEl, spriteUrl);
  showPlayer();
  placePlayerInArea(1, 11, 8, 19);
  setSpriteFrame2x2(playerEl, 0);
  await fadeOut(overlay);
  const script = [
    [0, t1],
    [1, t2],
    [2, t3],
    [2, t4],
    [0, t5],
    [1, t6]
  ];
  for (const [frameIndex, line] of script) {
    setSpriteFrame2x2(playerEl, frameIndex);
    showSpeech(line);
    await waitForNextClick();
  }
  hideSpeech();
  await delay(hold);
  await fadeIn(overlay);
  hidePlayer();
}

/* =========================
   Fight scenes (DOM-owned)
========================= */
const FIGHT_SCENES = [
  { id: 6, background: 'City.png', flow: { exitThresholdRatio: 0.90, offscreenSpawnPx: 160, spawnCooldownMs: 600 }, queue: [{ type: 'rat' }] },
  { id: 7, background: 'City.png', flow: { exitThresholdRatio: 0.90, offscreenSpawnPx: 180, spawnCooldownMs: 650 }, queue: [{ type: 'rat' }, { type: 'rat' }] },
  { id: 8, background: 'Festival.png', flow: { exitThresholdRatio: 0.88, offscreenSpawnPx: 200, spawnCooldownMs: 750 }, queue: [{ type: 'rat' }, { type: 'rat' }, { type: 'rat' }] },
  { id: 9, background: 'GY8B.png', flow: { exitThresholdRatio: 0.87, offscreenSpawnPx: 220, spawnCooldownMs: 850 }, queue: [{ type: 'rat' }, { type: 'rat' }, { type: 'rat' }, { type: 'rat' }] },
  {
    id: 10,
    background: 'GYFinale.png',
    flow: { exitThresholdRatio: 0.85, offscreenSpawnPx: 260, spawnCooldownMs: 10000 },
    queue: [
      { type: 'ratElectric', preLine: 'Rat: Turn back now, or you will die.' },
      { type: 'ghost', preLine: 'Ghost: I will eat your soul.' },
      { type: 'ghostBoss', preLine: 'Boss Ghost: I will absorb your soul into myself.' }
    ]
  }
];
const FINALE_ID = 10;
const isFinale = (id) => id === FINALE_ID;

/* =========================
   Grandpa takeover (DOM-driven)
========================= */
async function runGrandpaTakeoverSequence(api) {
  // Sequence: appear, Next, fade to black, engine transforms, fade in, dialogue.
  await speakSequence(['Guardian appears...']);
  await fadeIn(); // Darken
  await delay(150);

  // Ask the engine to transform. Use the API if available, else dispatch an event.
  if (api?.transformToGrandpa) {
    await api.transformToGrandpa();
  } else {
    document.dispatchEvent(new CustomEvent('obon:transform-to-grandpa'));
  }

  await delay(150);
  await fadeOut(); // Reveal

  await speakSequence([
    'You: Grandpa? Is that really you?',
    'Guardian: Yes, Anko. It’s me.',
    '...',
    'Guardian: Don’t worry, I will protect you.'
  ]);
}

/* =========================
   Bridge to gameplay (Scene 5)
========================= */
async function scene5() {
  const stage = byId('app');
  const overlay = byId('overlay');
  const grid = byId('grid');
  const mcEl = byId('player');

  const [bgUrl, mcUrl, guardianUrl] = await Promise.all([
    loadBackgroundURL('City.png'),
    loadSpriteURL('MCidle.png'),
    loadSpriteURL('Bfront.png')
  ]);

  if (bgUrl) stage.style.backgroundImage = `url("${bgUrl}")`;
  setSpriteSheet(mcEl, mcUrl, { cols: 4, rows: 4, scale: 0.6 });
  setSpriteFrame(mcEl, 0);
  showPlayer();
  placePlayerInArea(2, 10, 9, 18);

  const guardianEl = ensureSprite('guardian');
  setSpriteSheet(guardianEl, guardianUrl, { cols: 5, rows: 1, scale: 0.4 });
  setSpriteFrame(guardianEl, 0);
  placeSprite(guardianEl, 7, 12, 12, 17);
  faceSprite(guardianEl, 'left');

  await fadeOut(overlay);
  await speakSequence([
    '??? : Halt. You cannot pass unprepared.',
    'You: W-who are you?',
    'Guardian: Consider me a friend. Take this charm—',
    'Guardian: it awakens the strength to fight.',
    'You: …I can feel a strange energy.',
    'Guardian: Use it wisely. You must face the spirits alone.',
    'You: Alone? What spirits?',
    'Guardian: Restless ones. Defeat them to restore peace.',
    'Guardian: Go—the island awaits.',
    'You: Wait...'
  ]);
  await fadeIn(overlay);
  hidePlayer();
  guardianEl.remove();

  stage.style.backgroundImage = 'none';        // Alternatively: stage.style.removeProperty('backgroundImage')
  stage.style.backgroundColor = '#000';

  // Prepare the canvas for gameplay.
  let canvas = byId('game');
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.id = 'game';
  }
  if (overlay && canvas.nextSibling !== overlay) stage.insertBefore(canvas, overlay);
  else if (!canvas.parentElement) stage.appendChild(canvas);

  setAttackUIVisible(true);

  stage.style.position = 'relative';
  Object.assign(canvas.style, { position: 'absolute', inset: '0', width: '100%', height: '100%' });
  canvas.width = stage.clientWidth;
  canvas.height = stage.clientHeight;
  canvas.hidden = false;

  const prevGridDisplay = grid?.style.display || '';
  if (grid) grid.style.display = 'none';

  const mod = await import('./GamePart2.js');

  // Hooks used by the gameplay engine to coordinate scene flow with the DOM.
  const hooks = {
    // Called before spawning an enemy when a preLine is present (finale taunts).
    onPreSpawnLine: async (_api, { text } = {}) => {
      if (!text) return;
      showEnemySpeech(text);
      await waitForNextClick();
      hideSpeech('enemy-speech');
    },
    // Called when a scene is cleared.
    onReadyForNext: async (api, { sceneId } = {}) => {
      if (STORY_BREAKS[sceneId]) await STORY_BREAKS[sceneId]();
      else { showNext(); await waitForNextClick(); hideNext(); }
      await fadeIn();
      api.gotoNextScene();
      await fadeOut();
    },
    // Player death.
    onPlayerDeath: async (api, { sceneId, killerKind } = {}) => {
      await fadeIn();
      if (isFinale(sceneId) && killerKind === 'ghostBoss') {
        await runGrandpaTakeoverSequence(api); // DOM shows speech; engine performs the transform.
        await fadeOut();
        return;
      }
      showSpeech('You fell… try again?');
      const btn = byId('nextButton');
      const old = btn.textContent;
      btn.textContent = 'RETRY';
      showNext();
      await waitForNextClick();
      hideNext();
      hideSpeech();
      btn.textContent = old;
      api.retryScene?.();
      await fadeOut();
    }
  };

  // Start gameplay with DOM-owned scenes.
  const game = mod.start({ canvas, hooks, scenes: FIGHT_SCENES, useDomSpeech: true });
  gameplay = game;

  await fadeOut(overlay);
  await game.finished;            // Battle scenes have ended.
  setAttackUIVisible(false);      // Hide attack buttons.
  document.dispatchEvent(new CustomEvent('obon:hero-theme', {
    detail: { name: '', tint: '', map: {}, cooldowns: {}, disabled: true } // Stop any HUD logic.
  }));
  await fadeIn(overlay);

  game.stop?.();
  gameplay = null;
  canvas.hidden = true;
  if (grid) grid.style.display = prevGridDisplay;

  // Clear background for the next scene.
  stage.style.removeProperty('backgroundImage');

  await fadeOut(overlay);
}

/* =========================
   Ending scenes
========================= */
async function sceneEND(
  bg = 'TsuLakeDusk.png',
  sprite = 'MCdialogue.png',
  hold = 1000,
  t1 = 'Thank you, Grandpa!',
  t2 = 'I really thought I was done for...',
  t3 = "If it wasn’t for you...",
  t4 = '...',
  t5 = "I’m sorry I couldn’t see you sooner...",
  t6 = '...',
  t7 = '...',
  t8 = '...',
  t9 = "Okay, Grandpa. I won’t cry anymore.",
  t10 = '...',
  t11 = 'See you next year.',
  t12 = '...'
) {
  const stage = byId('app');
  const overlay = byId('overlay');
  const playerEl = byId('player');
  const [bgUrl, spriteUrl] = await Promise.all([loadBackgroundURL(bg), loadSpriteURL(sprite)]);
  if (!bgUrl || !spriteUrl) return;
  stage.style.backgroundImage = `url("${bgUrl}")`;
  setSpriteSheet2x2(playerEl, spriteUrl);
  showPlayer();
  setSpriteFrame2x2(playerEl, 0);
  placePlayerInArea(1, 11, 8, 19);
  await fadeOut(overlay);
  const script = [
    [1, t1],
    [1, t2],
    [0, t3],
    [0, t4],
    [0, t5],
    [0, t6],
    [1, t7],
    [1, t8],
    [1, t9],
    [0, t10],
    [3, t11],
    [3, t12]
  ];
  for (const [frameIndex, line] of script) {
    setSpriteFrame2x2(playerEl, frameIndex);
    showSpeech(line);
    await waitForNextClick();
  }
  hideSpeech();
  await delay(hold);
  await fadeIn(overlay);
  hidePlayer();
}

async function sceneCredits(bg = 'Morning.png') {
  const stage = byId('app');
  const overlay = byId('overlay');
  hidePlayer();
  await fadeIn(overlay);
  const bgUrl = await loadBackgroundURL(bg);
  if (bgUrl) stage.style.backgroundImage = `url("${bgUrl}")`;
  await runCredits(
    [
      'Yamada Dobby IT Team Presents',
      '',
      'OBON GAME',
      '',
      '',
      'Director, Programming, Art:',
      '',
      'Hassan T.',
      '',
      '',
      'Special thanks to everyone who played the game',
      '',
      'We look forward to your feedback!'
    ],
    16000
  );
  await fadeOut(overlay);
}


// Public API
export function start() {
  const removeLayoutListeners = applyLayout();
  (async () => {
    // await scene1();
    // await scene2();
    // await scene3();
    // await scene4();
    await scene5();      // The DOM controls fight scene order and taunts.
    // await sceneEND();
    // await sceneCredits();
  })();
  function stop() {
    cancelNextWait?.();
    gameplay?.stop();
    gameplay = null;
    hideSpeech();
    hideNext();
    const overlay = byId('overlay');
    if (overlay) overlay.classList.remove('is-hidden');
    removeLayoutListeners?.();
  }
  return { stop };
}