
import Phaser from 'phaser';
import { fireProjectile } from './Projectile';
import { Debug } from '../Debug';
import { EventBus } from '../EventBus';
import HealthBar from './HealthBar';
import gameConfig from '../gameConfig';

export default class Player
{
    constructor(scene, x, y)
    {
        this.scene = scene;
        this.width = gameConfig.player.width; // diameter
        this.height = gameConfig.player.width; // keep square for circle sprite

        // vida do player
        this.maxHealth = gameConfig.player.maxHealth;
        this.health = this.maxHealth;

        // fator de escala (pode ser configurado em gameConfig.player.scale)
        const scale = (gameConfig.player && gameConfig.player.scale) ? gameConfig.player.scale : 1.5;
        const scaledRadius = (this.width / 2) * scale;
        // barra de vida (posicionada acima do sprite considerando a escala)
        this.healthBar = new HealthBar(scene, x, y - scaledRadius - 12, 40, 6, this.maxHealth);

        // criar sprite do player usando frames carregados pelo Preloader
        const firstFrameKey = 'player_run_0';
        this.sprite = scene.add.sprite(x, y, firstFrameKey);
        scene.physics.add.existing(this.sprite);
        // ajustar tamanho do sprite para o tamanho configurado (mantém pixel art preferência)
        if (this.sprite.setDisplaySize) {
            this.sprite.setDisplaySize(this.width * scale, this.height * scale);
        } else if (this.sprite.setScale) {
            this.sprite.setScale(scale);
        }
        // converter corpo para circular quando possível (usar raio escalado)
        if (this.sprite.body && this.sprite.body.setCircle)
        {
            // setCircle(radius, offsetX, offsetY) para centralizar corretamente o corpo em sprites
            try {
                const dw = this.sprite.displayWidth || (this.width * scale);
                const dh = this.sprite.displayHeight || (this.height * scale);
            
                const collisionRadius = Math.max(4, Math.floor(scaledRadius * 0.24));
                const offsetX = Math.max(0, Math.round((dw / 2) - collisionRadius));
                const offsetY = Math.max(0, Math.round((dh / 2) - collisionRadius));
                
                const visualShiftLeft = -16; // pixels
                const visualShiftTop = -8; // pixels (negative moves up)
                const offsetXAdj = offsetX + visualShiftLeft;
                const offsetYAdj = offsetY + visualShiftTop;
                // alguns builds do Phaser aceitam 3 argumentos, outros usam setOffset separadamente
                if (this.sprite.body.setCircle.length >= 3) {
                    this.sprite.body.setCircle(collisionRadius, offsetXAdj, offsetYAdj);
                } else {
                    this.sprite.body.setCircle(collisionRadius);
                    if (typeof this.sprite.body.setOffset === 'function') this.sprite.body.setOffset(offsetXAdj, offsetYAdj);
                }
                // armazenar radius e offsets para uso posterior (debug/fallback)
                this._collisionRadius = collisionRadius;
                this._collisionOffsetX = offsetXAdj;
                this._collisionOffsetY = offsetYAdj;
                this._collisionVisualShiftX = visualShiftLeft;
                this._collisionVisualShiftY = visualShiftTop;
            } catch (e) {
                try { this.sprite.body.setCircle(Math.max(4, Math.floor(scaledRadius * 0.3)), Math.round(Math.max(0, (this.sprite.displayWidth || (this.width * scale)) / 2 - Math.max(4, Math.floor(scaledRadius * 0.3))) - 50), Math.round(Math.max(0, (this.sprite.displayHeight || (this.height * scale)) / 2 - Math.max(4, Math.floor(scaledRadius * 0.3))) - 10)); } catch (e2) { /* ignore */ }
            }
        }
        this.sprite.body.setCollideWorldBounds(true);

        // criar gráfico de colisão (desenharemos usando as métricas reais do corpo físico)
        try {
            this._collisionGraphics = scene.add.graphics();
            this._collisionGraphics.lineStyle(2, 0x00ff00, 0.9);
            this._collisionGraphics.setDepth(100000);
            this._collisionGraphics.setVisible(!!Debug.showAreas);
        } catch (e) { /* ignore */ }

        // criar animações do player (run, idle, ...) a partir de `gameConfig`
        try {
            const animCfg = gameConfig && gameConfig.player && gameConfig.player.animation;
            if (animCfg && typeof animCfg === 'object') {
                Object.keys(animCfg).forEach((animName) => {
                    const framesArr = animCfg[animName];
                    if (!Array.isArray(framesArr)) return;
                    const animKey = `player_${animName}_anim`;
                    if (!scene.anims.exists(animKey)) {
                        const frames = framesArr.map((f, idx) => ({ key: `player_${animName}_${idx}` }));
                        const duration = (framesArr[0] && framesArr[0].duration) || 100;
                        const frameRate = Math.max(1, Math.round(1000 / duration));
                        scene.anims.create({ key: animKey, frames, frameRate, repeat: -1 });
                    }
                });
            }
            // começar com idle se existir, senão run
            const startKey = scene.anims.exists('player_idle_anim') ? 'player_idle_anim' : (scene.anims.exists('player_run_anim') ? 'player_run_anim' : null);
            if (startKey && this.sprite.play) this.sprite.play(startKey);
        } catch (e) {
            // silent
        }

        this.rangeRadius = (gameConfig.player.rangeMultiplier || 4) * this.width; // regra: multiplier * largura do player
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

        this.moveSpeed = gameConfig.player.moveSpeed;
        this.fireRate = gameConfig.player.fireRate; // ms
        this.lastFired = 0;
        this.controlMode = 'mouse';
            this.autoFireEnabled = false;
            this.autoTargetEnemy = null;
        // track last horizontal flip state
        this._facingLeft = false;

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
        this.onHit = (source, damage = 1) => {
            this.health = Math.max(0, (this.health || 0) - (damage || 1));
            this.healthBar.updateHealth(this.health);

            // feedback visual rápido: usar tint para o sprite
            if (this.sprite && this.sprite.setTint) {
                this.sprite.setTint(0xff6666);
                this.scene.time.addEvent({ delay: 120, callback: () => { if (this.sprite && this.sprite.clearTint) this.sprite.clearTint(); } });
            }

            if (this.health <= 0) {
                // destruir sprite e notificar cena (morte)
                if (this.sprite && this.sprite.destroy) {
                    this.sprite.destroy();
                }
                if (this.healthBar && this.healthBar.destroy) {
                    this.healthBar.destroy();
                }
                if (this.scene && typeof this.scene.changeScene === 'function') {
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

    update(time) {
        // manter posição com precisão em ponto flutuante (não arredondar)
        // atualizar visual do range
        this.rangeCircle.setPosition(this.sprite.x, this.sprite.y);
        this.rangeCircle.setVisible(!!Debug.showAreas);
        // atualizar borda de colisão do player usando o corpo físico para refletir colisões reais
        if (this._collisionGraphics) {
            try {
                if (Debug.showAreas && this.sprite && this.sprite.body) {
                    const b = this.sprite.body;
                    // preferir propriedades de centro quando disponíveis
                    const centerX = (b.center && typeof b.center.x === 'number') ? b.center.x : ((typeof b.x !== 'undefined') ? (b.x + (b.width || 0) * 0.5) : this.sprite.x);
                    const centerY = (b.center && typeof b.center.y === 'number') ? b.center.y : ((typeof b.y !== 'undefined') ? (b.y + (b.height || 0) * 0.5) : this.sprite.y);
                    // usar o width do corpo como diâmetro (setCircle faz width = diameter)
                    const radius = Math.max(1, Math.round((b.width || 0) * 0.5));
                    this._collisionGraphics.clear();
                    this._collisionGraphics.lineStyle(2, 0x00ff00, 0.9);
                    this._collisionGraphics.strokeCircle(centerX, centerY, radius);
                    this._collisionGraphics.setVisible(true);
                } else {
                    try { this._collisionGraphics.clear(); } catch (e) { /* ignore */ }
                    this._collisionGraphics.setVisible(false);
                }
            } catch (e) { /* ignore */ }
        }
        // atualizar barra de vida
        if (this.healthBar) {
            this.healthBar.follow(this.sprite.x, this.sprite.y - (this.width / 2) - 12);
            this.healthBar.updateHealth(this.health);
        }

        // Controle por joystick (mobile) ou teclas WASD (teclado tem prioridade sobre joystick)
        let movingByKeys = false;
        let vx = 0, vy = 0;

        // joystick input if present
        try {
            const joystick = (this.scene && this.scene.joystick) ? this.scene.joystick : null;
            if (joystick && joystick.enabled && joystick.isActive) {
                const inp = joystick.getInput();
                vx = inp.x;
                vy = inp.y;
                movingByKeys = true; // treat joystick as manual input to take priority over auto movement
            }
        } catch (e) { /* ignore */ }

        if (!movingByKeys && this.keys) {
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
            // limpar seleção e evitar autofire enquanto se movimenta
            if (this.selectedEnemy && this.selectedEnemy.setSelected) {
                this.selectedEnemy.setSelected(false);
            }
            this.selectedEnemy = null;
        } else {
            // quando não há input via teclado/joystick e não temos targetPoint, garantir parada
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

        // alternar animação: 'idle' quando parado, 'run' caso contrário
        try {
            const desiredAnim = isStopped ? 'idle' : 'run';
            const animKey = `player_${desiredAnim}_anim`;
            const cur = (this.sprite && this.sprite.anims && this.sprite.anims.currentAnim) ? this.sprite.anims.currentAnim.key : null;
            if (cur !== animKey) {
                if (this.scene && this.scene.anims && this.scene.anims.exists(animKey)) {
                    this.sprite.play(animKey);
                } else {
                    const fallback = (this.scene && this.scene.anims && this.scene.anims.exists('player_run_anim')) ? 'player_run_anim' : null;
                    if (fallback) this.sprite.play(fallback);
                }
            }
        } catch (e) { /* ignore */ }
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
                fireProjectile(this.scene, this.sprite.x, this.sprite.y, attackTarget, undefined, 'player');
            }
        }

        // virar sprite horizontalmente: mantém a direção do último movimento
        // e só altera para mirar quando estiver atirando (attackTarget tem prioridade)
        try {
            const thresh = 0.1;
            let newFacingLeft = this._facingLeft;

            if (attackTarget && attackTarget.active) {
                const dx = (attackTarget.x || 0) - this.sprite.x;
                if (dx < -thresh) newFacingLeft = true;
                else if (dx > thresh) newFacingLeft = false;
                // se dx estiver muito pequeno, mantém o facing atual
            } else {
                // quando não mirando, basear no movimento: velocity.x tem prioridade
                const velX = (this.sprite && this.sprite.body) ? (this.sprite.body.velocity.x || 0) : 0;
                if (Math.abs(velX) > thresh) {
                    newFacingLeft = velX < 0;
                }
                // se não estiver se movendo, não alteramos newFacingLeft
            }

            if (newFacingLeft !== this._facingLeft) {
                this._facingLeft = newFacingLeft;
                if (this.sprite && typeof this.sprite.setFlipX === 'function') {
                    this.sprite.setFlipX(newFacingLeft);
                } else if (this.sprite) {
                    this.sprite.flipX = newFacingLeft;
                }
            }
        } catch (e) { /* ignore */ }
    }

    destroy()
    {
        try { EventBus.removeListener('set-control-mode', this._onControlMode); } catch (e) { /* ignore */ }
        try { EventBus.removeListener('auto-fire-changed', this._onAutoFire); } catch (e) { /* ignore */ }

        try { if (this.rangeCircle && this.rangeCircle.destroy) this.rangeCircle.destroy(); } catch (e) { /* ignore */ }
        try { if (this.healthBar && this.healthBar.destroy) this.healthBar.destroy(); } catch (e) { /* ignore */ }
        try { if (this.sprite && this.sprite.destroy) this.sprite.destroy(); } catch (e) { /* ignore */ }
        try { if (this._collisionGraphics && this._collisionGraphics.destroy) this._collisionGraphics.destroy(); } catch (e) { /* ignore */ }

        try {
            const kb = (this.scene && this.scene.input && this.scene.input.keyboard) ? this.scene.input.keyboard : null;
            if (kb && this.keys) {
                if (this.keys.w) kb.removeKey(this.keys.w);
                if (this.keys.a) kb.removeKey(this.keys.a);
                if (this.keys.s) kb.removeKey(this.keys.s);
                if (this.keys.d) kb.removeKey(this.keys.d);
            }
        } catch (e) { /* ignore */ }

        // clear references to help GC
        this.scene = null;
        this.sprite = null;
        this.healthBar = null;
        this.rangeCircle = null;
        this.keys = null;
        this.selectedEnemy = null;
        this.targetEnemy = null;
        this.autoTargetEnemy = null;
        this._onControlMode = null;
        this._onAutoFire = null;
    }

}
