import { Scene, GameObjects } from 'phaser';
import { getMultiplierCost, getPayoutMultiplier, MULTIPLIER_MAX_LEVEL, MULTIPLIER_STEP } from '../economy';
import { playSfx } from '../audio';
import { applyAnimationSpeed } from '../settings';
import { scaledFontSize } from '../ui/text';

const ACCENT_ORANGE = 0xf3814a;
const ACCENT_GREEN = 0x4fa876;
const CARD_COLOR = 0xffffff;
const DISABLED_COLOR = 0xe4dccb;
const TEXT_DARK = '#2b241d';
const TEXT_MUTED = '#8a7f70';
const SHADOW_COLOR = 0x2a2018;
const FONT_UI = '"Inter", "Segoe UI", sans-serif';

export class Shop extends Scene
{
    cashText: GameObjects.Text;
    cashPillShadow: GameObjects.Graphics;
    cashPillBg: GameObjects.Graphics;
    cashPillX = 0;
    cashPillY = 0;
    levelText: GameObjects.Text;
    bonusText: GameObjects.Text;
    pips: GameObjects.Arc[] = [];
    buyButton: GameObjects.Container;
    buyLabel: GameObjects.Text;
    buyBg: GameObjects.Graphics;
    buyHitZone: GameObjects.Zone;
    buyEnabled = false;

    constructor ()
    {
        super('Shop');
    }

    create ()
    {
        this.cameras.main.fadeIn(500, 26, 18, 11);
        applyAnimationSpeed(this);

        const background = this.add.image(512, 384, 'shop-bg');
        background.setDisplaySize(1024, 768);
        this.add.rectangle(512, 384, 1024, 768, 0x1a120b, 0.6);

        const completedDay: number = (this.registry.get('currentDay') ?? 2) - 1;
        const nextDay: number = this.registry.get('currentDay') ?? 2;

        this.add.text(512, 84, 'Shop Open', {
            fontFamily: FONT_UI, fontStyle: '800', fontSize: scaledFontSize(40, this.registry), color: '#ffffff', align: 'center'
        }).setOrigin(0.5).setShadow(0, 4, 'rgba(0,0,0,0.35)', 10);

        this.add.text(512, 128, `Day ${completedDay} is in the books — spend up before Day ${nextDay}`, {
            fontFamily: FONT_UI, fontSize: scaledFontSize(18, this.registry), color: '#e9e2d8', align: 'center'
        }).setOrigin(0.5);

        this.createCashPill(512, 176);
        this.createMultiplierCard(512, 392);
        this.createStartButton(512, 640, nextDay);
    }

    private createCashPill (x: number, y: number): void
    {
        this.cashPillX = x;
        this.cashPillY = y;
        this.cashPillShadow = this.add.graphics();
        this.cashPillBg = this.add.graphics();

        this.cashText = this.add.text(x, y, '', {
            fontFamily: FONT_UI, fontStyle: '800', fontSize: scaledFontSize(24, this.registry), color: TEXT_DARK
        }).setOrigin(0.5);

        this.refreshCash();
    }

    private createMultiplierCard (x: number, y: number): void
    {
        const width = 560;
        const height = 280;
        const left = x - width / 2;
        const top = y - height / 2;

        const shadow = this.add.graphics();
        shadow.fillStyle(SHADOW_COLOR, 0.25);
        shadow.fillRoundedRect(left + 4, top + 8, width, height, 28);

        const bg = this.add.graphics();
        bg.fillStyle(CARD_COLOR, 0.98);
        bg.fillRoundedRect(left, top, width, height, 28);

        this.add.circle(left + 52, top + 56, 24, ACCENT_ORANGE, 0.18);
        this.add.circle(left + 52, top + 56, 12, ACCENT_ORANGE);

        this.add.text(left + 92, top + 40, 'Money Multiplier', {
            fontFamily: FONT_UI, fontStyle: '800', fontSize: scaledFontSize(26, this.registry), color: TEXT_DARK
        }).setOrigin(0, 0.5);

        this.add.text(left + 92, top + 74, `+${Math.round(MULTIPLIER_STEP * 100)}% revenue on every correct sale, per level`, {
            fontFamily: FONT_UI, fontStyle: '600', fontSize: scaledFontSize(16, this.registry), color: TEXT_MUTED
        }).setOrigin(0, 0.5);

        const pipStartX = left + 52;
        const pipGap = 36;
        for (let i = 0; i < MULTIPLIER_MAX_LEVEL; i++)
        {
            const pip = this.add.circle(pipStartX + i * pipGap, top + 140, 9, ACCENT_ORANGE, 0);
            pip.setStrokeStyle(2, ACCENT_ORANGE, 0.5);
            this.pips.push(pip);
        }

        this.levelText = this.add.text(left + 52, top + 176, '', {
            fontFamily: FONT_UI, fontStyle: '700', fontSize: scaledFontSize(18, this.registry), color: TEXT_DARK
        }).setOrigin(0, 0.5);

        this.bonusText = this.add.text(left + 52, top + 206, '', {
            fontFamily: FONT_UI, fontStyle: '600', fontSize: scaledFontSize(16, this.registry), color: TEXT_MUTED
        }).setOrigin(0, 0.5);

        const buttonW = 180;
        const buttonH = 56;
        const buttonX = x + width / 2 - buttonW / 2 - 24;
        const buttonY = top + height - 46;

        this.buyLabel = this.add.text(0, 0, '', {
            fontFamily: FONT_UI, fontStyle: '800', fontSize: scaledFontSize(18, this.registry), color: TEXT_DARK
        }).setOrigin(0.5);

        this.buyBg = this.add.graphics();

        this.buyHitZone = this.add.zone(0, 0, buttonW, buttonH).setInteractive({ useHandCursor: true });
        this.buyHitZone.on('pointerdown', () => this.tryBuy());

        this.buyButton = this.add.container(buttonX, buttonY, [this.buyBg, this.buyLabel, this.buyHitZone]);
        this.buyButton.setData('w', buttonW);
        this.buyButton.setData('h', buttonH);

        this.refreshMultiplierUI();
    }

