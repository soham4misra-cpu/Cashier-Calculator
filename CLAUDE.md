# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Cashier Calculator is a browser game built on the Phaser 4 + Vite + TypeScript template. The gameplay: a customer arrives with a random basket of items, pays with a bill, and the player must give back the correct change using the fewest bills possible.

## Commands

| Command | Description |
|---------|-------------|
| `npm install` | Install dependencies |
| `npm run dev` | Start dev server at `http://localhost:8080` with hot reload |
| `npm run build` | Production build to `dist/` |
| `npm run dev-nolog` / `npm run build-nolog` | Same as above but skip the `log.js` anonymous analytics ping (see below) |

There is no test suite, linter, or type-check script configured in `package.json`. `tsc` is only used implicitly by Vite during build/dev (`noEmit: true` in `tsconfig.json`), so type errors surface as Vite overlay/console errors, not via a standalone command.

### About log.js

`npm run dev` / `npm run build` run `node log.js` in parallel with the Vite command. This sends an anonymous ping (template name, dev/prod, Phaser version) to a Phaser Studio analytics endpoint — no project or personal data. Use the `-nolog` script variants to skip it.

## Architecture

Standard Phaser scene-based structure. `src/main.ts` waits for `DOMContentLoaded` then calls `StartGame('game-container')` from `src/game/main.ts`, which constructs the Phaser `Game` with a fixed 1024x768 canvas and registers scenes in load order:

`Boot` → `Preloader` → `MainMenu` → `Game` → `GameOver`

- **Boot** (`src/game/scenes/Boot.ts`): loads only the background image needed to render the Preloader itself, then immediately starts `Preloader`.
- **Preloader** (`src/game/scenes/Preloader.ts`): loads all real game assets (characters, item icons, bill images, UI SVGs) from `public/assets`. Also waits (with a 1.5s timeout race) for the `Cormorant Garamond` web font to load before starting `MainMenu` — Phaser bakes text to canvas at creation time, so starting a scene before the font is ready causes it to silently render with a fallback font forever.
- **MainMenu** (`src/game/scenes/MainMenu.ts`): title screen; starts `Game` on pointerdown.
- **Game** (`src/game/scenes/Game.ts`): contains essentially all gameplay logic in one scene class. Key pieces:
  - `ITEMS` / `ITEM_LAYOUTS` / `BILL_VALUES` / `PAYMENT_BILLS`: static config for purchasable items, their icon layout by count, and available bill denominations.
  - `RoundState` (`idle | walking-in | awaiting-change | resolving | walking-out`) drives what player input is accepted at any time; bill buttons and confirm/clear only respond during `awaiting-change`.
  - A round's flow: `startNewCustomer` (rolls items/price/payment, tweens customer in) → `presentItems` (reveals item icons/prices, then opens input) → player taps bill buttons (`createBillButton`) to accumulate `givenAmount` → `handleConfirm` checks correctness *and* that the minimal number of bills was used (`minimalBillCount`) → `showFeedback` displays a themed feedback card → `walkCustomerOut` tweens the customer away and schedules the next round.
  - UI is built imperatively out of `Phaser.GameObjects.Graphics` rounded rects + `Container`s rather than a scene-file/prefab system — there is no separate UI framework or asset atlas for 9-slice buttons.
- **GameOver** (`src/game/scenes/GameOver.ts`): present in the scene list but not currently reachable from `Game`'s logic (no loss condition wired up yet).

## Assets

Static assets live in `public/assets` (characters, items, bills, UI SVGs) and are referenced by string key after being loaded in `Preloader`. `public/assets` also contains some unused leftover files (e.g. `CashierMale.png`, `CustomerMale.png`, `tile_*.png`) not currently loaded by any scene — check `Preloader.preload()` for the authoritative list of assets actually in use before assuming a file is live.
