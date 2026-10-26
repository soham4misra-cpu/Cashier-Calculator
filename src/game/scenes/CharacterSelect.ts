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

interface CardOption
{
    textureKey: string;
    label: string;
}

// Two steps: pick a gender, then a skin tone for that gender. Each skin tone
// option's textureKey is also the cashierKey the Game scene draws.
const GENDERS: (CardOption & { skinTones: CardOption[] })[] = [
    {
        textureKey: 'cashier-female',
        label: 'Female',
        skinTones: [
            { textureKey: 'cashier-female', label: 'Lighter' },
            { textureKey: 'cashier-female-dark', label: 'Darker' }
        ]
    },
    {
        textureKey: 'cashier-male',
        label: 'Male',
        skinTones: [
            { textureKey: 'cashier-male', label: 'Lighter' },
            { textureKey: 'cashier-male-dark', label: 'Darker' }
        ]
    }
];

const CARD_WIDTH = 280;
const CARD_HEIGHT = 340;
const CARD_GAP = 40;
const CARD_Y = 420;

export class CharacterSelect extends Scene
{
    background: GameObjects.Image;
    // Everything belonging to the current step, so it can be cleared when
    // moving between the gender and skin tone screens.
    private step: GameObjects.GameObject[] = [];
    // Blocks taps while a step is swapping out or the scene is fading, so a
    // second tap can't skip a screen or queue another scene start.
    private busy = false;

    constructor ()
    {
        super('CharacterSelect');
    }

    create ()
    {
        // Picks up from MainMenu's fade-to-black.
        this.cameras.main.fadeIn(500, 26, 18, 11);
        applyAnimationSpeed(this);
        this.busy = false;
        this.step = [];

        this.background = this.add.image(512, 384, 'shop-bg');
        this.background.setDisplaySize(1024, 768);
        this.add.rectangle(512, 384, 1024, 768, 0x1a120b, 0.55);

        this.showGenderStep();
    }

    private showGenderStep (): void
    {
        this.createHeading('Choose Your Cashier', 'Pick who runs the register today');

        this.createCardRow(GENDERS, (gender) => this.swapStep(() => this.showSkinToneStep(gender.skinTones)));

        this.createRunOptionPickers(680);
    }

    private showSkinToneStep (skinTones: CardOption[]): void
    {
        this.createHeading('Choose a Skin Tone', 'Pick the look for your cashier');

        this.createCardRow(skinTones, (skinTone) => {
            this.busy = true;
            this.registry.set('cashierKey', skinTone.textureKey);
            this.cameras.main.fadeOut(500, 26, 18, 11);
            this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Story', { mode: 'intro' }));
        });

        this.createBackButton(512, 680);
    }

    // Fades the current step out, clears it, then builds the next one.
    private swapStep (buildNext: () => void): void
    {
        this.busy = true;

        this.tweens.add({
            targets: this.step.filter((object) => 'setAlpha' in object),
            alpha: 0,
            duration: 200,
            onComplete: () => {
                this.step.forEach((object) => object.destroy());
                this.step = [];
                buildNext();

                // Zones (hit areas) have no alpha, so only fade what does.
                const visible = this.step.filter((object) => 'setAlpha' in object) as unknown as GameObjects.Components.Alpha[];
                visible.forEach((object) => object.setAlpha(0));
                this.tweens.add({ targets: visible, alpha: 1, duration: 220, onComplete: () => { this.busy = false; } });
            }
        });
    }

    // Anything added to the scene while a step is being built belongs to it.
    private track<T extends GameObjects.GameObject> (object: T): T
    {
        this.step.push(object);
        return object;
    }

    private createHeading (title: string, subtitle: string): void
    {
        this.track(this.add.text(512, 96, title, {
            fontFamily: FONT_UI, fontStyle: '800', fontSize: scaledFontSize(40, this.registry), color: '#ffffff',
            align: 'center'
        }).setOrigin(0.5).setShadow(0, 4, 'rgba(0,0,0,0.35)', 10));

        this.track(this.add.text(512, 142, subtitle, {
            fontFamily: FONT_UI, fontSize: scaledFontSize(18, this.registry), color: '#e9e2d8',
            align: 'center'
        }).setOrigin(0.5));
    }

    private createCardRow<T extends CardOption> (options: T[], onPick: (option: T) => void): void
    {
        options.forEach((option, index) => {
            const x = 512 + (index - (options.length - 1) / 2) * (CARD_WIDTH + CARD_GAP);
            this.createCharacterCard(option, x, CARD_Y, CARD_WIDTH, CARD_HEIGHT, () => onPick(option));
        });
    }

