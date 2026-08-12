import * as Phaser from 'phaser';
import { AbstractPhaserScene } from '../../engine/AbstractPhaserScene';
import { getLatestCameraFrame } from '../../engine/cameraInput';
import type { TrackedHand } from '../../engine/types';

const DESIGN_H = 720;
const GRAVITY = 1008;
const FLAP_VELOCITY = -325;
const MAX_FALL_SPEED = 450;
const EASY_PIPE_SPEED = 180;
const MEDIUM_PIPE_SPEED = 198;
const HARD_PIPE_SPEED = 216;
const EXTREME_PIPE_SPEED = 234;
const EXTREME_SPEED_STEP = 14;
const EASY_PIPE_GAP = 220;
const MEDIUM_PIPE_GAP = 205;
const HARD_PIPE_GAP = 190;
const EXTREME_PIPE_GAP = 178;
const EXTREME_GAP_STEP = 6;
const MIN_PIPE_GAP = 136;
const PIPE_SPACING = 330;
const PIPE_WIDTH = 84;
const CAP_WIDTH = 94;
const CAP_HEIGHT = 36;
const GROUND_HEIGHT = 72;
const BIRD_RADIUS = 28;
const BIRD_SCALE = 1;
const MAX_LIVES = 3;
const HAND_FLAP_COOLDOWN_MS = 120;
const POOL_SIZE = 5;
const BEST_SCORE_KEY = 'play-arcade-flappy-best';
const LEADERBOARD_GAME_ID = 'flappy';

type Phase = 'ready' | 'play' | 'dying' | 'over';

interface PipePair {
    topBody: Phaser.GameObjects.Image;
    topCap: Phaser.GameObjects.Image;
    bottomBody: Phaser.GameObjects.Image;
    bottomCap: Phaser.GameObjects.Image;
    x: number;
    gapY: number;
    gap: number;
    scored: boolean;
    active: boolean;
}

class Sfx {
    private ctx: AudioContext | null = null;

    private ensure(): AudioContext | null {
        try {
            if (!this.ctx) {
                this.ctx = new AudioContext();
            }
            if (this.ctx.state === 'suspended') {
                void this.ctx.resume();
            }
            return this.ctx;
        } catch {
            return null;
        }
    }

    private tone(start: number, end: number, duration: number, type: OscillatorType, volume: number): void {
        const ctx = this.ensure();

        if (!ctx) {
            return;
        }

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(start, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(Math.max(1, end), ctx.currentTime + duration);
        gain.gain.setValueAtTime(volume, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + duration);
    }

    flap(): void {
        this.tone(520, 880, 0.09, 'triangle', 0.05);
    }

    score(): void {
        this.tone(920, 1380, 0.11, 'square', 0.03);
    }

    hit(): void {
        this.tone(320, 80, 0.3, 'sawtooth', 0.08);
    }
}

export class FlappyScene extends AbstractPhaserScene {
    private phase: Phase = 'ready';
    private u = 1;
    private w = 1;
    private h = 1;
    private groundY = 0;
    private birdX = 0;
    private birdBaseY = 0;
    private birdVy = 0;
    private score = 0;
    private lives = MAX_LIVES;
    private bestRun = 0;
    private best = 0;
    private pipeSpeed = EASY_PIPE_SPEED;
    private pipeGap = EASY_PIPE_GAP;
    private distanceToNextPipe = 0;
    private lastCameraTimestamp = -1;
    private lastHandFlapAt = Number.NEGATIVE_INFINITY;
    private handRequiresClose = false;

    private readonly sfx = new Sfx();

    private sky!: Phaser.GameObjects.Image;
    private farSkyline!: Phaser.GameObjects.Image;
    private nearSkyline!: Phaser.GameObjects.Image;
    private ground!: Phaser.GameObjects.TileSprite;
    private bird!: Phaser.GameObjects.Sprite;
    private pipes: PipePair[] = [];

    private scoreText!: Phaser.GameObjects.Text;
    private lifeDots: Phaser.GameObjects.Arc[] = [];
    private readyTitle!: Phaser.GameObjects.Text;
    private readyHint!: Phaser.GameObjects.Text;
    private readyShortcut!: Phaser.GameObjects.Text;
    private readyLives!: Phaser.GameObjects.Text;
    private hintTween: Phaser.Tweens.Tween | null = null;

    private overShade!: Phaser.GameObjects.Rectangle;
    private retryButton!: Phaser.GameObjects.Image;
    private overTitle!: Phaser.GameObjects.Text;
    private overScoreLabel!: Phaser.GameObjects.Text;
    private overScoreValue!: Phaser.GameObjects.Text;
    private overBestLabel!: Phaser.GameObjects.Text;
    private overBestValue!: Phaser.GameObjects.Text;
    private overNew!: Phaser.GameObjects.Text;
    private overHint!: Phaser.GameObjects.Text;
    private retryNote!: Phaser.GameObjects.Text;
    private medal!: Phaser.GameObjects.Image;

    constructor() {
        super('flappy-scene');
    }

