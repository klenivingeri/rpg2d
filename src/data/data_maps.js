export const MAPS = [
    {
        id: "nature_1",
        tilemap_key: "nature_1", //  key do tilemap, é pra onde next_map_id vai apontar, pra encontrar o proximo mapa
        tilemap_path: "assets/maps/narute_1.tmj", // onde encontrar o tilemap
        tilemap_images: [
            {
                name: "tileset_version1.1",
                path: "assets/maps/tileset_version1.1.png",
            },
            {
                name: "assets_version1.1", // nome da imagem do tilemap
                path: "assets/maps/assets_version1.1.png", // onde encontrar o a imagem do tilemap
            },
        ],
        next_map_id: "nature_2", // proximo mapa a ser exibido quando entrar no portal
        mob_count: 10, // quantidade de enemys que vão spawnar nesse mapa
        possible_mobs: ["tank", "arqueiro"], // os tipos de enemy que podem spawnar nesse mapa
        boss_spawn_pos: { x: 1200, y: 200 }, // posicao do boss no mapa, ele tem o drop de tudo que um enemy normal tem
        portal: { x: 575, y: 1150, sprit: "", w: "50", h: "50" },
        complete_map: true, // quando é derrotado todos os mobs do mapa,  fica true e o "portal" aparece
    },
    {
        id: "nature_2",
        tilemap_key: "nature_2",
        tilemap_path: "assets/maps/narute_2.tmj",
        tilemap_images: [
            {
                name: "tileset_version1.1",
                path: "assets/maps/tileset_version1.1.png",
            },
            {
                name: "assets_version1.1",
                path: "assets/maps/assets_version1.1.png",
            },
        ],
        next_map_id: "nature_3",
        mob_count: 15,
        possible_mobs: ["tank", "arqueiro"],
        portal: { x: 575, y: 1150, sprit: "", w: "50", h: "50" },
        complete_map: true,
    },
    {
        id: "nature_1",
        tilemap_key: "nature_3",
        tilemap_path: "assets/maps/narute_1.tmj",
        tilemap_images: [
            {
                name: "tileset_version1.1",
                path: "assets/maps/tileset_version1.1.png",
            },
            {
                name: "assets_version1.1",
                path: "assets/maps/assets_version1.1.png",
            },
        ],
        next_map_id: "nature_4",
        mob_count: 10,
        possible_mobs: ["tank", "arqueiro"],
        boss_spawn_pos: { x: 1200, y: 200 },
        portal: { x: 575, y: 1150, sprit: "", w: "50", h: "50" },
        complete_map: true,
    },
    {
        id: "nature_2",
        tilemap_key: "nature_4",
        tilemap_path: "assets/maps/narute_2.tmj",
        tilemap_images: [
            {
                name: "tileset_version1.1",
                path: "assets/maps/tileset_version1.1.png",
            },
            {
                name: "assets_version1.1",
                path: "assets/maps/assets_version1.1.png",
            },
        ],
        next_map_id: "nature_5",
        mob_count: 15,
        possible_mobs: ["tank", "arqueiro"],
        portal: { x: 575, y: 1150, sprit: "", w: "50", h: "50" },
        complete_map: true,
    },
    {
        id: "nature_1",
        tilemap_key: "nature_5",
        tilemap_path: "assets/maps/narute_1.tmj",
        tilemap_images: [
            {
                name: "tileset_version1.1",
                path: "assets/maps/tileset_version1.1.png",
            },
            {
                name: "assets_version1.1",
                path: "assets/maps/assets_version1.1.png",
            },
        ],
        next_map_id: "nature_6",
        mob_count: 10,
        possible_mobs: ["tank", "arqueiro"],
        boss_spawn_pos: { x: 1200, y: 200 },
        portal: { x: 575, y: 1150, sprit: "", w: "50", h: "50" },
        complete_map: true,
    },
    {
        id: "nature_2",
        tilemap_key: "nature_6",
        tilemap_path: "assets/maps/narute_2.tmj",
        tilemap_images: [
            {
                name: "tileset_version1.1",
                path: "assets/maps/tileset_version1.1.png",
            },
            {
                name: "assets_version1.1",
                path: "assets/maps/assets_version1.1.png",
            },
        ],
        next_map_id: "nature_7",
        mob_count: 15,
        possible_mobs: ["tank", "arqueiro"],
        portal: { x: 575, y: 1150, sprit: "", w: "50", h: "50" },
        complete_map: true,
    },
    {
        id: "nature_1",
        tilemap_key: "nature_7",
        tilemap_path: "assets/maps/narute_1.tmj",
        tilemap_images: [
            {
                name: "tileset_version1.1",
                path: "assets/maps/tileset_version1.1.png",
            },
            {
                name: "assets_version1.1",
                path: "assets/maps/assets_version1.1.png",
            },
        ],
        next_map_id: "nature_8",
        mob_count: 10,
        possible_mobs: ["tank", "arqueiro"],
        boss_spawn_pos: { x: 1200, y: 200 },
        portal: { x: 575, y: 1150, sprit: "", w: "50", h: "50" },
        complete_map: true,
    },
    {
        id: "nature_2",
        tilemap_key: "nature_8",
        tilemap_path: "assets/maps/narute_2.tmj",
        tilemap_images: [
            {
                name: "tileset_version1.1",
                path: "assets/maps/tileset_version1.1.png",
            },
            {
                name: "assets_version1.1",
                path: "assets/maps/assets_version1.1.png",
            },
        ],
        next_map_id: "nature_9",
        mob_count: 15,
        possible_mobs: ["tank", "arqueiro"],
        portal: { x: 575, y: 1150, sprit: "", w: "50", h: "50" },
        complete_map: true,
    },
        {
        id: "nature_2",
        tilemap_key: "nature_9",
        tilemap_path: "assets/maps/narute_2.tmj",
        tilemap_images: [
            {
                name: "tileset_version1.1",
                path: "assets/maps/tileset_version1.1.png",
            },
            {
                name: "assets_version1.1",
                path: "assets/maps/assets_version1.1.png",
            },
        ],
        next_map_id: "end_game",
        mob_count: 15,
        possible_mobs: ["tank", "arqueiro"],
        portal: { x: 575, y: 1150, sprit: "", w: "50", h: "50" },
        complete_map: true,
    },
            {
        id: "nature_2",
        tilemap_key: "end_game",
        tilemap_path: "assets/maps/narute_2.tmj",
        tilemap_images: [
            {
                name: "tileset_version1.1",
                path: "assets/maps/tileset_version1.1.png",
            },
            {
                name: "assets_version1.1",
                path: "assets/maps/assets_version1.1.png",
            },
        ],
        next_map_id: "end_game",
        mob_count: 15,
        possible_mobs: ["tank", "arqueiro"],
        portal: { x: 575, y: 1150, sprit: "", w: "50", h: "50" },
        complete_map: true,
    },
];