    private createStartButton (x: number, y: number, nextDay: number): void
    {
        const width = 320;
        const height = 64;

        // Drawn around the container's own origin so the idle pulse scales
        // the button in place instead of drifting it across the screen.
        const shadow = this.add.graphics();
        shadow.fillStyle(0x000000, 0.25);
        shadow.fillRoundedRect(-width / 2 + 2, -height / 2 + 5, width, height, height / 2);

        const bg = this.add.graphics();
        bg.fillStyle(ACCENT_ORANGE, 1);
        bg.fillRoundedRect(-width / 2, -height / 2, width, height, height / 2);

        const label = this.add.text(0, 0, `Start Day ${nextDay}`, {
            fontFamily: FONT_UI, fontStyle: '700', fontSize: scaledFontSize(20, this.registry), color: TEXT_DARK
        }).setOrigin(0.5);

        const button = this.add.container(x, y, [shadow, bg, label]);
        this.tweens.add({ targets: button, scale: 1.02, duration: 750, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

        const hitZone = this.add.zone(x, y, width, height).setInteractive({ useHandCursor: true });
        hitZone.on('pointerdown', () => {
            // One press only — repeat clicks during the fade would each
            // queue another scene start.
            hitZone.disableInteractive();
            playSfx(this, 'sfx-ui-click', { volume: 0.5 });
            this.cameras.main.fadeOut(500, 26, 18, 11);
            this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Game'));
        });
    }

    private tryBuy (): void
    {
        const level: number = this.registry.get('multiplierLevel') ?? 0;
        const cash: number = this.registry.get('cash') ?? 0;
        const cost = getMultiplierCost(level);

        if (level >= MULTIPLIER_MAX_LEVEL || cash < cost) return;

        this.registry.set('cash', cash - cost);
        this.registry.set('multiplierLevel', level + 1);

        playSfx(this, 'sfx-correct', { volume: 0.6 });
        this.refreshCash();
        this.refreshMultiplierUI();
        this.pips.forEach((pip, index) => {
            if (index === level) this.punchPip(pip);
        });
    }

    private punchPip (pip: GameObjects.Arc): void
    {
        pip.setScale(1.6);
        this.tweens.add({ targets: pip, scale: 1, duration: 260, ease: 'Back.Out' });
    }

    private refreshCash (): void
    {
        const cash: number = this.registry.get('cash') ?? 0;
        this.cashText.setText(`Cash: $${cash}`);

        // Redrawn (not just filled once) so the pill grows to fit a larger
        // Text Size setting or a big cash total instead of clipping it.
        const height = 52;
        const width = Math.max(260, this.cashText.width + 72);
        const x = this.cashPillX;
        const y = this.cashPillY;

        this.cashPillShadow.clear();
        this.cashPillShadow.fillStyle(SHADOW_COLOR, 0.2);
        this.cashPillShadow.fillRoundedRect(x - width / 2 + 2, y - height / 2 + 4, width, height, height / 2);

        this.cashPillBg.clear();
        this.cashPillBg.fillStyle(CARD_COLOR, 1);
        this.cashPillBg.fillRoundedRect(x - width / 2, y - height / 2, width, height, height / 2);
    }

    private refreshMultiplierUI (): void
    {
        const level: number = this.registry.get('multiplierLevel') ?? 0;
        const cash: number = this.registry.get('cash') ?? 0;

        this.pips.forEach((pip, index) => {
            const filled = index < level;
            pip.setFillStyle(ACCENT_ORANGE, filled ? 1 : 0);
            pip.setStrokeStyle(2, ACCENT_ORANGE, filled ? 0 : 0.5);
        });

        const bonusNow = Math.round((getPayoutMultiplier(level) - 1) * 100);
        const bonusNext = Math.round((getPayoutMultiplier(level + 1) - 1) * 100);
        this.levelText.setText(`Level ${level} / ${MULTIPLIER_MAX_LEVEL}`);
        this.bonusText.setText(level >= MULTIPLIER_MAX_LEVEL
            ? `Current bonus: +${bonusNow}% (maxed out)`
            : `Current: +${bonusNow}%   ·   Next level: +${bonusNext}%`);

        const maxed = level >= MULTIPLIER_MAX_LEVEL;
        const cost = getMultiplierCost(level);
        const affordable = cash >= cost;
        this.buyEnabled = !maxed && affordable;

        this.buyLabel.setText(maxed ? 'Max Level' : `Buy for $${cost}`);
        this.buyLabel.setColor(this.buyEnabled ? TEXT_DARK : TEXT_MUTED);

        // Grown to fit the label (not just the original 180px floor) so a
        // larger Text Size setting, or a higher-level cost's extra digit,
        // doesn't clip against the button.
        const minWidth = this.buyButton.getData('w') as number;
        const h = this.buyButton.getData('h') as number;
        const w = Math.max(minWidth, this.buyLabel.width + 40);

        this.buyBg.clear();
        this.buyBg.fillStyle(this.buyEnabled ? ACCENT_GREEN : DISABLED_COLOR, 1);
        this.buyBg.fillRoundedRect(-w / 2, -h / 2, w, h, h / 2);
        this.buyHitZone.setSize(w, h);
    }
}
