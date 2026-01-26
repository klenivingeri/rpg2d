import Phaser from 'phaser';
import { fireProjectile } from './Projectile';
import { Debug } from '../Debug';

export default class Player
{
    constructor(scene, x, y)
    {
        this.scene = scene;
        this.width = 32; // diameter
        this.height = 32; // keep square for circle sprite

        // vida do player
        this.health = 3;

        const radius = this.width / 2;
        this.sprite = scene.add.circle(x, y, radius, 0x3366ff);
        scene.physics.add.existing(this.sprite);
        // convert Arcade body to circular shape
        if (this.sprite.body && this.sprite.body.setCircle)
        {
            this.sprite.body.setCircle(radius);
        }
        this.sprite.body.setCollideWorldBounds(true);

        this.rangeRadius = 3 * this.width; // regra: 3x largura do player
        this.rangeCircle = scene.add.circle(x, y, this.rangeRadius, 0x0000ff, 0.12);
        this.rangeCircle.setVisible(!!Debug.showAreas);

        this.targetPoint = null;
        this.selectedEnemy = null; // enemy we're currently targeting/attacking
        this.inAttackPosition = false; // true when reached shooting position and locked
        this.targetEnemy = null; // enemy clicked to move toward

        this.moveSpeed = 220;
        this.fireRate = 500; // ms
        this.lastFired = 0;

        // handler para quando o player for atingido por um projétil
        this.onHit = (source) =>
        {
            this.health = (this.health || 0) - 1;

            // feedback visual rápido
            if (this.sprite && this.sprite.setFillStyle)
            {
                this.sprite.setFillStyle(0xff6666);
                this.scene.time.addEvent({ delay: 120, callback: () => { if (this.sprite && this.sprite.setFillStyle) this.sprite.setFillStyle(0x3366ff); } });
            }

            if (this.health <= 0)
            {
                // destruir sprite e notificar cena (morte)
                if (this.sprite && this.sprite.destroy)
                {
                    this.sprite.destroy();
                }
                if (this.scene && typeof this.scene.changeScene === 'function')
                {
                    this.scene.changeScene();
                }
            }
        };
    }

    moveTo(point)
    {
        this.targetPoint = point;
        this.scene.physics.moveTo(this.sprite, point.x, point.y, this.moveSpeed);
    }

    moveToEnemy(enemy, approachOffset = 0)
    {
        if (!enemy || !enemy.active) return;
        this.targetEnemy = enemy;
        this.inAttackPosition = false;

        // compute destination point at distance = rangeRadius - approachOffset from enemy
        const ex = enemy.x;
        const ey = enemy.y;
        const px = this.sprite.x;
        const py = this.sprite.y;
        let dx = px - ex;
        let dy = py - ey;
        let len = Math.sqrt(dx * dx + dy * dy);
        // subtract offset so we can aim slightly closer if needed
        const desiredDist = Math.max(this.rangeRadius - approachOffset, 0);

        if (len === 0)
        {
            // if overlapping, pick an arbitrary direction (right)
            dx = 1; dy = 0; len = 1;
        }

        const ux = dx / len;
        const uy = dy / len;

        const destX = ex + ux * desiredDist;
        const destY = ey + uy * desiredDist;

        this.moveTo({ x: destX, y: destY });
    }

    stop()
    {
        if (this.sprite && this.sprite.body)
        {
            this.sprite.body.setVelocity(0, 0);
        }
        this.targetPoint = null;
    }

    update(time)
    {
        // atualizar visual do range
        this.rangeCircle.setPosition(this.sprite.x, this.sprite.y);
        this.rangeCircle.setVisible(!!Debug.showAreas);

        // chegada ao targetPoint
        if (this.targetPoint)
        {
            const d = Phaser.Math.Distance.Between(this.sprite.x, this.sprite.y, this.targetPoint.x, this.targetPoint.y);
            if (d < 5)
            {
                this.stop();

                // if we were moving to attack an enemy, check if we should enter attack position
                if (this.targetEnemy && this.targetEnemy.active)
                {
                    const de = Phaser.Math.Distance.Between(this.sprite.x, this.sprite.y, this.targetEnemy.x, this.targetEnemy.y);
                    if (de <= this.rangeRadius + 2)
                    {
                        this.inAttackPosition = true;
                        // update selection visuals: clear previous, set new
                        if (this.selectedEnemy && this.selectedEnemy !== this.targetEnemy && this.selectedEnemy.setSelected)
                        {
                            this.selectedEnemy.setSelected(false);
                        }

                        if (this.targetEnemy && this.targetEnemy.setSelected)
                        {
                            this.targetEnemy.setSelected(true);
                        }

                        this.selectedEnemy = this.targetEnemy;
                        // lock targetPoint so we don't re-evaluate movement
                        this.targetPoint = null;
                    }
                    else
                    {
                        // if not within range, keep selectedEnemy and try to get a bit closer
                        if (this.selectedEnemy && this.selectedEnemy !== this.targetEnemy && this.selectedEnemy.setSelected)
                        {
                            this.selectedEnemy.setSelected(false);
                        }

                        if (this.targetEnemy && this.targetEnemy.setSelected)
                        {
                            this.targetEnemy.setSelected(true);
                        }

                        this.selectedEnemy = this.targetEnemy;
                        // attempt a closer approach (small offset) to guarantee entering range
                        this.moveToEnemy(this.targetEnemy, 8);
                    }
                }
            }
        }

        // autofire
        if (this.selectedEnemy && this.selectedEnemy.active)
        {
            const d = Phaser.Math.Distance.Between(this.sprite.x, this.sprite.y, this.selectedEnemy.x, this.selectedEnemy.y);
            if (d <= this.rangeRadius)
            {
                if (time > this.lastFired + this.fireRate)
                {
                    this.lastFired = time;
                    fireProjectile(this.scene, this.sprite.x, this.sprite.y, this.selectedEnemy);
                }
            }
        }
    }

}
