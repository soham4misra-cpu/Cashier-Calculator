import { Scene, GameObjects } from 'phaser';
import { playSfx } from '../audio';
import { applyAnimationSpeed } from '../settings';
import { scaledFontSize } from '../ui/text';

// Same palette as the in-game UI: white cards, one warm orange accent,
// soft warm shadows.
const ACCENT_ORANGE = 0xf3814a;
const ACCENT_ORANGE_SOFT = 0xfde6d8;
const CARD_COLOR = 0xffffff;
const SECONDARY_COLOR = 0xf3ede2;
const TEXT_DARK = '#2b241d';
const TEXT_MUTED = '#8a7f70';
const TEXT_ORANGE = '#e0692f';
const SHADOW_COLOR = 0x2a2018;
const FONT_UI = '"Inter", "Segoe UI", sans-serif';

const CARD_WIDTH = 488;
const CARD_HEIGHT = 450;
const CARD_LEFT = 1024 - 56 - CARD_WIDTH;
const CARD_TOP = (768 - CARD_HEIGHT) / 2;
const CARD_CENTER_X = CARD_LEFT + CARD_WIDTH / 2;

// Props that drift around the cashier so the left side of the screen has
// some life — positioned around the edges so they never cover the face.
const FLOATING_PROPS: { key: string; x: number; y: number; size: number; angle: number }[] = [
    { key: 'bill-20', x: 388, y: 112, size: 116, angle: 14 },
    { key: 'item-apple', x: 58, y: 150, size: 70, angle: -10 },
    { key: 'bill-5', x: 600, y: 702, size: 100, angle: -10 },
    { key: 'item-watermelon', x: 40, y: 380, size: 70, angle: -6 },
    { key: 'item-banana', x: 436, y: 330, size: 70, angle: 8 }
];

export class MainMenu extends Scene
{
    background: GameObjects.Image;
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

        // A warm wash rather than a black scrim — darker on the right where
        // the card sits, lighter on the left so the shop and cashier show.
        const wash = this.add.graphics();
        wash.fillGradientStyle(0x1a120b, 0x1a120b, 0x1a120b, 0x1a120b, 0.28, 0.72, 0.45, 0.82);
        wash.fillRect(0, 0, 1024, 768);

