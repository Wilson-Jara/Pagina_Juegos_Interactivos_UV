import { Link } from 'react-router-dom';
// Más adelante aquí importaremos el componente de Phaser y MediaPipe

export default function FlappyGame() {
    return (
        <div style={{ textAlign: 'center', padding: '20px' }}>
            <h2>Flappy Bird Interactio</h2>
            <Link to="/">
                <button>Volver al Menú Principal</button>
            </Link>
            
            <div style={{ marginTop: '20px' }}>
                <p>Aquí irá el Canvas (lienzo) del juego y la cámara.</p>
            </div>
        </div>
    );
}