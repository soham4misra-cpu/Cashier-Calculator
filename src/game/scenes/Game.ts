import { BlendModes, Scene, GameObjects } from 'phaser';
import { DayLength, DEFAULT_DAY_LENGTH, DEFAULT_DIFFICULTY, getBillsTarget, getDayLengthScale, getPayoutMultiplier, Difficulty, TOTAL_DAYS } from '../economy';
import { playSfx } from '../audio';
import { pickRemark } from '../remarks';
import { applyAnimationSpeed, DEFAULT_SETTINGS } from '../settings';
import { scaledFontSize } from '../ui/text';
import { TypewriterText } from '../ui/typewriter';

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
    // Per-unit price; the line costs unitPrice * quantity.
    unitPrice: number;
    quantity: number;
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
const PAYMENT_BILLS = [5, 10, 20, 50, 100];

// Totals a customer needs before they'll plausibly hand over a big bill —
// below these, a $50 or $100 for a cheap order would just look odd.
const FIFTY_MIN_PRICE = 10;
const HUNDRED_MIN_PRICE = 25;

// Difficulty ramps with how many customers have come through, not with the
// player's accuracy — orders keep growing even through a rough patch.
const ROUNDS_PER_LEVEL = 3;
const MAX_ITEM_COUNT = Object.keys(ITEM_LAYOUTS).length;
const PREMIUM_UNLOCK_LEVEL = 2;
const MAX_PRICE_SCALE = 1.6;
const PRICE_SCALE_PER_LEVEL = 0.12;

// Bulk orders: from this level on, an item can come in a stack of 2-4
// (priced per unit), pushing totals — and the change owed from a $50 or
// $100 — well past what single items reach. The odds and the stack size
// both grow with level.
const BULK_UNLOCK_LEVEL = 3;
const BULK_BASE_CHANCE = 0.15;
const BULK_CHANCE_PER_LEVEL = 0.05;
const BULK_MAX_CHANCE = 0.6;
const BULK_MAX_QUANTITY = 4;

// Five days, each a fixed stretch of real time (not a fixed customer
// count) — a fast, accurate player naturally serves more customers in it
// than a slow or mistake-prone one. Days get longer as they go, from a
// tight 60s opener up to a full 3-minute closer.
const DAY_DURATIONS_MS = [60, 90, 120, 150, 180].map((seconds) => seconds * 1000);

// The in-game clock always runs 9am-5pm regardless of how long the day's
// real-time budget is — an 8-hour shop day compressed into 60-180 seconds
// (30-90 on the Short day length).
const DAY_START_HOUR = 9;
const DAY_END_HOUR = 17;

// Time-of-day lighting: bright warm morning -> orange/purple sunset ->
// dark blue evening, following the shop clock. Two full-screen gradient
// layers sit between the world (depth 0: background, cashier, customers)
// and the UI (depth 10+), so the HUD, change panel and bubbles stay
// untouched. `multiply` tints and darkens; `add` is the light spilling in
// from the top-left (sun in the morning, cool moonlight at night).
// Corner colours are [top-left, top-right, bottom-left, bottom-right].
const LIGHTING_DEPTH = 5;

interface LightingStop
{
    at: number;
    multiply: [number, number, number, number];
    add: [number, number, number, number];
}

// Fitted against reference mock-ups of each time of day: morning is warm
// sunlight pouring in on the left with the right side left near-natural;
// sunset keeps a warm left but pushes purple/blue into the right; night
// darkens everything, with a cool blue cast strongest at the top-left.
const LIGHTING_STOPS: LightingStop[] = [
    {
        at: 0,
        multiply: [0xffffff, 0xfbffff, 0xffffff, 0xecffff],
        add: [0x321d03, 0x00090d, 0x2d1b04, 0x000807]
    },
    {
        at: 0.2,
        multiply: [0xffffff, 0xfbffff, 0xffffff, 0xecffff],
        add: [0x321d03, 0x00090d, 0x2d1b04, 0x000807]
    },
    {
        at: 0.6,
        multiply: [0xfff0e2, 0xeae6ff, 0xf8e2e2, 0xd8d0ff],
        add: [0x3a0e00, 0x0a0022, 0x240604, 0x100030]
    },
    {
        at: 1,
        multiply: [0xa0baba, 0x5973ba, 0x6b7394, 0x57809e],
        add: [0x061444, 0x000008, 0x00040c, 0x000000]
    }
];

function lerpColor (from: number, to: number, t: number): number
{
    const channel = (shift: number) => {
        const a = (from >> shift) & 0xff;
        const b = (to >> shift) & 0xff;
        return Math.round(a + (b - a) * t) << shift;
    };
    return channel(16) | channel(8) | channel(0);
}

