import Phaser from 'phaser';

export default class Joystick {
    constructor(scene, opts = {}) {
        this.scene = scene;
        this.enabled = !!opts.enabled;

        this.baseRadius = opts.baseRadius || 70;
        this.thumbRadius = opts.thumbRadius || 32;
        this.maxDistance = this.baseRadius - this.thumbRadius * 0.5;
        this.alpha = (typeof opts.alpha !== 'undefined') ? opts.alpha : 0.35;

        this._pointerId = null;
        this._inputVector = { x: 0, y: 0 };
        this.isActive = false; // whether user is currently touching the joystick

        // create visual elements (fixed to camera)
        const w = this.scene.scale.width;
        const h = this.scene.scale.height;
        this.baseX = Math.floor(w / 2);
        this.baseY = Math.floor(h * 0.8);

        this.base = this.scene.add.circle(this.baseX, this.baseY, this.baseRadius, 0x222222, this.alpha);
        this.thumb = this.scene.add.circle(this.baseX, this.baseY, this.thumbRadius, 0x666666, this.alpha + 0.15);
        this.base.setScrollFactor(0);
        this.thumb.setScrollFactor(0);
        this.base.setDepth(1000);
        this.thumb.setDepth(1001);

        // initially hide; show only when enabled
        this.setVisible(this.enabled);

        // input listeners
        this._onDown = this._onDown.bind(this);
        this._onMove = this._onMove.bind(this);
        this._onUp = this._onUp.bind(this);

        this.scene.input.on('pointerdown', this._onDown);
        this.scene.input.on('pointermove', this._onMove);
        this.scene.input.on('pointerup', this._onUp);

        // reposition on resize
        this._onResize = this._onResize.bind(this);
        this.scene.scale.on('resize', this._onResize);
    }

    destroy() {
        try { this.scene.input.off('pointerdown', this._onDown); } catch (e) {}
        try { this.scene.input.off('pointermove', this._onMove); } catch (e) {}
        try { this.scene.input.off('pointerup', this._onUp); } catch (e) {}
        try { this.scene.scale.off('resize', this._onResize); } catch (e) {}
        try { this.base.destroy(); this.thumb.destroy(); } catch (e) {}
    }

    setVisible(v) {
        this.base.setVisible(!!v);
        this.thumb.setVisible(!!v);
    }

    enable() { this.enabled = true; this.setVisible(true); }
    disable() { this.enabled = false; this.setVisible(false); this._reset(); }

    _onResize(gameSize) {
        const w = gameSize.width || this.scene.scale.width;
        const h = gameSize.height || this.scene.scale.height;
        this.baseX = Math.floor(w / 2);
        this.baseY = Math.floor(h * 0.8);
        this.base.setPosition(this.baseX, this.baseY);
        this.thumb.setPosition(this.baseX, this.baseY);
    }

    _onDown(pointer) {
        if (!this.enabled) return;

        // accept touches that either start within the joystick base circle
        // or anywhere in the bottom 20% of the screen
        const h = this.scene.scale.height;
        const px = pointer.x;
        const py = pointer.y;
        const dx = px - this.base.x;
        const dy = py - this.base.y;
        const d = Math.hypot(dx, dy);
        if (d > this.baseRadius && py < Math.floor(h * 0.8)) return;

        // also ignore right-click mouse
        if (pointer.rightButtonDown && pointer.rightButtonDown()) return;

        // If the original DOM target is not the game canvas (e.g. a React UI button on top), ignore to avoid conflicts
        try {
            if (pointer.event && pointer.event.target && pointer.event.target !== this.scene.game.canvas) {
                return;
            }
        } catch (e) { /* ignore */ }

        // claim this pointer
        this._pointerId = pointer.id;
        this.isActive = true;

        // ensure joystick is visible and centered horizontally at bottom 20%
        this.base.setPosition(this.baseX, this.baseY);
        this.thumb.setPosition(this.baseX, this.baseY);
        this._inputVector.x = 0; this._inputVector.y = 0;
    }

    _onMove(pointer) {
        if (!this.enabled) return;
        if (!this.isActive) return;
        if (this._pointerId !== pointer.id) return;

        const px = pointer.x;
        const py = pointer.y;

        let dx = px - this.base.x;
        let dy = py - this.base.y;
        const dist = Math.hypot(dx, dy);
        const max = this.maxDistance;

        let nx = 0, ny = 0, ratio = 0;
        if (dist > 0) {
            ratio = Math.min(1, dist / max);
            nx = dx / dist;
            ny = dy / dist;
        }

        const thumbDist = Math.min(dist, max);
        const tx = this.base.x + nx * thumbDist;
        const ty = this.base.y + ny * thumbDist;

        this.thumb.setPosition(tx, ty);

        this._inputVector.x = nx * ratio;
        this._inputVector.y = ny * ratio;
    }

    _onUp(pointer) {
        if (!this.enabled) return;
        if (!this.isActive) return;
        if (this._pointerId !== pointer.id) return;

        this._reset();
    }

    _reset() {
        this._pointerId = null;
        this.isActive = false;
        this._inputVector.x = 0;
        this._inputVector.y = 0;
        this.thumb.setPosition(this.base.x, this.base.y);
    }

    // returns object { x, y } normalized in range [-1..1]
    getInput() { return { x: this._inputVector.x, y: this._inputVector.y }; }

}
