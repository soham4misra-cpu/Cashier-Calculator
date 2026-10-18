import { GameObjects, Scene } from 'phaser';
import { playSfx } from '../audio';
import { DayLength, DEFAULT_DAY_LENGTH, DEFAULT_DIFFICULTY, Difficulty, getBillsTarget, getInitialTarget, TOTAL_DAYS } from '../economy';
import { applyAnimationSpeed } from '../settings';
import { scaledFontSize } from '../ui/text';
import { TypewriterText } from '../ui/typewriter';

const ACCENT_ORANGE = 0xf3814a;
const CARD_COLOR = 0xffffff;
const TEXT_DARK = '#2b241d';
const SHADOW_COLOR = 0x2a2018;
const FONT_UI = '"Inter", "Segoe UI", sans-serif';
const FONT_SERIF = '"Cormorant Garamond", serif';

const NAME_MAX_LENGTH = 16;

// Split into paragraphs so each lands on its own line block.
function buildIntroStory (name: string): string
{
    return [
        `Welcome aboard, ${name}!`,
        "After weeks of job hunting, you've finally been hired as the new cashier at the corner shop.",
        "There's just one problem... the store doesn't have a cash register.",
        "Every customer pays with a bill, and it's up to you to work out their change in your head, using as few bills as possible.",
        'Ready for your first day?'
    ].join('\n\n');
}

// Shown once, after the day 1 summary. The boss quotes the smaller initial
// target here — the overdue bills story after day 2 raises it to the real one.
function buildBossStory (name: string, target: number, earned: number, roughDay: boolean): string
{
    const daysLeft = TOTAL_DAYS - 1;
    const remaining = Math.max(0, target - earned);
    const progress = remaining > 0
        ? `So far you've brought in $${earned}. That leaves $${remaining} to make in the next ${daysLeft} days.`
        : `You've already brought in $${earned}, so you're on track. Just keep it up for ${daysLeft} more days.`;

    return [
        'At closing time, your boss pulls you aside for a word.',
        roughDay
            ? `"Rough first day, ${name}. Three slip-ups and we had to close early. And this shop has bills to pay."`
            : `"Not bad for a first day, ${name}. But this shop has bills to pay."`,
        `"I need $${target} in total sales by the end of the week. Fall short, and I'll have to let you go."`,
        progress,
        'Better get to work.'
    ].join('\n\n');
}

// Shown once, after the day 2 summary. Reveals the full target — the same
// total-revenue goal the final day checks to decide whether the bills got paid.
function buildBillsStory (target: number, earned: number): string
{
    const daysLeft = TOTAL_DAYS - 2;
    const remaining = Math.max(0, target - earned);
    const progress = remaining > 0
        ? `You've brought in $${earned} so far. That leaves $${remaining} to make in the last ${daysLeft} days.`
        : `You've already brought in $${earned}, so you're covered. Just keep it up for ${daysLeft} more days.`;

    return [
        'As you lock up after day 2, you spot an envelope wedged under the shop door.',
        'Inside: a stack of overdue bills. Rent, electricity, the supplier... all stamped PAST DUE.',
        `On top of what the boss asked for, you'll need $${target} in total sales by the end of the week to cover it all.`,
        progress,
        '*sigh* The work just doesn\'t end.'
    ].join('\n\n');
}

// The good ending — shown after the final day's summary when the bills got
// paid, before returning to the title screen.
function buildEndingStory (name: string): string
{
    return [
        'On the last evening of the week, your boss counts the till twice, then looks up with a rare smile.',
        `"I'll be honest, ${name}. You're the best cashier this shop has ever had. Faster and sharper than anyone else I've hired."`,
        '"No register, no problem. Keep this up and you\'ve got a job here as long as you want it."',
        'On the way home, you drop the envelope of overdue bills in the mailbox. Every last one of them paid.',
        'Another work week survived!'
    ].join('\n\n');
}

type StoryMode = 'intro' | 'boss' | 'bills' | 'ending';

// Two story beats share this scene. 'intro' sits between CharacterSelect
// and Game: the player types their name, then reads a short typed-out story
// about the register-less job. 'boss' sits between the day 1 summary and
// the Shop: the boss sets the week's sales target. 'bills' sits between the
// day 2 summary and the Shop: overdue bills raise that target. 'ending'
// follows a winning final day and leads back to the title screen. Either way
// a Next button appears once the text finishes typing.
export class Story extends Scene
{
    private mode: StoryMode = 'intro';
    private nameStep: GameObjects.Container;
    private nameInput: GameObjects.DOMElement;
    private leaving = false;

