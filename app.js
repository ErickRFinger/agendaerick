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
    lastUpdatedDate: "",
    kanbanNotes: []
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
let lastSyncErrorMessage = "";

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
    otherLiquids: [],
    settings: {
        notificationsEnabled: false,
        waterInterval: 3,
        taskWarning: 15
    },
    lastWaterTimestamp: 0,
    notifiedTasks: [],
    lastUpdatedDate: "",
    lastSavedTimestamp: 0,
    kanbanNotes: [
        { id: "k1", text: "Organizar as anotações do dia por prioridade.", column: "dia" },
        { id: "k2", text: "Fazer o planejamento das metas semanais.", column: "semana" },
        { id: "k3", text: "Revisar assinaturas mensais e finanças.", column: "mes" },
        { id: "k4", text: "Lembrar de comprar presente de aniversário.", column: "lembretes" }
    ]
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

    // Sincronização automática e silenciosa baseada no Supabase
    const savedSyncCode = localStorage.getItem("FOCOFACIL_SYNC_CODE");
    if (savedSyncCode) {
        syncCode = savedSyncCode;
        const syncInput = document.getElementById("sync-code-input");
        if (syncInput) {
            syncInput.value = syncCode;
        }
    } else {
        syncCode = "default";
    }
    pullFromCloud(); // Busca dados atualizados da nuvem


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
        checkNotifications();
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
    if (!state.otherLiquids) state.otherLiquids = [];
    saveState();
}

