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
    events: [],
    notificationsLog: [],
    focusSessions: [],
    accounts: [],
    investments: [],
    transactions: [],
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
let editingEventId = null;
let editingTransactionId = null;

// Agenda Calendar State
let currentAgendaYear = new Date().getFullYear();
let currentAgendaMonth = new Date().getMonth();
let selectedAgendaDate = "";
let activeAgendaCategoryFilter = "all";

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
    events: [
        { id: "e1", title: "Reunião de Alinhamento de Projeto", date: "", time: "10:30", category: "work", warningMinutes: 15, location: "Google Meet", notes: "Apresentar novidades do FocoFácil", completed: false },
        { id: "e2", title: "Consulta Odontológica", date: "", time: "15:00", category: "health", warningMinutes: 30, location: "Clínica Odonto", notes: "Levar exames", completed: false }
    ],
    accounts: [
        { id: "acc_btg", name: "BTG Pactual", color: "#3b82f6", balance: 5000 },
        { id: "acc_inter", name: "Banco Inter", color: "#f97316", balance: 3200 },
        { id: "acc_sicredi", name: "Sicredi", color: "#10b981", balance: 1800 },
        { id: "acc_mp", name: "Mercado Pago", color: "#06b6d4", balance: 1200 }
    ],
    investments: [
        { id: "inv_1", name: "CDI do Inter", category: "Renda Fixa", accountId: "acc_inter", initialAmount: 45000, currentAmount: 45000, lastUpdated: "" }
    ],
    transactions: [
        { id: "tx_1", title: "Rendimento / Projeto Freelance", amount: 2500, type: "income", date: "", category: "Freelance", accountId: "acc_inter", status: "paid" },
        { id: "tx_2", title: "Supermercado Semanal", amount: 480.50, type: "expense", date: "", category: "Alimentação", accountId: "acc_btg", status: "paid" }
    ],
    notificationsLog: [],
    focusSessions: [],
    otherLiquids: [],
    settings: {
        notificationsEnabled: true,
        soundEnabled: true,
        waterInterval: 3,
        taskWarning: 15
    },
    lastWaterTimestamp: 0,
    notifiedTasks: [],
    notifiedEvents: [],
    lastUpdatedDate: "",
    lastSavedTimestamp: 0,
    kanbanNotes: [
        { id: "k1", text: "Organizar as anotações do dia por prioridade.", column: "dia" },
        { id: "k2", text: "Fazer o planejamento das metas semanais.", column: "semana" },
        { id: "k3", text: "Revisar assinaturas mensais e finanças.", column: "mes" },
        { id: "k4", text: "Lembrar de comprar presente de aniversário.", column: "lembretes" }
    ],
    computers: [
        { id: "pc_i7", name: "PC i7", type: "Desktop", ip: "192.168.1.10", mac: "AA:BB:CC:DD:EE:01", alexaCommand: "Alexa, ligar o i7", status: "online" },
        { id: "pc_ryzen", name: "PC Ryzen", type: "Desktop", ip: "192.168.1.11", mac: "AA:BB:CC:DD:EE:02", alexaCommand: "Alexa, ligar o Ryzen", status: "online" },
        { id: "pc_server", name: "Servidor", type: "Servidor", ip: "192.168.1.12", mac: "AA:BB:CC:DD:EE:03", alexaCommand: "Alexa, ligar o Servidor", status: "online" }
    ],
    dailyMood: {},
    pomodoroScratchpad: ""
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
    initPomodoro();

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

    // Verifica a sessão de usuário (Erick / clic3369)
    checkAuthSession();
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
    
    // Associa tarefas e compromissos iniciais ao dia de hoje
    state.tasks.forEach(t => t.date = today);
    if (state.events) state.events.forEach(e => e.date = today);
    state.lastUpdatedDate = today;
    if (!state.otherLiquids) state.otherLiquids = [];
    if (!state.events) state.events = [];
    if (!state.notificationsLog) state.notificationsLog = [];
    if (!state.focusSessions) state.focusSessions = [];
    saveState();
}

function fillMissingStateFields() {
    if (!state.tasks) state.tasks = [];
    if (!state.meds) state.meds = [];
    if (!state.waterHistory) state.waterHistory = {};
    if (!state.waterGoal) state.waterGoal = 2000;
    if (!state.notes) state.notes = [];
    if (!state.events) state.events = [];
    if (!state.notificationsLog) state.notificationsLog = [];
    if (!state.focusSessions) state.focusSessions = [];
    if (!state.otherLiquids) state.otherLiquids = [];
    if (!state.settings) state.settings = { notificationsEnabled: true, soundEnabled: true, waterInterval: 3, taskWarning: 15 };
    if (state.settings.soundEnabled === undefined) state.settings.soundEnabled = true;
    if (!state.lastWaterTimestamp) state.lastWaterTimestamp = 0;
    if (!state.notifiedTasks) state.notifiedTasks = [];
    if (!state.notifiedEvents) state.notifiedEvents = [];
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
    if (state.settings && state.settings.soundEnabled === false) return;
    const freqs = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
    freqs.forEach((freq, idx) => {
        playBeep(freq, 'sine', 0.35, idx * 0.07, 0.12);
    });
}

function playChimeSound() {
    if (state.settings && state.settings.soundEnabled === false) return;
    playBeep(523.25, 'sine', 0.25, 0, 0.15); // C5
    playBeep(659.25, 'sine', 0.35, 0.1, 0.15); // E5
}

function playClickSound() {
    if (state.settings && state.settings.soundEnabled === false) return;
    playBeep(180, 'sine', 0.05, 0, 0.08);
}

/* --- Sintetizador de Som Ambiente Aprimorado para Foco --- */
let ambientAudioNode = null;
let ambientGainNode = null;
let ambientFilterNode = null;
let ambientLfoNode = null;
let currentAmbientType = null;
let ambientMasterVolume = 0.6;

function toggleAmbientSound(type) {
    initAudio();
    if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    if (currentAmbientType === type) {
        stopAmbientSound();
        return;
    }
    stopAmbientSound();
    currentAmbientType = type;
    createAmbientNoise(type);
    updateAmbientCardsUI();
}

function stopAmbientSound() {
    if (ambientLfoNode) {
        try { ambientLfoNode.stop(); } catch(e){}
        try { ambientLfoNode.disconnect(); } catch(e){}
        ambientLfoNode = null;
    }
    if (ambientAudioNode) {
        try { ambientAudioNode.stop(); } catch(e){}
        try { ambientAudioNode.disconnect(); } catch(e){}
        ambientAudioNode = null;
    }
    currentAmbientType = null;
    updateAmbientCardsUI();
}

