# Arquitectura React + Phaser

## Objetivo

Separar completamente la aplicación de presentación del motor de los juegos:

- React controla navegación, layout, login, búsqueda y catálogo.
- Phaser controla escenas, renderizado, físicas, audio, entidades y loop de juego.
- El engine comparte cámara, input, filtros y eventos entre juegos.
- El registry evita condicionales de juegos repartidos por la aplicación.

## Flujo De Ejecución

```text
React Page
   ↓ monta un Phaser host
Game Registry
   ↓ crea la implementación por id
Phaser Game / Scene
   ↑ recibe input normalizado
Engine: HandTracker → Worker → EventBus
```

React no debe actualizar sprites ni ejecutar físicas. Solo monta/desmonta el host de Phaser y muestra el estado de alto nivel que el juego publique.

## Capas

### `pages/`

Páginas React conectadas a React Router. Una página puede montar un juego, pero no contiene reglas de juego.

### `layouts/`

Shells visuales reutilizables para Home, juegos y futuras vistas autenticadas.

### `components/`

Componentes de presentación. Un componente puede renderizar el contenedor de Phaser, controles o estados de carga, pero no debe contener la lógica de una escena.

### `data/`

Fuente única de verdad para metadatos:

```ts
type GameDefinition = {
    id: string;
    title: string;
    route: string;
    category: string;
};
```

Los metadatos no crean instancias ni importan escenas. Eso evita acoplar el catálogo a la implementación.

### `lib/`

Servicios de aplicación. `gameRegistry.ts` contiene el mapa id → factory y es el único punto que conoce qué implementación Phaser corresponde a cada juego.

### `engine/`

Código reutilizable y agnóstico al contenido de un juego:

- `types.ts`: contratos de cámara, input y ciclo de vida.
- `AbstractPhaserScene.ts`: Template Method para el lifecycle de escenas Phaser.
- `GameRuntime.ts`: coordinación del runtime; no debe competir con el loop de Phaser en la versión final.
- `HandTracker.ts`: webcam y comunicación con el worker.
- `handWorker.ts`: inferencia MediaPipe fuera del hilo principal.
- `OneEuroFilter.ts`: suavizado de landmarks.
- `events.ts`: Observer/Event Bus.
- `canvasUtils.ts`: helpers de soporte para input o herramientas auxiliares, no un motor alternativo.

### `games/`

Cada carpeta representa un módulo autocontenido y obligatorio de Phaser:

```text
games/<game-id>/
├── config.ts       # Configuración Phaser del juego
├── scenes/         # Escenas Phaser
├── factory.ts      # Factory usada por gameRegistry
└── README.md       # Decisiones y controles específicos
```

## Regla Phaser Obligatoria

Cada juego debe:

1. Crear una instancia `Phaser.Game` o una escena Phaser válida.
2. Usar el loop, reloj y lifecycle de Phaser.
3. Mantener sprites, físicas, score y estado dentro de Phaser.
4. Recibir cámara/input mediante un adaptador del engine o eventos.
5. Liberar la instancia Phaser al desmontar la página React.
6. Exponer solo eventos o estado mínimo a React.

Un `CameraGame` puede definir el contrato que usa el engine, pero la implementación concreta debe extender `AbstractPhaserScene` o una escena Phaser equivalente. Un Canvas directo solo puede servir como helper técnico, nunca como motor de un juego de producción.

## Patrones Aplicados

### Strategy

`CameraGame` permite que el engine trabaje con distintos juegos sin conocer sus reglas. Cada juego implementa el contrato mediante una escena Phaser.

### Template Method

`AbstractPhaserScene` fija operaciones comunes como creación y actualización de la escena. Cada juego implementa sus hooks sin duplicar lifecycle.

### Registry / Factory

```ts
const registry = {
    'flappy-bird': (context) => createFlappyPhaserGame(context),
};
```

Agregar un juego requiere una entrada en el catálogo y otra en el registry, no modificar `Home` ni añadir `if` por toda la aplicación.

### Observer

El Event Bus publica `status`, `score`, errores y eventos de input. React puede suscribirse sin importar clases internas de Phaser.

### Worker

La inferencia de manos ocurre fuera del hilo principal. El worker devuelve landmarks normalizados; el adaptador los publica en el Event Bus y la escena Phaser decide cómo utilizarlos.

## Checklist De Revisión

- [ ] El juego usa Phaser y no un loop Canvas propio.
- [ ] La escena se destruye al abandonar la ruta.
- [ ] El juego está registrado en `gameRegistry.ts`.
- [ ] El catálogo de `data/games.ts` contiene sus metadatos.
- [ ] La cámara no bloquea el hilo principal.
- [ ] Los landmarks pasan por `OneEuroFilter` cuando corresponda.
- [ ] React no contiene reglas ni entidades del juego.
- [ ] `npx tsc --noEmit` pasa.
- [ ] `npm run build-nolog` pasa.