    protected setupScene(): void {
        this.best = this.readBest();
        this.createTextures();
        this.createAnimations();

        this.input.on('pointerdown', this.handleTap);
        this.input.keyboard?.on('keydown-SPACE', this.handleTap);
        this.input.keyboard?.on('keydown-UP', this.handleTap);
        this.scale.on(Phaser.Scale.Events.RESIZE, this.handleResize);

        this.events.once(Phaser.Scenes.Events.DESTROY, () => {
            this.scale.off(Phaser.Scale.Events.RESIZE, this.handleResize);
        });

        this.buildWorld();
    }

    protected updateScene(time: number, delta: number): void {
        const dt = delta / 1000;
        this.updateHandInput(time);

        if (this.phase === 'ready') {
            this.scrollWorld(dt);
            this.bird.y = this.birdBaseY + Math.sin(time * 0.004) * 9 * this.u;
            this.bird.rotation = Math.sin(time * 0.004 + 0.8) * 0.08;
            return;
        }

        if (this.phase === 'play') {
            this.scrollWorld(dt);
            this.updatePlay(dt);
            return;
        }

        if (this.phase === 'dying') {
            this.updateDying(dt);
        }
    }

    flap(): void {
        if (this.phase !== 'play') {
            return;
        }

        const now = this.time.now;

        if (now - this.lastHandFlapAt < HAND_FLAP_COOLDOWN_MS) {
            return;
        }

        this.lastHandFlapAt = now;
        this.birdVy = FLAP_VELOCITY * this.u;
        this.bird.rotation = -0.42;
        this.sfx.flap();
    }

    private updateHandInput(_time: number): void {
        const frame = getLatestCameraFrame();

        if (!frame || frame.timestamp <= this.lastCameraTimestamp) {
            return;
        }

        this.lastCameraTimestamp = frame.timestamp;
        const hand = frame.hands[0];
        const handOpen = hand && this.isHandOpen(hand);

        if (this.handRequiresClose) {
            if (handOpen) {
                return;
            }

            this.handRequiresClose = false;
            return;
        }

        if (!handOpen) {
            return;
        }

        if (this.phase === 'ready') {
            this.startPlay();
        }

        this.flap();
    }

    private isHandOpen(hand: TrackedHand): boolean {
        const landmarks = hand.landmarks;

        if (landmarks.length < 21) {
            return false;
        }

        const tips = [8, 12, 16, 20];
        const joints = [5, 9, 13, 17];
        let extended = 0;

        for (let index = 0; index < tips.length; index += 1) {
            if (landmarks[tips[index]].y < landmarks[joints[index]].y) {
                extended += 1;
            }
        }

        if (Math.abs(landmarks[4].x - landmarks[3].x) > 0.04) {
            extended += 1;
        }

        return extended >= 3;
    }

    private readonly handleTap = (): void => {
        if (this.phase === 'ready') {
            this.startPlay();
            this.flap();
            return;
        }

        if (this.phase === 'play') {
            this.flap();
            return;
        }

    };

    private readonly handleRetryClick = (): void => {
        if (this.phase === 'over') {
            this.resetRun();
        }
    };

    private readonly handleResize = (): void => {
        this.buildWorld();
    };

    private startPlay(): void {
        this.phase = 'play';
        this.handRequiresClose = false;
        this.score = 0;
        this.scoreText.setText('0').setVisible(true);
        this.readyTitle.setVisible(false);
        this.readyHint.setVisible(false);
        this.readyShortcut.setVisible(false);
        this.readyLives.setVisible(false);
        this.hintTween?.stop();
        this.updateDifficulty();
        this.distanceToNextPipe = PIPE_SPACING * this.u * 1.2;
    }

    private updatePlay(dt: number): void {
        this.birdVy = Math.min(this.birdVy + GRAVITY * this.u * dt, MAX_FALL_SPEED * this.u);
        this.bird.y += this.birdVy * dt;

        const ceiling = BIRD_RADIUS * this.u;

        if (this.bird.y < ceiling) {
            this.bird.y = ceiling;
            this.birdVy = Math.max(this.birdVy, 0);
        }

        const targetRotation = this.birdVy < 0
            ? -0.42
            : Math.min(1.35, (this.birdVy / (MAX_FALL_SPEED * this.u)) * 1.7);
        this.bird.rotation += (targetRotation - this.bird.rotation) * Math.min(1, dt * (this.birdVy < 0 ? 14 : 6));

        this.distanceToNextPipe -= this.pipeSpeed * this.u * dt;

        if (this.distanceToNextPipe <= 0) {
            this.spawnPipe(this.w + PIPE_WIDTH * this.u);
            this.distanceToNextPipe += PIPE_SPACING * this.u;
        }

        const r = BIRD_RADIUS * this.u;
        const bx = this.bird.x;
        const by = this.bird.y;
        const pipeW = PIPE_WIDTH * this.u;
        const step = this.pipeSpeed * this.u * dt;

        for (const pipe of this.pipes) {
            if (!pipe.active) {
                continue;
            }

            pipe.x -= step;
            this.layoutPipe(pipe);

            if (pipe.x < -CAP_WIDTH * this.u) {
                this.deactivatePipe(pipe);
                continue;
            }

            if (!pipe.scored && pipe.x + pipeW / 2 < bx) {
                pipe.scored = true;
                this.score += 1;
                this.scoreText.setText(String(this.score));
                this.updateDifficulty();
                this.punchScore();
                this.sfx.score();
            }

            const left = pipe.x - pipeW / 2;
            const gapHalf = pipe.gap / 2;
            const topHeight = pipe.gapY - gapHalf;
            const bottomTop = pipe.gapY + gapHalf;

            if (
                this.circleRect(bx, by, r, left, -60 * this.u, pipeW, topHeight + 60 * this.u)
                || this.circleRect(bx, by, r, left, bottomTop, pipeW, this.groundY - bottomTop)
            ) {
                this.die(false);
                return;
            }
        }

        if (by + r >= this.groundY) {
            this.bird.y = this.groundY - r;
            this.die(true);
        }
    }

