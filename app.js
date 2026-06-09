/* ==========================================================================
   LÓGICA E ESTADO - FOCOFÁCIL (AGENDA TDAH - VERSÃO MULTI-DIA)
   ========================================================================== */

// Estado Global da Aplicação
let state = {
    tasks: [],
    meds: [],
    waterHistory: {}, // Mapeado por data: { "YYYY-MM-DD": ml }
    waterGoal: 2000,
    notes: [],
    lastUpdatedDate: ""
};

// Data Ativa no Calendário (Padrão: Hoje)
let selectedDate = "";

// Configurações e Variáveis de Controle
const LOCAL_STORAGE_KEY = "FOCOFACIL_STATE_v2";
let activeFilterTab = "all"; // 'all', 'remaining', 'completed'
let audioCtx = null;
let confettiParticles = [];
let confettiAnimationId = null;

// Controle de Edição de Itens
let editingTaskId = null;
let editingMedId = null;

// PWA e Sincronização em Nuvem
let deferredPrompt = null;
let syncCode = "";
let syncStatus = "local"; // 'local', 'syncing', 'connected', 'error'
let syncDebounceTimer = null;

// Dados Padrão para Primeira Inicialização
const defaultState = {
    tasks: [
        { id: "t1", title: "Organizar mesa de trabalho", desc: "Tire papéis velhos e organize as canetas.", hour: "09", category: "routine", completed: false, date: "" },
        { id: "t2", title: "Revisar demandas importantes", desc: "Listar as 3 principais prioridades.", hour: "10", category: "work", completed: false, date: "" },
        { id: "t3", title: "Caminhada de 15 minutos", desc: "Alongar e respirar ar puro.", hour: "16", category: "health", completed: false, date: "" }
    ],
    meds: [
        { id: "m1", name: "Medicamento da Manhã", dosage: "1 cápsula", hour: "08:00", notes: "Tomar logo após o café da manhã", takenHistory: {} },
        { id: "m2", name: "Vitamina / Suplemento", dosage: "1 comp.", hour: "13:00", notes: "Junto com o almoço", takenHistory: {} }
    ],
    waterHistory: {},
    waterGoal: 2000,
    notes: [
        { id: "n1", text: "Dica: Se uma tarefa parecer gigante, quebre-a em 3 passos minúsculos." },
        { id: "n2", text: "Ter água sempre na mesa ajuda a lembrar de beber!" }
    ],
    lastUpdatedDate: "",
    lastSavedTimestamp: 0
};

/* ==========================================================================
   INICIALIZAÇÃO DA APLICAÇÃO
   ========================================================================== */
document.addEventListener("DOMContentLoaded", () => {
    selectedDate = getTodayDateString();
    loadState();
    setupCurrentDateDisplay();
    initTimelineHours();
    setupConfettiCanvas();
    setupEventListeners();

    // Inicializa a UI de Sincronização se houver código salvo
    syncCode = localStorage.getItem("FOCOFACIL_SYNC_CODE") || "";
    const syncInput = document.getElementById("sync-code-input");
    if (syncInput && syncCode) {
        syncInput.value = syncCode;
        pullFromCloud(); // Busca dados atualizados da nuvem
    } else {
        updateSyncStatusBadge("local");
    }

    renderAll();
    lucide.createIcons();

    // Registra Service Worker para PWA
    registerServiceWorker();

    // Captura evento de instalação do PWA
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        // Mostra o botão de instalar no cabeçalho
        const installBtn = document.getElementById('btn-install-app');
        if (installBtn) {
            installBtn.style.display = 'inline-flex';
        }
    });

    // Auto-scroll para a hora atual após um curto delay (apenas se for a data de hoje)
    if (selectedDate === getTodayDateString()) {
        setTimeout(scrollToCurrentHour, 400);
    }

    // Monitora a hora atual a cada minuto para atualizar os destaques
    setInterval(() => {
        updateCurrentHourHighlight();
    }, 60000);
});

/* ==========================================================================
   PERSISTÊNCIA E MIGRAÇÃO DE DADOS
   ========================================================================== */
function loadState() {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
    const legacySaved = localStorage.getItem("FOCOFACIL_STATE_v1");
    
    if (saved) {
        try {
            state = JSON.parse(saved);
            fillMissingStateFields();
        } catch (e) {
            console.error("Erro ao carregar dados salvos. Usando padrão.", e);
            initializeDefaultState();
        }
    } else if (legacySaved) {
        // Migração do schema v1 (apenas dia único) para o v2 (multi-dia)
        try {
            const legacyState = JSON.parse(legacySaved);
            migrateLegacyData(legacyState);
        } catch (e) {
            console.error("Erro na migração de dados antigos. Usando padrão.", e);
            initializeDefaultState();
        }
    } else {
        initializeDefaultState();
    }
}

function initializeDefaultState() {
    state = JSON.parse(JSON.stringify(defaultState));
    const today = getTodayDateString();
    
    // Associa tarefas iniciais ao dia de hoje
    state.tasks.forEach(t => t.date = today);
    state.lastUpdatedDate = today;
    saveState();
}

function fillMissingStateFields() {
    if (!state.tasks) state.tasks = [];
    if (!state.meds) state.meds = [];
    if (!state.waterHistory) state.waterHistory = {};
    if (!state.waterGoal) state.waterGoal = 2000;
    if (!state.notes) state.notes = [];
    if (!state.lastSavedTimestamp) state.lastSavedTimestamp = 0;
}

