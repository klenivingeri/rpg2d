import { Scene } from 'phaser';
import gameConfig from '../gameConfig';
import { MAPS } from '../../data/data_maps';

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
        this.load.on('progress', (progress) => {

            //  Update the progress bar (our bar is 464px wide, so 100% = 464px)
            bar.width = 4 + (460 * progress);

        });
    }

    preload ()
    {
        //  Load the assets for the game - Replace with your own assets
        this.load.setPath('assets');
        // log load errors to help debugging missing assets
        this.load.on('loaderror', (file) => {
            console.warn('[Preloader] loaderror', file);
        });

        this.load.image('logo', 'logo.png');
        this.load.image('star', 'star.png');

        // carregar frames do player a partir da configuração (todas as animações: run, idle, ...)
        try {
            const anims = (gameConfig && gameConfig.player && gameConfig.player.animation) ? gameConfig.player.animation : null;
            if (anims && typeof anims === 'object') {
                const base = (anims.path || 'player').replace(/^assets\/?/, '');
                Object.keys(anims).forEach((animName) => {
                    const frames = anims[animName];
                    if (!Array.isArray(frames)) return;
                    frames.forEach((frame, idx) => {
                        const key = `player_${animName}_${idx}`;
                        const filename = `${base}/${frame.img}`;
                        this.load.image(key, filename);
                    });
                });
            }
        } catch (e) {
            // silencioso: se algo der errado, continuamos sem bloquear o preloader
        }

        // carregar frames dos inimigos (se definidos em gameConfig.enemy.types)
        try {
            const types = (gameConfig && gameConfig.enemy && Array.isArray(gameConfig.enemy.types)) ? gameConfig.enemy.types : null;
            if (types) {
                types.forEach((type) => {
                    try {
                        const anims = type.animation || null;
                        if (!anims || typeof anims !== 'object') return;
                        const base = (anims.path || type.path || `enemy/${type.id}`).replace(/^assets\/?/, '');
                        Object.keys(anims).forEach((animName) => {
                            const frames = anims[animName];
                            if (!Array.isArray(frames)) return;
                            frames.forEach((frame, idx) => {
                                const key = `enemy_${type.id}_${animName}_${idx}`;
                                const filename = `${base}/${frame.img}`;
                                this.load.image(key, filename);
                            });
                        });
                    } catch (e) { /* ignore individual enemy load failures */ }
                });
            }
        } catch (e) { /* ignore */ }

        // carregar tilemaps e tilesets definidos em `MAPS`
        try {
            if (Array.isArray(MAPS)) {
                const origin = (typeof window !== 'undefined' && window.location && window.location.origin) ? window.location.origin : '';
                MAPS.forEach((m) => {
                    if (m && m.tilemap_key && m.tilemap_path) {
                        const tmPath = (typeof m.tilemap_path === 'string') ? m.tilemap_path.replace(/^\/*/, '') : m.tilemap_path;
                        const tmUrl = origin + '/' + tmPath;
                        this.load.tilemapTiledJSON(m.tilemap_key, tmUrl);
                    }
                    if (Array.isArray(m.tilemap_images)) {
                        m.tilemap_images.forEach((img) => {
                            if (img && img.name && img.path) {
                                const imgPath = (typeof img.path === 'string') ? img.path.replace(/^\/*/, '') : img.path;
                                const imgUrl = origin + '/' + imgPath;
                                this.load.image(img.name, imgUrl);
                            }
                        });
                    }
                });
            }
        } catch (e) { console.warn('[Preloader] error scheduling map loads', e); }
    }

    create ()
    {
        //  When all the assets have loaded, it's often worth creating global objects here that the rest of the game can use.
        //  For example, you can define global animations here, so we can use them in other scenes.

        // Após carregar, NÃO iniciar o Game automaticamente.
        // O controle de início do jogo é feito pela UI React (botão INICIAR).
        // Emitir pequenos logs que ajudam a diagnosticar se os tilesets e tilemaps
        // ficaram disponíveis no cache do Phaser (útil para debugar assets que não aparecem).
        try {
            if (Array.isArray(MAPS)) {
                MAPS.forEach((m) => {
                    if (m && m.tilemap_key) {
                        
                    }
                    if (Array.isArray(m.tilemap_images)) {
                        m.tilemap_images.forEach((img) => {
                            if (img && img.name) {
                            }
                        });
                    }
                });
            }
        } catch (e) {
            console.warn('[Preloader] cache check failed', e);
        }
    }
}