    private updateDying(dt: number): void {
        this.birdVy = Math.min(this.birdVy + GRAVITY * this.u * dt, MAX_FALL_SPEED * this.u * 1.2);
        this.bird.y += this.birdVy * dt;
        this.bird.rotation += (Math.PI / 2 - this.bird.rotation) * Math.min(1, dt * 7);

        if (this.bird.y >= this.groundY - BIRD_RADIUS * this.u) {
            this.bird.y = this.groundY - BIRD_RADIUS * this.u;
            this.finishDeath();
        }
    }

    private die(onGround: boolean): void {
        if (this.phase !== 'play') {
            return;
        }

        this.phase = 'dying';
        this.lives = Math.max(0, this.lives - 1);
        this.bestRun = Math.max(this.bestRun, this.score);
        this.updateLivesUi();
        this.bird.anims.stop();
        this.bird.setTexture('fb-bird-1');
        this.sfx.hit();
        this.cameras.main.flash(110, 255, 255, 255);
        this.cameras.main.shake(230, 5 * this.u);

        if (onGround) {
            this.bird.rotation = Math.PI / 2;
            this.finishDeath();
        } else {
            this.birdVy = Math.min(this.birdVy, -160 * this.u);
        }
    }

    private finishDeath(): void {
        if (this.lives > 0) {
            this.resetLife();
        } else {
            this.showGameOver();
        }
    }

    private showGameOver(): void {
        this.phase = 'over';

        this.bestRun = Math.max(this.bestRun, this.score);
        const isNewBest = this.bestRun > this.best;

        if (isNewBest) {
            this.best = this.bestRun;
            this.saveBest(this.best);
        }

        this.overScoreLabel.setText(`Puntaje: ${this.bestRun}`);
        this.overBestLabel.setText(`Mejor: ${this.best}`);
        this.overNew.setVisible(isNewBest);
        this.lifeDots.forEach((dot) => dot.setVisible(false));

        const medalKey = this.bestRun >= 40
            ? 'fb-medal-platinum'
            : this.bestRun >= 30
                ? 'fb-medal-gold'
                : this.bestRun >= 20
                    ? 'fb-medal-silver'
                    : this.bestRun >= 10
                        ? 'fb-medal-bronze'
                        : '';
        this.medal.setVisible(false).setTexture(medalKey || 'fb-medal-bronze');

        this.scoreText.setVisible(false);
        this.overShade.setVisible(true);
        this.retryButton.setVisible(true);
        this.overTitle.setVisible(true);
        this.overScoreLabel.setVisible(true);
        this.overBestLabel.setVisible(true);
        this.overHint.setVisible(true);
        this.retryNote.setVisible(true);

        this.tweens.add({
            targets: [this.overShade, this.overTitle, this.overScoreLabel, this.overBestLabel, this.retryButton, this.overHint, this.retryNote],
            alpha: { from: 0, to: 1 },
            duration: 180,
        });

        this.emitLeaderboardEvent('game:over', { gameId: LEADERBOARD_GAME_ID, score: this.bestRun });
    }

    private resetRun(): void {
        this.emitLeaderboardEvent('game:restart', { gameId: LEADERBOARD_GAME_ID });
        this.lives = MAX_LIVES;
        this.bestRun = 0;
        this.resetLife();
    }

    private resetLife(): void {
        this.phase = 'ready';
        this.score = 0;
        this.pipeSpeed = EASY_PIPE_SPEED;
        this.pipeGap = EASY_PIPE_GAP;
        this.birdVy = 0;
        this.bird.setPosition(this.birdX, this.birdBaseY);
        this.bird.setRotation(0);
        this.bird.setTexture('fb-bird-0');
        this.bird.anims.play('fb-flap');
        this.handRequiresClose = true;

        for (const pipe of this.pipes) {
            this.deactivatePipe(pipe);
        }

        this.scoreText.setText('0').setVisible(false);
        this.overShade.setVisible(false);
        this.retryButton.setVisible(false);
        this.overTitle.setVisible(false);
        this.overScoreLabel.setVisible(false);
        this.overScoreValue.setVisible(false);
        this.overBestLabel.setVisible(false);
        this.overBestValue.setVisible(false);
        this.overNew.setVisible(false);
        this.overHint.setVisible(false);
        this.retryNote.setVisible(false);
        this.medal.setVisible(false);
        this.readyTitle.setVisible(true);
        this.readyHint.setVisible(true);
        this.readyShortcut.setVisible(true);
        this.readyLives.setVisible(true);
        this.updateLivesUi();
        this.hintTween?.stop();
        this.hintTween = this.tweens.add({
            targets: this.readyHint,
            alpha: { from: 1, to: 0.3 },
            duration: 620,
            yoyo: true,
            repeat: -1,
        });
    }

