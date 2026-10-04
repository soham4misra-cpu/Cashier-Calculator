export type Difficulty = 'easy' | 'normal' | 'hard';

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
