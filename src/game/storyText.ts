// All story writing lives here, separate from the Story scene's layout code.
//
// Each story is a list of paragraphs. Most beats come in several versions —
// one is picked at random each time — and some are built from separately
// randomised parts, so repeat playthroughs don't read the same way twice.
// Edit or add to any of the lists freely.

import { TOTAL_DAYS } from './economy';

function pick<T> (options: readonly T[]): T
{
    return options[Math.floor(Math.random() * options.length)];
}

function join (paragraphs: string[]): string
{
    return paragraphs.join('\n\n');
}

// --- Intro: between CharacterSelect and day 1 --------------------------------

const INTRO_VARIANTS: ((name: string) => string[])[] = [
    (name) => [
        `Welcome aboard, ${name}!`,
        "After weeks of job hunting, you've finally been hired as the new cashier at the corner shop.",
        "There's just one problem... the store doesn't have a cash register.",
        "Every customer pays with a bill, and it's up to you to work out their change in your head, using as few bills as possible.",
        'Ready for your first day?'
    ],
    (name) => [
        `Congratulations, ${name}, you got the job!`,
        'After a dozen rejection emails, the corner shop was the one place that finally said yes.',
        'The only catch? The cash register broke years ago, and nobody ever bothered to replace it.',
        'Customers pay with a bill, and you hand back their change worked out in your head, with as few bills as possible.',
        'Deep breath. Your first shift starts now.'
    ],
    (name) => [
        `First day on the job, ${name}.`,
        'The apron fits. The name tag is spelled right. Things are looking up.',
        'Then you notice the empty spot on the counter where a cash register should be.',
        "Looks like every customer's change gets worked out in your head, using the fewest bills you can.",
        "Let's open up shop."
    ]
];

export function buildIntroStory (name: string): string
{
    return join(pick(INTRO_VARIANTS)(name));
}

// --- After day 1: the boss sets the (smaller) first target -------------------
// Built from independently picked parts.

const BOSS_SCENES = [
    'At closing time, your boss pulls you aside for a word.',
    'As you wipe down the counter, your boss leans in the doorway, arms crossed.',
    'Before you can clock out, your boss waves you into the back office.'
];

const BOSS_GOOD_DAY: ((name: string) => string)[] = [
    (name) => `"Not bad for a first day, ${name}. But this shop has bills to pay."`,
    (name) => `"You've got potential, ${name}. Now let's talk money."`,
    (name) => `"Decent start, ${name}. Don't get comfortable, though."`
];

const BOSS_ROUGH_DAY: ((name: string) => string)[] = [
    (name) => `"Rough first day, ${name}. Three slip-ups and we had to close early. And this shop has bills to pay."`,
    (name) => `"Closing early on day one, ${name}? That's a new record, and not the good kind."`,
    (name) => `"Three mistakes, ${name}. Three. We lost a whole afternoon of customers."`
];

const BOSS_DEMANDS: ((target: number) => string)[] = [
    (target) => `"I need $${target} in total sales by the end of the week. Fall short, and I'll have to let you go."`,
    (target) => `"Here's the deal: $${target} in sales by the end of the week, or you're done here."`,
    (target) => `"The number is $${target}. Hit it by the end of the week, or I'm finding someone who can."`
];

const BOSS_CLOSERS = ['Better get to work.', 'No pressure, right?', 'Time to get counting.'];

export function buildBossStory (name: string, target: number, earned: number, roughDay: boolean): string
{
    const daysLeft = TOTAL_DAYS - 1;
    const remaining = Math.max(0, target - earned);
    const progress = remaining > 0
        ? `So far you've brought in $${earned}. That leaves $${remaining} to make in the next ${daysLeft} days.`
        : `You've already brought in $${earned}, so you're on track. Just keep it up for ${daysLeft} more days.`;

    return join([
        pick(BOSS_SCENES),
        pick(roughDay ? BOSS_ROUGH_DAY : BOSS_GOOD_DAY)(name),
        pick(BOSS_DEMANDS)(target),
        progress,
        pick(BOSS_CLOSERS)
    ]);
}

