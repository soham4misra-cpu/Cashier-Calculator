import { Input, Math as PhaserMath, Scene } from 'phaser';
import { playSfx } from '../audio';
import { applyAnimationSpeed, DEFAULT_SETTINGS, SETTINGS_SLIDERS, SettingSliderDescriptor, persistSettings } from '../settings';
import { scaledFontSize } from '../ui/text';

const ACCENT_ORANGE = 0xf3814a;
const CARD_COLOR = 0xffffff;
const TEXT_DARK = '#2b241d';
const TEXT_MUTED = '#8a7f70';
const SHADOW_COLOR = 0x2a2018;
const TRACK_COLOR = 0xe4dccb;
const FONT_UI = '"Inter", "Segoe UI", sans-serif';

type ReturnScene = 'MainMenu' | 'PauseMenu';

// Reachable both from the Main Menu and from the in-game Pause Menu —
// `returnTo` is the entire mechanism for that: whichever scene launched us
// (and paused itself to do so) is the one we resume on Back.
export class Settings extends Scene
{
    private returnTo: ReturnScene = 'MainMenu';

    constructor ()
    {
        super('Settings');
    }

    init (data: { returnTo?: ReturnScene }): void
    {
        this.returnTo = data.returnTo ?? 'MainMenu';
    }

    create (): void
    {
        applyAnimationSpeed(this);

        // Launched on top of an already-paused scene, not scene.start'd —
        // no camera fade in/out here, just an instant overlay.
        this.add.rectangle(512, 384, 1024, 768, 0x1a120b, 0.6);

        const cardWidth = 640;
        const cardHeight = 580;
        const cardX = 512;
        const cardY = 384;
        const radius = 28;
        const cardLeft = cardX - cardWidth / 2;
        const cardTop = cardY - cardHeight / 2;

        const shadow = this.add.graphics();
        shadow.fillStyle(SHADOW_COLOR, 0.3);
        shadow.fillRoundedRect(cardLeft + 3, cardTop + 6, cardWidth, cardHeight, radius);

        const bg = this.add.graphics();
        bg.fillStyle(CARD_COLOR, 0.98);
        bg.fillRoundedRect(cardLeft, cardTop, cardWidth, cardHeight, radius);

        this.add.text(cardX, cardTop + 48, 'Settings', {
            fontFamily: FONT_UI, fontStyle: '800', fontSize: scaledFontSize(32, this.registry), color: TEXT_DARK
        }).setOrigin(0.5);

        const firstRowY = cardTop + 118;
        const rowSpacing = 66;

        SETTINGS_SLIDERS.forEach((descriptor, index) => {
            this.createSliderRow(cardLeft, cardWidth, firstRowY + index * rowSpacing, descriptor);
        });

        this.createBackButton(cardX, cardTop + cardHeight - 46);

        // Safety net: persist whatever the sliders are currently set to even
        // if Back wasn't the way this scene closed.
        this.events.once('shutdown', () => persistSettings(this.registry));
    }

