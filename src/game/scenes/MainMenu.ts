import { Scene, GameObjects } from 'phaser';
import { playSfx } from '../audio';
import { applyAnimationSpeed } from '../settings';
import { scaledFontSize } from '../ui/text';

const ACCENT_ORANGE = 0xf3814a;
const TEXT_DARK = '#241f1a';
const TEXT_MUTED = '#8a7f70';
const CARD_COLOR = 0xf3ede2;

export class MainMenu extends Scene
{
    background: GameObjects.Image;
    title: GameObjects.Text;
    subtitle: GameObjects.Text;
    private starting = false;

    constructor ()
    {
        super('MainMenu');
    }

    create ()
    {
        applyAnimationSpeed(this);
        this.starting = false;

        this.background = this.add.image(512, 384, 'shop-bg');
        this.background.setDisplaySize(1024, 768);

        // A gradient-style scrim confined to the lower half — clean photo up
        // top, legible dark ground for text and the CTA at the bottom, the
        // same layering as the reference's onboarding screen.
        const scrim = this.add.graphics();
        scrim.fillGradientStyle(0x000000, 0x000000, 0x0b0805, 0x0b0805, 0, 0, 0.82, 0.82);
        scrim.fillRect(0, 320, 1024, 448);

        this.title = this.add.text(512, 430, 'Cashier Calculator', {
            fontFamily: '"Inter", "Segoe UI", sans-serif', fontStyle: '800', fontSize: scaledFontSize(50, this.registry), color: '#ffffff',
            align: 'center'
        }).setOrigin(0.5);
        this.title.setShadow(0, 4, 'rgba(0,0,0,0.35)', 10);

        this.subtitle = this.add.text(512, 494, 'Make the right change for every customer', {
            fontFamily: '"Inter", "Segoe UI", sans-serif', fontSize: scaledFontSize(20, this.registry), color: '#e9e2d8',
            align: 'center'
        }).setOrigin(0.5);

        // A solid rounded pill CTA — the same shape and weight as the
        // reference's bottom "Get Started" button — rather than blinking text.
        const buttonWidth = 420;
        const buttonHeight = 68;
        const buttonY = 630;

        // Drawn around the container's own origin (not in screen space) so
        // the idle pulse scales the button in place instead of drifting it
        // away from the top-left corner of the screen.
        const buttonShadow = this.add.graphics();
        buttonShadow.fillStyle(0x000000, 0.25);
        buttonShadow.fillRoundedRect(-buttonWidth / 2 + 2, -buttonHeight / 2 + 5, buttonWidth, buttonHeight, buttonHeight / 2);

        const buttonBg = this.add.graphics();
        buttonBg.fillStyle(ACCENT_ORANGE, 1);
        buttonBg.fillRoundedRect(-buttonWidth / 2, -buttonHeight / 2, buttonWidth, buttonHeight, buttonHeight / 2);

        const buttonLabel = this.add.text(0, 0, 'Tap to Start', {
            fontFamily: '"Inter", "Segoe UI", sans-serif', fontStyle: '700', fontSize: scaledFontSize(22, this.registry), color: TEXT_DARK,
            align: 'center'
        }).setOrigin(0.5);

        const button = this.add.container(512, buttonY, [buttonShadow, buttonBg, buttonLabel]);

        this.tweens.add({
            targets: button,
            scale: 1.02,
            duration: 750,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        const hitZone = this.add.zone(512, buttonY, buttonWidth, buttonHeight).setInteractive({ useHandCursor: true });

        hitZone.on('pointerdown', () => {
            // One press only — repeat clicks during the fade would each
            // queue another scene start.
            hitZone.disableInteractive();
            this.starting = true;

            this.tweens.killTweensOf(button);
            this.tweens.add({ targets: button, scale: 0.94, duration: 80, yoyo: true });
            playSfx(this, 'sfx-ui-click', { volume: 0.5 });

            this.cameras.main.fadeOut(500, 26, 18, 11);
            this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('CharacterSelect'));

        });

        this.createSettingsButton(512, buttonY + 90);
    }

    private createSettingsButton (x: number, y: number): void
    {
        const width = 180;
        const height = 44;
        const radius = height / 2;

        const shadow = this.add.graphics();
        shadow.fillStyle(0x000000, 0.2);
        shadow.fillRoundedRect(-width / 2 + 2, -height / 2 + 4, width, height, radius);

        const bg = this.add.graphics();
        bg.fillStyle(CARD_COLOR, 0.92);
        bg.fillRoundedRect(-width / 2, -height / 2, width, height, radius);

        const label = this.add.text(0, 0, 'Settings', {
            fontFamily: '"Inter", "Segoe UI", sans-serif', fontStyle: '700', fontSize: scaledFontSize(17, this.registry), color: TEXT_MUTED,
            align: 'center'
        }).setOrigin(0.5);

        const container = this.add.container(x, y, [shadow, bg, label]);

        const hitZone = this.add.zone(0, 0, width, height).setInteractive({ useHandCursor: true });
        container.add(hitZone);

        hitZone.on('pointerover', (pointer: Phaser.Input.Pointer) => {
            // Touch fires 'over' right after 'down' — skip it so the press
            // squash isn't overridden by a hover grow.
            if (pointer.wasTouch) return;
            this.tweens.killTweensOf(container);
            this.tweens.add({ targets: container, scale: 1.05, duration: 150, ease: 'Sine.easeOut' });
        });

        hitZone.on('pointerout', (pointer: Phaser.Input.Pointer) => {
            if (pointer.wasTouch) return;
            this.tweens.killTweensOf(container);
            this.tweens.add({ targets: container, scale: 1, duration: 150, ease: 'Sine.easeOut' });
        });

        hitZone.on('pointerdown', () => {
            // Opening Settings mid fade-out would pause the fade halfway.
            if (this.starting) return;

            this.tweens.killTweensOf(container);
            this.tweens.add({ targets: container, scale: 0.94, duration: 80, yoyo: true });
            playSfx(this, 'sfx-ui-click', { volume: 0.5 });

            this.scene.pause('MainMenu');
            this.scene.launch('Settings', { returnTo: 'MainMenu' });
        });
    }
}
