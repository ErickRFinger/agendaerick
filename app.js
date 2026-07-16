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
    getVigiUrl(); // Inicializa a autodescoberta do servidor em background
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
// VIGI SERVERLESS INTEGRATION (MONITORAMENTO DE HARDWARE)
// ==========================================================================
let vigiPollInterval = null;

function switchMainTab(tab) {
    const btnAgenda = document.getElementById("btn-tab-agenda");
    const btnServers = document.getElementById("btn-tab-servers");
    
    const panelTimeline = document.getElementById("panel-timeline");
    const sideColumn = document.querySelector(".side-column");
    const panelKanban = document.getElementById("panel-kanban");
    const panelServers = document.getElementById("panel-servers");
    
    // Remove active state
    if (btnAgenda) btnAgenda.classList.remove("active");
    if (btnServers) btnServers.classList.remove("active");
    
    // Default hidden
    if (panelTimeline) panelTimeline.style.display = "none";
    if (sideColumn) sideColumn.style.display = "none";
    if (panelKanban) panelKanban.style.display = "none";
    if (panelServers) panelServers.style.display = "none";
    
    // Stop polling if leaving servers
    if (vigiPollInterval) {
        clearInterval(vigiPollInterval);
        vigiPollInterval = null;
    }
    
    if (tab === 'agenda') {
        if (btnAgenda) btnAgenda.classList.add("active");
        if (panelTimeline) panelTimeline.style.display = "block";
        if (sideColumn) sideColumn.style.display = "flex";
        if (panelKanban) panelKanban.style.display = "block";
    } 
    else if (tab === 'servers') {
        if (btnServers) btnServers.classList.add("active");
        if (panelServers) panelServers.style.display = "block";
        loadServersFromSupabase();
        vigiPollInterval = setInterval(loadServersFromSupabase, 10000);
    }
    
    lucide.createIcons();
}

function getTempColor(temp) {
    if (temp <= 0) return "var(--text-muted)";
    if (temp >= 80) return "#ef4444";
    if (temp >= 70) return "#f59e0b";
    if (temp >= 55) return "#eab308";
    return "#10b981";
}

