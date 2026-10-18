export type Difficulty = 'easy' | 'normal' | 'hard';

// Length of a full run, in days — the bills target is due by the last one.
export const TOTAL_DAYS = 5;

export interface DifficultyOption
{
    key: Difficulty;
    label: string;
    initialTarget: number;
    billsTarget: number;
}

// Lifetime revenue the shop has to clear by the end of day 5 to keep the
// lights on — harder difficulties ask for more. The boss first quotes the
// smaller initialTarget after day 1; the overdue bills found after day 2
// raise it to billsTarget, which is what the final day actually checks.
export const DIFFICULTIES: DifficultyOption[] = [
    { key: 'easy', label: 'Easy', initialTarget: 180, billsTarget: 300 },
    { key: 'normal', label: 'Normal', initialTarget: 330, billsTarget: 550 },
    { key: 'hard', label: 'Hard', initialTarget: 510, billsTarget: 850 }
];

export const DEFAULT_DIFFICULTY: Difficulty = 'normal';

export type DayLength = 'short' | 'medium' | 'standard';

export interface DayLengthOption
{
    key: DayLength;
    label: string;
    scale: number;
}

// Picked separately from difficulty. Scales every day's real-time length
// (day 1 runs 30s / 45s / 60s) and, since fewer seconds means fewer
// customers, the revenue targets by the same factor.
export const DAY_LENGTHS: DayLengthOption[] = [
    { key: 'short', label: 'Short', scale: 0.5 },
    { key: 'medium', label: 'Medium', scale: 0.75 },
    { key: 'standard', label: 'Standard', scale: 1 }
];

export const DEFAULT_DAY_LENGTH: DayLength = 'standard';

export function getDayLengthScale (dayLength: DayLength): number
{
    return DAY_LENGTHS.find((option) => option.key === dayLength)?.scale ?? 1;
}

// Scaled targets snap to the nearest $5 so the story never quotes $112.50.
function scaleTarget (target: number, dayLength: DayLength): number
{
    return Math.round((target * getDayLengthScale(dayLength)) / 5) * 5;
}

export function getInitialTarget (difficulty: Difficulty, dayLength: DayLength): number
{
    return scaleTarget(DIFFICULTIES.find((option) => option.key === difficulty)?.initialTarget ?? 0, dayLength);
}

export function getBillsTarget (difficulty: Difficulty, dayLength: DayLength): number
{
    return scaleTarget(DIFFICULTIES.find((option) => option.key === difficulty)?.billsTarget ?? 0, dayLength);
}

export const MULTIPLIER_STEP = 0.05;
export const MULTIPLIER_MAX_LEVEL = 10;

export function getPayoutMultiplier (level: number): number
{
    return 1 + level * MULTIPLIER_STEP;
}

export function getMultiplierCost (level: number): number
{
    return 10 * (level + 1);
}

// Shared by GameOver's final-day "Play Again" and the Pause Menu's "Leave
// to Main Menu" — both send the player back to a fresh run and need to
// reset the same run-scoped (not settings) registry state.
export function resetRunState (registry: Phaser.Data.DataManager): void
{
    registry.set('currentDay', 1);
    registry.set('totalRevenue', 0);
    registry.set('cash', 0);
    registry.set('multiplierLevel', 0);
}
