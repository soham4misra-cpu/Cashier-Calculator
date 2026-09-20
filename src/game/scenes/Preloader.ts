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

        this.load.image('cashier', 'characters/CashierFemale.png');
        this.load.image('customer', 'characters/CustomerFemale.png');

        this.load.image('item-apple', 'items/Apple.png');
        this.load.image('item-banana', 'items/Banana.png');
        this.load.image('item-carrot', 'items/Carrot.png');
        this.load.image('item-cilantro', 'items/Cilantro.png');

        this.load.image('bill-1', 'items/1Dollar.png');
        this.load.image('bill-5', 'items/5Dollar.png');
        this.load.image('bill-10', 'items/10Dollar.png');
        this.load.image('bill-20', 'items/20Dollar.png');

        this.load.svg('btn-round', 'UI/button_round_depth_flat.svg');
        this.load.svg('icon-check', 'UI/icon_checkmark.svg');
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
                document.fonts.load('400 24px "Cormorant Garamond"'),
                new Promise((resolve) => setTimeout(resolve, 1500))
            ]).then(startMenu).catch(startMenu);
        }
        else
        {
            startMenu();
        }
    }
}