function renderCpuThreads(threads, serverId) {
    let cellsHtml = "";
    if (threads && threads.length > 0) {
        threads.forEach((val, idx) => {
            let bg = 'rgba(16, 185, 129, 0.05)';
            let border = 'rgba(16, 185, 129, 0.15)';
            if (val >= 90) {
                bg = 'rgba(239, 68, 68, 0.15)';
                border = 'rgba(239, 68, 68, 0.3)';
            } else if (val >= 70) {
                bg = 'rgba(245, 158, 11, 0.15)';
                border = 'rgba(245, 158, 11, 0.3)';
            }
            cellsHtml += `
                <div class="vigi-thread-cell" style="background: ${bg}; border: 1px solid ${border}; border-radius: 4px; padding: 2px; text-align: center; display: flex; flex-direction: column; align-items: center; justify-content: center; min-width: 32px;" title="Thread T${idx + 1}: ${val.toFixed(0)}%">
                    <span style="font-size: 8px; color: var(--text-dimmed); font-weight: 700; display:block; line-height:1;">T${idx + 1}</span>
                    <span style="font-size: 10px; font-weight: 700; color: var(--color-primary); font-family: monospace; display:block; line-height:1; margin-top:2px;">${val.toFixed(0)}%</span>
                </div>
            `;
        });
    }
    return `<div class="vigi-threads-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(36px, 1fr)); gap: 4px; margin-top: 6px;">${cellsHtml}</div>`;
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
        
                const allowedIds = ['pcerickintel', 'pcerickamd', 'desktop-1v21v3f'];
        const serversList = rows
            .filter(r => r && r.machine_id && allowedIds.includes(r.machine_id.toLowerCase()))
            .map(r => {
                let displayName = r.machine_id.toUpperCase();
                let sortOrder = 99;
                const mId = r.machine_id.toLowerCase();
                if (mId === 'pcerickintel') {
                    displayName = 'PC PRINCIPAL';
                    sortOrder = 1;
                } else if (mId === 'pcerickamd') {
                    displayName = 'PC SECUNDÁRIO';
                    sortOrder = 2;
                } else if (mId === 'desktop-1v21v3f') {
                    displayName = 'SERVIDOR';
                    sortOrder = 3;
                }
                return { ...r, displayName, sortOrder };
            });
            
        serversList.sort((a, b) => a.sortOrder - b.sortOrder);
        
        let html = "";
        serversList.forEach(row => {
            const data = row.hardware_data || {};
            const isOnline = (Date.now() - new Date(row.updated_at).getTime()) < 45000;
            const statusClass = isOnline ? "status-online" : "status-offline";
            const statusLabel = isOnline ? "ONLINE" : "OFFLINE";
            
            const cpuUsage = data.cpuUsage || 0;
            const ramUsage = data.ramUsage || 0;
            const cpuTemp = data.cpuTemp || 0;
            const gpuTemp = data.gpuTemp || 0;
            
            // GPU stats
            const gpuLoad = data.gpuLoad || 0;
            const gpuName = data.gpuName || "N/A";
            const gpuRam = data.gpuRam || "N/A";
            const gpuVramUsedGB = data.gpuVramUsedGB || 0;
            const vramText = gpuVramUsedGB > 0 ? `${parseFloat(gpuVramUsedGB).toFixed(1)} GB / ${gpuRam}` : "0 GB / N/A";
            
            // Network rates
            const rxSpeed = ((data.rxSec || 0) / 1024 / 1024).toFixed(1) + " MB/s";
            const txSpeed = ((data.txSec || 0) / 1024 / 1024).toFixed(1) + " MB/s";
            
            // CPU Details
            const cpuFreq = data.cpuFreqMHz ? `${data.cpuFreqMHz} MHz` : "--";
            const cpuPower = data.cpuPower ? `${parseInt(data.cpuPower)}W` : "0W";
            const vcoreVal = data.vcore ? `${data.vcore.toFixed(3)}V` : "--";
            

            
            let procHtml = "";
            if (data.processes && data.processes.length > 0) {
                const topProcs = data.processes.slice(0, 3);
                topProcs.forEach(p => {
                    procHtml += `<div class="vigi-proc-row"><span>${p.name}</span><span style="font-family:monospace;font-weight:700;color:var(--color-primary);">${p.ramMB} MB</span></div>`;
                });
            } else {
                procHtml = `<div class="vigi-proc-row" style="color:var(--text-dimmed);">Nenhum processo pesado</div>`;
            }
            

            // Botoes e painel de ferramentas e utilidades
            let controlButtons = "";
            if (isOnline) {
                const isMain = row.machine_id === 'pcerickintel'; // i7 e o principal
                const btnMode = isMain ? 'performance' : 'economy';
                const btnLabel = isMain ? '⚡ Máx. Desempenho' : '🌿 Economia + WoL';
                const btnColor = isMain ? 'var(--color-primary)' : '#10b981';
                
                controlButtons = `
                    <div class="vigi-section-title">Controle e Utilidades</div>
                    <div class="vigi-tools-row" style="display:flex; flex-wrap:wrap; gap:6px;">
                        <button type="button" class="btn" style="padding: 4px 8px; font-size: 10px; display:flex; align-items:center; gap:3px;" onclick="openTerminal('${row.ip}')">
                            <i data-lucide="terminal" style="width:10px; height:10px;"></i> Terminal
                        </button>
                        <button type="button" class="btn" style="padding: 4px 8px; font-size: 10px; display:flex; align-items:center; gap:3px;" onclick="cleanDisk('${row.ip}')">
                            <i data-lucide="trash-2" style="width:10px; height:10px;"></i> Limpar Lixo
                        </button>
                        <button type="button" class="btn" style="padding: 4px 8px; font-size: 10px; display:flex; align-items:center; gap:3px; background:${btnColor}; border-color:${btnColor}; color:white;" onclick="optimizeProcesses('${row.ip}', '${btnMode}')">
                            <i data-lucide="sparkles" style="width:10px; height:10px;"></i> ${btnLabel}
                        </button>
                        <button type="button" class="btn" style="padding: 4px 8px; font-size: 10px; display:flex; align-items:center; gap:3px;" id="btn-update-${row.machine_id}" onclick="checkWindowsUpdate('${row.ip}', '${row.machine_id}')">
                            <i data-lucide="refresh-cw" style="width:10px; height:10px;"></i> Updates
                        </button>
                        <div style="display:flex; align-items:center; gap:4px;">
                            <button type="button" class="btn" style="padding: 4px 8px; font-size: 10px; display:flex; align-items:center; gap:3px;" onclick="runSpeedtest('${row.ip}', '${row.machine_id}')">
                                <i data-lucide="rocket" style="width:10px; height:10px;"></i> Speedtest
                            </button>
                            <span id="speed-${row.machine_id}" style="font-family:monospace; font-size:10px; color:var(--text-muted);">--</span>
                        </div>
                    </div>
                    
                    <div class="vigi-section-title">Controle de Energia</div>
                    <div class="vigi-power-row" style="display:flex; gap:6px;">
                        <button type="button" class="btn" style="padding: 4px 10px; font-size: 10px; background:#f59e0b; border-color:#f59e0b; color:white; flex:1;" onclick="sendPowerAction('${row.ip}', 'sleep')">
                            <i data-lucide="moon" style="width:10px; height:10px; display:inline-block; vertical-align:middle; margin-right:2px;"></i> Suspender
                        </button>
                        <button type="button" class="btn" style="padding: 4px 10px; font-size: 10px; background:var(--color-primary); border-color:var(--color-primary); color:white; flex:1;" onclick="sendPowerAction('${row.ip}', 'restart')">
                            <i data-lucide="rotate-ccw" style="width:10px; height:10px; display:inline-block; vertical-align:middle; margin-right:2px;"></i> Reiniciar
                        </button>
                        <button type="button" class="btn btn-danger" style="padding: 4px 10px; font-size: 10px; flex:1;" onclick="sendPowerAction('${row.ip}', 'shutdown')">
                            <i data-lucide="power" style="width:10px; height:10px; display:inline-block; vertical-align:middle; margin-right:2px;"></i> Desligar
                        </button>
                    </div>
                `;
            } else {
                controlButtons = `
                    <div class="vigi-section-title">Ações</div>
                    <button type="button" class="btn" id="btn-wake-${row.machine_id}" style="width:100%; padding:6px 12px; font-size:11px; font-weight:700; background:#10b981; border-color:#10b981; color:white; display:flex; align-items:center; justify-content:center; gap:4px;" onclick="wakeServer('${row.machine_id}')">
                        <i data-lucide="zap" style="width:12px; height:12px;"></i> Ligar PC Remotamente (Wake-on-LAN)
                    </button>
                `;
            }

            let servicesHtml = "";
            if (data.services) {
                let servicesGrid = "";
                Object.keys(data.services).forEach(key => {
                    const statusVal = data.services[key];
                    const statusClass = statusVal ? "status-online" : "status-offline";
                    const statusText = statusVal ? "Ativo" : "Parado";
                    const btnAction = statusVal ? "stop" : "start";
                    const btnLabel = statusVal ? "Parar" : "Iniciar";
                    const btnClass = statusVal ? "btn-danger" : "";
                    
                    servicesGrid += `
                        <div style="display:flex; align-items:center; justify-content:space-between; font-size:11px; padding:4px 8px; background:rgba(255,255,255,0.02); border:1px solid var(--border-color); border-radius:4px; margin-top:3px;">
                            <span style="font-weight:600; display:flex; align-items:center; gap:4px;">
                                <span class="vigi-status-dot ${statusClass}" style="width:6px; height:6px; margin:0;"></span>
                                ${key.toUpperCase()} (${statusText})
                            </span>
                            <button type="button" class="btn ${btnClass}" style="padding:2px 6px; font-size:9px;" onclick="controlService('${row.ip}', '${btnAction}', '${key}')">
                                ${btnLabel}
                            </button>
                        </div>
                    `;
                });
                if (servicesGrid) {
                    servicesHtml = `
                        <div class="vigi-section-title">Serviços Críticos</div>
                        ${servicesGrid}
                    `;
                }
            }

            html += `
                <div class="vigi-server-card ${statusClass}">
                    <div class="vigi-card-header">
                        <div class="vigi-card-title">
                            <span class="vigi-status-dot"></span>
                            <h3>${row.displayName}</h3>
                        </div>
                        <span class="vigi-status-badge">${statusLabel}</span>
                    </div>
                    
                    <div class="vigi-card-body">
                        <!-- PROCESSADOR SECTION -->
                        <div class="vigi-section-header">
                            <i data-lucide="cpu" class="vigi-sec-icon"></i>
                            <span style="flex-grow:1; margin-left:4px;">Processador (CPU)</span>
                            <span class="vigi-sec-val">${cpuUsage}%</span>
                        </div>
                        <div class="vigi-spec-text" style="color:var(--text-muted); font-size:11px; margin-bottom:4px;">${data.cpuModel || "Processador Desconhecido"}</div>
                        
                        <div class="vigi-progress" style="margin-bottom:6px;"><div class="vigi-progress-fill" style="width: ${cpuUsage}%;"></div></div>
                        
                        <!-- CPU Badges -->
                        <div class="vigi-badges-row">
                            <div class="vigi-badge" title="Temperatura CPU">
                                <i data-lucide="thermometer" style="color: ${getTempColor(cpuTemp)}; width:11px; height:11px;"></i>
                                <span class="vigi-badge-val" style="color: ${getTempColor(cpuTemp)};">${cpuTemp > 0 ? cpuTemp + "°C" : "N/A"}</span>
                            </div>
                            <div class="vigi-badge" title="Frequência Clock">
                                <i data-lucide="gauge" style="color: #a78bfa; width:11px; height:11px;"></i>
                                <span class="vigi-badge-val" style="color: #a78bfa;">${cpuFreq}</span>
                            </div>
                            <div class="vigi-badge" title="Consumo CPU">
                                <i data-lucide="zap" style="color: #f59e0b; width:11px; height:11px;"></i>
                                <span class="vigi-badge-val" style="color: #f59e0b;">${cpuPower}</span>
                            </div>
                            ${data.vcore ? `
                            <div class="vigi-badge" title="Tensão Vcore">
                                <i data-lucide="zap-off" style="color: #60a5fa; width:11px; height:11px;"></i>
                                <span class="vigi-badge-val" style="color: #60a5fa;">${vcoreVal}</span>
                            </div>` : ''}
                        </div>
                        
                        <!-- CPU Threads Grid -->
                        ${data.cpuThreads && data.cpuThreads.length > 0 ? `
                        <div class="vigi-section-title">Uso por Threads (${data.cpuThreads.length} núcleos)</div>
                        ${renderCpuThreads(data.cpuThreads, row.machine_id)}
                        ` : ''}

                        <!-- MEMÓRIA RAM SECTION -->
                        <div class="vigi-section-header" style="margin-top: 10px;">
                            <i data-lucide="layers" class="vigi-sec-icon"></i>
                            <span style="flex-grow:1; margin-left:4px;">Memória RAM</span>
                            <span class="vigi-sec-val">${ramUsage}%</span>
                        </div>
                        <div class="vigi-spec-text" style="color:var(--text-muted); font-size:11px; margin-bottom:4px;">
                            Uso: ${data.ramUsedGB || 0} GB / ${data.ramTotalGB || 0} GB
                        </div>
                        <div class="vigi-progress" style="margin-bottom:6px;"><div class="vigi-progress-fill" style="width: ${ramUsage}%;"></div></div>

                        <!-- PLACA DE VÍDEO (GPU) SECTION -->
                        ${gpuName !== "N/A" && gpuName !== "Intel(R) HD Graphics" && gpuName !== "Microsoft Basic Display Adapter" ? `
                        <div class="vigi-section-header" style="margin-top: 10px;">
                            <i data-lucide="monitor" class="vigi-sec-icon"></i>
                            <span style="flex-grow:1; margin-left:4px;">Placa de Vídeo (GPU)</span>
                            <span class="vigi-sec-val">${gpuLoad}%</span>
                        </div>
                        <div class="vigi-spec-text" style="color:var(--text-muted); font-size:11px; margin-bottom:4px;">${gpuName}</div>
                        
                        <div class="vigi-badges-row">
                            <div class="vigi-badge" title="Temperatura GPU">
                                <i data-lucide="thermometer" style="color: ${getTempColor(gpuTemp)}; width:11px; height:11px;"></i>
                                <span class="vigi-badge-val" style="color: ${getTempColor(gpuTemp)};">${gpuTemp > 0 ? gpuTemp + "°C" : "N/A"}</span>
                            </div>
                            <div class="vigi-badge" title="Memória VRAM em uso" style="flex-grow: 1;">
                                <i data-lucide="hard-drive" style="color: #60a5fa; width:11px; height:11px;"></i>
                                <span class="vigi-badge-val" style="color: #60a5fa;">VRAM: ${vramText}</span>
                            </div>
                        </div>
                        ` : ''}

                        <!-- REDE SECTION -->
                        <div class="vigi-section-title">Tráfego de Rede (Velocidade)</div>
                        <div class="vigi-net-row" style="display:flex; justify-content:space-between; font-size:11px; background:rgba(0,0,0,0.15); padding:6px 10px; border-radius:4px; border:1px solid var(--border-color); margin-top:4px;">
                            <span style="color:var(--text-muted); display:flex; align-items:center; gap:4px;"><i data-lucide="arrow-down" style="width:11px; height:11px; color:#10b981;"></i> Down: <b style="color:var(--text-main); font-family:monospace;">${rxSpeed}</b></span>
                            <span style="color:var(--text-muted); display:flex; align-items:center; gap:4px;"><i data-lucide="arrow-up" style="width:11px; height:11px; color:var(--color-primary);"></i> Up: <b style="color:var(--text-main); font-family:monospace;">${txSpeed}</b></span>
                        </div>


                        
                        <!-- PROCESSOS SECTION -->
                        <div class="vigi-section-title">Processos Ativos (RAM)</div>
                        <div class="vigi-procs-container" style="margin-bottom:10px;">
                            ${procHtml}
                        </div>

                        <!-- SERVIÇOS CRÍTICOS -->
                        ${servicesHtml}

                        <!-- CONTROLES REMOTOS -->
                        ${controlButtons}
                    </div>
                </div>
            `;
        });
        
        grid.innerHTML = html;
        lucide.createIcons();
        try {
            updateVigiOverview(rows);
        } catch(e) {
            console.error("Erro ao atualizar overview Vigi:", e);
        }
    } catch(err) {
        console.error("Erro ao carregar servidores do Supabase:", err);
    }
}

