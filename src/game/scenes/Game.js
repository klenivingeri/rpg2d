import Phaser from 'phaser';
import { EventBus } from '../EventBus';
import { Scene } from 'phaser';
import Player from '../prefabs/Player';
import { createEnemy } from '../prefabs/Enemy';

export class Game extends Scene
{
    constructor ()
    {
        super('Game');
    }
    
    // background carregado na Boot (preloader usa mesma chave)

    create ()
    {
        this.cameras.main.setBackgroundColor(0x00aa55);

        // disable right-click context menu on the game canvas
        if (this.input && this.input.mouse && typeof this.input.mouse.disableContextMenu === 'function')
        {
            this.input.mouse.disableContextMenu();
        }
        else
        {
            window.addEventListener('contextmenu', (e) => { e.preventDefault(); });
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
        this.input.on('pointerdown', pointer =>
        {
            let clickedEnemy = null;
            for (const enemy of this.enemies.getChildren())
            {
                const d = Phaser.Math.Distance.Between(pointer.worldX, pointer.worldY, enemy.x, enemy.y);
                const r = (enemy.radius) ? enemy.radius : (enemy.displayWidth / 2 || 20);
                if (d <= r)
                {
                    clickedEnemy = enemy;
                    break;
                }
            }

            if (clickedEnemy)
            {
                // if player is already locked in attack position on this enemy, ignore
                if (this.player.inAttackPosition && this.player.selectedEnemy === clickedEnemy)
                {
                    return;
                }

                // deselect other enemies
                for (const e of this.enemies.getChildren())
                {
                    if (e !== clickedEnemy && e.setSelected)
                    {
                        e.setSelected(false);
                    }
                }

                // mark clicked enemy as selected visually
                if (clickedEnemy.setSelected)
                {
                    clickedEnemy.setSelected(true);
                }

                // If enemy is already within player's perception range, start firing from current position
                const distToEnemy = Phaser.Math.Distance.Between(this.player.sprite.x, this.player.sprite.y, clickedEnemy.x, clickedEnemy.y);
                if (distToEnemy <= this.player.rangeRadius)
                {
                    // stop any movement and lock on target so autofire begins immediately
                    this.player.stop();
                    this.player.selectedEnemy = clickedEnemy;
                    this.player.targetEnemy = null;
                    this.player.inAttackPosition = true;
                }
                else
                {
                    // move toward enemy and stop at shooting distance
                    this.player.moveToEnemy(clickedEnemy);
                }
            }
            else
            {
                // cancel any attack lock and move to clicked ground point
                this.player.inAttackPosition = false;
                // clear selection visuals on all enemies
                for (const e of this.enemies.getChildren())
                {
                    if (e.setSelected)
                    {
                        e.setSelected(false);
                    }
                }

                this.player.selectedEnemy = null;
                this.player.targetEnemy = null;
                this.player.moveTo({ x: pointer.worldX, y: pointer.worldY });
            }
        });

        // --- Câmera ---
        const cam = this.cameras.main;
        cam.setBounds(0, 0, 1600, 1600);

        const followTarget = (this.player && this.player.sprite) ? this.player.sprite : this.player;
        cam.startFollow(followTarget, true, 0.1, 0.1);
        // Aplicar zoom/scale global da câmera
        const WORLD_SCALE = 1.3;
        cam.setZoom(WORLD_SCALE);

        const updateCameraDeadzone = () => {
            const w = window.innerWidth;
            const h = window.innerHeight;

            const dzW = Math.floor(w * 0.4);
            const dzH = Math.floor(h * 0.4);

            cam.setViewport(0, 0, w, h);
            cam.setDeadzone(dzW, dzH);
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
        });

        EventBus.emit('current-scene-ready', this);
    }

    update (time, delta)
    {
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