// --- After day 2: overdue bills raise the target to the full amount ----------

// Below this share of the full target after day 2, the story adds a warning
// that the player is falling behind.
const FALLING_BEHIND_FRACTION = 0.1;

const BILLS_DISCOVERIES: string[][] = [
    [
        'As you lock up after day 2, you spot an envelope wedged under the shop door.',
        'Inside: a stack of overdue bills. Rent, electricity, the supplier... all stamped PAST DUE.'
    ],
    [
        'While restocking the shelves after day 2, you find a pile of mail stuffed behind the counter.',
        'Every envelope is red. Rent, electricity, the produce supplier... all of it PAST DUE.'
    ],
    [
        'After day 2, the phone behind the counter will not stop ringing.',
        "The landlord. Then the power company. Then the supplier. The shop owes all of them, and they're done waiting."
    ]
];

const BILLS_REVEALS: ((target: number) => string)[] = [
    (target) => `On top of what the boss asked for, you'll need $${target} in total sales by the end of the week to cover it all.`,
    (target) => `Add it all to the boss's quota, and the real number is $${target} in total sales by the end of the week.`,
    (target) => `Forget the boss's number. To keep the lights on, the shop needs $${target} in total sales by the end of the week.`
];

const BILLS_FALLING_BEHIND = [
    'Your coworkers start to look at you weird. You better pick up the pace!',
    'The other cashiers whisper whenever you walk past. You better pick up the pace!',
    'Your coworkers keep glancing at the till, then at you. You better pick up the pace!'
];

const BILLS_CLOSERS = [
    "*sigh* The work just doesn't end.",
    "*sigh* The work just doesn't end.",
    '*sigh* One problem at a time.',
    'Great. Just great.'
];

export function buildBillsStory (target: number, earned: number): string
{
    const daysLeft = TOTAL_DAYS - 2;
    const remaining = Math.max(0, target - earned);
    const progress = remaining > 0
        ? `You've brought in $${earned} so far. That leaves $${remaining} to make in the last ${daysLeft} days.`
        : `You've already brought in $${earned}, so you're covered. Just keep it up for ${daysLeft} more days.`;
    const fallingBehind = earned < target * FALLING_BEHIND_FRACTION;

    return join([
        ...pick(BILLS_DISCOVERIES),
        pick(BILLS_REVEALS)(target),
        progress,
        ...(fallingBehind ? [pick(BILLS_FALLING_BEHIND)] : []),
        pick(BILLS_CLOSERS)
    ]);
}

// --- After days 3 and 4: a progress check-in ---------------------------------
// Which set of versions is used depends on how the week is going.

type Pace = 'covered' | 'on-track' | 'behind';

// Rough share of the full target a steady player has by the end of each day.
// Later days are longer and pay more, so these sit below the share of time
// that has passed.
const EXPECTED_SHARE_AFTER_DAY: Record<number, number> = { 3: 0.4, 4: 0.65 };

function getPace (day: number, target: number, earned: number): Pace
{
    if (earned >= target) return 'covered';
    return earned >= target * (EXPECTED_SHARE_AFTER_DAY[day] ?? 0) ? 'on-track' : 'behind';
}

interface CheckInContext
{
    earned: number;
    target: number;
    remaining: number;
    daysLeft: number;
    progress: string;
}

