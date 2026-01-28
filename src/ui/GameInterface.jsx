import React, { createContext, useContext, useState, useEffect } from 'react';
import './GameInterface.css';
import { EventBus } from '../game/EventBus';
import { Debug } from '../game/Debug';

// Contexto global para UI do jogo
const GameUIContext = createContext(null);

export function useGameUI() {
  return useContext(GameUIContext);
}

export function GameUIProvider({ children }) {
  const [gameState, setGameState] = useState(() => {
    // tentar carregar preferências do localStorage
    let storedAutoFire = false;
    let storedJoystick = false;
    try {
      const v = localStorage.getItem('gi.autoFire');
      if (v !== null) storedAutoFire = v === 'true';
      const j = localStorage.getItem('gi.joystick');
      if (j !== null) storedJoystick = j === 'true';
    } catch (e) { /* ignore */ }
    return {
      view: 'init', // 'init' | 'hud' | 'result'
      gold: 0,
      monstersKilled: 0,
      totalMonsters: 10,
      inventory: [],
      equippedItems: { weapon: null, armor: null, accessory: null },
      skills: [],
      autoFire: storedAutoFire,
      joystick: storedJoystick
    };
  });

  const setView = (v) => setGameState(s => ({ ...s, view: v }));
  const addGold = (amount) => setGameState(s => ({ ...s, gold: s.gold + amount }));
  const addKill = () => setGameState(s => ({ ...s, monstersKilled: s.monstersKilled + 1 }));
  const reset = () => setGameState(s => ({ ...s, view: 'init', gold: 0, monstersKilled: 0, totalMonsters: 10, inventory: [], equippedItems: { weapon: null, armor: null, accessory: null }, skills: [] }));

  // Ouve evento 'game-over' vindo do Phaser e muda para a view de resultado
  useEffect(() => {
    const onGameOver = () => setGameState(s => ({ ...s, view: 'result' }));
    EventBus.on('game-over', onGameOver);
    return () => { EventBus.removeListener('game-over', onGameOver); };
  }, []);
  // emitir evento global quando alterar autoFire para que o jogo (Phaser) reaja
  const _toggleAutoFire = () => {
    setGameState(s => {
      const next = !s.autoFire;
      try { localStorage.setItem('gi.autoFire', next ? 'true' : 'false'); } catch (e) { /* ignore */ }
      try { EventBus.emit('auto-fire-changed', next); } catch (e) { /* ignore */ }
      return { ...s, autoFire: next };
    });
  };

  // emitir evento global quando alterar joystick (habilitar/desabilitar virtual joystick)
  const _toggleJoystick = () => {
    setGameState(s => {
      const next = !s.joystick;
      try { localStorage.setItem('gi.joystick', next ? 'true' : 'false'); } catch (e) { /* ignore */ }
      try { EventBus.emit('joystick-changed', next); } catch (e) { /* ignore */ }
      return { ...s, joystick: next };
    });
  };

  // emitir evento sempre que `autoFire` mudar (inclui emissão inicial após carregar do localStorage)
  useEffect(() => {
    try { EventBus.emit('auto-fire-changed', gameState.autoFire); } catch (e) { /* ignore */ }
  }, [gameState.autoFire]);

  // emitir evento sempre que `joystick` mudar
  useEffect(() => {
    try { EventBus.emit('joystick-changed', gameState.joystick); } catch (e) { /* ignore */ }
  }, [gameState.joystick]);

  return (
    <GameUIContext.Provider value={{ gameState, setGameState, setView, addGold, addKill, reset, toggleAutoFire: _toggleAutoFire, toggleJoystick: _toggleJoystick }}>
      {children}
    </GameUIContext.Provider>
  );
}

// Componentes auxiliares: Modal simples
function Modal({ open, title, onClose, children }) {
  if (!open) return null;
  return (
    <div className="gi-modal" role="dialog" aria-modal="true">
      <div className="gi-modal-content">
        <div className="gi-modal-header">
          <h3>{title}</h3>
          <button className="gi-btn-ghost" onClick={onClose}>Fechar</button>
        </div>
        <div className="gi-modal-body">{children}</div>
      </div>
    </div>
  );
}