function createAmbientNoise(type) {
    initAudio();
    if (!audioCtx) return;
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    
    try {
        const bufferSize = 5 * audioCtx.sampleRate;
        const noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
        const output = noiseBuffer.getChannelData(0);
        
        // Algoritmo de Ruído Rosa Aveludado para um som mais natural
        let b0=0, b1=0, b2=0, b3=0, b4=0, b5=0, b6=0;
        for (let i = 0; i < bufferSize; i++) {
            const white = Math.random() * 2 - 1;
            b0 = 0.99886 * b0 + white * 0.0555179;
            b1 = 0.99332 * b1 + white * 0.0750759;
            b2 = 0.96900 * b2 + white * 0.1538520;
            b3 = 0.86650 * b3 + white * 0.3104856;
            b4 = 0.55000 * b4 + white * 0.5329522;
            b5 = -0.7616 * b5 - white * 0.0168980;
            output[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
            b6 = white * 0.115926;
        }

        const noiseSource = audioCtx.createBufferSource();
        noiseSource.buffer = noiseBuffer;
        noiseSource.loop = true;

        ambientGainNode = audioCtx.createGain();
        const baseVol = ambientMasterVolume * 0.45;
        ambientGainNode.gain.setValueAtTime(baseVol, audioCtx.currentTime);

        ambientFilterNode = audioCtx.createBiquadFilter();

        if (type === 'rain') {
            // Chuva Suave: filtro passa-baixas em 1200Hz
            ambientFilterNode.type = 'lowpass';
            ambientFilterNode.frequency.setValueAtTime(1200, audioCtx.currentTime);
            noiseSource.connect(ambientFilterNode);
            ambientFilterNode.connect(ambientGainNode);
        } else if (type === 'waves') {
            // Ondas do Mar: oscilador LFO simulando o movimento da maré
            ambientFilterNode.type = 'lowpass';
            ambientFilterNode.frequency.setValueAtTime(450, audioCtx.currentTime);
            
            ambientLfoNode = audioCtx.createOscillator();
            ambientLfoNode.type = 'sine';
            ambientLfoNode.frequency.value = 0.12; // ciclo de ~8s por onda
            
            const lfoGain = audioCtx.createGain();
            lfoGain.gain.value = 400; // oscila frequência do filtro
            
            ambientLfoNode.connect(lfoGain);
            lfoGain.connect(ambientFilterNode.frequency);
            ambientLfoNode.start();
            
            noiseSource.connect(ambientFilterNode);
            ambientFilterNode.connect(ambientGainNode);
        } else if (type === 'noise') {
            // Ruído Rosa purificado: filtro em 1800Hz
            ambientFilterNode.type = 'lowpass';
            ambientFilterNode.frequency.setValueAtTime(1800, audioCtx.currentTime);
            noiseSource.connect(ambientFilterNode);
            ambientFilterNode.connect(ambientGainNode);
        } else if (type === 'cafe') {
            // Cafeteria: passa-banda em ~650Hz com leve oscilação de volume
            ambientFilterNode.type = 'bandpass';
            ambientFilterNode.frequency.setValueAtTime(650, audioCtx.currentTime);
            ambientFilterNode.Q.value = 0.8;
            
            ambientLfoNode = audioCtx.createOscillator();
            ambientLfoNode.type = 'sine';
            ambientLfoNode.frequency.value = 0.3;
            
            const lfoGain = audioCtx.createGain();
            lfoGain.gain.value = baseVol * 0.25;
            
            ambientLfoNode.connect(lfoGain);
            lfoGain.connect(ambientGainNode.gain);
            ambientLfoNode.start();
            
            noiseSource.connect(ambientFilterNode);
            ambientFilterNode.connect(ambientGainNode);
        }

        ambientGainNode.connect(audioCtx.destination);
        noiseSource.start();
        ambientAudioNode = noiseSource;
    } catch (e) {
        console.error("Erro ao sintetizar som ambiente:", e);
    }
}

function updateAmbientVolume(val) {
    ambientMasterVolume = parseFloat(val);
    if (ambientGainNode && audioCtx) {
        ambientGainNode.gain.setValueAtTime(ambientMasterVolume * 0.45, audioCtx.currentTime);
    }
}

function updateAmbientCardsUI() {
    ['rain', 'waves', 'noise', 'cafe'].forEach(t => {
        const card = document.getElementById(`ambient-${t}`);
        if (card) {
            const badge = card.querySelector('.ambient-badge');
            if (currentAmbientType === t) {
                card.classList.add('active');
                if (badge) badge.textContent = 'Tocando';
            } else {
                card.classList.remove('active');
                if (badge) badge.textContent = 'Desligado';
            }
        }
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
    renderAgendaCalendar();
    renderAgendaEvents();
    renderCalendarStrip();
    renderTimeline();
    renderMeds();
    renderWater();
    renderOtherLiquids();
    renderKanban();
    renderFinancialDashboard();
    updateGeneralProgress();
    renderNotificationPopover();
    updateFocusStats();
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

    // --- Modal da Agenda (Compromissos) ---
    const btnAddEvent = document.getElementById("btn-add-event-trigger");
    if (btnAddEvent) btnAddEvent.addEventListener("click", () => openAddEventModal());
    
    const btnCloseEvent = document.getElementById("btn-close-event-modal");
    if (btnCloseEvent) btnCloseEvent.addEventListener("click", closeAddEventModal);
    
    const btnCancelEvent = document.getElementById("btn-cancel-event");
    if (btnCancelEvent) btnCancelEvent.addEventListener("click", closeAddEventModal);
    
    const formEvent = document.getElementById("form-add-event");
    if (formEvent) {
        formEvent.addEventListener("submit", (e) => {
            e.preventDefault();
            
            const title = document.getElementById("event-title").value.trim();
            const date = document.getElementById("event-date").value;
            const time = document.getElementById("event-time").value;
            const category = document.getElementById("event-category").value;
            const warningMinutes = document.getElementById("event-warning").value;
            const location = document.getElementById("event-location").value.trim();
            const notes = document.getElementById("event-notes").value.trim();
            
            if (!title || !date || !time) return;
            
            const newEvent = {
                id: "e_" + Date.now(),
                title,
                date,
                time,
                category,
                warningMinutes,
                location,
                notes,
                completed: false
            };
            
            if (!state.events) state.events = [];
            state.events.push(newEvent);
            saveState();
            closeAddEventModal();
            selectedAgendaDate = date;
            renderAgendaCalendar();
            renderAgendaEvents();
            playSuccessSound();
        });
    }

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

    // --- Formulários do Módulo Financeiro ---
    const formTx = document.getElementById("form-add-transaction");
    if (formTx) {
        formTx.addEventListener("submit", (e) => {
            e.preventDefault();
            const title = document.getElementById("tx-title").value.trim();
            const amount = parseFloat(document.getElementById("tx-amount").value);
            const type = document.getElementById("tx-type").value;
            const accountId = document.getElementById("tx-account").value;
            const category = document.getElementById("tx-category").value;
            const date = document.getElementById("tx-date").value;
            const status = document.getElementById("tx-status").value;

            if (!title || isNaN(amount) || !date || !accountId) return;

            const newTx = {
                id: "tx_" + Date.now(),
                title,
                amount,
                type,
                accountId,
                category,
                date,
                status
            };

            if (!state.transactions) state.transactions = [];
            state.transactions.push(newTx);

            if (status === 'paid') {
                const acc = state.accounts.find(a => a.id === accountId);
                if (acc) {
                    if (type === 'income') acc.balance += amount;
                    else if (type === 'expense') acc.balance -= amount;
                }
            }

            saveState();
            closeAddTransactionModal();
            renderFinancialDashboard();
            playSuccessSound();
        });
    }

    const formInv = document.getElementById("form-add-investment");
    if (formInv) {
        formInv.addEventListener("submit", (e) => {
            e.preventDefault();
            const name = document.getElementById("inv-name").value.trim();
            const category = document.getElementById("inv-category").value;
            const accountId = document.getElementById("inv-account").value;
            const initialAmount = parseFloat(document.getElementById("inv-initial").value);
            const currentAmount = parseFloat(document.getElementById("inv-current").value);

            if (!name || isNaN(initialAmount) || isNaN(currentAmount)) return;

            const newInv = {
                id: "inv_" + Date.now(),
                name,
                category,
                accountId,
                initialAmount,
                currentAmount,
                lastUpdated: getTodayDateString()
            };

            if (!state.investments) state.investments = [];
            state.investments.push(newInv);
            saveState();
            closeAddInvestmentModal();
            renderFinancialDashboard();
            playSuccessSound();
        });
    }

    const formUpdateInv = document.getElementById("form-update-investment");
    if (formUpdateInv) {
        formUpdateInv.addEventListener("submit", (e) => {
            e.preventDefault();
            const id = document.getElementById("update-inv-id").value;
            const newCurrent = parseFloat(document.getElementById("update-inv-new-val").value);

            if (!id || isNaN(newCurrent)) return;

            const inv = state.investments.find(i => i.id === id);
            if (inv) {
                inv.currentAmount = newCurrent;
                inv.lastUpdated = getTodayDateString();
                saveState();
                closeUpdateInvestmentModal();
                renderFinancialDashboard();
                playSuccessSound();
            }
        });
    }

    const formAcc = document.getElementById("form-add-account");
    if (formAcc) {
        formAcc.addEventListener("submit", (e) => {
            e.preventDefault();
            const name = document.getElementById("acc-name").value.trim();
            const balance = parseFloat(document.getElementById("acc-initial-balance").value) || 0;

            if (!name) return;

            const newAcc = {
                id: "acc_" + Date.now(),
                name,
                color: "#6366f1",
                balance
            };

            if (!state.accounts) state.accounts = [];
            state.accounts.push(newAcc);
            saveState();
            closeAddAccountModal();
            renderFinancialDashboard();
            playSuccessSound();
        });
    }

    const formEditAcc = document.getElementById("form-edit-account");
    if (formEditAcc) {
        formEditAcc.addEventListener("submit", (e) => {
            e.preventDefault();
            const id = document.getElementById("edit-acc-id").value;
            const name = document.getElementById("edit-acc-name").value.trim();
            const newBalance = parseFloat(document.getElementById("edit-acc-balance").value);

            if (!id || !name || isNaN(newBalance)) return;

            const acc = state.accounts.find(a => a.id === id);
            if (acc) {
                acc.name = name;
                acc.balance = newBalance;
                saveState();
                closeEditAccountModal();
                renderFinancialDashboard();
                playSuccessSound();
            }
        });
    }

    // --- Formulário de Cadastro de Computador ---
    const formAddPc = document.getElementById("form-add-pc");
    if (formAddPc) {
        formAddPc.addEventListener("submit", (e) => {
            e.preventDefault();
            const name = document.getElementById("pc-name").value.trim();
            const type = document.getElementById("pc-type").value;
            const ip = document.getElementById("pc-ip").value.trim() || "192.168.1.X";
            const mac = document.getElementById("pc-mac").value.trim() || "00:11:22:33:44:55";
            const alexaCommand = document.getElementById("pc-alexa").value.trim() || `Alexa, ligar o ${name}`;

            if (!name) return;

            const newPc = {
                id: "pc_" + Date.now(),
                name,
                type,
                ip,
                mac,
                alexaCommand,
                status: "online"
            };

            if (!state.computers) state.computers = [];
            state.computers.push(newPc);
            saveState();
            closeAddPcModal();
            renderComputers();
            playSuccessSound();
        });
    }

    // --- Formulário de Login ---
    const formLogin = document.getElementById("form-login");
    if (formLogin) {
        formLogin.addEventListener("submit", (e) => {
            e.preventDefault();
            const username = document.getElementById("login-username").value;
            const password = document.getElementById("login-password").value;
            const remember = document.getElementById("login-remember").checked;
            loginUser(username, password, remember);
        });
    }

    const btnTogglePw = document.getElementById("btn-toggle-login-password");
    if (btnTogglePw) {
        btnTogglePw.addEventListener("click", () => {
            playClickSound();
            const pwInput = document.getElementById("login-password");
            if (pwInput.type === "password") {
                pwInput.type = "text";
                btnTogglePw.innerHTML = `<i data-lucide="eye-off"></i>`;
            } else {
                pwInput.type = "password";
                btnTogglePw.innerHTML = `<i data-lucide="eye"></i>`;
            }
            lucide.createIcons();
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

    const now = Date.now();
    const todayStr = getTodayDateString();
    const currentHourMin = new Date().getHours() * 60 + new Date().getMinutes();
    
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
            state.lastWaterTimestamp = now;
            saveState();
        }
    }

    // 2. Verifica Compromissos da Agenda
    if (!state.notifiedEvents) state.notifiedEvents = [];
    const eventsToday = (state.events || []).filter(e => e.date === todayStr && !e.completed);
    
    eventsToday.forEach(ev => {
        if (!ev.time) return;
        const [h, m] = ev.time.split(':').map(Number);
        if (isNaN(h) || isNaN(m)) return;
        
        const eventMinutes = h * 60 + m;
        const diffMinutes = eventMinutes - currentHourMin;
        const warnMin = parseInt(ev.warningMinutes) || 15;
        
        if (diffMinutes >= 0 && diffMinutes <= warnMin) {
            const evKey = `${ev.id}_${todayStr}_${warnMin}`;
            if (!state.notifiedEvents.includes(evKey)) {
                sendPushNotification(`Compromisso Próximo: ${ev.title} 📅`, {
                    body: diffMinutes === 0 ? "O evento está começando agora!" : `Faltam ${diffMinutes} minuto(s) para este compromisso.`,
                    icon: '/favicon.png',
                    tag: `event-${ev.id}`
                });
                state.notifiedEvents.push(evKey);
                saveState();
            }
        }
    });

    // 3. Verifica Tarefas e Demandas
    if (!state.notifiedTasks) state.notifiedTasks = [];
    const tasksToday = state.tasks.filter(t => t.date === todayStr && !t.completed);
    
    tasksToday.forEach(task => {
        if (!task.hour) return;
        
        const [h, m] = task.hour.split(':').map(Number);
        if (isNaN(h) || isNaN(m)) return;
        
        const taskMinutes = h * 60 + m;
        const diffMinutes = taskMinutes - currentHourMin;
        
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

function sendPushNotification(title, options = {}) {
    // 1. Toca som de notificação (Chime)
    playChimeSound();

    // 2. Registra no histórico de notificações da Central Popover
    if (!state.notificationsLog) state.notificationsLog = [];
    const timeStr = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    state.notificationsLog.push({
        id: Date.now() + "_" + Math.random().toString(36).substr(2, 4),
        title,
        body: options.body || '',
        time: timeStr
    });
    saveState();
    renderNotificationPopover();

    // 3. Dispara notificação push nativa se houver permissão
    if ('Notification' in window && Notification.permission === 'granted') {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.ready.then(registration => {
                registration.showNotification(title, options);
            }).catch(() => {
                try { new Notification(title, options); } catch (e) {}
            });
        } else {
            try { new Notification(title, options); } catch (e) {}
        }
    }
}

/* ==========================================================================
   QUADRO KANBAN DE ANOTAÇÕES (ESTILO TRELLO)
   ========================================================================== */
const KANBAN_COLUMNS = ['dia', 'semana', 'mes', 'lembretes', 'concluidas'];

let currentKanbanQuery = "";
let currentKanbanPriority = "all";

function renderKanban() {
    if (!state.kanbanNotes) {
        state.kanbanNotes = [];
    }

    KANBAN_COLUMNS.forEach(col => {
        let columnNotes = state.kanbanNotes.filter(note => note.column === col);
        
        // Aplica filtro de texto
        if (currentKanbanQuery) {
            columnNotes = columnNotes.filter(note => 
                note.text.toLowerCase().includes(currentKanbanQuery)
            );
        }
        
        // Aplica filtro de prioridade
        if (currentKanbanPriority && currentKanbanPriority !== 'all') {
            columnNotes = columnNotes.filter(note => note.priority === currentKanbanPriority);
        }
        
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

            // Tag de prioridade com cores elegantes
            let prioTag = '';
            if (note.priority === 'high') {
                prioTag = `<span class="kanban-prio-tag" style="background: rgba(239,68,68,0.12); border: 1px solid rgba(239,68,68,0.25); color: #ef4444; font-size: 8.5px; font-weight: 800; padding: 2px 6px; border-radius: 4px; display: inline-flex; align-items: center; gap: 3.5px; width: fit-content; letter-spacing: 0.5px; margin-bottom: 6px;"><span style="width:5px; height:5px; border-radius:50%; background:#ef4444; display:block;"></span>ALTA</span>`;
            } else if (note.priority === 'medium') {
                prioTag = `<span class="kanban-prio-tag" style="background: rgba(245,158,11,0.12); border: 1px solid rgba(245,158,11,0.25); color: #f59e0b; font-size: 8.5px; font-weight: 800; padding: 2px 6px; border-radius: 4px; display: inline-flex; align-items: center; gap: 3.5px; width: fit-content; letter-spacing: 0.5px; margin-bottom: 6px;"><span style="width:5px; height:5px; border-radius:50%; background:#f59e0b; display:block;"></span>MÉDIA</span>`;
            } else if (note.priority === 'low') {
                prioTag = `<span class="kanban-prio-tag" style="background: rgba(16,185,129,0.12); border: 1px solid rgba(16,185,129,0.25); color: #10b981; font-size: 8.5px; font-weight: 800; padding: 2px 6px; border-radius: 4px; display: inline-flex; align-items: center; gap: 3.5px; width: fit-content; letter-spacing: 0.5px; margin-bottom: 6px;"><span style="width:5px; height:5px; border-radius:50%; background:#10b981; display:block;"></span>BAIXA</span>`;
            }

            card.innerHTML = `
                ${prioTag}
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
    const prioritySelect = document.getElementById(`priority-${col}`);
    
    if (inputArea && addBtn) {
        inputArea.style.display = 'block';
        addBtn.style.display = 'none';
        if (textarea) {
            textarea.value = '';
            textarea.focus();
        }
        if (prioritySelect) {
            prioritySelect.value = 'none';
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

    const prioritySelect = document.getElementById(`priority-${col}`);
    const priority = prioritySelect && prioritySelect.value !== 'none' ? prioritySelect.value : null;

    const newNote = {
        id: 'k_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
        text: text,
        column: col,
        priority: priority
    };

    if (!state.kanbanNotes) {
        state.kanbanNotes = [];
    }

    state.kanbanNotes.push(newNote);
    saveState();
    
    if (prioritySelect) {
        prioritySelect.value = 'none';
    }
    
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
        
        // Permite editar a prioridade também
        const currentP = note.priority === 'high' ? '1' : (note.priority === 'medium' ? '2' : (note.priority === 'low' ? '3' : ''));
        const prioOpt = prompt("Defina a prioridade:\n1 - Alta\n2 - Média\n3 - Baixa\nDeixe vazio para Nenhuma", currentP);
        if (prioOpt !== null) {
            const p = prioOpt.trim();
            if (p === '1') note.priority = 'high';
            else if (p === '2') note.priority = 'medium';
            else if (p === '3') note.priority = 'low';
            else note.priority = null;
        }

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
// ABAS DE NAVEGAÇÃO PRINCIPAL (AGENDA, DIÁRIO, FOCO, KANBAN)
// ==========================================================================
function switchMainTab(tab) {
    const btnAgenda = document.getElementById("btn-tab-agenda");
    const btnDiario = document.getElementById("btn-tab-diario");
    const btnFoco = document.getElementById("btn-tab-foco");
    const btnKanban = document.getElementById("btn-tab-kanban");
    const btnFinanceiro = document.getElementById("btn-tab-financeiro");
    const btnPcs = document.getElementById("btn-tab-pcs");
    
    const panelAgenda = document.getElementById("panel-agenda");
    const panelDiario = document.getElementById("panel-diario");
    const panelFoco = document.getElementById("panel-foco");
    const panelKanban = document.getElementById("panel-kanban");
    const panelFinanceiro = document.getElementById("panel-financeiro");
    const panelPcs = document.getElementById("panel-pcs");
    
    // Reset active buttons
    [btnAgenda, btnDiario, btnFoco, btnKanban, btnFinanceiro, btnPcs].forEach(b => b && b.classList.remove("active"));
    
    // Hide panels
    [panelAgenda, panelDiario, panelFoco, panelKanban, panelFinanceiro, panelPcs].forEach(p => p && (p.style.display = "none"));
    
    if (tab === 'agenda') {
        if (btnAgenda) btnAgenda.classList.add("active");
        if (panelAgenda) panelAgenda.style.display = "flex";
        if (!selectedAgendaDate) selectedAgendaDate = getTodayDateString();
        renderAgendaCalendar();
        renderAgendaEvents();
    } else if (tab === 'diario') {
        if (btnDiario) btnDiario.classList.add("active");
        if (panelDiario) panelDiario.style.display = "grid";
        renderMoodTracker();
    } else if (tab === 'foco') {
        if (btnFoco) btnFoco.classList.add("active");
        if (panelFoco) panelFoco.style.display = "flex";
        updateFocusStats();
        loadPomodoroScratchpad();
    } else if (tab === 'kanban') {
        if (btnKanban) btnKanban.classList.add("active");
        if (panelKanban) panelKanban.style.display = "flex";
        renderKanban();
    } else if (tab === 'financeiro') {
        if (btnFinanceiro) btnFinanceiro.classList.add("active");
        if (panelFinanceiro) panelFinanceiro.style.display = "flex";
        renderFinancialDashboard();
    } else if (tab === 'pcs') {
        if (btnPcs) btnPcs.classList.add("active");
        if (panelPcs) panelPcs.style.display = "flex";
        renderComputers();
    }
    
    lucide.createIcons();
}

// ==========================================================================
// MÓDULO DE AGENDA & COMPROMISSOS
// ==========================================================================
function renderAgendaCalendar() {
    const grid = document.getElementById("calendar-month-grid");
    const label = document.getElementById("calendar-month-label");
    if (!grid || !label) return;
    
    const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
    label.textContent = `${monthNames[currentAgendaMonth]} ${currentAgendaYear}`;
    
    grid.innerHTML = "";
    
    const firstDayIndex = new Date(currentAgendaYear, currentAgendaMonth, 1).getDay();
    const totalDays = new Date(currentAgendaYear, currentAgendaMonth + 1, 0).getDate();
    const prevMonthTotalDays = new Date(currentAgendaYear, currentAgendaMonth, 0).getDate();
    
    const todayStr = getTodayDateString();
    if (!selectedAgendaDate) selectedAgendaDate = todayStr;
    
    // Dias do mês anterior
    for (let i = firstDayIndex - 1; i >= 0; i--) {
        const dayNum = prevMonthTotalDays - i;
        const cell = document.createElement("div");
        cell.className = "calendar-day-cell other-month";
        cell.textContent = dayNum;
        grid.appendChild(cell);
    }
    
    // Dias do mês atual
    for (let day = 1; day <= totalDays; day++) {
        const monthStr = String(currentAgendaMonth + 1).padStart(2, '0');
        const dayStr = String(day).padStart(2, '0');
        const fullDateStr = `${currentAgendaYear}-${monthStr}-${dayStr}`;
        
        const cell = document.createElement("div");
        cell.className = "calendar-day-cell";
        cell.textContent = day;
        
        if (fullDateStr === todayStr) cell.classList.add("today");
        if (fullDateStr === selectedAgendaDate) cell.classList.add("selected");
        
        // Verifica se há compromissos para esse dia
        const hasEvents = state.events && state.events.some(e => e.date === fullDateStr);
        if (hasEvents) {
            const dot = document.createElement("div");
            dot.className = "event-dot";
            cell.appendChild(dot);
        }
        
        cell.addEventListener("click", () => selectAgendaDate(fullDateStr));
        grid.appendChild(cell);
    }
}

function navigateMonth(dir) {
    currentAgendaMonth += dir;
    if (currentAgendaMonth < 0) {
        currentAgendaMonth = 11;
        currentAgendaYear--;
    } else if (currentAgendaMonth > 11) {
        currentAgendaMonth = 0;
        currentAgendaYear++;
    }
    renderAgendaCalendar();
}

function selectAgendaDate(dateStr) {
    selectedAgendaDate = dateStr;
    renderAgendaCalendar();
    renderAgendaEvents();
}

function filterAgendaEvents(cat, btn) {
    activeAgendaCategoryFilter = cat;
    document.querySelectorAll(".agenda-filter-btn").forEach(b => b.classList.remove("active"));
    if (btn) btn.classList.add("active");
    renderAgendaEvents();
}

function renderAgendaEvents() {
    const list = document.getElementById("agenda-events-list");
    const titleEl = document.getElementById("selected-agenda-date-title");
    const subtitleEl = document.getElementById("selected-agenda-date-subtitle");
    if (!list) return;
    
    if (!selectedAgendaDate) selectedAgendaDate = getTodayDateString();
    
    const dateObj = parseDateString(selectedAgendaDate);
    const dateFormatted = dateObj.toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
    
    if (titleEl) titleEl.textContent = `Compromissos: ${dateFormatted}`;
    
    const eventsForDate = (state.events || []).filter(e => {
        const matchDate = e.date === selectedAgendaDate;
        const matchCat = activeAgendaCategoryFilter === "all" || e.category === activeAgendaCategoryFilter;
        return matchDate && matchCat;
    });
    
    if (subtitleEl) {
        subtitleEl.textContent = `${eventsForDate.length} compromisso(s) agendado(s)`;
    }
    
    if (eventsForDate.length === 0) {
        list.innerHTML = `
            <div style="text-align:center; padding:32px 16px; color:var(--text-muted); font-size:13px; display:flex; flex-direction:column; align-items:center; gap:8px;">
                <i data-lucide="calendar" style="width:28px; height:28px; opacity:0.4;"></i>
                <p>Nenhum compromisso agendado para esta data.</p>
                <button class="btn btn-secondary-sm" onclick="openAddEventModal('${selectedAgendaDate}')" style="margin-top:4px;">
                    <i data-lucide="plus"></i> Adicionar Compromisso
                </button>
            </div>
        `;
        lucide.createIcons();
        return;
    }
    
    // Ordena compromissos por horário
    eventsForDate.sort((a, b) => a.time.localeCompare(b.time));
    
    const catLabels = { work: '💼 Trabalho', study: '📚 Estudos', health: '🏥 Saúde', personal: '🏠 Pessoal' };
    
    list.innerHTML = eventsForDate.map(ev => `
        <div class="event-card-item ${ev.completed ? 'completed' : ''}">
            <div class="event-left-info">
                <button class="icon-btn" onclick="toggleAgendaEvent('${ev.id}')" title="${ev.completed ? 'Desmarcar' : 'Marcar Concluído'}" style="width:28px; height:28px;">
                    <i data-lucide="${ev.completed ? 'check-circle-2' : 'circle'}" style="color:${ev.completed ? 'var(--color-success)' : 'var(--text-muted)'}"></i>
                </button>
                <div class="event-time-badge">
                    <i data-lucide="clock" style="width:12px; height:12px;"></i> ${ev.time}
                </div>
                <div class="event-details">
                    <span class="event-title">${escapeHtml(ev.title)}</span>
                    <div class="event-meta">
                        <span class="event-category-tag cat-${ev.category}">${catLabels[ev.category] || ev.category}</span>
                        ${ev.location ? `<span><i data-lucide="map-pin" style="width:11px; height:11px;"></i> ${escapeHtml(ev.location)}</span>` : ''}
                        ${ev.notes ? `<span><i data-lucide="align-left" style="width:11px; height:11px;"></i> ${escapeHtml(ev.notes)}</span>` : ''}
                    </div>
                </div>
            </div>
            <div>
                <button class="icon-btn text-danger" onclick="deleteAgendaEvent('${ev.id}')" title="Excluir Compromisso" style="width:28px; height:28px;">
                    <i data-lucide="trash-2" style="width:14px; height:14px;"></i>
                </button>
            </div>
        </div>
    `).join('');
    
    lucide.createIcons();
}

function toggleAgendaEvent(id) {
    const ev = state.events.find(e => e.id === id);
    if (ev) {
        ev.completed = !ev.completed;
        saveState();
        renderAgendaEvents();
        renderAgendaCalendar();
        if (ev.completed) playSuccessSound();
    }
}

function deleteAgendaEvent(id) {
    if (confirm("Deseja realmente remover este compromisso?")) {
        state.events = state.events.filter(e => e.id !== id);
        saveState();
        renderAgendaEvents();
        renderAgendaCalendar();
        playClickSound();
    }
}

// Modal de Compromissos
function openAddEventModal(defaultDateStr) {
    const modal = document.getElementById("modal-event");
    if (!modal) return;
    
    modal.classList.add("active");
    const dateInput = document.getElementById("event-date");
    if (dateInput) {
        dateInput.value = defaultDateStr || selectedAgendaDate || getTodayDateString();
    }
    const titleInput = document.getElementById("event-title");
    if (titleInput) {
        titleInput.value = "";
        titleInput.focus();
    }
    lucide.createIcons();
}

function closeAddEventModal() {
    const modal = document.getElementById("modal-event");
    if (modal) modal.classList.remove("active");
    const form = document.getElementById("form-add-event");
    if (form) form.reset();
}

// ==========================================================================
// CENTRAL DE NOTIFICAÇÕES (POPOVER)
// ==========================================================================
function toggleNotificationPopover() {
    const pop = document.getElementById("notification-popover");
    if (!pop) return;
    const isHidden = pop.style.display === "none" || !pop.style.display;
    pop.style.display = isHidden ? "flex" : "none";
    if (isHidden) {
        renderNotificationPopover();
    }
}

function renderNotificationPopover() {
    const container = document.getElementById("notification-list-popover");
    const badge = document.getElementById("notification-badge");
    if (!container) return;
    
    const logs = state.notificationsLog || [];
    if (badge) {
        if (logs.length > 0) {
            badge.style.display = "flex";
            badge.textContent = logs.length > 9 ? "9+" : logs.length;
        } else {
            badge.style.display = "none";
        }
    }
    
    if (logs.length === 0) {
        container.innerHTML = `<div class="popover-empty">Nenhuma notificação recente.</div>`;
        return;
    }
    
    container.innerHTML = logs.slice().reverse().map(item => `
        <div class="popover-notification-item">
            <span class="popover-notification-title">${escapeHtml(item.title)}</span>
            <span class="popover-notification-body">${escapeHtml(item.body || '')}</span>
            <span class="popover-notification-time">${escapeHtml(item.time || '')}</span>
        </div>
    `).join('');
}

function clearNotificationsLog() {
    state.notificationsLog = [];
    saveState();
    renderNotificationPopover();
}

// ==========================================================================
// LÓGICA DO TEMPORIZADOR DE FOCO (POMODORO) & STATS
// ==========================================================================
let pomodoroTimeLeft = 25 * 60; // 25 minutos padrão
let pomodoroWorkMinutes = 25;
let pomodoroBreakMinutes = 5;
let pomodoroInterval = null;
let pomodoroIsRunning = false;
let pomodoroCyclesToday = 0;
let pomodoroTotalSecondsToday = 0;

function initPomodoro() {
    const todayKey = "FOCOFACIL_POMODORO_CYCLES_" + getTodayDateString();
    const timeKey = "FOCOFACIL_POMODORO_TIME_" + getTodayDateString();
    pomodoroCyclesToday = parseInt(localStorage.getItem(todayKey)) || 0;
    pomodoroTotalSecondsToday = parseInt(localStorage.getItem(timeKey)) || 0;
    updatePomodoroDisplay();
    updateFocusStats();
}

function setPomodoroPreset(workMin, breakMin) {
    if (pomodoroIsRunning) {
        if (!confirm("O timer está em andamento. Deseja reiniciar com o novo preset?")) return;
        resetPomodoro();
    }
    pomodoroWorkMinutes = workMin;
    pomodoroBreakMinutes = breakMin;
    pomodoroTimeLeft = workMin * 60;
    
    document.querySelectorAll(".pomodoro-mode-selector .tab-btn").forEach(b => b.classList.remove("active"));
    const btnMode = document.getElementById(`pomo-mode-${workMin}`);
    if (btnMode) btnMode.classList.add("active");
    
    updatePomodoroDisplay();
    playClickSound();
}

function promptCustomPomodoro() {
    const mins = prompt("Digite a duração do foco em minutos (ex: 45):", "45");
    if (mins) {
        const val = parseInt(mins);
        if (!isNaN(val) && val > 0 && val <= 180) {
            setPomodoroPreset(val, Math.max(5, Math.round(val / 5)));
            document.querySelectorAll(".pomodoro-mode-selector .tab-btn").forEach(b => b.classList.remove("active"));
            const customBtn = document.getElementById("pomo-mode-custom");
            if (customBtn) customBtn.classList.add("active");
        }
    }
}

function updatePomodoroDisplay() {
    const minutes = Math.floor(pomodoroTimeLeft / 60).toString().padStart(2, '0');
    const seconds = (pomodoroTimeLeft % 60).toString().padStart(2, '0');
    const timeEl = document.getElementById("pomodoro-time");
    if (timeEl) timeEl.textContent = `${minutes}:${seconds}`;
}

function updateFocusStats() {
    const cyclesEl = document.getElementById("stat-completed-cycles");
    const totalMinEl = document.getElementById("stat-total-minutes");
    
    if (cyclesEl) cyclesEl.textContent = pomodoroCyclesToday;
    if (totalMinEl) {
        const totalMinutes = Math.round(pomodoroTotalSecondsToday / 60);
        totalMinEl.textContent = `${totalMinutes} min`;
    }
}

function togglePomodoro() {
    const btnToggle = document.getElementById("btn-pomodoro-toggle");
    if (!btnToggle) return;
    
    if (pomodoroIsRunning) {
        // Pausar
        clearInterval(pomodoroInterval);
        pomodoroInterval = null;
        pomodoroIsRunning = false;
        btnToggle.innerHTML = `<i data-lucide="play"></i> <span>Iniciar Foco</span>`;
        playClickSound();
    } else {
        // Iniciar
        pomodoroIsRunning = true;
        btnToggle.innerHTML = `<i data-lucide="pause"></i> <span>Pausar</span>`;
        playClickSound();
        
        pomodoroInterval = setInterval(() => {
            if (pomodoroTimeLeft > 0) {
                pomodoroTimeLeft--;
                pomodoroTotalSecondsToday++;
                const timeKey = "FOCOFACIL_POMODORO_TIME_" + getTodayDateString();
                localStorage.setItem(timeKey, pomodoroTotalSecondsToday);
                updatePomodoroDisplay();
                updateFocusStats();
            } else {
                // Finalizado
                clearInterval(pomodoroInterval);
                pomodoroInterval = null;
                pomodoroIsRunning = false;
                pomodoroTimeLeft = pomodoroWorkMinutes * 60;
                
                const todayKey = "FOCOFACIL_POMODORO_CYCLES_" + getTodayDateString();
                pomodoroCyclesToday++;
                localStorage.setItem(todayKey, pomodoroCyclesToday);
                
                btnToggle.innerHTML = `<i data-lucide="play"></i> <span>Iniciar Foco</span>`;
                updatePomodoroDisplay();
                updateFocusStats();
                
                playSuccessSound();
                sendPushNotification("Ciclo de Foco Concluído! 🎯", {
                    body: `Parabéns! Você focou por ${pomodoroWorkMinutes} minutos. Faça uma pausa de ${pomodoroBreakMinutes} minutos.`,
                    icon: "/favicon.png"
                });
            }
        }, 1000);
    }
    lucide.createIcons();
}

function resetPomodoro() {
    clearInterval(pomodoroInterval);
    pomodoroInterval = null;
    pomodoroIsRunning = false;
    pomodoroTimeLeft = pomodoroWorkMinutes * 60;
    
    const btnToggle = document.getElementById("btn-pomodoro-toggle");
    if (btnToggle) {
        btnToggle.innerHTML = `<i data-lucide="play"></i> <span>Iniciar Foco</span>`;
    }
    
    updatePomodoroDisplay();
    playClickSound();
    lucide.createIcons();
}

// ==========================================================================
// FILTROS DO KANBAN DE ANOTAÇÕES
// ==========================================================================
function filterKanbanNotes() {
    const searchInput = document.getElementById("kanban-search");
    if (searchInput) {
        currentKanbanQuery = searchInput.value.trim().toLowerCase();
    }
    renderKanban();
    lucide.createIcons();
}

function filterKanbanNotesByPriority(prio, btn) {
    currentKanbanPriority = prio;
    
    document.querySelectorAll(".filter-prio-btn").forEach(el => {
        el.classList.remove("active");
    });
    if (btn) btn.classList.add("active");
    
    renderKanban();
    lucide.createIcons();
}

// Vincula funções ao objeto global window para uso em eventos inline do HTML
window.showInlineInput = showInlineInput;
window.hideInlineInput = hideInlineInput;
// ==========================================================================
// MÓDULO FINANCEIRO & INVESTIMENTOS
// ==========================================================================
function formatCurrency(val) {
    const num = parseFloat(val) || 0;
    return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function renderFinancialDashboard() {
    if (!state.accounts) state.accounts = [];
    if (!state.investments) state.investments = [];
    if (!state.transactions) state.transactions = [];

    // 1. Cálculos de Investimentos
    const totalInvested = state.investments.reduce((acc, inv) => acc + (parseFloat(inv.currentAmount) || 0), 0);
    const initialInvested = state.investments.reduce((acc, inv) => acc + (parseFloat(inv.initialAmount) || 0), 0);
    const investmentYield = totalInvested - initialInvested;
    const investmentYieldPct = initialInvested > 0 ? (investmentYield / initialInvested) * 100 : 0;

    // 2. Cálculos de Saldos Bancários
    const totalBankBalance = state.accounts.reduce((acc, a) => acc + (parseFloat(a.balance) || 0), 0);

    // 3. Cálculo de Patrimônio Consolidado
    const netWorth = totalBankBalance + totalInvested;

    // 4. Cálculos Mensais de Transações
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = String(today.getMonth() + 1).padStart(2, '0');
    const currentYearMonth = `${currentYear}-${currentMonth}`;

    const monthTransactions = state.transactions.filter(tx => tx.date && tx.date.startsWith(currentYearMonth));
    const monthIncome = monthTransactions.filter(tx => tx.type === 'income' && tx.status === 'paid')
                                         .reduce((acc, tx) => acc + (parseFloat(tx.amount) || 0), 0);
    const monthExpense = monthTransactions.filter(tx => tx.type === 'expense' && tx.status === 'paid')
                                          .reduce((acc, tx) => acc + (parseFloat(tx.amount) || 0), 0);

    // Atualiza indicadores superiores
    const netWorthEl = document.getElementById("fin-net-worth");
    const bankBalanceEl = document.getElementById("fin-bank-balance");
    const monthIncomeEl = document.getElementById("fin-month-income");
    const monthExpenseEl = document.getElementById("fin-month-expense");
    const totalInvestedEl = document.getElementById("fin-total-invested");
    const investedSubtextEl = document.getElementById("fin-invested-subtext");

    if (netWorthEl) netWorthEl.textContent = formatCurrency(netWorth);
    if (bankBalanceEl) bankBalanceEl.textContent = formatCurrency(totalBankBalance);
    if (monthIncomeEl) monthIncomeEl.textContent = formatCurrency(monthIncome);
    if (monthExpenseEl) monthExpenseEl.textContent = formatCurrency(monthExpense);
    if (totalInvestedEl) totalInvestedEl.textContent = formatCurrency(totalInvested);
    
    if (investedSubtextEl) {
        const prefix = investmentYield >= 0 ? "+" : "";
        investedSubtextEl.textContent = `Rendimento: ${prefix}${formatCurrency(investmentYield)} (${prefix}${investmentYieldPct.toFixed(2)}%)`;
        investedSubtextEl.style.color = investmentYield >= 0 ? "var(--color-success)" : "var(--color-danger)";
    }

    // Renderiza Seção de Bancos
    renderBankAccounts();

    // Renderiza Seção de Investimentos
    renderInvestments();

    // Renderiza Seção de Extrato
    renderTransactions();
}

function renderBankAccounts() {
    const grid = document.getElementById("bank-accounts-grid");
    if (!grid) return;

    if (!state.accounts || state.accounts.length === 0) {
        grid.innerHTML = `<p style="font-size:12px; color:var(--text-muted);">Nenhuma conta cadastrada.</p>`;
        return;
    }

    grid.innerHTML = state.accounts.map(acc => `
        <div class="bank-card" style="--bank-accent-color: ${acc.color || '#3b82f6'};">
            <div class="bank-card-header">
                <span class="bank-name">${escapeHtml(acc.name)}</span>
                <i data-lucide="building-2" style="width:16px; height:16px; color:${acc.color || '#3b82f6'};"></i>
            </div>
            <div class="bank-balance">${formatCurrency(acc.balance)}</div>
            <div class="bank-card-actions">
                <button class="btn-bank-action" onclick="openEditAccountModal('${acc.id}')" title="Editar nome ou saldo do banco">
                    <i data-lucide="edit-2" style="width:12px; height:12px;"></i> Editar Saldo
                </button>
                <button class="btn-bank-action danger" onclick="deleteAccount('${acc.id}')" title="Excluir Banco">
                    <i data-lucide="trash-2" style="width:12px; height:12px;"></i> Excluir
                </button>
            </div>
        </div>
    `).join('');
    
    lucide.createIcons();
}

function renderInvestments() {
    const grid = document.getElementById("investments-grid");
    if (!grid) return;

    if (!state.investments || state.investments.length === 0) {
        grid.innerHTML = `
            <div style="grid-column: span 3; text-align:center; padding:24px; color:var(--text-muted); font-size:13px;">
                <i data-lucide="line-chart" style="width:28px; height:28px; opacity:0.4; margin-bottom:6px;"></i>
                <p>Nenhum investimento cadastrado na carteira.</p>
                <button class="btn btn-secondary-sm" onclick="openAddInvestmentModal()" style="margin-top:8px;">
                    <i data-lucide="plus"></i> Adicionar Investimento
                </button>
            </div>
        `;
        lucide.createIcons();
        return;
    }

    grid.innerHTML = state.investments.map(inv => {
        const initial = parseFloat(inv.initialAmount) || 0;
        const current = parseFloat(inv.currentAmount) || 0;
        const yieldVal = current - initial;
        const yieldPct = initial > 0 ? (yieldVal / initial) * 100 : 0;
        const isPos = yieldVal >= 0;
        const yieldPrefix = isPos ? "+" : "";

        const account = state.accounts.find(a => a.id === inv.accountId);
        const accountName = account ? account.name : "Conta Geral";

        return `
            <div class="investment-card">
                <div class="inv-card-header">
                    <div>
                        <span class="inv-title">${escapeHtml(inv.name)}</span>
                        <div style="font-size:11px; color:var(--text-muted); margin-top:2px;">
                            🏛️ ${escapeHtml(accountName)}
                        </div>
                    </div>
                    <span class="inv-category-badge">${escapeHtml(inv.category || 'Ativo')}</span>
                </div>

                <div class="inv-values-grid">
                    <div class="inv-val-box">
                        <span class="inv-val-label">Valor Aplicado</span>
                        <span class="inv-val-number" style="font-size:0.95rem; color:var(--text-muted);">${formatCurrency(initial)}</span>
                    </div>
                    <div class="inv-val-box">
                        <span class="inv-val-label">Valor Atual</span>
                        <span class="inv-val-number">${formatCurrency(current)}</span>
                    </div>
                </div>

                <div class="inv-yield-row">
                    <span class="yield-badge ${isPos ? 'yield-positive' : 'yield-negative'}">
                        ${yieldPrefix}${formatCurrency(yieldVal)} (${yieldPrefix}${yieldPct.toFixed(2)}%)
                    </span>
                    <div style="display:flex; gap:6px;">
                        <button class="btn-update-inv" onclick="openUpdateInvestmentModal('${inv.id}')" title="Atualizar saldo atual do ativo">
                            <i data-lucide="refresh-cw" style="width:12px; height:12px;"></i> Atualizar
                        </button>
                        <button class="icon-btn text-danger" onclick="deleteInvestment('${inv.id}')" title="Excluir Ativo" style="width:28px; height:28px;">
                            <i data-lucide="trash-2" style="width:14px; height:14px;"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    lucide.createIcons();
}

function renderTransactions() {
    const container = document.getElementById("transactions-list-container");
    const monthFilter = document.getElementById("fin-filter-month");
    const typeFilter = document.getElementById("fin-filter-type");
    const bankFilter = document.getElementById("fin-filter-bank");
    if (!container) return;

    populateFinancialFilters();

    const selectedType = typeFilter ? typeFilter.value : "all";
    const selectedBank = bankFilter ? bankFilter.value : "all";

    const filtered = (state.transactions || []).filter(tx => {
        const matchType = selectedType === "all" || tx.type === selectedType;
        const matchBank = selectedBank === "all" || tx.accountId === selectedBank;
        return matchType && matchBank;
    });

    if (filtered.length === 0) {
        container.innerHTML = `<div style="text-align:center; padding:24px; color:var(--text-muted); font-size:12px;">Nenhum lançamento encontrado para os filtros selecionados.</div>`;
        return;
    }

    filtered.sort((a, b) => b.date.localeCompare(a.date));

    container.innerHTML = filtered.map(tx => {
        const account = state.accounts.find(a => a.id === tx.accountId);
        const bankName = account ? account.name : "Geral";
        const isIncome = tx.type === 'income';
        const sign = isIncome ? "+" : "-";

        return `
            <div class="transaction-row">
                <div class="tx-left">
                    <div class="tx-icon ${isIncome ? 'tx-icon-income' : 'tx-icon-expense'}">
                        <i data-lucide="${isIncome ? 'arrow-up-right' : 'arrow-down-right'}" style="width:18px; height:18px;"></i>
                    </div>
                    <div class="tx-info">
                        <span class="tx-title">${escapeHtml(tx.title)}</span>
                        <div class="tx-meta">
                            <span>🏛️ ${escapeHtml(bankName)}</span>
                            <span>🏷️ ${escapeHtml(tx.category || 'Geral')}</span>
                            <span>📅 ${tx.date}</span>
                        </div>
                    </div>
                </div>

                <div style="display:flex; align-items:center; gap:16px;">
                    <span class="badge-status ${tx.status === 'paid' ? 'badge-paid' : 'badge-pending'}">
                        ${tx.status === 'paid' ? 'Pago' : 'Pendente'}
                    </span>
                    <span class="tx-amount ${isIncome ? 'tx-amount-income' : 'tx-amount-expense'}">
                        ${sign} ${formatCurrency(tx.amount)}
                    </span>
                    <button class="icon-btn text-danger" onclick="deleteTransaction('${tx.id}')" title="Excluir Lançamento" style="width:28px; height:28px;">
                        <i data-lucide="trash-2" style="width:14px; height:14px;"></i>
                    </button>
                </div>
            </div>
        `;
    }).join('');

    lucide.createIcons();
}

function populateFinancialFilters() {
    const bankFilter = document.getElementById("fin-filter-bank");
    if (bankFilter && bankFilter.options.length <= 1) {
        bankFilter.innerHTML = `<option value="all">Todos os Bancos</option>` +
            (state.accounts || []).map(a => `<option value="${a.id}">${escapeHtml(a.name)}</option>`).join('');
    }

    const txAccountSelect = document.getElementById("tx-account");
    if (txAccountSelect) {
        txAccountSelect.innerHTML = (state.accounts || []).map(a => `<option value="${a.id}">${escapeHtml(a.name)}</option>`).join('');
    }

    const invAccountSelect = document.getElementById("inv-account");
    if (invAccountSelect) {
        invAccountSelect.innerHTML = (state.accounts || []).map(a => `<option value="${a.id}">${escapeHtml(a.name)}</option>`).join('');
    }
}

function openAddTransactionModal() {
    populateFinancialFilters();
    const modal = document.getElementById("modal-transaction");
    if (modal) {
        modal.classList.add("active");
        const dateInput = document.getElementById("tx-date");
        if (dateInput) dateInput.value = getTodayDateString();
        const titleInput = document.getElementById("tx-title");
        if (titleInput) {
            titleInput.value = "";
            titleInput.focus();
        }
    }
    lucide.createIcons();
}

function closeAddTransactionModal() {
    const modal = document.getElementById("modal-transaction");
    if (modal) modal.classList.remove("active");
    const form = document.getElementById("form-add-transaction");
    if (form) form.reset();
}

function openAddInvestmentModal() {
    populateFinancialFilters();
    const modal = document.getElementById("modal-investment");
    if (modal) {
        modal.classList.add("active");
        const nameInput = document.getElementById("inv-name");
        if (nameInput) {
            nameInput.value = "";
            nameInput.focus();
        }
    }
    lucide.createIcons();
}

function closeAddInvestmentModal() {
    const modal = document.getElementById("modal-investment");
    if (modal) modal.classList.remove("active");
    const form = document.getElementById("form-add-investment");
    if (form) form.reset();
}

function openUpdateInvestmentModal(invId) {
    const inv = state.investments.find(i => i.id === invId);
    if (!inv) return;

    const modal = document.getElementById("modal-update-investment");
    if (!modal) return;

    modal.classList.add("active");

    const idInput = document.getElementById("update-inv-id");
    const nameLabel = document.getElementById("update-inv-name-label");
    const newValInput = document.getElementById("update-inv-new-val");

    if (idInput) idInput.value = inv.id;
    if (nameLabel) nameLabel.textContent = inv.name;
    if (newValInput) {
        newValInput.value = inv.currentAmount;
        newValInput.focus();
    }
    lucide.createIcons();
}

function closeUpdateInvestmentModal() {
    const modal = document.getElementById("modal-update-investment");
    if (modal) modal.classList.remove("active");
    const form = document.getElementById("form-update-investment");
    if (form) form.reset();
}

function openAddAccountModal() {
    const modal = document.getElementById("modal-account");
    if (modal) {
        modal.classList.add("active");
        const nameInput = document.getElementById("acc-name");
        if (nameInput) {
            nameInput.value = "";
            nameInput.focus();
        }
    }
    lucide.createIcons();
}

function closeAddAccountModal() {
    const modal = document.getElementById("modal-account");
    if (modal) modal.classList.remove("active");
    const form = document.getElementById("form-add-account");
    if (form) form.reset();
}

function openEditAccountModal(accId) {
    const acc = state.accounts.find(a => a.id === accId);
    if (!acc) return;

    const modal = document.getElementById("modal-edit-account");
    if (!modal) return;

    modal.classList.add("active");
    const idInput = document.getElementById("edit-acc-id");
    const nameInput = document.getElementById("edit-acc-name");
    const balanceInput = document.getElementById("edit-acc-balance");

    if (idInput) idInput.value = acc.id;
    if (nameInput) nameInput.value = acc.name;
    if (balanceInput) {
        balanceInput.value = acc.balance;
        balanceInput.focus();
    }
    lucide.createIcons();
}

function closeEditAccountModal() {
    const modal = document.getElementById("modal-edit-account");
    if (modal) modal.classList.remove("active");
    const form = document.getElementById("form-edit-account");
    if (form) form.reset();
}

function deleteAccount(accId) {
    const acc = state.accounts.find(a => a.id === accId);
    if (!acc) return;

    if (confirm(`Deseja realmente excluir a conta "${acc.name}"?`)) {
        state.accounts = state.accounts.filter(a => a.id !== accId);
        saveState();
        renderFinancialDashboard();
        playClickSound();
    }
}

function deleteTransaction(id) {
    if (confirm("Deseja realmente remover este lançamento?")) {
        const tx = state.transactions.find(t => t.id === id);
        if (tx && tx.status === 'paid') {
            const acc = state.accounts.find(a => a.id === tx.accountId);
            if (acc) {
                if (tx.type === 'income') acc.balance -= parseFloat(tx.amount) || 0;
                else if (tx.type === 'expense') acc.balance += parseFloat(tx.amount) || 0;
            }
        }
        state.transactions = state.transactions.filter(t => t.id !== id);
        saveState();
        renderFinancialDashboard();
        playClickSound();
    }
}

function deleteInvestment(id) {
    if (confirm("Deseja realmente remover este investimento da sua carteira?")) {
        state.investments = state.investments.filter(i => i.id !== id);
        saveState();
        renderFinancialDashboard();
        playClickSound();
    }
}

// ==========================================================================
// SISTEMA DE AUTENTICAÇÃO E SESSÃO DE USUÁRIO
// ==========================================================================
const REGISTERED_USERS = [
    { username: "erick", name: "Erick", password: "clic3369" }
];

let currentUser = null;

function checkAuthSession() {
    const savedUserJson = localStorage.getItem("FOCOFACIL_AUTH_USER") || sessionStorage.getItem("FOCOFACIL_AUTH_USER");
    const loginOverlay = document.getElementById("screen-login");
    const appContainer = document.getElementById("app-container");
    const userBadge = document.getElementById("user-profile-badge");
    const userNameEl = document.getElementById("header-user-name");

    if (savedUserJson) {
        try {
            currentUser = JSON.parse(savedUserJson);
            if (loginOverlay) loginOverlay.classList.remove("active");
            if (appContainer) appContainer.style.display = "flex";
            if (userBadge) userBadge.style.display = "flex";
            if (userNameEl) userNameEl.textContent = currentUser.name || currentUser.username;
            renderAll();
        } catch (e) {
            showLoginScreen();
        }
    } else {
        showLoginScreen();
    }
}

function showLoginScreen() {
    const loginOverlay = document.getElementById("screen-login");
    const appContainer = document.getElementById("app-container");
    const userBadge = document.getElementById("user-profile-badge");

    if (loginOverlay) loginOverlay.classList.add("active");
    if (appContainer) appContainer.style.display = "none";
    if (userBadge) userBadge.style.display = "none";
    
    const usernameInput = document.getElementById("login-username");
    if (usernameInput) usernameInput.focus();
}

function loginUser(username, password, rememberMe = true) {
    const cleanUsername = (username || "").trim().toLowerCase();
    const cleanPassword = (password || "").trim();

    const matchedUser = REGISTERED_USERS.find(u => u.username.toLowerCase() === cleanUsername && u.password === cleanPassword);

    const errorAlert = document.getElementById("login-error-msg");
    const loginCard = document.querySelector(".login-card");

    if (matchedUser) {
        currentUser = { username: matchedUser.username, name: matchedUser.name };
        const userJson = JSON.stringify(currentUser);
        
        if (rememberMe) {
            localStorage.setItem("FOCOFACIL_AUTH_USER", userJson);
        } else {
            sessionStorage.setItem("FOCOFACIL_AUTH_USER", userJson);
        }

        if (errorAlert) errorAlert.style.display = "none";
        
        playSuccessSound();
        checkAuthSession();
        triggerConfetti(window.innerWidth / 2, window.innerHeight / 2);
        return true;
    } else {
        if (errorAlert) errorAlert.style.display = "flex";
        if (loginCard) {
            loginCard.classList.remove("shake-anim");
            void loginCard.offsetWidth;
            loginCard.classList.add("shake-anim");
        }
        playBeep(150, 'sawtooth', 0.2, 0, 0.2);
        return false;
    }
}

function logoutUser() {
    playClickSound();
    currentUser = null;
    localStorage.removeItem("FOCOFACIL_AUTH_USER");
    sessionStorage.removeItem("FOCOFACIL_AUTH_USER");
    showLoginScreen();
}

/* ==========================================================================
   MÓDULO 6: CENTRAL DE COMPUTADORES & AUTOMAÇÃO ALEXA
   ========================================================================== */
function renderComputers() {
    const grid = document.getElementById("computers-grid");
    if (!grid) return;

    if (!state.computers || state.computers.length === 0) {
        grid.innerHTML = `<p style="font-size:13px; color:var(--text-muted); grid-column: span 3; text-align:center; padding: 24px;">Nenhum computador ou equipamento cadastrado.</p>`;
        return;
    }

    grid.innerHTML = state.computers.map(pc => `
        <div class="pc-card">
            <div class="pc-card-header">
                <div class="pc-title-area">
                    <div class="pc-icon-box">
                        <i data-lucide="${pc.type === 'Servidor' ? 'server' : (pc.type === 'Notebook' ? 'laptop' : 'monitor')}"></i>
                    </div>
                    <div>
                        <div class="pc-title">${escapeHtml(pc.name)}</div>
                        <span class="pc-type-tag">${escapeHtml(pc.type || 'Desktop')}</span>
                    </div>
                </div>
                <div class="pc-status-badge pc-status-${pc.status || 'online'}">
                    <span style="width:6px; height:6px; border-radius:50%; background:currentColor;"></span>
                    ${(pc.status || 'online').toUpperCase()}
                </div>
            </div>

            <div class="pc-details-box">
                <div class="pc-detail-row">
                    <span>Endereço IP:</span>
                    <strong>${escapeHtml(pc.ip || '192.168.1.X')}</strong>
                </div>
                <div class="pc-detail-row">
                    <span>Endereço MAC:</span>
                    <strong>${escapeHtml(pc.mac || '00:11:22:33:44:55')}</strong>
                </div>
            </div>

            <div class="pc-alexa-command-box">
                <div style="display:flex; align-items:center; gap:6px;">
                    <i data-lucide="mic" style="width:14px; height:14px; color:#06b6d4;"></i>
                    <span class="alexa-command-text">"${escapeHtml(pc.alexaCommand || 'Alexa, ligar o PC')}"</span>
                </div>
                <button class="btn-bank-action" onclick="copyAlexaCommand('${escapeHtml(pc.alexaCommand || '')}')" title="Copiar comando de voz">
                    <i data-lucide="copy" style="width:12px; height:12px;"></i> Copiar
                </button>
            </div>

            <div style="display:flex; flex-direction:column; gap:8px;">
                <button class="btn-alexa-trigger" onclick="triggerAlexaCommand('${pc.id}')">
                    <i data-lucide="zap"></i> <span>⚡ ${escapeHtml(pc.alexaCommand || 'Ligar na Alexa')}</span>
                </button>
                <div style="display:flex; gap:8px;">
                    <button class="btn-wol-trigger" style="flex:1;" onclick="sendWakeOnLan('${pc.id}')" title="Enviar pacote Wake-on-LAN">
                        <i data-lucide="wifi"></i> <span>Enviar WoL</span>
                    </button>
                    <button class="btn-bank-action danger" onclick="deleteComputer('${pc.id}')" title="Excluir equipamento">
                        <i data-lucide="trash-2" style="width:12px; height:12px;"></i>
                    </button>
                </div>
            </div>
        </div>
    `).join('');

    lucide.createIcons();
}

function triggerAlexaCommand(pcId) {
    const pc = state.computers ? state.computers.find(p => p.id === pcId) : null;
    const cmd = pc ? pc.alexaCommand : "Alexa, ligar o computador";

    playSuccessSound();
    triggerConfetti(window.innerWidth / 2, window.innerHeight / 2);

    copyAlexaCommand(cmd);

    alert(`⚡ Comando Alexa Disparado com Sucesso!\n\nFrase: "${cmd}"\n\nA frase foi copiada para a sua área de transferência e o acionamento foi direcionado para a rotina do App Alexa.`);
}

function copyAlexaCommand(text) {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
        playClickSound();
    }).catch(() => {});
}

function sendWakeOnLan(pcId) {
    const pc = state.computers ? state.computers.find(p => p.id === pcId) : null;
    if (!pc) return;

    playSuccessSound();
    alert(`📡 Pacote Mágico Wake-on-LAN (WoL) enviado com sucesso para ${pc.name}!\n\nIP Local: ${pc.ip || '192.168.1.10'}\nMAC Address: ${pc.mac || '00:11:22:33:44:55'}`);
}

function openAddPcModal() {
    const modal = document.getElementById("modal-pc");
    if (modal) {
        modal.classList.add("active");
        const nameInput = document.getElementById("pc-name");
        if (nameInput) {
            nameInput.value = "";
            nameInput.focus();
        }
    }
    lucide.createIcons();
}

function closeAddPcModal() {
    const modal = document.getElementById("modal-pc");
    if (modal) modal.classList.remove("active");
    const form = document.getElementById("form-add-pc");
    if (form) form.reset();
}

function deleteComputer(pcId) {
    const pc = state.computers ? state.computers.find(p => p.id === pcId) : null;
    if (!pc) return;

    if (confirm(`Deseja realmente remover o equipamento "${pc.name}"?`)) {
        state.computers = state.computers.filter(p => p.id !== pcId);
        saveState();
        renderComputers();
        playClickSound();
    }
}

/* ==========================================================================
   FUNÇÕES ADICIONAIS DE EXPORTAÇÃO, MOOD TRACKER E SCRATCHPAD
   ========================================================================== */
function exportAgendaICS() {
    if (!state.events || state.events.length === 0) {
        alert("Nenhum compromisso cadastrado para exportar!");
        return;
    }

    let icsContent = "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//FocoFacil Agenda//PT-BR\r\n";

    state.events.forEach(evt => {
        const dateStr = (evt.date || getTodayDateString()).replace(/-/g, '');
        const timeStr = (evt.time || "09:00").replace(':', '') + "00";
        const dtStamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

        icsContent += "BEGIN:VEVENT\r\n";
        icsContent += `SUMMARY:${evt.title}\r\n`;
        icsContent += `DTSTART:${dateStr}T${timeStr}\r\n`;
        icsContent += `DESCRIPTION:${evt.notes || evt.category || ''}\r\n`;
        if (evt.location) icsContent += `LOCATION:${evt.location}\r\n`;
        icsContent += `DTSTAMP:${dtStamp}\r\n`;
        icsContent += `UID:event_${evt.id}@focofacil\r\n`;
        icsContent += "END:VEVENT\r\n";
    });

    icsContent += "END:VCALENDAR\r\n";

    const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `focofacil_agenda_${getTodayDateString()}.ics`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    playSuccessSound();
}

function exportKanbanBackup() {
    if (!state.kanbanNotes || state.kanbanNotes.length === 0) {
        alert("Nenhuma anotação no Kanban para exportar!");
        return;
    }

    const jsonStr = JSON.stringify(state.kanbanNotes, null, 2);
    const blob = new Blob([jsonStr], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `focofacil_kanban_backup_${getTodayDateString()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    playSuccessSound();
}

function setDailyMood(moodKey, moodLabel) {
    if (!state.dailyMood) state.dailyMood = {};
    state.dailyMood[selectedDate || getTodayDateString()] = { key: moodKey, label: moodLabel };
    saveState();
    renderMoodTracker();
    playClickSound();
}

function renderMoodTracker() {
    const moodObj = state.dailyMood ? state.dailyMood[selectedDate || getTodayDateString()] : null;
    const labelEl = document.getElementById("current-mood-label");
    if (labelEl) {
        labelEl.textContent = moodObj ? moodObj.label : "Não registrado";
    }

    document.querySelectorAll(".btn-mood").forEach(btn => {
        btn.classList.remove("active");
        if (moodObj && btn.getAttribute("onclick").includes(`'${moodObj.key}'`)) {
            btn.classList.add("active");
        }
    });
}

function savePomodoroScratchpad() {
    const textarea = document.getElementById("pomodoro-scratchpad");
    if (textarea) {
        state.pomodoroScratchpad = textarea.value;
        saveState();
    }
}

function loadPomodoroScratchpad() {
    const textarea = document.getElementById("pomodoro-scratchpad");
    if (textarea && state.pomodoroScratchpad !== undefined) {
        textarea.value = state.pomodoroScratchpad || "";
    }
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
window.navigateMonth = navigateMonth;
window.selectAgendaDate = selectAgendaDate;
window.filterAgendaEvents = filterAgendaEvents;
window.toggleAgendaEvent = toggleAgendaEvent;
window.deleteAgendaEvent = deleteAgendaEvent;
window.openAddEventModal = openAddEventModal;
window.closeAddEventModal = closeAddEventModal;
window.toggleNotificationPopover = toggleNotificationPopover;
window.clearNotificationsLog = clearNotificationsLog;
window.toggleAmbientSound = toggleAmbientSound;
window.updateAmbientVolume = updateAmbientVolume;
window.setPomodoroPreset = setPomodoroPreset;
window.promptCustomPomodoro = promptCustomPomodoro;
window.togglePomodoro = togglePomodoro;
window.resetPomodoro = resetPomodoro;
window.filterKanbanNotes = filterKanbanNotes;
window.filterKanbanNotesByPriority = filterKanbanNotesByPriority;
window.initPomodoro = initPomodoro;
window.openAddTransactionModal = openAddTransactionModal;
window.closeAddTransactionModal = closeAddTransactionModal;
window.openAddInvestmentModal = openAddInvestmentModal;
window.closeAddInvestmentModal = closeAddInvestmentModal;
window.openUpdateInvestmentModal = openUpdateInvestmentModal;
window.closeUpdateInvestmentModal = closeUpdateInvestmentModal;
window.openAddAccountModal = openAddAccountModal;
window.closeAddAccountModal = closeAddAccountModal;
window.openEditAccountModal = openEditAccountModal;
window.closeEditAccountModal = closeEditAccountModal;
window.deleteAccount = deleteAccount;
window.deleteTransaction = deleteTransaction;
window.deleteInvestment = deleteInvestment;
window.renderFinancialDashboard = renderFinancialDashboard;
window.loginUser = loginUser;
window.logoutUser = logoutUser;
window.checkAuthSession = checkAuthSession;
window.renderComputers = renderComputers;
window.triggerAlexaCommand = triggerAlexaCommand;
window.copyAlexaCommand = copyAlexaCommand;
window.sendWakeOnLan = sendWakeOnLan;
window.openAddPcModal = openAddPcModal;
window.closeAddPcModal = closeAddPcModal;
window.deleteComputer = deleteComputer;
window.exportAgendaICS = exportAgendaICS;
window.exportKanbanBackup = exportKanbanBackup;
window.setDailyMood = setDailyMood;
window.renderMoodTracker = renderMoodTracker;
window.savePomodoroScratchpad = savePomodoroScratchpad;