function getLighting (dayFraction: number): { multiply: number[]; add: number[] }
{
    const t = Math.min(1, Math.max(0, dayFraction));
    const nextIndex = Math.max(1, LIGHTING_STOPS.findIndex((stop) => stop.at >= t));
    const from = LIGHTING_STOPS[nextIndex - 1];
    const to = LIGHTING_STOPS[nextIndex];
    const local = (t - from.at) / (to.at - from.at);

    // Smoothstep so each phase eases in and out instead of changing linearly.
    const eased = local * local * (3 - 2 * local);

    return {
        multiply: from.multiply.map((color, i) => lerpColor(color, to.multiply[i], eased)),
        add: from.add.map((color, i) => lerpColor(color, to.add[i], eased))
    };
}

// Difficulty also carries over between days — day 5 opens already harder
// than day 1 ever gets, on top of its own within-day ramp.
const LEVELS_PER_DAY = 2;

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
const ACCENT_BLUE = 0x4a8fd9;
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
// idle bob, and walk-out treatment regardless of which one shows up. The
// previous round's customer is left out of the draw, so nobody shows up
// twice in a row.
const CUSTOMER_KEYS = ['customer', 'customer2', 'customer3', 'customer4'];

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

// Day 1 starts at the base ramp; each day after that opens with a
// permanently higher floor, on top of which the within-day ramp still
// applies.
function getDayDifficultyBonus (day: number): number
{
    return (day - 1) * LEVELS_PER_DAY;
}

// Stars reward accuracy across the whole day (not raw mistake count, so a
// single slip on a long day doesn't hit as hard as one on a short day),
// capped low if the day ended early from running out of lives.
function getStarRating (accuracyPercent: number, ranOutOfLives: boolean): number
{
    let stars = 0;

    if (accuracyPercent >= 90) stars = 3;
    else if (accuracyPercent >= 70) stars = 2;
    else if (accuracyPercent >= 40) stars = 1;

    return ranOutOfLives ? Math.min(stars, 1) : stars;
}

// Formats the fraction of the day's real-time budget that has elapsed as a
// 9am-5pm shop clock, e.g. "11:32 AM".
function formatShopClock (dayFraction: number): string
{
    const clamped = Math.min(1, Math.max(0, dayFraction));
    const totalMinutes = clamped * (DAY_END_HOUR - DAY_START_HOUR) * 60;
    const hour24 = DAY_START_HOUR + Math.floor(totalMinutes / 60);
    const minute = Math.floor(totalMinutes % 60);
    const period = hour24 >= 12 ? 'PM' : 'AM';
    const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;

    return `${hour12}:${minute.toString().padStart(2, '0')} ${period}`;
}

function getAvailableItems (level: number): ItemDefinition[]
{
    return ITEMS.filter((item) => !item.premium || level >= PREMIUM_UNLOCK_LEVEL);
}

function getPriceScale (level: number): number
{
    return Math.min(MAX_PRICE_SCALE, 1 + level * PRICE_SCALE_PER_LEVEL);
}

