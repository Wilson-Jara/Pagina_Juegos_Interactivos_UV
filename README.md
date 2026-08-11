# Play// Arcade System

Aplicación de juegos interactivos construida con React, TypeScript, Vite y Phaser.js.

## Regla Principal

**Todo juego debe funcionar obligatoriamente sobre Phaser.js.**

React se utiliza para la interfaz, las rutas, el catálogo y los controles de la aplicación. Phaser es el único responsable del renderizado, las escenas, las físicas, el estado de la partida y el game loop de cada juego.

No se deben crear juegos de producción con:

- Canvas 2D directo como motor principal.
- `requestAnimationFrame` propio para reemplazar el loop de Phaser.
- Lógica de juego dentro de componentes React.
- Un motor distinto a Phaser dentro de `src/games/`.

La especificación completa está en [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Estructura

```text
src/
├── pages/              # Páginas React usadas por React Router
├── layouts/            # Shells reutilizables de la aplicación
├── components/         # Componentes de presentación React
├── data/               # Catálogo único de juegos
├── lib/                # Registry de fábricas y servicios de aplicación
├── engine/             # Cámara, input, eventos y contratos compartidos
│   ├── types.ts        # Contrato CameraGame
│   ├── AbstractPhaserScene.ts
│   ├── GameRuntime.ts
│   ├── HandTracker.ts
│   ├── handWorker.ts
│   ├── OneEuroFilter.ts
│   ├── events.ts
│   └── canvasUtils.ts
└── games/              # Módulos autocontenidos, todos basados en Phaser
    ├── _template/
    └── flappy/
```

## Patrones

- **Strategy:** `CameraGame` define el contrato común para los juegos.
- **Template Method:** `AbstractPhaserScene` define el lifecycle común de una escena Phaser y deja hooks a cada juego.
- **Registry / Factory Map:** `src/lib/gameRegistry.ts` crea el juego correcto por su id.
- **Observer:** `EventBus` desacopla estado, score, errores y eventos de cámara.
- **Worker:** `HandTracker` delega la inferencia de MediaPipe a `handWorker.ts`.
- **One Euro Filter:** suaviza landmarks sin agregar lógica de filtrado a cada juego.

## Añadir Un Juego

1. Crear `src/games/<id>/` con una escena Phaser, configuración y factory.
2. Registrar los metadatos en `src/data/games.ts`.
3. Registrar la factory en `src/lib/gameRegistry.ts`.
4. Montar la instancia Phaser desde una página React, sin poner lógica de juego en React.
5. Reutilizar el contrato del engine para cámara, input y eventos.
6. Verificar `npx tsc --noEmit` y `npm run build-nolog`.

## Comandos

| Comando | Descripción |
|---|---|
| `npm install` | Instala las dependencias |
| `npm run dev-nolog` | Inicia el servidor de desarrollo |
| `npm run build-nolog` | Genera el build de producción |
| `npx tsc --noEmit` | Comprueba TypeScript |

## Estado

El proyecto ya tiene el catálogo, el registry y los contratos del engine. Antes de considerar un juego listo para producción, su implementación visual y su loop deben quedar integrados en una escena Phaser siguiendo esta especificación.
