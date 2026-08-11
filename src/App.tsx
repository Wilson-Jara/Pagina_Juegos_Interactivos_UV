import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

const Home = lazy(() => import('./pages/HomePage'));
const FlappyGame = lazy(() => import('./pages/FlappyPage'));

function App() {
    return (
        <BrowserRouter>
            <Suspense fallback={<div className="route-loading">Cargando...</div>}>
                <Routes>
                    <Route path="/" element={<Home />} />
                    <Route path="/flappy" element={<FlappyGame />} />
                </Routes>
            </Suspense>
        </BrowserRouter>
    );
}

export default App;