    private createBackButton (x: number, y: number): void
    {
        const width = 160;
        const height = 48;

        const bg = this.add.graphics();
        bg.fillStyle(0xf3ede2, 1);
        bg.fillRoundedRect(-width / 2, -height / 2, width, height, height / 2);

        const label = this.add.text(0, 0, 'Back', {
            fontFamily: FONT_UI, fontStyle: '700', fontSize: scaledFontSize(17, this.registry), color: TEXT_MUTED
        }).setOrigin(0.5);

        const hitZone = this.add.zone(0, 0, width, height).setInteractive({ useHandCursor: true });
        const button = this.track(this.add.container(x, y, [bg, label, hitZone]));

        hitZone.on('pointerdown', () => {
            if (this.busy) return;
            playSfx(this, 'sfx-ui-click', { volume: 0.4 });
            this.swapStep(() => this.showGenderStep());
        });

        hitZone.on('pointerover', (pointer: Phaser.Input.Pointer) => {
            if (pointer.wasTouch) return;
            this.tweens.add({ targets: button, scale: 1.05, duration: 150, ease: 'Sine.easeOut' });
        });

        hitZone.on('pointerout', (pointer: Phaser.Input.Pointer) => {
            if (pointer.wasTouch) return;
            this.tweens.add({ targets: button, scale: 1, duration: 150, ease: 'Sine.easeOut' });
        });
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
        this.track(this.add.text(centerX, y - 40, title, {
            fontFamily: FONT_UI, fontStyle: '700', fontSize: scaledFontSize(16, this.registry), color: '#e9e2d8', align: 'center'
        }).setOrigin(0.5));

        const pillW = 128;
        const pillH = 44;
        const gap = 12;
        const selected: string = this.registry.get(registryKey) ?? defaultKey;

        const pills = options.map((option, index) => {
            const cx = centerX + (index - (options.length - 1) / 2) * (pillW + gap);
            const bg = this.track(this.add.graphics());
            const label = this.track(this.add.text(cx, y, option.label, {
                fontFamily: FONT_UI, fontStyle: '800', fontSize: scaledFontSize(17, this.registry), color: TEXT_MUTED
            }).setOrigin(0.5));

            const draw = (isSelected: boolean) => {
                bg.clear();
                bg.fillStyle(isSelected ? ACCENT_ORANGE : CARD_COLOR, 1);
                bg.fillRoundedRect(cx - pillW / 2, y - pillH / 2, pillW, pillH, pillH / 2);
                label.setColor(isSelected ? TEXT_DARK : TEXT_MUTED);
            };

            draw(option.key === selected);

            const hitZone = this.track(this.add.zone(cx, y, pillW, pillH).setInteractive({ useHandCursor: true }));
            hitZone.on('pointerdown', () => {
                if (this.busy) return;
                playSfx(this, 'sfx-ui-click', { volume: 0.4 });
                this.registry.set(registryKey, option.key);
                pills.forEach((other) => other.draw(other.key === option.key));
            });

            return { key: option.key, draw };
        });
    }

    private createCharacterCard (character: CardOption, x: number, y: number, width: number, height: number, onPick: () => void): void
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

        const hint = this.add.text(0, 148, 'Tap to choose', {
            fontFamily: FONT_UI, fontStyle: '600', fontSize: scaledFontSize(14, this.registry), color: TEXT_MUTED
        }).setOrigin(0.5);

        const container = this.track(this.add.container(x, y, [shadow, bg, ring, portrait, label, hint]));

        const hitZone = this.add.zone(0, 0, width, height).setInteractive({ useHandCursor: true });
        container.add(hitZone);

        hitZone.on('pointerover', (pointer: Phaser.Input.Pointer) => {
            // Touch fires 'over' right after 'down' — skip it so the press
            // squash isn't overridden by a hover grow.
            // Mid-swap, killTweensOf would also kill the step's fade.
            if (pointer.wasTouch || this.busy) return;
            this.tweens.killTweensOf(container);
            this.tweens.add({ targets: container, scale: 1.05, duration: 150, ease: 'Sine.easeOut' });
        });

        hitZone.on('pointerout', (pointer: Phaser.Input.Pointer) => {
            if (pointer.wasTouch || this.busy) return;
            this.tweens.killTweensOf(container);
            this.tweens.add({ targets: container, scale: 1, duration: 150, ease: 'Sine.easeOut' });
        });

        hitZone.on('pointerdown', () => {
            // First pick wins — a second card tapped during a transition
            // would skip a screen or queue another scene start.
            if (this.busy) return;

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
            onPick();
        });
    }
}
