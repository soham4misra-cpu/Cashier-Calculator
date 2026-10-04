import { Scene, GameObjects } from 'phaser';

interface ItemDefinition
{
    key: string;
    name: string;
    minPrice: number;
    maxPrice: number;
    // Premium items are held back until difficulty unlocks them, so early
    // orders stay cheap and simple.
    premium?: boolean;
}

interface PurchaseItem
{
    key: string;
    name: string;
    price: number;
}

interface ItemLayout
{
    size: number;
    spacing: number;
}

const ITEMS: ItemDefinition[] = [
    { key: 'item-apple', name: 'Apple', minPrice: 1, maxPrice: 3 },
    { key: 'item-banana', name: 'Banana', minPrice: 1, maxPrice: 2 },
    { key: 'item-carrot', name: 'Carrot', minPrice: 2, maxPrice: 4 },
    { key: 'item-cilantro', name: 'Cilantro', minPrice: 1, maxPrice: 3 },
    { key: 'item-pepper', name: 'Pepper', minPrice: 1, maxPrice: 3 },
    { key: 'item-water', name: 'Water Bottle', minPrice: 1, maxPrice: 2 },
    { key: 'item-watermelon', name: 'Watermelon', minPrice: 4, maxPrice: 8, premium: true }
];

const ITEM_LAYOUTS: Record<number, ItemLayout> = {
    1: { size: 100, spacing: 0 },
    2: { size: 80, spacing: 88 },
    3: { size: 66, spacing: 72 },
    4: { size: 56, spacing: 60 },
    5: { size: 48, spacing: 50 }
};

const BILL_VALUES = [1, 5, 10, 20];
const PAYMENT_BILLS = [5, 10, 20, 50];

// Difficulty ramps with how many customers have come through, not with the
// player's accuracy — orders keep growing even through a rough patch.
const ROUNDS_PER_LEVEL = 3;
const MAX_ITEM_COUNT = Object.keys(ITEM_LAYOUTS).length;
const PREMIUM_UNLOCK_LEVEL = 2;
const MAX_PRICE_SCALE = 1.6;
const PRICE_SCALE_PER_LEVEL = 0.12;

// The day is a fixed stretch of real time, not a fixed customer count — a
// fast, accurate player naturally serves more customers in it than a slow
// or mistake-prone one, which is what produces the "10 to 30" range.
const DAY_DURATION_MS = 4 * 60 * 1000;

// Three strikes and the shop closes early for the day.
const MAX_LIVES = 3;

// The two tracks take turns rather than one looping forever — whichever
// plays first varies day to day, and each hands off to the next with a
// crossfade instead of a hard cut.
const MUSIC_TRACKS = ['music-cashier', 'music-new-game'];
const MUSIC_VOLUME = 0.4;
const MUSIC_INTRO_FADE_MS = 5000;
const MUSIC_CROSSFADE_MS = 2000;

// A clean, professional palette: warm coral/orange as the single accent
// (matching the app-style reference), white cards, and soft shadows doing
// the separation work instead of heavy borders.
const ACCENT_GREEN = 0x4fa876;
const ACCENT_RED = 0xe25b45;
const ACCENT_ORANGE = 0xf3814a;
const ACCENT_ORANGE_DARK = darkenColor(ACCENT_ORANGE, 0.8);
const CARD_COLOR = 0xffffff;
const TEXT_DARK = '#2b241d';
const TEXT_MUTED = '#8a7f70';

// One shared corner-radius scale so every card/button/chip reads as the
// same design system instead of a mix of shapes.
const RADIUS_CARD = 28;   // the bottom panel and feedback toast
const RADIUS_BUTTON = 22; // bill buttons and the confirm button

// A warm dark neutral (instead of pure black) so drop shadows pick up the
// same palette as everything else.
const SHADOW_COLOR = 0x2a2018;

// Inter for UI chrome (buttons, labels, numbers); Cormorant Garamond stays
// for the narrative/receipt-style copy it was already used for.
const FONT_UI = '"Inter", "Segoe UI", sans-serif';
const FONT_SERIF = '"Cormorant Garamond", serif';

const CASHIER_X = 150;
const FLOOR_Y = 520;
const PANEL_Y = 476;
const PANEL_MARGIN = 18; // inset so the panel reads as a floating card, not a flush bar
const CUSTOMER_START_X = 1150;
const CUSTOMER_MEET_X = 760;
const CUSTOMER_DISPLAY_SIZE = 480;

// A new customer sprite is picked at random each round — same walk-in,
// idle bob, and walk-out treatment regardless of which one shows up.
const CUSTOMER_KEYS = ['customer', 'customer2', 'customer3'];

// The purchased items are displayed as a fixed cluster inside the panel
// (right side, above the bill row) rather than floating in world space
// beside the customer.
const ICON_CLUSTER_X = 860;
const ICON_CLUSTER_Y = PANEL_Y + 56;

type RoundState = 'idle' | 'walking-in' | 'awaiting-change' | 'resolving' | 'walking-out';

function toCssColor (hex: number): string
{
    return `#${hex.toString(16).padStart(6, '0')}`;
}

function darkenColor (hex: number, factor: number): number
{
    const r = Math.floor(((hex >> 16) & 0xff) * factor);
    const g = Math.floor(((hex >> 8) & 0xff) * factor);
    const b = Math.floor((hex & 0xff) * factor);
    return (r << 16) | (g << 8) | b;
}