const MIDWEEK_VARIANTS: Record<Pace, ((c: CheckInContext) => string[])[]> = {
    covered: [
        (c) => [
            'Day 3 is done, and the till is already heavy.',
            `$${c.earned} in sales. That covers the whole $${c.target}, with two days still to go.`,
            'Your boss hums while counting. You have never heard your boss hum.',
            'Anything from here on is pure profit.'
        ],
        (c) => [
            'Day 3 is in the books, and the numbers are looking ridiculous.',
            `$${c.earned} already, against a $${c.target} target.`,
            'A regular asks if you used to be an accountant. You just smile.',
            'Two more days. Might as well keep the streak going.'
        ]
    ],
    'on-track': [
        (c) => [
            'Day 3 wraps up with sore feet and a full till.',
            c.progress,
            'Your boss gives you a nod on the way out. Just a nod, but it counts.',
            'Steady hands. Keep it going.'
        ],
        (c) => [
            'Midweek. The rush is starting to feel like a rhythm.',
            c.progress,
            'The coworker who kept calling you "the new kid" now asks you for help with change.',
            'Two more days.'
        ]
    ],
    behind: [
        (c) => [
            'Day 3 ends, and the math is not looking good.',
            `Only $${c.earned} in sales. You still need $${c.remaining} in just ${c.daysLeft} days.`,
            'Your boss walks past without saying a word, which is somehow worse.',
            'Tomorrow, you need to move faster.'
        ],
        (c) => [
            'Halfway through the week, and the till feels light.',
            c.progress,
            'Someone has taped a "HELP WANTED" sign to the front window. You try not to take it personally.',
            'Time to pick up the pace.'
        ]
    ]
};

const FINAL_EVE_VARIANTS: Record<Pace, ((c: CheckInContext) => string[])[]> = {
    covered: [
        (c) => [
            'One day left, and the bills are already covered.',
            `$${c.earned} in the till, against the $${c.target} the shop needed.`,
            'Tomorrow is a victory lap. Your boss has started calling you "the closer."',
            "Let's finish strong."
        ],
        (c) => [
            'Day 4 is done, and the shop is in the clear.',
            `$${c.earned} in sales. The $${c.target} is covered with a whole day to spare.`,
            'For the first time this week, you go home without counting change in your sleep.',
            'One more shift.'
        ]
    ],
    'on-track': [
        (c) => [
            'Day 4 ends. One shift left.',
            c.progress,
            'The final day is the longest one. Every customer counts.',
            'Get some sleep. Tomorrow decides everything.'
        ],
        (c) => [
            'Only one day stands between you and a paid-off shop.',
            c.progress,
            'Your boss slides a coffee across the counter. "Big day tomorrow."',
            "You've got this."
        ]
    ],
    behind: [
        (c) => [
            'Day 4 is over, and the shop is still well short.',
            `$${c.earned} so far. You'll need $${c.remaining} tomorrow alone.`,
            'Your boss has started browsing job listings on the counter computer. For your position.',
            "Tomorrow, it's all or nothing."
        ],
        (c) => [
            'One day left, and a long way to go.',
            c.progress,
            'Even the customers can tell. One of them leaves you a sticky note that just says "Good luck."',
            'Make tomorrow count.'
        ]
    ]
};

// Added when the day being reviewed ended early from running out of lives.
const ROUGH_DAY_ASIDES = [
    'Closing early today definitely did not help.',
    'Three mistakes and an early close today. That stung.',
    'The early close today cost you a whole afternoon of customers.'
];

export function buildCheckInStory (day: 3 | 4, target: number, earned: number, roughDay: boolean): string
{
    const daysLeft = TOTAL_DAYS - day;
    const remaining = Math.max(0, target - earned);
    const progress = `You've brought in $${earned} so far. $${remaining} to go, with ${daysLeft} ${daysLeft === 1 ? 'day' : 'days'} left.`;
    const pace = getPace(day, target, earned);

    const variants = day === 3 ? MIDWEEK_VARIANTS : FINAL_EVE_VARIANTS;
    const paragraphs = pick(variants[pace])({ earned, target, remaining, daysLeft, progress });

    // The aside goes right before the closing line.
    if (roughDay) paragraphs.splice(paragraphs.length - 1, 0, pick(ROUGH_DAY_ASIDES));

    return join(paragraphs);
}

// --- Endings -----------------------------------------------------------------

interface EndingContext
{
    name: string;
    earned: number;
    target: number;
}

