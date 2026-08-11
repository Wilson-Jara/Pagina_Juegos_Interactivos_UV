import { useEffect, useRef } from 'react';
import * as Phaser from 'phaser';

type PhaserGameProps = {
    config: Phaser.Types.Core.GameConfig;
};

export default function PhaserGame({ config }: PhaserGameProps) {
    const hostRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        const host = hostRef.current;

        if (!host) {
            return;
        }

        const game = new Phaser.Game({
            ...config,
            parent: host,
            scale: {
                ...config.scale,
                parent: host,
                mode: Phaser.Scale.RESIZE,
                width: '100%',
                height: '100%',
                expandParent: false,
                autoCenter: Phaser.Scale.CENTER_BOTH,
            },
        });

        return () => game.destroy(true);
    }, [config]);

    return <div ref={hostRef} className="phaser-game-host" aria-label="Juego Phaser" />;
}