    private emitLeaderboardEvent(type: 'game:over' | 'game:restart', detail: { gameId: string; score?: number }): void {
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent(type, { detail }));
        }
    }

    private updateLivesUi(): void {
        this.readyLives.setText(`(o presiona ESPACIO)\n\n${this.lives} vidas`);

        for (let index = 0; index < this.lifeDots.length; index += 1) {
            const active = index < this.lives;
            this.lifeDots[index]
                .setFillStyle(active ? 0xffd232 : 0x1b2c3b, active ? 1 : 0.8)
                .setStrokeStyle(2 * this.u, active ? 0xf0be28 : 0x526f7f, 0.95)
                .setVisible(this.phase !== 'over');
        }
    }

    private updateDifficulty(): void {
        if (this.score < 10) {
            this.pipeSpeed = EASY_PIPE_SPEED;
            this.pipeGap = EASY_PIPE_GAP;
            return;
        }

        if (this.score < 15) {
            this.pipeSpeed = MEDIUM_PIPE_SPEED;
            this.pipeGap = MEDIUM_PIPE_GAP;
            return;
        }

        if (this.score < 25) {
            this.pipeSpeed = HARD_PIPE_SPEED;
            this.pipeGap = HARD_PIPE_GAP;
            return;
        }

        const tenPointStage = Math.max(0, Math.floor(this.score / 10) - 2);
        this.pipeSpeed = Math.min(360, EXTREME_PIPE_SPEED + tenPointStage * EXTREME_SPEED_STEP);
        this.pipeGap = Math.max(MIN_PIPE_GAP, EXTREME_PIPE_GAP - tenPointStage * EXTREME_GAP_STEP);
    }

    private scrollWorld(dt: number): void {
        this.ground.tilePositionX += this.pipeSpeed * dt;
    }

    private spawnPipe(x: number): void {
        const pipe = this.pipes.find((candidate) => !candidate.active);

        if (!pipe) {
            return;
        }

        const gap = this.pipeGap * this.u;
        const margin = 128 * this.u;
        const min = margin + gap / 2;
        const max = Math.max(min + 1, this.groundY - margin * 0.85 - gap / 2);

        pipe.active = true;
        pipe.scored = false;
        pipe.x = x;
        pipe.gapY = min + Math.random() * (max - min);
        pipe.gap = gap;
        this.layoutPipe(pipe);

        pipe.topBody.setVisible(true);
        pipe.topCap.setVisible(true);
        pipe.bottomBody.setVisible(true);
        pipe.bottomCap.setVisible(true);
    }

    private layoutPipe(pipe: PipePair): void {
        const pipeW = PIPE_WIDTH * this.u;
        const capH = CAP_HEIGHT * this.u;
        const gapHalf = pipe.gap / 2;

        const topHeight = pipe.gapY - gapHalf;
        const topBodyHeight = Math.max(0, topHeight - capH);
        pipe.topBody.setVisible(topBodyHeight > 0);
        pipe.topBody.setDisplaySize(pipeW, Math.max(1, topBodyHeight));
        pipe.topBody.setPosition(pipe.x, topBodyHeight / 2);
        pipe.topCap.setDisplaySize(CAP_WIDTH * this.u, capH);
        pipe.topCap.setPosition(pipe.x, topHeight - capH / 2);

        const bottomTop = pipe.gapY + gapHalf;
        const bottomBodyHeight = Math.max(0, this.groundY - bottomTop - capH);
        pipe.bottomBody.setVisible(bottomBodyHeight > 0);
        pipe.bottomBody.setDisplaySize(pipeW, Math.max(1, bottomBodyHeight));
        pipe.bottomBody.setPosition(pipe.x, bottomTop + capH + bottomBodyHeight / 2);
        pipe.bottomCap.setDisplaySize(CAP_WIDTH * this.u, capH);
        pipe.bottomCap.setPosition(pipe.x, bottomTop + capH / 2);
    }

    private deactivatePipe(pipe: PipePair): void {
        pipe.active = false;
        pipe.topBody.setVisible(false);
        pipe.topCap.setVisible(false);
        pipe.bottomBody.setVisible(false);
        pipe.bottomCap.setVisible(false);
    }

    private punchScore(): void {
        this.tweens.add({
            targets: this.scoreText,
            scaleX: { from: this.u * 1.28, to: this.u },
            scaleY: { from: this.u * 1.28, to: this.u },
            duration: 140,
            ease: 'Quad.easeOut',
        });
    }

    private circleRect(cx: number, cy: number, r: number, rx: number, ry: number, rw: number, rh: number): boolean {
        const nearestX = Phaser.Math.Clamp(cx, rx, rx + rw);
        const nearestY = Phaser.Math.Clamp(cy, ry, ry + rh);
        const dx = cx - nearestX;
        const dy = cy - nearestY;

        return dx * dx + dy * dy <= r * r;
    }

    private buildWorld(): void {
        this.destroyWorld();

        this.w = Math.max(1, this.scale.width);
        this.h = Math.max(1, this.scale.height);
        this.u = this.h / DESIGN_H;
        this.groundY = this.h - GROUND_HEIGHT * this.u;
        this.birdX = Phaser.Math.Clamp(this.w * 0.28, 88 * this.u, 330 * this.u);
        this.birdBaseY = this.h * 0.47;

        this.sky = this.add.image(0, 0, 'fb-sky').setOrigin(0).setDisplaySize(this.w, this.h).setDepth(0);

        const worldTiles = Math.ceil(this.w / this.u);

        this.lifeDots = [];
        for (let index = 0; index < MAX_LIVES; index += 1) {
            this.lifeDots.push(
                this.add.circle((24 + index * 26) * this.u, 26 * this.u, 9 * this.u, 0xffd232)
                    .setStrokeStyle(2 * this.u, 0xf0be28)
                    .setDepth(9),
            );
        }

        this.farSkyline = this.add.image(0, this.groundY - 184 * this.u, 'fb-city-far')
            .setOrigin(0)
            .setDisplaySize(this.w, 190 * this.u)
            .setAlpha(0.88)
            .setDepth(2);
        this.nearSkyline = this.add.image(0, this.groundY - 142 * this.u, 'fb-city-near')
            .setOrigin(0)
            .setDisplaySize(this.w, 150 * this.u)
            .setAlpha(0.96)
            .setDepth(3);

        this.pipes = [];

        for (let i = 0; i < POOL_SIZE; i += 1) {
            this.pipes.push({
                topBody: this.add.image(0, 0, 'fb-pipe-body').setDepth(5).setVisible(false),
                topCap: this.add.image(0, 0, 'fb-pipe-cap').setDepth(5).setVisible(false),
                bottomBody: this.add.image(0, 0, 'fb-pipe-body').setDepth(5).setVisible(false),
                bottomCap: this.add.image(0, 0, 'fb-pipe-cap').setDepth(5).setVisible(false),
                x: 0,
                gapY: 0,
                gap: 0,
                scored: false,
                active: false,
            });
        }

        this.ground = this.add.tileSprite(0, this.groundY, worldTiles + 140, GROUND_HEIGHT, 'fb-ground')
            .setOrigin(0)
            .setScale(this.u)
            .setDepth(6);

        this.bird = this.add.sprite(this.birdX, this.birdBaseY, 'fb-bird-0')
            .setScale(this.u * BIRD_SCALE)
            .setOrigin(0.4, 0.5)
            .setDepth(7);
        this.bird.anims.play('fb-flap');

        const uiFont = { fontFamily: '"Courier New", monospace' };

        this.scoreText = this.add.text(this.w / 2, this.h * 0.1, '0', {
            ...uiFont,
            fontSize: '76px',
            fontStyle: 'bold',
            color: '#ffffff',
            stroke: '#100d29',
            strokeThickness: 7,
        }).setOrigin(0.5).setScale(this.u).setDepth(8).setVisible(false);

        this.readyTitle = this.add.text(this.w / 2, this.h * 0.2, 'FLAPPY', {
            ...uiFont,
            fontSize: '42px',
            fontStyle: 'bold',
            color: '#f8f34d',
        }).setOrigin(0.5).setScale(this.u).setDepth(9);

        this.readyHint = this.add.text(this.w / 2, this.h * 0.285, 'Control por gestos', {
            ...uiFont,
            fontSize: '17px',
            color: '#f4f2f8',
        }).setOrigin(0.5).setScale(this.u).setDepth(9);

        this.readyShortcut = this.add.text(this.w / 2, this.h * 0.575, 'Abre la mano para jugar', {
            ...uiFont,
            fontSize: '17px',
            color: '#9a84ff',
        }).setOrigin(0.5).setScale(this.u).setDepth(9);

        this.readyLives = this.add.text(this.w / 2, this.h * 0.635, '(o presiona ESPACIO)\n\n3 vidas', {
            ...uiFont,
            fontSize: '13px',
            color: '#a09cae',
            align: 'center',
            lineSpacing: 2,
        }).setOrigin(0.5).setScale(this.u).setDepth(9);

        const panelX = this.w / 2;
        const panelY = this.h * 0.4;

        this.overShade = this.add.rectangle(this.w / 2, this.h / 2, this.w, this.h, 0x05030f, 0.55)
            .setDepth(8)
            .setVisible(false);

        this.overTitle = this.add.text(panelX, panelY - 90 * this.u, 'GAME OVER', {
            ...uiFont,
            fontSize: '40px',
            fontStyle: 'bold',
            color: '#ff5c5c',
        }).setOrigin(0.5).setScale(this.u).setDepth(10).setVisible(false);

        this.overScoreLabel = this.add.text(panelX, panelY - 25 * this.u, 'Puntaje: 0', {
            ...uiFont,
            fontSize: '18px',
            color: '#f4f044',
        }).setOrigin(0.5).setScale(this.u).setDepth(10).setVisible(false);

        this.overScoreValue = this.add.text(panelX + 34 * this.u, panelY - 8 * this.u, '0', {
            ...uiFont,
            fontSize: '42px',
            fontStyle: 'bold',
            color: '#ffffff',
            stroke: '#7c5e1e',
            strokeThickness: 7,
        }).setOrigin(0, 0.5).setScale(this.u).setDepth(10).setVisible(false);

        this.overBestLabel = this.add.text(panelX, panelY + 28 * this.u, 'Mejor: 0', {
            ...uiFont,
            fontSize: '15px',
            color: '#f4f044',
        }).setOrigin(0.5).setScale(this.u).setDepth(10).setVisible(false);

        this.overBestValue = this.add.text(panelX + 34 * this.u, panelY + 56 * this.u, '0', {
            ...uiFont,
            fontSize: '42px',
            fontStyle: 'bold',
            color: '#ffffff',
            stroke: '#7c5e1e',
            strokeThickness: 7,
        }).setOrigin(0, 0.5).setScale(this.u).setDepth(10).setVisible(false);

        this.overNew = this.add.text(panelX + 118 * this.u, panelY - 58 * this.u, '¡NUEVO!', {
            ...uiFont,
            fontSize: '22px',
            fontStyle: 'bold',
            color: '#ff5d5d',
            stroke: '#6b1f1f',
            strokeThickness: 5,
        }).setOrigin(0.5).setScale(this.u).setDepth(10).setVisible(false);

        this.retryButton = this.add.image(panelX, panelY + 150 * this.u, 'fb-retry-button')
            .setScale(this.u)
            .setDepth(10)
            .setVisible(false)
            .setInteractive({ useHandCursor: true });
        this.retryButton.on('pointerdown', this.handleRetryClick);

        this.overHint = this.add.text(panelX, panelY + 150 * this.u, 'TRY AGAIN', {
            ...uiFont,
            fontSize: '18px',
            color: '#292632',
        }).setOrigin(0.5).setScale(this.u).setDepth(11).setVisible(false);

        this.retryNote = this.add.text(panelX, panelY + 207 * this.u, 'Haz clic en el botón', {
            ...uiFont,
            fontSize: '10px',
            color: '#9b97a5',
        }).setOrigin(0.5).setScale(this.u).setDepth(10).setVisible(false);

        this.medal = this.add.image(panelX - 102 * this.u, panelY + 26 * this.u, 'fb-medal-bronze')
            .setScale(this.u).setDepth(10).setVisible(false);

        this.resetRun();
    }

    private destroyWorld(): void {
        this.hintTween?.stop();
        this.hintTween = null;

        this.sky?.destroy();
        this.farSkyline?.destroy();
        this.nearSkyline?.destroy();
        this.ground?.destroy();
        this.bird?.destroy();
        this.scoreText?.destroy();
        this.readyTitle?.destroy();
        this.readyHint?.destroy();
        this.readyShortcut?.destroy();
        this.readyLives?.destroy();
        this.overShade?.destroy();
        this.retryButton?.destroy();
        this.overTitle?.destroy();
        this.overScoreLabel?.destroy();
        this.overScoreValue?.destroy();
        this.overBestLabel?.destroy();
        this.overBestValue?.destroy();
        this.overNew?.destroy();
        this.overHint?.destroy();
        this.retryNote?.destroy();
        this.medal?.destroy();

        for (const pipe of this.pipes) {
            pipe.topBody.destroy();
            pipe.topCap.destroy();
            pipe.bottomBody.destroy();
            pipe.bottomCap.destroy();
        }

        for (const dot of this.lifeDots) {
            dot.destroy();
        }

        this.lifeDots = [];
        this.pipes = [];
    }

    private createAnimations(): void {
        if (this.anims.exists('fb-flap')) {
            return;
        }

        this.anims.create({
            key: 'fb-flap',
            frames: [
                { key: 'fb-bird-0' },
                { key: 'fb-bird-1' },
                { key: 'fb-bird-2' },
                { key: 'fb-bird-3' },
                { key: 'fb-bird-4' },
                { key: 'fb-bird-5' },
                { key: 'fb-bird-6' },
            ],
            frameRate: 15,
            repeat: -1,
        });
    }

    private createTextures(): void {
        if (this.textures.exists('fb-sky')) {
            return;
        }

        this.drawCanvas('fb-sky', 512, 720, (ctx) => {
            const gradient = ctx.createLinearGradient(0, 0, 0, 720);
            gradient.addColorStop(0, '#07131f');
            gradient.addColorStop(0.42, '#0d2638');
            gradient.addColorStop(0.72, '#12384a');
            gradient.addColorStop(1, '#0b1a27');
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, 512, 720);

            const glow = ctx.createRadialGradient(256, 300, 20, 256, 300, 360);
            glow.addColorStop(0, 'rgba(44, 174, 255, 0.22)');
            glow.addColorStop(0.5, 'rgba(44, 174, 255, 0.08)');
            glow.addColorStop(1, 'rgba(44, 174, 255, 0)');
            ctx.fillStyle = glow;
            ctx.fillRect(0, 0, 512, 720);

            let seed = 31;
            const random = (): number => {
                seed = (seed * 16807) % 2147483647;
                return seed / 2147483647;
            };

            for (let index = 0; index < 105; index += 1) {
                const size = index % 9 === 0 ? 3 : index % 3 === 0 ? 2 : 1.5;
                ctx.fillStyle = index % 4 === 0
                    ? 'rgba(123, 212, 255, 0.72)'
                    : 'rgba(235, 245, 255, 0.58)';
                ctx.fillRect(random() * 512, random() * 700, size, size);
            }
        });

        this.createCityTextures();

        this.drawCanvas('fb-retry-button', 260, 60, (ctx) => {
            const path = new Path2D();
            const radius = 10;

            path.moveTo(10 + radius, 4);
            path.arcTo(250, 4, 250, 56, radius);
            path.arcTo(250, 56, 10, 56, radius);
            path.arcTo(10, 56, 10, 4, radius);
            path.arcTo(10, 4, 250, 4, radius);
            path.closePath();

            ctx.fillStyle = '#ffffff';
            ctx.fill(path);
        });

        this.createBirdTextures();
        this.createPipeTextures();
        this.createGroundTexture();
        this.createMedalTextures();
    }

    private createCityTextures(): void {
        this.drawCanvas('fb-city-far', 640, 190, (ctx) => {
            let seed = 17;
            const random = (): number => {
                seed = (seed * 16807) % 2147483647;
                return seed / 2147483647;
            };

            let x = -8;

            while (x < 640) {
                const width = 28 + random() * 42;
                const height = 58 + random() * 78;
                const top = 190 - height;

                ctx.fillStyle = random() > 0.5 ? '#0d2a3b' : '#102f40';
                ctx.fillRect(x, top, width, height);

                if (random() > 0.62) {
                    ctx.fillStyle = '#16445a';
                    ctx.fillRect(x + width * 0.48, top - 18, 3, 18);
                }

                ctx.fillStyle = 'rgba(123, 212, 255, 0.18)';
                for (let row = top + 18; row < 180; row += 18) {
                    if (random() > 0.34) {
                        ctx.fillRect(x + 8, row, 4, 5);
                    }
                    if (random() > 0.46 && width > 38) {
                        ctx.fillRect(x + width - 13, row, 4, 5);
                    }
                }

                x += width + 7 + random() * 13;
            }
        });

        this.drawCanvas('fb-city-near', 640, 150, (ctx) => {
            let seed = 43;
            const random = (): number => {
                seed = (seed * 16807) % 2147483647;
                return seed / 2147483647;
            };

            let x = -12;

            while (x < 640) {
                const width = 36 + random() * 54;
                const height = 36 + random() * 82;
                const top = 150 - height;

                ctx.fillStyle = random() > 0.5 ? '#091f2d' : '#0b2433';
                ctx.fillRect(x, top, width, height);

                if (random() > 0.72) {
                    ctx.fillStyle = '#12394b';
                    ctx.fillRect(x + width * 0.42, top - 12, 4, 12);
                }

                ctx.fillStyle = 'rgba(184, 241, 75, 0.14)';
                for (let row = top + 16; row < 144; row += 19) {
                    if (random() > 0.4) {
                        ctx.fillRect(x + 9, row, 5, 6);
                    }
                    if (random() > 0.56 && width > 45) {
                        ctx.fillRect(x + width - 16, row, 5, 6);
                    }
                }

                x += width + 6 + random() * 12;
            }
        });
    }

    private drawCanvas(key: string, width: number, height: number, draw: (ctx: CanvasRenderingContext2D) => void): void {
        const texture = this.textures.createCanvas(key, width, height);

        if (!texture) {
            return;
        }

        draw(texture.context);
        texture.refresh();
        texture.setFilter(Phaser.Textures.FilterMode.LINEAR);
    }

    private createBirdTextures(): void {
        const wingOffsets = [-8, -6, -3, 1, 5, 8, 4];

        for (let frame = 0; frame < 7; frame += 1) {
            this.drawCanvas(`fb-bird-${frame}`, 80, 64, (ctx) => {
                const cx = 32;
                const cy = 32;

                ctx.fillStyle = '#e6b41e';
                ctx.beginPath();
                ctx.moveTo(cx - 17, cy + 2);
                ctx.lineTo(cx - 31, cy - 8);
                ctx.lineTo(cx - 24, cy + 10);
                ctx.closePath();
                ctx.fill();

                const bodyGradient = ctx.createRadialGradient(cx - 10, cy - 12, 3, cx + 2, cy + 4, 35);
                bodyGradient.addColorStop(0, '#fff178');
                bodyGradient.addColorStop(0.48, '#ffd232');
                bodyGradient.addColorStop(1, '#e8a91e');
                ctx.fillStyle = bodyGradient;
                ctx.beginPath();
                ctx.arc(cx, cy, BIRD_RADIUS, 0, Math.PI * 2);
                ctx.fill();

                ctx.strokeStyle = '#d39b1f';
                ctx.lineWidth = 3;
                ctx.stroke();

                ctx.fillStyle = 'rgba(255, 249, 169, 0.42)';
                ctx.beginPath();
                ctx.ellipse(cx - 9, cy + 11, 11, 7, -0.35, 0, Math.PI * 2);
                ctx.fill();

                const wingGradient = ctx.createLinearGradient(cx - 24, cy - 8, cx - 5, cy + 16);
                wingGradient.addColorStop(0, '#f6cd42');
                wingGradient.addColorStop(1, '#c98b17');
                ctx.fillStyle = wingGradient;
                ctx.strokeStyle = '#bd851c';
                ctx.lineWidth = 1.8;
                ctx.beginPath();
                ctx.moveTo(cx - 8, cy + 2);
                ctx.lineTo(cx - 22, cy + wingOffsets[frame] - 5);
                ctx.lineTo(cx - 5, cy + 14);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();

                ctx.strokeStyle = 'rgba(255, 236, 105, 0.72)';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(cx - 12, cy + 3);
                ctx.lineTo(cx - 19, cy + wingOffsets[frame] - 1);
                ctx.stroke();

                ctx.fillStyle = '#ffffff';
                ctx.beginPath();
                ctx.arc(cx + 10, cy - 8, 8, 0, Math.PI * 2);
                ctx.fill();

                ctx.fillStyle = '#282828';
                ctx.beginPath();
                ctx.arc(cx + 12, cy - 8, 5, 0, Math.PI * 2);
                ctx.fill();

                ctx.fillStyle = '#ffffff';
                ctx.beginPath();
                ctx.arc(cx + 13, cy - 10, 2, 0, Math.PI * 2);
                ctx.fill();

                ctx.fillStyle = '#ff781e';
                ctx.beginPath();
                ctx.moveTo(cx + BIRD_RADIUS, cy);
                ctx.lineTo(cx + BIRD_RADIUS + 14, cy + 4);
                ctx.lineTo(cx + BIRD_RADIUS - 2, cy + 10);
                ctx.closePath();
                ctx.fill();
                ctx.strokeStyle = '#d35e16';
                ctx.lineWidth = 1.5;
                ctx.stroke();

                ctx.fillStyle = '#ff9b2e';
                ctx.beginPath();
                ctx.moveTo(cx + BIRD_RADIUS + 1, cy + 1);
                ctx.lineTo(cx + BIRD_RADIUS + 11, cy + 4);
                ctx.lineTo(cx + BIRD_RADIUS + 1, cy + 5);
                ctx.closePath();
                ctx.fill();
            });
        }
    }

    private createPipeTextures(): void {
        const body = this.add.graphics();
        body.fillStyle(0x3e5b29);
        body.fillRect(0, 0, PIPE_WIDTH, 64);
        body.fillStyle(0x6abe30);
        body.fillRect(3, 0, PIPE_WIDTH - 6, 64);
        body.fillStyle(0xa8e05c);
        body.fillRect(11, 0, 14, 64);
        body.fillStyle(0x4f8a22);
        body.fillRect(PIPE_WIDTH - 20, 0, 14, 64);
        body.generateTexture('fb-pipe-body', PIPE_WIDTH, 64);
        this.textures.get('fb-pipe-body').setFilter(Phaser.Textures.FilterMode.LINEAR);
        body.destroy();

        const cap = this.add.graphics();
        cap.fillStyle(0x3e5b29);
        cap.fillRect(0, 0, CAP_WIDTH, CAP_HEIGHT);
        cap.fillStyle(0x6abe30);
        cap.fillRect(3, 3, CAP_WIDTH - 6, CAP_HEIGHT - 6);
        cap.fillStyle(0xa8e05c);
        cap.fillRect(10, 3, 15, CAP_HEIGHT - 6);
        cap.fillStyle(0x4f8a22);
        cap.fillRect(CAP_WIDTH - 21, 3, 15, CAP_HEIGHT - 6);
        cap.generateTexture('fb-pipe-cap', CAP_WIDTH, CAP_HEIGHT);
        this.textures.get('fb-pipe-cap').setFilter(Phaser.Textures.FilterMode.LINEAR);
        cap.destroy();
    }

    private createGroundTexture(): void {
        this.drawCanvas('fb-ground', 140, GROUND_HEIGHT, (ctx) => {
            ctx.fillStyle = '#211912';
            ctx.fillRect(0, 0, 140, GROUND_HEIGHT);
            ctx.fillStyle = '#4b3523';
            ctx.fillRect(0, 0, 140, GROUND_HEIGHT);
            ctx.strokeStyle = 'rgba(143, 103, 64, 0.32)';
            ctx.lineWidth = 2;

            for (let stripe = -64; stripe < 180; stripe += 30) {
                ctx.beginPath();
                ctx.moveTo(stripe, 3);
                ctx.lineTo(stripe + 28, GROUND_HEIGHT);
                ctx.stroke();
            }

            ctx.fillStyle = 'rgba(24, 14, 13, 0.44)';
            ctx.fillRect(0, 0, 140, 4);
        });
    }

    private createMedalTextures(): void {
        const medals: Array<[string, string, string]> = [
            ['fb-medal-bronze', '#cd7f32', '#8f5620'],
            ['fb-medal-silver', '#c9d2d8', '#8d99a1'],
            ['fb-medal-gold', '#f4c430', '#b28a1a'],
            ['fb-medal-platinum', '#8fdbe8', '#57a2b3'],
        ];

        for (const [key, fill, edge] of medals) {
            this.drawCanvas(key, 56, 56, (ctx) => {
                ctx.fillStyle = edge;
                ctx.beginPath();
                ctx.arc(28, 28, 26, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = fill;
                ctx.beginPath();
                ctx.arc(28, 28, 21, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
                ctx.beginPath();
                ctx.arc(22, 21, 8, 0, Math.PI * 2);
                ctx.fill();
            });
        }
    }

    private readBest(): number {
        try {
            return Number.parseInt(localStorage.getItem(BEST_SCORE_KEY) ?? '0', 10) || 0;
        } catch {
            return 0;
        }
    }

    private saveBest(value: number): void {
        try {
            localStorage.setItem(BEST_SCORE_KEY, String(value));
        } catch {
            return;
        }
    }
}

export const flappyConfig: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    backgroundColor: '#07131f',
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
        antialias: true,
        antialiasGL: true,
        roundPixels: false,
        transparent: false,
        clearBeforeRender: true,
        powerPreference: 'high-performance',
        skipUnreadyShaders: true,
    },
};