function fillMissingStateFields() {
    if (!state.tasks) state.tasks = [];
    if (!state.meds) state.meds = [];
    if (!state.waterHistory) state.waterHistory = {};
    if (!state.waterGoal) state.waterGoal = 2000;
    if (!state.notes) state.notes = [];
    if (!state.otherLiquids) state.otherLiquids = [];
    if (!state.settings) state.settings = { notificationsEnabled: false, waterInterval: 3, taskWarning: 15 };
    if (!state.lastWaterTimestamp) state.lastWaterTimestamp = 0;
    if (!state.notifiedTasks) state.notifiedTasks = [];
    if (!state.lastSavedTimestamp) state.lastSavedTimestamp = 0;
    if (!state.kanbanNotes) state.kanbanNotes = [];
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
    renderOtherLiquids();
    renderKanban();
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
   SEÇÃO: OUTROS LÍQUIDOS
   ========================================================================== */
function renderOtherLiquids() {
    const list = document.getElementById("drink-logs-list");
    const totalEl = document.getElementById("other-liquids-total-display");
    if (!list || !totalEl) return;
    
    list.innerHTML = "";
    
    if (!state.otherLiquids) state.otherLiquids = [];
    const logsForDay = state.otherLiquids.filter(l => l.date === selectedDate);
    
    const total = logsForDay.reduce((sum, item) => sum + item.amount, 0);
    totalEl.textContent = `Total: ${total} ml`;
    
    if (logsForDay.length === 0) {
        list.innerHTML = `
            <li style="color: var(--text-dimmed); font-size: 12px; text-align: center; padding: 20px;">
                Nenhuma outra bebida registrada hoje.
            </li>
        `;
        return;
    }
    
    // Mostra do mais antigo para o mais novo
    logsForDay.forEach(log => {
        const li = document.createElement("li");
        li.className = "drink-item";
        li.dataset.id = log.id;
        
        let iconName = "cup-soda";
        if (log.type === "coffee") iconName = "coffee";
        else if (log.type === "juice") iconName = "glass-water";
        else if (log.type === "tea") iconName = "coffee";
        else if (log.type === "energy") iconName = "zap";
        else if (log.type === "alcohol") iconName = "beer";
        else if (log.type === "other") iconName = "droplets";
        
        li.innerHTML = `
            <div class="drink-item-info">
                <div class="drink-item-icon">
                    <i data-lucide="${iconName}"></i>
                </div>
                <div class="drink-item-text">
                    <span class="drink-item-name">${escapeHtml(log.name)}</span>
                    <span class="drink-item-details">${log.amount} ml</span>
                </div>
            </div>
            <button class="btn-delete-drink" onclick="deleteLiquid('${log.id}')" title="Excluir Registro">
                <i data-lucide="trash-2"></i>
            </button>
        `;
        list.appendChild(li);
    });
}

window.deleteLiquid = function(id) {
    playClickSound();
    if (confirm("Tem certeza que deseja excluir esta bebida?")) {
        state.otherLiquids = state.otherLiquids.filter(l => l.id !== id);
        saveState();
        renderOtherLiquids();
        lucide.createIcons();
    }
};

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
    state.lastWaterTimestamp = Date.now();
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

// --- Outros Líquidos ---
function quickAddLiquid(type, amount, name, event) {
    if (!state.otherLiquids) state.otherLiquids = [];
    
    const newLiquid = {
        id: "ol_" + Date.now(),
        date: selectedDate,
        type,
        name,
        amount: parseInt(amount)
    };
    
    state.otherLiquids.push(newLiquid);
    state.lastWaterTimestamp = Date.now();
    saveState();
    
    playWaterSound();
    if (event) {
        triggerConfetti(event.clientX, event.clientY);
    } else {
        triggerConfetti(window.innerWidth / 2, window.innerHeight / 2);
    }
    
    renderOtherLiquids();
    lucide.createIcons();
}

window.openAddLiquidModal = function() {
    playClickSound();
    const modalHeader = document.querySelector("#modal-liquid .modal-header h3");
    if (modalHeader) {
        modalHeader.innerHTML = `<i data-lucide="plus-circle"></i> Registrar Bebida`;
    }
    
    document.getElementById("modal-liquid").classList.add("active");
    document.getElementById("liquid-name").value = "";
    document.getElementById("liquid-amount").value = "";
    document.getElementById("liquid-amount").focus();
    lucide.createIcons();
};

window.closeAddLiquidModal = function() {
    document.getElementById("modal-liquid").classList.remove("active");
    document.getElementById("form-add-liquid").reset();
};

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

    // --- Botões de Outros Líquidos ---
    document.querySelectorAll(".btn-quick-drink").forEach(btn => {
        btn.addEventListener("click", (e) => {
            const type = btn.dataset.type;
            const amount = btn.dataset.amount;
            const name = btn.dataset.name;
            quickAddLiquid(type, amount, name, e);
        });
    });

    const btnAddLiquidTrigger = document.getElementById("btn-add-liquid-trigger");
    if (btnAddLiquidTrigger) {
        btnAddLiquidTrigger.addEventListener("click", () => openAddLiquidModal());
    }

    const btnCloseLiquidModal = document.getElementById("btn-close-liquid-modal");
    if (btnCloseLiquidModal) {
        btnCloseLiquidModal.addEventListener("click", closeAddLiquidModal);
    }

    const btnCancelLiquid = document.getElementById("btn-cancel-liquid");
    if (btnCancelLiquid) {
        btnCancelLiquid.addEventListener("click", closeAddLiquidModal);
    }

    const formAddLiquid = document.getElementById("form-add-liquid");
    if (formAddLiquid) {
        formAddLiquid.addEventListener("submit", (e) => {
            e.preventDefault();
            
            const type = document.getElementById("liquid-type").value;
            let name = document.getElementById("liquid-name").value.trim();
            const amount = document.getElementById("liquid-amount").value;
            
            if (!amount) return;
            
            if (!name) {
                const selectEl = document.getElementById("liquid-type");
                name = selectEl.options[selectEl.selectedIndex].text.replace(/^[^\s]+\s/, ""); // Remove o emoji inicial
            }
            
            quickAddLiquid(type, amount, name, null);
            closeAddLiquidModal();
        });
    }

    document.querySelectorAll(".preset-amount-btn").forEach(btn => {
        btn.addEventListener("click", (e) => {
            playClickSound();
            document.getElementById("liquid-amount").value = btn.dataset.preset;
        });
    });

    const btnResetLiquids = document.getElementById("btn-reset-liquids");
    if (btnResetLiquids) {
        btnResetLiquids.addEventListener("click", () => {
            playClickSound();
            if (confirm("Deseja realmente zerar todos os outros líquidos bebidos neste dia?")) {
                if (state.otherLiquids) {
                    state.otherLiquids = state.otherLiquids.filter(l => l.date !== selectedDate);
                    saveState();
                    renderOtherLiquids();
                    lucide.createIcons();
                }
            }
        });
    }

    // --- Configurações & Notificações ---
    const btnSettings = document.getElementById("btn-settings-trigger");
    if (btnSettings) {
        btnSettings.addEventListener("click", () => {
            playClickSound();
            document.getElementById("modal-settings").classList.add("active");
            
            // Popula os dados atuais
            if (!state.settings) state.settings = { notificationsEnabled: false, waterInterval: 3, taskWarning: 15 };
            
            document.getElementById("toggle-notifications").checked = state.settings.notificationsEnabled;
            document.getElementById("water-interval").value = state.settings.waterInterval;
            document.getElementById("task-warning").value = state.settings.taskWarning;
            
            document.getElementById("vigi-url-input").value = localStorage.getItem("FOCOFACIL_VIGI_URL") || "http://localhost:3030";
            document.getElementById("vigi-token-input").value = localStorage.getItem("FOCOFACIL_VIGI_TOKEN") || "VIGI-SECURE-TOKEN-123";
            
            document.getElementById("notification-details").style.display = state.settings.notificationsEnabled ? "block" : "none";
        });
    }

    document.getElementById("toggle-notifications").addEventListener("change", (e) => {
        document.getElementById("notification-details").style.display = e.target.checked ? "block" : "none";
        if (e.target.checked) {
            // Solicita permissão de notificação
            if ("Notification" in window) {
                Notification.requestPermission().then(permission => {
                    if (permission !== "granted") {
                        e.target.checked = false;
                        document.getElementById("notification-details").style.display = "none";
                        alert("Você precisa permitir as notificações no navegador para ativar este recurso.");
                    }
                });
            } else {
                alert("Seu navegador não suporta notificações web.");
                e.target.checked = false;
                document.getElementById("notification-details").style.display = "none";
            }
        }
    });

    const btnCloseSettingsModal = document.getElementById("btn-close-settings-modal");
    if (btnCloseSettingsModal) {
        btnCloseSettingsModal.addEventListener("click", () => {
            document.getElementById("modal-settings").classList.remove("active");
        });
    }

    const btnSaveSettings = document.getElementById("btn-save-settings");
    if (btnSaveSettings) {
        btnSaveSettings.addEventListener("click", () => {
            playClickSound();
            if (!state.settings) state.settings = {};
            
            state.settings.notificationsEnabled = document.getElementById("toggle-notifications").checked;
            state.settings.waterInterval = parseInt(document.getElementById("water-interval").value);
            state.settings.taskWarning = parseInt(document.getElementById("task-warning").value);
            
            // Salvar Configurações do Vigi Server
            const urlInput = document.getElementById("vigi-url-input").value.trim();
            const tokenInput = document.getElementById("vigi-token-input").value.trim();
            localStorage.setItem("FOCOFACIL_VIGI_URL", urlInput);
            localStorage.setItem("FOCOFACIL_VIGI_TOKEN", tokenInput);
            
            // Se ativou as notificações e não bebeu água ainda hoje, começa a contar a partir de agora
            if (state.settings.notificationsEnabled && (!state.lastWaterTimestamp || state.lastWaterTimestamp === 0)) {
                state.lastWaterTimestamp = Date.now();
            }
            
            saveState();
            document.getElementById("modal-settings").classList.remove("active");
            playSuccessSound();
        });
    }

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
            if (state.otherLiquids) {
                state.otherLiquids = state.otherLiquids.filter(l => l.date !== selectedDate);
            }
            
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

function updateSyncStatusBadge(status, customErrorMsg = "") {
    syncStatus = status;
    if (customErrorMsg) {
        lastSyncErrorMessage = customErrorMsg;
    }
    
    const indicator = document.getElementById("discreet-sync");
    if (!indicator) return;
    
    indicator.className = "discreet-sync-indicator";
    
    if (status === "local") {
        indicator.classList.add("status-local");
        indicator.innerHTML = `<i data-lucide="cloud-off"></i>`;
        indicator.title = "Sincronização desativada (Apenas Local)";
    } else if (status === "syncing") {
        indicator.classList.add("status-syncing");
        indicator.innerHTML = `<i data-lucide="refresh-cw" class="spin-animation"></i>`;
        indicator.title = "Sincronizando dados com a nuvem...";
    } else if (status === "connected") {
        indicator.classList.add("status-connected");
        indicator.innerHTML = `<i data-lucide="cloud"></i>`;
        indicator.title = "Sincronizado com o Supabase!";
    } else if (status === "error") {
        indicator.classList.add("status-error");
        indicator.innerHTML = `<i data-lucide="cloud-lightning"></i>`;
        indicator.title = "Erro na sincronização! Clique para ver detalhes.";
    }
    lucide.createIcons();

    // Adiciona evento de clique para mostrar o erro discretamente
    if (!indicator.dataset.hasListener) {
        indicator.dataset.hasListener = "true";
        indicator.addEventListener("click", () => {
            if (syncStatus === "error") {
                alert("Erro de Sincronização:\n\n" + (lastSyncErrorMessage || "Verifique a rede ou a configuração das chaves do Supabase."));
            }
        });
    }
}

function isStateDefault(s) {
    if (!s) return true;
    if (s.isDefault === true) return true;
    
    const hasUserTasks = s.tasks && s.tasks.some(t => !["t1", "t2", "t3"].includes(t.id));
    const hasUserMeds = s.meds && s.meds.some(m => !["m1", "m2"].includes(m.id));
    const hasWaterHistory = s.waterHistory && Object.keys(s.waterHistory).length > 0;
    const hasOtherLiquids = s.otherLiquids && s.otherLiquids.length > 0;
    const hasUserKanban = s.kanbanNotes && s.kanbanNotes.some(k => !["k1", "k2", "k3", "k4"].includes(k.id));
    
    return !hasUserTasks && !hasUserMeds && !hasWaterHistory && !hasOtherLiquids && !hasUserKanban;
}

async function pullFromCloud() {
    if (!syncCode) return;
    updateSyncStatusBadge("syncing");
    
    try {
        const response = await fetch(`/api/sync?code=${encodeURIComponent(syncCode)}`);
        if (!response.ok) throw new Error("Erro de comunicação com o servidor.");
        
        const resData = await response.json();
        
        if (resData.success) {
            const cloudState = resData.data;
            
            if (cloudState) {
                // Algoritmo Inteligente de Resolução de Conflito
                const localDefault = isStateDefault(state);
                const cloudDefault = isStateDefault(cloudState);
                
                if (cloudDefault && !localDefault) {
                    // Estado local tem dados reais e a nuvem tem o padrão. Envia o local para a nuvem.
                    pushToCloud();
                } else if (localDefault && !cloudDefault) {
                    // A nuvem tem dados reais e o local é o padrão. Substitui o local pelo da nuvem.
                    state = cloudState;
                    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(state));
                    renderAll();
                } else {
                    // Se ambos forem padrão ou ambos tiverem dados reais, vence o timestamp mais recente
                    const localTS = state.lastSavedTimestamp || 0;
                    const cloudTS = cloudState.lastSavedTimestamp || 0;
                    
                    if (cloudTS > localTS) {
                        state = cloudState;
                        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(state));
                        renderAll();
                    } else if (localTS > cloudTS) {
                        pushToCloud();
                    }
                }
            } else {
                // Nuvem vazia para este código, envia o estado local atual
                pushToCloud();
            }
            updateSyncStatusBadge("connected");
        } else {
            // Se o Supabase não estiver configurado ou a tabela estiver ausente
            if (resData.error === "SUPABASE_NOT_CONFIGURED" || resData.error === "TABLE_NOT_FOUND") {
                updateSyncStatusBadge("error", resData.message);
            } else {
                throw new Error(resData.error || "Erro desconhecido da API");
            }
        }
    } catch (e) {
        console.error("Falha ao puxar dados da nuvem:", e);
        updateSyncStatusBadge("error", e.message);
    }
}

