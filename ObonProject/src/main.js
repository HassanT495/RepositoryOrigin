// src/main.js

const app = document.getElementById('app');
const canvas = document.getElementById('game');

let running = null;
let current = 'dom';

const moduleMap = {
    dom: () => import('./Game/DOM.js'),
};

async function loadAndStart(key) {
    if (running?.stop) {
        try { running.stop(); } catch { /* ignore */ }
        running = null;
    }
    const loader = moduleMap[key] || moduleMap.dom;
    const mod = await loader();
    if (typeof mod.start !== 'function') throw new Error(`${key} missing start()`);
    running = mod.start({ app, canvas }) || {};
    current = key;
}

loadAndStart(current);