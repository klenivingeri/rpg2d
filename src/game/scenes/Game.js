import Phaser from 'phaser';
import { EventBus } from '../EventBus';
import { Scene } from 'phaser';
import Player from '../prefabs/Player';
import gameConfig from '../gameConfig';
import Joystick from '../inputs/Joystick';
import { createEnemy } from '../prefabs/Enemy';
import { Debug } from '../Debug';
import { MAPS } from '../../data/data_maps';

export class Game extends Scene
{
    constructor ()
    {
        super('Game');
    }
    
    // background carregado na Boot (preloader usa mesma chave)

    create ()
    {
        
        // estado local para saber se o joystick virtual está ativo (controlado pela UI React)
        this.joystickEnabled = false;
        // tentar inicializar a partir do localStorage para cobrir casos onde o React ainda
        // não emitiu o evento 'joystick-changed' quando a cena foi criada
        try {
            const j = localStorage.getItem('gi.joystick');
            if (j !== null) this.joystickEnabled = j === 'true';
        } catch (e) { /* ignore */ }
        // ouvir mudanças vindas do EventBus
            this._onJoystickChanged = (v) => {
            this.joystickEnabled = !!v;
            // create joystick lazily if necessary
                if (!this.joystick) {
                this.joystick = new Joystick(this, { enabled: this.joystickEnabled });
            } else {
                if (this.joystickEnabled) this.joystick.enable(); else this.joystick.disable();
            }
        };
        EventBus.on('joystick-changed', this._onJoystickChanged);
        this.events.on('pause', () => {  });
        this.events.on('resume', () => {  });
        this.cameras.main.setBackgroundColor(0x00aa55);
        
        // gráfico para debug (grid + deadzone) fixo na tela
        this.debugGraphics = this.add.graphics();
        this.debugGraphics.setScrollFactor(0);
        this.debugGraphics.setDepth(1000);
        // disable right-click context menu on the game canvas
        if (this.input && this.input.mouse && typeof this.input.mouse.disableContextMenu === 'function')
        {
            this.input.mouse.disableContextMenu();
        }
        else
        {
            this._onContextMenu = (e) => { e.preventDefault(); };
            window.addEventListener('contextmenu', this._onContextMenu);
        }

        // --- Tilemap / Mundo ---
        const maps = Array.isArray(MAPS) ? MAPS : [];
        const mapData = maps.length ? maps[0] : null;
        let tilemap = null;
        let collisionLayer = null;
        if (mapData && mapData.tilemap_key) {
            try {
                tilemap = this.make.tilemap({ key: mapData.tilemap_key });
                
                // add tilesets declared for this map
                const tilesetObjs = [];
                if (Array.isArray(mapData.tilemap_images)) {
                    mapData.tilemap_images.forEach((ti) => {
                        try {
                            
                            const ts = tilemap.addTilesetImage(ti.name, ti.name);
                            if (ts) {
                                tilesetObjs.push(ts);
                                
                            } else {
                                console.warn('[Game] addTilesetImage returned null for', ti.name);
                            }
                        } catch (e) { console.warn('[Game] failed to add tileset', ti.name, e); }
                    });
                }

                // log TMJ-declared tilesets (raw data) to help diagnose mismatches
                    try {
                    const tmjTilesets = (tilemap && tilemap.tilesets) ? tilemap.tilesets.map(ts => ({ name: ts.name, firstgid: ts.firstgid, image: ts.image })) : [];
                } catch (e) { /* ignore */ }

                try {
                } catch (e) { /* ignore */ }

                // create all layers from the tilemap
                this.mapLayers = {};
                if (tilemap.layers && Array.isArray(tilemap.layers)) {
                    // log the raw layer order from the TMJ for debugging
                        try {
                        const layerNames = tilemap.layers.map(x => x && x.name ? x.name : '<unnamed>');
                    } catch (e) { /* ignore logging errors */ }

                    tilemap.layers.forEach((l) => {
                        try {
                            // skip non-tile layers only when type is explicit
                            if (l.type && l.type !== 'tilelayer') return;
                            
                            const layer = tilemap.createLayer(l.name, tilesetObjs, 0, 0);
                            // detect numeric prefix like "1-", "2-" and set depth accordingly
                            const m = (l.name || '').match(/^(\d+)-/);
                            if (m) {
                                const prefix = parseInt(m[1], 10);
                                if (!Number.isNaN(prefix)) {
                                    layer.setDepth(prefix);
                                }
                            } else {
                            }
                            this.mapLayers[l.name] = layer;
                        } catch (e) { console.warn('[Game] failed to create layer', l && l.name, e); }
                    });

                    // after creation, log mapLayers keys and their depths
                    try {
                        const created = Object.keys(this.mapLayers).map(k => ({ name: k, depth: this.mapLayers[k] && this.mapLayers[k].depth }));
                    } catch (e) { /* ignore */ }
                }

                // find collision layer named exactly 'obj-colision' and terrain collision layer '2-terrain-colision'
                collisionLayer = this.mapLayers && this.mapLayers['obj-colision'] ? this.mapLayers['obj-colision'] : null;
                if (collisionLayer) {
                    collisionLayer.setCollisionByExclusion([-1]);
                }
                const terrainCollisionLayer = this.mapLayers && this.mapLayers['2-terrain-colision'] ? this.mapLayers['2-terrain-colision'] : null;
                if (terrainCollisionLayer) {
                    terrainCollisionLayer.setCollisionByExclusion([-1]);
                }

                // adjust world and camera bounds to the tilemap size (tilemap width/height in pixels)
                const mapWidth = tilemap.widthInPixels || (tilemap.width * (tilemap.tileWidth || 32)) || 1600;
                const mapHeight = tilemap.heightInPixels || (tilemap.height * (tilemap.tileHeight || 32)) || 1600;

                // show background scaled to map size (keeps previous background visually)
                try {
                    const bg = this.add.image(0, 0, 'background').setOrigin(0, 0);
                    bg.setDisplaySize(mapWidth, mapHeight);
                    bg.setDepth(-100);
                } catch (e) { /* ignore background failures */ }

                this.physics.world.setBounds(0, 0, mapWidth, mapHeight, true, true, true, true);

                // helper: find a nearby non-colliding spawn position
                const findSafePosition = (x, y) => {
                    if (!collisionLayer) return { x, y };
                    const step = 16;
                    const maxRadius = 256;
                    for (let r = 0; r <= maxRadius; r += step) {
                        for (let a = 0; a < 360; a += 30) {
                            const nx = Math.round(x + Math.cos((a / 180) * Math.PI) * r);
                            const ny = Math.round(y + Math.sin((a / 180) * Math.PI) * r);
                            const tile = collisionLayer.getTileAtWorldXY(nx, ny, true);
                            if (!tile || tile.index <= 0) return { x: nx, y: ny };
                        }
                    }
                    return { x, y };
                };

                // prepare projectiles group so projectiles can be collided/destroyed against terrain
                this.projectiles = this.physics.add.group();

                // player spawn: try to use portal or fallback coords
                const pDesired = (mapData.portal && typeof mapData.portal.x === 'number') ? { x: mapData.portal.x, y: mapData.portal.y } : { x: 200, y: 300 };
                const pSafe = findSafePosition(pDesired.x, pDesired.y);
                this.player = new Player(this, pSafe.x, pSafe.y);

                // enemies group and spawns - respect collision layer
                this.enemies = this.physics.add.group();
                const enemyCount = (mapData && typeof mapData.mob_count === 'number') ? Math.max(1, mapData.mob_count) : 5;
                for (let i = 0; i < Math.min(50, enemyCount); i++) {
                    // pick a random candidate within the world bounds and find a nearby safe tile
                    const randX = Math.floor(Math.random() * (mapWidth - 64)) + 32;
                    const randY = Math.floor(Math.random() * (mapHeight - 64)) + 32;
                    const safe = findSafePosition(randX, randY);
                    // escolher tipo baseado em mapData.possible_mobs quando disponível
                    let chosenType = null;
                    try {
                        const possible = (mapData && Array.isArray(mapData.possible_mobs)) ? mapData.possible_mobs : [];
                        if (possible.length) {
                            const cid = possible[Math.floor(Math.random() * possible.length)];
                            chosenType = (gameConfig && gameConfig.enemy && Array.isArray(gameConfig.enemy.types)) ? gameConfig.enemy.types.find(t => t && t.id === cid) : null;
                        }
                    } catch (e) { chosenType = null; }
                    const enemy = createEnemy(this, safe.x, safe.y, 20, undefined, chosenType);
                    this.enemies.add(enemy);
                    try {
                        const typeId = (chosenType && chosenType.id) ? chosenType.id : (enemy && enemy.id ? enemy.id : 'circle');
                        console.log('[Game] enemy spawned', typeId, 'at', safe.x, safe.y);
                    } catch (e) { /* ignore logging errors */ }
                }

                // add physics colliders with collision layer
                if (collisionLayer) {
                    try { this.physics.add.collider(this.player.sprite, collisionLayer); } catch (e) { /* ignore */ }
                    try { this.physics.add.collider(this.enemies, collisionLayer); } catch (e) { /* ignore */ }
                }
                // add collider with terrain collision layer: player collides and projectiles are destroyed on impact
                if (terrainCollisionLayer) {
                    try { this.physics.add.collider(this.player.sprite, terrainCollisionLayer); } catch (e) { /* ignore */ }
                    try { this.physics.add.collider(this.enemies, terrainCollisionLayer); } catch (e) { /* ignore */ }
                    try {
                        this.physics.add.collider(this.projectiles, terrainCollisionLayer, (proj) => {
                            try { if (proj && proj.destroy) proj.destroy(); } catch (e) { /* ignore */ }
                        });
                    } catch (e) { /* ignore */ }
                }

                // set camera bounds to map size
                const cam = this.cameras.main;
                cam.setBounds(0, 0, mapWidth, mapHeight);
                } catch (e) {
                // fallback to previous fixed world if map creation fails
                const bg = this.add.image(0, 0, 'background').setOrigin(0, 0);
                bg.setDisplaySize(1600, 1600);
                this.physics.world.setBounds(0, 0, 1600, 1600, true, true, true, true);
                this.player = new Player(this, 200, 300);
                this.enemies = this.physics.add.group();
                const fallbackCount = 5;
                for (let i = 0; i < fallbackCount; i++) {
                    const randX = Math.floor(Math.random() * (1600 - 64)) + 32;
                    const randY = Math.floor(Math.random() * (1600 - 64)) + 32;
                    const safe = findSafePosition(randX, randY);
                    const enemy = createEnemy(this, safe.x, safe.y, 20, undefined, null);
                    this.enemies.add(enemy);
                    try {
                        const typeId = (enemy && enemy.id) ? enemy.id : 'circle';
                        console.log('[Game] enemy spawned', typeId, 'at', safe.x, safe.y);
                    } catch (e) { /* ignore logging errors */ }
                }
            }
        } else {
            // no map data: fallback to previous behavior
            const bg = this.add.image(0, 0, 'background').setOrigin(0, 0);
            bg.setDisplaySize(1600, 1600);
            this.physics.world.setBounds(0, 0, 1600, 1600, true, true, true, true);
            this.player = new Player(this, 200, 300);
            this.enemies = this.physics.add.group();
            for (let i = 0; i < 5; i++) {
                const randX = Math.floor(Math.random() * (1600 - 64)) + 32;
                const randY = Math.floor(Math.random() * (1600 - 64)) + 32;
                const safe = findSafePosition(randX, randY);
                const enemy = createEnemy(this, safe.x, safe.y, 20, undefined, null);
                this.enemies.add(enemy);
                try {
                    const typeId = (enemy && enemy.id) ? enemy.id : 'circle';
                    console.log('[Game] enemy spawned', typeId, 'at', safe.x, safe.y);
                } catch (e) { /* ignore logging errors */ }
            }
        }

        // pointer input: click enemy to target, otherwise move to ground point
        // named pointer handler so we can remove it on shutdown and avoid leaks
        this._onPointerDown = (pointer) => {
            if (this.joystickEnabled) return;
            let clickedEnemy = null;
            for (const enemy of this.enemies.getChildren()) {
                const d = Phaser.Math.Distance.Between(pointer.worldX, pointer.worldY, enemy.x, enemy.y);
                const r = (enemy.radius) ? enemy.radius : (enemy.displayWidth / 2 || 20);
                if (d <= r) { clickedEnemy = enemy; break; }
            }

            if (clickedEnemy) {
                if (this.player.inAttackPosition && this.player.selectedEnemy === clickedEnemy) return;
                for (const e of this.enemies.getChildren()) { if (e !== clickedEnemy && e.setSelected) e.setSelected(false); }
                if (clickedEnemy.setSelected) clickedEnemy.setSelected(true);
                const distToEnemy = Phaser.Math.Distance.Between(this.player.sprite.x, this.player.sprite.y, clickedEnemy.x, clickedEnemy.y);
                if (distToEnemy <= this.player.rangeRadius) {
                    this.player.stop();
                    this.player.selectedEnemy = clickedEnemy;
                    this.player.targetEnemy = null;
                    this.player.inAttackPosition = true;
                } else {
                    this.player.moveToEnemy(clickedEnemy);
                }
            } else {
                this.player.inAttackPosition = false;
                for (const e of this.enemies.getChildren()) { if (e.setSelected) e.setSelected(false); }
                this.player.selectedEnemy = null;
                this.player.targetEnemy = null;
                this.player.moveTo({ x: pointer.worldX, y: pointer.worldY });
            }
        };

        this.input.on('pointerdown', this._onPointerDown);

        // --- Câmera ---
        const cam = this.cameras.main;

        const followTarget = (this.player && this.player.sprite) ? this.player.sprite : this.player;
        cam.startFollow(followTarget, true, 0.1, 0.1);
        // Aplicar zoom/scale global da câmera (ajustado dinamicamente para mobile)
        // Valores padrão — podemos ajustar conforme necessidade
        const WORLD_SCALE_DESKTOP = 1.3;
        const WORLD_SCALE_MOBILE = 1.05;

        const updateCameraDeadzone = () => {
            const w = window.innerWidth;
            const h = window.innerHeight;

            // margens de 40% a partir de cada borda -> deadzone central reduzida
            const marginX = Math.floor(w * 0.4);
            const marginY = Math.floor(h * 0.4);
            const dzW = Math.max(0, Math.floor(w - marginX * 2));
            const dzH = Math.max(0, Math.floor(h - marginY * 2));

            cam.setViewport(0, 0, w, h);
            cam.setDeadzone(dzW, dzH);
            // desenha grid + borda somente se Debug.showAreas for true
            if (this.debugGraphics)
            {
                this.debugGraphics.clear();
                if (Debug.showAreas)
                {
                    // grid (100px)
                    const gridSpacing = 100;
                    this.debugGraphics.lineStyle(1, 0x888888, 0.25);
                    for (let x = 0; x <= w; x += gridSpacing)
                    {
                        this.debugGraphics.strokeLineShape(new Phaser.Geom.Line(x, 0, x, h));
                    }
                    for (let y = 0; y <= h; y += gridSpacing)
                    {
                        this.debugGraphics.strokeLineShape(new Phaser.Geom.Line(0, y, w, y));
                    }

                    // deadzone border
                    const dzX = marginX;
                    const dzY = marginY;
                    this.debugGraphics.lineStyle(2, 0xffff00, 1);
                    this.debugGraphics.strokeRect(dzX, dzY, dzW, dzH);
                }
            }
            // diminuir um pouco o zoom em telas pequenas (mobile)
            const worldScale = (w < 768) ? WORLD_SCALE_MOBILE : WORLD_SCALE_DESKTOP;
            cam.setZoom(worldScale);
        };

        // Bind handler so we can remove it later on shutdown
        this._onResize = updateCameraDeadzone.bind(this);

        updateCameraDeadzone();
        window.addEventListener('resize', this._onResize);
        this.scale.on('resize', this._onResize);

        // Remove listeners when scene shuts down to avoid duplicate handlers
        this.events.on('shutdown', () => {

            try {
                window.removeEventListener('resize', this._onResize);
            } catch (e) { /* ignore */ }
            try {
                this.scale.off('resize', this._onResize);
            } catch (e) { /* ignore */ }
            try { EventBus.removeListener('joystick-changed', this._onJoystickChanged); } catch (e) { /* ignore */ }
            try { if (this.deadzoneBorder) { this.deadzoneBorder.destroy(); } } catch (e) { /* ignore */ }
            try { if (this._onContextMenu) { window.removeEventListener('contextmenu', this._onContextMenu); } } catch (e) { /* ignore */ }
            try { if (this._onPointerDown) { this.input.off('pointerdown', this._onPointerDown); } } catch (e) { /* ignore */ }
            try { if (this.player && typeof this.player.destroy === 'function') { this.player.destroy(); } } catch (e) { /* ignore */ }
            try { if (this.joystick && typeof this.joystick.destroy === 'function') { this.joystick.destroy(); } } catch (e) { /* ignore */ }
            try { this.joystick = null; } catch (e) { /* ignore */ }
        });

        // create joystick instance (lazy) so Player can reference it; visibility controlled by `joystickEnabled`
        if (!this.joystick) {
            this.joystick = new Joystick(this, { enabled: this.joystickEnabled });
        }

        EventBus.emit('current-scene-ready', this);
    }