async function pushToCloud() {
    if (!syncCode) return;
    updateSyncStatusBadge("syncing");
    
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
        } else {
            if (resData.error === "SUPABASE_NOT_CONFIGURED" || resData.error === "TABLE_NOT_FOUND") {
                updateSyncStatusBadge("error", resData.message);
            } else {
                throw new Error(resData.error || "Erro desconhecido da API");
            }
        }
    } catch (e) {
        console.error("Erro ao enviar dados para a nuvem:", e);
        updateSyncStatusBadge("error", e.message);
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

/* ==========================================================================
   NOTIFICAÇÕES PUSH (PWA)
   ========================================================================== */
window.checkNotifications = function() {
    if (!state.settings || !state.settings.notificationsEnabled) return;
    if (!("Notification" in window) || Notification.permission !== "granted") return;

    const now = Date.now();
    const todayStr = getTodayDateString();
    
    // 1. Verifica Água
    if (state.lastWaterTimestamp > 0) {
        const msPassed = now - state.lastWaterTimestamp;
        const intervalMs = state.settings.waterInterval * 60 * 60 * 1000;
        
        if (msPassed >= intervalMs) {
            sendPushNotification("Hora de se hidratar! 💧", {
                body: `Já faz ${state.settings.waterInterval} hora(s) desde o seu último copo d'água.`,
                icon: '/favicon.png',
                tag: 'water-reminder',
                vibrate: [200, 100, 200]
            });
            // Atualiza o timestamp para reiniciar o contador (evitar spam)
            state.lastWaterTimestamp = now;
            saveState();
        }
    }

    // 2. Verifica Tarefas (Apenas para o dia de hoje)
    if (!state.notifiedTasks) state.notifiedTasks = [];
    const tasksToday = state.tasks.filter(t => t.date === todayStr && !t.completed);
    
    const currentHourMin = new Date().getHours() * 60 + new Date().getMinutes();
    
    tasksToday.forEach(task => {
        if (!task.hour) return;
        
        const [h, m] = task.hour.split(':').map(Number);
        if (isNaN(h) || isNaN(m)) return;
        
        const taskMinutes = h * 60 + m;
        const diffMinutes = taskMinutes - currentHourMin;
        
        // Se faltam exatos (ou menos que) o aviso estipulado, e ainda não notificamos
        if (diffMinutes > 0 && diffMinutes <= state.settings.taskWarning) {
            const taskIdWithDate = `${task.id}_${todayStr}`;
            if (!state.notifiedTasks.includes(taskIdWithDate)) {
                sendPushNotification(`Demanda Próxima: ${task.title} ⏳`, {
                    body: `Faltam cerca de ${diffMinutes} minuto(s) para o horário desta demanda.`,
                    icon: '/favicon.png',
                    tag: `task-${task.id}`,
                    vibrate: [100, 50, 100, 50, 200]
                });
                state.notifiedTasks.push(taskIdWithDate);
                saveState();
            }
        }
    });
};

function sendPushNotification(title, options) {
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.ready.then(registration => {
            registration.showNotification(title, options);
        });
    } else {
        new Notification(title, options);
    }
}

