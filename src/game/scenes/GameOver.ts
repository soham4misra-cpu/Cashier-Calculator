import { Scene } from 'phaser';

export class GameOver extends Scene
{
    camera: Phaser.Cameras.Scene2D.Camera;
    background: Phaser.GameObjects.Image;
    gameover_text : Phaser.GameObjects.Text;
    served = 0;

    constructor ()
    {
        super('GameOver');
    }

    init (data: { served?: number })
    {
        this.served = data.served ?? 0;
    }

    create ()
    {
        this.camera = this.cameras.main

        this.background = this.add.image(512, 384, 'shop-bg');
        this.background.setDisplaySize(1024, 768);

        this.add.rectangle(512, 384, 1024, 768, 0x000000, 0.45);

        this.gameover_text = this.add.text(512, 290, 'Game Over', {
            fontFamily: 'Arial Black', fontSize: 64, color: '#ffffff',
            stroke: '#000000', strokeThickness: 8,
            align: 'center'
        });
        this.gameover_text.setOrigin(0.5);

        this.add.text(512, 375, `Out of lives — you served ${this.served} ${this.served === 1 ? 'customer' : 'customers'}`, {
            fontFamily: '"Cormorant Garamond", serif', fontSize: 30, color: '#ffffff',
            stroke: '#000000', strokeThickness: 4,
            align: 'center'
        }).setOrigin(0.5);

        this.createButton(392, 470, 'Play Again', 0x35b56a, () => this.scene.start('Game'));
        this.createButton(632, 470, 'Main Menu', 0xc9701a, () => this.scene.start('MainMenu'));
    }

    private createButton (x: number, y: number, label: string, accent: number, onClick: () => void): void
    {
        const width = 200;
        const height = 58;

        const shadow = this.add.graphics();
        shadow.fillStyle(0x000000, 0.25);
        shadow.fillRoundedRect(-width / 2 + 3, -height / 2 + 5, width, height, 16);

        const bg = this.add.graphics();
        bg.fillStyle(0xfaf3e6, 0.98);
        bg.fillRoundedRect(-width / 2, -height / 2, width, height, 16);
        bg.lineStyle(3, accent, 1);
        bg.strokeRoundedRect(-width / 2, -height / 2, width, height, 16);

        const text = this.add.text(0, 0, label, {
            fontFamily: 'Arial Black', fontSize: 22, color: '#3a2f26'
        }).setOrigin(0.5);

        const hitZone = this.add.zone(0, 0, width, height);
        hitZone.setInteractive({ useHandCursor: true });
        hitZone.once('pointerdown', onClick);

        this.add.container(x, y, [shadow, bg, text, hitZone]);
    }
}