function migrateLegacyData(legacy) {
    state = JSON.parse(JSON.stringify(defaultState)); // Garante estrutura limpa
    const today = getTodayDateString();
    const legacyDate = legacy.lastUpdatedDate || today;

    // 1. Migração de Notas
    if (legacy.notes) state.notes = legacy.notes;

    // 2. Migração de Tarefas (associa tarefas antigas ao dia delas)
    if (legacy.tasks) {
        state.tasks = legacy.tasks.map(t => {
            t.date = t.date || legacyDate;
            return t;
        });
    }

    // 3. Migração de Água
    if (legacy.water) {
        state.waterGoal = legacy.water.goal || 2000;
        if (legacy.water.current !== undefined) {
            state.waterHistory[legacyDate] = legacy.water.current;
        }
    }

    // 4. Migração de Medicamentos
    if (legacy.meds) {
        state.meds = legacy.meds.map(m => {
            const takenHistory = {};
            if (m.takenToday !== undefined) {
                takenHistory[legacyDate] = m.takenToday;
            }
            return {
                id: m.id,
                name: m.name,
                dosage: m.dosage,
                hour: m.hour,
                notes: m.notes,
                takenHistory: m.takenHistory || takenHistory
            };
        });
    }

    state.lastUpdatedDate = today;
    saveState();
    
    // Remove o localStorage legado para não repetir
    localStorage.removeItem("FOCOFACIL_STATE_v1");
}

function saveState() {
    state.lastSavedTimestamp = Date.now();
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(state));
    
    // Sincronização reativa na nuvem com debounce de 800ms
    if (syncCode) {
        clearTimeout(syncDebounceTimer);
        syncDebounceTimer = setTimeout(() => {
            pushToCloud();
        }, 800);
    }
}

/* ==========================================================================
   UTILITÁRIOS DE DATA (FORMATO LOCAL SEGURO)
   ========================================================================== */
function getTodayDateString() {
    return formatDateString(new Date());
}

function formatDateString(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function parseDateString(dateStr) {
    const parts = dateStr.split('-');
    // Mês é 0-indexado em JS
    return new Date(parts[0], parts[1] - 1, parts[2]);
}

function setupCurrentDateDisplay() {
    const dateEl = document.getElementById("current-date");
    if (!dateEl) return;
    
    const options = { weekday: 'long', day: 'numeric', month: 'long' };
    const dateObj = parseDateString(selectedDate);
    let dateStr = dateObj.toLocaleDateString('pt-BR', options);
    
    // Capitaliza a primeira letra do dia da semana
    dateStr = dateStr.charAt(0).toUpperCase() + dateStr.slice(1);
    
    // Se for hoje, adiciona indicador amigável
    if (selectedDate === getTodayDateString()) {
        dateStr += " (Hoje)";
    }
    dateEl.textContent = dateStr;
}

/* ==========================================================================
   AUDIO SINTETIZADO (SENSORIAL)
   ========================================================================== */
function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
}

function playBeep(freq, type, duration, delay = 0, volume = 0.15) {
    try {
        initAudio();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        
        osc.type = type;
        osc.frequency.setValueAtTime(freq, audioCtx.currentTime + delay);
        
        gain.gain.setValueAtTime(volume, audioCtx.currentTime + delay);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + delay + duration - 0.02);
        
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        
        osc.start(audioCtx.currentTime + delay);
        osc.stop(audioCtx.currentTime + delay + duration);
    } catch (e) {
        console.warn("Som bloqueado pelo navegador:", e);
    }
}

function playSuccessSound() {
    const freqs = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
    freqs.forEach((freq, idx) => {
        playBeep(freq, 'sine', 0.35, idx * 0.07, 0.12);
    });
}

function playWaterSound() {
    playBeep(350, 'triangle', 0.12, 0, 0.15);
    playBeep(550, 'triangle', 0.16, 0.06, 0.12);
}

function playGoalReachedSound() {
    const notes = [587.33, 587.33, 587.33, 783.99, 987.77]; // D5, D5, D5, G5, B5
    notes.forEach((freq, idx) => {
        playBeep(freq, 'sine', 0.25, idx * 0.08, 0.15);
    });
}

function playClickSound() {
    playBeep(600, 'sine', 0.05, 0, 0.05);
}

/* ==========================================================================
   SISTEMA DE CONFETES (DOPAMINA VISUAL)
   ========================================================================== */
function setupConfettiCanvas() {
    const canvas = document.getElementById("confetti-canvas");
    window.addEventListener("resize", () => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    });
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}

class ConfettiParticle {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.size = Math.random() * 8 + 6;
        const colors = [
            "hsl(265, 85%, 65%)", // Roxo
            "hsl(150, 75%, 45%)", // Verde
            "hsl(198, 90%, 52%)", // Azul
            "hsl(42, 95%, 55%)",  // Amarelo
            "hsl(355, 85%, 60%)"  // Vermelho
        ];
        this.color = colors[Math.floor(Math.random() * colors.length)];
        this.speedX = Math.random() * 6 - 3;
        this.speedY = Math.random() * -12 - 6;
        this.gravity = 0.35;
        this.rotation = Math.random() * 360;
        this.rotationSpeed = Math.random() * 8 - 4;
        this.opacity = 1;
    }
    
    update() {
        this.x += this.speedX;
        this.y += this.speedY;
        this.speedY += this.gravity;
        this.rotation += this.rotationSpeed;
        this.opacity -= 0.012;
    }
    
    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate((this.rotation * Math.PI) / 180);
        ctx.fillStyle = this.color;
        ctx.globalAlpha = this.opacity;
        ctx.fillRect(-this.size / 2, -this.size / 2, this.size, this.size);
        ctx.restore();
    }
}

function triggerConfetti(x, y) {
    const canvas = document.getElementById("confetti-canvas");
    if (!canvas) return;
    
    for (let i = 0; i < 40; i++) {
        confettiParticles.push(new ConfettiParticle(x, y));
    }
    
    if (!confettiAnimationId) {
        animateConfetti();
    }
}

