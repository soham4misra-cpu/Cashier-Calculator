import { GameObjects, Math as PhaserMath, Scene } from 'phaser';
import { DEFAULT_SETTINGS } from '../settings';

// Always-on, always-on-top brightness scrim. Launched once near boot and
// never stopped — registered last in main.ts's scene list so Phaser's
// render order (which follows scene-array registration order) keeps it
// above every other scene, including menus, without any per-scene wiring.
export class Overlay extends Scene
{
    private scrim: GameObjects.Rectangle;

    constructor ()
    {
        super('Overlay');
    }

    create (): void
    {
        this.scrim = this.add.rectangle(512, 384, 1024, 768, 0x000000, 0);
        this.scrim.setScrollFactor(0);

        this.applyBrightness((this.registry.get('brightness') as number) ?? DEFAULT_SETTINGS.brightness);

        this.registry.events.on('changedata-brightness', (_parent: unknown, value: number) => {
            this.applyBrightness(value);
        });

        // Belt-and-suspenders on top of registration order.
        this.scene.bringToTop();
    }

    private applyBrightness (brightness: number): void
    {
        const clamped = PhaserMath.Clamp(brightness, 0.4, 1);
        this.scrim.setAlpha(1 - clamped);
    }
}
