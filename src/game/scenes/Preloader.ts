import { Scene } from 'phaser';

export class Preloader extends Scene
{
    constructor ()
    {
        super('Preloader');
    }

    init ()
    {
        //  We loaded this image in our Boot Scene, so we can display it here
        this.add.image(512, 384, 'background');

        //  A simple progress bar. This is the outline of the bar.
        this.add.rectangle(512, 384, 468, 32).setStrokeStyle(1, 0xffffff);

        //  This is the progress bar itself. It will increase in size from the left based on the % of progress.
        const bar = this.add.rectangle(512-230, 384, 4, 28, 0xffffff);

        //  Use the 'progress' event emitted by the LoaderPlugin to update the loading bar
        this.load.on('progress', (progress: number) => {

            //  Update the progress bar (our bar is 464px wide, so 100% = 464px)
            bar.width = 4 + (460 * progress);

        });
    }

    preload ()
    {
        this.load.setPath('assets');

        this.load.image('shop-bg', 'bg2.png');

        this.load.image('cashier-female', 'characters/CashierFemale.png');
        this.load.image('cashier-male', 'characters/CashierMale.png');
        this.load.image('cashier-female-dark', 'characters/CashierFemaledarkskin.png');
        this.load.image('cashier-male-dark', 'characters/CashierMaledarkskin.png');
        this.load.image('customer', 'characters/CustomerFemale.png');
        this.load.image('customer2', 'characters/Customer_2.png');
        this.load.image('customer3', 'characters/Customer_3.png');
        this.load.image('customer4', 'characters/Customer4.png');

        this.load.image('item-apple', 'items/Apple.png');
        this.load.image('item-banana', 'items/Banana.png');
        this.load.image('item-carrot', 'items/Carrot.png');
        this.load.image('item-cilantro', 'items/Cilantro.png');
        this.load.image('item-pepper', 'items/Pepper.png');
        this.load.image('item-water', 'items/Water_bottle.png');
        this.load.image('item-watermelon', 'items/Watermelon.png');

        this.load.image('bill-1', 'items/1Dollar.png');
        this.load.image('bill-5', 'items/5Dollar.png');
        this.load.image('bill-10', 'items/10Dollar.png');
        this.load.image('bill-20', 'items/20Dollar.png');

        this.load.svg('btn-round', 'UI/button_round_depth_flat.svg');
        this.load.svg('icon-check', 'UI/icon_checkmark.svg');

        this.load.audio('sfx-correct', 'Sounds/CashRegisterSound.mp3');
        this.load.audio('music-cashier', 'Sounds/CashierTune.m4a');
        this.load.audio('music-new-game', 'Sounds/New game song.m4a');
        this.load.audio('sfx-ui-click', 'Sounds/UiClick.mp3');
        this.load.audio('sfx-ui-sound', 'Sounds/UiSound.mp3');
        this.load.audio('sfx-chime', 'Sounds/Chime.mp3');
        this.load.audio('sfx-error', 'Sounds/Error.mp3');
        this.load.audio('sfx-progression', 'Sounds/Progression.mp3');
    }

    create ()
    {
        // Phaser draws text onto a canvas, so the web font must finish loading
        // before any Text object is created with it, or it silently falls back
        // and never re-renders once the font arrives.
        const startMenu = () => this.scene.start('MainMenu');

        if (document.fonts)
        {
            Promise.race([
                Promise.all([
                    document.fonts.load('400 24px "Cormorant Garamond"'),
                    document.fonts.load('600 24px "Inter"'),
                    document.fonts.load('800 24px "Inter"')
                ]),
                new Promise((resolve) => setTimeout(resolve, 1500))
            ]).then(startMenu).catch(startMenu);
        }
        else
        {
            startMenu();
        }
    }
}
