import Phaser from 'phaser';
import { Debug } from '../Debug';

export default class Joystick {
    constructor(scene, opts = {}) {
        this.scene = scene;
        console.log('[Joystick] constructor', { sceneKey: scene && scene.scene ? scene.scene.key : (scene && scene.key), opts });
        this.enabled = !!opts.enabled;

        this.baseRadius = opts.baseRadius || 70;
        this.thumbRadius = opts.thumbRadius || 32;
        this.maxDistance = this.baseRadius - this.thumbRadius * 0.5;
        this.alpha = (typeof opts.alpha !== 'undefined') ? opts.alpha : 0.35;
        this.deadzoneRadius = (typeof opts.deadzoneRadius !== 'undefined') ? opts.deadzoneRadius : Math.floor(this.thumbRadius * 0.4);

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

        // border graphics for active press (white) - sits above base and below thumb
        this._baseBorder = this.scene.add.graphics();
        this._baseBorder.setScrollFactor(0);
        this._baseBorder.setDepth(1001);

        this.thumb.setDepth(1002);

        // debug graphics for showing deadzone border
        this._debugGraphics = this.scene.add.graphics();
        this._debugGraphics.setScrollFactor(0);
        this._debugGraphics.setDepth(1003);

        // initially hide; show only when enabled
        this.setVisible(this.enabled);
        // ensure border is drawn immediately on creation
        this._updateBaseBorder();

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
        console.log('[Joystick] destroy');
        try { this.scene.input.off('pointerdown', this._onDown); } catch (e) {}
        try { this.scene.input.off('pointermove', this._onMove); } catch (e) {}
        try { this.scene.input.off('pointerup', this._onUp); } catch (e) {}
        try { this.scene.scale.off('resize', this._onResize); } catch (e) {}
        try { this.base.destroy(); this.thumb.destroy(); } catch (e) {}
        try { this._baseBorder.destroy(); } catch (e) {}
        try { this._debugGraphics.destroy(); } catch (e) {}
    }

    setVisible(v) {
        console.log('[Joystick] setVisible', !!v);
        this.base.setVisible(!!v);
        this.thumb.setVisible(!!v);
        this._updateBaseBorder();
    }

    enable() { this.enabled = true; this.setVisible(true); }
    disable() { console.log('[Joystick] disable'); this.enabled = false; this.setVisible(false); this._reset(); }

    _onResize(gameSize) {
        const w = gameSize.width || this.scene.scale.width;
        const h = gameSize.height || this.scene.scale.height;
        this.baseX = Math.floor(w / 2);
        this.baseY = Math.floor(h * 0.8);
        this.base.setPosition(this.baseX, this.baseY);
        this.thumb.setPosition(this.baseX, this.baseY);
        this._redrawDebug();
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
        this._redrawDebug();
        this._updateBaseBorder();
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
        this._redrawDebug();
        this._updateBaseBorder();
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
        this._redrawDebug();
        this._updateBaseBorder();
    }

    _redrawDebug() {
        try {
            this._debugGraphics.clear();
            if (!Debug.showAreas) return;
            if (!this.base.visible) return;
            // draw deadzone border
            this._debugGraphics.lineStyle(2, 0xffff00, 1);
            this._debugGraphics.strokeCircle(this.base.x, this.base.y, this.deadzoneRadius);
        } catch (e) { /* ignore */ }
    }

    _updateBaseBorder() {
        try {
            this._baseBorder.clear();
            if (!this.base.visible) return;
            // draw white border around base circle; semi-transparent when inactive
            const alpha = this.isActive ? 1 : 0.5;
            this._baseBorder.lineStyle(3, 0xffffff, alpha);
            this._baseBorder.strokeCircle(this.base.x, this.base.y, this.baseRadius);
        } catch (e) { /* ignore */ }
    }

    // returns object { x, y } normalized in range [-1..1]
    getInput() { return { x: this._inputVector.x, y: this._inputVector.y }; }

}