// Funções do explorador de arquivos removidas a pedido do usuário (somente monitoramento ativo)

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


// Funções de controle de servidores Vigi
function showToast(message, type = 'info') {
    let container = document.getElementById('vigi-toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'vigi-toast-container';
        container.style.cssText = 'position: fixed; bottom: 20px; right: 20px; z-index: 9999; display: flex; flex-direction: column; gap: 8px; max-width: 320px;';
        document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    let bg = '#3b82f6';
    if (type === 'success') bg = '#10b981';
    if (type === 'warning') bg = '#f59e0b';
    if (type === 'error') bg = '#ef4444';
    
    toast.style.cssText = `background: ${bg}; color: white; padding: 12px 18px; border-radius: 6px; font-size: 0.82rem; font-weight: 600; box-shadow: 0 4px 12px rgba(0,0,0,0.35); display: flex; align-items: center; justify-content: space-between; gap: 10px; transition: all 0.3s; opacity: 0; transform: translateY(20px);`;
    toast.innerHTML = `<span>${message}</span><button style="background:none; border:none; color:white; font-size:0.9rem; cursor:pointer;" onclick="this.parentElement.remove()">×</button>`;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '1';
        toast.style.transform = 'translateY(0)';
    }, 10);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(-20px)';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

let activeVigiUrl = null;
async function getVigiUrl() {
    if (activeVigiUrl) return activeVigiUrl;
    const isHttps = window.location.protocol === 'https:';
    const candidateUrls = [];
    if (isHttps) {
        candidateUrls.push("https://pc-casa-i5.tail2c511b.ts.net");
        candidateUrls.push("https://pc-casa-i7.tail2c511b.ts.net");
        candidateUrls.push("https://pc-casa-r7.tail2c511b.ts.net");
    } else {
        const stored = localStorage.getItem("FOCOFACIL_VIGI_URL");
        if (stored) candidateUrls.push(stored);
        candidateUrls.push("http://localhost:3030");
        candidateUrls.push("http://pc-casa-i5.tail2c511b.ts.net:3030");
        candidateUrls.push("http://pc-casa-i7.tail2c511b.ts.net:3030");
        candidateUrls.push("http://pc-casa-r7.tail2c511b.ts.net:3030");
    }
    
    // Testa as URLs em paralelo com timeout curto
    const testPromises = candidateUrls.map(url => {
        return new Promise((resolve) => {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 1200);
            
            fetch(`${url}/api/sync`, { method: 'HEAD', signal: controller.signal })
                .then(() => {
                    clearTimeout(timeoutId);
                    resolve(url);
                })
                .catch(() => {
                    clearTimeout(timeoutId);
                    resolve(null);
                });
        });
    });
    
    const results = await Promise.all(testPromises);
    const validUrl = results.find(r => r !== null);
    if (validUrl) {
        activeVigiUrl = validUrl;
        console.log(`[VIGI] Servidor Vigi auto-detectado: ${activeVigiUrl}`);
        return activeVigiUrl;
    }
    
    activeVigiUrl = candidateUrls[0] || "http://localhost:3030";
    return activeVigiUrl;
}

