import type * as Phaser from 'phaser';
import { flappyConfig } from '../games/flappy/FlappyScene';

export type GameFactory = () => Phaser.Types.Core.GameConfig;

const registry: Readonly<Record<string, GameFactory>> = {
    'flappy-bird': () => flappyConfig,
};

export function getGameConfig(gameId: string): Phaser.Types.Core.GameConfig {
    const factory = registry[gameId];

    if (!factory) {
        throw new Error(`No existe una configuración Phaser registrada para el juego "${gameId}".`);
    }

    return factory();
}

export function hasGameFactory(gameId: string): boolean {
    return gameId in registry;
}