function animateConfetti() {
    const canvas = document.getElementById("confetti-canvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    confettiParticles = confettiParticles.filter(p => p.opacity > 0);
    
    confettiParticles.forEach(p => {
        p.update();
        p.draw(ctx);
    });
    
    if (confettiParticles.length > 0) {
        confettiAnimationId = requestAnimationFrame(animateConfetti);
    } else {
        confettiAnimationId = null;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
}

/* ==========================================================================
   RENDERIZAÇÃO - MÓDULO GERAL
   ========================================================================== */
function renderAll() {
    renderCalendarStrip();
    renderTimeline();
    renderMeds();
    renderWater();
    renderBrainDump();
    updateGeneralProgress();
    lucide.createIcons();
}

// Calcula o progresso de conclusão do dia selecionado
function updateGeneralProgress() {
    const tasksForDay = state.tasks.filter(t => t.date === selectedDate);
    const totalItems = tasksForDay.length + state.meds.length;
    
    if (totalItems === 0) {
        document.getElementById("day-progress-percent").textContent = "0%";
        document.getElementById("day-progress-fill").style.width = "0%";
        return;
    }
    
    const completedTasks = tasksForDay.filter(t => t.completed).length;
    const completedMeds = state.meds.filter(m => m.takenHistory && m.takenHistory[selectedDate]).length;
    const completedItems = completedTasks + completedMeds;
    
    const percentage = Math.round((completedItems / totalItems) * 100);
    
    document.getElementById("day-progress-percent").textContent = `${percentage}%`;
    document.getElementById("day-progress-fill").style.width = `${percentage}%`;
}

/* ==========================================================================
   SEÇÃO: CALENDÁRIO SEMANAL HORIZONTAL
   ========================================================================== */
function renderCalendarStrip() {
    const container = document.getElementById("calendar-strip");
    if (!container) return;
    container.innerHTML = "";
    
    const activeDateObj = parseDateString(selectedDate);
    const todayStr = getTodayDateString();
    
    // Gera 7 dias: 3 antes da data selecionada, a selecionada, e 3 depois
    const daysToShow = [];
    for (let i = -3; i <= 3; i++) {
        const d = new Date(activeDateObj);
        d.setDate(activeDateObj.getDate() + i);
        daysToShow.push(d);
    }
    
    const weekdaysMin = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
    
    daysToShow.forEach(dateObj => {
        const dateStr = formatDateString(dateObj);
        const weekday = weekdaysMin[dateObj.getDay()];
        const dayNum = dateObj.getDate();
        
        // Verifica status para os pontinhos
        const tasksForDay = state.tasks.filter(t => t.date === dateStr);
        const hasPending = tasksForDay.some(t => !t.completed);
        const hasCompleted = tasksForDay.some(t => t.completed);
        
        const card = document.createElement("div");
        card.className = "calendar-day-card";
        
        if (dateStr === selectedDate) {
            card.classList.add("active");
        }
        if (dateStr === todayStr) {
            card.classList.add("today");
        }
        
        card.dataset.date = dateStr;
        
        // Cria estrutura de pontinhos de status
        let indicatorsHtml = "";
        if (tasksForDay.length > 0) {
            indicatorsHtml += '<div class="day-card-indicators">';
            if (hasPending) {
                indicatorsHtml += '<span class="day-indicator-dot pending"></span>';
            }
            if (hasCompleted && !hasPending) {
                indicatorsHtml += '<span class="day-indicator-dot completed"></span>';
            } else if (hasCompleted) {
                indicatorsHtml += '<span class="day-indicator-dot completed"></span>';
            }
            indicatorsHtml += '</div>';
        } else {
            // Placeholder para alinhar o texto
            indicatorsHtml = '<div class="day-card-indicators" style="opacity: 0;"><span class="day-indicator-dot"></span></div>';
        }
        
        card.innerHTML = `
            <span class="day-card-weekday">${weekday}</span>
            <span class="day-card-daynum">${dayNum}</span>
            ${indicatorsHtml}
        `;
        
        card.addEventListener("click", () => {
            selectDate(dateStr);
        });
        
        container.appendChild(card);
    });
}

function selectDate(dateStr) {
    if (selectedDate === dateStr) return;
    
    playClickSound();
    selectedDate = dateStr;
    
    setupCurrentDateDisplay();
    renderAll();
    
    // Se for hoje, rola para a hora atual
    if (selectedDate === getTodayDateString()) {
        scrollToCurrentHour();
    }
}

/* ==========================================================================
   SEÇÃO: LINHA DO TEMPO (DEMANDAS POR HORA)
   ========================================================================== */
const HOURS_IN_DAY = 24;

function initTimelineHours() {
    const selectHour = document.getElementById("task-hour");
    if (!selectHour) return;
    selectHour.innerHTML = "";
    
    for (let i = 0; i < HOURS_IN_DAY; i++) {
        const hourStr = String(i).padStart(2, '0');
        const option = document.createElement("option");
        option.value = hourStr;
        option.textContent = `${hourStr}:00`;
        selectHour.appendChild(option);
    }
    
    const currentHour = new Date().getHours();
    const nextHour = (currentHour + 1) % 24;
    selectHour.value = String(nextHour).padStart(2, '0');
}

function renderTimeline() {
    const container = document.getElementById("timeline-container");
    if (!container) return;
    container.innerHTML = "";
    
    const currentHour = new Date().getHours();
    const todayStr = getTodayDateString();
    
    // Filtro por data
    const tasksForDay = state.tasks.filter(t => t.date === selectedDate);
    
    let hoursToRender = [];
    for (let h = 0; h < HOURS_IN_DAY; h++) {
        hoursToRender.push(h);
    }

    // Se for hoje, suporta ocultar horas passadas
    if (selectedDate === todayStr && activeFilterTab === "remaining") {
        hoursToRender = hoursToRender.filter(h => h >= currentHour);
    }

    if (activeFilterTab === "completed") {
        hoursToRender = hoursToRender.filter(h => {
            const hourStr = String(h).padStart(2, '0');
            return tasksForDay.some(t => t.hour === hourStr && t.completed);
        });
        
        if (hoursToRender.length === 0) {
            container.innerHTML = `<div class="hour-empty-placeholder" style="justify-content: center; padding: 40px; color: var(--text-dimmed);">Nenhuma demanda concluída nesta data.</div>`;
            return;
        }
    }
    
    hoursToRender.forEach(h => {
        const hourStr = String(h).padStart(2, '0');
        const tasksInHour = tasksForDay.filter(t => t.hour === hourStr);
        
        const filteredTasks = activeFilterTab === "completed" 
            ? tasksInHour.filter(t => t.completed)
            : tasksInHour;
            
        const hourSlot = document.createElement("div");
        hourSlot.className = "hour-slot";
        hourSlot.dataset.hour = hourStr;
        
        // Destaca se for o dia de HOJE e a hora de AGORA
        if (selectedDate === todayStr && h === currentHour) {
            hourSlot.classList.add("current-hour");
        }
        
        let tasksHtml = "";
        if (filteredTasks.length === 0) {
            if (activeFilterTab !== "completed") {
                tasksHtml = `
                    <div class="hour-empty-placeholder">
                        <span>Livre</span>
                        <button class="btn-quick-add" onclick="openAddTaskModal('${hourStr}')" title="Adicionar nesta hora">
                            <i data-lucide="plus"></i>
                        </button>
                    </div>
                `;
            }
        } else {
            filteredTasks.forEach(task => {
                tasksHtml += `
                    <div class="task-card cat-${task.category} ${task.completed ? 'completed' : ''}" data-id="${task.id}">
                        <div class="task-checkbox-wrapper">
                            <div class="custom-checkbox" onclick="toggleTaskCompletion('${task.id}', event)">
                                <i data-lucide="check"></i>
                            </div>
                        </div>
                        <div class="task-info">
                            <div class="task-title-row">
                                <span class="task-title">${escapeHtml(task.title)}</span>
                                <span class="category-badge">${getCategoryName(task.category)}</span>
                            </div>
                            ${task.desc ? `<span class="task-desc">${escapeHtml(task.desc)}</span>` : ''}
                        </div>
                        <div class="task-actions" style="gap: 4px;">
                            <button class="btn-edit-task" onclick="openEditTaskModal('${task.id}')" title="Editar Demanda">
                                <i data-lucide="pencil"></i>
                            </button>
                            <button class="btn-delete-task" onclick="deleteTask('${task.id}')" title="Excluir Demanda">
                                <i data-lucide="trash-2"></i>
                            </button>
                        </div>
                    </div>
                `;
            });
            
            if (activeFilterTab !== "completed") {
                tasksHtml += `
                    <button class="btn-text-only" style="margin-top: 4px; padding-left: 2px;" onclick="openAddTaskModal('${hourStr}')">
                        <i data-lucide="plus"></i> <span style="font-size: 11px;">Outra demanda</span>
                    </button>
                `;
            }
        }
        
        hourSlot.innerHTML = `
            <div class="hour-time-badge">${hourStr}:00</div>
            <div class="hour-content-wrapper">
                <div class="hour-tasks-container">
                    ${tasksHtml}
                </div>
            </div>
        `;
        
        container.appendChild(hourSlot);
    });
    
    lucide.createIcons();
}

function updateCurrentHourHighlight() {
    const currentHour = new Date().getHours();
    const hourStr = String(currentHour).padStart(2, '0');
    const todayStr = getTodayDateString();
    
    document.querySelectorAll(".hour-slot").forEach(slot => {
        slot.classList.remove("current-hour");
        if (selectedDate === todayStr && slot.dataset.hour === hourStr) {
            slot.classList.add("current-hour");
        }
    });
}

function scrollToCurrentHour() {
    const currentHour = new Date().getHours();
    const hourStr = String(currentHour).padStart(2, '0');
    const currentEl = document.querySelector(`.hour-slot[data-hour="${hourStr}"]`);
    if (currentEl) {
        currentEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}

function getCategoryName(cat) {
    const map = {
        routine: "Rotina",
        work: "Trabalho",
        study: "Estudos",
        health: "Saúde",
        leisure: "Lazer"
    };
    return map[cat] || "Geral";
}

/* ==========================================================================
   SEÇÃO: MEDICAMENTOS
   ========================================================================== */
function renderMeds() {
    const container = document.getElementById("meds-container");
    if (!container) return;
    container.innerHTML = "";
    
    if (state.meds.length === 0) {
        container.innerHTML = `
            <div class="hour-empty-placeholder" style="justify-content: center; padding: 20px; color: var(--text-dimmed);">
                Nenhum remédio cadastrado.
            </div>
        `;
        return;
    }
    
    const sortedMeds = [...state.meds].sort((a, b) => a.hour.localeCompare(b.hour));
    
    sortedMeds.forEach(med => {
        const isTaken = med.takenHistory && med.takenHistory[selectedDate];
        const medCard = document.createElement("div");
        medCard.className = `med-card ${isTaken ? 'taken' : ''}`;
        medCard.dataset.id = med.id;
        
        medCard.innerHTML = `
            <div class="med-info-area">
                <div class="med-icon-box">
                    <i data-lucide="${isTaken ? 'check' : 'pill'}"></i>
                </div>
                <div class="med-text">
                    <span class="med-name">${escapeHtml(med.name)}</span>
                    <div class="med-details">
                        <span>${escapeHtml(med.dosage)}</span>
                        <span class="med-time"><i data-lucide="clock" style="width: 10px; height: 10px; display: inline; vertical-align: middle;"></i> ${med.hour}</span>
                    </div>
                    ${med.notes ? `<small style="color: var(--text-dimmed); font-size: 10px;">${escapeHtml(med.notes)}</small>` : ''}
                </div>
            </div>
            <div class="med-actions">
                <button class="btn-take-med" onclick="toggleMedTaken('${med.id}', event)" title="${isTaken ? 'Desmarcar' : 'Marcar como Tomado'}">
                    <i data-lucide="${isTaken ? 'rotate-ccw' : 'check'}"></i>
                </button>
                <button class="btn-edit-med" onclick="openEditMedModal('${med.id}')" title="Editar Remédio">
                    <i data-lucide="pencil"></i>
                </button>
                <button class="btn-delete-med" onclick="deleteMed('${med.id}')" title="Excluir Remédio">
                    <i data-lucide="trash-2"></i>
                </button>
            </div>
        `;
        container.appendChild(medCard);
    });
}

/* ==========================================================================
   SEÇÃO: HIDRATAÇÃO (ÁGUA)
   ========================================================================== */
function renderWater() {
    const display = document.getElementById("water-goal-display");
    const percentEl = document.getElementById("water-percent-badge");
    const levelEl = document.getElementById("water-level-fill");
    
    if (!display || !percentEl || !levelEl) return;
    
    const current = state.waterHistory[selectedDate] || 0;
    const goal = state.waterGoal || 2000;
    
    display.textContent = `${current} / ${goal} ml`;
    
    const percentage = Math.min(Math.round((current / goal) * 100), 100);
    percentEl.textContent = `${percentage}%`;
    levelEl.style.height = `${percentage}%`;
}

/* ==========================================================================
   SEÇÃO: BRAIN DUMP (IDEIAS RÁPIDAS)
   ========================================================================== */
function renderBrainDump() {
    const list = document.getElementById("notes-list");
    if (!list) return;
    list.innerHTML = "";
    
    if (state.notes.length === 0) {
        list.innerHTML = `
            <li style="color: var(--text-dimmed); font-size: 12px; text-align: center; padding: 20px;">
                Espaço vazio. Escreva distrações ou pensamentos rápidos aqui para esvaziar a mente!
            </li>
        `;
        return;
    }
    
    state.notes.forEach(note => {
        const li = document.createElement("li");
        li.className = "note-item";
        li.innerHTML = `
            <span>${escapeHtml(note.text)}</span>
            <button class="btn-delete-note" onclick="deleteNote('${note.id}')" title="Remover Nota">
                <i data-lucide="check"></i>
            </button>
        `;
        list.appendChild(li);
    });
}

/* ==========================================================================
   AÇÕES DO USUÁRIO & MANIPULAÇÃO DE ESTADO
   ========================================================================== */

// --- Tarefas ---
window.openAddTaskModal = function(defaultHour = "") {
    playClickSound();
    editingTaskId = null;
    
    // Altera o título do modal
    const modalHeader = document.querySelector("#modal-task .modal-header h3");
    if (modalHeader) {
        modalHeader.innerHTML = `<i data-lucide="plus-circle"></i> Nova Demanda`;
    }
    
    const modal = document.getElementById("modal-task");
    const selectHour = document.getElementById("task-hour");
    
    if (defaultHour) {
        selectHour.value = defaultHour;
    }
    
    modal.classList.add("active");
    document.getElementById("task-title").focus();
    lucide.createIcons();
};

window.openEditTaskModal = function(id) {
    playClickSound();
    const task = state.tasks.find(t => t.id === id);
    if (!task) return;
    
    editingTaskId = id;
    
    // Preenche os campos do formulário
    document.getElementById("task-title").value = task.title;
    document.getElementById("task-hour").value = task.hour;
    document.getElementById("task-category").value = task.category;
    document.getElementById("task-desc").value = task.desc || "";
    
    // Altera o título do modal
    const modalHeader = document.querySelector("#modal-task .modal-header h3");
    if (modalHeader) {
        modalHeader.innerHTML = `<i data-lucide="pencil"></i> Editar Demanda`;
    }
    
    const modal = document.getElementById("modal-task");
    modal.classList.add("active");
    document.getElementById("task-title").focus();
    lucide.createIcons();
};

window.closeAddTaskModal = function() {
    document.getElementById("modal-task").classList.remove("active");
    document.getElementById("form-add-task").reset();
    editingTaskId = null;
};

window.toggleTaskCompletion = function(id, event) {
    const task = state.tasks.find(t => t.id === id);
    if (!task) return;
    
    task.completed = !task.completed;
    saveState();
    
    if (task.completed) {
        playSuccessSound();
        if (event) {
            triggerConfetti(event.clientX, event.clientY);
        } else {
            triggerConfetti(window.innerWidth / 2, window.innerHeight / 2);
        }
    } else {
        playClickSound();
    }
    
    renderAll();
};

window.deleteTask = function(id) {
    playClickSound();
    if (confirm("Tem certeza que deseja excluir esta demanda?")) {
        state.tasks = state.tasks.filter(t => t.id !== id);
        saveState();
        renderAll();
    }
};

// --- Medicamentos ---
window.openAddMedModal = function() {
    playClickSound();
    editingMedId = null;
    
    // Altera o título do modal
    const modalHeader = document.querySelector("#modal-med .modal-header h3");
    if (modalHeader) {
        modalHeader.innerHTML = `<i data-lucide="plus-circle"></i> Cadastrar Medicamento`;
    }
    
    document.getElementById("modal-med").classList.add("active");
    document.getElementById("med-name").focus();
    lucide.createIcons();
};

window.openEditMedModal = function(id) {
    playClickSound();
    const med = state.meds.find(m => m.id === id);
    if (!med) return;
    
    editingMedId = id;
    
    // Preenche os campos do formulário
    document.getElementById("med-name").value = med.name;
    document.getElementById("med-dosage").value = med.dosage;
    document.getElementById("med-hour").value = med.hour;
    document.getElementById("med-notes").value = med.notes || "";
    
    // Altera o título do modal
    const modalHeader = document.querySelector("#modal-med .modal-header h3");
    if (modalHeader) {
        modalHeader.innerHTML = `<i data-lucide="pencil"></i> Editar Medicamento`;
    }
    
    document.getElementById("modal-med").classList.add("active");
    document.getElementById("med-name").focus();
    lucide.createIcons();
};

window.closeAddMedModal = function() {
    document.getElementById("modal-med").classList.remove("active");
    document.getElementById("form-add-med").reset();
    editingMedId = null;
};

window.toggleMedTaken = function(id, event) {
    const med = state.meds.find(m => m.id === id);
    if (!med) return;
    
    if (!med.takenHistory) {
        med.takenHistory = {};
    }
    
    med.takenHistory[selectedDate] = !med.takenHistory[selectedDate];
    saveState();
    
    if (med.takenHistory[selectedDate]) {
        playSuccessSound();
        if (event) {
            triggerConfetti(event.clientX, event.clientY);
        } else {
            triggerConfetti(window.innerWidth / 2, window.innerHeight / 2);
        }
    } else {
        playClickSound();
    }
    
    renderAll();
};

window.deleteMed = function(id) {
    playClickSound();
    if (confirm("Deseja mesmo excluir este medicamento da sua rotina?")) {
        state.meds = state.meds.filter(m => m.id !== id);
        saveState();
        renderAll();
    }
};

// --- Água (Hidratação) ---
function addWater(amount, event) {
    const current = state.waterHistory[selectedDate] || 0;
    const goal = state.waterGoal || 2000;
    const prevGoalReached = current >= goal;
    
    const newAmount = current + amount;
    state.waterHistory[selectedDate] = newAmount;
    saveState();
    
    const newGoalReached = newAmount >= goal;
    
    if (newGoalReached && !prevGoalReached) {
        playGoalReachedSound();
        triggerConfetti(window.innerWidth / 2, window.innerHeight / 2);
        setTimeout(() => triggerConfetti(window.innerWidth / 3, window.innerHeight / 2), 200);
        setTimeout(() => triggerConfetti(2 * window.innerWidth / 3, window.innerHeight / 2), 400);
    } else {
        playWaterSound();
        if (event) {
            triggerConfetti(event.clientX, event.clientY);
        }
    }
    
    renderWater();
}

// --- Brain Dump (Notas) ---
function addNote() {
    const input = document.getElementById("braindump-input");
    const text = input.value.trim();
    if (!text) return;
    
    const newNote = {
        id: "n_" + Date.now(),
        text: text
    };
    
    state.notes.push(newNote);
    saveState();
    input.value = "";
    
    playClickSound();
    renderBrainDump();
    lucide.createIcons();
}

window.deleteNote = function(id) {
    playBeep(880, 'sine', 0.1, 0, 0.1);
    state.notes = state.notes.filter(n => n.id !== id);
    saveState();
    renderBrainDump();
};

/* ==========================================================================
   OUVINTES DE EVENTOS (EVENT LISTENERS)
   ========================================================================== */
function setupEventListeners() {
    // Inicialização do áudio no primeiro clique
    document.body.addEventListener("click", () => {
        initAudio();
    }, { once: true });

    // --- Modal de Tarefas ---
    document.getElementById("btn-add-task-trigger").addEventListener("click", () => openAddTaskModal());
    document.getElementById("btn-close-task-modal").addEventListener("click", closeAddTaskModal);
    document.getElementById("btn-cancel-task").addEventListener("click", closeAddTaskModal);
    
    document.getElementById("form-add-task").addEventListener("submit", (e) => {
        e.preventDefault();
        
        const title = document.getElementById("task-title").value.trim();
        const hour = document.getElementById("task-hour").value;
        const category = document.getElementById("task-category").value;
        const desc = document.getElementById("task-desc").value.trim();
        
        if (!title) return;
        
        if (editingTaskId) {
            // Lógica de Edição de Demanda
            const task = state.tasks.find(t => t.id === editingTaskId);
            if (task) {
                task.title = title;
                task.hour = hour;
                task.category = category;
                task.desc = desc;
            }
            editingTaskId = null;
        } else {
            // Lógica de Criação de Demanda
            const newTask = {
                id: "t_" + Date.now(),
                title,
                hour,
                category,
                desc,
                completed: false,
                date: selectedDate // Associa a tarefa à data de visualização atual!
            };
            state.tasks.push(newTask);
        }
        
        saveState();
        closeAddTaskModal();
        renderAll();
        
        playSuccessSound();
        const rect = document.getElementById("btn-add-task-trigger").getBoundingClientRect();
        triggerConfetti(rect.left + rect.width / 2, rect.top + rect.height / 2);
    });

    // --- Modal de Medicamentos ---
    document.getElementById("btn-add-med-trigger").addEventListener("click", openAddMedModal);
    document.getElementById("btn-close-med-modal").addEventListener("click", closeAddMedModal);
    document.getElementById("btn-cancel-med").addEventListener("click", closeAddMedModal);
    
    document.getElementById("form-add-med").addEventListener("submit", (e) => {
        e.preventDefault();
        
        const name = document.getElementById("med-name").value.trim();
        const dosage = document.getElementById("med-dosage").value.trim();
        const hour = document.getElementById("med-hour").value;
        const notes = document.getElementById("med-notes").value.trim();
        
        if (!name || !dosage || !hour) return;
        
        if (editingMedId) {
            // Lógica de Edição de Medicamento
            const med = state.meds.find(m => m.id === editingMedId);
            if (med) {
                med.name = name;
                med.dosage = dosage;
                med.hour = hour;
                med.notes = notes;
            }
            editingMedId = null;
        } else {
            // Lógica de Criação de Medicamento
            const newMed = {
                id: "m_" + Date.now(),
                name,
                dosage,
                hour,
                notes,
                takenHistory: {}
            };
            state.meds.push(newMed);
        }
        
        saveState();
        closeAddMedModal();
        renderAll();
        playSuccessSound();
    });

    // --- Navegação por abas da Timeline ---
    document.getElementById("tab-all-hours").addEventListener("click", (e) => {
        playClickSound();
        switchTab("all", e.target);
    });
    document.getElementById("tab-remaining-hours").addEventListener("click", (e) => {
        playClickSound();
        switchTab("remaining", e.target);
    });
    document.getElementById("tab-completed-hours").addEventListener("click", (e) => {
        playClickSound();
        switchTab("completed", e.target);
    });

    function switchTab(tabName, buttonEl) {
        activeFilterTab = tabName;
        document.querySelectorAll(".timeline-navigation .tab-btn").forEach(btn => btn.classList.remove("active"));
        buttonEl.classList.add("active");
        renderTimeline();
    }

    // --- Botões de Água ---
    document.querySelectorAll(".btn-water").forEach(btn => {
        btn.addEventListener("click", (e) => {
            const amount = parseInt(btn.dataset.amount);
            addWater(amount, e);
        });
    });

    document.getElementById("btn-reset-water").addEventListener("click", () => {
        playClickSound();
        if (confirm("Deseja realmente zerar a água bebida neste dia?")) {
            state.waterHistory[selectedDate] = 0;
            saveState();
            renderWater();
        }
    });

    document.getElementById("btn-custom-water").addEventListener("click", (e) => {
        playClickSound();
        const amountStr = prompt("Digite a quantidade de água em ml:", "250");
        if (amountStr) {
            const amount = parseInt(amountStr);
            if (!isNaN(amount) && amount > 0) {
                addWater(amount, e);
            }
        }
    });

    // --- Seletor de Data Nativo (Input oculto) ---
    const nativePicker = document.getElementById("native-date-picker");
    nativePicker.addEventListener("input", (e) => {
        if (e.target.value) {
            selectDate(e.target.value);
        }
    });
    
    // Vincula o botão de calendário ao clique do input oculto
    document.getElementById("btn-calendar-picker").addEventListener("click", () => {
        playClickSound();
        nativePicker.showPicker(); // Método moderno para disparar o datepicker nativo
    });

    // --- Brain Dump ---
    document.getElementById("btn-add-note").addEventListener("click", addNote);
    document.getElementById("braindump-input").addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            addNote();
        }
    });

    // --- Reiniciar Dia ---
    document.getElementById("btn-reset-day").addEventListener("click", () => {
        playClickSound();
        if (confirm("Você quer zerar todas as demandas concluídas, medicamentos tomados e água para reiniciar o dia atual de visualização?")) {
            // Zera progresso do dia selecionado
            const tasksForDay = state.tasks.filter(t => t.date === selectedDate);
            tasksForDay.forEach(t => t.completed = false);
            
            state.meds.forEach(m => {
                if (m.takenHistory) {
                    m.takenHistory[selectedDate] = false;
                }
            });
            
            state.waterHistory[selectedDate] = 0;
            
            saveState();
            renderAll();
            playGoalReachedSound();
        }
    });

    // --- Instalação PWA ---
    const installBtn = document.getElementById("btn-install-app");
    if (installBtn) {
        installBtn.addEventListener("click", () => {
            playClickSound();
            if (!deferredPrompt) return;
            // Oculta o botão de instalação da interface
            installBtn.style.display = "none";
            // Dispara o prompt do navegador
            deferredPrompt.prompt();
            // Aguarda a resposta do usuário
            deferredPrompt.userChoice.then((choiceResult) => {
                if (choiceResult.outcome === "accepted") {
                    console.log("PWA instalado com sucesso pelo usuário.");
                }
                deferredPrompt = null;
            });
        });
    }

    // --- Sincronização em Nuvem ---
    const btnToggleCode = document.getElementById("btn-toggle-sync-code");
    const syncInput = document.getElementById("sync-code-input");
    if (btnToggleCode && syncInput) {
        btnToggleCode.addEventListener("click", () => {
            playClickSound();
            if (syncInput.type === "password") {
                syncInput.type = "text";
                btnToggleCode.innerHTML = `<i data-lucide="eye-off"></i>`;
            } else {
                syncInput.type = "password";
                btnToggleCode.innerHTML = `<i data-lucide="eye"></i>`;
            }
            lucide.createIcons();
        });
    }

    const btnGenCode = document.getElementById("btn-generate-sync-code");
    if (btnGenCode && syncInput) {
        btnGenCode.addEventListener("click", () => {
            playClickSound();
            // Gera um código amigável
            const words = ["foco", "mente", "tarefa", "habito", "saude", "rotina", "tempo", "vida", "energia", "alvo"];
            const code = Array.from({length: 3}, () => words[Math.floor(Math.random() * words.length)]).join("-") + "-" + Math.floor(Math.random() * 900 + 100);
            syncInput.value = code;
            syncInput.type = "text";
            if (btnToggleCode) {
                btnToggleCode.innerHTML = `<i data-lucide="eye-off"></i>`;
            }
            lucide.createIcons();
        });
    }

    const btnConnect = document.getElementById("btn-connect-sync");
    if (btnConnect && syncInput) {
        btnConnect.addEventListener("click", () => {
            playClickSound();
            const code = syncInput.value.trim().toLowerCase();
            
            if (code) {
                syncCode = code;
                localStorage.setItem("FOCOFACIL_SYNC_CODE", syncCode);
                pullFromCloud(); // Conecta e puxa os dados
            } else {
                // Se limpar o campo, desvincula a nuvem
                syncCode = "";
                localStorage.removeItem("FOCOFACIL_SYNC_CODE");
                updateSyncStatusBadge("local");
                const instructions = document.getElementById("sync-instructions");
                if (instructions) {
                    instructions.textContent = "Sincronização desativada. Seus dados estão apenas locais.";
                }
            }
        });
    }
}