function getAuthHeaders() {
    const vigiToken = localStorage.getItem("FOCOFACIL_VIGI_TOKEN") || "VIGI-SECURE-TOKEN-123";
    return {
        'Authorization': `Bearer ${vigiToken}`,
        'Content-Type': 'application/json'
    };
}

async function sendPowerAction(ip, action) {
    const vigiUrl = await getVigiUrl();
    let actionName = action === 'restart' ? 'Reiniciar' : (action === 'shutdown' ? 'Desligar' : 'Suspender');
    if(!confirm(`Tem certeza que deseja ${actionName} o servidor no IP ${ip}?`)) return;
    
    fetch(`${vigiUrl}/api/power`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ ip, action })
    }).then(res => res.json()).then(data => {
        if (data.success) showToast(`Sinal de energia enviado com sucesso.`, 'success');
        else showToast('Erro ao enviar sinal.', 'error');
    }).catch(e => showToast('Falha na comunicação.', 'error'));
}

async function wakeServer(serverId) {
    const vigiUrl = await getVigiUrl();
    const btn = document.getElementById(`btn-wake-${serverId}`);
    let originalHtml = '';
    if (btn) {
        originalHtml = btn.innerHTML;
        btn.innerHTML = `Enviando...`;
        btn.disabled = true;
    }
    showToast('Enviando sinal de ativação (Wake-on-LAN)...', 'info');
    fetch(`${vigiUrl}/api/wake`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ id: serverId })
    })
    .then(res => res.json())
    .then(data => {
        if (btn) {
            btn.innerHTML = originalHtml;
            btn.disabled = false;
        }
        if (data.success) {
            showToast(data.message || 'Sinal Wake-on-LAN enviado com sucesso!', 'success');
        } else {
            showToast(data.error || 'Erro ao enviar sinal.', 'error');
        }
    })
    .catch(e => {
        if (btn) {
            btn.innerHTML = originalHtml;
            btn.disabled = false;
        }
        showToast('Falha na comunicação: ' + e.message, 'error');
    });
}

