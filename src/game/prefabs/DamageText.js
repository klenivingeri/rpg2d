import Phaser from 'phaser';

export default class DamageText extends Phaser.GameObjects.Text {
  constructor(scene, x, y, damage, style = {}) {
    super(scene, x, y, `${damage}`, {
      fontFamily: 'Arial',
      fontSize: '24px',
      fontStyle: 'bold',
      color: '#fff',
      stroke: '#000',
      strokeThickness: 2,
      align: 'center',
      ...style
    });
    this.setOrigin(0.5);
    scene.add.existing(this);
    this.setDepth(99); // Garante que o texto fique acima dos outros elementos
    this.animate();
  }

  animate() {
    this.setScale(0.7);
    this.scene.tweens.add({
      targets: this,
      y: this.y - 10,
      scale: 1,
      duration: 250,
      ease: 'Back.Out',
      onComplete: () => {
        this.scene.time.delayedCall(400, () => {
          this.scene.tweens.add({
            targets: this,
            alpha: 0,
            duration: 200,
            onComplete: () => this.destroy()
          });
        });
      }
    });
  }
}