        this.createCashier();
        this.createFloatingProps();
        this.createSpeechBubble(300, 186);
        this.createTitleCard();
    }

    private createCashier (): void
    {
        // Shows whoever was picked last run (or the default cashier), so the
        // menu feels like your shop.
        const cashierKey = (this.registry.get('cashierKey') as string | undefined) ?? 'cashier-female';
        const cashier = this.add.image(-160, 768, cashierKey).setOrigin(0.5, 1);
        cashier.setDisplaySize(540, 540);

        this.tweens.add({ targets: cashier, x: 234, duration: 900, ease: 'Cubic.easeOut', delay: 150 });
        this.tweens.add({ targets: cashier, y: 762, duration: 1500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }

    private createFloatingProps (): void
    {
        FLOATING_PROPS.forEach((prop, index) => {
            const image = this.add.image(prop.x, prop.y, prop.key).setAngle(prop.angle).setAlpha(0);
            const ratio = image.height / image.width;
            image.setDisplaySize(prop.size, prop.size * ratio);
            const baseScaleX = image.scaleX;
            const baseScaleY = image.scaleY;

            image.setScale(baseScaleX * 0.6, baseScaleY * 0.6);
            this.tweens.add({
                targets: image, alpha: 1, scaleX: baseScaleX, scaleY: baseScaleY,
                duration: 500, delay: 500 + index * 90, ease: 'Back.easeOut'
            });

            // Each prop bobs and sways on its own slightly different rhythm
            // so they never move in lockstep.
            this.tweens.add({
                targets: image, y: prop.y - 12, duration: 1800 + index * 260,
                yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: index * 200
            });
            this.tweens.add({
                targets: image, angle: prop.angle + (index % 2 === 0 ? 6 : -6), duration: 2400 + index * 300,
                yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
            });
        });
    }

    private createSpeechBubble (x: number, y: number): void
    {
        const label = this.add.text(0, 0, "Here's your change!", {
            fontFamily: FONT_UI, fontStyle: '700', fontSize: scaledFontSize(17, this.registry), color: TEXT_DARK
        }).setOrigin(0.5);

        const width = label.width + 40;
        const height = 48;

        const shadow = this.add.graphics();
        shadow.fillStyle(SHADOW_COLOR, 0.22);
        shadow.fillRoundedRect(-width / 2 + 2, -height / 2 + 5, width, height, height / 2);

        const bg = this.add.graphics();
        bg.fillStyle(CARD_COLOR, 1);
        bg.fillRoundedRect(-width / 2, -height / 2, width, height, height / 2);
        // Tail pointing down toward the cashier.
        bg.fillTriangle(-8, height / 2 - 2, 12, height / 2 - 2, -2, height / 2 + 12);

        const dot = this.add.circle(-width / 2 + 20, 0, 5, ACCENT_ORANGE);
        label.setX(8);

        const bubble = this.add.container(x, y, [shadow, bg, dot, label]).setAlpha(0).setScale(0.7);
        this.tweens.add({ targets: bubble, alpha: 1, scale: 1, duration: 420, delay: 1000, ease: 'Back.easeOut' });
    }

    private createTitleCard (): void
    {
        const shadow = this.add.graphics();
        shadow.fillStyle(SHADOW_COLOR, 0.3);
        shadow.fillRoundedRect(CARD_LEFT + 4, CARD_TOP + 10, CARD_WIDTH, CARD_HEIGHT, 32);

        const bg = this.add.graphics();
        bg.fillStyle(CARD_COLOR, 0.98);
        bg.fillRoundedRect(CARD_LEFT, CARD_TOP, CARD_WIDTH, CARD_HEIGHT, 32);

        // A thin orange band across the top, like a receipt header.
        const band = this.add.graphics();
        band.fillStyle(ACCENT_ORANGE, 1);
        band.fillRoundedRect(CARD_LEFT, CARD_TOP, CARD_WIDTH, 14, { tl: 32, tr: 32, bl: 0, br: 0 });

        const left = CARD_LEFT + 44;

        const tagLabel = this.add.text(0, 0, 'NOW HIRING', {
            fontFamily: FONT_UI, fontStyle: '800', fontSize: scaledFontSize(13, this.registry), color: TEXT_ORANGE
        }).setOrigin(0, 0.5);
        tagLabel.setLetterSpacing(2);
        const tagWidth = tagLabel.width + 28;
        const tagBg = this.add.graphics();
        tagBg.fillStyle(ACCENT_ORANGE_SOFT, 1);
        tagBg.fillRoundedRect(0, -15, tagWidth, 30, 15);
        tagLabel.setX(14);
        const tag = this.add.container(left, CARD_TOP + 66, [tagBg, tagLabel]);

        const title = this.add.text(left, CARD_TOP + 98, 'Cashier\nCalculator', {
            fontFamily: FONT_UI, fontStyle: '800', fontSize: scaledFontSize(54, this.registry), color: TEXT_DARK,
            lineSpacing: -6
        });

        const underline = this.add.graphics();
        underline.fillStyle(ACCENT_ORANGE, 1);
        underline.fillRoundedRect(left, title.y + title.height + 10, 72, 6, 3);

        const startY = CARD_TOP + CARD_HEIGHT - 128;
        const startButton = this.createButton(CARD_CENTER_X, startY, CARD_WIDTH - 88, 66, 'Start Shift', true, () => this.startGame());

        // Idle pulse so the primary action reads as "press me".
        this.tweens.add({ targets: startButton, scale: 1.02, duration: 750, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

        const settingsButton = this.createButton(CARD_CENTER_X, startY + 74, 200, 46, 'Settings', false, () => this.openSettings());

        const card = this.add.container(0, 0, [shadow, bg, band, tag, title, underline, startButton, settingsButton]);
        card.setAlpha(0).setY(30);
        this.tweens.add({ targets: card, alpha: 1, y: 0, duration: 650, ease: 'Cubic.easeOut' });
    }

    private createButton (
        x: number, y: number, width: number, height: number, text: string, primary: boolean, onPress: () => void
    ): GameObjects.Container
    {
        const radius = height / 2;

        // Drawn around the container's own origin so press/hover/pulse
        // tweens scale the button in place.
        const shadow = this.add.graphics();
        shadow.fillStyle(SHADOW_COLOR, primary ? 0.3 : 0.15);
        shadow.fillRoundedRect(-width / 2 + 2, -height / 2 + 5, width, height, radius);

        const bg = this.add.graphics();
        bg.fillStyle(primary ? ACCENT_ORANGE : SECONDARY_COLOR, 1);
        bg.fillRoundedRect(-width / 2, -height / 2, width, height, radius);

        const label = this.add.text(0, 0, text, {
            fontFamily: FONT_UI, fontStyle: primary ? '800' : '700',
            fontSize: scaledFontSize(primary ? 22 : 17, this.registry), color: primary ? '#ffffff' : TEXT_MUTED
        }).setOrigin(0.5);

        const container = this.add.container(x, y, [shadow, bg, label]);

        const hitZone = this.add.zone(0, 0, width, height).setInteractive({ useHandCursor: true });
        container.add(hitZone);

        hitZone.on('pointerover', (pointer: Phaser.Input.Pointer) => {
            // Touch fires 'over' right after 'down' — skip it so the press
            // squash isn't overridden by a hover grow.
            if (pointer.wasTouch || this.starting) return;
            this.tweens.killTweensOf(container);
            this.tweens.add({ targets: container, scale: 1.04, duration: 150, ease: 'Sine.easeOut' });
        });

        hitZone.on('pointerout', (pointer: Phaser.Input.Pointer) => {
            if (pointer.wasTouch || this.starting) return;
            this.tweens.killTweensOf(container);
            this.tweens.add({ targets: container, scale: 1, duration: 150, ease: 'Sine.easeOut' });
        });

        hitZone.on('pointerdown', () => {
            if (this.starting) return;
            this.tweens.killTweensOf(container);
            this.tweens.add({ targets: container, scale: 0.94, duration: 80, yoyo: true });
            playSfx(this, 'sfx-ui-click', { volume: 0.5 });
            onPress();
        });

        return container;
    }

    private startGame (): void
    {
        // One press only — repeat clicks during the fade would each queue
        // another scene start.
        this.starting = true;
        this.cameras.main.fadeOut(500, 26, 18, 11);
        this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('CharacterSelect'));
    }

    private openSettings (): void
    {
        this.scene.pause('MainMenu');
        this.scene.launch('Settings', { returnTo: 'MainMenu' });
    }
}
