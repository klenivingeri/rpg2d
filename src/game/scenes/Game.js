import Phaser from 'phaser';
import { EventBus } from '../EventBus';
import { Scene } from 'phaser';
import Player from '../prefabs/Player';
import gameConfig from '../gameConfig';
import Joystick from '../inputs/Joystick';
import { createEnemy } from '../prefabs/Enemy';
import { Debug } from '../Debug';

export class Game extends Scene
{
    constructor ()
    {
        super('Game');
    }
    
    // background carregado na Boot (preloader usa mesma chave)

    create ()
    {
        console.log('[Game] create');
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
            console.log('[Game] joystick-changed', v);
            this.joystickEnabled = !!v;
            // create joystick lazily if necessary
            if (!this.joystick) {
                console.log('[Game] creating joystick (lazy) enabled=', this.joystickEnabled);
                this.joystick = new Joystick(this, { enabled: this.joystickEnabled });
            } else {
                console.log('[Game] updating joystick enable state ->', this.joystickEnabled);
                if (this.joystickEnabled) this.joystick.enable(); else this.joystick.disable();
            }
        };
        EventBus.on('joystick-changed', this._onJoystickChanged);
        this.events.on('pause', () => { console.log('[Game] event: pause'); });
        this.events.on('resume', () => { console.log('[Game] event: resume'); });
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

        // Fundo / mapa: força o tamanho lógico para 1600x1600 e origem em 0,0
        const bg = this.add.image(0, 0, 'background').setOrigin(0, 0);
        bg.setDisplaySize(1600, 1600);

        // Limites do mundo físico para impedir que o player saia das bordas
        this.physics.world.setBounds(0, 0, 1600, 1600, true, true, true, true);

        // player
        this.player = new Player(this, 200, 300);

        // enemies group
        this.enemies = this.physics.add.group();
        for (let i = 0; i < 5; i++)
        {
            const ex = 420 + i * 80;
            const ey = 240 + (i % 2) * 40;
            const enemy = createEnemy(this, ex, ey, 20);
            this.enemies.add(enemy);
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
        cam.setBounds(0, 0, 1600, 1600);

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
            console.log('[Game] shutdown');
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
            console.log('[Game] creating initial joystick enabled=', this.joystickEnabled);
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
