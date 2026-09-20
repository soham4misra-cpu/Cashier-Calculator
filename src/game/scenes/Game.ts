import { Scene, GameObjects } from 'phaser';

interface ItemDefinition
{
    key: string;
    name: string;
    minPrice: number;
    maxPrice: number;
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
    { key: 'item-cilantro', name: 'Cilantro', minPrice: 1, maxPrice: 3 }
];

const ITEM_LAYOUTS: Record<number, ItemLayout> = {
    1: { size: 100, spacing: 0 },
    2: { size: 80, spacing: 88 },
    3: { size: 66, spacing: 72 }
};

const BILL_VALUES = [1, 5, 10, 20];
const PAYMENT_BILLS = [5, 10, 20];

const CASHIER_X = 150;
const FLOOR_Y = 520;
const PANEL_Y = 490;
const CUSTOMER_START_X = 1150;
const CUSTOMER_MEET_X = 640;
const CUSTOMER_DISPLAY_SIZE = 480;

// The purchased items are displayed as a fixed cluster inside the panel
// (right side, above the bill row) rather than floating in world space
// beside the customer.
const ICON_CLUSTER_X = 880;
const ICON_CLUSTER_Y = PANEL_Y + 70;

type RoundState = 'idle' | 'walking-in' | 'awaiting-change' | 'resolving' | 'walking-out';

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

