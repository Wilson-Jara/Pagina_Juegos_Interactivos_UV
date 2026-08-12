import { useEffect, useState, type FormEvent } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import {
    addDoc,
    collection,
    limit,
    onSnapshot,
    orderBy,
    query,
    serverTimestamp,
} from 'firebase/firestore';
import { firebaseAuth, firestore, isFirebaseConfigured } from '../lib/firebase';

const FIRESTORE_GAME_ID = 'flappy';

type ScoreRow = {
    id: string;
    name: string;
    score: number;
};

export default function FirebaseLeaderboard() {
    const [scores, setScores] = useState<ScoreRow[]>([]);
    const [pendingScore, setPendingScore] = useState<number | null>(null);
    const [user, setUser] = useState<User | null>(null);
    const [name, setName] = useState('');
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
        const unsubscribeAuth = onAuthStateChanged(firebaseAuth, setUser);
        const handleGameOver = (event: Event): void => {
            const detail = (event as CustomEvent<{ gameId?: string; score?: number }>).detail;

            if (detail?.gameId === FIRESTORE_GAME_ID) {
                setPendingScore(Number(detail.score ?? 0));
                setMessage('');
            }
        };
        const handleRestart = (event: Event): void => {
            const detail = (event as CustomEvent<{ gameId?: string }>).detail;

            if (detail?.gameId === FIRESTORE_GAME_ID) {
                setPendingScore(null);
                setMessage('');
            }
        };

        window.addEventListener('game:over', handleGameOver);
        window.addEventListener('game:restart', handleRestart);

        return () => {
            unsubscribeScores();
            unsubscribeAuth();
            window.removeEventListener('game:over', handleGameOver);
            window.removeEventListener('game:restart', handleRestart);
        };
    }, []);

    const qualifies = pendingScore !== null
        && pendingScore > 0
        && (scores.length < 15 || pendingScore > scores[scores.length - 1].score);

    const handleSave = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
        event.preventDefault();

        if (!user || pendingScore === null || !qualifies) {
            return;
        }

        const cleanName = name.trim().slice(0, 20);

        if (!cleanName) {
            setMessage('Escribe un nombre.');
            return;
        }

        setMessage('Guardando récord...');

        try {
            await addDoc(collection(firestore, 'games', FIRESTORE_GAME_ID, 'scores'), {
                name: cleanName,
                score: Math.round(pendingScore),
                createdAt: serverTimestamp(),
            });
            setName('');
            setPendingScore(null);
            setMessage('Récord guardado.');
        } catch {
            setMessage('No se pudo guardar. Revisa la sesión admin.');
        }
    };

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

            {qualifies && (
                <div className="visual-leaderboard__record">
                    <strong>¡Nuevo récord: {pendingScore}!</strong>
                    {user ? (
                        <form onSubmit={(event) => void handleSave(event)}>
                            <input
                                value={name}
                                onChange={(event) => setName(event.target.value)}
                                maxLength={20}
                                placeholder="Nombre del jugador"
                                aria-label="Nombre del jugador"
                                required
                            />
                            <button type="submit">Guardar</button>
                        </form>
                    ) : (
                        <small>Inicia sesión como admin para guardarlo.</small>
                    )}
                </div>
            )}

            {message && <small className="visual-leaderboard__message">{message}</small>}
        </aside>
    );
}