/* ==========================================================================
   QUADRO KANBAN DE ANOTAÇÕES (ESTILO TRELLO)
   ========================================================================== */
const KANBAN_COLUMNS = ['dia', 'semana', 'mes', 'lembretes', 'concluidas'];

function renderKanban() {
    if (!state.kanbanNotes) {
        state.kanbanNotes = [];
    }

    KANBAN_COLUMNS.forEach(col => {
        const columnNotes = state.kanbanNotes.filter(note => note.column === col);
        
        // Atualiza o contador da coluna
        const badge = document.getElementById(`badge-${col}`);
        if (badge) {
            badge.textContent = columnNotes.length;
        }

        // Seleciona o container de notas
        const container = document.getElementById(`notes-${col}`);
        if (!container) return;

        container.innerHTML = '';

        columnNotes.forEach(note => {
            const card = document.createElement('div');
            card.className = 'kanban-card';
            card.draggable = true;
            card.dataset.id = note.id;
            
            // Eventos do Drag and Drop no próprio Card
            card.addEventListener('dragstart', drag);
            card.addEventListener('dragend', (e) => {
                e.target.classList.remove('dragging');
            });

            const colIndex = KANBAN_COLUMNS.indexOf(col);
            const leftBtn = colIndex > 0 ? `<button class="kanban-card-btn move-btn" onclick="moveKanbanNoteMobile('${note.id}', -1)" title="Mover para esquerda"><i data-lucide="chevron-left"></i></button>` : '';
            const rightBtn = colIndex < 4 ? `<button class="kanban-card-btn move-btn" onclick="moveKanbanNoteMobile('${note.id}', 1)" title="Mover para direita"><i data-lucide="chevron-right"></i></button>` : '';

            card.innerHTML = `
                <div class="kanban-card-text">${escapeHtml(note.text)}</div>
                <div class="kanban-card-actions">
                    <div class="quick-move-area">
                        ${leftBtn}
                        ${rightBtn}
                    </div>
                    <div style="display: flex; gap: 4px;">
                        <button class="kanban-card-btn" onclick="editKanbanNote('${note.id}')" title="Editar"><i data-lucide="edit-3"></i></button>
                        <button class="kanban-card-btn delete-btn" onclick="deleteKanbanNote('${note.id}')" title="Excluir"><i data-lucide="trash-2"></i></button>
                    </div>
                </div>
            `;
            container.appendChild(card);
        });
    });
}

