import { Scene, GameObjects } from 'phaser';

export const STARTING_LIVES = 3;

const HEART_SIZE = 26;
const HEART_GAP = 34;
const HEART_RED = 0xd9542f;
const HEART_EMPTY = 0xd8cdb8;

function drawHeart (g: GameObjects.Graphics, size: number, color: number): void
{
    const r = size / 4;
    g.clear();
    g.fillStyle(color, 1);
    g.fillCircle(-r, -r * 0.6, r);
    g.fillCircle(r, -r * 0.6, r);
    g.fillTriangle(-size / 2, -r * 0.35, size / 2, -r * 0.35, 0, size / 2);
}

// Shows the player's remaining lives as a row of hearts in a stat pill at the
// top-center of the screen.
export class Lives
{
    remaining: number;
    container: GameObjects.Container;
    private hearts: GameObjects.Graphics[] = [];

    constructor (scene: Scene, x: number, y: number, count = STARTING_LIVES)
    {
        this.remaining = count;

        const width = 52 + count * HEART_GAP;
        const height = 44;

        const shadow = scene.add.graphics();
        shadow.fillStyle(0x000000, 0.18);
        shadow.fillRoundedRect(-width / 2 + 2, 3, width, height, 14);

        const bg = scene.add.graphics();
        bg.fillStyle(0xfaf3e6, 0.95);
        bg.fillRoundedRect(-width / 2, 0, width, height, 14);
        bg.lineStyle(2, 0xd8cdb8, 1);
        bg.strokeRoundedRect(-width / 2, 0, width, height, 14);

        this.container = scene.add.container(x, y, [shadow, bg]);
        this.container.setDepth(10);

        for (let i = 0; i < count; i++)
        {
            const heart = scene.add.graphics({ x: (i - (count - 1) / 2) * HEART_GAP, y: height / 2 + 2 });
            drawHeart(heart, HEART_SIZE, HEART_RED);
            this.hearts.push(heart);
            this.container.add(heart);
        }
    }

    // Removes one life and returns how many are left.
    lose (): number
    {
        if (this.remaining <= 0) return 0;

        this.remaining -= 1;
        const heart = this.hearts[this.remaining];
        drawHeart(heart, HEART_SIZE, HEART_EMPTY);

        heart.scene.tweens.add({ targets: heart, scale: 1.35, duration: 120, yoyo: true, ease: 'Sine.easeOut' });

        return this.remaining;
    }
}
