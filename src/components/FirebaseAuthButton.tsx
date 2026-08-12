import { useEffect, useState, type FormEvent } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, type User } from 'firebase/auth';
import {
    FIREBASE_ADMIN_EMAIL,
    FIREBASE_ADMIN_USERNAME,
    firebaseAuth,
    isFirebaseConfigured,
} from '../lib/firebase';

export default function FirebaseAuthButton() {
    const [user, setUser] = useState<User | null>(null);
    const [open, setOpen] = useState(false);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => onAuthStateChanged(firebaseAuth, setUser), []);

    const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
        event.preventDefault();
        setLoading(true);
        setMessage('Entrando...');

        try {
            if (username.trim().toLowerCase() !== FIREBASE_ADMIN_USERNAME.toLowerCase()) {
                setMessage('Usuario no válido.');
                return;
            }

            await signInWithEmailAndPassword(firebaseAuth, FIREBASE_ADMIN_EMAIL, password);
            setPassword('');
            setUsername('');
            setMessage('');
            setOpen(false);
        } catch {
            setMessage('No se pudo iniciar sesión.');
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = async (): Promise<void> => {
        await signOut(firebaseAuth);
        setOpen(false);
    };

    return (
        <div className="firebase-auth">
            <button
                className="visual-login"
                type="button"
                disabled={!isFirebaseConfigured}
                aria-expanded={open}
                onClick={() => setOpen((isOpen) => !isOpen)}
            >
                <span>🔒</span>
                {user ? FIREBASE_ADMIN_USERNAME : 'Iniciar sesión'}
            </button>

            {open && (
                <div className="firebase-auth__popover">
                    {user ? (
                        <>
                            <strong>Sesión admin activa</strong>
                            <small>{FIREBASE_ADMIN_USERNAME}</small>
                            <button className="firebase-auth__submit firebase-auth__submit--logout" type="button" onClick={() => void handleLogout()}>
                                Cerrar sesión
                            </button>
                        </>
                    ) : (
                        <form onSubmit={(event) => void handleSubmit(event)}>
                            <strong>Acceso de administrador</strong>
                            <input
                                type="text"
                                value={username}
                                onChange={(event) => setUsername(event.target.value)}
                                placeholder="Usuario"
                                autoComplete="username"
                                required
                            />
                            <input
                                type="password"
                                value={password}
                                onChange={(event) => setPassword(event.target.value)}
                                placeholder="Contraseña"
                                autoComplete="current-password"
                                required
                            />
                            <button className="firebase-auth__submit" type="submit" disabled={loading}>
                                {loading ? 'Entrando...' : 'Entrar'}
                            </button>
                            {message && <small className="firebase-auth__message">{message}</small>}
                        </form>
                    )}
                </div>
            )}
        </div>
    );
}
