# Phaser camera game template

Every new game must be implemented with Phaser.js. React only mounts the Phaser host and displays external UI state.

Recommended structure:

```text
src/games/<game-id>/
├── config.ts
├── factory.ts
├── scenes/
│   └── MainScene.ts
└── README.md
```

Checklist:

1. Extend or adapt `AbstractPhaserScene` for Phaser lifecycle and engine events.
2. Create a Phaser game/scene in the factory.
3. Use Phaser's clock and update loop; do not create a competing `requestAnimationFrame` loop.
4. Receive normalized camera input from `HandTracker`/`EventBus`.
5. Add metadata to `src/data/games.ts`.
6. Register the factory in `src/lib/gameRegistry.ts`.
7. Destroy the Phaser instance when the React page unmounts.
