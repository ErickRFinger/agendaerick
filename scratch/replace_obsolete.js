const fs = require('fs');
const path = require('path');

const cssPath = path.join(__dirname, '..', 'styles.css');
let css = fs.readFileSync(cssPath, 'utf8');

const startMarker = '/* ==========================================================================\n   NAVEGAÇÃO PRINCIPAL POR ABAS (DIÁRIO / SERVIDORES / ARQUIVOS)';
const endMarker = '/* ==========================================================================\n   NOVOS ESTILOS - CENTRAL DE NOTIFICAÇÕES, AGENDA E FOCO';

const idx1 = css.indexOf(startMarker);
const idx2 = css.indexOf(endMarker);

if (idx1 === -1 || idx2 === -1) {
    console.error('Markers not found! idx1:', idx1, 'idx2:', idx2);
    process.exit(1);
}

const replacement = `/* ==========================================================================
   ATALHOS DE TECLADO & ELEMENTOS GLOBAIS DE PRODUTIVIDADE
   ========================================================================== */
.shortcuts-hint-bar {
    display: flex;
    justify-content: center;
    padding: 16px 20px 28px;
    margin-top: 12px;
    user-select: none;
}

.shortcuts-container {
    display: inline-flex;
    align-items: center;
    flex-wrap: wrap;
    justify-content: center;
    gap: 18px;
    padding: 8px 22px;
    background: rgba(17, 22, 33, 0.75);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 24px;
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    font-size: 12px;
    color: var(--text-dimmed);
    box-shadow: 0 8px 24px -6px rgba(0, 0, 0, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.05);
    transition: var(--transition-fast);
}

.shortcuts-container:hover {
    border-color: rgba(255, 255, 255, 0.14);
    color: var(--text-muted);
}

.shortcut-pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
}

.shortcut-pill kbd {
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.16);
    border-bottom: 2px solid rgba(255, 255, 255, 0.28);
    padding: 2px 7px;
    border-radius: 5px;
    font-family: inherit;
    font-size: 11px;
    font-weight: 700;
    color: var(--color-primary-light);
    line-height: 1.2;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
}

@media (max-width: 768px) {
    .shortcuts-hint-bar {
        display: none;
    }
}

`;

const newCss = css.slice(0, idx1) + replacement + css.slice(idx2);
fs.writeFileSync(cssPath, newCss, 'utf8');
console.log('Successfully updated styles.css! Removed bytes:', (idx2 - idx1), 'Inserted bytes:', replacement.length);