async function controlService(ip, action, service) {
    const vigiUrl = await getVigiUrl();
    if (!confirm(`Deseja realmente ${action === 'start' ? 'INICIAR' : 'PARAR'} o serviço: ${service.toUpperCase()}?`)) return;
    
    showToast(`${action === 'start' ? 'Iniciando' : 'Parando'} ${service}...`, 'info');
    fetch(`${vigiUrl}/api/service`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ ip, action, service })
    })
    .then(res => res.json())
    .then(d => {
        if (d.success) showToast(`Comando enviado para ${service}!`, 'success');
        else showToast(`Erro ao controlar ${service}.`, 'error');
    })
    .catch(e => showToast('Falha de conexão', 'error'));
}

async function optimizeProcesses(ip, mode = 'performance') {
    const vigiUrl = await getVigiUrl();
    const isPerformance = mode === 'performance';
    const confirmMsg = isPerformance
        ? '⚡ MÁXIMO DESEMPENHO (PC Principal)\n\nIsso vai:\n- Fechar Discord, Spotify, Steam, Epic, launchers e apps em segundo plano\n- Ativar plano de energia Ultimate Performance\n- Aplicar tweaks de CPU/GPU para jogos\n- Manter: Antigravity, Chrome, VSCode, AnyDesk, Tailscale\n\nDeseja continuar?'
        : '🌿 ECONOMIA + WoL (PC Secundário)\n\nIsso vai:\n- Fechar apps GUI pesados e processos desnecessários\n- Ativar plano de energia Economia\n- Manter: serviços de rede (WoL), AnyDesk, Tailscale\n\nDeseja continuar?';
    
    if (!confirm(confirmMsg)) return;
    
    const label = isPerformance ? '⚡ Máximo Desempenho' : '🌿 Economia + WoL';
    showToast(`Iniciando otimização: ${label}...`, 'info');
    
    fetch(`${vigiUrl}/api/optimize-processes`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ ip, mode })
    })
    .then(r => r.json())
    .then(d => {
        if (d.success) {
            const list = d.killed || [];
            const appliedMode = d.mode === 'performance' ? '⚡ Desempenho Máximo' : '🌿 Economia';
            if (list.length > 0) {
                showToast(`${appliedMode}: ${list.length} itens otimizados!`, 'success');
            } else {
                showToast(`${appliedMode}: PC já estava otimizado!`, 'success');
            }
        } else {
            showToast('Erro ao otimizar: ' + (d.error || 'Erro desconhecido'), 'error');
        }
    })
    .catch(e => showToast('Falha de conexão: ' + e.message, 'error'));
}