function showInlineInput(col) {
    const inputArea = document.getElementById(`add-area-${col}`);
    const addBtn = document.getElementById(`btn-add-trigger-${col}`);
    const textarea = document.getElementById(`input-${col}`);
    
    if (inputArea && addBtn) {
        inputArea.style.display = 'block';
        addBtn.style.display = 'none';
        if (textarea) {
            textarea.value = '';
            textarea.focus();
        }
    }
}

function hideInlineInput(col) {
    const inputArea = document.getElementById(`add-area-${col}`);
    const addBtn = document.getElementById(`btn-add-trigger-${col}`);
    const textarea = document.getElementById(`input-${col}`);
    
    if (inputArea && addBtn) {
        inputArea.style.display = 'none';
        addBtn.style.display = 'flex';
        if (textarea) {
            textarea.value = '';
        }
    }
}

function addKanbanNoteFromInput(col) {
    const textarea = document.getElementById(`input-${col}`);
    if (!textarea) return;

    const text = textarea.value.trim();
    if (!text) return;

    const newNote = {
        id: 'k_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
        text: text,
        column: col
    };

    if (!state.kanbanNotes) {
        state.kanbanNotes = [];
    }

    state.kanbanNotes.push(newNote);
    saveState();
    hideInlineInput(col);
    renderKanban();
    lucide.createIcons();
}

function deleteKanbanNote(id) {
    if (confirm("Deseja realmente excluir esta anotação do Kanban?")) {
        state.kanbanNotes = state.kanbanNotes.filter(note => note.id !== id);
        saveState();
        renderKanban();
        lucide.createIcons();
    }
}

function editKanbanNote(id) {
    const note = state.kanbanNotes.find(n => n.id === id);
    if (!note) return;

    const newText = prompt("Editar Anotação:", note.text);
    if (newText === null) return; // cancelado
    
    const trimmed = newText.trim();
    if (!trimmed) {
        deleteKanbanNote(id);
    } else {
        note.text = trimmed;
        saveState();
        renderKanban();
        lucide.createIcons();
    }
}

function moveKanbanNoteMobile(id, colDiff) {
    const note = state.kanbanNotes.find(n => n.id === id);
    if (!note) return;

    const currentIndex = KANBAN_COLUMNS.indexOf(note.column);
    const targetIndex = currentIndex + colDiff;

    if (targetIndex >= 0 && targetIndex < KANBAN_COLUMNS.length) {
        note.column = KANBAN_COLUMNS[targetIndex];
        saveState();
        renderKanban();
        lucide.createIcons();
    }
}

/* Funções de Drag & Drop Nativas */
function drag(ev) {
    ev.dataTransfer.setData("text/plain", ev.target.dataset.id);
    ev.target.classList.add('dragging');
}

// Adiciona compatibilidade dragenter/dragleave para destacar borda do container
function dragEnter(ev) {
    const col = ev.target.closest('.kanban-column');
    if (col) {
        col.classList.add('drag-over');
    }
}

function dragLeave(ev) {
    const col = ev.target.closest('.kanban-column');
    if (col && !col.contains(ev.relatedTarget)) {
        col.classList.remove('drag-over');
    }
}

