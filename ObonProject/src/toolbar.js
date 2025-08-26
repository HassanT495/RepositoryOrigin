// src/toolbar.js
'use strict';

const EVENT_ATTACK = 'obon:attack';
const EVENT_ATTACK_FIRED = 'obon:attack-fired';
const EVENT_HERO_THEME = 'obon:hero-theme';
const EVENT_CONTROLS_STATE = 'obon:controls-state';

const ATTACK_SLOTS = [1, 2, 3, 4];

function formatDuration(milliseconds) {
    const seconds = Math.max(0, milliseconds) / 1000;
    return seconds >= 10 ? Math.ceil(seconds) + 's' : seconds.toFixed(1) + 's';
}

function ensureParts(buttonElement) {
    if (buttonElement.querySelector('.label')) return;
    buttonElement.innerHTML = '<span class="label"></span><span class="cd" aria-hidden="true"></span>';
}

export function initializeToolbar(rootId = 'toolbar') {
    const rootElement = document.getElementById(rootId);
    if (!rootElement) throw new Error('Toolbar root not found');

    const state = {
      baseLabelsBySlot: {},       // slot -> "Aura Sphere (3)"
      cooldownDurationBySlot: {}, // slot -> milliseconds
      cooldownEndBySlot: {},      // slot -> timestamp (performance.now)
  };

    // Cache buttons once
    const buttonsBySlot = Object.fromEntries(
        ATTACK_SLOTS.map((slotNumber) => {
            const buttonElement = rootElement.querySelector(`[data-attack="${slotNumber}"]`);
            if (buttonElement) ensureParts(buttonElement);
            return [slotNumber, buttonElement || null];
        }),
    );

    function setStaticLabel(slotNumber, text) {
        const buttonElement = buttonsBySlot[slotNumber];
        if (!buttonElement) return;
        ensureParts(buttonElement);
        state.baseLabelsBySlot[slotNumber] = text;
        buttonElement.querySelector('.label').textContent = text;
    }

    function dispatchAttack(slotNumber) {
        document.dispatchEvent(new CustomEvent(EVENT_ATTACK, { detail: { slot: slotNumber } }));
    }

    // Button input
    ATTACK_SLOTS.forEach((slotNumber) => {
        const buttonElement = buttonsBySlot[slotNumber];
        if (!buttonElement) return;

        const onClick = () => dispatchAttack(slotNumber);
        const onPointerDown = (event) => {
            if (event.pointerType !== 'mouse') dispatchAttack(slotNumber);
        };

        buttonElement.addEventListener('click', onClick);
        buttonElement.addEventListener('pointerdown', onPointerDown, { passive: true });

      // Save for cleanup
      buttonElement.__obonHandlers = { onClick, onPointerDown };
  });

    // Events from the game
    const onHeroTheme = (event) => {
        const map = event.detail?.map || {};
        const cooldowns = event.detail?.cooldowns || {};
        ATTACK_SLOTS.forEach((slotNumber) => {
            const buttonElement = buttonsBySlot[slotNumber];
            if (!buttonElement) return;

            if (map[slotNumber]) {
                buttonElement.classList.remove('hidden');
                setStaticLabel(slotNumber, `${map[slotNumber]} (${slotNumber})`);
            } else {
          buttonElement.classList.add('hidden');
      }
        if (cooldowns[slotNumber]) {
            state.cooldownDurationBySlot[slotNumber] = cooldowns[slotNumber];
        }
    });
  };

    const onAttackFired = (event) => {
        const slotNumber = event.detail?.slot;
        if (!slotNumber) return;
        const duration = event.detail?.cooldownMs ?? state.cooldownDurationBySlot[slotNumber] ?? 0;
        if (duration <= 0) return;
        const startAt = event.detail?.at ?? performance.now();
        state.cooldownEndBySlot[slotNumber] = startAt + duration;
        if (!rafId) tick(); // kick the loop
    };

    const onControlsState = (event) => {
        const disabled = !!event.detail?.disabled;
        ATTACK_SLOTS.forEach((slotNumber) => {
            const buttonElement = buttonsBySlot[slotNumber];
            if (buttonElement) buttonElement.disabled = disabled;
        });
  };

    document.addEventListener(EVENT_HERO_THEME, onHeroTheme);
    document.addEventListener(EVENT_ATTACK_FIRED, onAttackFired);
    document.addEventListener(EVENT_CONTROLS_STATE, onControlsState);

    // Cooldown render loop
    let rafId = 0;
    function tick() {
    rafId = requestAnimationFrame(tick);
    const now = performance.now();
      let anyActive = false;

      ATTACK_SLOTS.forEach((slotNumber) => {
          const buttonElement = buttonsBySlot[slotNumber];
          if (!buttonElement) return;

        const endTime = state.cooldownEndBySlot[slotNumber] || 0;
        const duration = state.cooldownDurationBySlot[slotNumber] || 0;
        const remaining = endTime - now;

        if (remaining > 0 && duration > 0) {
            anyActive = true;
            buttonElement.disabled = true;
            buttonElement.dataset.cooldown = '1';
            const elapsedRatio = 1 - remaining / duration; // 0..1 elapsed
            buttonElement.style.setProperty('--cdp', `${Math.min(100, Math.max(0, elapsedRatio * 100))}%`);
            ensureParts(buttonElement);
            buttonElement.querySelector('.cd').textContent = ' · ' + formatDuration(remaining);
        } else {
          buttonElement.disabled = false;
          buttonElement.dataset.cooldown = '0';
          buttonElement.style.removeProperty('--cdp');
          const label = state.baseLabelsBySlot[slotNumber];
          if (label) {
              ensureParts(buttonElement);
              buttonElement.querySelector('.label').textContent = label;
              buttonElement.querySelector('.cd').textContent = '';
          }
      }
    });

        if (!anyActive && rafId) {
            cancelAnimationFrame(rafId);
            rafId = 0;
        }
    }

    // Public cleanup
    function stop() {
        if (rafId) {
            cancelAnimationFrame(rafId);
        rafId = 0;
    }
        document.removeEventListener(EVENT_HERO_THEME, onHeroTheme);
        document.removeEventListener(EVENT_ATTACK_FIRED, onAttackFired);
        document.removeEventListener(EVENT_CONTROLS_STATE, onControlsState);

        ATTACK_SLOTS.forEach((slotNumber) => {
            const buttonElement = buttonsBySlot[slotNumber];
            const handlers = buttonElement?.__obonHandlers;
            if (buttonElement && handlers) {
                buttonElement.removeEventListener('click', handlers.onClick);
                buttonElement.removeEventListener('pointerdown', handlers.onPointerDown);
                delete buttonElement.__obonHandlers;
            }
        });
    }

    return { stop };
}