/* ==========================================================================
   SINCRONIZAÇÃO EM NUVEM E PWA - MÉTODOS DE API
   ========================================================================== */
function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/sw.js')
                .then(reg => console.log('Service Worker registrado com sucesso!', reg.scope))
                .catch(err => console.warn('Falha ao registrar Service Worker:', err));
        });
    }
}

function updateSyncStatusBadge(status) {
    syncStatus = status;
    const badge = document.getElementById("sync-status-badge");
    if (!badge) return;
    
    badge.className = "sync-status-badge";
    
    if (status === "local") {
        badge.classList.add("badge-local");
        badge.textContent = "Apenas Local";
    } else if (status === "syncing") {
        badge.classList.add("badge-syncing");
        badge.textContent = "Sincronizando...";
    } else if (status === "connected") {
        badge.classList.add("badge-connected");
        badge.textContent = "Nuvem Ativa";
    } else if (status === "error") {
        badge.classList.add("badge-error");
        badge.textContent = "Erro Nuvem";
    }
}

async function pullFromCloud() {
    if (!syncCode) return;
    updateSyncStatusBadge("syncing");
    
    const instructions = document.getElementById("sync-instructions");
    
    try {
        const response = await fetch(`/api/sync?code=${encodeURIComponent(syncCode)}`);
        if (!response.ok) throw new Error("Erro de comunicação com o servidor.");
        
        const resData = await response.json();
        
        if (resData.success) {
            const cloudState = resData.data;
            
            if (cloudState) {
                // Algoritmo de Resolução de Conflito (Última alteração vence)
                const localTS = state.lastSavedTimestamp || 0;
                const cloudTS = cloudState.lastSavedTimestamp || 0;
                
                if (cloudTS > localTS) {
                    // Estado da nuvem é mais recente, substitui local
                    state = cloudState;
                    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(state));
                    renderAll();
                    if (instructions) {
                        instructions.textContent = "Dados baixados da nuvem. Seu app está atualizado!";
                    }
                } else if (localTS > cloudTS) {
                    // Estado local é mais recente, envia para a nuvem
                    pushToCloud();
                    if (instructions) {
                        instructions.textContent = "Dados locais são mais recentes. Enviando para a nuvem...";
                    }
                } else {
                    if (instructions) {
                        instructions.textContent = "Dados já estão em sincronia com a nuvem!";
                    }
                }
            } else {
                // Nuvem vazia para este código, envia o estado local atual
                pushToCloud();
                if (instructions) {
                    instructions.textContent = "Nova conta de sincronização criada. Enviando dados locais...";
                }
            }
            updateSyncStatusBadge("connected");
        } else {
            // Se o KV não estiver configurado na Vercel
            if (resData.error === "KV_DATABASE_NOT_CONFIGURED") {
                updateSyncStatusBadge("error");
                if (instructions) {
                    instructions.innerHTML = `<span style="color:var(--color-danger)">${resData.message}</span>`;
                }
            } else {
                throw new Error(resData.error || "Erro desconhecido da API");
            }
        }
    } catch (e) {
        console.error("Falha ao puxar dados da nuvem:", e);
        updateSyncStatusBadge("error");
        if (instructions) {
            instructions.textContent = "Erro ao conectar com a nuvem. Operando localmente.";
        }
    }
}