const GOOD_ENDINGS: ((c: EndingContext) => string[])[] = [
    (c) => [
        'On the last evening of the week, your boss counts the till twice, then looks up with a rare smile.',
        `"I'll be honest, ${c.name}. You're the best cashier this shop has ever had. Faster and sharper than anyone else I've hired."`,
        '"No register, no problem. Keep this up and you\'ve got a job here as long as you want it."',
        'On the way home, you drop the envelope of overdue bills in the mailbox. Every last one of them paid.',
        'Another work week survived!'
    ],
    (c) => [
        'The last customer of the week walks out, and your boss flips the sign to CLOSED.',
        `"Every bill paid, ${c.name}. Every single one. Do you know how long it's been since I could say that?"`,
        '"Better than any cashier I\'ve had. You\'ve got a spot here for as long as you want it."',
        'You walk the overdue bills to the mailbox yourself, paid in full.',
        'Another work week survived!'
    ],
    (c) => [
        `The final count comes out to $${c.earned}. More than enough to cover the $${c.target}.`,
        'Your boss pins your name tag to the "Employee of the Week" board. It\'s the only name on the board, but still.',
        `"Nice work, ${c.name}. Honestly, the best I've seen. Same time next week?"`,
        'The overdue bills are paid, the lights stay on, and the shop lives to see another week.',
        'Another work week survived!'
    ]
];

const PROMOTION_ENDINGS: ((c: EndingContext) => string[])[] = [
    (c) => [
        `By the end of the week, the till is overflowing. $${c.earned} in sales, when the shop only needed $${c.target} to survive.`,
        'Your work has turned the corner shop a massive profit. The bills are paid off in one go, with plenty left over.',
        `Your boss comes out from the back, grinning ear to ear. "${c.name}, because of you, we can finally afford to expand this place."`,
        '"Consider this an instant promotion. Shift manager, effective tomorrow."',
        "Keep this up, and you'll own the store soon!"
    ],
    (c) => [
        `$${c.earned} in a single week. The shop needed $${c.target}.`,
        'The owner drives in from out of town just to see the numbers in person.',
        `"${c.name}, with numbers like these, we can open a second location. And I want you running this one."`,
        'Just like that, the new cashier with no register is the new store manager.',
        "Keep this up, and you'll own the store soon!"
    ],
    (c) => [
        'By the end of the week, the shop has made more money than it did all last month.',
        `$${c.earned} in sales, more than double the $${c.target} it needed. A massive profit.`,
        'Your boss tears down the "Help Wanted" sign and hangs up a "Now Expanding" banner.',
        `"Instant promotion, ${c.name}. You've earned it. Maybe we can even afford a cash register now."`,
        "Keep this up, and you'll own the store soon!"
    ]
];

// The movie the player can no longer afford in the close-call ending.
const WEEKEND_MOVIES = ['Avengers', 'Godzilla', 'Spider-Man'];

const CLOSE_CALL_ENDINGS: ((c: EndingContext & { spare: number }) => string[])[] = [
    (c) => [
        'On the last evening of the week, your boss counts the till three times, frowning, then lets out a long breath.',
        `"$${c.earned}. We needed $${c.target}. That's cutting it close, ${c.name}... way too close."`,
        '"Still, the lights stay on. Just don\'t make me anxious like that again."',
        `On the way home, you drop the overdue bills in the mailbox with just $${c.spare} to spare.`,
        'You made it, just barely.'
    ],
    (c) => [
        `The final count: $${c.earned}. The shop needed $${c.target}.`,
        `That's $${c.spare} to spare. Your boss stares at the number for a long, long time.`,
        `"Next week, ${c.name}, I'd like a little more breathing room."`,
        'The bills get paid. With nothing much left over.',
        `You made it, just barely. Unfortunately, you can't go to that ${pick(WEEKEND_MOVIES)} movie you wanted to watch this weekend.`
    ],
    (c) => [
        'The last customer leaves, and you and your boss count the till together, holding your breath.',
        `$${c.earned}. Just over the $${c.target} the shop needed.`,
        'Your boss laughs, a little too loudly. "Well, you get to keep your job here, that\'s what matters, right?"',
        'You made it, just barely.'
    ]
];