    update (time, delta)
    {
        // joystick input takes priority for mobile movement
        if (this.joystick && this.joystick.enabled && this.joystick.isActive)
        {
            const inp = this.joystick.getInput();
            if (this.player && this.player.sprite && this.player.sprite.body && (Math.abs(inp.x) > 0 || Math.abs(inp.y) > 0))
            {
                const speed = this.player.moveSpeed || (gameConfig.player && gameConfig.player.moveSpeed) || 220;
                const vx = inp.x * speed;
                const vy = inp.y * speed;
                this.player.sprite.body.setVelocity(vx, vy);
                // cancel automatic movement/targets when using joystick
                this.player.targetPoint = null;
                this.player.targetEnemy = null;
                this.player.inAttackPosition = false;
            }
        }

        if (this.player)
        {
            this.player.update(time);
        }
        // update enemies that have behavior (allow them to shoot at player when in range)
        if (this.enemies)
        {
            for (const enemy of this.enemies.getChildren())
            {
                if (enemy && typeof enemy.update === 'function')
                {
                    enemy.update(time);
                }
                if (enemy && typeof enemy.updateSelectionPosition === 'function')
                {
                    enemy.updateSelectionPosition();
                }
            }
        }
    }

    changeScene ()
    {
        // Notifica a UI React que houve game over e para/destroi a cena atual
        EventBus.emit('game-over');
        try {
            this.scene.stop();
        } catch (e) {
            // ignore
        }
    }

}
