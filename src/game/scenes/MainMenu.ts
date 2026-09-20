import { Scene, GameObjects } from 'phaser';

export class MainMenu extends Scene
{
    background: GameObjects.Image;
    title: GameObjects.Text;
    subtitle: GameObjects.Text;

    constructor ()
    {
        super('MainMenu');
    }

    create ()
    {
        this.background = this.add.image(512, 384, 'shop-bg');
        this.background.setDisplaySize(1024, 768);

        this.add.rectangle(512, 384, 1024, 768, 0x000000, 0.35);

        this.title = this.add.text(512, 320, 'Cashier Calculator', {
            fontFamily: 'Arial Black', fontSize: 54, color: '#ffffff',
            stroke: '#000000', strokeThickness: 8,
            align: 'center'
        }).setOrigin(0.5);

        this.subtitle = this.add.text(512, 420, 'Make the right change for every customer!', {
            fontFamily: '"Cormorant Garamond", serif', fontSize: 28, color: '#ffffff',
            stroke: '#000000', strokeThickness: 4,
            align: 'center'
        }).setOrigin(0.5);

        const start = this.add.text(512, 500, 'Click to Start', {
            fontFamily: 'Arial Black', fontSize: 30, color: '#ffe066',
            stroke: '#000000', strokeThickness: 6,
            align: 'center'
        }).setOrigin(0.5);

        this.tweens.add({
            targets: start,
            alpha: 0.4,
            duration: 650,
            yoyo: true,
            repeat: -1
        });

        this.input.once('pointerdown', () => {

            this.scene.start('Game');

        });
    }
}
