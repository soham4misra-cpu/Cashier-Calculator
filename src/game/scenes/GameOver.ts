import { Scene, GameObjects } from 'phaser';

const ACCENT_ORANGE = 0xf3814a;
const ACCENT_GREEN = 0x4fa876;
const CARD_COLOR = 0xffffff;
const TEXT_DARK = '#2b241d';
const TEXT_MUTED = '#8a7f70';
const SHADOW_COLOR = 0x2a2018;
const FONT_UI = '"Inter", "Segoe UI", sans-serif';

interface DaySummary
{
    totalCustomers: number;
    firstTryCorrect: number;
    revenue: number;
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
            totalCustomers: data.totalCustomers ?? 0,
            firstTryCorrect: data.firstTryCorrect ?? 0,
            revenue: data.revenue ?? 0,
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

        this.add.text(512, 96, 'Day Complete!', {
            fontFamily: FONT_UI, fontStyle: '800', fontSize: 44, color: '#ffffff',
            align: 'center'
        }).setOrigin(0.5).setShadow(0, 4, 'rgba(0,0,0,0.35)', 10);

        this.add.text(512, 142, "Here's how the shop did today", {
            fontFamily: FONT_UI, fontSize: 18, color: '#e9e2d8',
            align: 'center'
        }).setOrigin(0.5);

        const cardWidth = 640;
        const cardHeight = 300;
        const cardX = 512 - cardWidth / 2;
        const cardY = 190;

        const cardShadow = this.add.graphics();
        cardShadow.fillStyle(SHADOW_COLOR, 0.25);
        cardShadow.fillRoundedRect(cardX + 4, cardY + 8, cardWidth, cardHeight, 28);

        const cardBg = this.add.graphics();
        cardBg.fillStyle(CARD_COLOR, 0.98);
        cardBg.fillRoundedRect(cardX, cardY, cardWidth, cardHeight, 28);

        const accuracyPercent = this.summary.totalCustomers > 0
            ? Math.round((this.summary.firstTryCorrect / this.summary.totalCustomers) * 100)
            : 0;

        const stats: { label: string; value: string; accent: number }[] = [
            { label: 'Customers Served', value: `${this.summary.totalCustomers}`, accent: ACCENT_ORANGE },
            { label: 'Correct on First Try', value: `${this.summary.firstTryCorrect} / ${this.summary.totalCustomers}  (${accuracyPercent}%)`, accent: ACCENT_GREEN },
            { label: 'Revenue Earned', value: `$${this.summary.revenue}`, accent: ACCENT_ORANGE },
            { label: 'Avg. Time per Customer', value: `${this.summary.avgTimeSeconds.toFixed(1)}s`, accent: ACCENT_GREEN }
        ];

        stats.forEach((stat, index) => {
            const rowY = cardY + 48 + index * 58;

            this.add.circle(cardX + 44, rowY, 7, stat.accent);

            this.add.text(cardX + 68, rowY, stat.label, {
                fontFamily: FONT_UI, fontStyle: '600', fontSize: 19, color: TEXT_MUTED
            }).setOrigin(0, 0.5);

            this.add.text(cardX + cardWidth - 32, rowY, stat.value, {
                fontFamily: FONT_UI, fontStyle: '800', fontSize: 22, color: TEXT_DARK
            }).setOrigin(1, 0.5);
        });

        const buttonWidth = 320;
        const buttonHeight = 64;
        const buttonY = cardY + cardHeight + 66;

        const buttonShadow = this.add.graphics();
        buttonShadow.fillStyle(0x000000, 0.25);
        buttonShadow.fillRoundedRect(512 - buttonWidth / 2 + 2, buttonY - buttonHeight / 2 + 5, buttonWidth, buttonHeight, buttonHeight / 2);

        const buttonBg = this.add.graphics();
        buttonBg.fillStyle(ACCENT_ORANGE, 1);
        buttonBg.fillRoundedRect(512 - buttonWidth / 2, buttonY - buttonHeight / 2, buttonWidth, buttonHeight, buttonHeight / 2);

        const buttonLabel = this.add.text(512, buttonY, 'Start Next Day', {
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
            this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Game'));
        });
    }
}
