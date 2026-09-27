import { Scene, GameObjects } from 'phaser';

const ACCENT_ORANGE = 0xf3814a;
const CARD_COLOR = 0xffffff;
const TEXT_DARK = '#2b241d';
const TEXT_MUTED = '#8a7f70';
const SHADOW_COLOR = 0x2a2018;
const FONT_UI = '"Inter", "Segoe UI", sans-serif';

interface CharacterOption
{
    key: string;
    textureKey: string;
    label: string;
}

const CHARACTERS: CharacterOption[] = [
    { key: 'cashier-female', textureKey: 'cashier-female', label: 'Female' },
    { key: 'cashier-male', textureKey: 'cashier-male', label: 'Male' }
];

export class CharacterSelect extends Scene
{
    background: GameObjects.Image;

    constructor ()
    {
        super('CharacterSelect');
    }

    create ()
    {
        // Picks up from MainMenu's fade-to-black.
        this.cameras.main.fadeIn(500, 26, 18, 11);

        this.background = this.add.image(512, 384, 'shop-bg');
        this.background.setDisplaySize(1024, 768);
        this.add.rectangle(512, 384, 1024, 768, 0x1a120b, 0.55);

        this.add.text(512, 96, 'Choose Your Cashier', {
            fontFamily: FONT_UI, fontStyle: '800', fontSize: 40, color: '#ffffff',
            align: 'center'
        }).setOrigin(0.5).setShadow(0, 4, 'rgba(0,0,0,0.35)', 10);

        this.add.text(512, 142, 'Pick who runs the register today', {
            fontFamily: FONT_UI, fontSize: 18, color: '#e9e2d8',
            align: 'center'
        }).setOrigin(0.5);

        const cardWidth = 280;
        const cardHeight = 340;
        const gap = 40;
        const cardY = 420;
        const centers = [512 - (cardWidth + gap) / 2, 512 + (cardWidth + gap) / 2];

        CHARACTERS.forEach((character, index) => {
            this.createCharacterCard(character, centers[index], cardY, cardWidth, cardHeight);
        });
    }

    private createCharacterCard (character: CharacterOption, x: number, y: number, width: number, height: number): void
    {
        const radius = 28;

        const shadow = this.add.graphics();
        shadow.fillStyle(SHADOW_COLOR, 0.3);
        shadow.fillRoundedRect(-width / 2 + 3, -height / 2 + 6, width, height, radius);

        const bg = this.add.graphics();
        bg.fillStyle(CARD_COLOR, 0.98);
        bg.fillRoundedRect(-width / 2, -height / 2, width, height, radius);

        // A soft accent ring behind the portrait — a small nudge that these
        // cards are interactive choices, not just static portraits.
        const ring = this.add.circle(0, -46, 108, ACCENT_ORANGE, 0);
        ring.setStrokeStyle(3, ACCENT_ORANGE, 0.35);

        const portrait = this.add.image(0, -46, character.textureKey);
        portrait.setDisplaySize(200, 200);

        const label = this.add.text(0, 118, character.label, {
            fontFamily: FONT_UI, fontStyle: '800', fontSize: 24, color: TEXT_DARK
        }).setOrigin(0.5);

        const hint = this.add.text(0, 148, 'Tap to select', {
            fontFamily: FONT_UI, fontStyle: '600', fontSize: 14, color: TEXT_MUTED
        }).setOrigin(0.5);

        const container = this.add.container(x, y, [shadow, bg, ring, portrait, label, hint]);

        const hitZone = this.add.zone(0, 0, width, height).setInteractive({ useHandCursor: true });
        container.add(hitZone);

        hitZone.on('pointerover', () => {
            this.tweens.killTweensOf(container);
            this.tweens.add({ targets: container, scale: 1.05, duration: 150, ease: 'Sine.easeOut' });
        });

        hitZone.on('pointerout', () => {
            this.tweens.killTweensOf(container);
            this.tweens.add({ targets: container, scale: 1, duration: 150, ease: 'Sine.easeOut' });
        });

        hitZone.on('pointerdown', () => {
            this.tweens.killTweensOf(container);
            this.tweens.add({
                targets: container,
                scale: 0.92,
                duration: 70,
                ease: 'Sine.easeIn',
                onComplete: () => {
                    this.tweens.add({ targets: container, scale: 1, duration: 220, ease: 'Back.easeOut' });
                }
            });

            this.sound.play('sfx-ui-click', { volume: 0.5 });
            this.registry.set('cashierKey', character.key);

            this.cameras.main.fadeOut(500, 26, 18, 11);
            this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Game'));
        });
    }
}
