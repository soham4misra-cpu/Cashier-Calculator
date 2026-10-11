// What a customer says on their way out, picked by how long the player
// took to hand over the right change. The clock is the same one the speed
// bonus uses — it starts when the controls go live and keeps running
// through any wrong attempts, so fumbling makes the customer wait too.
//
// Edit the lists freely: one is picked at random each time.

export const INSTANT_REMARK_SECONDS = 1;
export const FAST_REMARK_SECONDS = 3;
export const SLOW_REMARK_SECONDS = 10;

// Sprite keys (see CUSTOMER_KEYS in Game.ts) of the customers who count as
// older — only they can say the OLD_FAST_REMARKS lines.
export const OLD_CUSTOMER_KEYS: string[] = [];

// Suspiciously fast — under a second.
export const INSTANT_REMARKS: string[] = [
    'Why do your hands look like a blur?',
    "I don't need my service THAT fast.",
    'Geez, geez take your time!',
    'Do you work part time as a speedster?'
];

export const FAST_REMARKS: string[] = [
    'Keep up the good work!',
    'Man, that was quick!',
    'That was quick.',
    "You don't waste time, huh?",
    'You deserve a raise, this is good stuff!',
    "You don't see cashiers with skills like you often.",
    'Your prices may be inflated, but this service is top notch!'
];

// Added to the fast pool only when an older customer is speaking.
export const OLD_FAST_REMARKS: string[] = [
    "Maybe this generation's work force does have some hope!"
];

export const NORMAL_REMARKS: string[] = [
    'Thanks, have a good one!',
    'Appreciate it!',
    'See you next time!',
    'Thanks for the help!',
    'Have a nice day!'
];

export const SLOW_REMARKS: string[] = [
    'I have places to be, can we speed up a bit next time?',
    'Geez, employees take it too easy these days.',
    'I think my milk expired while I was waiting.',
    'Did you have to count that by hand? Twice?',
    "I've aged a year standing here.",
    'Next time I am bringing a snack for the wait.'
];

function getPool (elapsedSeconds: number, customerKey: string | null): string[]
{
    if (elapsedSeconds < INSTANT_REMARK_SECONDS) return INSTANT_REMARKS;

    if (elapsedSeconds < FAST_REMARK_SECONDS)
    {
        const isOld = customerKey !== null && OLD_CUSTOMER_KEYS.includes(customerKey);
        return isOld ? [...FAST_REMARKS, ...OLD_FAST_REMARKS] : FAST_REMARKS;
    }

    return elapsedSeconds >= SLOW_REMARK_SECONDS ? SLOW_REMARKS : NORMAL_REMARKS;
}

export function pickRemark (elapsedSeconds: number, customerKey: string | null): string
{
    const pool = getPool(elapsedSeconds, customerKey);

    return pool[Math.floor(Math.random() * pool.length)];
}
