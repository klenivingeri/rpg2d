import Phaser from 'phaser';
import { fireProjectile } from './Projectile';
import { Debug } from '../Debug';
import { EventBus } from '../EventBus';


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

        this.rangeRadius = 4 * this.width; // regra: 4x largura do player (aumentado)
        this.rangeCircle = scene.add.circle(x, y, this.rangeRadius, 0x0000ff, 0.12);
        this.rangeCircle.setVisible(!!Debug.showAreas);

        // teclas WASD para controle do jogador
        this.keys = scene.input.keyboard.addKeys({
            w: Phaser.Input.Keyboard.KeyCodes.W,
            a: Phaser.Input.Keyboard.KeyCodes.A,
            s: Phaser.Input.Keyboard.KeyCodes.S,
            d: Phaser.Input.Keyboard.KeyCodes.D
        });

        this.targetPoint = null;
        this.selectedEnemy = null; // enemy we're currently targeting/attacking
        this.inAttackPosition = false; // true when reached shooting position and locked
        this.targetEnemy = null; // enemy clicked to move toward

        this.moveSpeed = 220;
        this.fireRate = 500; // ms
        this.lastFired = 0;
        this.controlMode = 'mouse';
            this.autoFireEnabled = false;
            this.autoTargetEnemy = null;

            // fallback: tentar ler preferência salva diretamente do localStorage
            try {
                const v = (typeof localStorage !== 'undefined') ? localStorage.getItem('gi.autoFire') : null;
                if (v !== null) {
                    this.autoFireEnabled = (v === 'true');
                    // debug
                    if (this.scene && this.scene.sys && this.scene.sys.game && this.scene.sys.game.config) {
                        // evita poluir em produção, apenas um console.debug
                        // eslint-disable-next-line no-console
                        console.debug('[Player] loaded autoFire from localStorage =', this.autoFireEnabled);
                    }
                }
            } catch (e) {
                // ignore
            }

        // escuta alteração do modo de controle
        this._onControlMode = (m) => { this.controlMode = m || 'mouse'; };
        EventBus.on('set-control-mode', this._onControlMode);

        // escuta alteração de auto-fire via UI
        this._onAutoFire = (v) => { this.autoFireEnabled = !!v; if (!this.autoFireEnabled) this.autoTargetEnemy = null; };
        EventBus.on('auto-fire-changed', this._onAutoFire);

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

        // Controle por teclas WASD (se qualquer tecla estiver pressionada, tem prioridade)
        let movingByKeys = false;
        let vx = 0, vy = 0;
        if (this.keys) {
            if (this.keys.w && this.keys.w.isDown) { vy -= 1; movingByKeys = true; }
            if (this.keys.s && this.keys.s.isDown) { vy += 1; movingByKeys = true; }
            if (this.keys.a && this.keys.a.isDown) { vx -= 1; movingByKeys = true; }
            if (this.keys.d && this.keys.d.isDown) { vx += 1; movingByKeys = true; }
        }

        if (movingByKeys) {
            const len = Math.sqrt(vx * vx + vy * vy) || 1;
            const ux = vx / len;
            const uy = vy / len;
            if (this.sprite && this.sprite.body && this.sprite.body.setVelocity) {
                this.sprite.body.setVelocity(ux * this.moveSpeed, uy * this.moveSpeed);
            }
            // cancelar movimentos automáticos/locks ao controlar manualmente
            this.targetPoint = null;
            this.targetEnemy = null;
            this.inAttackPosition = false;
            // limpar seleção e evitar autofire enquanto se movimenta com teclas
            if (this.selectedEnemy && this.selectedEnemy.setSelected) {
                this.selectedEnemy.setSelected(false);
            }
            this.selectedEnemy = null;
        } else {
            // quando não há input via teclado e não temos targetPoint, garantir parada
            if (!this.targetPoint) {
                if (this.sprite && this.sprite.body && this.sprite.body.setVelocity) {
                    this.sprite.body.setVelocity(0, 0);
                }
            }
        }

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

        // se modo teclado e o jogador estiver parado, auto-target inimigos dentro do alcance
        const bodySpeed = (this.sprite && this.sprite.body) ? Math.hypot(this.sprite.body.velocity.x || 0, this.sprite.body.velocity.y || 0) : 0;
        const isStopped = bodySpeed < 1 && !movingByKeys && !this.targetPoint;
        // comportamento antigo: em modo teclado fazia auto-target. Agora:
        // - se player estiver parado e autoFireEnabled, escolhe o inimigo MAIS PRÓXIMO dentro do range (não altera seleção visual)
        // - caso contrário, conserva lógica anterior para modo teclado (seleção visual)
        if (isStopped && this.autoFireEnabled) {
            try {
                const enemies = (this.scene && this.scene.enemies) ? this.scene.enemies.getChildren() : [];
                let nearest = null;
                let nearestDist = Infinity;
                for (const e of enemies) {
                    if (e && e.active) {
                        const de = Phaser.Math.Distance.Between(this.sprite.x, this.sprite.y, e.x, e.y);
                        if (de <= this.rangeRadius && de < nearestDist) { nearestDist = de; nearest = e; }
                    }
                }
                if (nearest) {
                    this.autoTargetEnemy = nearest;
                } else {
                    this.autoTargetEnemy = null;
                }
            } catch (e) { /* ignore */ }
        }
        else if (this.controlMode === 'keyboard' && isStopped) {
            // tenta encontrar o primeiro inimigo dentro do range (com seleção visual antiga)
            try {
                const enemies = (this.scene && this.scene.enemies) ? this.scene.enemies.getChildren() : [];
                let found = null;
                for (const e of enemies) {
                    if (e && e.active) {
                        const de = Phaser.Math.Distance.Between(this.sprite.x, this.sprite.y, e.x, e.y);
                        if (de <= this.rangeRadius) { found = e; break; }
                    }
                }
                if (found) {
                    if (this.selectedEnemy && this.selectedEnemy !== found && this.selectedEnemy.setSelected) {
                        this.selectedEnemy.setSelected(false);
                    }
                    this.selectedEnemy = found;
                    if (this.selectedEnemy.setSelected) this.selectedEnemy.setSelected(true);
                    this.inAttackPosition = true;
                } else {
                    if (this.selectedEnemy && this.selectedEnemy.setSelected) {
                        this.selectedEnemy.setSelected(false);
                    }
                    this.selectedEnemy = null;
                    this.inAttackPosition = false;
                }
            } catch (e) { /* ignore */ }
        }

        // autofire: prefira `selectedEnemy` somente se estiver dentro do alcance,
        // caso contrário use `autoTargetEnemy` (o alvo mais próximo quando parado)
        let attackTarget = null;
        if (this.selectedEnemy && this.selectedEnemy.active) {
            const dsel = Phaser.Math.Distance.Between(this.sprite.x, this.sprite.y, this.selectedEnemy.x, this.selectedEnemy.y);
            if (dsel <= this.rangeRadius) attackTarget = this.selectedEnemy;
        }
        if (!attackTarget && this.autoTargetEnemy && this.autoTargetEnemy.active) {
            const dauto = Phaser.Math.Distance.Between(this.sprite.x, this.sprite.y, this.autoTargetEnemy.x, this.autoTargetEnemy.y);
            if (dauto <= this.rangeRadius) attackTarget = this.autoTargetEnemy;
            else this.autoTargetEnemy = null;
        }

        if (attackTarget) {
            if (time > this.lastFired + this.fireRate) {
                this.lastFired = time;
                fireProjectile(this.scene, this.sprite.x, this.sprite.y, attackTarget);
            }
        }
    }

}
