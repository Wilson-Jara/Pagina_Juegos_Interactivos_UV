export type GameDefinition = {
    id: string;
    title: string;
    subtitle: string;
    description: string;
    route: string;
    category: string;
    badge: string;
    artClass: string;
};

// Single source of truth for the library. Add a definition and a matching registry factory for each new game.
export const gameCatalog = [
    {
        id: 'flappy-bird',
        title: 'Flappy Bird',
        subtitle: 'Controla el vuelo',
        description: 'Usa tu cámara y tus movimientos para mantenerte en el aire.',
        route: '/flappy',
        category: 'Arcade',
        badge: 'CÁMARA',
        artClass: 'game-art--flappy',
    },
] as const satisfies readonly GameDefinition[];
