import { GameObjects, Scene } from 'phaser';
import { DEFAULT_SETTINGS } from '../settings';

// Base reveal rate: ~36 characters/second at the default 1x text speed.
const BASE_MS_PER_CHAR = 28;

export class TypewriterText
{
    private readonly scene: Scene;
    private readonly textObject: GameObjects.Text;
    private timer: Phaser.Time.TimerEvent | null = null;
    private fullString = '';
    private index = 0;
    private onComplete: (() => void) | undefined;

    constructor (scene: Scene, textObject: GameObjects.Text)
    {
        this.scene = scene;
        this.textObject = textObject;
    }

    reveal (fullString: string, onComplete?: () => void): void
    {
        this.cancel();
        this.textObject.setText('');

        const speed = (this.scene.registry.get('textSpeed') as number) ?? DEFAULT_SETTINGS.textSpeed;
        const delay = Math.max(4, BASE_MS_PER_CHAR / speed);

        if (fullString.length === 0)
        {
            onComplete?.();
            return;
        }

        this.fullString = fullString;
        this.index = 0;
        this.onComplete = onComplete;

        // A fixed repeat count rather than `loop: true` — Phaser re-arms a
        // looping timer after its callback returns, even if the callback
        // removed it, so a looping reveal ticked once past the end and
        // fired onComplete twice.
        this.timer = this.scene.time.addEvent({
            delay,
            repeat: fullString.length - 1,
            callback: () => {
                // The text can be destroyed mid-reveal (e.g. a feedback card
                // replaced while still typing) — writing to it then throws.
                if (!this.textObject.active)
                {
                    this.cancel();
                    return;
                }

                this.showUpTo(this.index + 1);
            }
        });
    }

    get isRevealing (): boolean
    {
        return this.timer !== null;
    }

    // Instantly finishes the paragraph currently being typed (up to the next
    // blank line); typing then carries on from the start of the next one.
    skipParagraph (): void
    {
        if (!this.timer) return;

        const breakAt = this.fullString.indexOf('\n\n', this.index);
        this.showUpTo(breakAt === -1 ? this.fullString.length : breakAt + 2);
    }

    private showUpTo (index: number): void
    {
        this.index = Math.min(index, this.fullString.length);
        this.textObject.setText(this.fullString.slice(0, this.index));

        if (this.index >= this.fullString.length)
        {
            this.cancel();
            this.onComplete?.();
        }
    }

    cancel (): void
    {
        if (this.timer) this.scene.time.removeEvent(this.timer);
        this.timer = null;
    }

    // Rough estimate of how long a reveal of this string will take, so
    // callers can delay a subsequent action (e.g. walking a customer out)
    // until the message has actually finished typing.
    static estimateDurationMs (fullString: string, registry: Phaser.Data.DataManager): number
    {
        const speed = (registry.get('textSpeed') as number) ?? DEFAULT_SETTINGS.textSpeed;
        return fullString.length * Math.max(4, BASE_MS_PER_CHAR / speed);
    }
}
