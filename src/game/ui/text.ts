import { DEFAULT_SETTINGS } from '../settings';

export function scaledFontSize (basePx: number, registry: Phaser.Data.DataManager): number
{
    const multiplier = (registry.get('textSize') as number) ?? DEFAULT_SETTINGS.textSize;
    return Math.round(basePx * multiplier);
}
