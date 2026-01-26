import { fireProjectile } from './Projectile';
import { Debug } from '../Debug';

export function createEnemy(scene, x, y, radius = 20, rangeMultiplier = 0.6)
{
    const enemy = scene.add.circle(x, y, radius, 0xff3333);
    scene.physics.add.existing(enemy);
    enemy.body.setCircle(radius);
    // allow enemy movement (will chase the player when in range)
    enemy.body.setImmovable(false);
    if (enemy.body.setAllowGravity)
    {
        enemy.body.setAllowGravity(false);
    }
    // ensure body is allowed to move
    if (enemy.body && enemy.body.moves !== undefined)
    {
        enemy.body.moves = true;
    }
    if (enemy.body.setCollideWorldBounds)
    {
        enemy.body.setCollideWorldBounds(true);
    }
    enemy.health = 3;

    // create a selection border (Graphics) and hide by default
    const sel = scene.add.graphics({ x: 0, y: 0 });
    sel.lineStyle(3, 0xffff00, 1);
    sel.strokeCircle(x, y, radius + 6);
    sel.setVisible(!!Debug.showAreas ? true : false);
    sel.setDepth(10);

    enemy._selectionGraphics = sel;
    enemy.setSelected = function (v)
    {
        this._selectionGraphics.setVisible(!!v);
        this.isSelected = !!v;
    };

    // enemy perception / combat properties
    // enemy should have smaller attack range than the player; if player exists, base on that
    const playerRange = (scene.player && scene.player.rangeRadius) ? scene.player.rangeRadius : 60;
    enemy.attackRadius = Math.max(24, Math.floor(playerRange * rangeMultiplier));
    enemy.attackCircle = scene.add.circle(x, y, enemy.attackRadius, 0xff0000, 0.08);
    enemy.attackCircle.setVisible(!!Debug.showAreas);

    // followRadius: area in which enemy will start following the player (larger)
    enemy.followRadius = Math.max(enemy.attackRadius * 2, enemy.attackRadius + 80);
    enemy.followCircle = scene.add.circle(x, y, enemy.followRadius, 0xff8800, 0.04);
    enemy.followCircle.setVisible(!!Debug.showAreas);
    // followGraphics: contorno visível da arena de perseguição (mais legível que fill fraco)
    enemy._followGraphics = scene.add.graphics({ x: 0, y: 0 });
    enemy._followGraphics.lineStyle(2, 0xff8800, 0.7);
    enemy._followGraphics.strokeCircle(x, y, enemy.followRadius);
    enemy._followGraphics.setDepth(5);
    enemy._followGraphics.setVisible(!!Debug.showAreas);

    enemy.fireRate = 800; // ms
    enemy.lastFired = 0;

    // chase properties
    enemy.chaseSpeed = 120;
    enemy.isChasing = false;
    // se o inimigo já "viu" o player, continua perseguindo mesmo que o player saia da followRadius
    enemy.hasSeenPlayer = false;

    // ensure selection graphic and range circle follow enemy
    enemy.updateSelectionPosition = function ()
    {
        if (this._selectionGraphics)
        {
            this._selectionGraphics.clear();
            this._selectionGraphics.lineStyle(3, 0xffff00, 1);
            this._selectionGraphics.strokeCircle(this.x, this.y, radius + 6);
        }

        if (this.attackCircle)
        {
            this.attackCircle.setPosition(this.x, this.y);
            this.attackCircle.setVisible(!!Debug.showAreas);
        }

        if (this.followCircle)
        {
            this.followCircle.setPosition(this.x, this.y);
            this.followCircle.setVisible(!!Debug.showAreas);
        }

        if (this._followGraphics)
        {
            this._followGraphics.clear();
            this._followGraphics.lineStyle(2, 0xff8800, 0.7);
            this._followGraphics.strokeCircle(this.x, this.y, this.followRadius);
            this._followGraphics.setVisible(!!Debug.showAreas);
        }
    };

    // basic AI: follow when inside followRadius, shoot when inside attackRadius
    enemy.update = function (time)
    {
        if (!scene.player || !scene.player.sprite || !scene.player.sprite.active) return;

        const px = scene.player.sprite.x;
        const py = scene.player.sprite.y;
        const d = Phaser.Math.Distance.Between(this.x, this.y, px, py);

        // marca como visto se o player entrar na follow area
        if (d <= this.followRadius)
        {
            this.hasSeenPlayer = true;
        }

        // determine behavior based on distance
        if (d <= this.attackRadius)
        {
            // inside attack radius: stop and fire
            if (this.body && this.body.setVelocity)
            {
                this.body.setVelocity(0, 0);
            }
            this.isChasing = false;

            if (time > this.lastFired + this.fireRate)
            {
                this.lastFired = time;
                fireProjectile(scene, this.x, this.y, scene.player.sprite, scene.player.sprite);
            }
        }
        else if (d <= this.followRadius || this.hasSeenPlayer)
        {
            // inside follow area: pursue the player
            let dx = px - this.x;
            let dy = py - this.y;
            const len = Math.sqrt(dx * dx + dy * dy) || 1;
            const ux = dx / len;
            const uy = dy / len;
            if (this.body && this.body.setVelocity)
            {
                this.body.setVelocity(ux * this.chaseSpeed, uy * this.chaseSpeed);
            }
            this.isChasing = true;
        }
        else
        {
            // outside follow area: idle
            if (this.body && this.body.setVelocity)
            {
                this.body.setVelocity(0, 0);
            }
            this.isChasing = false;
        }
    };

    // custom hit handler to apply damage and flash when hit
    enemy.onHit = function (source)
    {
        this.health = (this.health || 1) - 1;

        // flash visual feedback
        if (this.setFillStyle)
        {
            this.setFillStyle(0xffffff);
            this.scene.time.addEvent({ delay: 120, callback: () => { if (this && this.setFillStyle) this.setFillStyle(0xff3333); } });
        }

        if (this.health <= 0)
        {
            this.destroy();
        }
    };

    // when enemy is destroyed, clean up selection graphic, range circle and clear player selection
    enemy.on('destroy', () =>
    {
        if (enemy._selectionGraphics)
        {
            enemy._selectionGraphics.destroy();
        }
        if (enemy.attackCircle)
        {
            enemy.attackCircle.destroy();
        }

        if (enemy.followCircle)
        {
            enemy.followCircle.destroy();
        }

        if (enemy._followGraphics)
        {
            enemy._followGraphics.destroy();
        }

        if (scene && scene.player && scene.player.selectedEnemy === enemy)
        {
            scene.player.selectedEnemy = null;
            scene.player.inAttackPosition = false;
            scene.player.targetEnemy = null;
        }
    });

    return enemy;
}