async function runSpeedtest(ip, id) {
    const vigiUrl = await getVigiUrl();
    const span = document.getElementById(`speed-${id}`);
    if(span) span.innerHTML = '...';
    
    fetch(`${vigiUrl}/api/speedtest`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ ip })
    }).then(r => r.json()).then(d => {
        if(d.success) {
            if(span) span.innerHTML = `${d.mbps} Mbps`;
            showToast(`Download Local no PC (${ip}): ${d.mbps} Mbps`, 'success');
        } else {
            if(span) span.innerHTML = 'Falha';
            showToast('Falha no Speedtest.', 'error');
        }
    }).catch(e => {
        if(span) span.innerHTML = 'Erro';
        showToast('Falha de conexão', 'error');
    });
}

async function cleanDisk(ip) {
    const vigiUrl = await getVigiUrl();
    if(!confirm("Esvaziar a lixeira e apagar todos os arquivos temporários deste PC? Isso liberará gigabytes de espaço silenciosamente.")) return;
    fetch(`${vigiUrl}/api/clean`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ ip })
    }).then(r => r.json()).then(d => {
        if(d.success) showToast('Limpeza de disco concluída!', 'success');
        else showToast('Erro ao limpar disco.', 'error');
    }).catch(e => showToast('Falha de conexão', 'error'));
}

async function checkWindowsUpdate(ip, id) {
    const vigiUrl = await getVigiUrl();
    const btn = document.getElementById(`btn-update-${id}`);
    let originalHtml = '';
    if (btn) {
        originalHtml = btn.innerHTML;
        btn.innerHTML = `...`;
        btn.disabled = true;
    }
    showToast('Buscando atualizações pendentes do Windows...', 'info');
    fetch(`${vigiUrl}/api/check-updates`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ ip })
    })
    .then(r => r.json())
    .then(d => {
        if (btn) {
            btn.innerHTML = originalHtml;
            btn.disabled = false;
        }
        if (d.success) {
            if (d.count > 0) {
                showToast(`Existem ${d.count} atualizações pendentes no Windows!`, 'warning');
            } else {
                showToast('O Windows está totalmente atualizado!', 'success');
            }
        } else {
            showToast('Erro ao verificar atualizações: ' + (d.error || 'Falha desconhecida'), 'error');
        }
    })
    .catch(e => {
        if (btn) {
            btn.innerHTML = originalHtml;
            btn.disabled = false;
        }
        showToast('Falha de conexão', 'error');
    });
}

