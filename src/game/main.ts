import { Boot } from './scenes/Boot';
import { CharacterSelect } from './scenes/CharacterSelect';
import { GameOver } from './scenes/GameOver';
import { Game as MainGame } from './scenes/Game';
import { MainMenu } from './scenes/MainMenu';
import { AUTO, Game } from 'phaser';
import { Overlay } from './scenes/Overlay';
import { PauseMenu } from './scenes/PauseMenu';
import { Preloader } from './scenes/Preloader';
import { Settings } from './scenes/Settings';
import { Shop } from './scenes/Shop';
import { Story } from './scenes/Story';

//  Find out more information about the Game Config at:
//  https://docs.phaser.io/api-documentation/typedef/types-core#gameconfig
const config: Phaser.Types.Core.GameConfig = {
    type: AUTO,
    width: 1024,
    height: 768,
    parent: 'game-container',
    backgroundColor: '#028af8',
    // Lets scenes place real HTML elements (the Story scene's name input)
    // over the canvas.
    dom: {
        createContainer: true
    },
    scene: [
        Boot,
        Preloader,
        MainMenu,
        CharacterSelect,
        Story,
        MainGame,
        Shop,
        GameOver,
        PauseMenu,
        Settings,
        Overlay
    ]
};

const StartGame = (parent: string) => {

    return new Game({ ...config, parent });

}

export default StartGame;
