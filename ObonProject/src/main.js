// src/main.js
'use strict';

import { initializeToolbar } from './toolbar.js';

const applicationElement = document.getElementById('app');
const gameCanvasElement = document.getElementById('game');
const overlayElement = document.getElementById('overlay');

if (!applicationElement || !gameCanvasElement) {
    throw new Error('Required elements not found: #app or #game');
}

function resizeCanvasToViewport() {
    gameCanvasElement.width = window.innerWidth;
    gameCanvasElement.height = window.innerHeight;
}
resizeCanvasToViewport();
window.addEventListener('resize', resizeCanvasToViewport);

let activeRuntime = { stop: () => { } };
let currentModuleKey = 'dom';

const moduleLoaders = {
    // Ensure the path and casing match your files exactly: src/Game/DOM.js
    dom: () => import('./Game/DOM.js'),
};

async function loadAndStart(moduleKey) {
    try {
        // Stop previous runtime if present
        try { activeRuntime.stop(); } catch { /* no-op */ }
        activeRuntime = { stop: () => { } };

        const loader = moduleLoaders[moduleKey] ?? moduleLoaders.dom;
        const module = await loader();

        if (typeof module.start !== 'function') {
            throw new Error(`Module "${moduleKey}" does not export start()`);
        }

        const runtime = module.start({
            app: applicationElement,
            canvas: gameCanvasElement,
        });

        activeRuntime = (runtime && typeof runtime.stop === 'function')
            ? runtime
            : { stop: () => { } };

        currentModuleKey = moduleKey;
        if (overlayElement) {
            overlayElement.classList.add('is-hidden');
            overlayElement.setAttribute('aria-hidden', 'true');
            overlayElement.textContent = '';
        }
    } catch (error) {
        console.error('Failed to start game module:', error);
        if (overlayElement) {
            overlayElement.classList.remove('is-hidden');
            overlayElement.setAttribute('aria-hidden', 'false');
            overlayElement.textContent = 'Failed to load game module. See console for details.';
        }
    }
}

window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && typeof activeRuntime.onPause === 'function') {
        activeRuntime.onPause();
    }
    if (document.visibilityState === 'visible' && typeof activeRuntime.onResume === 'function') {
        activeRuntime.onResume();
    }
});

window.addEventListener('beforeunload', () => {
    try { activeRuntime.stop(); } catch { /* no-op */ }
});

initializeToolbar();
loadAndStart(currentModuleKey);