let currentTerminalIp = null;
function openTerminal(ip) {
    currentTerminalIp = ip;
    document.getElementById('terminal-target').innerText = ip;
    document.getElementById('terminal-modal').style.display = 'flex';
    const out = document.getElementById('terminal-output');
    out.innerHTML = `Conexão estabelecida. CWD: Sistema/Windows.\nAlvo: ${ip}\nDigite seu comando abaixo...\n`;
    setTimeout(() => document.getElementById('terminal-input').focus(), 100);
}

function closeTerminal() {
    document.getElementById('terminal-modal').style.display = 'none';
    currentTerminalIp = null;
    document.getElementById('terminal-input').value = '';
}

async function sendTerminalCommand() {
    const vigiUrl = await getVigiUrl();
    const input = document.getElementById('terminal-input');
    const cmd = input.value.trim();
    if (!cmd || !currentTerminalIp) return;
    
    const out = document.getElementById('terminal-output');
    out.innerHTML += `\n<span style="color: #fff">> ${cmd}</span>\n<span style="color: #aaa" id="term-loading">Executando...</span>`;
    out.scrollTop = out.scrollHeight;
    input.value = '';
    
    fetch(`${vigiUrl}/api/cmd`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ ip: currentTerminalIp, command: cmd })
    }).then(res => res.json()).then(data => {
        const loading = document.getElementById('term-loading');
        if (loading) loading.remove();
        if (data.output) {
            out.innerHTML += data.output + '\n';
        } else {
            out.innerHTML += 'Sem resposta ou erro interno.\n';
        }
        out.scrollTop = out.scrollHeight;
    }).catch(e => {
        const loading = document.getElementById('term-loading');
        if (loading) loading.remove();
        out.innerHTML += `Erro de conexão: ${e.message}\n`;
        out.scrollTop = out.scrollHeight;
    });
}
let lastVigiActiveAlerts = [];