function allowDrop(ev) {
    ev.preventDefault();
}

function drop(ev) {
    ev.preventDefault();
    const col = ev.target.closest('.kanban-column');
    if (col) {
        col.classList.remove('drag-over');
        const targetCol = col.dataset.column;
        const noteId = ev.dataTransfer.getData("text/plain");
        
        const note = state.kanbanNotes.find(n => n.id === noteId);
        if (note && note.column !== targetCol) {
            note.column = targetCol;
            saveState();
            renderKanban();
            lucide.createIcons();
        }
    }
}

// ==========================================================================
// VIGI SERVERLESS INTEGRATION (MONITORING & GOOGLE DRIVE FILE EXPLORER)
// ==========================================================================
let vigiPollInterval = null;
let currentExplorerPath = "";

function switchMainTab(tab) {
    const btnAgenda = document.getElementById("btn-tab-agenda");
    const btnServers = document.getElementById("btn-tab-servers");
    const btnFiles = document.getElementById("btn-tab-files");
    
    const panelTimeline = document.getElementById("panel-timeline");
    const sideColumn = document.querySelector(".side-column");
    const panelKanban = document.getElementById("panel-kanban");
    const panelServers = document.getElementById("panel-servers");
    const panelFiles = document.getElementById("panel-files");
    
    // Remove active state
    btnAgenda.classList.remove("active");
    btnServers.classList.remove("active");
    btnFiles.classList.remove("active");
    
    // Default hidden
    panelTimeline.style.display = "none";
    if (sideColumn) sideColumn.style.display = "none";
    if (panelKanban) panelKanban.style.display = "none";
    panelServers.style.display = "none";
    panelFiles.style.display = "none";
    
    // Stop polling if leaving servers
    if (vigiPollInterval) {
        clearInterval(vigiPollInterval);
        vigiPollInterval = null;
    }
    
    if (tab === 'agenda') {
        btnAgenda.classList.add("active");
        panelTimeline.style.display = "block";
        if (sideColumn) sideColumn.style.display = "flex";
        if (panelKanban) panelKanban.style.display = "block";
    } 
    else if (tab === 'servers') {
        btnServers.classList.add("active");
        panelServers.style.display = "block";
        loadServersFromSupabase();
        vigiPollInterval = setInterval(loadServersFromSupabase, 10000); // Poll status every 10s
    } 
    else if (tab === 'files') {
        btnFiles.classList.add("active");
        panelFiles.style.display = "block";
        if (!currentExplorerPath) {
            document.getElementById("explorer-files-grid").innerHTML = `
                <div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: var(--text-muted);">
                    <i data-lucide="folder" style="width: 48px; height: 48px; margin-bottom: 12px; opacity: 0.5;"></i>
                    <p style="font-size: 0.95rem;">Nenhum diretório aberto ainda.</p>
                    <p style="font-size: 0.85rem; margin-top: 4px;">Vá na aba de <b>Servidores</b> e clique em um dos discos (C:, D:, etc.) para explorar os arquivos.</p>
                </div>
            `;
            lucide.createIcons();
        } else {
            loadDirectoryExplorer(currentExplorerPath);
        }
    }
    
    lucide.createIcons();
}

