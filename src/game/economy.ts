export type Difficulty = 'easy' | 'normal' | 'hard';

// Length of a full run, in days — the bills target is due by the last one.
export const TOTAL_DAYS = 5;

export interface DifficultyOption
{
    key: Difficulty;
    label: string;
    billsTarget: number;
}

// Lifetime revenue the shop has to clear by the end of day 5 to keep the
// lights on — harder difficulties ask for more.
export const DIFFICULTIES: DifficultyOption[] = [
    { key: 'easy', label: 'Easy', billsTarget: 150 },
    { key: 'normal', label: 'Normal', billsTarget: 300 },
    { key: 'hard', label: 'Hard', billsTarget: 500 }
];

export const DEFAULT_DIFFICULTY: Difficulty = 'normal';

export function getBillsTarget (difficulty: Difficulty): number
{
    return DIFFICULTIES.find((option) => option.key === difficulty)?.billsTarget ?? 0;
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
