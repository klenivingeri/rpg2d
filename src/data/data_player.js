export const PLAYER = [
    {
        id: "tank",
        name: "tank",
        path: "assets/player",
        animation: {
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
        },
        base_stats: {
            hp: 5,
            atk: 1,
            speed: 45,
            def: 0,
            shield: 0,
            crit_chance: 0.05,
        },
    },
];

