import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { Link } from 'react-router-dom';
import FirebaseAuthButton from '../components/FirebaseAuthButton';
import HandCamera from '../components/HandCamera';
import FirebaseLeaderboard from '../components/FirebaseLeaderboard';
import FirebaseRecordPrompt from '../components/FirebaseRecordPrompt';
import PhaserGame from '../components/PhaserGame';
import { flappyConfig } from '../games/flappy/FlappyScene';

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
                    <FirebaseAuthButton />
                </div>
            </header>

            <main className="visual-game-layout">
                <FirebaseLeaderboard />

                <section className="visual-game-board" aria-label="Juego Flappy Bird">
                    <PhaserGame config={flappyConfig} />
                    <FirebaseRecordPrompt />
                </section>

                <aside className="visual-side-panels" aria-label="Paneles auxiliares">
                    <div className="visual-camera-panel">
                        <HandCamera />
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