// GameInterface principal
export default function GameInterface({ phaserRef }) {
  const { gameState, setView, reset, toggleAutoFire, toggleJoystick, setGameState } = useGameUI();
  const [gridVisible, setGridVisible] = useState(() => {
    try { return !!Debug.showAreas; } catch (e) { return false; }
  });
  const [menuOpen, setMenuOpen] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);
  const [invOpen, setInvOpen] = useState(false);

  // Oculta/exibe o canvas do Phaser quando a UI estiver ativa
  useEffect(() => {
    const shouldHide = gameState.view === 'init' || gameState.view === 'result' || menuOpen || statsOpen || invOpen;

    // tenta obter o canvas do Phaser ou o container
    const g = phaserRef?.current?.game;
    let targetEl = null;
    if (g && (g.canvas || (g.renderer && g.renderer.canvas))) {
      targetEl = (g.canvas || (g.renderer && g.renderer.canvas));
      // se o alvo for o canvas, escondemos o elemento pai para retirar também o espaço
      if (targetEl.parentElement) targetEl = targetEl.parentElement;
    }
    else {
      targetEl = document.getElementById('game-container');
    }

    if (targetEl) {
      // usar visibility em vez de display para manter o canvas no DOM
      targetEl.style.visibility = shouldHide ? 'hidden' : 'visible';
    }

    // Se estivermos na tela de preparação, pause as scenes ativas para economizar processamento
    try {
      const g = phaserRef?.current?.game;
      if (g && g.scene && typeof g.scene.getScenes === 'function') {
        const activeScenes = g.scene.getScenes(true) || [];
        if (shouldHide && (gameState.view === 'init' || gameState.view === 'result')) {
          activeScenes.forEach(s => {
            try { g.scene.pause(s.scene.key); } catch (e) { /* ignore */ }
          });
        }
      }
    } catch (e) { console.warn(e); }

    return () => {
      // ao desmontar, garante que mostramos novamente
      if (targetEl) targetEl.style.visibility = 'visible';
    };
  }, [gameState.view, menuOpen, statsOpen, invOpen, phaserRef]);

  const pauseGame = () => {
    try {
      const g = phaserRef?.current?.game;
      if (g && g.scene && typeof g.scene.getScenes === 'function') {
        const active = g.scene.getScenes(true) || [];
        active.forEach(s => { try { g.scene.pause(s.scene.key); } catch (e) { /* ignore */ } });
      }
    } catch (e) { console.warn(e); }
  };
  const resumeGame = () => {
    try {
      const g = phaserRef?.current?.game;
      if (g && g.scene && typeof g.scene.getScenes === 'function') {
        const paused = g.scene.getScenes(false) || [];
        // resume scenes that are not running (getScenes(false) returns all scenes?)
        // safer: resume the Game scene if present
        try { if (g.scene.isActive && !g.scene.isActive('Game')) g.scene.resume('Game'); } catch (e) { /* ignore */ }
      }
    } catch (e) { console.warn(e); }
  };

  const openMenu = () => { pauseGame(); setMenuOpen(true); };
  const closeMenu = () => { setMenuOpen(false); resumeGame(); };
  const openStats = () => { pauseGame(); setStatsOpen(true); };
  const closeStats = () => { setStatsOpen(false); resumeGame(); };
  const openInv = () => { pauseGame(); setInvOpen(true); };
  const closeInv = () => { setInvOpen(false); resumeGame(); };

  // iniciar jogo
  const start = () => {
    // mostra o canvas e inicia ou resume a cena 'Game'
    // mostra o canvas e inicia ou resume a cena 'Game'
    try {
      const g = phaserRef?.current?.game;
      const container = document.getElementById('game-container');
      if (container) container.style.visibility = 'visible';
      if (g && g.scene) {
        try {
          // se a cena já estiver ativa, apenas resume
          if (typeof g.scene.isActive === 'function' && g.scene.isActive('Game')) {
            g.scene.resume('Game');
          }
          else {
            // caso não exista ou não esteja ativa, inicia a cena
            g.scene.start('Game');
          }

          // Forçar resize do ScaleManager / disparar um resize global para atualizar viewports
          try {
            if (g.scale && typeof g.scale.resize === 'function') {
              g.scale.resize(window.innerWidth, window.innerHeight);
            }
            // também dispara event para que cenas respondam ao resize
            window.dispatchEvent(new Event('resize'));
          } catch (e2) {
            console.warn('resize failed', e2);
          }

        } catch (e) {
          // fallback: tentar start sempre
          try { g.scene.start('Game'); } catch (err) { console.warn(err); }
        }
      }
    } catch (e) { console.warn(e); }

    setView('hud');
  };

  

  // resetar para init
  const handleReset = () => { reset(); setView('init'); };

  // layout grid 12x12; usamos classes para posicionar os elementos
  useEffect(() => {
    const handler = (e) => {
      // tecla G para alternar grid
      if (e.key === 'g' || e.key === 'G') {
        setGridVisible(v => !v);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // escuta alterações de `Debug.showAreas` (emitido por Debug.setShowAreas/toggleShowAreas)
  useEffect(() => {
    const onDebugToggle = (v) => {
      setGridVisible(!!v);
    };
    try { EventBus.on('debug-showAreas-changed', onDebugToggle); } catch (e) { /* ignore */ }
    return () => { try { EventBus.removeListener('debug-showAreas-changed', onDebugToggle); } catch (e) { /* ignore */ } };
  }, []);

  return (
    <div className={"game-interface" + (gridVisible ? ' gi-grid-visible' : '')}>

      {/* VIEW: INIT */}
      {gameState.view === 'init' && (
        <div className="gi-panel gi-init" style={{ pointerEvents: 'auto' }}>
          <h2>Preparação</h2>
          <div className="gi-equip-slots">
            <div className="slot">Arma</div>
            <div className="slot">Armadura</div>
            <div className="slot">Acessório</div>
          </div>
          <div className="gi-placeholders">
            <div className="placeholder">Melhorias (placeholder)</div>
            <div className="placeholder">Loja (placeholder)</div>
          </div>
          <button className="gi-btn gi-btn-primary gi-start" onClick={start}>INICIAR</button>
        </div>
      )}

      {/* Menu top-right na tela init (L1C12) */}
      {gameState.view === 'init' && (
        <button className="gi-btn gi-btn-large gi-top-right" onClick={openMenu}>Menu</button>
      )}

      {/* VIEW: HUD */}
      {gameState.view === 'hud' && (
        <>
          {/* Progress bar area L1C6 - L2C7 */}
          <div className="gi-progress" style={{ pointerEvents: 'auto' }}>
            <div className="gi-progress-label">Progresso</div>
            <div className="gi-progress-bar">
              <div className="gi-progress-fill" style={{ width: `${(gameState.monstersKilled / Math.max(1, gameState.totalMonsters)) * 100}%` }} />
            </div>
          </div>

          {/* Menu top-right L1C12 */}
          <button className="gi-btn gi-btn-large gi-top-right" onClick={openMenu}>Menu</button>

          {/* Stats bottom-left L12C1 */}
          <button className="gi-btn gi-btn-large gi-bottom-left" onClick={openStats}>Stats</button>

          {/* Inventory bottom-right L12C12 */}
          <button className="gi-btn gi-btn-large gi-bottom-right" onClick={openInv}>Inventário</button>
        </>
      )}

      {/* VIEW: RESULT */}
      {gameState.view === 'result' && (
        <div className="gi-panel gi-result" style={{ pointerEvents: 'auto' }}>
          <h2>Fim de Jogo</h2>
          <p>Gold: {gameState.gold}</p>
          <p>Itens coletados:</p>
          <ul>
            {gameState.inventory.map((it, idx) => <li key={idx}>{it.name || it}</li>)}
          </ul>
          <button className="gi-btn gi-btn-primary" onClick={handleReset}>Voltar</button>
        </div>
      )}

      {/* Modals disponíveis para todas as views (reaproveita conteúdo do HUD) */}
      <Modal open={menuOpen} title="Opções" onClose={closeMenu}>
        <div className="gi-menu-options">
          <label className="gi-option">
            <input type="checkbox" checked={gameState.autoFire} onChange={toggleAutoFire} />
            <span>Tiro automático</span>
          </label>
          <label className="gi-option">
            <input type="checkbox" checked={gameState.joystick} onChange={toggleJoystick} />
            <span>Joystick</span>
          </label>
          <p style={{marginTop:8}}>Opções do jogo (placeholder)</p>
        </div>
      </Modal>

      <Modal open={statsOpen} title="Status" onClose={closeStats}>
        <p>HP/MP (placeholder)</p>
      </Modal>

      <Modal open={invOpen} title="Inventário" onClose={closeInv}>
        <p>Itens coletados:</p>
        <ul>
          {gameState.inventory.map((it, idx) => <li key={idx}>{it.name || it}</li>)}
        </ul>
      </Modal>

    </div>
  );
}