function randomItemCount (): number
{
    const roll = Math.random();

    if (roll < 0.5) return 1;
    if (roll < 0.85) return 2;
    return 3;
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
    mistakesText: GameObjects.Text;
    infoText: GameObjects.Text;
    totalText: GameObjects.Text;
    feedbackContainer: GameObjects.Container;

    changeUI: GameObjects.Container;
    itemIconGroup: GameObjects.Container;
    controlsGroup: GameObjects.Container;
    billCountTexts: Map<number, GameObjects.Text> = new Map();
    billCounts: Map<number, number> = new Map();

    state: RoundState = 'idle';
    score = 0;
    mistakes = 0;
    price = 0;
    payment = 0;
    givenAmount = 0;
    currentItems: PurchaseItem[] = [];

    constructor ()
    {
        super('Game');
    }

    create ()
    {
        this.background = this.add.image(512, 384, 'shop-bg');
        this.background.setDisplaySize(1024, 768);

        this.cashier = this.add.image(CASHIER_X, FLOOR_Y, 'cashier');
        this.cashier.setOrigin(0.5, 1);
        this.cashier.setDisplaySize(480, 480);
        this.cashier.setDepth(0);
        this.cashier.setAlpha(0);

        const scorePill = this.createStatPill(24, false, 'Served: 0', 0x35b56a);
        this.scoreText = scorePill.text;

        const mistakesPill = this.createStatPill(1000, true, 'Mistakes: 0', 0xd9542f);
        this.mistakesText = mistakesPill.text;

        this.feedbackContainer = this.add.container(512, 165).setDepth(10).setAlpha(0);

        this.createChangeUI();

        this.tweens.add({
            targets: [this.cashier, scorePill.container, mistakesPill.container, this.changeUI],
            alpha: 1,
            duration: 700,
            ease: 'Sine.easeOut'
        });

        this.time.delayedCall(600, () => this.startNewCustomer());
    }

    private createStatPill (x: number, alignRight: boolean, label: string, accent: number): { container: GameObjects.Container; text: GameObjects.Text }
    {
        const width = 176;
        const height = 44;
        const left = alignRight ? -width : 0;

        const shadow = this.add.graphics();
        shadow.fillStyle(0x000000, 0.18);
        shadow.fillRoundedRect(left + 2, 3, width, height, 14);

        const bg = this.add.graphics();
        bg.fillStyle(0xfaf3e6, 0.95);
        bg.fillRoundedRect(left, 0, width, height, 14);
        bg.lineStyle(2, 0xd8cdb8, 1);
        bg.strokeRoundedRect(left, 0, width, height, 14);

        const dotX = left + 20;
        const dot = this.add.circle(dotX, height / 2, 6, accent);

        const text = this.add.text(dotX + 16, height / 2, label, {
            fontFamily: 'Arial Black', fontSize: 20, color: '#3a2f26'
        }).setOrigin(0, 0.5);

        const container = this.add.container(x, 18, [shadow, bg, dot, text]);
        container.setDepth(10);

        return { container, text };
    }

    private createChangeUI (): void
    {
        const panelHeight = 768 - PANEL_Y;

        const panelShadow = this.add.graphics();
        panelShadow.fillStyle(0x000000, 0.15);
        panelShadow.fillRect(0, PANEL_Y - 8, 1024, 8);

        const panelBg = this.add.graphics();
        panelBg.fillStyle(0xfaf3e6, 0.93);
        panelBg.fillRect(0, PANEL_Y, 1024, panelHeight);
        panelBg.fillStyle(0x35b56a, 0.9);
        panelBg.fillRect(0, PANEL_Y, 1024, 4);
        panelBg.lineStyle(1, 0xd8cdb8, 0.8);
        panelBg.lineBetween(0, PANEL_Y + 4, 1024, PANEL_Y + 4);

        this.infoText = this.add.text(40, PANEL_Y + 14, 'Get ready — your first customer is on the way!', {
            fontFamily: '"Cormorant Garamond", serif', fontSize: 26, color: '#3a2f26',
            lineSpacing: 8
        });

        this.totalText = this.add.text(40, PANEL_Y + 60, 'Change given: $0', {
            fontFamily: 'Arial Black', fontSize: 26, color: '#c9701a'
        });

        this.itemIconGroup = this.add.container(0, 0);

        this.controlsGroup = this.add.container(0, 0);

        this.changeUI = this.add.container(0, 0, [panelShadow, panelBg, this.infoText, this.totalText, this.itemIconGroup, this.controlsGroup]);
        this.changeUI.setDepth(10);

        const billY = PANEL_Y + 200;
        const startX = 235;
        const gapX = 170;

        BILL_VALUES.forEach((value, index) => {
            this.createBillButton(value, startX + index * gapX, billY);
        });

        this.createClearButton(410, PANEL_Y + 60);
        this.createConfirmButton(930, PANEL_Y + 190);

        this.setControlsActive(false);
    }

    private createBillButton (value: number, x: number, y: number): void
    {
        const cardWidth = 176;
        const cardHeight = 104;

        const shadow = this.add.graphics();
        shadow.fillStyle(0x000000, 0.12);
        shadow.fillRoundedRect(-cardWidth / 2 + 3, -cardHeight / 2 + 5, cardWidth, cardHeight, 14);

        const bg = this.add.graphics();
        bg.fillStyle(0xffffff, 0.98);
        bg.fillRoundedRect(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight, 14);
        bg.lineStyle(2, 0xe4ddcc, 1);
        bg.strokeRoundedRect(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight, 14);

        const img = this.add.image(0, -4, `bill-${value}`);
        img.setDisplaySize(154, 66);

        const countText = this.add.text(cardWidth / 2 - 20, cardHeight / 2 - 16, '', {
            fontFamily: 'Arial Black', fontSize: 18, color: '#ffffff',
            padding: { x: 7, y: 3 }
        }).setOrigin(0.5);

        this.billCountTexts.set(value, countText);

        const hitZone = this.add.zone(0, 0, cardWidth, cardHeight);
        hitZone.setInteractive({ useHandCursor: true });

        hitZone.on('pointerdown', () => {
            if (this.state !== 'awaiting-change') return;

            this.givenAmount += value;
            const count = (this.billCounts.get(value) ?? 0) + 1;
            this.billCounts.set(value, count);
            countText.setText(`x${count}`).setBackgroundColor('#d9542f');
            this.updateTotalText();

            this.tweens.add({ targets: container, scale: 0.94, duration: 80, yoyo: true });
        });

        const container = this.add.container(x, y, [shadow, bg, img, countText, hitZone]);
        this.controlsGroup.add(container);
    }

    private createClearButton (x: number, y: number): void
    {
        const width = 108;
        const height = 42;

        const shadow = this.add.graphics();
        shadow.fillStyle(0x000000, 0.12);
        shadow.fillRoundedRect(-width / 2 + 2, -height / 2 + 4, width, height, 12);

        const bg = this.add.graphics();
        bg.fillStyle(0xeeeae0, 0.98);
        bg.fillRoundedRect(-width / 2, -height / 2, width, height, 12);
        bg.lineStyle(2, 0xd8cdb8, 1);
        bg.strokeRoundedRect(-width / 2, -height / 2, width, height, 12);

        const label = this.add.text(0, 0, 'Clear', {
            fontFamily: 'Arial Black', fontSize: 18, color: '#3a2f26'
        }).setOrigin(0.5);

        const hitZone = this.add.zone(0, 0, width, height);
        hitZone.setInteractive({ useHandCursor: true });
        hitZone.on('pointerdown', () => {
            if (this.state !== 'awaiting-change') return;
            this.resetGivenAmount();
        });

        const container = this.add.container(x, y, [shadow, bg, label, hitZone]);
        this.controlsGroup.add(container);
    }

    private createConfirmButton (x: number, y: number): void
    {
        const shadow = this.add.circle(0, 4, 48, 0x000000, 0.15);

        const bg = this.add.image(0, 0, 'btn-round');
        bg.setDisplaySize(92, 92);
        bg.setTint(0x35b56a);

        const check = this.add.image(0, -3, 'icon-check');
        check.setDisplaySize(44, 40);

        const label = this.add.text(0, 58, 'Confirm', {
            fontFamily: 'Arial Black', fontSize: 20, color: '#3a2f26'
        }).setOrigin(0.5);

        const hitZone = this.add.zone(0, 0, 112, 112);
        hitZone.setInteractive({ useHandCursor: true });
        hitZone.on('pointerdown', () => this.handleConfirm());

        const container = this.add.container(x, y, [shadow, bg, check, label, hitZone]);
        this.controlsGroup.add(container);
    }

    private setControlsActive (active: boolean): void
    {
        this.controlsGroup.setAlpha(active ? 1 : 0.42);
    }

    private resetGivenAmount (): void
    {
        this.givenAmount = 0;
        this.billCounts.clear();
        this.billCountTexts.forEach((text) => text.setText('').setBackgroundColor(''));
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

        const itemDefs = shuffled(ITEMS).slice(0, randomItemCount());
        this.currentItems = itemDefs.map((def) => ({
            key: def.key,
            name: def.name,
            price: randomInt(def.minPrice, def.maxPrice)
        }));
        this.price = this.currentItems.reduce((sum, item) => sum + item.price, 0);

        const validBills = PAYMENT_BILLS.filter((bill) => bill > this.price);
        this.payment = randomItem(validBills.length > 0 ? validBills : [20]);

        this.customer = this.add.image(CUSTOMER_START_X, FLOOR_Y, 'customer');
        this.customer.setOrigin(0.5, 1);
        this.customer.setDisplaySize(CUSTOMER_DISPLAY_SIZE, CUSTOMER_DISPLAY_SIZE);

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
                fontFamily: 'Arial Black', fontSize: 15, color: '#3a2f26'
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
            onComplete: () => this.presentItems()
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

        this.infoText.setText(`Total $${this.price}  •  Customer pays with a $${this.payment} bill`);

        this.time.delayedCall(400, () => {
            this.state = 'awaiting-change';
            this.setControlsActive(true);
        });
    }

    private handleConfirm (): void
    {
        if (this.state !== 'awaiting-change') return;

        const changeDue = this.payment - this.price;

        if (this.givenAmount !== changeDue)
        {
            this.mistakes += 1;
            this.mistakesText.setText(`Mistakes: ${this.mistakes}`);
            const breakdown = formatBillBreakdown(minimalBillBreakdown(changeDue));
            this.showFeedback('incorrect', `Not Quite — Customer is owed $${changeDue}`, `Correct change: ${breakdown}`);
            this.resetGivenAmount();
            return;
        }

        if (this.getBillsUsedCount() > minimalBillCount(changeDue))
        {
            const breakdown = formatBillBreakdown(minimalBillBreakdown(changeDue));
            this.showFeedback('half', 'Right Amount — Fewer Bills Works', `Try: ${breakdown}`);
            this.resetGivenAmount();
            return;
        }

        this.score += 1;
        this.scoreText.setText(`Served: ${this.score}`);
        this.showFeedback('correct', 'Correct Change!');
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
        this.tweens.killTweensOf(this.feedbackContainer);
        this.feedbackContainer.removeAll(true);
        this.feedbackContainer.setScale(0.8);
        this.feedbackContainer.setAlpha(1);

        const theme = {
            correct: { bg: 0xeaf7ee, border: 0x35b56a, text: '#1f7a43' },
            incorrect: { bg: 0xfbeae8, border: 0xd9542f, text: '#a23a22' },
            half: { bg: 0xfdf1df, border: 0xc9701a, text: '#8a5210' }
        }[kind];

        const paddingX = 26;
        const iconSlot = 34;
        const gap = 14;
        const labelY = breakdown ? -14 : 0;
        const cardHeight = breakdown ? 88 : 64;

        const label = this.add.text(0, labelY, message, {
            fontFamily: 'Arial Black', fontSize: 22, color: theme.text
        }).setOrigin(0, 0.5);

        let detail: GameObjects.Text | null = null;
        let contentWidth = iconSlot + gap + label.width;

        if (breakdown)
        {
            detail = this.add.text(0, 16, breakdown, {
                fontFamily: '"Cormorant Garamond", serif', fontSize: 19, color: theme.text
            }).setOrigin(0, 0.5);
            contentWidth = Math.max(contentWidth, iconSlot + gap + detail.width);
        }

        const cardWidth = contentWidth + paddingX * 2;
        const leftEdge = -cardWidth / 2;

        const shadow = this.add.graphics();
        shadow.fillStyle(0x000000, 0.18);
        shadow.fillRoundedRect(leftEdge + 3, -cardHeight / 2 + 5, cardWidth, cardHeight, 18);

        const bg = this.add.graphics();
        bg.fillStyle(theme.bg, 0.97);
        bg.fillRoundedRect(leftEdge, -cardHeight / 2, cardWidth, cardHeight, 18);
        bg.lineStyle(3, theme.border, 1);
        bg.strokeRoundedRect(leftEdge, -cardHeight / 2, cardWidth, cardHeight, 18);

        const iconCenterX = leftEdge + paddingX + iconSlot / 2;
        const textX = leftEdge + paddingX + iconSlot + gap;
        label.setPosition(textX, labelY);
        detail?.setPosition(textX, 16);

        this.feedbackContainer.add([shadow, bg]);

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

        this.infoText.setText('Waiting for the next customer…');
        this.time.delayedCall(1600, () => this.startNewCustomer());
    }
}
