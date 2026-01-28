// Configurações centrais de jogo (player, inimigo, projétil)
import { ENEMYS } from "../data/data_enemys";

export const player = {
    id: "player",
    name: "player",
    width: 32,
    maxHealth: 3,
    moveSpeed: 220,
    fireRate: 500, // ms
    rangeMultiplier: 4, // range = width * rangeMultiplier
    attr: {
      def: 0,
      shield: 0,
      crit_chance: 0.05,
    },
    projectile: {
        radius: 6,
        speed: 280,
        ttl: 3000,
        damage: 1,
        
    },
    animation: {
        path: "assets/player",
        run: [
            {
                frame: 0,
                duration: 100,
                img: "sprite_run_two_0.png",
            },
            {
                frame: 1,
                duration: 100,
                img: "sprite_run_two_1.png",
            },
            {
                frame: 2,
                duration: 100,
                img: "sprite_run_two_2.png",
            },
            {
                frame: 3,
                duration: 100,
                img: "sprite_run_two_3.png",
            },
        ],
        idle: [
            {
                frame: 0,
                duration: 100,
                img: "sprite_run_two_0.png",
            },
        ],
    },
};

export const enemy = {
    baseHealth: 3,
    fireRate: 800,
    chaseSpeed: 120, // velocidade de perseguição
    rangeMultiplier: 0.6, // de perseuição
    attackRadiusExtraMultiplier: 1.5, // distancia
    projectile: {
        radius: 6,
        speed: 280,
        ttl: 3000,
        damage: 1,
    },
    attr: {
      def: 0,
      shield: 0,
      crit_chance: 0.05,
    },
    types: ENEMYS, // tipos de enemys que podem ser gerados
};

// compatibilidade: export default mantém a API anterior (gameConfig.player/...)
export default { player, enemy };