const BAD_ENDINGS: ((c: EndingContext & { shortBy: number }) => string[])[] = [
    (c) => [
        'On the last evening of the week, your boss counts the till twice. The smile never comes.',
        `"You brought in $${c.earned}, ${c.name}. Between my quota and those overdue bills, this place needed $${c.target}. We came up $${c.shortBy} short."`,
        '"I\'m sorry, but we\'re gonna need quicker hands working here in the future."',
        'You hang up your apron, and the envelope of overdue bills goes back under the door, still unpaid.',
        'Ugh. Back to job hunting.'
    ],
    (c) => [
        'The week is over, and so is your time at the corner shop.',
        `$${c.earned} in sales. The quota and the overdue bills came to $${c.target}. That's $${c.shortBy} short.`,
        `"I'm sorry, ${c.name}, but we're gonna need quicker hands working here in the future."`,
        'You hand over your apron and walk out past the "Help Wanted" sign, already back in the window.',
        'Ugh. Back to job hunting.'
    ],
    (c) => [
        `Your boss reads the final number out loud: $${c.earned}.`,
        `"We needed $${c.target}, ${c.name}. The landlord isn't going to take an IOU."`,
        '"I\'m sorry, but we\'re gonna need quicker hands working here in the future."',
        'On the bus home, you open your laptop and start a fresh cover letter.',
        'Ugh. Back to job hunting.'
    ]
];

const SECRET_OPENERS = [
    "On the last evening of the week, your boss doesn't even bother counting the till.",
    'On the last day, your boss is waiting for you at the door with a clipboard and a very tired expression.',
    'On the last evening of the week, your boss calls you over, then just stares at you for a while.'
];

const SECRET_ZERO_SALES: ((name: string) => string)[] = [
    (name) => `"Zero dollars, ${name}. A whole week, 5 days, 120 hours, and not one dollar in the till."`,
    (name) => `"Zero, ${name}. Was all that stuff in your application and resume a lie?"`,
    (name) => `"Not a single dollar all week, ${name}. Man, I didn't even know that was possible. I'm impressed, but please search for work elsewhere."`
];

const SECRET_MISTAKES: ((name: string, days: number) => string)[] = [
    (name, days) => `"${days} days this week we had to close early because of your mistakes, ${name}."`,
    (name, days) => `"We closed early ${days} times this week, ${name}. ${days}! The customers think we've gone out of business."`,
    (name, days) => `"${days} early closings in ${TOTAL_DAYS} days, ${name}. That has to be some kind of record."`
];

const SECRET_CLOSERS = [
    'You are fired, and your coworkers laugh on your way out. Not a very supportive work environment, eh?',
    'Somewhere in the back, someone is already printing a new "Help Wanted" sign.',
    'You are escorted out the building by security. Your coworkers look WAY too happy you were fired.'
];

export function buildGoodEndingStory (name: string, target: number, earned: number): string
{
    return join(pick(GOOD_ENDINGS)({ name, target, earned }));
}

export function buildPromotionEndingStory (name: string, target: number, earned: number): string
{
    return join(pick(PROMOTION_ENDINGS)({ name, target, earned }));
}

export function buildCloseCallEndingStory (name: string, target: number, earned: number): string
{
    return join(pick(CLOSE_CALL_ENDINGS)({ name, target, earned, spare: Math.max(0, earned - target) }));
}

export function buildBadEndingStory (name: string, target: number, earned: number): string
{
    return join(pick(BAD_ENDINGS)({ name, target, earned, shortBy: Math.max(0, target - earned) }));
}

export function buildSecretEndingStory (name: string, earned: number, daysClosedEarly: number): string
{
    return join([
        pick(SECRET_OPENERS),
        earned === 0 ? pick(SECRET_ZERO_SALES)(name) : pick(SECRET_MISTAKES)(name, daysClosedEarly),
        '"Geez, did you even try? Work ethic is seriously a lost art..."',
        pick(SECRET_CLOSERS)
    ]);
}
