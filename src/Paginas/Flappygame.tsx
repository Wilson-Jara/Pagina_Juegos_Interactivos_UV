import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { Link } from 'react-router-dom';
import PhaserGame from '../components/PhaserGame';
import { flappyConfig } from '../games/flappy/FlappyScene';

type ScoreRow = {
    name: string;
    score: number;
};

const previewScores: ScoreRow[] = [
    { name: 'Wilson', score: 40 },
    { name: 'Wilson', score: 34 },
    { name: 'Vicente Saa', score: 18 },
    { name: 'Saa', score: 16 },
    { name: 'Alonso Tapia', score: 13 },
    { name: 'Alonso', score: 11 },
    { name: 'Saa', score: 11 },
    { name: 'Wilson', score: 11 },
    { name: 'Prueba 2', score: 8 },
    { name: 'Wilson Jara', score: 8 },
    { name: 'Prueba 6', score: 8 },
    { name: 'Vicente', score: 7 },
    { name: 'Pancho', score: 6 },
    { name: 'Tomas Zamora', score: 5 },
    { name: 'Prueba 5', score: 4 },
];

function medalFor(index: number): string {
    if (index === 0) return '🥇';
    if (index === 1) return '🥈';
    if (index === 2) return '🥉';
    return `${index + 1}.`;
}

export default function FlappyGame() {
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const imageInputRef = useRef<HTMLInputElement | null>(null);

    useEffect(() => {
        return () => {
            if (selectedImage) {
                URL.revokeObjectURL(selectedImage);
            }
        }
    }, [selectedImage]);

    const handleImageChange = (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];

        if (!file) {
            return;
        }

        setSelectedImage(URL.createObjectURL(file));
        event.currentTarget.value = '';
    };

    return (
        <div className="visual-game-shell">
            <header className="visual-game-navbar">
                <div className="visual-game-navbar__inner">
                    <Link className="visual-game-logo" to="/">JUEGOS</Link>
                    <button className="visual-login" type="button">
                        <span>🔒</span>
                        Iniciar sesión
                    </button>
                </div>
            </header>

            <main className="visual-game-layout">
                <aside className="visual-leaderboard" aria-label="Tabla de mejores puntuaciones">
                    <h2>🏆 Top 15</h2>
                    <div className="visual-leaderboard__head">
                        <span />
                        <span>Nombre</span>
                        <span>Score</span>
                    </div>
                    <ol className="visual-score-list">
                        {previewScores.map((row, index) => (
                            <li key={`${row.name}-${index}`}>
                                <span className="visual-score-list__rank">{medalFor(index)}</span>
                                <strong>{row.name}</strong>
                                <b>{row.score}</b>
                            </li>
                        ))}
                    </ol>
                </aside>

                <section className="visual-game-board" aria-label="Juego Flappy Bird">
                    <PhaserGame config={flappyConfig} />
                </section>

                <aside className="visual-side-panels" aria-label="Paneles auxiliares">
                    <div className="visual-camera-panel">
                        <span>Sin cámara</span>
                    </div>
                    <div className="visual-image-panel">
                        {selectedImage ? (
                            <img src={selectedImage} alt="Imagen personalizada" />
                        ) : (
                            <>
                                <span className="visual-image-panel__placeholder">Imagen personalizada</span>
                                <span className="visual-image-panel__empty">Espacio para<br />imagen</span>
                            </>
                        )}
                        <input
                            ref={imageInputRef}
                            className="visual-image-panel__input"
                            type="file"
                            accept="image/*"
                            onChange={handleImageChange}
                        />
                        <button type="button" onClick={() => imageInputRef.current?.click()}>
                            📁 Seleccionar imagen
                        </button>
                    </div>
                </aside>
            </main>
        </div>
    );
}
