import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

type IconName =
    | 'play'
    | 'plus'
    | 'search';

type Game = {
    id: string;
    title: string;
    subtitle: string;
    description: string;
    route: string;
    category: string;
    badge: string;
};

// Add future games to this list and they will appear in the shelf automatically.
const games: Game[] = [
    {
        id: 'flappy-bird',
        title: 'Flappy Bird',
        subtitle: 'Controla el vuelo',
        description: 'Usa tu cámara y tus movimientos para mantenerte en el aire.',
        route: '/flappy',
        category: 'Arcade',
        badge: 'CÁMARA',
    },
];

function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
    const props = {
        width: size,
        height: size,
        viewBox: '0 0 24 24',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 1.7,
        strokeLinecap: 'round' as const,
        strokeLinejoin: 'round' as const,
        'aria-hidden': true,
    };

    switch (name) {
        case 'play':
            return <svg {...props}><path d="m9 6 9 6-9 6V6Z" fill="currentColor" stroke="none" /></svg>;
        case 'plus':
            return <svg {...props}><path d="M12 5v14M5 12h14" /></svg>;
        case 'search':
            return <svg {...props}><circle cx="10.7" cy="10.7" r="6.2" /><path d="m15.5 15.5 4.4 4.4" /></svg>;
        default:
            return null;
    }
}

function GameArtwork({ game, compact = false }: { game: Game; compact?: boolean }) {
    return (
        <div className={`game-art ${compact ? 'game-art--compact' : ''}`} aria-hidden="true">
            <span className="game-art__title">{game.title}</span>
            <span className="game-art__sub">{game.badge}</span>
        </div>
    );
}

export default function Home() {
    const [selectedGameId, setSelectedGameId] = useState(games[0]?.id ?? '');
    const [query, setQuery] = useState('');
    const [searchOpen, setSearchOpen] = useState(false);
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [userName, setUserName] = useState('');
    const [time, setTime] = useState('');
    useEffect(() => {
        const tick = () => {
            setTime(new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }));
        };
        tick();
        const id = setInterval(tick, 1000);
        return () => clearInterval(id);
    }, []);
    const selectedGame = games.find((game) => game.id === selectedGameId) ?? games[0];
    const normalizedQuery = query.trim().toLowerCase();
    const matchingGames = games.filter((game) => `${game.title} ${game.category}`.toLowerCase().includes(normalizedQuery));
    const shelfGames = matchingGames.filter((game) => game.id !== selectedGame?.id).slice(0, 5);
    const emptySlots = Math.max(0, 4 - shelfGames.length);

    return (
        <div className="console-home">
            <div className="console-backdrop" aria-hidden="true">
                <div className="backdrop-rays" />
                <div className="backdrop-haze" />
                <div className="backdrop-mountain backdrop-mountain--left" />
                <div className="backdrop-mountain backdrop-mountain--right" />
                <div className="backdrop-hero" />
                <div className="backdrop-ground" />
            </div>

            <div className="console-layer">
                <header className="console-topbar">
                    <div className="player-profile">
                        {isLoggedIn ? (
                            <>
                                <div className="player-avatar">{userName.slice(0, 2).toUpperCase()}</div>
                                <div className="player-details">
                                    <strong>{userName}</strong>
                                </div>
                            </>
                        ) : (
                            <button className="login-button" type="button" onClick={() => { setIsLoggedIn(true); setUserName('Jugador'); }}>
                                <span className="login-button__icon"><Icon name="play" size={12} /></span>
                                Iniciar sesión
                            </button>
                        )}
                    </div>
                    <div className="system-status">
                        <span>{time}</span>
                    </div>
                    <div className={`console-search ${searchOpen ? 'is-open' : ''}`}>
                        {searchOpen && <input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === 'Escape') { setQuery(''); setSearchOpen(false); } }} placeholder="Buscar" aria-label="Buscar juegos" />}
                        <button type="button" onClick={() => setSearchOpen((open) => !open)} aria-label={searchOpen ? 'Cerrar búsqueda' : 'Buscar juegos'}>
                            <Icon name="search" size={15} />
                            {!searchOpen && <span>Buscar</span>}
                        </button>
                    </div>
                </header>

                <main className="console-content">
                    <section className="home-shelf" aria-label="Juegos recientes">
                        {selectedGame ? (
                            <Link className="selected-game" to={selectedGame.route} aria-label={`Jugar ${selectedGame.title}`}>
                                <GameArtwork game={selectedGame} />
                                <div className="selected-game__footer">
                                    <div>
                                        <span>SELECCIONADO</span>
                                        <strong>{selectedGame.title}</strong>
                                    </div>
                                    <span className="selected-game__play"><Icon name="play" size={12} /></span>
                                </div>
                            </Link>
                        ) : (
                            <div className="selected-game selected-game--empty">
                                <Icon name="plus" size={28} />
                                <span>Añade un juego para comenzar</span>
                            </div>
                        )}

                        <div className="game-rail">
                            {shelfGames.map((game) => (
                                <button className="rail-game" key={game.id} type="button" onClick={() => setSelectedGameId(game.id)} aria-label={`Seleccionar ${game.title}`}>
                                    <GameArtwork game={game} compact />
                                    <span>{game.title}</span>
                                </button>
                            ))}
                            {Array.from({ length: emptySlots }).map((_, index) => (
                                <div className="rail-placeholder" key={`placeholder-${index}`}>
                                    <span><Icon name="plus" size={15} /></span>
                                    <small>Próximo</small>
                                </div>
                            ))}
                        </div>
                    </section>

                </main>
            </div>
        </div>
    );
}