function randomInt (min: number, max: number): number
{
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomItem<T> (items: readonly T[]): T
{
    return items[Math.floor(Math.random() * items.length)];
}

function shuffled<T> (items: readonly T[]): T[]
{
    const copy = [...items];

    for (let i = copy.length - 1; i > 0; i--)
    {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }

    return copy;
}

function getDifficultyLevel (roundNumber: number): number
{
    return Math.floor(roundNumber / ROUNDS_PER_LEVEL);
}

function getAvailableItems (level: number): ItemDefinition[]
{
    return ITEMS.filter((item) => !item.premium || level >= PREMIUM_UNLOCK_LEVEL);
}

function getPriceScale (level: number): number
{
    return Math.min(MAX_PRICE_SCALE, 1 + level * PRICE_SCALE_PER_LEVEL);
}

// Rewards fast, correct change — the clock runs from the moment the player
// can act until the moment they get it right, so a fumbled first attempt
// still counts against the final time rather than getting a free reset.
function getSpeedBonusMultiplier (elapsedSeconds: number): number
{
    if (elapsedSeconds < 2.5) return 1.5;
    if (elapsedSeconds < 5) return 1.25;
    if (elapsedSeconds < 8) return 1.15;
    if (elapsedSeconds < 10) return 1.1;
    return 1;
}

// The basket grows a slot every level (capped at what ITEM_LAYOUTS can lay
// out), and the odds shift toward the larger counts as that cap rises —
// early orders stay small almost every time, later ones rarely are.
function randomItemCount (level: number): number
{
    const maxCount = Math.min(MAX_ITEM_COUNT, 2 + level);
    const roll = Math.random();

    if (maxCount <= 2) return roll < 0.5 ? 1 : 2;

    if (maxCount === 3)
    {
        if (roll < 0.4) return 1;
        if (roll < 0.75) return 2;
        return 3;
    }

    if (maxCount === 4)
    {
        if (roll < 0.25) return 1;
        if (roll < 0.55) return 2;
        if (roll < 0.85) return 3;
        return 4;
    }

    if (roll < 0.15) return 1;
    if (roll < 0.4) return 2;
    if (roll < 0.65) return 3;
    if (roll < 0.88) return 4;
    return 5;
}

function minimalBillBreakdown (amount: number): Map<number, number>
{
    let remaining = amount;
    const breakdown = new Map<number, number>();

    for (const bill of [20, 10, 5, 1])
    {
        const count = Math.floor(remaining / bill);
        if (count > 0) breakdown.set(bill, count);
        remaining %= bill;
    }

    return breakdown;
}

function minimalBillCount (amount: number): number
{
    let total = 0;
    minimalBillBreakdown(amount).forEach((count) => { total += count; });
    return total;
}

function formatBillBreakdown (breakdown: Map<number, number>): string
{
    const parts: string[] = [];

    for (const bill of [20, 10, 5, 1])
    {
        const count = breakdown.get(bill);
        if (!count) continue;
        parts.push(`${count} $${bill} ${count === 1 ? 'bill' : 'bills'}`);
    }

    return parts.join(' + ');
}

export class Game extends Scene
{
    background: GameObjects.Image;
    cashier: GameObjects.Image;
    customer: GameObjects.Image | null = null;
    itemIcons: GameObjects.Image[] = [];
    itemPriceTags: GameObjects.Text[] = [];

    scoreText: GameObjects.Text;
    revenueText: GameObjects.Text;
    scorePillContainer: GameObjects.Container;
    revenuePillContainer: GameObjects.Container;
    livesPillContainer: GameObjects.Container;
    livesDots: GameObjects.Arc[] = [];
    infoText: GameObjects.Text;
    totalText: GameObjects.Text;
    feedbackContainer: GameObjects.Container;
    music: Phaser.Sound.BaseSound;
    musicTrackIndex = 0;
    confirmGlow: GameObjects.Arc;
    confirmGlowTween: Phaser.Tweens.Tween | null = null;

    changeUI: GameObjects.Container;
    itemIconGroup: GameObjects.Container;
    controlsGroup: GameObjects.Container;
    billCountTexts: Map<number, GameObjects.Text> = new Map();
    billCountBadges: Map<number, GameObjects.Graphics> = new Map();
    billCounts: Map<number, number> = new Map();

    state: RoundState = 'idle';
    score = 0;
    revenue = 0;
    price = 0;
    payment = 0;
    givenAmount = 0;
    roundNumber = 0;
    difficultyLevel = 0;
    roundStartTime = 0;
    dayStartTime = 0;
    customerArrivalTime = 0;
    totalCustomerTimeMs = 0;
    firstTryCorrect = 0;
    roundHadMistake = false;
    lives = MAX_LIVES;
    ranOutOfLives = false;
    currentItems: PurchaseItem[] = [];

    constructor ()
    {
        super('Game');
    }

    create ()
    {
        // Picks up from MainMenu's or GameOver's fade-to-black — and since
        // this scene instance is reused on "Start Next Day", the camera's
        // alpha would otherwise still be left at 0 from the previous fadeOut.
        this.cameras.main.fadeIn(500, 26, 18, 11);

        // Phaser reuses this same Scene instance across restarts (Start Next
        // Day -> 'Game' again), so the class-field initializers above only
        // ever ran once — every stat has to be zeroed explicitly here or a
        // "new" day would silently inherit the last one's numbers.
        this.state = 'idle';
        this.score = 0;
        this.revenue = 0;
        this.price = 0;
        this.payment = 0;
        this.givenAmount = 0;
        this.roundNumber = 0;
        this.difficultyLevel = 0;
        this.roundStartTime = 0;
        this.customerArrivalTime = 0;
        this.totalCustomerTimeMs = 0;
        this.firstTryCorrect = 0;
        this.roundHadMistake = false;
        this.lives = MAX_LIVES;
        this.ranOutOfLives = false;
        this.livesDots = [];
        this.currentItems = [];
        this.itemIcons = [];
        this.itemPriceTags = [];
        this.billCounts.clear();
        this.billCountTexts.clear();
        this.billCountBadges.clear();
        this.dayStartTime = this.time.now;

        this.background = this.add.image(512, 384, 'shop-bg');
        this.background.setDisplaySize(1024, 768);

        // Which track opens the day is random, so it isn't always the same
        // song playing "first" every time.
        this.musicTrackIndex = randomInt(0, MUSIC_TRACKS.length - 1);
        this.playNextTrack(MUSIC_INTRO_FADE_MS);

        // Chosen on the CharacterSelect screen and kept in the registry (not
        // scene data) so it survives "Start Next Day" restarts of this same
        // scene without needing to be re-picked every day.
        const cashierKey = this.registry.get('cashierKey') ?? 'cashier-female';
        this.cashier = this.add.image(CASHIER_X, FLOOR_Y, cashierKey);
        this.cashier.setOrigin(0.5, 1);
        this.cashier.setDisplaySize(480, 480);
        this.cashier.setDepth(0);
        this.cashier.setAlpha(0);

        // A slow idle bob so the scene never looks frozen even when nothing
        // else is happening.
        this.tweens.add({
            targets: this.cashier,
            y: FLOOR_Y - 6,
            duration: 1700,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        const scorePill = this.createStatPill(24, 'left', 'Served: 0', ACCENT_GREEN);
        this.scoreText = scorePill.text;
        this.scorePillContainer = scorePill.container;

        const revenuePill = this.createStatPill(512, 'center', 'Revenue: $0', ACCENT_ORANGE);
        this.revenueText = revenuePill.text;
        this.revenuePillContainer = revenuePill.container;

        const livesPill = this.createLivesPill(912);
        this.livesPillContainer = livesPill.container;
        this.livesDots = livesPill.dots;

        this.feedbackContainer = this.add.container(512, 165).setDepth(10).setAlpha(0);

        this.createChangeUI();

        this.tweens.add({
            targets: [this.cashier, scorePill.container, revenuePill.container, livesPill.container, this.changeUI],
            alpha: 1,
            duration: 700,
            ease: 'Sine.easeOut'
        });

        this.time.delayedCall(600, () => this.startNewCustomer());
    }

    // Plays the next track in the rotation, fading it in over `fadeInMs`.
    // When it finishes, its own 'complete' handler fades it out, starts the
    // next track fading in, and chains into playNextTrack again — looping
    // the whole playlist for as long as the day runs.
    private playNextTrack (fadeInMs: number): void
    {
        const key = MUSIC_TRACKS[this.musicTrackIndex % MUSIC_TRACKS.length];
        this.musicTrackIndex += 1;

        const track = this.sound.add(key, { loop: false, volume: 0 });
        this.music = track;
        track.play();

        // Explicit `from` rather than letting the tween read the sound's
        // current volume: a WebAudio GainNode's value can read back stale
        // for a tick right after a fresh sound starts playing, which made
        // the tween capture ~1 as its start point instead of the 0 we just
        // configured it with.
        this.tweens.add({ targets: track, volume: { from: 0, to: MUSIC_VOLUME }, duration: fadeInMs, ease: 'Sine.easeIn' });

        track.once('complete', () => {
            this.tweens.add({
                targets: track,
                volume: { from: MUSIC_VOLUME, to: 0 },
                duration: MUSIC_CROSSFADE_MS,
                onComplete: () => track.stop()
            });
            this.playNextTrack(MUSIC_CROSSFADE_MS);
        });
    }

    private createStatPill (x: number, align: 'left' | 'center' | 'right', label: string, accent: number): { container: GameObjects.Container; text: GameObjects.Text }
    {
        const width = 176;
        const height = 48;
        const left = align === 'right' ? -width : align === 'center' ? -width / 2 : 0;
        const pillRadius = height / 2;

        // Soft, borderless elevation — the shadow alone separates the chip
        // from the scene, matching the flat white-card look of the reference.
        const shadow = this.add.graphics();
        shadow.fillStyle(SHADOW_COLOR, 0.14);
        shadow.fillRoundedRect(left + 1, 3, width, height, pillRadius);

        const bg = this.add.graphics();
        bg.fillStyle(CARD_COLOR, 1);
        bg.fillRoundedRect(left, 0, width, height, pillRadius);

        // A soft tinted disc behind a smaller solid dot, echoing the
        // colored icon badges used for categories in the reference app.
        const badgeX = left + 26;
        const badge = this.add.circle(badgeX, height / 2, 15, accent, 0.16);
        const dot = this.add.circle(badgeX, height / 2, 7, accent);

        const text = this.add.text(badgeX + 25, height / 2, label, {
            fontFamily: FONT_UI, fontStyle: '700', fontSize: 18, color: TEXT_DARK
        }).setOrigin(0, 0.5);

        const container = this.add.container(x, 20, [shadow, bg, badge, dot, text]);
        container.setDepth(10);

        return { container, text };
    }

    // Same white pill shell as createStatPill, but the "value" is three
    // dots instead of a number — a heart-style life counter that fills in
    // green and empties to a hollow outline as mistakes cost lives.
    private createLivesPill (x: number): { container: GameObjects.Container; dots: GameObjects.Arc[] }
    {
        const width = 176;
        const height = 48;
        const left = -width / 2;
        const pillRadius = height / 2;

        const shadow = this.add.graphics();
        shadow.fillStyle(SHADOW_COLOR, 0.14);
        shadow.fillRoundedRect(left + 1, 3, width, height, pillRadius);

        const bg = this.add.graphics();
        bg.fillStyle(CARD_COLOR, 1);
        bg.fillRoundedRect(left, 0, width, height, pillRadius);

        const label = this.add.text(left + 20, height / 2, 'Lives', {
            fontFamily: FONT_UI, fontStyle: '700', fontSize: 18, color: TEXT_DARK
        }).setOrigin(0, 0.5);

        const dots: GameObjects.Arc[] = [];
        const dotStartX = left + 20 + label.width + 16;
        const dotGap = 24;

        for (let i = 0; i < MAX_LIVES; i++)
        {
            const dot = this.add.circle(dotStartX + i * dotGap, height / 2, 8, ACCENT_GREEN, 1);
            dots.push(dot);
        }

        const container = this.add.container(x, 20, [shadow, bg, label, ...dots]);
        container.setDepth(10);

        return { container, dots };
    }

    // Empties one life dot (hollow, faded) to reflect the current life
    // count — called after every mistake, and once on a fresh day to make
    // sure a previous day's empty dots don't carry over.
    private refreshLivesDots (): void
    {
        this.livesDots.forEach((dot, index) => {
            const alive = index < this.lives;
            dot.setFillStyle(ACCENT_GREEN, alive ? 1 : 0);
            dot.setStrokeStyle(alive ? 0 : 2, ACCENT_RED, 0.5);
        });
    }

    private createChangeUI (): void
    {
        const panelX = PANEL_MARGIN;
        const panelWidth = 1024 - PANEL_MARGIN * 2;
        const panelHeight = 768 - PANEL_MARGIN - PANEL_Y;

        // A fully-rounded floating card (not a flush bottom bar) with a soft
        // all-around shadow — the same elevation language as the reference.
        const panelShadow = this.add.graphics();
        panelShadow.fillStyle(SHADOW_COLOR, 0.16);
        panelShadow.fillRoundedRect(panelX, PANEL_Y + 5, panelWidth, panelHeight, RADIUS_CARD);

        const panelBg = this.add.graphics();
        panelBg.fillStyle(CARD_COLOR, 0.98);
        panelBg.fillRoundedRect(panelX, PANEL_Y, panelWidth, panelHeight, RADIUS_CARD);

        this.infoText = this.add.text(panelX + 26, PANEL_Y + 22, 'Get ready — your first customer is on the way!', {
            fontFamily: FONT_SERIF, fontSize: 25, color: TEXT_DARK,
            lineSpacing: 8
        });

        this.totalText = this.add.text(panelX + 26, PANEL_Y + 66, 'Change given: $0', {
            fontFamily: FONT_UI, fontStyle: '700', fontSize: 23, color: toCssColor(ACCENT_ORANGE)
        });

        this.itemIconGroup = this.add.container(0, 0);

        this.controlsGroup = this.add.container(0, 0);

        this.changeUI = this.add.container(0, 0, [panelShadow, panelBg, this.infoText, this.totalText, this.itemIconGroup, this.controlsGroup]);
        this.changeUI.setDepth(10);

        // A single evenly-spaced row: Clear, the four bill values, then
        // Confirm — six equal slots across the card's inner width so every
        // control sits the same distance from its neighbors.
        const rowInnerPad = 30;
        const rowLeft = panelX + rowInnerPad;
        const rowRight = panelX + panelWidth - rowInnerPad;
        const slotCount = BILL_VALUES.length + 2;
        const slotWidth = (rowRight - rowLeft) / slotCount;
        const billY = PANEL_Y + panelHeight - 62;
        const slotX = (index: number) => rowLeft + slotWidth * (index + 0.5);

        this.createClearButton(slotX(0), billY);

        BILL_VALUES.forEach((value, index) => {
            this.createBillButton(value, slotX(index + 1), billY);
        });

        this.createConfirmButton(slotX(slotCount - 1), billY);

        this.setControlsActive(false);
    }

    private drawButtonBackground (width: number, height: number, fillColor: number, fillAlpha = 1, radius: number = RADIUS_BUTTON): { shadow: GameObjects.Graphics; bg: GameObjects.Graphics }
    {
        // No border stroke — a soft offset shadow does the separation, so
        // every card reads as a clean flat surface rather than an outlined box.
        const shadow = this.add.graphics();
        shadow.fillStyle(SHADOW_COLOR, 0.13);
        shadow.fillRoundedRect(-width / 2 + 2, -height / 2 + 4, width, height, radius);

        const bg = this.add.graphics();
        bg.fillStyle(fillColor, fillAlpha);
        bg.fillRoundedRect(-width / 2, -height / 2, width, height, radius);

        return { shadow, bg };
    }

    private attachButtonInteractions (hitZone: GameObjects.Zone, container: GameObjects.Container, onClick: () => void): void
    {
        hitZone.setInteractive({ useHandCursor: true });

        hitZone.on('pointerdown', () => {
            this.tweens.killTweensOf(container);
            // A quick squash followed by a springy overshoot on release reads
            // as far more "pressable" than a plain symmetric scale tween.
            this.tweens.add({
                targets: container,
                scale: 0.9,
                duration: 70,
                ease: 'Sine.easeIn',
                onComplete: () => {
                    this.tweens.add({ targets: container, scale: 1, duration: 220, ease: 'Back.easeOut' });
                }
            });
            // A slight random detune per press keeps a repeated click from
            // sounding mechanically identical every time.
            this.sound.play('sfx-ui-click', { volume: 0.5, detune: randomInt(-80, 80) });
            onClick();
        });

        hitZone.on('pointerover', () => {
            this.tweens.killTweensOf(container);
            this.tweens.add({ targets: container, scale: 1.06, duration: 150, ease: 'Sine.easeOut' });
        });

        hitZone.on('pointerout', () => {
            this.tweens.killTweensOf(container);
            this.tweens.add({ targets: container, scale: 1, duration: 150, ease: 'Sine.easeOut' });
        });
    }

    // A quick "pop" — scale past 1 and spring back — used to make numbers,
    // badges, and pills feel alive whenever their value changes rather than
    // just snapping to new text.
    private punch (target: { setScale: (s: number) => unknown }, toScale = 1.3, duration = 260): void
    {
        this.tweens.killTweensOf(target);
        target.setScale(1);
        this.tweens.add({ targets: target, scale: toScale, duration: duration / 2, yoyo: true, ease: 'Sine.easeOut' });
    }

    private createBillButton (value: number, x: number, y: number): void
    {
        const cardWidth = 130;
        const cardHeight = 92;

        const { shadow, bg } = this.drawButtonBackground(cardWidth, cardHeight, CARD_COLOR);

        const img = this.add.image(0, -4, `bill-${value}`);
        img.setDisplaySize(108, 48);

        const badgeX = cardWidth / 2 - 20;
        const badgeY = cardHeight / 2 - 16;
        const badgeHeight = 22;

        const countBadge = this.add.graphics().setAlpha(0);

        const countText = this.add.text(badgeX, badgeY, '', {
            fontFamily: FONT_UI, fontStyle: '700', fontSize: 14, color: '#ffffff'
        }).setOrigin(0.5).setAlpha(0);

        this.billCountTexts.set(value, countText);
        this.billCountBadges.set(value, countBadge);

        const hitZone = this.add.zone(0, 0, cardWidth, cardHeight);
        const container = this.add.container(x, y, [shadow, bg, img, countBadge, countText, hitZone]);
        this.controlsGroup.add(container);

        this.attachButtonInteractions(hitZone, container, () => {
            if (this.state !== 'awaiting-change') return;

            this.givenAmount += value;
            const count = (this.billCounts.get(value) ?? 0) + 1;
            this.billCounts.set(value, count);

            countText.setText(`x${count}`).setAlpha(1);
            const badgeWidth = Math.max(30, countText.width + 16);
            countBadge.clear();
            countBadge.fillStyle(ACCENT_ORANGE, 1);
            countBadge.fillRoundedRect(badgeX - badgeWidth / 2, badgeY - badgeHeight / 2, badgeWidth, badgeHeight, badgeHeight / 2);
            countBadge.setAlpha(1);
            this.punch(countBadge, 1.35, 220);
            this.punch(countText, 1.35, 220);

            this.updateTotalText();
            this.punch(this.totalText, 1.15, 220);
        });
    }

    private createClearButton (x: number, y: number): void
    {
        const width = 108;
        const height = 52;

        const { shadow, bg } = this.drawButtonBackground(width, height, 0xf3ede2, 1, height / 2);

        const label = this.add.text(0, 0, 'Clear', {
            fontFamily: FONT_UI, fontStyle: '700', fontSize: 16, color: TEXT_MUTED
        }).setOrigin(0.5);

        const hitZone = this.add.zone(0, 0, width, height);
        const container = this.add.container(x, y, [shadow, bg, label, hitZone]);
        this.controlsGroup.add(container);

        this.attachButtonInteractions(hitZone, container, () => {
            if (this.state !== 'awaiting-change') return;
            this.resetGivenAmount();
        });
    }

    private createConfirmButton (x: number, y: number): void
    {
        const size = 92;

        // A soft ring that pings outward behind the button while it's
        // waiting for input — a quiet "press me" invitation rather than a
        // static icon.
        this.confirmGlow = this.add.circle(x, y, size / 2, ACCENT_ORANGE, 0.35);
        this.controlsGroup.add(this.confirmGlow);

        // The single solid-accent button in the row — everything else is a
        // neutral card, so this reads immediately as the primary action.
        const { shadow, bg } = this.drawButtonBackground(size, size, ACCENT_ORANGE);

        const check = this.add.image(0, 0, 'icon-check');
        check.setDisplaySize(40, 36);
        check.setTint(0xffffff);

        const hitZone = this.add.zone(0, 0, size, size);
        const container = this.add.container(x, y, [shadow, bg, check, hitZone]);
        this.controlsGroup.add(container);

        this.attachButtonInteractions(hitZone, container, () => this.handleConfirm());
    }

    private setControlsActive (active: boolean): void
    {
        this.controlsGroup.setAlpha(active ? 1 : 0.42);

        this.confirmGlowTween?.stop();
        this.confirmGlow.setScale(1).setAlpha(0.35);

        if (active)
        {
            this.confirmGlowTween = this.tweens.add({
                targets: this.confirmGlow,
                scale: 1.55,
                alpha: 0,
                duration: 1300,
                repeat: -1,
                ease: 'Sine.easeOut'
            });
        }
    }

    private resetGivenAmount (): void
    {
        this.givenAmount = 0;
        this.billCounts.clear();
        this.billCountTexts.forEach((text) => text.setText('').setAlpha(0));
        this.billCountBadges.forEach((badge) => badge.setAlpha(0));
        this.updateTotalText();
    }

    private updateTotalText (): void
    {
        this.totalText.setText(`Change given: $${this.givenAmount}`);
    }

    private getBillsUsedCount (): number
    {
        let total = 0;
        this.billCounts.forEach((count) => { total += count; });
        return total;
    }

    private startNewCustomer (): void
    {
        this.state = 'walking-in';
        this.resetGivenAmount();
        this.setControlsActive(false);
        this.feedbackContainer.setAlpha(0);
        this.infoText.setText('A customer is walking in…');
        this.itemPriceTags = [];
        this.customerArrivalTime = this.time.now;
        this.roundHadMistake = false;

        // Difficulty is driven by how many customers have come through, not
        // by accuracy — baskets keep growing and getting pricier even
        // through a rough patch, rather than rewarding mistakes with easier
        // rounds.
        const level = getDifficultyLevel(this.roundNumber);
        this.difficultyLevel = level;
        this.roundNumber += 1;

        const priceScale = getPriceScale(level);
        const itemDefs = shuffled(getAvailableItems(level)).slice(0, randomItemCount(level));
        this.currentItems = itemDefs.map((def) => ({
            key: def.key,
            name: def.name,
            price: Math.max(def.minPrice, Math.round(randomInt(def.minPrice, def.maxPrice) * priceScale))
        }));
        this.price = this.currentItems.reduce((sum, item) => sum + item.price, 0);

        // A $50 bill only enters the mix once the total is big enough to
        // plausibly need one — otherwise every early, cheap order would risk
        // getting paid for with an oddly huge bill.
        const paymentPool = this.price >= 10 ? PAYMENT_BILLS : PAYMENT_BILLS.filter((bill) => bill <= 20);
        const validBills = paymentPool.filter((bill) => bill > this.price);
        this.payment = randomItem(validBills.length > 0 ? validBills : [Math.max(...PAYMENT_BILLS)]);

        this.customer = this.add.image(CUSTOMER_START_X, FLOOR_Y, randomItem(CUSTOMER_KEYS));
        this.customer.setOrigin(0.5, 1);
        this.customer.setDisplaySize(CUSTOMER_DISPLAY_SIZE, CUSTOMER_DISPLAY_SIZE);

        // The same idle bob as the cashier — a little life in the walk and
        // while they're standing at the counter.
        this.tweens.add({
            targets: this.customer,
            y: FLOOR_Y - 6,
            duration: 1500,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        const layout = ITEM_LAYOUTS[this.currentItems.length];

        this.itemIcons = this.currentItems.map((item, index) => {
            const offsetX = (index - (this.currentItems.length - 1) / 2) * layout.spacing;
            const iconX = ICON_CLUSTER_X + offsetX;

            const icon = this.add.image(iconX, ICON_CLUSTER_Y, item.key);
            icon.setDisplaySize(layout.size * 0.7, layout.size * 0.7);
            icon.setAlpha(0);
            icon.setData('targetSize', layout.size);
            this.itemIconGroup.add(icon);

            const priceTag = this.add.text(iconX, ICON_CLUSTER_Y + layout.size / 2 + 6, `$${item.price}`, {
                fontFamily: FONT_UI, fontStyle: '700', fontSize: 14, color: TEXT_DARK
            }).setOrigin(0.5).setAlpha(0);
            this.itemIconGroup.add(priceTag);
            this.itemPriceTags.push(priceTag);

            return icon;
        });

        this.tweens.add({
            targets: this.customer,
            x: CUSTOMER_MEET_X,
            duration: 1300,
            ease: 'Sine.easeInOut',
            onComplete: () => {
                // A soft doorbell-style ping as the customer reaches the
                // counter, right before their items are revealed.
                this.sound.play('sfx-ui-sound', { volume: 0.3 });
                this.presentItems();
            }
        });
    }

    private presentItems (): void
    {
        this.itemIcons.forEach((icon, index) => {
            const targetSize = icon.getData('targetSize') as number;
            this.tweens.add({
                targets: icon,
                alpha: 1,
                displayWidth: targetSize,
                displayHeight: targetSize,
                duration: 300,
                delay: index * 80,
                ease: 'Back.Out'
            });
        });

        this.itemPriceTags.forEach((tag, index) => {
            this.tweens.add({
                targets: tag,
                alpha: 1,
                duration: 250,
                delay: index * 80 + 100
            });
        });

        this.infoText.setText(`Total $${this.price}  •  Customer pays with a $${this.payment} bill  •  Level ${this.difficultyLevel + 1}`);

        this.time.delayedCall(400, () => {
            this.state = 'awaiting-change';
            this.setControlsActive(true);
            // The speed-bonus clock starts here, not when the customer
            // walked in — the player can't act until controls are live.
            this.roundStartTime = this.time.now;
        });
    }

    private loseLife (): void
    {
        this.lives = Math.max(0, this.lives - 1);
        this.refreshLivesDots();
        this.punch(this.livesPillContainer, 1.2);

        if (this.lives <= 0) this.ranOutOfLives = true;
    }

    // Three strikes closes the shop early — the customer still walks off
    // like any other resolved round, it just leads to endDay() instead of
    // the next customer.
    private handleLifeLossIfAny (): void
    {
        if (!this.ranOutOfLives) return;

        this.state = 'resolving';
        this.setControlsActive(false);
        this.time.delayedCall(1300, () => this.walkCustomerOut());
    }

    private handleConfirm (): void
    {
        if (this.state !== 'awaiting-change') return;

        const changeDue = this.payment - this.price;

        if (this.givenAmount !== changeDue)
        {
            this.roundHadMistake = true;
            this.loseLife();
            const breakdown = formatBillBreakdown(minimalBillBreakdown(changeDue));
            this.showFeedback('incorrect', `Not Quite — Customer is owed $${changeDue}`, `Correct change: ${breakdown}`);
            this.resetGivenAmount();
            this.handleLifeLossIfAny();
            return;
        }

        if (this.getBillsUsedCount() > minimalBillCount(changeDue))
        {
            this.roundHadMistake = true;
            this.loseLife();
            const breakdown = formatBillBreakdown(minimalBillBreakdown(changeDue));
            this.showFeedback('half', 'Right Amount — Fewer Bills Works', `Try: ${breakdown}`);
            this.resetGivenAmount();
            this.handleLifeLossIfAny();
            return;
        }

        if (!this.roundHadMistake) this.firstTryCorrect += 1;
        this.totalCustomerTimeMs += this.time.now - this.customerArrivalTime;

        const elapsedSeconds = (this.time.now - this.roundStartTime) / 1000;
        const speedMultiplier = getSpeedBonusMultiplier(elapsedSeconds);
        const payout = Math.round(this.price * speedMultiplier);

        this.score += 1;
        this.scoreText.setText(`Served: ${this.score}`);
        this.punch(this.scorePillContainer, 1.25);
        this.revenue += payout;
        this.revenueText.setText(`Revenue: $${this.revenue}`);
        this.punch(this.revenuePillContainer, 1.25);
        this.sound.play('sfx-correct');

        // Every fifth sale gets an extra flourish on top of the usual
        // register sting — a small escalating reward for a streak.
        if (this.score % 5 === 0)
        {
            this.sound.play('sfx-progression', { volume: 0.6 });
            this.cameras.main.flash(300, 243, 129, 74);
        }

        const bonusPercent = Math.round((speedMultiplier - 1) * 100);
        const message = bonusPercent > 0
            ? `Correct Change! +$${payout} (+${bonusPercent}% Speed)`
            : 'Correct Change!';

        this.showFeedback('correct', message);
        this.state = 'resolving';
        this.setControlsActive(false);
        this.resetGivenAmount();
        this.time.delayedCall(900, () => this.walkCustomerOut());
    }

    private drawXIcon (x: number, y: number, size: number, color: number): void
    {
        const g = this.add.graphics();
        g.lineStyle(4, color, 1);
        g.beginPath();
        g.moveTo(x - size / 2, y - size / 2);
        g.lineTo(x + size / 2, y + size / 2);
        g.moveTo(x + size / 2, y - size / 2);
        g.lineTo(x - size / 2, y + size / 2);
        g.strokePath();
        this.feedbackContainer.add(g);
    }

    private drawNoticeIcon (x: number, y: number, size: number, color: number): void
    {
        const g = this.add.graphics();
        g.fillStyle(color, 1);
        g.fillRoundedRect(x - size * 0.12, y - size * 0.5, size * 0.24, size * 0.6, size * 0.12);
        g.fillCircle(x, y + size * 0.42, size * 0.13);
        this.feedbackContainer.add(g);
    }

    private showFeedback (kind: 'correct' | 'incorrect' | 'half', message: string, breakdown?: string): void
    {
        // Each outcome gets its own sound and its own amount of camera
        // "kick" — a flat-out wrong answer should feel more jarring than a
        // right-amount-wrong-bills near miss.
        if (kind === 'incorrect')
        {
            this.sound.play('sfx-error', { volume: 0.5 });
            this.cameras.main.shake(220, 0.006);
        }
        else if (kind === 'half')
        {
            this.sound.play('sfx-chime', { volume: 0.5 });
            this.cameras.main.shake(120, 0.0025);
        }

        this.tweens.killTweensOf(this.feedbackContainer);
        this.feedbackContainer.removeAll(true);
        this.feedbackContainer.setScale(0.8);
        this.feedbackContainer.setAlpha(1);

        const theme = {
            correct: { border: ACCENT_GREEN, text: '#1f7a43' },
            incorrect: { border: ACCENT_RED, text: '#a23a22' },
            half: { border: ACCENT_ORANGE_DARK, text: '#8a5210' }
        }[kind];

        const paddingX = 26;
        const iconSlot = 34;
        const gap = 14;
        const labelY = breakdown ? -14 : 0;
        const cardHeight = breakdown ? 88 : 64;

        const label = this.add.text(0, labelY, message, {
            fontFamily: FONT_UI, fontStyle: '700', fontSize: 20, color: theme.text
        }).setOrigin(0, 0.5);

        // The correct change isn't shown up front — a small "Show hint"
        // pill sits in its place, and only reveals the answer on request.
        let detail: GameObjects.Text | null = null;
        let hintButton: GameObjects.Container | null = null;
        let contentWidth = iconSlot + gap + label.width;

        if (breakdown)
        {
            detail = this.add.text(0, 16, breakdown, {
                fontFamily: FONT_SERIF, fontSize: 19, color: theme.text
            }).setOrigin(0, 0.5).setAlpha(0);

            const hintLabel = this.add.text(0, 0, 'Show hint', {
                fontFamily: FONT_UI, fontStyle: '700', fontSize: 15, color: theme.text
            }).setOrigin(0, 0.5);

            const hintPadX = 12;
            const hintHeight = 26;
            const hintWidth = hintLabel.width + hintPadX * 2;

            const hintBg = this.add.graphics();
            hintBg.fillStyle(theme.border, 0.14);
            hintBg.fillRoundedRect(0, -hintHeight / 2, hintWidth, hintHeight, hintHeight / 2);

            hintLabel.setPosition(hintPadX, 0);

            const hintHitZone = this.add.zone(hintWidth / 2, 0, hintWidth, hintHeight).setInteractive({ useHandCursor: true });

            hintButton = this.add.container(0, 16, [hintBg, hintLabel, hintHitZone]);

            contentWidth = Math.max(contentWidth, iconSlot + gap + hintWidth);

            hintHitZone.on('pointerdown', () => {
                // A distinct "reveal" cue rather than the generic button
                // click — this is information appearing, not an action firing.
                this.sound.play('sfx-ui-sound', { volume: 0.45 });

                hintButton?.destroy();
                hintButton = null;

                // The answer text is almost always wider than the "Show
                // hint" pill it replaces — grow the card to the right so
                // it doesn't get clipped, without disturbing the icon/label
                // pinned to the fixed left edge.
                const revealedWidth = Math.max(contentWidth, iconSlot + gap + (detail?.width ?? 0));
                const revealedCardWidth = revealedWidth + paddingX * 2;

                shadow.clear();
                shadow.fillStyle(SHADOW_COLOR, 0.18);
                shadow.fillRoundedRect(leftEdge + 3, -cardHeight / 2 + 5, revealedCardWidth, cardHeight, RADIUS_CARD - 6);

                bg.clear();
                bg.fillStyle(CARD_COLOR, 0.98);
                bg.fillRoundedRect(leftEdge, -cardHeight / 2, revealedCardWidth, cardHeight, RADIUS_CARD - 6);

                detail?.setScale(0.85);
                this.tweens.add({ targets: detail, alpha: 1, scale: 1, duration: 220, ease: 'Back.Out' });

                this.tweens.killTweensOf(this.feedbackContainer);
                this.tweens.add({
                    targets: this.feedbackContainer,
                    alpha: 0,
                    delay: 2400,
                    duration: 400
                });
            });
        }

        const cardWidth = contentWidth + paddingX * 2;
        const leftEdge = -cardWidth / 2;

        // A clean white card (no outline) with the status color carried
        // entirely by a solid icon chip, matching the reference's flat
        // cards + colored icon-badge language.
        const shadow = this.add.graphics();
        shadow.fillStyle(SHADOW_COLOR, 0.18);
        shadow.fillRoundedRect(leftEdge + 3, -cardHeight / 2 + 5, cardWidth, cardHeight, RADIUS_CARD - 6);

        const bg = this.add.graphics();
        bg.fillStyle(CARD_COLOR, 0.98);
        bg.fillRoundedRect(leftEdge, -cardHeight / 2, cardWidth, cardHeight, RADIUS_CARD - 6);

        const iconCenterX = leftEdge + paddingX + iconSlot / 2;
        const textX = leftEdge + paddingX + iconSlot + gap;
        label.setPosition(textX, labelY);
        detail?.setPosition(textX, 16);
        hintButton?.setPosition(textX, 16);

        const iconBadge = this.add.circle(iconCenterX, 0, iconSlot / 2, theme.border, 0.15);

        this.feedbackContainer.add([shadow, bg, iconBadge]);

        if (kind === 'correct')
        {
            const check = this.add.image(iconCenterX, 0, 'icon-check');
            check.setDisplaySize(28, 26);
            check.setTint(theme.border);
            this.feedbackContainer.add(check);
        }
        else if (kind === 'incorrect')
        {
            this.drawXIcon(iconCenterX, 0, 24, theme.border);
        }
        else
        {
            this.drawNoticeIcon(iconCenterX, 0, 30, theme.border);
        }

        this.feedbackContainer.add(label);
        if (detail) this.feedbackContainer.add(detail);
        if (hintButton) this.feedbackContainer.add(hintButton);

        this.tweens.add({
            targets: this.feedbackContainer,
            scale: 1,
            duration: 150,
            ease: 'Back.Out'
        });

        this.tweens.add({
            targets: this.feedbackContainer,
            alpha: 0,
            delay: breakdown ? 2200 : 900,
            duration: 400
        });
    }

    private walkCustomerOut (): void
    {
        if (!this.customer) return;

        this.state = 'walking-out';

        const delta = CUSTOMER_START_X - CUSTOMER_MEET_X;

        this.tweens.add({
            targets: this.customer,
            x: `+=${delta}`,
            alpha: 0,
            duration: 1100,
            ease: 'Sine.easeInOut',
            onComplete: () => {
                if (this.customer) this.tweens.killTweensOf(this.customer);
                this.customer?.destroy();
                this.customer = null;
            }
        });

        this.tweens.add({
            targets: [...this.itemIcons, ...this.itemPriceTags],
            alpha: 0,
            duration: 400,
            onComplete: () => {
                this.itemIcons.forEach((icon) => icon.destroy());
                this.itemPriceTags.forEach((tag) => tag.destroy());
                this.itemIcons = [];
                this.itemPriceTags = [];
            }
        });

        const dayIsOver = this.ranOutOfLives || (this.time.now - this.dayStartTime >= DAY_DURATION_MS);
        this.infoText.setText(dayIsOver ? 'Closing up for the day…' : 'Waiting for the next customer…');
        this.time.delayedCall(1600, () => {
            if (dayIsOver) this.endDay();
            else this.startNewCustomer();
        });
    }

    private endDay (): void
    {
        this.state = 'idle';
        this.setControlsActive(false);

        const totalCustomers = this.roundNumber;
        const avgTimeSeconds = totalCustomers > 0 ? (this.totalCustomerTimeMs / totalCustomers) / 1000 : 0;

        // Fade the music out alongside a camera fade-to-black, and only swap
        // scenes once the screen is fully covered — switching scenes
        // instantly reads as a jump cut rather than a day ending.
        this.music.removeAllListeners('complete');
        this.tweens.add({ targets: this.music, volume: 0, duration: 700 });
        this.cameras.main.fadeOut(800, 26, 18, 11);

        this.cameras.main.once('camerafadeoutcomplete', () => {
            this.music.stop();
            this.scene.start('GameOver', {
                ranOutOfLives: this.ranOutOfLives,
                totalCustomers,
                firstTryCorrect: this.firstTryCorrect,
                revenue: this.revenue,
                avgTimeSeconds
            });
        });
    }
}
