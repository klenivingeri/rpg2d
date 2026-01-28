import { fireProjectile } from './Projectile';
import { Debug } from '../Debug';
import DamageText from './DamageText';
import gameConfig from '../gameConfig';

    // aumenta a area de tiro do enemy
    //enemy.attackRadius = Math.max(24, Math.floor(playerRange * rangeMultiplier * 1.50));

export function createEnemy(scene, x, y, radius = 20, rangeMultiplier = (gameConfig.enemy && gameConfig.enemy.rangeMultiplier) || 0.6)
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
    enemy.health = (gameConfig.enemy && gameConfig.enemy.baseHealth) || 3;

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
    // aumentar ligeiramente a área de ataque para tornar inimigos mais agressivos
    const extraMul = (gameConfig.enemy && gameConfig.enemy.attackRadiusExtraMultiplier) || 1.5;
    enemy.attackRadius = Math.max(24, Math.floor(playerRange * rangeMultiplier * extraMul));
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

    enemy.fireRate = (gameConfig.enemy && gameConfig.enemy.fireRate) || 800; // ms
    enemy.lastFired = 0;

    // chase properties
    enemy.chaseSpeed = (gameConfig.enemy && gameConfig.enemy.chaseSpeed) || 120;
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

        // ajustar depth com base na proximidade ao player e na quantidade de inimigos
        try {
            if (scene && scene.player && scene.player.sprite)
            {
                const px = scene.player.sprite.x;
                const py = scene.player.sprite.y;
                const d = Phaser.Math.Distance.Between(this.x, this.y, px, py);

                const enemiesCount = (scene.enemies && typeof scene.enemies.getLength === 'function') ? Math.max(1, scene.enemies.getLength()) : 1;
                const worldBounds = (scene.physics && scene.physics.world && scene.physics.world.bounds) ? scene.physics.world.bounds : null;
                const diag = worldBounds ? Math.hypot(worldBounds.width, worldBounds.height) : Math.hypot(scene.scale.width, scene.scale.height);
                const nd = Math.min(1, d / Math.max(1, diag));

                const baseDepth = 100;
                const depthOffset = Math.round((1 - nd) * enemiesCount * 10);
                const newDepth = baseDepth + depthOffset;
                try { this.setDepth(newDepth); } catch (e) { /* ignore */ }

                // ensure selection/follow graphics sit relative to enemy depth
                try { if (this._selectionGraphics) this._selectionGraphics.setDepth(newDepth + 1); } catch (e) { /* ignore */ }
                try { if (this._followGraphics) this._followGraphics.setDepth(newDepth - 1); } catch (e) { /* ignore */ }
            }
        } catch (e) { /* ignore */ }
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
                fireProjectile(scene, this.x, this.y, scene.player.sprite, scene.player.sprite, 'enemy');
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

    // small separation to avoid enemies stacking exactly on top of each other
    // applies a tiny pushing velocity when two enemies are closer than desiredSpacing
    const separationLogic = function () {
        try {
            if (!scene.enemies) return;
            const children = scene.enemies.getChildren ? scene.enemies.getChildren() : [];
            const desiredSpacing = radius * 2 + 10; // target min distance
            for (const other of children) {
                if (!other || other === this) continue;
                const dx = this.x - other.x;
                const dy = this.y - other.y;
                const dist = Math.hypot(dx, dy) || 0.0001;
                if (dist > 0 && dist < desiredSpacing) {
                    const overlap = desiredSpacing - dist;
                    const nx = dx / dist;
                    const ny = dy / dist;
                            const push = Math.min(240, overlap * 12); // cap push
                    try {
                        if (this.body && this.body.setVelocity) {
                            this.body.setVelocity(this.body.velocity.x + nx * push, this.body.velocity.y + ny * push);
                        }
                        if (other.body && other.body.setVelocity) {
                            other.body.setVelocity(other.body.velocity.x - nx * (push * 0.5), other.body.velocity.y - ny * (push * 0.5));
                        }
                    } catch (e) { /* ignore individual body failures */ }
                }
            }
        } catch (e) { /* ignore */ }
    };

    // call separation each frame after update movement
    const _origUpdate = enemy.update;
    enemy.update = function(time) {
        if (typeof _origUpdate === 'function') _origUpdate.call(this, time);
        separationLogic.call(this);
    };

    // custom hit handler to apply damage and flash when hit
    enemy.onHit = function (source, damage = 1)
    {
        const prevHealth = this.health || 1;
        this.health = prevHealth - damage;

        // Exibe o texto de dano animado
        new DamageText(this.scene, this.x, this.y - (this.radius || 20), damage);

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

    // when hit by player's projectile, apply a short slow effect
    // source is the projectile object (may be null)
    const applySlow = function () {
        try {
            // cancel previous slow timer if present
            if (this._slowTimer) {
                try { this._slowTimer.remove(); } catch (e) { /* ignore */ }
                this._slowTimer = null;
            }

            // store original speed once
            if (this._originalChaseSpeed === undefined) this._originalChaseSpeed = this.chaseSpeed;

            // reduce speed by 30%
            this.chaseSpeed = Math.max(20, Math.floor((this._originalChaseSpeed || this.chaseSpeed) * 0.7));

            // restore after 600ms
            const self = this;
            this._slowTimer = this.scene.time.addEvent({ delay: 600, callback: () => {
                try { self.chaseSpeed = self._originalChaseSpeed || self.chaseSpeed; } catch (e) {}
                self._slowTimer = null;
            } });
        } catch (e) { /* ignore */ }
    };

    // wrap existing onHit to also apply slow
    const _origOnHit = enemy.onHit;
    enemy.onHit = function (source, damage) {
        try { if (typeof _origOnHit === 'function') _origOnHit.call(this, source, damage); } catch (e) { /* ignore */ }
        applySlow.call(this);
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
