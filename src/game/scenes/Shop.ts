import { Scene, GameObjects } from 'phaser';
import { getMultiplierCost, getPayoutMultiplier, MULTIPLIER_MAX_LEVEL, MULTIPLIER_STEP } from '../economy';

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
    levelText: GameObjects.Text;
    bonusText: GameObjects.Text;
    pips: GameObjects.Arc[] = [];
    buyButton: GameObjects.Container;
    buyLabel: GameObjects.Text;
    buyBg: GameObjects.Graphics;
    buyEnabled = false;

    constructor ()
    {
        super('Shop');
    }

    create ()
    {
        this.cameras.main.fadeIn(500, 26, 18, 11);

        const background = this.add.image(512, 384, 'shop-bg');
        background.setDisplaySize(1024, 768);
        this.add.rectangle(512, 384, 1024, 768, 0x1a120b, 0.6);

        const completedDay: number = (this.registry.get('currentDay') ?? 2) - 1;
        const nextDay: number = this.registry.get('currentDay') ?? 2;

        this.add.text(512, 84, 'Shop Open', {
            fontFamily: FONT_UI, fontStyle: '800', fontSize: 40, color: '#ffffff', align: 'center'
        }).setOrigin(0.5).setShadow(0, 4, 'rgba(0,0,0,0.35)', 10);

        this.add.text(512, 128, `Day ${completedDay} is in the books — spend up before Day ${nextDay}`, {
            fontFamily: FONT_UI, fontSize: 18, color: '#e9e2d8', align: 'center'
        }).setOrigin(0.5);

        this.createCashPill(512, 176);
        this.createMultiplierCard(512, 392);
        this.createStartButton(512, 640, nextDay);
    }

    private createCashPill (x: number, y: number): void
    {
        const width = 260;
        const height = 52;

        const shadow = this.add.graphics();
        shadow.fillStyle(SHADOW_COLOR, 0.2);
        shadow.fillRoundedRect(x - width / 2 + 2, y - height / 2 + 4, width, height, height / 2);

        const bg = this.add.graphics();
        bg.fillStyle(CARD_COLOR, 1);
        bg.fillRoundedRect(x - width / 2, y - height / 2, width, height, height / 2);

        this.cashText = this.add.text(x, y, '', {
            fontFamily: FONT_UI, fontStyle: '800', fontSize: 24, color: TEXT_DARK
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
            fontFamily: FONT_UI, fontStyle: '800', fontSize: 26, color: TEXT_DARK
        }).setOrigin(0, 0.5);

        this.add.text(left + 92, top + 74, `+${Math.round(MULTIPLIER_STEP * 100)}% revenue on every correct sale, per level`, {
            fontFamily: FONT_UI, fontStyle: '600', fontSize: 16, color: TEXT_MUTED
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
            fontFamily: FONT_UI, fontStyle: '700', fontSize: 18, color: TEXT_DARK
        }).setOrigin(0, 0.5);

        this.bonusText = this.add.text(left + 52, top + 206, '', {
            fontFamily: FONT_UI, fontStyle: '600', fontSize: 16, color: TEXT_MUTED
        }).setOrigin(0, 0.5);

        const buttonW = 180;
        const buttonH = 56;
        const buttonX = x + width / 2 - buttonW / 2 - 24;
        const buttonY = top + height - 46;

        this.buyLabel = this.add.text(0, 0, '', {
            fontFamily: FONT_UI, fontStyle: '800', fontSize: 18, color: TEXT_DARK
        }).setOrigin(0.5);

        this.buyBg = this.add.graphics();

        const hitZone = this.add.zone(0, 0, buttonW, buttonH).setInteractive({ useHandCursor: true });
        hitZone.on('pointerdown', () => this.tryBuy());

        this.buyButton = this.add.container(buttonX, buttonY, [this.buyBg, this.buyLabel, hitZone]);
        this.buyButton.setData('w', buttonW);
        this.buyButton.setData('h', buttonH);

        this.refreshMultiplierUI();
    }

    private createStartButton (x: number, y: number, nextDay: number): void
    {
        const width = 320;
        const height = 64;

        const shadow = this.add.graphics();
        shadow.fillStyle(0x000000, 0.25);
        shadow.fillRoundedRect(x - width / 2 + 2, y - height / 2 + 5, width, height, height / 2);

        const bg = this.add.graphics();
        bg.fillStyle(ACCENT_ORANGE, 1);
        bg.fillRoundedRect(x - width / 2, y - height / 2, width, height, height / 2);

        const label = this.add.text(x, y, `Start Day ${nextDay}`, {
            fontFamily: FONT_UI, fontStyle: '700', fontSize: 20, color: TEXT_DARK
        }).setOrigin(0.5);

        const button = this.add.container(0, 0, [shadow, bg, label]);
        this.tweens.add({ targets: button, scale: 1.04, duration: 750, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

        const hitZone = this.add.zone(x, y, width, height).setInteractive({ useHandCursor: true });
        hitZone.on('pointerdown', () => {
            this.sound.play('sfx-ui-click', { volume: 0.5 });
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

        this.sound.play('sfx-correct', { volume: 0.6 });
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

        const w = this.buyButton.getData('w') as number;
        const h = this.buyButton.getData('h') as number;
        this.buyBg.clear();
        this.buyBg.fillStyle(this.buyEnabled ? ACCENT_GREEN : DISABLED_COLOR, 1);
        this.buyBg.fillRoundedRect(-w / 2, -h / 2, w, h, h / 2);
    }
}
