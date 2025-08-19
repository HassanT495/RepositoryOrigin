// src/toolbar.js
const root = document.getElementById('toolbar');
if (!root) throw new Error('toolbar not found');

const EVENT_ATTACK = 'obon:attack';

const state = {
    baseLabels: {},       // slot -> "Aura Sphere (3)"
    cooldownMs: {},       // slot -> duration
    cooldownEnd: {},      // slot -> timestamp
};

const fmt = (ms) => {
    const s = Math.max(0, ms) / 1000;
    return s >= 10 ? Math.ceil(s) + 's' : s.toFixed(1) + 's';
};

// ensure label + countdown spans once
function ensureParts(btn) {
    if (btn.querySelector('.label')) return;
    btn.innerHTML = '<span class="label"></span><span class="cd" aria-hidden="true"></span>';
}

// set static label
function setLabel(slot, text) {
    const btn = root.querySelector(`[data-attack="${slot}"]`);
    if (!btn) return;
    ensureParts(btn);
    state.baseLabels[slot] = text;
    btn.querySelector('.label').textContent = text;
}

function fire(slot) {
    document.dispatchEvent(new CustomEvent(EVENT_ATTACK, { detail: { slot } }));
}

// input
[1, 2, 3, 4].forEach((slot) => {
    const b = root.querySelector(`[data-attack="${slot}"]`);
    if (!b) return;
    b.addEventListener('click', () => fire(slot));
    b.addEventListener('pointerdown', (e) => {
        if (e.pointerType !== 'mouse') fire(slot);
    }, { passive: true });
});

// labels + advertised cooldowns from the game
document.addEventListener('obon:hero-theme', (e) => {
    const map = e.detail?.map || {};
    const cds = e.detail?.cooldowns || {};
    [1, 2, 3, 4].forEach((slot) => {
        const btn = root.querySelector(`[data-attack="${slot}"]`);
        if (!btn) return;
        if (map[slot]) {
            btn.classList.remove('hidden');
            setLabel(slot, `${map[slot]} (${slot})`);
        } else {
            btn.classList.add('hidden');
        }
        if (cds[slot]) state.cooldownMs[slot] = cds[slot];
    });
});

// start a cooldown when attack fires
document.addEventListener('obon:attack-fired', (e) => {
    const { slot, cooldownMs, at } = e.detail || {};
    if (!slot) return;
    const dur = cooldownMs ?? state.cooldownMs[slot] ?? 0;
    if (dur <= 0) return;
    state.cooldownEnd[slot] = (at ?? performance.now()) + dur;
    if (!rafId) tick();        // kick the loop
});

document.addEventListener('obon:controls-state', (e) => {
    const disabled = !!e.detail?.disabled;
    root.querySelectorAll('button[data-attack]').forEach((b) => { b.disabled = disabled || b.disabled; });
});

// animation loop to render remaining cooldown
let rafId = null;
function tick() {
    rafId = requestAnimationFrame(tick);
    const now = performance.now();
    let any = false;

    [1, 2, 3, 4].forEach((slot) => {
        const btn = root.querySelector(`[data-attack="${slot}"]`);
        if (!btn) return;

        const end = state.cooldownEnd[slot] || 0;
        const dur = state.cooldownMs[slot] || 0;
        const left = end - now;

        if (left > 0 && dur > 0) {
            any = true;
            btn.disabled = true;
            btn.dataset.cooldown = '1';
            const ratio = 1 - left / dur;                     // 0..1 elapsed
            btn.style.setProperty('--cdp', `${Math.min(100, Math.max(0, ratio * 100))}%`);
            ensureParts(btn);
            btn.querySelector('.cd').textContent = ' · ' + fmt(left);
        } else {
            btn.disabled = false;
            btn.dataset.cooldown = '0';
            btn.style.removeProperty('--cdp');
            const lbl = state.baseLabels[slot];
            if (lbl) {
                ensureParts(btn);
                btn.querySelector('.label').textContent = lbl;
                btn.querySelector('.cd').textContent = '';
            }
        }
    });

    if (!any && rafId) {
        cancelAnimationFrame(rafId);
        rafId = null;
    }
}