    private createSliderRow (cardLeft: number, cardWidth: number, y: number, descriptor: SettingSliderDescriptor): void
    {
        this.add.text(cardLeft + 36, y, descriptor.label, {
            fontFamily: FONT_UI, fontStyle: '600', fontSize: scaledFontSize(17, this.registry), color: TEXT_DARK
        }).setOrigin(0, 0.5);

        const trackLeft = cardLeft + 268;
        const trackWidth = cardWidth - 268 - 110;
        const trackHeight = 8;
        const knobRadius = 13;
        // Nearly the full row height (rows sit 66px apart) so the slider is
        // easy to hit with a finger.
        const rowHitHeight = 60;

        const track = this.add.graphics();
        track.fillStyle(TRACK_COLOR, 1);
        track.fillRoundedRect(trackLeft, y - trackHeight / 2, trackWidth, trackHeight, trackHeight / 2);

        const fill = this.add.graphics();

        const valueText = this.add.text(trackLeft + trackWidth + 18, y, '', {
            fontFamily: FONT_UI, fontStyle: '700', fontSize: scaledFontSize(15, this.registry), color: TEXT_MUTED
        }).setOrigin(0, 0.5);

        const valueToX = (value: number): number => {
            const ratio = (value - descriptor.min) / (descriptor.max - descriptor.min);
            return trackLeft + PhaserMath.Clamp(ratio, 0, 1) * trackWidth;
        };

        const xToValue = (x: number): number => {
            const ratio = PhaserMath.Clamp((x - trackLeft) / trackWidth, 0, 1);
            const raw = descriptor.min + ratio * (descriptor.max - descriptor.min);
            const stepped = Math.round(raw / descriptor.step) * descriptor.step;
            return PhaserMath.Clamp(Math.round(stepped * 100) / 100, descriptor.min, descriptor.max);
        };

        const redraw = (value: number, knobX: number): void => {
            fill.clear();
            fill.fillStyle(ACCENT_ORANGE, 1);
            fill.fillRoundedRect(trackLeft, y - trackHeight / 2, knobX - trackLeft, trackHeight, trackHeight / 2);
            valueText.setText(descriptor.format(value));
        };

        // Click-anywhere-on-track-to-jump shares this exact clamp/snap math
        // with the knob's own drag handler below, via applyValue, so the
        // two input paths can never drift apart.
        const applyValue = (x: number): void => {
            const value = xToValue(x);
            const knobX = valueToX(value);
            knob.x = knobX;
            redraw(value, knobX);
            this.registry.set(descriptor.key, value);
        };

        const currentValue = (this.registry.get(descriptor.key) as number) ?? DEFAULT_SETTINGS[descriptor.key];
        const initialKnobX = valueToX(currentValue);
        redraw(currentValue, initialKnobX);

        const knob = this.add.circle(initialKnobX, y, knobRadius, CARD_COLOR);
        knob.setStrokeStyle(3, ACCENT_ORANGE);

        // One tall, draggable zone over the whole track instead of a draggable
        // knob: a 13px knob is a tiny target once the game is scaled down on a
        // phone. Pressing anywhere jumps the knob there, and dragging from
        // that same press keeps sliding it.
        const trackZone = this.add.zone(
            trackLeft + trackWidth / 2, y, trackWidth + knobRadius * 4, rowHitHeight
        ).setInteractive({ useHandCursor: true, draggable: true });

        trackZone.on('pointerdown', (pointer: Input.Pointer) => applyValue(pointer.x));
        trackZone.on('drag', (pointer: Input.Pointer) => applyValue(pointer.x));
        trackZone.on('pointerup', () => persistSettings(this.registry));
        trackZone.on('dragend', () => persistSettings(this.registry));
    }

    private createBackButton (x: number, y: number): void
    {
        const width = 160;
        const height = 52;
        const radius = height / 2;

        const shadow = this.add.graphics();
        shadow.fillStyle(SHADOW_COLOR, 0.2);
        shadow.fillRoundedRect(-width / 2 + 2, -height / 2 + 4, width, height, radius);

        const bg = this.add.graphics();
        bg.fillStyle(0xf3ede2, 1);
        bg.fillRoundedRect(-width / 2, -height / 2, width, height, radius);

        const label = this.add.text(0, 0, 'Back', {
            fontFamily: FONT_UI, fontStyle: '700', fontSize: scaledFontSize(18, this.registry), color: TEXT_DARK
        }).setOrigin(0.5);

        const container = this.add.container(x, y, [shadow, bg, label]);

        const hitZone = this.add.zone(0, 0, width, height).setInteractive({ useHandCursor: true });
        container.add(hitZone);

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
            this.tweens.add({
                targets: container, scale: 0.92, duration: 70, ease: 'Sine.easeIn',
                onComplete: () => this.tweens.add({ targets: container, scale: 1, duration: 220, ease: 'Back.easeOut' })
            });

            playSfx(this, 'sfx-ui-click', { volume: 0.5 });
            persistSettings(this.registry);

            this.scene.stop('Settings');
            this.scene.resume(this.returnTo);
        });
    }
}
