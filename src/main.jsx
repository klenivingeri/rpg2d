import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';

// Ajuste para corrigir problemas de 100vh em mobile browsers
function setVh() {
    try {
        document.documentElement.style.setProperty('--vh', `${window.innerHeight * 0.01}px`);
    } catch (e) { /* ignore */ }
}
setVh();
window.addEventListener('resize', setVh);

ReactDOM.createRoot(document.getElementById('root')).render(
        <React.StrictMode>
                <App />
        </React.StrictMode>,
)
