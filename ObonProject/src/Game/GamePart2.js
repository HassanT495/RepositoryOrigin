'use strict';

// === Entry Point ===
export function start({ canvas, hooks = {}, scenes = null, useDomSpeech = false }) {
    // === Canvas & Sizing ===
    const ctx = canvas.getContext('2d');
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const cssWidth = () => canvas.width / dpr;
    const cssHeight = () => canvas.height / dpr;

    // === Tunables (px/sec or phys per 60fps) ===
    const GROUND_FROM_BOTTOM = 10;
    const GRAVITY = 1.5;                // per-60fps; scaled by frameScale
    const PLAYER_WALK_SPEED = 2.2;      // px per frame @60fps; scaled by frameScale
    const PLAYER_MAX_HP = 20;
    const DEFAULT_ENEMY_HP = 3;
    const PLAYER_INV_MS = 900;
    const ENEMY_INV_MS = 300;
    const MIN_SEP = 10;
    const CONTACT_GAP = MIN_SEP;

    // === Events ===
    const EVENT_ATTACK = 'obon:attack';

    // === Runtime ===
    let groundY = 0;
    let player = null;
    let enemies = [];
    let allies = []; // NPC allies
    let raf = null;
    let t0 = performance.now();
    let lastNow = t0;
    let frameScale = 1; // scales per-frame speeds to time-based

    // 30 FPS limiter
    const TARGET_FPS = 30;
    const FRAME_DURATION = 1000 / TARGET_FPS; // ~33.3ms
    let acc = 0;

    // === Completion ===
    let resolveFinished;
    const finished = new Promise((r) => (resolveFinished = r));

    // === Assets ===
    const ASSETS = {
        players: {
            heroA: {
                name: 'Anko',
                usesGravity: false,
                scale: 1.6,
                baseOffset: { x: 48, y: 84 },
                melee: undefined,
                maxHp: 14,
                hudTint: '0,120,255',
                sprites: {
                    idle: { src: './src/GameAssets/Sprites/MCidle.png', framesMax: 4, cols: 4, rows: 4, row: 0, framesHold: 10 },
                    runRight: { src: './src/GameAssets/Sprites/MCwalk.png', framesMax: 5, cols: 5, rows: 5, row: 1, framesHold: 10 },
                    runLeft: { src: './src/GameAssets/Sprites/MCwalk.png', framesMax: 5, cols: 5, rows: 5, row: 2, framesHold: 10 },
                    castLight: { src: './src/GameAssets/Sprites/MCidle.png', framesMax: 4, cols: 4, rows: 4, row: 0, framesHold: 8 },
                    castHeavy: { src: './src/GameAssets/Sprites/MCidle.png', framesMax: 4, cols: 4, rows: 4, row: 0, framesHold: 8 },
                    takeHit: { src: './src/GameAssets/Sprites/MCidle.png', framesMax: 4 },
                    death: { src: './src/GameAssets/Sprites/MCidle.png', framesMax: 4 }
                },
                attacks: {
                    light: { type: 'projectile', anim: 'castLight', projectile: 'AnkoAttack1', fireFrame: 1, cooldownMs: 1000 },
                    heavy: { type: 'projectile', anim: 'castHeavy', projectile: 'AnkoAttack2', fireFrame: 2, cooldownMs: 10000 }
                }
            },
            heroB: {
                name: 'Grandpa',
                usesGravity: false,
                scale: 2.5,
                baseOffset: { x: 48, y: 94 },
                melee: { damage: 5, attackBox: { offset: { x: 0, y: 60 }, width: 70, height: 120 }, hitFrame: 6 },
                maxHp: 100,
                hudTint: '0,200,120',
                sprites: {
                    idle: { src: './src/GameAssets/Sprites/GPidle.png', framesMax: 10 },
                    run: { src: './src/GameAssets/Sprites/GPrun.png', framesMax: 16, framesHold: 10 },
                    attack1: { src: './src/GameAssets/Sprites/GPattack.png', framesMax: 7, hitFrame: 3 },
                    cast: { src: './src/GameAssets/Sprites/GPattack.png', framesMax: 7, framesHold: 7 },
                    takeHit: { src: './src/GameAssets/Sprites/GPdisapear.png', framesMax: 4 },
                    death: { src: './src/GameAssets/Sprites/GPdisapear.png', framesMax: 4 }
                },
                attacks: {
                    slash: { type: 'melee', anim: 'attack1', hitFrame: 6, damage: 5, cooldownMs: 260 },
                    bolt: { type: 'projectile', anim: 'cast', projectile: 'GrandpaChiSlash', fireFrame: 3, cooldownMs: 500 }
                }
            }
        },
        enemies: {
            rat: {
                name: 'Rat',
                scale: 2,
                hp: 3,
                usesGravity: true,
                baseOffset: { x: 8, y: 60 },
                contactDamage: 1,
                contactInset: { x: 10, top: 8 },
                sprites: {
                    idle: { src: './src/GameAssets/Sprites/Rat1.png', framesMax: 3 },
                    run: { src: './src/GameAssets/Sprites/Ratwalk.png', framesMax: 2, framesHold: 10 },
                    takeHit: { src: './src/GameAssets/Sprites/Rat2.png', framesMax: 4 },
                    death: { src: './src/GameAssets/Sprites/Ratdisapear.png', framesMax: 2 }
                },
                ai: { type: 'chase', speed: 0.7, accel: 0.15 }
            },
            ratElectric: {
                name: 'Rat (Electric)',
                scale: 2,
                hp: 6,
                usesGravity: true,
                baseOffset: { x: 8, y: 60 },
                contactDamage: 2,
                contactInset: { x: 10, top: 8 },
                sprites: {
                    idle: { src: './src/GameAssets/Sprites/Rateletric.png', framesMax: 3, cols: 3, rows: 3, row: 2, framesHold: 4 },
                    run: { src: './src/GameAssets/Sprites/Rateletric.png', framesMax: 3, cols: 3, rows: 3, row: 2, framesHold: 4 },
                    takeHit: { src: './src/GameAssets/Sprites/Rateletric.png', framesMax: 3, cols: 3, rows: 3, row: 0, framesHold: 4 },
                    death: { src: './src/GameAssets/Sprites/Rateletric.png', framesMax: 3, cols: 3, rows: 3, row: 1, framesHold: 4 }
                },
                ai: { type: 'chase', speed: 0.85, accel: 0.18 }
            },
            ghost: {
                name: 'Ghost',
                scale: 0.45,
                hp: 14,
                usesGravity: false,
                baseOffset: { x: 28, y: 20 },
                contactInset: { x: 20, top: 20 },
                hover: { amp: 12, freq: 0.004 },
                sprites: {
                    idle: { src: './src/GameAssets/Sprites/Ghost1.png', framesMax: 4, cols: 4, rows: 4, row: 0, framesHold: 22 },
                    run: { src: './src/GameAssets/Sprites/Ghost1.png', framesMax: 4, cols: 4, rows: 4, row: 1, framesHold: 26 },
                    takeHit: { src: './src/GameAssets/Sprites/Ghost1.png', framesMax: 4, cols: 4, rows: 4, row: 2, framesHold: 26 },
                    death: { src: './src/GameAssets/Sprites/Ghost1.png', framesMax: 4, cols: 4, rows: 4, row: 3, framesHold: 26 }
                },
                ai: { type: 'chaseShoot', speed: 0.6, accel: 0.12, shootRange: 520, shootCooldownMs: 1600 },
                projectile: {
                    sheet: { src: './src/GameAssets/Effects/Purple Effect Bullet Impact Explosion 32x32.png', tile: 32, cols: 20 },
                    fly: { row: 10, start: 10, count: 4, framesHold: 5, pingPong: true },
                    hit: { row: 10, start: 14, count: 4, framesHold: 5 },
                    scale: 1.6, speed: 5, rangePx: 700, damage: 1,
                    spawnOffset: { x: 36, y: 50 }, hitbox: { x: 8, y: 8, w: 16, h: 12 }
                }
            },
            ghostBoss: {
                name: 'Ghost Boss',
                scale: 0.6,
                hp: 20,
                usesGravity: false,
                baseOffset: { x: 56, y: 100 },
                contactInset: { x: 20, top: 26 },
                hover: { amp: 26, freq: 0.003 },
                sprites: {
                    idle: { src: './src/GameAssets/Sprites/Ghost2.png', framesMax: 4, cols: 4, rows: 4, row: 0, framesHold: 26 },
                    run: { src: './src/GameAssets/Sprites/Ghost2.png', framesMax: 4, cols: 4, rows: 4, row: 1, framesHold: 30 },
                    takeHit: { src: './src/GameAssets/Sprites/Ghost2.png', framesMax: 4, cols: 4, rows: 4, row: 2, framesHold: 30 },
                    death: { src: './src/GameAssets/Sprites/Ghost2.png', framesMax: 4, cols: 4, rows: 4, row: 3, framesHold: 30 }
                },
                ai: { type: 'chaseShoot', speed: 0.7, accel: 0.15, shootRange: 620, shootCooldownMs: 2400 },
                projectile: {
                    sheet: { src: './src/GameAssets/Effects/Purple Effect Bullet Impact Explosion 32x32.png', tile: 32, cols: 20 },
                    fly: { row: 10, start: 10, count: 4, framesHold: 4, pingPong: true },
                    hit: { row: 10, start: 14, count: 4, framesHold: 4 },
                    scale: 3.0, speed: 5, rangePx: 900, damage: 2,
                    spawnOffset: { x: 40, y: 60 }, hitbox: { x: 8, y: 8, w: 16, h: 12 }
                }
            }
        },
        playerProjectiles: {
            AnkoAttack1: {
                sheet: { src: './src/GameAssets/Effects/Blue Effect Bullet Impact Explosion 32x32.png', tile: 32, cols: 20 },
                fly: { row: 2, start: 6, count: 2, framesHold: 12, pingPong: true },
                hit: { row: 2, start: 8, count: 2, framesHold: 4 },
                scale: 1.8, speed: 4, rangePx: 520, damage: 1,
                spawnOffset: { x: 56, y: 64 }, hitbox: { x: 8, y: 8, w: 16, h: 12 }
            },
            AnkoAttack2: {
                sheet: { src: './src/GameAssets/Effects/Blue Effect Bullet Impact Explosion 32x32.png', tile: 32, cols: 20 },
                fly: { row: 10, start: 10, count: 4, framesHold: 3, pingPong: true },
                hit: { row: 10, start: 14, count: 4, framesHold: 3 },
                scale: 1.0, speed: 2, rangePx: 640, damage: 3,
                spawnOffset: { x: 56, y: 64 }, hitbox: { x: 8, y: 8, w: 16, h: 12 }
            },
            GrandpaChiSlash: {
                sheet: { src: './src/GameAssets/Effects/Green Effect Bullet Impact Explosion 32x32.png', tile: 32, cols: 20 },
                fly: { row: 10, start: 10, count: 4, framesHold: 3, pingPong: true },
                hit: { row: 10, start: 14, count: 4, framesHold: 3 },
                scale: 2.2, speed: 7, rangePx: 700, damage: 2,
                spawnOffset: { x: 56, y: 84 }, hitbox: { x: 8, y: 8, w: 16, h: 12 }
            }
        }
    };

    // === Resize ===
    function handleCanvasResize() {
        const w = canvas.clientWidth | 0;
        const h = canvas.clientHeight | 0;
        if (!w || !h) return;
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.imageSmoothingEnabled = false;
        groundY = cssHeight() - GROUND_FROM_BOTTOM;
        if (player) player.position.y = groundY;
        for (const e of enemies) if (e.usesGravity) e.position.y = Math.min(e.position.y, groundY);
        for (const a of allies) if (a.usesGravity) a.position.y = Math.min(a.position.y, groundY);
    }
    window.addEventListener('resize', handleCanvasResize);
    window.addEventListener('orientationchange', handleCanvasResize);

    // === Sprite ===
    class Sprite {
        constructor({ position, imageSrc, scale = 1, framesMax = 1, framesHold = 5, stretchToCanvas = false }) {
            this.position = position;
            this.scale = scale;
            this.framesMax = framesMax;
            this.framesHold = framesHold;
            this.framesCurrent = 0;
            this.framesElapsed = 0; // fractional with frameScale
            this.frameDirection = 1;
            this.pingPong = false;
            this.stretchToCanvas = stretchToCanvas;
            this.image = new Image();
            this.image.src = imageSrc;
        }
        draw() {
            if (this.stretchToCanvas) {
                ctx.drawImage(this.image, 0, 0, this.image.width | 0, this.image.height | 0, 0, 0, cssWidth(), cssHeight());
                return;
            }
            const frameW = (this.image.width / this.framesMax) | 0;
            ctx.drawImage(this.image, frameW * this.framesCurrent, 0, frameW, this.image.height | 0,
                this.position.x, this.position.y, frameW * this.scale, this.image.height * this.scale);
        }
        update() { this.draw(); this._animate(); }
        _animate() {
            if (this.framesMax <= 1) return;
            this.framesElapsed += Math.max(0.0001, frameScale);
            while (this.framesElapsed >= (this.framesHold || 1)) {
                this.framesElapsed -= (this.framesHold || 1);
                if (this.pingPong) {
                    this.framesCurrent += this.frameDirection;
                    const end = this.framesMax - 1;
                    if (this.framesCurrent >= end || this.framesCurrent <= 0) {
                        this.framesCurrent = Math.max(0, Math.min(this.framesCurrent, end));
                        this.frameDirection *= -1;
                    }
                } else {
                    this.framesCurrent = (this.framesCurrent + 1) % this.framesMax;
                }
            }
        }
    }

    // === Fighter ===
    class Fighter extends Sprite {
        constructor({ tag, kind, conf, position, velocity }) {
            const sprites = conf.sprites;
            super({
                position,
                imageSrc: sprites.idle.src,
                scale: conf.scale,
                framesMax: sprites.idle.framesMax,
                framesHold: sprites.idle.framesHold ?? 5
            });
            this.tag = tag;
            this.kind = kind;
            this.conf = conf;
            this.velocity = velocity;
            this.facing = 1;
            this.dead = false;
            this.maxHp = tag === 'player' ? (conf.maxHp ?? PLAYER_MAX_HP) : (conf.hp ?? DEFAULT_ENEMY_HP);
            this.hp = this.maxHp;
            this.state = 'idle';
            this.isAttacking = false;
            this.activeAttack = null;
            this._attackTriggered = false;
            this._cooldowns = {};
            this.usesGravity = !!conf.usesGravity;
            this.hover = conf.hover ? { ...conf.hover, baseY: position.y } : null;
            this.sheets = {};
            for (const [key, s] of Object.entries(sprites)) {
                const img = new Image(); img.src = s.src;
                this.sheets[key] = {
                    image: img,
                    framesMax: s.framesMax,
                    hitFrame: s.hitFrame ?? null,
                    framesHold: s.framesHold ?? 5,
                    gridCols: s.cols ?? s.framesMax,
                    gridRows: s.rows ?? 1,
                    gridRowIndex: s.row ?? 0,
                    pingPong: !!s.pingPong
                };
            }
            this._sheetMeta = this.sheets.idle;
            this._pivotRatio = { x: 0.5, y: 0.98 };
            this._offsetPx = { x: 0, y: 0 };
            this._baseOffsetSrc = conf.baseOffset;
            this._pivotNeedsInit = true;
            this._initPivotFromIdle();
            this.melee = conf.melee
                ? {
                    damage: conf.melee.damage ?? 1,
                    attackBox: JSON.parse(JSON.stringify(conf.melee.attackBox || { offset: { x: 0, y: 0 }, width: 0, height: 0 })),
                    hitFrame: conf.melee.hitFrame ?? this.sheets.attack1?.hitFrame ?? 0
                }
                : null;
            this.attacks = conf.attacks || {};
            this.contactInset = conf.contactInset || { x: 0, top: 0 };
        }
        _initPivotFromIdle() {
            const idle = this.sheets.idle;
            const tryInit = () => {
                const cols = idle.gridCols ?? idle.framesMax;
                const rows = idle.gridRows ?? 1;
                const frameW = idle.image.width / Math.max(1, cols);
                const imgH = idle.image.height / Math.max(1, rows);
                if (frameW > 0 && imgH > 0) {
                    const ratioX = Math.max(0, Math.min(1, (this._baseOffsetSrc?.x ?? frameW * 0.5) / frameW));
                    const ratioY = Math.max(0, Math.min(1, (this._baseOffsetSrc?.y ?? imgH * 0.98) / imgH));
                    this._pivotRatio = { x: ratioX, y: ratioY };
                    this._pivotNeedsInit = false;
                    this._recomputeOffsetFor(this.image);
                } else this._pivotNeedsInit = true;
            };
            if (idle.image.complete) tryInit(); else idle.image.onload = tryInit;
        }
        _recomputeOffsetFor(image) {
            const meta = this._sheetMeta;
            const cols = meta?.gridCols ?? this.framesMax;
            const rows = meta?.gridRows ?? 1;
            const frameW = image.width / Math.max(1, cols);
            const imgH = image.height / Math.max(1, rows);
            this._offsetPx.x = this._pivotRatio.x * frameW * this.scale;
            this._offsetPx.y = this._pivotRatio.y * imgH * this.scale;
        }
        get topLeft() {
            if ((this._offsetPx.x === 0 && this._offsetPx.y === 0) && this.image.width) this._recomputeOffsetFor(this.image);
            return { x: this.position.x - this._offsetPx.x, y: this.position.y - this._offsetPx.y };
        }
        update(elapsedMs, ground) {
            if (this.hover) {
                const { amp, freq, baseY } = this.hover;
                this.position.y = baseY + Math.sin(elapsedMs * freq) * amp;
            }
            const meta = this._sheetMeta;
            const cols = meta?.gridCols ?? this.framesMax;
            const rows = meta?.gridRows ?? 1;
            const rowIndex = meta?.gridRowIndex ?? 0;
            const frameW = this.image.width / cols;
            const frameH = this.image.height / rows;
            const sx = frameW * this.framesCurrent;
            const sy = frameH * rowIndex;
            const tl = this.topLeft;
            ctx.drawImage(this.image, sx, sy, frameW, frameH, tl.x, tl.y, frameW * this.scale, frameH * this.scale);
            this._animate();

            // time-scaled movement
            this.position.x += this.velocity.x * frameScale;
            if (this.usesGravity) {
                this.position.y += this.velocity.y * frameScale;
                if (this.position.y + this.velocity.y * frameScale >= ground) { this.velocity.y = 0; this.position.y = ground; }
                else this.velocity.y += GRAVITY * frameScale;
            }
            const rect = spriteRect(this);
            const w = cssWidth();
            if (rect.x < 0) this.position.x -= rect.x;
            if (rect.x + rect.w > w) this.position.x -= (rect.x + rect.w - w);
        }
        switchSprite(name) {
            if (this.dead) return;
            if (this.isAttacking && this.framesCurrent < this.framesMax - 1 && name !== this.state) return;
            const next = this.sheets[name];
            if (!next || (this.image === next.image && this._sheetMeta === next)) return;
            this.state = name;
            this.image = next.image;
            this.framesMax = next.framesMax;
            this.framesHold = next.framesHold ?? this.framesHold;
            this.pingPong = !!next.pingPong;
            this._sheetMeta = next;
            this.framesCurrent = 0;
            this.framesElapsed = 0;
            this.frameDirection = 1;
            if (!this._pivotNeedsInit) this._recomputeOffsetFor(this.image);
            else this._initPivotFromIdle();
        }
        startAttack(name) {
            const def = this.attacks?.[name];
            if (!def || this.dead) return false;
            const now = performance.now();
            const last = this._cooldowns[name] ?? -Infinity;
            if (now - last < (def.cooldownMs ?? 0)) return false;
            this.isAttacking = false;
            this.switchSprite(def.anim || 'attack1');
            this.isAttacking = true;
            this.activeAttack = { name, def };
            this._attackTriggered = false;
            this._cooldowns[name] = now;
            return true;
        }
    }

    // === Projectile ===
    class Projectile {
        constructor({ ownerTag, ownerKind, conf, xHit, yHit, dir }) {
            this.ownerTag = ownerTag;
            this.ownerKind = ownerKind || null;
            this.conf = conf;
            this.xHit = xHit;
            this.yHit = yHit;
            this.dir = dir;
            this.state = 'fly';
            this.velocityX = (conf.speed ?? 6) * dir; // per-frame@60 → scaled
            this.remaining = conf.rangePx ?? 500;
            this.frame = 0;
            this.elapsed = 0; // fractional for animation
            this.frameDirection = 1;
            if (!Projectile._cache.has(conf.sheet.src)) {
                const img = new Image(); img.src = conf.sheet.src;
                Projectile._cache.set(conf.sheet.src, img);
            }
        }
        _sheet() { return Projectile._cache.get(this.conf.sheet.src); }
        _def() { return this.state === 'fly' ? this.conf.fly : this.conf.hit; }
        hitRect() {
            const hb = this.conf.hitbox ?? { x: 0, y: 0, w: 16, h: 16 };
            const s = this.conf.scale ?? 1;
            return { x: this.xHit - hb.x * s, y: this.yHit - hb.y * s, w: hb.w * s, h: hb.h * s };
        }
        draw() {
            const def = this._def();
            const tile = this.conf.sheet.tile;
            const cols = this.conf.sheet.cols;
            const index = def.start + (this.frame % def.count);
            const sx = (index % cols) * tile;
            const sy = def.row * tile;
            const s = this.conf.scale ?? 1;
            const hb = this.conf.hitbox ?? { x: 0, y: 0 };
            const dx = this.xHit - (hb.x * s);
            const dy = this.yHit - (hb.y * s);
            const dw = tile * s;
            const dh = tile * s;
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            if (this.dir === -1) {
                ctx.translate(dx + dw, 0); ctx.scale(-1, 1);
                ctx.drawImage(this._sheet(), sx, sy, tile, tile, 0, dy, dw, dh);
            } else {
                ctx.drawImage(this._sheet(), sx, sy, tile, tile, dx, dy, dw, dh);
            }
            ctx.restore();
        }
        updateAndDraw() {
            if (this.state === 'fly') {
                this.xHit += this.velocityX * frameScale;
                this.remaining -= Math.abs(this.velocityX * frameScale);
                if (this.remaining <= 0) this._explode();
            }
            this.draw();
            const def = this._def();
            const hold = def.framesHold ?? 4;
            this.elapsed += Math.max(0.0001, frameScale);
            while (this.elapsed >= hold) {
                this.elapsed -= hold;
                if (def.pingPong) {
                    this.frame += this.frameDirection;
                    const end = def.count - 1;
                    if (this.frame >= end || this.frame <= 0) this.frameDirection *= -1;
                } else this.frame++;
                if (this.state === 'hit' && this.frame >= def.count) this.remaining = 0;
                if (this.state === 'fly' && !def.pingPong && this.frame >= def.count) this.frame = 0;
            }
        }
        _explode() {
            if (this.state !== 'fly') return;
            this.state = 'hit';
            this.velocityX = 0;
            this.frame = 0;
            this.elapsed = 0;
            this.frameDirection = 1;
        }
    }
    Projectile._cache = new Map();

    // === Geometry ===
    function spriteRect(f) {
        const m = f._sheetMeta;
        const cols = m?.gridCols ?? f.framesMax;
        const rows = m?.gridRows ?? 1;
        const frameW = f.image.width / Math.max(1, cols);
        const frameH = f.image.height / Math.max(1, rows);
        const tl = f.topLeft;
        return { x: tl.x, y: tl.y, w: frameW * f.scale, h: frameH * f.scale };
    }
    function enemyHurtRect(e) {
        const r = spriteRect(e);
        const ix = (e.contactInset?.x || 0) * (e.scale || 1);
        const it = (e.contactInset?.top || 0) * (e.scale || 1);
        r.x += ix; r.w = Math.max(0, r.w - ix * 2);
        r.y += it; r.h = Math.max(0, r.h - it);
        return r;
    }
    function isNearContact(a, b, pad = 0) {
        const ar = spriteRect(a), br = spriteRect(b);
        const yOverlap = ar.y < br.y + br.h && ar.y + ar.h > br.y;
        if (!yOverlap) return false;
        const gap = ar.x + ar.w <= br.x ? (br.x - (ar.x + ar.w)) :
            br.x + br.w <= ar.x ? (ar.x - (br.x + br.w)) : 0;
        return gap <= pad;
    }
    function blockMovementX(actor, desiredDx, colliders, margin = MIN_SEP) {
        if (desiredDx === 0) return 0;
        const rect = spriteRect(actor);
        let dx = desiredDx;
        for (const c of colliders) {
            if (!c || c === actor || c.dead) continue;
            const cr = spriteRect(c);
            const vOverlap = !(rect.y >= cr.y + cr.h || rect.y + rect.h <= cr.y);
            if (!vOverlap) continue;
            if (desiredDx > 0) {
                if (rect.x + rect.w <= cr.x) {
                    const gap = cr.x - (rect.x + rect.w);
                    dx = Math.min(dx, gap + margin);
                }
            } else {
                if (rect.x >= cr.x + cr.w) {
                    const gap = rect.x - (cr.x + cr.w);
                    dx = Math.max(dx, -(gap + margin));
                }
            }
        }
        return dx;
    }
    function playerMeleeRect(p) {
        if (!p.melee) return { x: 0, y: 0, w: 0, h: 0 };
        const base = spriteRect(p);
        const s = p.scale;
        const { offset, width, height } = p.melee.attackBox;
        const W = width * s, H = height * s;
        const y = base.y + offset.y * s;
        const xFront = p.facing === 1 ? (base.x + base.w) : base.x;
        const x = p.facing === 1 ? (xFront + offset.x * s) : (xFront - offset.x * s - W);
        return { x, y, w: W, h: H };
    }
    const rectanglesOverlap = (a, b) =>
        a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

    // === Background ===
    let background = null;
    function setBackground(src) {
        background = new Sprite({ position: { x: 0, y: 0 }, imageSrc: src, stretchToCanvas: true });
    }

    // === Scenes (DOM-owned or fallback) ===
    const bgPath = (p) => (p && p.includes('/')) ? p : `./src/GameAssets/Backgrounds/${p}`;
    const normalizeScenes = (arr) => (arr || []).map(s => ({
        id: s.id,
        background: bgPath(s.background),
        flow: { exitThresholdRatio: 0.9, offscreenSpawnPx: 160, spawnCooldownMs: 600, ...(s.flow || {}) },
        queue: (s.queue || []).map(q => ({ ...q }))
    }));
    const DEFAULT_SCENES = normalizeScenes([
        { id: 6, background: 'City.png', flow: { exitThresholdRatio: 0.90, offscreenSpawnPx: 160, spawnCooldownMs: 600 }, queue: [{ type: 'rat' }] },
        { id: 7, background: 'City.png', flow: { exitThresholdRatio: 0.90, offscreenSpawnPx: 180, spawnCooldownMs: 650 }, queue: [{ type: 'rat' }, { type: 'rat' }] },
        { id: 8, background: 'Festival.png', flow: { exitThresholdRatio: 0.88, offscreenSpawnPx: 200, spawnCooldownMs: 750 }, queue: [{ type: 'rat' }, { type: 'rat' }, { type: 'rat' }] },
        { id: 9, background: 'GY8B.png', flow: { exitThresholdRatio: 0.87, offscreenSpawnPx: 220, spawnCooldownMs: 850 }, queue: [{ type: 'rat' }, { type: 'rat' }, { type: 'rat' }, { type: 'rat' }] },
        {
            id: 10, background: 'GYFinale.png', flow: { exitThresholdRatio: 0.85, offscreenSpawnPx: 260, spawnCooldownMs: 10000 },
            queue: [
                { type: 'ratElectric', preLine: 'Rat: Turn back now, or you will die.' },
                { type: 'ghost', preLine: 'Ghost: I will eat your soul.' },
                { type: 'ghostBoss', preLine: 'Lich: I will absorb your soul into myself.' }
            ]
        }
    ]);
    const SCENES = (scenes && scenes.length) ? normalizeScenes(scenes) : DEFAULT_SCENES;

    let currentSceneIndex = 0;
    let spawnCursor = 0;
    let lastSpawnAt = -Infinity;
    let nextHookSent = false;
    let deathHookSent = false;
    let pendingPreSpawn = null;

    // === Scene Helpers ===
    function cloneEnemyConf(type, overrides) {
        const base = ASSETS.enemies[type];
        if (!base) return null;
        return Object.assign({}, base, overrides || {}, { sprites: base.sprites });
    }
    function aliveEnemies() { return enemies.some((e) => !e.dead); }
    function spawnFromRight(spec) {
        const scene = SCENES[currentSceneIndex];
        const off = scene?.flow?.offscreenSpawnPx ?? 160;
        const conf = cloneEnemyConf(spec.type, spec.overrides);
        if (!conf) return;
        const y = conf.usesGravity ? groundY : groundY - 140;
        const x = cssWidth() + off;
        enemies.push(new Fighter({ tag: 'enemy', conf, kind: spec.type, position: { x, y }, velocity: { x: 0, y: 0 } }));
    }

    // === Internal enemy speech UI (disabled when useDomSpeech === true) ===
    let cutsceneActive = false;
    let enemySpeechEl = null;
    function createEnemySpeechUI() {
        if (useDomSpeech) return;
        const host = canvas.parentElement || document.body;
        enemySpeechEl = document.createElement('div');
        enemySpeechEl.className = 'enemy-speech';
        enemySpeechEl.setAttribute('data-show', 'false');
        host.appendChild(enemySpeechEl);
    }
    function showEnemySpeech(text, options = {}) {
        if (useDomSpeech) return Promise.resolve();
        if (!enemySpeechEl) createEnemySpeechUI();
        cutsceneActive = true;
        enemySpeechEl.textContent = text;
        enemySpeechEl.setAttribute('data-show', 'true');
        return new Promise((resolve) => {
            const finish = () => {
                enemySpeechEl.setAttribute('data-show', 'false');
                window.removeEventListener('keydown', onKey);
                enemySpeechEl.removeEventListener('click', onClick);
                cutsceneActive = false;
                resolve();
            };
            const onKey = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); finish(); } };
            const onClick = () => finish();
            window.addEventListener('keydown', onKey, { once: true });
            enemySpeechEl.addEventListener('click', onClick, { once: true });
            const ms = options.timeoutMs ?? 2600;
            if (ms > 0) setTimeout(finish, ms);
        });
    }

    // === Fade Overlay (only used by internal cutscenes) ===
    let fade = { alpha: 0, start: 0, target: 0, startAt: 0, endAt: 0, running: false, _resolve: null };
    function runFade(toAlpha, durationMs) {
        fade.start = fade.alpha;
        fade.target = Math.max(0, Math.min(1, toAlpha));
        const now = performance.now();
        fade.startAt = now;
        fade.endAt = now + Math.max(1, durationMs | 0);
        fade.running = true;
        return new Promise((resolve) => (fade._resolve = resolve));
    }

    // === Flow ===
    let lastKillerKind = null;
    let finaleTransformed = false;

    function maybeSpawnNextEnemy(now) {
        const scene = SCENES[currentSceneIndex];
        if (!scene) return;
        if (cutsceneActive) return;
        if (aliveEnemies()) return;
        if (spawnCursor >= scene.queue.length) return;

        const spec = scene.queue[spawnCursor];

        // Pre-spawn line
        if (spec.preLine && !spec._preShown) {
            if (useDomSpeech && typeof hooks.onPreSpawnLine === 'function') {
                if (!pendingPreSpawn) {
                    pendingPreSpawn = Promise.resolve(hooks.onPreSpawnLine(api, { text: spec.preLine }))
                        .finally(() => {
                            spec._preShown = true;
                            pendingPreSpawn = null;
                            lastSpawnAt = -Infinity;
                        });
                }
                return;
            } else {
                showEnemySpeech(spec.preLine).then(() => { spec._preShown = true; lastSpawnAt = -Infinity; });
                return;
            }
        }

        const cooldown = scene.flow?.spawnCooldownMs ?? 600;
        if (now - lastSpawnAt < cooldown) return;
        spawnFromRight(spec);
        spawnCursor++;
        lastSpawnAt = now;
    }

    function sceneCleared() {
        const s = SCENES[currentSceneIndex];
        return s && spawnCursor >= s.queue.length && !aliveEnemies();
    }

    function loadSceneByIndex(index) {
        currentSceneIndex = Math.max(0, Math.min(index, SCENES.length - 1));
        const s = SCENES[currentSceneIndex];
        setBackground(s.background);
        enemies.length = 0;
        allies.length = 0;
        spawnCursor = 0;
        lastSpawnAt = -Infinity;
        nextHookSent = false;
        deathHookSent = false;
        finaleTransformed = false;
        lastKillerKind = null;
        pendingPreSpawn = null;
        if (player) {
            const pr = spriteRect(player);
            player.dead = false;
            player.hp = player.maxHp;
            player.position.x = 40 + pr.w * 0.5;
            player.position.y = groundY;
            player.velocity.x = 0;
            player.switchSprite('idle');
        }
    }
    function loadSceneById(id) { const i = SCENES.findIndex((s) => s.id === id); if (i >= 0) loadSceneByIndex(i); }
    function gotoNextScene() { if (currentSceneIndex < SCENES.length - 1) loadSceneByIndex(currentSceneIndex + 1); else resolveFinished?.('win'); }
    function retryScene() { loadSceneByIndex(currentSceneIndex); }

    // === Init ===
    handleCanvasResize();
    player = new Fighter({ tag: 'player', kind: 'heroA', conf: ASSETS.players.heroA, position: { x: 40, y: groundY }, velocity: { x: 0, y: 0 } });
    loadSceneByIndex(0);

    // === Combat State ===
    const playerProjectiles = [];
    const enemyProjectiles = [];
    const lastEnemyHitAt = { value: -Infinity };
    const lastPlayerHitAt = { value: -Infinity };
    const enemyShootCooldown = new Map();

    // === Helpers ===
    function applyRunAnimation(f, vx) {
        if (vx < -0.1) { f.facing = -1; f.switchSprite(f.sheets.runLeft ? 'runLeft' : 'run'); }
        else if (vx > 0.1) { f.facing = 1; f.switchSprite(f.sheets.runRight ? 'runRight' : 'run'); }
        else { f.switchSprite('idle'); }
    }
    function aimAtNearestEnemyDirection() {
        const alive = enemies.filter((e) => !e.dead);
        if (!alive.length) return player.facing;
        const closest = alive.reduce((m, e) => {
            const dx = Math.abs(e.position.x - player.position.x);
            const best = Math.abs(m.position.x - player.position.x);
            return dx < best ? e : m;
        }, alive[0]);
        return closest.position.x >= player.position.x ? 1 : -1;
    }
    function shootEnemy(enemy) {
        const cfg = enemy.conf.projectile;
        if (!cfg) return;
        const base = spriteRect(enemy);
        const dir = enemy.facing;
        const scale = cfg.scale ?? 1;
        const tileW = (cfg.sheet.tile ?? 16) * scale;
        const xHit = dir === 1
            ? base.x + (cfg.spawnOffset?.x ?? 0)
            : base.x + base.w - (cfg.spawnOffset?.x ?? 0) - tileW;
        const yHit = base.y + (cfg.spawnOffset?.y ?? 0);
        enemyProjectiles.push(new Projectile({ ownerTag: 'enemy', ownerKind: enemy.kind, conf: cfg, xHit, yHit, dir }));
    }

    // === Input ===
    const keys = { left: false, right: false };
    function attackInternalNameForSlot(slot) {
        if (player.kind === 'heroB') { if (slot === 1) return 'slash'; if (slot === 2) return 'bolt'; return; }
        if (slot === 3) return 'light'; if (slot === 4) return 'heavy'; return;
    }
    function triggerAttackBySlot(slot) {
        const name = attackInternalNameForSlot(slot);
        if (!name || !player.attacks?.[name]) return;
        player.facing = aimAtNearestEnemyDirection();
        const started = player.startAttack(name);
        if (started) {
            const ms = player.attacks[name]?.cooldownMs ?? 0;
            document.dispatchEvent(new CustomEvent('obon:attack-fired', {
                detail: { slot, cooldownMs: ms, at: performance.now() }
            }));
        }
    }
    function onKeyDown(e) {
        const hot = ['a', 'd', '1', '2', '3', '4', 'r', 'R', ' '];
        if (hot.includes(e.key)) e.preventDefault();
        if (e.key === 'a' && !player.dead) { keys.left = true; player.facing = -1; return; }
        if (e.key === 'd' && !player.dead) { keys.right = true; player.facing = 1; return; }
        if (player.kind === 'heroB' && (e.key === '1' || e.key === '2')) triggerAttackBySlot(Number(e.key));
        if (player.kind !== 'heroB' && (e.key === '3' || e.key === '4')) triggerAttackBySlot(Number(e.key));
        if (player.dead && (e.key === 'r' || e.key === 'R')) retryScene();
    }
    function onKeyUp(e) { if (e.key === 'a') keys.left = false; if (e.key === 'd') keys.right = false; }
    window.addEventListener('keydown', onKeyDown, { passive: false });
    window.addEventListener('keyup', onKeyUp);

    // === API for hooks (exposed)
    function transformToGrandpa() {
        finaleTransformed = true;

        const ankoNPC = new Fighter({
            tag: 'ally',
            kind: 'heroA',
            conf: ASSETS.players.heroA,
            position: { x: Math.max(20, cssWidth() * 0.12), y: groundY },
            velocity: { x: 0, y: 0 }
        });
        allies.push(ankoNPC);

        const keep = { x: Math.min(cssWidth() * 0.5, player.position.x), y: player.position.y, facing: player.facing };
        player = new Fighter({
            tag: 'player',
            kind: 'heroB',
            conf: ASSETS.players.heroB,
            position: { x: keep.x, y: keep.y },
            velocity: { x: 0, y: 0 }
        });
        player.facing = keep.facing;

        broadcastHeroTheme(true);
    }

    const api = {
        gotoScene: (id) => loadSceneById(id),
        gotoNextScene: () => gotoNextScene(),
        retryScene: () => retryScene(),
        isLastScene: () => currentSceneIndex >= SCENES.length - 1,
        transformToGrandpa
    };

    // layer projectiles
    function spawnPlayerProjectile(config, direction) {
        const base = spriteRect(player);
        const scale = config.scale ?? 1;
        const tileW = (config.sheet.tile ?? 16) * scale;
        const xHit = direction === 1
            ? base.x + config.spawnOffset.x
            : base.x + base.w - config.spawnOffset.x - tileW;
        const yHit = base.y + config.spawnOffset.y;
        playerProjectiles.push(new Projectile({ ownerTag: 'player', ownerKind: player.kind, conf: config, xHit, yHit, dir: direction }));
    }

    // Player Attack Processing
    function handlePlayerActiveAttack() {
        if (!player.isAttacking || !player.activeAttack) return;
        const def = player.activeAttack.def;
        const frameIndex = player.framesCurrent;
        if (!player._attackTriggered) {
            const triggerFrame = def.type === 'projectile' ? (def.fireFrame ?? 0) : (def.hitFrame ?? player.melee?.hitFrame ?? 0);
            if (frameIndex === triggerFrame) {
                if (def.type === 'projectile') {
                    const cfg = ASSETS.playerProjectiles[def.projectile];
                    if (cfg) spawnPlayerProjectile(cfg, player.facing);
                } else {
                    const time = performance.now();
                    if (time - lastEnemyHitAt.value > ENEMY_INV_MS) {
                        const hitR = playerMeleeRect(player);
                        let hit = false;
                        for (const e of enemies) {
                            if (e.dead) continue;
                            if (rectanglesOverlap(hitR, enemyHurtRect(e))) {
                                hit = true;
                                const dmg = def.damage ?? player.melee?.damage ?? 1;
                                e.hp = Math.max(0, e.hp - dmg);
                                if (e.hp <= 0) { e.dead = true; e.switchSprite('death'); }
                                else {
                                    e.switchSprite('takeHit');
                                    const push = Math.sign(e.position.x - player.position.x) || 1;
                                    e.velocity.x = (6 * push) / frameScale;
                                    if (e.usesGravity) e.velocity.y = -4 / frameScale;
                                }
                            }
                        }
                        if (hit) lastEnemyHitAt.value = time;
                    }
                }
                player._attackTriggered = true;
            }
        }
        if (frameIndex === player.framesMax - 1) {
            player.isAttacking = false;
            player.activeAttack = null;
            player._attackTriggered = false;
            player.switchSprite('idle');
        }
    }

    // HUD / Theme broadcast
    function broadcastHeroTheme(enable = true) {
        const tint = player.conf.hudTint || '255,255,255';
        const map = (player.kind === 'heroB')
            ? { 1: 'Sword Slash', 2: 'Chi-Slash' }
            : { 3: 'Aura Sphere', 4: 'Aura Blast' };
        const cooldowns = {};
        [1, 2, 3, 4].forEach((slot) => {
            const n = attackInternalNameForSlot(slot);
            const ms = n ? (player.attacks?.[n]?.cooldownMs ?? 0) : 0;
            if (ms) cooldowns[slot] = ms;
        });
        document.documentElement.style.setProperty('--attack-tint', `rgb(${tint})`);
        document.dispatchEvent(new CustomEvent('obon:hero-theme', {
            detail: { name: player.conf.name, tint, map, cooldowns, disabled: !enable }
        }));
    }

    // Loop
    function frame() {
        raf = requestAnimationFrame(frame);
        const now = performance.now();
    const dt = now - lastNow || FRAME_DURATION;

    // 30fps limiter: only step when ~33.3ms elapsed
    if (dt < FRAME_DURATION - 1) return;

    // lock all motion/animations to 30fps (relative to 60fps-tuned constants)
    frameScale = FRAME_DURATION / (1000 / 60); // ≈ 2.0
    lastNow = now;
    const elapsedMs = now - t0;

    // backdrop
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, cssWidth(), cssHeight());
    background.update();
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(0, 0, cssWidth(), cssHeight());

    maybeSpawnNextEnemy(now);

    // player movement
    if (!player.dead && !player.isAttacking && !cutsceneActive) {
        const desiredDx = (keys.left ? -PLAYER_WALK_SPEED : 0) + (keys.right ? PLAYER_WALK_SPEED : 0);
        const blockers = enemies.filter((e) => !e.dead);
        const dx = blockMovementX(player, desiredDx, blockers, MIN_SEP);
        player.velocity.x = dx;
        applyRunAnimation(player, dx);
    } else { player.velocity.x = 0; applyRunAnimation(player, 0); }

    player.update(elapsedMs, groundY);
    if (!cutsceneActive) handlePlayerActiveAttack();

    // Allies idle
    for (const a of allies) {
        a.velocity.x = 0;
        a.switchSprite('idle');
        a.update(elapsedMs, groundY);
    }

    // enemies
    for (const e of enemies) {
        if (e.dead) {
            e.velocity.x = 0;
            e.update(elapsedMs, groundY);
            if (e.state === 'death' && e.framesCurrent >= e.framesMax - 1) e._remove = true;
            continue;
        }
        if (!cutsceneActive) {
            e.facing = player.position.x >= e.position.x ? 1 : -1;
            const ai = e.conf.ai;
            if (ai?.type === 'chase' || ai?.type === 'chaseShoot') {
                const dxTo = player.position.x - e.position.x;
                const targetVx = Math.sign(dxTo) * (ai.speed ?? 1.0);
                const desiredDx = e.velocity.x + (targetVx - e.velocity.x) * (ai.accel ?? 0.2);
                const blockedDx = blockMovementX(e, desiredDx, [player], MIN_SEP);
                e.velocity.x = blockedDx;
                if (ai.type === 'chaseShoot' && e.conf.projectile) {
                    const inRange = Math.abs(dxTo) <= (ai.shootRange ?? 500);
                    if (!enemyShootCooldown.has(e)) enemyShootCooldown.set(e, -Infinity);
                    const last = enemyShootCooldown.get(e);
                    if (inRange && now - last >= (ai.shootCooldownMs ?? 800)) { enemyShootCooldown.set(e, now); shootEnemy(e); }
                }
                if (Math.abs(blockedDx) > 0.1) e.switchSprite(e.sheets.runRight ? 'runRight' : (e.sheets.run ? 'run' : 'idle'));
                else e.switchSprite('idle');
            } else e.switchSprite('idle');
        } else {
            e.velocity.x = 0;
            e.switchSprite('idle');
        }
        e.update(elapsedMs, groundY);
    }
    for (let i = enemies.length - 1; i >= 0; i--) {
        if (enemies[i]._remove) enemies.splice(i, 1);
    }

    // player projectiles
    for (let i = playerProjectiles.length - 1; i >= 0; i--) {
        const proj = playerProjectiles[i];
        proj.updateAndDraw();
        if (!cutsceneActive && proj.state === 'fly') {
            const time = performance.now();
            if (time - lastEnemyHitAt.value > ENEMY_INV_MS) {
                const hb = proj.hitRect();
                for (const e of enemies) {
                    if (e.dead) continue;
                    if (rectanglesOverlap(hb, enemyHurtRect(e))) {
                        lastEnemyHitAt.value = time;
                        e.hp = Math.max(0, e.hp - (proj.conf.damage ?? 1));
                        proj._explode();
                        if (e.hp <= 0) { e.dead = true; e.switchSprite('death'); }
                        else {
                            e.switchSprite('takeHit');
                            const push = Math.sign(e.position.x - player.position.x) || 1;
                            e.velocity.x = (6 * push) / frameScale;
                            if (e.usesGravity) e.velocity.y = -4 / frameScale;
                        }
                        break;
                    }
                }
            }
        }
        if (proj.remaining <= 0) playerProjectiles.splice(i, 1);
    }

    // enemy projectiles
    for (let i = enemyProjectiles.length - 1; i >= 0; i--) {
        const proj = enemyProjectiles[i];
        proj.updateAndDraw();
        if (!cutsceneActive && proj.state === 'fly') {
            const time = performance.now();
            if (time - lastPlayerHitAt.value > PLAYER_INV_MS) {
                if (rectanglesOverlap(proj.hitRect(), spriteRect(player)) && !player.dead) {
                    lastPlayerHitAt.value = time;
                    const newHp = Math.max(0, player.hp - (proj.conf.damage ?? 1));
                    if (newHp <= 0) lastKillerKind = proj.ownerKind || null;
                    player.hp = newHp;
                    proj._explode();
                    if (player.hp <= 0) { player.dead = true; player.switchSprite('death'); player.velocity.x = 0; }
                    else {
                        const push = Math.sign(player.position.x - proj.xHit) || 1;
                        player.velocity.x = (3 * push) / frameScale;
                        if (player.usesGravity) player.velocity.y = -3 / frameScale;
                        player.switchSprite('takeHit');
                    }
                }
            }
        }
        if (proj.remaining <= 0) enemyProjectiles.splice(i, 1);
    }

    // touch damage
    if (!cutsceneActive) {
        for (const e of enemies) {
            if (e.dead || !e.usesGravity) continue;
            const time = performance.now();
            if (time - lastPlayerHitAt.value > PLAYER_INV_MS && !player.dead && isNearContact(e, player, CONTACT_GAP)) {
                lastPlayerHitAt.value = time;
                const dmg = e.conf.contactDamage ?? 1;
                const newHp = Math.max(0, player.hp - dmg);
                if (newHp <= 0) lastKillerKind = e.kind;
                player.hp = newHp;
                if (player.hp <= 0) { player.dead = true; player.switchSprite('death'); player.velocity.x = 0; }
                else {
                    const push = Math.sign(player.position.x - e.position.x) || 1;
                    player.velocity.x = (3 * push) / frameScale;
                    if (player.usesGravity) player.velocity.y = -3 / frameScale;
                    player.switchSprite('takeHit');
                }
            }
        }
    }

    // Hooks & scene advance
    if (sceneCleared() && !nextHookSent) {
        nextHookSent = true;
        if (typeof hooks.onReadyForNext === 'function') {
            const s = SCENES[currentSceneIndex];
            const pr = spriteRect(player);
            const right = pr.x + pr.w;
            const exitRatio = s?.flow?.exitThresholdRatio ?? 0.9;
            hooks.onReadyForNext(api, {
                atExit: right >= cssWidth() * exitRatio,
                sceneId: s.id,
                sceneIndex: currentSceneIndex,
                isLast: currentSceneIndex >= SCENES.length - 1
            });
        }
    }

    // Death handling
    if (player.dead && !deathHookSent && player.framesCurrent === player.framesMax - 1) {
        deathHookSent = true;
        const s = SCENES[currentSceneIndex];
        const sceneId = s?.id;

        if (typeof hooks.onPlayerDeath === 'function') {
            hooks.onPlayerDeath(api, { sceneId, killerKind: lastKillerKind });
        } else {
            const isFinale = sceneId === 10;
            if (isFinale && lastKillerKind === 'ghostBoss' && !finaleTransformed) {
                player.dead = false;
                player.switchSprite('idle');
                (async () => {
                    await runFade(1, 500);
                    transformToGrandpa();
                    await runFade(0, 500);
                })();
                deathHookSent = false;
            } else {
                retryScene();
            }
        }
    }

    // Health bars
    drawHealthBar(player, 'lime');
    for (const e of enemies) drawHealthBar(e, 'crimson');

    // Fade overlay render & progress
    if (fade.running || fade.alpha > 0) {
        const t = Math.min(1, (now - fade.startAt) / Math.max(1, fade.endAt - fade.startAt));
        fade.alpha = fade.start + (fade.target - fade.start) * t;
        if (t >= 1 && fade.running) {
            fade.running = false;
            const done = fade._resolve; fade._resolve = null;
            if (done) done();
        }
        ctx.save();
        ctx.globalAlpha = Math.max(0, Math.min(1, fade.alpha));
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, cssWidth(), cssHeight());
        ctx.restore();
    }
}

    // External Controls
    function onExternalAttack(e) {
        const slot = Number(e.detail?.slot);
        if (slot >= 1 && slot <= 4) triggerAttackBySlot(slot);
    }
    document.addEventListener(EVENT_ATTACK, onExternalAttack);

    // Kickoff
    broadcastHeroTheme(true);
    frame();

    // Stop
    function stop() {
        if (raf) { cancelAnimationFrame(raf); raf = null; }
        window.removeEventListener('keydown', onKeyDown);
        window.removeEventListener('keyup', onKeyUp);
        window.removeEventListener('resize', handleCanvasResize);
        window.removeEventListener('orientationchange', handleCanvasResize);
        if (enemySpeechEl && enemySpeechEl.parentElement) enemySpeechEl.parentElement.removeChild(enemySpeechEl);
        enemySpeechEl = null; cutsceneActive = false;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        resolveFinished?.('stopped');
        document.removeEventListener(EVENT_ATTACK, onExternalAttack);
    }

    //Public API
    return {
        stop,
        finished,
        gotoScene: (id) => loadSceneById(id),
        gotoNextScene: () => gotoNextScene(),
        retryScene: () => retryScene(),
        isLastScene: () => currentSceneIndex >= SCENES.length - 1,
        attack: (slot) => triggerAttackBySlot(slot),
        transformToGrandpa
    };
}