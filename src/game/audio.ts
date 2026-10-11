import { DEFAULT_SETTINGS } from './settings';

export function playSfx (scene: Phaser.Scene, key: string, config: Phaser.Types.Sound.SoundConfig = {}): boolean
{
    const sfxVolume = (scene.registry.get('sfxVolume') as number) ?? DEFAULT_SETTINGS.sfxVolume;
    const baseVolume = config.volume ?? 1;

    return scene.sound.play(key, { ...config, volume: baseVolume * sfxVolume });
}