async function loadServersFromSupabase() {
    try {
        const response = await fetch("https://hnfhrjgzeivzrcpumkyk.supabase.co/rest/v1/vigi_machines?select=*", {
            headers: {
                'apikey': "sb_publishable_ekOWLdVoQWfk6UANQPiYDg_o6bkYCmX",
                'Authorization': `Bearer sb_publishable_ekOWLdVoQWfk6UANQPiYDg_o6bkYCmX`
            }
        });
        if (!response.ok) throw new Error("Erro ao consultar banco do Supabase");
        
        const rows = await response.json();
        const grid = document.getElementById("vigi-servers-grid");
        
        if (!rows || rows.length === 0) {
            grid.innerHTML = `<p style="color: var(--text-muted); font-size: 0.95rem; padding: 20px;">Nenhum servidor cadastrado no Supabase.</p>`;
            return;
        }
        
        rows.sort((a,b) => a.machine_id.localeCompare(b.machine_id));
        
        let html = "";
        rows.forEach(row => {
            const data = row.hardware_data || {};
            const isOnline = (Date.now() - new Date(row.updated_at).getTime()) < 45000;
            const statusClass = isOnline ? "status-online" : "status-offline";
            const statusLabel = isOnline ? "ONLINE" : "OFFLINE";
            
            const cpuUsage = data.cpuUsage || 0;
            const ramUsage = data.ramUsage || 0;
            const cpuTemp = data.cpuTemp || 0;
            const gpuTemp = data.gpuTemp || 0;
            
            let disksHtml = "";
            if (data.disks && data.disks.length > 0) {
                data.disks.forEach(d => {
                    const usagePct = d.totalGB > 0 ? Math.round((d.usedGB / d.totalGB) * 100) : 0;
                    disksHtml += `
                        <div class="vigi-disk-item" onclick="openExplorerDrive('${row.ip}', '${d.letter}')" title="Clique para navegar nesta partição">
                            <span class="vigi-disk-letter"><i data-lucide="hard-drive" style="width:12px;height:12px;margin-right:2px;"></i> ${d.letter}:</span>
                            <div class="vigi-disk-bar-container">
                                <div class="vigi-disk-bar-fill" style="width: ${usagePct}%;"></div>
                            </div>
                            <span class="vigi-disk-text">${d.usedGB}GB / ${d.totalGB}GB</span>
                        </div>
                    `;
                });
            } else {
                disksHtml = `<span style="font-size:0.75rem;color:var(--text-dimmed);">Nenhum disco detectado</span>`;
            }
            
            let procHtml = "";
            if (data.processes && data.processes.length > 0) {
                const topProcs = data.processes.slice(0, 3);
                topProcs.forEach(p => {
                    procHtml += `<div class="vigi-proc-row"><span>${p.name}</span><span style="font-family:monospace;font-weight:700;color:var(--color-primary);">${p.cpu.toFixed(1)}%</span></div>`;
                });
            } else {
                procHtml = `<div class="vigi-proc-row" style="color:var(--text-dimmed);">Nenhum processo pesado</div>`;
            }
            
            html += `
                <div class="vigi-server-card ${statusClass}">
                    <div class="vigi-card-header">
                        <div class="vigi-card-title">
                            <span class="vigi-status-dot"></span>
                            <h3>${row.machine_id.toUpperCase()}</h3>
                        </div>
                        <span class="vigi-status-badge">${statusLabel}</span>
                    </div>
                    
                    <div class="vigi-card-body">
                        <div class="vigi-spec-text">${data.cpuModel || "Processador Desconhecido"}</div>
                        <div class="vigi-spec-text" style="color:var(--text-dimmed);font-size:0.75rem;margin-bottom:8px;">IP: ${row.ip || "N/A"}</div>
                        
                        <div class="vigi-metric-row">
                            <div class="vigi-metric-label"><span>CPU</span><span>${cpuUsage}%</span></div>
                            <div class="vigi-progress"><div class="vigi-progress-fill" style="width: ${cpuUsage}%;"></div></div>
                        </div>
                        
                        <div class="vigi-metric-row" style="margin-top: 6px;">
                            <div class="vigi-metric-label"><span>Memória RAM</span><span>${ramUsage}% (${data.ramUsedGB || 0}GB / ${data.ramTotalGB || 0}GB)</span></div>
                            <div class="vigi-progress"><div class="vigi-progress-fill" style="width: ${ramUsage}%;"></div></div>
                        </div>
                        
                        <div class="vigi-sensor-grid">
                            <div class="vigi-sensor-box">
                                <span class="vigi-sensor-lbl">TEMP CPU</span>
                                <span class="vigi-sensor-val">${cpuTemp > 0 ? cpuTemp + "°C" : "N/A"}</span>
                            </div>
                            <div class="vigi-sensor-box">
                                <span class="vigi-sensor-lbl">TEMP GPU</span>
                                <span class="vigi-sensor-val">${gpuTemp > 0 ? gpuTemp + "°C" : "N/A"}</span>
                            </div>
                        </div>
                        
                        <div class="vigi-section-title">Partições de Armazenamento</div>
                        <div class="vigi-disks-container">
                            ${disksHtml}
                        </div>
                        
                        <div class="vigi-section-title">Processos Ativos (CPU)</div>
                        <div class="vigi-procs-container">
                            ${procHtml}
                        </div>
                    </div>
                </div>
            `;
        });
        
        grid.innerHTML = html;
        lucide.createIcons();
    } catch(err) {
        console.error("Erro ao carregar servidores do Supabase:", err);
    }
}

function openExplorerDrive(serverIp, diskLetter) {
    playClickSound();
    currentExplorerPath = `\\\\\\\\${serverIp}\\\\${diskLetter}`;
    switchMainTab('files');
}