function randomQuantity (level: number): number
{
    if (level < BULK_UNLOCK_LEVEL) return 1;

    const levelsIn = level - BULK_UNLOCK_LEVEL;
    const chance = Math.min(BULK_MAX_CHANCE, BULK_BASE_CHANCE + levelsIn * BULK_CHANCE_PER_LEVEL);
    if (Math.random() >= chance) return 1;

    return randomInt(2, Math.min(BULK_MAX_QUANTITY, 2 + Math.floor(levelsIn / 2)));
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
    clockText: GameObjects.Text;
    scorePillContainer: GameObjects.Container;
    revenuePillContainer: GameObjects.Container;
    clockPillContainer: GameObjects.Container;
    livesPillContainer: GameObjects.Container;
    livesDots: GameObjects.Arc[] = [];
    infoText: GameObjects.Text;
    infoTypewriter: TypewriterText;
    totalText: GameObjects.Text;
    feedbackContainer: GameObjects.Container;
    music: Phaser.Sound.BaseSound;
    musicTrackIndex = 0;
    confirmGlow: GameObjects.Arc;
    confirmGlowTween: Phaser.Tweens.Tween | null = null;
    pauseButtonContainer: GameObjects.Container;

    changeUI: GameObjects.Container;
    itemIconGroup: GameObjects.Container;
    controlsGroup: GameObjects.Container;
    billCountTexts: Map<number, GameObjects.Text> = new Map();
    billCountBadges: Map<number, GameObjects.Graphics> = new Map();
    billCounts: Map<number, number> = new Map();

    state: RoundState = 'idle';
    score = 0;
    revenue = 0;
    payoutMultiplier = 1;
    price = 0;
    payment = 0;
    givenAmount = 0;
    roundNumber = 0;
    difficultyLevel = 0;
    roundStartTime = 0;
    dayStartTime = 0;
    lightTint: GameObjects.Graphics;
    lightGlow: GameObjects.Graphics;
    customerArrivalTime = 0;
    totalCustomerTimeMs = 0;
    firstTryCorrect = 0;
    roundHadMistake = false;
    lives = MAX_LIVES;
    ranOutOfLives = false;
    dayEnding = false;
    currentDay = 1;
    dayDurationMs = DAY_DURATIONS_MS[0];
    currentItems: PurchaseItem[] = [];
    // Deliberately not reset in create() — carrying it over means the
    // last customer of one day can't open the next one either.
    lastCustomerKey: string | null = null;

    // Arrow-function fields so these stay stable references across this
    // scene instance's repeated create() calls (Phaser reuses the instance
    // on "Start Next Day") — every .on() below is paired with a matching
    // .off() using these exact same references to avoid stacking duplicate
    // listeners on every restart.
    // `this.time.now` mirrors the engine's global clock, not "time this
    // scene has spent active" — it keeps advancing in the background for
    // the whole real-world duration of a pause, even though step()/update()
    // aren't called while paused. Left alone, every elapsed-time check below
    // (day budget, round speed bonus) would silently eat the pause's real
    // wall-clock duration and then jump forward the instant the scene
    // resumes. Date.now() (unaffected by Phaser's own clock) measures that
    // duration so the absolute-time markers can be shifted forward by
    // exactly as long as the pause lasted, making every "time since X"
    // calculation below behave as if the pause never happened.
    private pausedAtRealTime: number | null = null;
    private handleScenePause = (): void => {
        this.music?.pause();
        this.pausedAtRealTime = Date.now();
    };
    private handleSceneResume = (): void => {
        this.music?.resume();
        // Animation Speed can be changed from the pause menu's Settings —
        // pick it up now rather than only when the next day starts.
        applyAnimationSpeed(this);
        if (this.pausedAtRealTime !== null)
        {
            const pausedMs = Date.now() - this.pausedAtRealTime;
            this.dayStartTime += pausedMs;
            this.roundStartTime += pausedMs;
            this.customerArrivalTime += pausedMs;
            this.pausedAtRealTime = null;
        }
    };
    private handleSceneShutdown = (): void => { this.music?.stop(); };
    private handleMusicVolumeChange = (_parent: unknown, value: number): void => {
        // `volume`/`setVolume` are declared on the concrete WebAudioSound/
        // HTML5AudioSound subclasses, not on the abstract BaseSound type
        // `this.music` is typed as — every sound this project actually
        // creates at runtime is one of those two.
        (this.music as Phaser.Sound.WebAudioSound | undefined)?.setVolume(MUSIC_VOLUME * value);
    };
    private openPauseMenu = (): void => {
        // Pausing mid fade-out would freeze the fade with the pause menu
        // up, and Resume would then leave that menu over the next scene.
        if (this.scene.isPaused() || this.dayEnding) return;
        playSfx(this, 'sfx-ui-click', { volume: 0.5 });
        this.scene.pause('Game');
        this.scene.launch('PauseMenu', { returnTo: 'Game' });
    };

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
        applyAnimationSpeed(this);

        // Phaser reuses this same Scene instance across restarts (Start Next
        // Day -> 'Game' again), so the class-field initializers above only
        // ever ran once — every stat has to be zeroed explicitly here or a
        // "new" day would silently inherit the last one's numbers.
        this.state = 'idle';
        this.score = 0;
        this.revenue = 0;
        this.payoutMultiplier = getPayoutMultiplier(this.registry.get('multiplierLevel') ?? 0);
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
        this.dayEnding = false;
        this.livesDots = [];
        this.currentItems = [];
        this.itemIcons = [];
        this.itemPriceTags = [];
        this.billCounts.clear();
        this.billCountTexts.clear();
        this.billCountBadges.clear();
        // Not this.time.now: a scene's clock only updates once the scene is
        // running, so in create() it still holds whenever this scene last
        // ran (or 0 on first launch) — and the menus, summary and shop time
        // would all count against the day. game.loop.now is the value the
        // clock is about to be fed on its first tick.
        this.dayStartTime = this.game.loop.now;

        // Persisted in the registry (not scene data) so it survives "Start
        // Next Day" restarts of this same scene instance. Defaults to day 1
        // for a brand new session.
        this.currentDay = this.registry.get('currentDay') ?? 1;
        // The chosen Day Length shrinks the whole schedule (Short halves it).
        const dayLength: DayLength = this.registry.get('dayLength') ?? DEFAULT_DAY_LENGTH;
        this.dayDurationMs = DAY_DURATIONS_MS[Math.min(this.currentDay, TOTAL_DAYS) - 1] * getDayLengthScale(dayLength);

        this.background = this.add.image(512, 384, 'shop-bg');
        this.background.setDisplaySize(1024, 768);

        this.lightTint = this.add.graphics().setDepth(LIGHTING_DEPTH).setBlendMode(BlendModes.MULTIPLY);
        this.lightGlow = this.add.graphics().setDepth(LIGHTING_DEPTH).setBlendMode(BlendModes.ADD);
        this.updateLighting(0);

        // Which track opens the day is random, so it isn't always the same
        // song playing "first" every time.
        this.musicTrackIndex = randomInt(0, MUSIC_TRACKS.length - 1);
        this.playNextTrack(MUSIC_INTRO_FADE_MS);

        // See the arrow-field comment above — these must be paired
        // off()/on() since this Scene instance is reused across restarts.
        this.events.off('pause', this.handleScenePause);
        this.events.on('pause', this.handleScenePause);
        this.events.off('resume', this.handleSceneResume);
        this.events.on('resume', this.handleSceneResume);
        this.events.off('shutdown', this.handleSceneShutdown);
        this.events.on('shutdown', this.handleSceneShutdown);
        this.registry.events.off('changedata-musicVolume', this.handleMusicVolumeChange);
        this.registry.events.on('changedata-musicVolume', this.handleMusicVolumeChange);
        this.input.keyboard?.off('keydown-ESC', this.openPauseMenu);
        this.input.keyboard?.on('keydown-ESC', this.openPauseMenu);

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

        // Four evenly-spaced pills across the top — the same safe "clear of
        // the characters" strip the stat pills already lived in, so the
        // clock has a natural home without touching layout anywhere else.
        const topRowCenters = [112, 378.67, 645.33, 890];

        const scorePill = this.createStatPill(topRowCenters[0], 'center', 'Served: 0', ACCENT_GREEN);
        this.scoreText = scorePill.text;
        this.scorePillContainer = scorePill.container;

        const clockPill = this.createStatPill(topRowCenters[1], 'center', formatShopClock(0), ACCENT_BLUE);
        this.clockText = clockPill.text;
        this.clockPillContainer = clockPill.container;

        const revenuePill = this.createStatPill(topRowCenters[2], 'center', 'Revenue: $0', ACCENT_ORANGE);
        this.revenueText = revenuePill.text;
        this.revenuePillContainer = revenuePill.container;

        // Shrunk slightly from the other pills' default 176px width to make
        // room for the pause button at the end of the top row.
        const livesPill = this.createLivesPill(topRowCenters[3], 140);
        this.livesPillContainer = livesPill.container;
        this.livesDots = livesPill.dots;

        this.pauseButtonContainer = this.createPauseButton(994, 44);

        this.feedbackContainer = this.add.container(512, 165).setDepth(10).setAlpha(0);

        this.createChangeUI();

        this.tweens.add({
            targets: [this.cashier, scorePill.container, clockPill.container, revenuePill.container, livesPill.container, this.pauseButtonContainer, this.changeUI],
            alpha: 1,
            duration: 700,
            ease: 'Sine.easeOut'
        });

        this.time.delayedCall(600, () => this.startNewCustomer());
    }

    // Ticks the 9am-5pm shop clock forward each frame, mapped from however
    // much of the day's real-time budget has elapsed.
    update (): void
    {
        if (!this.clockText || !this.dayDurationMs) return;

        const fraction = (this.time.now - this.dayStartTime) / this.dayDurationMs;
        const formatted = formatShopClock(fraction);

        if (this.clockText.text !== formatted) this.clockText.setText(formatted);

        this.updateLighting(fraction);
    }

    private updateLighting (dayFraction: number): void
    {
        const { multiply, add } = getLighting(dayFraction);

        this.lightTint.clear();
        this.lightTint.fillGradientStyle(multiply[0], multiply[1], multiply[2], multiply[3], 1);
        this.lightTint.fillRect(0, 0, 1024, 768);

        this.lightGlow.clear();
        this.lightGlow.fillGradientStyle(add[0], add[1], add[2], add[3], 1);
        this.lightGlow.fillRect(0, 0, 1024, 768);
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

        const musicVolume = (this.registry.get('musicVolume') as number) ?? DEFAULT_SETTINGS.musicVolume;
        const targetVolume = MUSIC_VOLUME * musicVolume;

        // Explicit `from` rather than letting the tween read the sound's
        // current volume: a WebAudio GainNode's value can read back stale
        // for a tick right after a fresh sound starts playing, which made
        // the tween capture ~1 as its start point instead of the 0 we just
        // configured it with.
        this.tweens.add({ targets: track, volume: { from: 0, to: targetVolume }, duration: fadeInMs, ease: 'Sine.easeIn' });

        track.once('complete', () => {
            this.tweens.add({
                targets: track,
                volume: { from: targetVolume, to: 0 },
                duration: MUSIC_CROSSFADE_MS,
                onComplete: () => track.stop()
            });
            this.playNextTrack(MUSIC_CROSSFADE_MS);
        });
    }

    private createStatPill (x: number, align: 'left' | 'center' | 'right', label: string, accent: number): { container: GameObjects.Container; text: GameObjects.Text }
    {
        const height = 48;
        const pillRadius = height / 2;

        // Measure the label at its actual (Text Size-scaled) font size
        // first, so the pill can grow to fit it — 176 is a floor, not a
        // fixed size, so normal play keeps today's look.
        const text = this.add.text(0, height / 2, label, {
            fontFamily: FONT_UI, fontStyle: '700', fontSize: scaledFontSize(18, this.registry), color: TEXT_DARK
        }).setOrigin(0, 0.5);

        const badgeInset = 26;
        const badgeToTextGap = 25;
        const rightPadding = 20;
        const width = Math.max(176, badgeInset + badgeToTextGap + text.width + rightPadding);
        const left = align === 'right' ? -width : align === 'center' ? -width / 2 : 0;

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
        const badgeX = left + badgeInset;
        const badge = this.add.circle(badgeX, height / 2, 15, accent, 0.16);
        const dot = this.add.circle(badgeX, height / 2, 7, accent);

        text.setPosition(badgeX + badgeToTextGap, height / 2);

        const container = this.add.container(x, 20, [shadow, bg, badge, dot, text]);
        container.setDepth(10);

        return { container, text };
    }

    // Same white pill shell as createStatPill, but the "value" is three
    // dots instead of a number — a heart-style life counter that fills in
    // green and empties to a hollow outline as mistakes cost lives.
    private createLivesPill (x: number, width = 176): { container: GameObjects.Container; dots: GameObjects.Arc[] }
    {
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
            fontFamily: FONT_UI, fontStyle: '700', fontSize: scaledFontSize(18, this.registry), color: TEXT_DARK
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

    // A small HUD button, same shadow+bg+zone shape as the bill/clear/confirm
    // buttons below — drawn with a plain pause-glyph (two bars) rather than
    // a new image asset, matching this project's "no UI image assets"
    // convention.
    private createPauseButton (x: number, y: number): GameObjects.Container
    {
        const size = 44;
        const { shadow, bg } = this.drawButtonBackground(size, size, CARD_COLOR, 1, 14);

        const bars = this.add.graphics();
        bars.fillStyle(0x2b241d, 1);
        bars.fillRoundedRect(-7, -9, 5, 18, 2);
        bars.fillRoundedRect(2, -9, 5, 18, 2);

        // Hit area larger than the 44px icon so it stays easy to tap once
        // the game is scaled down on a phone.
        const hitZone = this.add.zone(0, 0, size + 28, size + 28);
        const container = this.add.container(x, y, [shadow, bg, bars, hitZone]);
        container.setDepth(10);

        this.attachButtonInteractions(hitZone, container, () => this.openPauseMenu());

        return container;
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
            fontFamily: FONT_SERIF, fontSize: scaledFontSize(25, this.registry), color: TEXT_DARK,
            lineSpacing: 8
        });
        this.infoTypewriter = new TypewriterText(this, this.infoText);

        this.totalText = this.add.text(panelX + 26, PANEL_Y + 66, 'Change given: $0', {
            fontFamily: FONT_UI, fontStyle: '700', fontSize: scaledFontSize(23, this.registry), color: toCssColor(ACCENT_ORANGE)
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
            playSfx(this, 'sfx-ui-click', { volume: 0.5, detune: randomInt(-80, 80) });
            onClick();
        });

        hitZone.on('pointerover', (pointer: Phaser.Input.Pointer) => {
            // Touch fires 'over' right after 'down' — skip it so the press
            // squash isn't overridden by a hover grow.
            if (pointer.wasTouch) return;
            this.tweens.killTweensOf(container);
            this.tweens.add({ targets: container, scale: 1.06, duration: 150, ease: 'Sine.easeOut' });
        });

        hitZone.on('pointerout', (pointer: Phaser.Input.Pointer) => {
            if (pointer.wasTouch) return;
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
            fontFamily: FONT_UI, fontStyle: '700', fontSize: scaledFontSize(14, this.registry), color: '#ffffff'
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
        const height = 52;

        const label = this.add.text(0, 0, 'Clear', {
            fontFamily: FONT_UI, fontStyle: '700', fontSize: scaledFontSize(16, this.registry), color: TEXT_MUTED
        }).setOrigin(0.5);

        // Fit the pill to the label at its actual (Text Size-scaled) width
        // rather than clipping it against a fixed 108px.
        const width = Math.max(108, label.width + 40);

        const { shadow, bg } = this.drawButtonBackground(width, height, 0xf3ede2, 1, height / 2);

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
        // A new customer only follows the day opening or the previous one
        // leaving — never while someone is still at the counter.
        if (this.dayEnding || (this.state !== 'idle' && this.state !== 'walking-out')) return;

        this.state = 'walking-in';
        this.resetGivenAmount();
        this.setControlsActive(false);
        this.feedbackContainer.setAlpha(0);
        this.infoTypewriter.reveal('A customer is walking in…');
        this.itemPriceTags = [];
        this.customerArrivalTime = this.time.now;
        this.roundHadMistake = false;

        // Difficulty is driven by how many customers have come through today,
        // plus a permanent floor that rises with the day number — day 5
        // never starts as easy as day 1, on top of its own within-day ramp.
        const level = getDifficultyLevel(this.roundNumber) + getDayDifficultyBonus(this.currentDay);
        this.difficultyLevel = level;
        this.roundNumber += 1;

        const priceScale = getPriceScale(level);
        const itemDefs = shuffled(getAvailableItems(level)).slice(0, randomItemCount(level));
        this.currentItems = itemDefs.map((def) => {
            const unitPrice = Math.max(def.minPrice, Math.round(randomInt(def.minPrice, def.maxPrice) * priceScale));
            const quantity = randomQuantity(level);
            return { key: def.key, name: def.name, unitPrice, quantity, price: unitPrice * quantity };
        });
        this.price = this.currentItems.reduce((sum, item) => sum + item.price, 0);

        // Big bills only enter the mix once the total is large enough to
        // plausibly need one — otherwise every early, cheap order would risk
        // getting paid for with an oddly huge bill.
        const paymentPool = PAYMENT_BILLS.filter((bill) =>
            (bill < 50 || this.price >= FIFTY_MIN_PRICE) && (bill < 100 || this.price >= HUNDRED_MIN_PRICE));
        const validBills = paymentPool.filter((bill) => bill > this.price);
        this.payment = randomItem(validBills.length > 0 ? validBills : [Math.max(...PAYMENT_BILLS)]);

        const customerKey = randomItem(CUSTOMER_KEYS.filter((key) => key !== this.lastCustomerKey));
        this.lastCustomerKey = customerKey;

        this.customer = this.add.image(CUSTOMER_START_X, FLOOR_Y, customerKey);
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

            const priceTag = this.add.text(iconX, ICON_CLUSTER_Y + layout.size / 2 + 6,
                item.quantity > 1 ? `${item.quantity}×$${item.unitPrice}` : `$${item.price}`, {
                fontFamily: FONT_UI, fontStyle: '700', fontSize: scaledFontSize(14, this.registry), color: TEXT_DARK
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
                playSfx(this, 'sfx-ui-sound', { volume: 0.3 });
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

        this.infoTypewriter.reveal(`Total $${this.price}  •  Customer pays with a $${this.payment} bill  •  Level ${this.difficultyLevel + 1}`);

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
    // extraDelayMs covers however long the feedback message is still typing
    // out at a slow Text Speed setting — otherwise the customer could start
    // walking off before their message finished revealing.
    private handleLifeLossIfAny (extraDelayMs = 0): void
    {
        if (!this.ranOutOfLives) return;

        this.state = 'resolving';
        this.setControlsActive(false);
        this.time.delayedCall(1300 + extraDelayMs, () => this.walkCustomerOut());
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
            const message = `Not Quite — Customer is owed $${changeDue}`;
            this.showFeedback('incorrect', message, `Correct change: ${breakdown}`);
            this.resetGivenAmount();
            this.handleLifeLossIfAny(TypewriterText.estimateDurationMs(message, this.registry));
            return;
        }

        if (this.getBillsUsedCount() > minimalBillCount(changeDue))
        {
            this.roundHadMistake = true;
            this.loseLife();
            const breakdown = formatBillBreakdown(minimalBillBreakdown(changeDue));
            const message = 'Right Amount — Fewer Bills Works';
            this.showFeedback('half', message, `Try: ${breakdown}`);
            this.resetGivenAmount();
            this.handleLifeLossIfAny(TypewriterText.estimateDurationMs(message, this.registry));
            return;
        }

        if (!this.roundHadMistake) this.firstTryCorrect += 1;
        this.totalCustomerTimeMs += this.time.now - this.customerArrivalTime;

        const elapsedSeconds = (this.time.now - this.roundStartTime) / 1000;
        const speedMultiplier = getSpeedBonusMultiplier(elapsedSeconds);
        const payout = Math.round(this.price * speedMultiplier * this.payoutMultiplier);

        this.score += 1;
        this.scoreText.setText(`Served: ${this.score}`);
        this.punch(this.scorePillContainer, 1.25);
        this.revenue += payout;
        this.revenueText.setText(`Revenue: $${this.revenue}`);
        this.punch(this.revenuePillContainer, 1.25);
        playSfx(this, 'sfx-correct');

        // Every fifth sale gets an extra flourish on top of the usual
        // register sting — a small escalating reward for a streak.
        if (this.score % 5 === 0)
        {
            playSfx(this, 'sfx-progression', { volume: 0.6 });
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
        this.time.delayedCall(900 + TypewriterText.estimateDurationMs(message, this.registry), () => {
            this.showCustomerRemark(pickRemark(elapsedSeconds, this.lastCustomerKey), () => this.walkCustomerOut());
        });
    }

    // A comic-style speech bubble beside the customer's head with a parting
    // remark about how fast they were served. It sits left of the head
    // (the stat pills leave no room above it), with its tail pointing right
    // at the customer, and drifts off with them as they start to leave.
    private showCustomerRemark (remark: string, onDone: () => void): void
    {
        if (!this.customer)
        {
            onDone();
            return;
        }

        // The feedback card sits in the same patch of screen — clear it
        // out of the way rather than letting the two overlap.
        this.tweens.killTweensOf(this.feedbackContainer);
        this.tweens.add({ targets: this.feedbackContainer, alpha: 0, duration: 200 });

        const paddingX = 18;
        const paddingY = 12;
        const tailLength = 18;
        const outline = 0x2b241d;

        const label = this.add.text(0, 0, remark, {
            fontFamily: FONT_UI, fontStyle: '700', fontSize: scaledFontSize(18, this.registry), color: TEXT_DARK,
            wordWrap: { width: 260 }, align: 'center'
        }).setOrigin(0.5);

        // Layout is measured from the full remark before the typewriter
        // clears it, so the bubble doesn't resize as the text types in.
        const bodyWidth = label.width + paddingX * 2;
        const bodyHeight = label.height + paddingY * 2;
        const bodyRight = -tailLength;
        const bodyLeft = bodyRight - bodyWidth;
        const bodyTop = -bodyHeight / 2 - 6;
        const radius = Math.min(18, bodyHeight / 2);

        label.setPosition(bodyLeft + bodyWidth / 2, bodyTop + bodyHeight / 2);

        const shadow = this.add.graphics();
        shadow.fillStyle(SHADOW_COLOR, 0.18);
        shadow.fillRoundedRect(bodyLeft + 3, bodyTop + 5, bodyWidth, bodyHeight, radius);

        // Body first, then the tail filled over the body's outline where
        // they meet, so the two read as one continuous shape.
        const bubble = this.add.graphics();
        bubble.fillStyle(CARD_COLOR, 1);
        bubble.lineStyle(3, outline, 1);
        bubble.fillRoundedRect(bodyLeft, bodyTop, bodyWidth, bodyHeight, radius);
        bubble.strokeRoundedRect(bodyLeft, bodyTop, bodyWidth, bodyHeight, radius);
        bubble.fillTriangle(bodyRight - 3, -8, bodyRight - 3, 8, 0, 0);
        bubble.lineBetween(bodyRight, -8, 0, 0);
        bubble.lineBetween(0, 0, bodyRight, 8);

        // The tail's tip (the container origin) points at the customer's
        // face, a little left of and below the top of their head.
        const container = this.add.container(this.customer.x - 50, 132, [shadow, bubble, label]);
        container.setDepth(20);
        container.setScale(0.6);
        container.setAlpha(0);

        this.tweens.add({ targets: container, scale: 1, alpha: 1, duration: 220, ease: 'Back.Out' });

        new TypewriterText(this, label).reveal(remark, () => {
            this.time.delayedCall(1400, () => {
                this.tweens.add({
                    targets: container,
                    x: '+=60',
                    alpha: 0,
                    duration: 350,
                    onComplete: () => container.destroy()
                });
                onDone();
            });
        });
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
            playSfx(this, 'sfx-error', { volume: 0.5 });
            this.cameras.main.shake(220, 0.006);
        }
        else if (kind === 'half')
        {
            playSfx(this, 'sfx-chime', { volume: 0.5 });
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
            fontFamily: FONT_UI, fontStyle: '700', fontSize: scaledFontSize(20, this.registry), color: theme.text
        }).setOrigin(0, 0.5);

        // The correct change isn't shown up front — a small "Show hint"
        // pill sits in its place, and only reveals the answer on request.
        let detail: GameObjects.Text | null = null;
        let hintButton: GameObjects.Container | null = null;
        let contentWidth = iconSlot + gap + label.width;

        if (breakdown)
        {
            detail = this.add.text(0, 16, breakdown, {
                fontFamily: FONT_SERIF, fontSize: scaledFontSize(19, this.registry), color: theme.text
            }).setOrigin(0, 0.5).setAlpha(0);

            const hintLabel = this.add.text(0, 0, 'Show hint', {
                fontFamily: FONT_UI, fontStyle: '700', fontSize: scaledFontSize(15, this.registry), color: theme.text
            }).setOrigin(0, 0.5);

            const hintPadX = 12;
            const hintHeight = 26;
            const hintWidth = hintLabel.width + hintPadX * 2;

            const hintBg = this.add.graphics();
            hintBg.fillStyle(theme.border, 0.14);
            hintBg.fillRoundedRect(0, -hintHeight / 2, hintWidth, hintHeight, hintHeight / 2);

            hintLabel.setPosition(hintPadX, 0);

            const hintHitZone = this.add.zone(hintWidth / 2, 0, hintWidth + 16, hintHeight + 22).setInteractive({ useHandCursor: true });

            hintButton = this.add.container(0, 16, [hintBg, hintLabel, hintHitZone]);

            contentWidth = Math.max(contentWidth, iconSlot + gap + hintWidth);

            hintHitZone.on('pointerdown', () => {
                // A distinct "reveal" cue rather than the generic button
                // click — this is information appearing, not an action firing.
                playSfx(this, 'sfx-ui-sound', { volume: 0.45 });

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

        // label's width (measured above, from the full message) already
        // drove every bit of this card's layout — clearing it now and
        // typewriting it back in doesn't disturb any of that sizing, since
        // nothing past this point reads label.width again. The dwell delay
        // (900/2200ms) only starts once the reveal actually finishes, so a
        // slow Text Speed setting can't fade the card out mid-type.
        const revealMessage = message;
        label.setText('');
        new TypewriterText(this, label).reveal(revealMessage, () => {
            this.tweens.add({
                targets: this.feedbackContainer,
                alpha: 0,
                delay: breakdown ? 2200 : 900,
                duration: 400
            });
        });
    }

    private walkCustomerOut (): void
    {
        // Only one walk-out per customer — a second call would schedule a
        // second startNewCustomer and leave two customers on screen.
        if (!this.customer || this.state === 'walking-out') return;

        this.state = 'walking-out';

        const delta = CUSTOMER_START_X - CUSTOMER_MEET_X;

        // Captured rather than read from this.customer on completion — by
        // then this.customer may already point at the next customer.
        const leaving = this.customer;

        this.tweens.add({
            targets: leaving,
            x: `+=${delta}`,
            alpha: 0,
            duration: 1100,
            ease: 'Sine.easeInOut',
            onComplete: () => {
                this.tweens.killTweensOf(leaving);
                leaving.destroy();
                if (this.customer === leaving) this.customer = null;
            }
        });

        const leavingItems = [...this.itemIcons, ...this.itemPriceTags];
        this.itemIcons = [];
        this.itemPriceTags = [];

        this.tweens.add({
            targets: leavingItems,
            alpha: 0,
            duration: 400,
            onComplete: () => leavingItems.forEach((item) => item.destroy())
        });

        const dayIsOver = this.ranOutOfLives || (this.time.now - this.dayStartTime >= this.dayDurationMs);
        this.infoTypewriter.reveal(dayIsOver ? 'Closing up for the day…' : 'Waiting for the next customer…');
        this.time.delayedCall(1600, () => {
            if (dayIsOver) this.endDay();
            else this.startNewCustomer();
        });
    }

    private endDay (): void
    {
        if (this.dayEnding) return;
        this.dayEnding = true;

        this.state = 'idle';
        this.setControlsActive(false);

        const totalCustomers = this.roundNumber;
        const avgTimeSeconds = totalCustomers > 0 ? (this.totalCustomerTimeMs / totalCustomers) / 1000 : 0;
        const accuracyPercent = totalCustomers > 0 ? (this.firstTryCorrect / totalCustomers) * 100 : 0;
        const stars = getStarRating(accuracyPercent, this.ranOutOfLives);

        // Revenue accumulates across all 5 days regardless of how today
        // went; the day counter only advances if there's another day left.
        const totalRevenue = (this.registry.get('totalRevenue') ?? 0) + this.revenue;
        this.registry.set('totalRevenue', totalRevenue);

        // Spendable cash is the same money, minus whatever gets spent in the
        // shop — so today's takings land here too, ready for upgrades.
        const cash = (this.registry.get('cash') ?? 0) + this.revenue;
        this.registry.set('cash', cash);

        const isFinalDay = this.currentDay >= TOTAL_DAYS;
        if (!isFinalDay) this.registry.set('currentDay', this.currentDay + 1);

        // Only the final day checks the bills — lifetime revenue has to clear
        // the target for the chosen difficulty by then.
        const difficulty: Difficulty = this.registry.get('difficulty') ?? DEFAULT_DIFFICULTY;
        const dayLength: DayLength = this.registry.get('dayLength') ?? DEFAULT_DAY_LENGTH;
        const billsTarget = getBillsTarget(difficulty, dayLength);
        const billsPaid = totalRevenue >= billsTarget;

        // Fade the music out alongside a camera fade-to-black, and only swap
        // scenes once the screen is fully covered — switching scenes
        // instantly reads as a jump cut rather than a day ending.
        this.music.removeAllListeners('complete');
        this.tweens.add({ targets: this.music, volume: 0, duration: 700 });
        this.cameras.main.fadeOut(800, 26, 18, 11);

        this.cameras.main.once('camerafadeoutcomplete', () => {
            this.music.stop();
            this.scene.start('GameOver', {
                day: this.currentDay,
                totalDays: TOTAL_DAYS,
                isFinalDay,
                stars,
                ranOutOfLives: this.ranOutOfLives,
                totalCustomers,
                firstTryCorrect: this.firstTryCorrect,
                revenue: this.revenue,
                totalRevenue,
                billsTarget,
                billsPaid,
                avgTimeSeconds
            });
        });
    }
}