    constructor ()
    {
        super('Story');
    }

    private roughDay = false;

    init (data: { mode?: StoryMode; roughDay?: boolean }): void
    {
        this.mode = data.mode ?? 'intro';
        this.roughDay = data.roughDay ?? false;
    }

    create (): void
    {
        this.cameras.main.fadeIn(500, 26, 18, 11);
        applyAnimationSpeed(this);
        this.leaving = false;

        const background = this.add.image(512, 384, 'shop-bg');
        background.setDisplaySize(1024, 768);
        this.add.rectangle(512, 384, 1024, 768, 0x1a120b, 0.6);

        if (this.mode === 'boss')
        {
            const name = (this.registry.get('playerName') as string | undefined) ?? 'kid';
            const difficulty: Difficulty = this.registry.get('difficulty') ?? DEFAULT_DIFFICULTY;
            const dayLength: DayLength = this.registry.get('dayLength') ?? DEFAULT_DAY_LENGTH;
            const earned: number = this.registry.get('totalRevenue') ?? 0;
            this.createStoryStep(buildBossStory(name, getInitialTarget(difficulty, dayLength), earned, this.roughDay), 'Shop');
        }
        else if (this.mode === 'ending')
        {
            const name = (this.registry.get('playerName') as string | undefined) ?? 'kid';
            this.createStoryStep(buildEndingStory(name), 'MainMenu');
        }
        else if (this.mode === 'bills')
        {
            const difficulty: Difficulty = this.registry.get('difficulty') ?? DEFAULT_DIFFICULTY;
            const dayLength: DayLength = this.registry.get('dayLength') ?? DEFAULT_DAY_LENGTH;
            const earned: number = this.registry.get('totalRevenue') ?? 0;
            this.createStoryStep(buildBillsStory(getBillsTarget(difficulty, dayLength), earned), 'Shop');
        }
        else
        {
            this.createNameStep();
        }
    }

    private createNameStep (): void
    {
        const title = this.add.text(512, 200, "What's your name?", {
            fontFamily: FONT_UI, fontStyle: '800', fontSize: scaledFontSize(40, this.registry), color: '#ffffff', align: 'center'
        }).setOrigin(0.5).setShadow(0, 4, 'rgba(0,0,0,0.35)', 10);

        const subtitle = this.add.text(512, 246, "It'll go on your name tag", {
            fontFamily: FONT_UI, fontSize: scaledFontSize(18, this.registry), color: '#e9e2d8', align: 'center'
        }).setOrigin(0.5);

        const card = this.createCard(512, 384, 520, 200);

        // A real HTML input (via Phaser's DOM layer) rather than a fake
        // canvas text field, so typing, pasting, and mobile keyboards all
        // just work.
        const input = document.createElement('input');
        input.type = 'text';
        input.maxLength = NAME_MAX_LENGTH;
        input.placeholder = 'Your name';
        input.autocomplete = 'off';
        input.spellcheck = false;
        input.autocapitalize = 'words';
        input.enterKeyHint = 'done';
        input.value = (this.registry.get('playerName') as string | undefined) ?? '';
        input.style.cssText = [
            'width: 380px', 'height: 56px', 'box-sizing: border-box', 'padding: 0 20px',
            `font: 600 ${scaledFontSize(22, this.registry)}px "Inter", "Segoe UI", sans-serif`,
            `color: ${TEXT_DARK}`, 'text-align: center', 'background: #f3ede2',
            'border: 2px solid transparent', 'border-radius: 28px', 'outline: none'
        ].join(';');
        input.addEventListener('focus', () => { input.style.borderColor = '#f3814a'; });
        input.addEventListener('blur', () => { input.style.borderColor = 'transparent'; });
        input.addEventListener('keydown', (event) => {
            // Keep keystrokes from reaching Phaser's own keyboard handling.
            event.stopPropagation();
            if (event.key === 'Enter') this.submitName();
        });

        this.nameInput = this.add.dom(512, 350, input);

        const button = this.createPillButton(512, 432, 'Continue', () => this.submitName());

        this.nameStep = this.add.container(0, 0, [title, subtitle, card, button]);

        // Focus once the fade-in has started, so the caret is ready without
        // a click.
        this.time.delayedCall(100, () => input.focus());
    }

