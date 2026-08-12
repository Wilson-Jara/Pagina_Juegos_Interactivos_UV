import { useEffect, useState, type FormEvent } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, type User } from 'firebase/auth';
import { firebaseAuth, isFirebaseConfigured } from '../lib/firebase';

export default function FirebaseAuthButton() {
    const [user, setUser] = useState<User | null>(null);
    const [open, setOpen] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => onAuthStateChanged(firebaseAuth, setUser), []);

    const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
        event.preventDefault();
        setLoading(true);
        setMessage('Entrando...');

        try {
            await signInWithEmailAndPassword(firebaseAuth, email.trim(), password);
            setPassword('');
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
                {user?.email ?? 'Iniciar sesión'}
            </button>

            {open && (
                <div className="firebase-auth__popover">
                    {user ? (
                        <>
                            <strong>Sesión admin activa</strong>
                            <small>{user.email}</small>
                            <button className="firebase-auth__submit firebase-auth__submit--logout" type="button" onClick={() => void handleLogout()}>
                                Cerrar sesión
                            </button>
                        </>
                    ) : (
                        <form onSubmit={(event) => void handleSubmit(event)}>
                            <strong>Acceso de administrador</strong>
                            <input
                                type="email"
                                value={email}
                                onChange={(event) => setEmail(event.target.value)}
                                placeholder="Correo"
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
