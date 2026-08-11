import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './Paginas/Home';
import FlappyGame from './Paginas/Flappygame';

function App() {
    return (
        <BrowserRouter>
            <Routes>
                {/* El path "/" representa la página inicial por defecto */}
                <Route path="/" element={<Home />} />
                
                {/* El path "/flappy" cargará nuestro juego */}
                <Route path="/flappy" element={<FlappyGame />} />
            </Routes>
        </BrowserRouter>
    );
}

export default App;