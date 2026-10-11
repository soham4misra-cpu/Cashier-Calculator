export interface GameSettings
{
    musicVolume: number;
    sfxVolume: number;
    brightness: number;
    textSpeed: number;
    animationSpeed: number;
    textSize: number;
}

export const DEFAULT_SETTINGS: GameSettings = {
    musicVolume: 1,
    sfxVolume: 1,
    brightness: 1,
    textSpeed: 1.2,
    animationSpeed: 1.2,
    textSize: 1
};

const SETTINGS_RANGES: Record<keyof GameSettings, { min: number; max: number }> = {
    musicVolume: { min: 0, max: 1 },
    sfxVolume: { min: 0, max: 1 },
    brightness: { min: 0.4, max: 1 },
    textSpeed: { min: 0.5, max: 2 },
    animationSpeed: { min: 0.5, max: 2 },
    textSize: { min: 0.85, max: 1.3 }
};

const SETTINGS_STORAGE_KEY = 'cashier-calculator:settings';
const SETTINGS_STORAGE_VERSION = 1;

function clamp (value: number, min: number, max: number): number
{
    return Math.min(max, Math.max(min, value));
}

export function loadSettingsFromStorage (): GameSettings
{
    const result: GameSettings = { ...DEFAULT_SETTINGS };

    try
    {
        const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
        if (!raw) return result;

        const parsed = JSON.parse(raw) as Partial<Record<keyof GameSettings, unknown>>;

        for (const key of Object.keys(DEFAULT_SETTINGS) as (keyof GameSettings)[])
        {
            const value = parsed[key];
            if (typeof value === 'number' && Number.isFinite(value))
            {
                const range = SETTINGS_RANGES[key];
                result[key] = clamp(value, range.min, range.max);
            }
        }
    }
    catch
    {
        return { ...DEFAULT_SETTINGS };
    }

    return result;
}

export function persistSettings (registry: Phaser.Data.DataManager): void
{
    try
    {
        const payload: Record<string, number> = { version: SETTINGS_STORAGE_VERSION };

        for (const key of Object.keys(DEFAULT_SETTINGS) as (keyof GameSettings)[])
        {
            payload[key] = (registry.get(key) as number) ?? DEFAULT_SETTINGS[key];
        }

        localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(payload));
    }
    catch
    {
        // Private browsing / quota exceeded — settings just won't persist this session.
    }
}

export function seedSettingsIntoRegistry (registry: Phaser.Data.DataManager): void
{
    const settings = loadSettingsFromStorage();

    for (const key of Object.keys(DEFAULT_SETTINGS) as (keyof GameSettings)[])
    {
        registry.set(key, settings[key]);
    }
}

export function applyAnimationSpeed (scene: Phaser.Scene): void
{
    const multiplier = (scene.registry.get('animationSpeed') as number) ?? DEFAULT_SETTINGS.animationSpeed;
    scene.tweens.timeScale = multiplier;
    scene.time.timeScale = multiplier;
}

export interface SettingSliderDescriptor
{
    key: keyof GameSettings;
    label: string;
    min: number;
    max: number;
    step: number;
    format: (value: number) => string;
}

const formatPercent = (value: number): string => `${Math.round(value * 100)}%`;
const formatMultiplier = (value: number): string => `${value.toFixed(2)}x`;

export const SETTINGS_SLIDERS: SettingSliderDescriptor[] = [
    { key: 'musicVolume', label: 'Music Volume', min: SETTINGS_RANGES.musicVolume.min, max: SETTINGS_RANGES.musicVolume.max, step: 0.05, format: formatPercent },
    { key: 'sfxVolume', label: 'Sound Effect Volume', min: SETTINGS_RANGES.sfxVolume.min, max: SETTINGS_RANGES.sfxVolume.max, step: 0.05, format: formatPercent },
    { key: 'brightness', label: 'Brightness', min: SETTINGS_RANGES.brightness.min, max: SETTINGS_RANGES.brightness.max, step: 0.05, format: formatPercent },
    { key: 'textSpeed', label: 'Text Speed', min: SETTINGS_RANGES.textSpeed.min, max: SETTINGS_RANGES.textSpeed.max, step: 0.1, format: formatMultiplier },
    { key: 'animationSpeed', label: 'Animation Speed', min: SETTINGS_RANGES.animationSpeed.min, max: SETTINGS_RANGES.animationSpeed.max, step: 0.1, format: formatMultiplier },
    { key: 'textSize', label: 'Text Size', min: SETTINGS_RANGES.textSize.min, max: SETTINGS_RANGES.textSize.max, step: 0.05, format: formatMultiplier }
];