    private submitName (): void
    {
        if (this.leaving || !this.nameInput.visible) return;

        const input = this.nameInput.node as HTMLInputElement;
        const name = input.value.trim().replace(/\s+/g, ' ');

        if (!name)
        {
            // Nudge rather than block silently — a quick shake and refocus.
            playSfx(this, 'sfx-error', { volume: 0.4 });
            this.tweens.add({ targets: this.nameInput, x: { from: 500, to: 512 }, duration: 260, ease: 'Bounce.Out' });
            input.focus();
            return;
        }

        playSfx(this, 'sfx-ui-click', { volume: 0.5 });
        this.registry.set('playerName', name);

        input.blur();
        this.nameInput.setVisible(false);

        this.tweens.add({
            targets: this.nameStep,
            alpha: 0,
            duration: 300,
            onComplete: () => {
                this.nameStep.destroy();
                this.createStoryStep(buildIntroStory(name), 'Game');
            }
        });
    }

    private createStoryStep (storyText: string, nextScene: string): void
    {
        const cardWidth = 760;
        const paddingX = 56;
        const paddingY = 44;
        const buttonGap = 70;

        const story = this.add.text(0, 0, '', {
            fontFamily: FONT_SERIF, fontSize: scaledFontSize(27, this.registry), color: TEXT_DARK,
            lineSpacing: 4, wordWrap: { width: cardWidth - paddingX * 2 }
        });

        // Wrapped up front and typed out pre-broken, so words don't jump to
        // the next line halfway through being typed.
        const fullText = story.getWrappedText(storyText).join('\n');

        // The card is sized to the full story (measured before the reveal
        // clears it), so it fits at any Text Size setting, and the card plus
        // the Next button below it sit centered on screen.
        story.setText(fullText);
        const cardHeight = story.height + paddingY * 2;
        const cardY = 384 - buttonGap / 2;
        story.setText('');
        story.setPosition(512 - cardWidth / 2 + paddingX, cardY - cardHeight / 2 + paddingY);

        const card = this.createCard(512, cardY, cardWidth, cardHeight);

        const container = this.add.container(0, 0, [card, story]).setAlpha(0);
        this.tweens.add({ targets: container, alpha: 1, duration: 300 });

        new TypewriterText(this, story).reveal(fullText, () => {
            const button = this.createPillButton(512, cardY + cardHeight / 2 + buttonGap, 'Next', () => this.proceed(nextScene));
            button.setAlpha(0).setScale(0.85);
            this.tweens.add({ targets: button, alpha: 1, scale: 1, duration: 260, ease: 'Back.Out' });
        });
    }

    private proceed (nextScene: string): void
    {
        if (this.leaving) return;
        this.leaving = true;

        playSfx(this, 'sfx-ui-click', { volume: 0.5 });
        this.cameras.main.fadeOut(500, 26, 18, 11);
        this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start(nextScene));
    }

    private createCard (x: number, y: number, width: number, height: number): GameObjects.Container
    {
        const radius = 28;

        const shadow = this.add.graphics();
        shadow.fillStyle(SHADOW_COLOR, 0.3);
        shadow.fillRoundedRect(-width / 2 + 3, -height / 2 + 6, width, height, radius);

        const bg = this.add.graphics();
        bg.fillStyle(CARD_COLOR, 0.98);
        bg.fillRoundedRect(-width / 2, -height / 2, width, height, radius);

        return this.add.container(x, y, [shadow, bg]);
    }

    private createPillButton (x: number, y: number, labelText: string, onClick: () => void): GameObjects.Container
    {
        const height = 60;

        const label = this.add.text(0, 0, labelText, {
            fontFamily: FONT_UI, fontStyle: '700', fontSize: scaledFontSize(20, this.registry), color: TEXT_DARK
        }).setOrigin(0.5);

        const width = Math.max(220, label.width + 64);

        const shadow = this.add.graphics();
        shadow.fillStyle(0x000000, 0.25);
        shadow.fillRoundedRect(-width / 2 + 2, -height / 2 + 5, width, height, height / 2);

        const bg = this.add.graphics();
        bg.fillStyle(ACCENT_ORANGE, 1);
        bg.fillRoundedRect(-width / 2, -height / 2, width, height, height / 2);

        const hitZone = this.add.zone(0, 0, width, height).setInteractive({ useHandCursor: true });

        const container = this.add.container(x, y, [shadow, bg, label, hitZone]);

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
            this.tweens.killTweensOf(container);
            this.tweens.add({ targets: container, scale: 0.94, duration: 80, yoyo: true });
            onClick();
        });

        return container;
    }
}
