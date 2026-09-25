const fs = require('fs');
const path = require('path');

const cssPath = path.join(__dirname, '..', 'styles.css');
let css = fs.readFileSync(cssPath, 'utf8');

const targetSection = `/* ==========================================================================
   NAVEGAÇÃO REFINADA (4 MÓDULOS DE ALTA PERFORMANCE)
   ========================================================================== */`;

const startIdx = css.indexOf(targetSection);
if (startIdx === -1) {
    console.error('targetSection not found!');
    process.exit(1);
}

const replacement = `/* ==========================================================================
   NAVEGAÇÃO REFINADA (4 MÓDULOS DE ALTA PERFORMANCE)
   ========================================================================== */
.main-nav-tabs {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    max-width: 880px;
    margin: 18px auto;
    padding: 6px;
    background: rgba(15, 20, 31, 0.82);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 18px;
    backdrop-filter: blur(18px);
    -webkit-backdrop-filter: blur(18px);
    box-shadow: 0 10px 30px -5px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.06);
    gap: 8px;
    position: relative;
    z-index: 40;
}

.main-tab-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    background: transparent;
    border: 1px solid transparent;
    color: var(--text-muted);
    font-family: var(--font-heading);
    font-size: 14px;
    font-weight: 700;
    padding: 11px 18px;
    border-radius: 13px;
    cursor: pointer;
    transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
    user-select: none;
}

.main-tab-btn:hover {
    color: var(--text-main);
    background: rgba(255, 255, 255, 0.05);
    border-color: rgba(255, 255, 255, 0.07);
    transform: translateY(-1px);
}

.main-tab-btn.active {
    color: #0b0d14;
    background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%);
    border-color: rgba(251, 191, 36, 0.6);
    box-shadow: 0 4px 20px rgba(245, 158, 11, 0.42), inset 0 1px 0 rgba(255, 255, 255, 0.3);
    font-weight: 800;
    transform: translateY(-1px);
}

.main-tab-btn.active i {
    color: #0b0d14;
    filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.2));
}

.tab-kbd {
    font-size: 10px;
    font-weight: 800;
    padding: 2px 7px;
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.07);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: var(--text-dimmed);
    line-height: 1.2;
    transition: all 0.2s ease;
}

.main-tab-btn:hover .tab-kbd {
    color: var(--text-muted);
    background: rgba(255, 255, 255, 0.12);
}

.main-tab-btn.active .tab-kbd {
    background: rgba(11, 13, 20, 0.22);
    border-color: rgba(11, 13, 20, 0.35);
    color: #0b0d14;
}

/* Animação do Pomodoro Ativo */
.pomodoro-display-circle.running {
    animation: pomodoroPulse 2.5s infinite ease-in-out;
}

@keyframes pomodoroPulse {
    0%, 100% {
        box-shadow: 0 0 30px var(--color-primary-glow), inset 0 0 20px rgba(245, 158, 11, 0.05);
        border-color: #f59e0b;
    }
    50% {
        box-shadow: 0 0 50px rgba(245, 158, 11, 0.55), inset 0 0 35px rgba(245, 158, 11, 0.12);
        border-color: #fbbf24;
    }
}

@media (max-width: 768px) {
    .main-nav-tabs {
        grid-template-columns: repeat(2, 1fr);
        max-width: 100%;
        margin: 12px 14px;
        gap: 6px;
        padding: 5px;
    }
    
    .main-tab-btn {
        padding: 9px 12px;
        font-size: 13px;
        justify-content: center;
    }

    .tab-kbd {
        display: none;
    }
}

@media (max-width: 420px) {
    .main-tab-btn span {
        font-size: 12px;
    }
    .main-tab-btn {
        gap: 6px;
        padding: 8px 6px;
    }
}
`;

const newCss = css.slice(0, startIdx) + replacement;
fs.writeFileSync(cssPath, newCss, 'utf8');
console.log('Successfully updated navigation & pomodoro styles in styles.css!');
