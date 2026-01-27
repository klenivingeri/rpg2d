import Phaser from 'phaser';

export default class HealthBar extends Phaser.GameObjects.Container {
  constructor(scene, x, y, width = 40, height = 6, maxHealth = 3) {
    super(scene, x, y);
    this.maxHealth = maxHealth;
    this.width = width;
    this.height = height;
    this.bg = scene.add.rectangle(0, 0, width, height, 0x222222, 0.7).setOrigin(0.5);
    // borda branca 2px
    this.border = scene.add.rectangle(0, 0, width + 4, height + 4)
      .setOrigin(0.5)
      .setStrokeStyle(2, 0xffffff, 1);
    this.bar = scene.add.rectangle(0, 0, width, height, 0x44ff44, 1).setOrigin(0.5);
    this.add(this.border);
    this.add(this.bg);
    this.add(this.bar);
    this.setDepth(98);
    scene.add.existing(this);
    this.setVisible(false);
  }

  updateHealth(current) {
    const pct = Phaser.Math.Clamp(current / this.maxHealth, 0, 1);
    this.bar.width = this.width * pct;
    this.bar.setFillStyle(pct > 0.5 ? 0x44ff44 : pct > 0.25 ? 0xffcc00 : 0xff4444);
    this.setVisible(current < this.maxHealth);
  }

  follow(x, y) {
    this.setPosition(x, y);
  }
}