async function pushToCloud() {
    if (!syncCode) return;
    updateSyncStatusBadge("syncing");
    
    const instructions = document.getElementById("sync-instructions");
    
    try {
        const response = await fetch('/api/sync', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                code: syncCode,
                state: state
            })
        });
        
        if (!response.ok) throw new Error("Falha ao enviar estado para o servidor.");
        
        const resData = await response.json();
        
        if (resData.success) {
            updateSyncStatusBadge("connected");
            if (instructions) {
                instructions.textContent = "Sincronizado! Seus dados estão salvos na nuvem.";
            }
        } else {
            if (resData.error === "KV_DATABASE_NOT_CONFIGURED") {
                updateSyncStatusBadge("error");
                if (instructions) {
                    instructions.innerHTML = `<span style="color:var(--color-danger)">${resData.message}</span>`;
                }
            } else {
                throw new Error(resData.error || "Erro desconhecido da API");
            }
        }
    } catch (e) {
        console.error("Erro ao enviar dados para a nuvem:", e);
        updateSyncStatusBadge("error");
        if (instructions) {
            instructions.textContent = "Erro ao enviar dados para a nuvem. Salvando offline.";
        }
    }
}

/* ==========================================================================
   UTILITÁRIOS E SEGURANÇA
   ========================================================================== */
function escapeHtml(unsafe) {
    return unsafe
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
}
