import { fireProjectile } from './Projectile';

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
    sel.setVisible(false);
    sel.setDepth(10);

    enemy._selectionGraphics = sel;
    enemy.setSelected = function (v)
    {
        this._selectionGraphics.setVisible(!!v);
        this.isSelected = !!v;
    };

    // enemy perception / combat properties
    // enemy should have smaller range than the player; if player exists, base on that
    const playerRange = (scene.player && scene.player.rangeRadius) ? scene.player.rangeRadius : 60;
    enemy.rangeRadius = Math.max(24, Math.floor(playerRange * rangeMultiplier));
    enemy.rangeCircle = scene.add.circle(x, y, enemy.rangeRadius, 0xff0000, 0.08);

    enemy.fireRate = 800; // ms
    enemy.lastFired = 0;

    // chase properties
    enemy.chaseSpeed = 120;
    enemy.isChasing = false;

    // ensure selection graphic and range circle follow enemy
    enemy.updateSelectionPosition = function ()
    {
        if (this._selectionGraphics)
        {
            this._selectionGraphics.clear();
            this._selectionGraphics.lineStyle(3, 0xffff00, 1);
            this._selectionGraphics.strokeCircle(this.x, this.y, radius + 6);
        }

        if (this.rangeCircle)
        {
            this.rangeCircle.setPosition(this.x, this.y);
        }
    };

    // basic AI: if player enters range, shoot at the player
    enemy.update = function (time)
    {
        if (!scene.player || !scene.player.sprite || !scene.player.sprite.active) return;

        const px = scene.player.sprite.x;
        const py = scene.player.sprite.y;
        const d = Phaser.Math.Distance.Between(this.x, this.y, px, py);
        // always chase the player (stop at a close distance), but only fire when inside range
        const stopDistance = 24;
        if (d > stopDistance)
        {
            // compute normalized direction toward player and set velocity
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
            if (this.body && this.body.setVelocity)
            {
                this.body.setVelocity(0, 0);
            }
            this.isChasing = false;
        }

        // firing behavior: only when within perception range
        if (d <= this.rangeRadius)
        {
            if (time > this.lastFired + this.fireRate)
            {
                this.lastFired = time;
                fireProjectile(scene, this.x, this.y, scene.player.sprite, scene.player.sprite);
            }
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
        if (enemy.rangeCircle)
        {
            enemy.rangeCircle.destroy();
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
