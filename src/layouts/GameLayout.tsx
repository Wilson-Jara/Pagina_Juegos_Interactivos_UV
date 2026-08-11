import type { ReactNode } from 'react';

type GameLayoutProps = {
    title: string;
    children: ReactNode;
};

export default function GameLayout({ title, children }: GameLayoutProps) {
    return (
        <main className="game-page">
            <div className="game-page__header">
                <span className="game-page__eyebrow">PLAY// ARCADE</span>
                <h1>{title}</h1>
            </div>
            {children}
        </main>
    );
}
