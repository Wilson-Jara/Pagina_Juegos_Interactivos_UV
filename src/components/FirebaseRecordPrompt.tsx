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
import {
    FIREBASE_ADMIN_EMAIL,
    firebaseAuth,
    firestore,
    isFirebaseConfigured,
} from '../lib/firebase';

const FIRESTORE_GAME_ID = 'flappy';

type ScoreRow = {
    score: number;
};

export default function FirebaseRecordPrompt() {
    const [scores, setScores] = useState<ScoreRow[]>([]);
    const [pendingScore, setPendingScore] = useState<number | null>(null);
    const [user, setUser] = useState<User | null>(null);
    const [name, setName] = useState('');
    const [message, setMessage] = useState('');

    useEffect(() => {
        if (!isFirebaseConfigured) {
            return;
        }

        const scoresRef = collection(firestore, 'games', FIRESTORE_GAME_ID, 'scores');
        const scoresQuery = query(scoresRef, orderBy('score', 'desc'), limit(15));
        const unsubscribeScores = onSnapshot(scoresQuery, (snapshot) => {
            setScores(snapshot.docs.map((document) => ({
                score: Number(document.data().score ?? 0),
            })));
        });
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
    const isAdmin = user?.email?.toLowerCase() === FIREBASE_ADMIN_EMAIL;

    const handleSave = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
        event.preventDefault();

        if (!isAdmin || pendingScore === null || !qualifies) {
            return;
        }

        const cleanName = name.trim().slice(0, 20);

        if (!cleanName) {
            setMessage('Escribe un nombre.');
            return;
        }

        setMessage('Guardando...');

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
            setMessage('No se pudo guardar el récord.');
        }
    };

    if (!qualifies) {
        return null;
    }

    return (
        <div className="firebase-record-prompt" role="status" aria-live="polite">
            <strong>¡Nuevo récord: {pendingScore}!</strong>
            {isAdmin ? (
                <form onSubmit={(event) => void handleSave(event)}>
                    <input
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        maxLength={20}
                        placeholder="Tu nombre"
                        aria-label="Nombre para el récord"
                        required
                    />
                    <button type="submit">Guardar</button>
                </form>
            ) : (
                <small>Inicia sesión como Wilson para guardar tu récord.</small>
            )}
            {message && <small>{message}</small>}
        </div>
    );
}