function updateVigiOverview(rows) {
    const dash = document.getElementById('vigi-overview-dashboard');
    if (!dash) return;
    
    const allowedIds = ['pcerickintel', 'pcerickamd', 'desktop-1v21v3f'];
    const servers = rows.filter(r => r && r.machine_id && allowedIds.includes(r.machine_id.toLowerCase()));
    
    if (servers.length > 0) {
        dash.style.display = 'grid';
    } else {
        dash.style.display = 'none';
        return;
    }
    
    let onlineCount = 0;
    let totalCpu = 0;
    let totalRamUsedGB = 0;
    let totalRamGB = 0;
    let totalStorageUsedGB = 0;
    let totalStorageGB = 0;
    let totalPower = 0;
    let activeAlerts = [];
    
    let totalCores = 0;
    let totalThreads = 0;
    let totalRx = 0;
    let totalTx = 0;
    let totalDisksCount = 0;
    let healthyDisksCount = 0;
    
    servers.forEach(row => {
        const isOnline = (Date.now() - new Date(row.updated_at).getTime()) < 45000;
        const data = row.hardware_data || {};
        
        let displayName = row.machine_id ? row.machine_id.toUpperCase() : "MAQUINA";
        const mId = row.machine_id ? row.machine_id.toLowerCase() : "";
        if (mId === 'pcerickintel') {
            displayName = 'PC PRINCIPAL';
        } else if (mId === 'pcerickamd') {
            displayName = 'PC SECUNDÁRIO';
        } else if (mId === 'desktop-1v21v3f') {
            displayName = 'SERVIDOR';
        }
        
        if (isOnline) {
            onlineCount++;
            totalCpu += parseFloat(data.cpuUsage || 0);
            const ramTotal = parseFloat(data.ramTotalGB || 0);
            totalRamUsedGB += (parseFloat(data.ramUsage || 0) / 100) * ramTotal;
            totalRamGB += ramTotal;
            totalPower += parseFloat(data.cpuPower || 0) + parseFloat(data.gpuPower || 0);
            
            totalRx += parseFloat(data.rxSec || 0);
            totalTx += parseFloat(data.txSec || 0);
            
            if (data.cpuThreads && data.cpuThreads.length > 0) {
                totalThreads += data.cpuThreads.length;
                totalCores += Math.round(data.cpuThreads.length / 2);
            }
            
            // Check Alerts
            if (data.cpuUsage > 90) activeAlerts.push(`CPU Crítica em ${displayName} (${data.cpuUsage}%)`);
            if (data.ramUsage > 90) activeAlerts.push(`RAM Crítica em ${displayName} (${data.ramUsage}%)`);
            if (data.cpuTemp >= 80) activeAlerts.push(`Superaquecimento em ${displayName} (${data.cpuTemp}°C)`);
            if (data.gpuTemp >= 85) activeAlerts.push(`Superaquecimento GPU em ${displayName} (${data.gpuTemp}°C)`);
            
            if (data.disks && data.disks.length > 0) {
                data.disks.forEach(d => {
                    totalStorageGB += d.totalGB || 0;
                    totalStorageUsedGB += d.usedGB || 0;
                    const pct = (d.usedGB / d.totalGB) * 100;
                    if (pct > 90) activeAlerts.push(`Espaço Crítico em ${displayName} (Disco ${d.letter}: ${pct.toFixed(0)}%)`);
                });
            }
            if (data.diskHealth && data.diskHealth.length > 0) {
                data.diskHealth.forEach(d => {
                    totalDisksCount++;
                    if (d.HealthStatus === 'Healthy') {
                        healthyDisksCount++;
                    }
                    if (d.HealthStatus !== 'Healthy') activeAlerts.push(`Falha S.M.A.R.T em ${displayName} (${d.FriendlyName})`);
                });
            }
        } else {
            activeAlerts.push(`Servidor ${displayName} está OFFLINE`);
        }
    });
    
    // Toast alerts
    activeAlerts.forEach(alertMsg => {
        if (!lastVigiActiveAlerts.includes(alertMsg)) {
            showToast(alertMsg, 'error');
        }
    });
    lastVigiActiveAlerts = activeAlerts;
    
    const avgCpu = onlineCount > 0 ? (totalCpu / onlineCount).toFixed(1) : 0;
    
    document.getElementById('vigi-overview-servers').innerText = `${onlineCount} / ${servers.length}`;
    
    const formatMBs = (bytes) => (bytes / 1024 / 1024).toFixed(1);
    const serversSubtext = onlineCount > 0
        ? `Rede: ↓ ${formatMBs(totalRx)} MB/s | ↑ ${formatMBs(totalTx)} MB/s`
        : 'Sem tráfego de rede';
    document.getElementById('vigi-overview-servers-sub').innerText = serversSubtext;
    
    document.getElementById('vigi-overview-cpu').innerText = `${avgCpu}%`;
    const cpuSubtext = totalThreads > 0 
        ? `${totalCores} Cores / ${totalThreads} Threads` 
        : 'Processamento total';
    document.getElementById('vigi-overview-cpu-sub').innerText = cpuSubtext;
    
    document.getElementById('vigi-overview-ram').innerText = `${totalRamUsedGB.toFixed(1).replace('.', ',')} GB / ${totalRamGB.toFixed(0)} GB`;
    
    document.getElementById('vigi-overview-power').innerText = `${totalPower.toFixed(0)} W`;
    
    const formatGB = (gb) => {
        if (gb > 1024) return (gb / 1024).toFixed(1) + ' TB';
        return gb.toFixed(0) + ' GB';
    };
    
    const totalStorageFreeGB = totalStorageGB - totalStorageUsedGB;
    document.getElementById('vigi-overview-storage').innerText = `${formatGB(totalStorageUsedGB)} Usado`;
    
    const storageSubtext = totalDisksCount > 0
        ? `${formatGB(totalStorageFreeGB)} Livre / ${formatGB(totalStorageGB)} Total (${healthyDisksCount}/${totalDisksCount} Discos OK)`
        : `${formatGB(totalStorageFreeGB)} Livre / ${formatGB(totalStorageGB)} Total`;
    document.getElementById('vigi-overview-storage-sub').innerText = storageSubtext;
    
    const alertsList = document.getElementById('vigi-alerts-list');
    if (activeAlerts.length > 0) {
        alertsList.innerHTML = activeAlerts.map(a => `<li style="margin-bottom:2px;"><i data-lucide="alert-triangle" style="width:10px; height:10px; color:#ef4444; display:inline-block; vertical-align:middle; margin-right:3px;"></i> ${a}</li>`).join('');
        document.getElementById('vigi-overview-alerts').style.borderColor = 'rgba(239, 68, 68, 0.4)';
    } else {
        alertsList.innerHTML = `<li style="color: var(--text-muted);"><i data-lucide="check-circle" style="color: #10b981; width:10px; height:10px; display:inline-block; vertical-align:middle; margin-right:3px;"></i> Sistemas operando perfeitamente.</li>`;
        document.getElementById('vigi-overview-alerts').style.borderColor = 'var(--border-color)';
    }
    lucide.createIcons();
}


window.showToast = showToast;
window.sendPowerAction = sendPowerAction;
window.wakeServer = wakeServer;
window.controlService = controlService;
window.optimizeProcesses = optimizeProcesses;
window.runSpeedtest = runSpeedtest;
window.cleanDisk = cleanDisk;
window.checkWindowsUpdate = checkWindowsUpdate;
window.openTerminal = openTerminal;
window.closeTerminal = closeTerminal;
window.sendTerminalCommand = sendTerminalCommand;
window.updateVigiOverview = updateVigiOverview;
