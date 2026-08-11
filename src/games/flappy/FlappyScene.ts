import * as Phaser from 'phaser';
import { AbstractPhaserScene } from '../../engine/AbstractPhaserScene';
import { OneEuroFilter } from '../../engine/OneEuroFilter';

export class FlappyScene extends AbstractPhaserScene {
    private readonly handFilter = new OneEuroFilter({ minCutoff: 1.2, beta: 0.025 });
    private background!: Phaser.GameObjects.Graphics;
    private pipes!: Phaser.GameObjects.Graphics;
    private bird!: Phaser.GameObjects.Ellipse;
    private title!: Phaser.GameObjects.Text;
    private sun!: Phaser.GameObjects.Text;
    private elapsed = 0;
    private lastWidth = 0;
    private lastHeight = 0;
    private handY: number | null = null;

    constructor() {
        super('flappy-scene');
    }

    protected setupScene(): void {
        this.background = this.add.graphics();
        this.pipes = this.add.graphics();
        this.bird = this.add.ellipse(0, 0, 80, 55, 0xb8ed55).setStrokeStyle(3, 0x3e5b29);
        this.title = this.add.text(0, 0, 'FLAPPY\nBIRD', {
            color: '#f8fcf7',
            fontFamily: 'Arial',
            fontSize: '32px',
            fontStyle: 'bold',
            lineSpacing: -8,
        });
        this.sun = this.add.text(0, 0, '●', {
            color: '#e4e8b9',
            fontFamily: 'Arial',
            fontSize: '100px',
        }).setOrigin(0.5).setAlpha(0.82).setName('flappy-sun');

        this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
            if (this.scale.height > 0) {
                this.handY = pointer.y / this.scale.height;
            }
        });

        this.redraw(this.scale.width, this.scale.height);
    }

    protected updateScene(time: number, delta: number): void {
        this.elapsed += delta;

        if (this.scale.width !== this.lastWidth || this.scale.height !== this.lastHeight) {
            this.redraw(this.scale.width, this.scale.height);
        }

        const fallbackY = 0.5 + Math.sin(this.elapsed / 520) * 0.08;
        const normalizedY = this.handY ?? fallbackY;
        this.bird.setPosition(this.scale.width * 0.5, this.scale.height * normalizedY);

        if (this.handY !== null) {
            this.handY = this.handFilter.filter(normalizedY, time);
        }
    }

    private redraw(width: number, height: number): void {
        this.lastWidth = width;
        this.lastHeight = height;
        this.background.clear();
        this.background.fillGradientStyle(0x5b8b91, 0x5b8b91, 0x1d3648, 0x1d3648, 1);
        this.background.fillRect(0, 0, width, height);

        this.pipes.clear();
        this.drawPipe(width * 0.14, height * 0.7, height * 0.22);
        this.drawPipe(width * 0.78, 0, height * 0.2);

        this.sun.setPosition(width * 0.72, height * 0.28);
        this.sun.setFontSize(`${Math.max(42, Math.min(width, height) * 0.13)}px`);
        this.title.setPosition(width * 0.08, height * 0.08);
    }

    private drawPipe(x: number, y: number, height: number): void {
        const width = this.scale.width * 0.1;
        this.pipes.fillStyle(0x78a52f, 1);
        this.pipes.fillRect(x, y, width, height);
        this.pipes.fillStyle(0xb8e94d, 1);
        this.pipes.fillRect(x + width * 0.36, y, width * 0.25, height);
        this.pipes.fillStyle(0x557d29, 1);
        this.pipes.fillRect(x - width * 0.14, y + (y === 0 ? height - width * 0.2 : 0), width * 1.28, width * 0.22);
    }
}

export const flappyConfig: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    backgroundColor: '#142d3d',
    banner: false,
    title: 'Flappy Bird',
    scene: FlappyScene,
    fps: {
        target: 60,
        forceSetTimeOut: false,
        smoothStep: true,
        deltaHistory: 10,
    },
    render: {
        antialias: false,
        antialiasGL: false,
        roundPixels: true,
        transparent: false,
        clearBeforeRender: true,
        powerPreference: 'high-performance',
        skipUnreadyShaders: true,
    },
};
