import { useEffect, useState } from 'react';
import {
    collection,
    limit,
    onSnapshot,
    orderBy,
    query,
} from 'firebase/firestore';
import { firestore, isFirebaseConfigured } from '../lib/firebase';

const FIRESTORE_GAME_ID = 'flappy';

type ScoreRow = {
    id: string;
    name: string;
    score: number;
};

export default function FirebaseLeaderboard() {
    const [scores, setScores] = useState<ScoreRow[]>([]);
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!isFirebaseConfigured) {
            setLoading(false);
            return;
        }

        const scoresRef = collection(firestore, 'games', FIRESTORE_GAME_ID, 'scores');
        const scoresQuery = query(scoresRef, orderBy('score', 'desc'), limit(15));
        const unsubscribeScores = onSnapshot(
            scoresQuery,
            (snapshot) => {
                setScores(snapshot.docs.map((document) => {
                    const data = document.data();
                    return {
                        id: document.id,
                        name: String(data.name ?? '—'),
                        score: Number(data.score ?? 0),
                    };
                }));
                setLoading(false);
            },
            () => {
                setMessage('No se pudo cargar la tabla.');
                setLoading(false);
            },
        );
        return () => {
            unsubscribeScores();
        };
    }, []);

    return (
        <aside className="visual-leaderboard" aria-label="Tabla de mejores puntuaciones">
            <h2>🏆 Top 15</h2>
            <div className="visual-leaderboard__head">
                <span />
                <span>Nombre</span>
                <span>Score</span>
            </div>
            <ol className="visual-score-list">
                {loading ? (
                    <li className="visual-score-empty">Cargando récords...</li>
                ) : scores.length === 0 ? (
                    <li className="visual-score-empty">Sin récords todavía</li>
                ) : scores.map((score, index) => (
                    <li key={score.id}>
                        <span className="visual-score-list__rank">{index < 3 ? ['🥇', '🥈', '🥉'][index] : `${index + 1}.`}</span>
                        <strong>{score.name}</strong>
                        <b>{score.score.toLocaleString('es-ES')}</b>
                    </li>
                ))}
            </ol>

            {message && <small className="visual-leaderboard__message">{message}</small>}
        </aside>
    );
}