async function loadDirectoryExplorer(pathStr) {
    const spinner = document.getElementById("explorer-loading-spinner");
    const grid = document.getElementById("explorer-files-grid");
    const breadcrumbs = document.getElementById("vigi-explorer-breadcrumbs");
    
    spinner.style.display = "block";
    grid.innerHTML = "";
    breadcrumbs.textContent = pathStr;
    
    const vigiUrl = localStorage.getItem("FOCOFACIL_VIGI_URL") || "http://localhost:3030";
    const vigiToken = localStorage.getItem("FOCOFACIL_VIGI_TOKEN") || "VIGI-SECURE-TOKEN-123";
    
    try {
        const response = await fetch(`${vigiUrl}/api/explore?path=${encodeURIComponent(pathStr)}`, {
            headers: {
                'Authorization': `Bearer ${vigiToken}`
            }
        });
        
        spinner.style.display = "none";
        
        if (!response.ok) {
            throw new Error(`Servidor respondeu com status ${response.status}`);
        }
        
        const data = await response.json();
        
        if (!data.items || data.items.length === 0) {
            grid.innerHTML = `<p style="color: var(--text-muted); font-size: 0.95rem; padding: 20px; grid-column: 1 / -1; text-align: center;">Este diretório está vazio.</p>`;
            return;
        }
        
        let html = "";
        data.items.forEach(item => {
            const icon = item.isDirectory ? "folder" : "file";
            const clickAction = item.isDirectory 
                ? `loadDirectoryExplorer('${item.path.replace(/\\/g, '\\\\')}')`
                : `downloadFileExplorer('${item.path.replace(/\\/g, '\\\\')}')`;
            
            html += `
                <div class="vigi-file-card" onclick="${clickAction}" title="${item.name}">
                    <div class="vigi-file-icon">
                        <i data-lucide="${icon}"></i>
                    </div>
                    <div class="vigi-file-name">${item.name}</div>
                    <div class="vigi-file-size">${item.isDirectory ? "Pasta" : formatBytes(item.size)}</div>
                </div>
            `;
        });
        
        grid.innerHTML = html;
        lucide.createIcons();
    } catch(err) {
        spinner.style.display = "none";
        grid.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: var(--text-danger);">
                <i data-lucide="alert-circle" style="width: 48px; height: 48px; margin-bottom: 12px;"></i>
                <p style="font-size: 0.95rem; font-weight:600;">Falha de Conexão com o Servidor Vigi</p>
                <p style="font-size: 0.85rem; margin-top: 4px; color: var(--text-muted);">
                    Certifique-se de que o <b>server.js</b> (Central) está rodando localmente na sua máquina e a URL nas configurações está correta.<br>
                    Erro: ${err.message}
                </p>
            </div>
        `;
        lucide.createIcons();
    }
}

function goUpExplorer() {
    playClickSound();
    if (!currentExplorerPath) return;
    const parts = currentExplorerPath.split('\\');
    if (parts.length > 4) { 
        parts.pop(); 
        currentExplorerPath = parts.join('\\');
        loadDirectoryExplorer(currentExplorerPath); 
    } else {
        showToast("Você já está na raiz do disco.", "info");
    }
}

function triggerExplorerUpload() {
    playClickSound();
    if (!currentExplorerPath) {
        showToast("Abra uma pasta antes de enviar um arquivo.", "warning");
        return;
    }
    document.getElementById("explorer-file-upload").click();
}

async function handleExplorerUpload(event) {
    const file = event.target.files[0]; 
    if (!file || !currentExplorerPath) return;
    
    const vigiUrl = localStorage.getItem("FOCOFACIL_VIGI_URL") || "http://localhost:3030";
    const vigiToken = localStorage.getItem("FOCOFACIL_VIGI_TOKEN") || "VIGI-SECURE-TOKEN-123";
    
    const formData = new FormData();
    formData.append('file', file);
    
    showToast(`Enviando arquivo: ${file.name}...`, "info");
    
    try {
        const response = await fetch(`${vigiUrl}/api/upload?path=${encodeURIComponent(currentExplorerPath)}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${vigiToken}`
            },
            body: formData
        });
        
        if (response.ok) {
            showToast(`Arquivo enviado com sucesso!`, "success");
            loadDirectoryExplorer(currentExplorerPath); // Recarrega pasta
        } else {
            const errText = await response.text();
            throw new Error(errText || "Falha no upload");
        }
    } catch(err) {
        showToast(`Erro ao enviar arquivo: ${err.message}`, "error");
    }
}

function downloadFileExplorer(filePath) {
    playClickSound();
    showToast(`Iniciando download...`, 'info');
    
    const vigiUrl = localStorage.getItem("FOCOFACIL_VIGI_URL") || "http://localhost:3030";
    const vigiToken = localStorage.getItem("FOCOFACIL_VIGI_TOKEN") || "VIGI-SECURE-TOKEN-123";
    
    const url = `${vigiUrl}/api/download?path=${encodeURIComponent(filePath)}&token=${vigiToken}`;
    
    const a = document.createElement('a');
    a.href = url;
    a.download = filePath.split('\\').pop();
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Vincula funções ao objeto global window para uso em eventos inline do HTML
window.showInlineInput = showInlineInput;
window.hideInlineInput = hideInlineInput;
window.addKanbanNoteFromInput = addKanbanNoteFromInput;
window.deleteKanbanNote = deleteKanbanNote;
window.editKanbanNote = editKanbanNote;
window.moveKanbanNoteMobile = moveKanbanNoteMobile;
window.drag = drag;
window.allowDrop = allowDrop;
window.dragEnter = dragEnter;
window.dragLeave = dragLeave;
window.drop = drop;
window.switchMainTab = switchMainTab;
window.goUpExplorer = goUpExplorer;
window.triggerExplorerUpload = triggerExplorerUpload;
window.handleExplorerUpload = handleExplorerUpload;
window.openExplorerDrive = openExplorerDrive;
window.downloadFileExplorer = downloadFileExplorer;
