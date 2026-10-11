import { GameObjects, Scene } from 'phaser';
import { playSfx } from '../audio';
import { resetRunState } from '../economy';
import { applyAnimationSpeed } from '../settings';
import { scaledFontSize } from '../ui/text';

const ACCENT_ORANGE = 0xf3814a;
const TEXT_RED = '#a23a22';
const CARD_COLOR = 0xffffff;
const TEXT_DARK = '#2b241d';
const SHADOW_COLOR = 0x2a2018;
const FONT_UI = '"Inter", "Segoe UI", sans-serif';

export class PauseMenu extends Scene
{
    private returnTo = 'Game';
    private leaving = false;

    constructor ()
    {
        super('PauseMenu');
    }

    init (data: { returnTo?: string }): void
    {
        this.returnTo = data.returnTo ?? 'Game';
    }

    create (): void
    {
        applyAnimationSpeed(this);
        this.leaving = false;

        // Launched on top of an already-paused scene — no camera fade in,
        // just an instant overlay. (Leave to Main Menu below is the one
        // exception, since that's a real full-scene transition.)
        this.add.rectangle(512, 384, 1024, 768, 0x1a120b, 0.6);

        const cardWidth = 420;
        const cardHeight = 400;
        const cardX = 512;
        const cardY = 384;
        const radius = 28;
        const cardTop = cardY - cardHeight / 2;

        const shadow = this.add.graphics();
        shadow.fillStyle(SHADOW_COLOR, 0.3);
        shadow.fillRoundedRect(cardX - cardWidth / 2 + 3, cardTop + 6, cardWidth, cardHeight, radius);

        const bg = this.add.graphics();
        bg.fillStyle(CARD_COLOR, 0.98);
        bg.fillRoundedRect(cardX - cardWidth / 2, cardTop, cardWidth, cardHeight, radius);

        this.add.text(cardX, cardTop + 56, 'Paused', {
            fontFamily: FONT_UI, fontStyle: '800', fontSize: scaledFontSize(32, this.registry), color: TEXT_DARK
        }).setOrigin(0.5);

        const buttonWidth = cardWidth - 80;
        const buttonHeight = 60;
        const spacing = 76;
        const firstButtonY = cardTop + 140;

        this.createMenuButton(cardX, firstButtonY, buttonWidth, buttonHeight, 'Resume', ACCENT_ORANGE, TEXT_DARK, () => {
            this.scene.stop('PauseMenu');
            this.scene.resume(this.returnTo);
        });

        this.createMenuButton(cardX, firstButtonY + spacing, buttonWidth, buttonHeight, 'Settings', 0xf3ede2, TEXT_DARK, () => {
            this.scene.pause('PauseMenu');
            this.scene.launch('Settings', { returnTo: 'PauseMenu' });
        });

        this.createMenuButton(cardX, firstButtonY + spacing * 2, buttonWidth, buttonHeight, 'Leave to Main Menu', 0xf3ede2, TEXT_RED, () => {
            this.handleLeaveToMainMenu();
        });
    }

    private handleLeaveToMainMenu (): void
    {
        // Locks every button for the fade — Resume here would un-pause the
        // game mid-transition.
        this.leaving = true;

        this.cameras.main.fadeOut(500, 26, 18, 11);
        this.cameras.main.once('camerafadeoutcomplete', () => {
            // Valid to stop a paused scene directly — Game's own 'shutdown'
            // listener is what tears down its music, so no direct reference
            // or coordination with the Game instance is needed here.
            this.scene.stop('Game');
            resetRunState(this.registry);
            this.scene.start('MainMenu');
        });
    }

    private createMenuButton (
        x: number, y: number, minWidth: number, height: number,
        labelText: string, fillColor: number, textColor: string, onClick: () => void
    ): void
    {
        const radius = height / 2;

        const label = this.add.text(0, 0, labelText, {
            fontFamily: FONT_UI, fontStyle: '700', fontSize: scaledFontSize(19, this.registry), color: textColor
        }).setOrigin(0.5);

        // Fit the button to the label at its actual (Text Size-scaled)
        // width rather than clipping it against minWidth.
        const width = Math.max(minWidth, label.width + 48);

        const shadow = this.add.graphics();
        shadow.fillStyle(SHADOW_COLOR, 0.2);
        shadow.fillRoundedRect(-width / 2 + 2, -height / 2 + 4, width, height, radius);

        const bg = this.add.graphics();
        bg.fillStyle(fillColor, 1);
        bg.fillRoundedRect(-width / 2, -height / 2, width, height, radius);

        const container: GameObjects.Container = this.add.container(x, y, [shadow, bg, label]);

        const hitZone = this.add.zone(0, 0, width, height).setInteractive({ useHandCursor: true });
        container.add(hitZone);

        hitZone.on('pointerover', (pointer: Phaser.Input.Pointer) => {
            // Touch fires 'over' right after 'down' — skip it so the press
            // squash isn't overridden by a hover grow.
            if (pointer.wasTouch) return;
            this.tweens.killTweensOf(container);
            this.tweens.add({ targets: container, scale: 1.04, duration: 150, ease: 'Sine.easeOut' });
        });

        hitZone.on('pointerout', (pointer: Phaser.Input.Pointer) => {
            if (pointer.wasTouch) return;
            this.tweens.killTweensOf(container);
            this.tweens.add({ targets: container, scale: 1, duration: 150, ease: 'Sine.easeOut' });
        });

        hitZone.on('pointerdown', () => {
            if (this.leaving) return;

            this.tweens.killTweensOf(container);
            this.tweens.add({
                targets: container, scale: 0.94, duration: 70, ease: 'Sine.easeIn',
                onComplete: () => this.tweens.add({ targets: container, scale: 1, duration: 220, ease: 'Back.easeOut' })
            });

            playSfx(this, 'sfx-ui-click', { volume: 0.5 });
            onClick();
        });
    }
}
