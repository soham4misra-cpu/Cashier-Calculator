import { Scene, GameObjects } from 'phaser';

const ACCENT_ORANGE = 0xf3814a;
const TEXT_DARK = '#241f1a';

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

        // A gradient-style scrim confined to the lower half — clean photo up
        // top, legible dark ground for text and the CTA at the bottom, the
        // same layering as the reference's onboarding screen.
        const scrim = this.add.graphics();
        scrim.fillGradientStyle(0x000000, 0x000000, 0x0b0805, 0x0b0805, 0, 0, 0.82, 0.82);
        scrim.fillRect(0, 320, 1024, 448);

        this.title = this.add.text(512, 430, 'Cashier Calculator', {
            fontFamily: '"Inter", "Segoe UI", sans-serif', fontStyle: '800', fontSize: 50, color: '#ffffff',
            align: 'center'
        }).setOrigin(0.5);
        this.title.setShadow(0, 4, 'rgba(0,0,0,0.35)', 10);

        this.subtitle = this.add.text(512, 494, 'Make the right change for every customer', {
            fontFamily: '"Inter", "Segoe UI", sans-serif', fontSize: 20, color: '#e9e2d8',
            align: 'center'
        }).setOrigin(0.5);

        // A solid rounded pill CTA — the same shape and weight as the
        // reference's bottom "Get Started" button — rather than blinking text.
        const buttonWidth = 420;
        const buttonHeight = 68;
        const buttonY = 668;

        const buttonShadow = this.add.graphics();
        buttonShadow.fillStyle(0x000000, 0.25);
        buttonShadow.fillRoundedRect(512 - buttonWidth / 2 + 2, buttonY - buttonHeight / 2 + 5, buttonWidth, buttonHeight, buttonHeight / 2);

        const buttonBg = this.add.graphics();
        buttonBg.fillStyle(ACCENT_ORANGE, 1);
        buttonBg.fillRoundedRect(512 - buttonWidth / 2, buttonY - buttonHeight / 2, buttonWidth, buttonHeight, buttonHeight / 2);

        const buttonLabel = this.add.text(512, buttonY, 'Tap to Start', {
            fontFamily: '"Inter", "Segoe UI", sans-serif', fontStyle: '700', fontSize: 22, color: TEXT_DARK,
            align: 'center'
        }).setOrigin(0.5);

        const button = this.add.container(0, 0, [buttonShadow, buttonBg, buttonLabel]);

        this.tweens.add({
            targets: button,
            scale: 1.04,
            duration: 750,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        const hitZone = this.add.zone(512, buttonY, buttonWidth, buttonHeight).setInteractive({ useHandCursor: true });

        hitZone.on('pointerdown', () => {

            this.tweens.killTweensOf(button);
            this.tweens.add({ targets: button, scale: 0.94, duration: 80, yoyo: true });
            this.sound.play('sfx-ui-click', { volume: 0.5 });

            this.cameras.main.fadeOut(500, 26, 18, 11);
            this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('CharacterSelect'));

        });
    }
}
