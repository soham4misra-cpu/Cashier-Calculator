import { Scene, GameObjects } from 'phaser';
import { DAY_LENGTHS, DEFAULT_DAY_LENGTH, DEFAULT_DIFFICULTY, DIFFICULTIES } from '../economy';
import { playSfx } from '../audio';
import { applyAnimationSpeed } from '../settings';
import { scaledFontSize } from '../ui/text';

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
    { key: 'cashier-female-dark', textureKey: 'cashier-female-dark', label: 'Female' },
    { key: 'cashier-male', textureKey: 'cashier-male', label: 'Male' },
    { key: 'cashier-male-dark', textureKey: 'cashier-male-dark', label: 'Male' }
];

export class CharacterSelect extends Scene
{
    background: GameObjects.Image;
    private choosing = false;

    constructor ()
    {
        super('CharacterSelect');
    }

    create ()
    {
        // Picks up from MainMenu's fade-to-black.
        this.cameras.main.fadeIn(500, 26, 18, 11);
        applyAnimationSpeed(this);
        this.choosing = false;

        this.background = this.add.image(512, 384, 'shop-bg');
        this.background.setDisplaySize(1024, 768);
        this.add.rectangle(512, 384, 1024, 768, 0x1a120b, 0.55);

        this.add.text(512, 96, 'Choose Your Cashier', {
            fontFamily: FONT_UI, fontStyle: '800', fontSize: scaledFontSize(40, this.registry), color: '#ffffff',
            align: 'center'
        }).setOrigin(0.5).setShadow(0, 4, 'rgba(0,0,0,0.35)', 10);

        this.add.text(512, 142, 'Pick who runs the register today', {
            fontFamily: FONT_UI, fontSize: scaledFontSize(18, this.registry), color: '#e9e2d8',
            align: 'center'
        }).setOrigin(0.5);

        // Sized so all four cards fit in one row across the 1024px canvas.
        const cardWidth = 220;
        const cardHeight = 340;
        const gap = 24;
        const cardY = 420;

        CHARACTERS.forEach((character, index) => {
            const x = 512 + (index - (CHARACTERS.length - 1) / 2) * (cardWidth + gap);
            this.createCharacterCard(character, x, cardY, cardWidth, cardHeight);
        });

        this.createRunOptionPickers(680);
    }

    // Two independent run settings, side by side under the cards.
    private createRunOptionPickers (y: number): void
    {
        this.createOptionPicker(282, y, 'Difficulty', 'difficulty', DIFFICULTIES, DEFAULT_DIFFICULTY);
        this.createOptionPicker(742, y, 'Day Length', 'dayLength', DAY_LENGTHS, DEFAULT_DAY_LENGTH);
    }

    // A row of three pills that writes the picked option's key into the
    // registry under registryKey.
    private createOptionPicker (
        centerX: number, y: number, title: string, registryKey: string,
        options: { key: string; label: string }[], defaultKey: string
    ): void
    {
        this.add.text(centerX, y - 40, title, {
            fontFamily: FONT_UI, fontStyle: '700', fontSize: scaledFontSize(16, this.registry), color: '#e9e2d8', align: 'center'
        }).setOrigin(0.5);

        const pillW = 128;
        const pillH = 44;
        const gap = 12;
        const selected: string = this.registry.get(registryKey) ?? defaultKey;

        const pills = options.map((option, index) => {
            const cx = centerX + (index - (options.length - 1) / 2) * (pillW + gap);
            const bg = this.add.graphics();
            const label = this.add.text(cx, y, option.label, {
                fontFamily: FONT_UI, fontStyle: '800', fontSize: scaledFontSize(17, this.registry), color: TEXT_MUTED
            }).setOrigin(0.5);

            const draw = (isSelected: boolean) => {
                bg.clear();
                bg.fillStyle(isSelected ? ACCENT_ORANGE : CARD_COLOR, 1);
                bg.fillRoundedRect(cx - pillW / 2, y - pillH / 2, pillW, pillH, pillH / 2);
                label.setColor(isSelected ? TEXT_DARK : TEXT_MUTED);
            };

            draw(option.key === selected);

            const hitZone = this.add.zone(cx, y, pillW, pillH).setInteractive({ useHandCursor: true });
            hitZone.on('pointerdown', () => {
                playSfx(this, 'sfx-ui-click', { volume: 0.4 });
                this.registry.set(registryKey, option.key);
                pills.forEach((other) => other.draw(other.key === option.key));
            });

            return { key: option.key, draw };
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
        // Portrait (and the ring around it) scale with the card's width.
        const portraitSize = Math.min(200, width - 44);
        const ring = this.add.circle(0, -46, portraitSize * 0.54, ACCENT_ORANGE, 0);
        ring.setStrokeStyle(3, ACCENT_ORANGE, 0.35);

        const portrait = this.add.image(0, -46, character.textureKey);
        portrait.setDisplaySize(portraitSize, portraitSize);

        const label = this.add.text(0, 118, character.label, {
            fontFamily: FONT_UI, fontStyle: '800', fontSize: scaledFontSize(24, this.registry), color: TEXT_DARK
        }).setOrigin(0.5);

        const hint = this.add.text(0, 148, 'Tap to select', {
            fontFamily: FONT_UI, fontStyle: '600', fontSize: scaledFontSize(14, this.registry), color: TEXT_MUTED
        }).setOrigin(0.5);

        const container = this.add.container(x, y, [shadow, bg, ring, portrait, label, hint]);

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
            // First pick wins — a second card tapped during the fade would
            // swap the cashier and queue another scene start.
            if (this.choosing) return;
            this.choosing = true;

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

            playSfx(this, 'sfx-ui-click', { volume: 0.5 });
            this.registry.set('cashierKey', character.key);

            this.cameras.main.fadeOut(500, 26, 18, 11);
            this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Story', { mode: 'intro' }));
        });
    }
}
