import { Scene, GameObjects } from 'phaser';

const ACCENT_ORANGE = 0xf3814a;
const ACCENT_GREEN = 0x4fa876;
const STAR_GOLD = 0xf5c451;
const STAR_EMPTY = 0xe4dccb;
const CARD_COLOR = 0xffffff;
const TEXT_DARK = '#2b241d';
const TEXT_MUTED = '#8a7f70';
const SHADOW_COLOR = 0x2a2018;
const FONT_UI = '"Inter", "Segoe UI", sans-serif';

interface DaySummary
{
    day: number;
    totalDays: number;
    isFinalDay: boolean;
    stars: number;
    ranOutOfLives: boolean;
    totalCustomers: number;
    firstTryCorrect: number;
    revenue: number;
    totalRevenue: number;
    avgTimeSeconds: number;
}

export class GameOver extends Scene
{
    background: GameObjects.Image;
    summary: DaySummary;

    constructor ()
    {
        super('GameOver');
    }

    init (data: Partial<DaySummary>)
    {
        // Defaults cover the case this scene is ever reached without a day
        // actually having been played (e.g. during development).
        this.summary = {
            day: data.day ?? 1,
            totalDays: data.totalDays ?? 5,
            isFinalDay: data.isFinalDay ?? false,
            stars: data.stars ?? 0,
            ranOutOfLives: data.ranOutOfLives ?? false,
            totalCustomers: data.totalCustomers ?? 0,
            firstTryCorrect: data.firstTryCorrect ?? 0,
            revenue: data.revenue ?? 0,
            totalRevenue: data.totalRevenue ?? 0,
            avgTimeSeconds: data.avgTimeSeconds ?? 0
        };
    }

    create ()
    {
        // Picks up from the Game scene's fade-to-black so the day-end screen
        // eases in rather than snapping into view.
        this.cameras.main.fadeIn(600, 26, 18, 11);

        this.background = this.add.image(512, 384, 'shop-bg');
        this.background.setDisplaySize(1024, 768);
        this.add.rectangle(512, 384, 1024, 768, 0x1a120b, 0.55);

        const { summary } = this;

        const title = summary.isFinalDay
            ? 'Final Day Complete!'
            : summary.ranOutOfLives
                ? 'Out of Lives!'
                : `Day ${summary.day} Complete!`;

        this.add.text(512, 68, title, {
            fontFamily: FONT_UI, fontStyle: '800', fontSize: 40, color: '#ffffff',
            align: 'center'
        }).setOrigin(0.5).setShadow(0, 4, 'rgba(0,0,0,0.35)', 10);

        // Three stars, filled gold up to however many were earned — the
        // day's headline grade, readable before any of the numbers below.
        const starY = 116;
        const starSpacing = 44;
        for (let i = 0; i < 3; i++)
        {
            const starX = 512 + (i - 1) * starSpacing;
            const filled = i < summary.stars;
            this.add.star(starX, starY, 5, filled ? 14 : 12, filled ? 26 : 22, filled ? STAR_GOLD : STAR_EMPTY)
                .setStrokeStyle(2, filled ? STAR_GOLD : STAR_EMPTY);
        }

        const subtitle = summary.isFinalDay
            ? `You kept the shop open for all ${summary.totalDays} days!`
            : summary.ranOutOfLives
                ? 'Three mistakes closed the shop early today.'
                : `Day ${summary.day} of ${summary.totalDays} — here's how it went`;

        this.add.text(512, 158, subtitle, {
            fontFamily: FONT_UI, fontSize: 18, color: '#e9e2d8',
            align: 'center'
        }).setOrigin(0.5);

        const cardWidth = 640;
        const cardHeight = 280;
        const cardX = 512 - cardWidth / 2;
        const cardY = 196;

        const cardShadow = this.add.graphics();
        cardShadow.fillStyle(SHADOW_COLOR, 0.25);
        cardShadow.fillRoundedRect(cardX + 4, cardY + 8, cardWidth, cardHeight, 28);

        const cardBg = this.add.graphics();
        cardBg.fillStyle(CARD_COLOR, 0.98);
        cardBg.fillRoundedRect(cardX, cardY, cardWidth, cardHeight, 28);

        const accuracyPercent = summary.totalCustomers > 0
            ? Math.round((summary.firstTryCorrect / summary.totalCustomers) * 100)
            : 0;

        const stats: { label: string; value: string; accent: number }[] = [
            { label: 'Customers Served', value: `${summary.totalCustomers}`, accent: ACCENT_ORANGE },
            { label: 'Correct on First Try', value: `${summary.firstTryCorrect} / ${summary.totalCustomers}  (${accuracyPercent}%)`, accent: ACCENT_GREEN },
            { label: 'Revenue Earned Today', value: `$${summary.revenue}`, accent: ACCENT_ORANGE },
            { label: 'Avg. Time per Customer', value: `${summary.avgTimeSeconds.toFixed(1)}s`, accent: ACCENT_GREEN }
        ];

        stats.forEach((stat, index) => {
            const rowY = cardY + 44 + index * 54;

            this.add.circle(cardX + 44, rowY, 7, stat.accent);

            this.add.text(cardX + 68, rowY, stat.label, {
                fontFamily: FONT_UI, fontStyle: '600', fontSize: 18, color: TEXT_MUTED
            }).setOrigin(0, 0.5);

            this.add.text(cardX + cardWidth - 32, rowY, stat.value, {
                fontFamily: FONT_UI, fontStyle: '800', fontSize: 21, color: TEXT_DARK
            }).setOrigin(1, 0.5);
        });

        // Total revenue lives outside the per-day card — it's the running
        // score across the whole 5-day run, not something that resets.
        const totalRevenueY = cardY + cardHeight + 38;
        const totalRevenueLabel = `Total Revenue: $${summary.totalRevenue}`;
        this.add.text(512, totalRevenueY, totalRevenueLabel, {
            fontFamily: FONT_UI, fontStyle: '800', fontSize: summary.isFinalDay ? 28 : 22, color: '#ffffff',
            align: 'center'
        }).setOrigin(0.5).setShadow(0, 2, 'rgba(0,0,0,0.35)', 6);

        const buttonWidth = 320;
        const buttonHeight = 64;
        const buttonY = totalRevenueY + 50;
        const buttonLabelText = summary.isFinalDay ? 'Play Again' : 'Start Next Day';

        const buttonShadow = this.add.graphics();
        buttonShadow.fillStyle(0x000000, 0.25);
        buttonShadow.fillRoundedRect(512 - buttonWidth / 2 + 2, buttonY - buttonHeight / 2 + 5, buttonWidth, buttonHeight, buttonHeight / 2);

        const buttonBg = this.add.graphics();
        buttonBg.fillStyle(ACCENT_ORANGE, 1);
        buttonBg.fillRoundedRect(512 - buttonWidth / 2, buttonY - buttonHeight / 2, buttonWidth, buttonHeight, buttonHeight / 2);

        const buttonLabel = this.add.text(512, buttonY, buttonLabelText, {
            fontFamily: FONT_UI, fontStyle: '700', fontSize: 20, color: TEXT_DARK
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
            this.cameras.main.once('camerafadeoutcomplete', () => {
                if (summary.isFinalDay)
                {
                    // A full run is over — reset the run-level state and send
                    // the player back to the title screen rather than
                    // straight into a new day 1.
                    this.registry.set('currentDay', 1);
                    this.registry.set('totalRevenue', 0);
                    this.scene.start('MainMenu');
                }
                else
                {
                    this.scene.start('Game');
                }
            });
        });
    }
}
