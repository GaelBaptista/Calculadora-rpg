// ==========================================================================
// STATE MANAGEMENT & CONFIG
// ==========================================================================
const state = {
    partySize: 4,
    partyLevel: 1,
    playerExp: 'standard',
    partyComp: 'balanced',
    environmentFactor: 'neutral',
    dailyPacing: 'standard',
    threats: [],
    xpTab: 'individual',
    lastEncounterNd: 0,
    soundMuted: true
};

// ND to float mapping
const ND_MAP = {
    '1/10': 0.1,
    '1/8': 0.125,
    '1/6': 1/6,
    '1/4': 0.25,
    '1/2': 0.5,
    '1': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10,
    '11': 11, '12': 12, '13': 13, '14': 14, '15': 15, '16': 16, '17': 17, '18': 18, '19': 19, '20': 20
};

// Reverse map for formatting
function formatND(val) {
    if (val <= 0) return '0';
    if (Math.abs(val - 0.1) < 0.01) return '1/10';
    if (Math.abs(val - 0.125) < 0.01) return '1/8';
    if (Math.abs(val - (1/6)) < 0.01) return '1/6';
    if (Math.abs(val - 0.25) < 0.01) return '1/4';
    if (Math.abs(val - 0.5) < 0.01) return '1/2';
    
    // Check if it has a decimal part
    const intPart = Math.floor(val);
    const fracPart = val - intPart;
    
    if (fracPart === 0) return intPart.toString();
    if (Math.abs(fracPart - 0.25) < 0.05) return `${intPart} 1/4`;
    if (Math.abs(fracPart - 0.5) < 0.05) return `${intPart} 1/2`;
    if (Math.abs(fracPart - 0.75) < 0.05) return `${intPart} 3/4`;
    
    return val.toFixed(2);
}

// ==========================================================================
// BACKGROUND MUSIC — YouTube + fallback sintetizado
// https://youtu.be/4PE4veOkRog
// ==========================================================================
const YOUTUBE_VIDEO_ID = '4PE4veOkRog';
let musicSource = null; // 'youtube' | 'synth' | null
let synthIntervalId = null;
let synthNextNoteTime = 0;
let synthStep = 0;
const SYNTH_TEMPO = 110;
const SYNTH_LOOKAHEAD = 25;
let audioCtx = null;

function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
}

function getYouTubeEmbedUrl(autoplay) {
    const params = new URLSearchParams({
        autoplay: autoplay ? '1' : '0',
        loop: '1',
        playlist: YOUTUBE_VIDEO_ID,
        controls: '0',
        playsinline: '1',
        modestbranding: '1',
        rel: '0',
        iv_load_policy: '3',
        fs: '0',
        mute: '0'
    });
    return `https://www.youtube.com/embed/${YOUTUBE_VIDEO_ID}?${params.toString()}`;
}

function canUseYouTubeEmbed() {
    return window.location.protocol === 'http:' || window.location.protocol === 'https:';
}

function showMusicToast(message) {
    const toast = document.getElementById('music-toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.remove('hidden');
    clearTimeout(showMusicToast._timer);
    showMusicToast._timer = setTimeout(() => toast.classList.add('hidden'), 5000);
}

function scheduleSynthNote(step, time) {
    if (step === 0 || step === 4 || step === 8 || step === 12) {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(140, time);
        osc.frequency.exponentialRampToValueAtTime(35, time + 0.15);
        gain.gain.setValueAtTime(0.35, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.18);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(time);
        osc.stop(time + 0.2);
    }

    if (step % 2 === 0) {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        const filter = audioCtx.createBiquadFilter();
        osc.type = 'sawtooth';
        let freq = 73.4;
        if (step >= 4 && step <= 7) freq = 87.3;
        if (step >= 8 && step <= 11) freq = 98.0;
        if (step >= 12) freq = 55.0;
        osc.frequency.setValueAtTime(freq, time);
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(250, time);
        gain.gain.setValueAtTime(0.14, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.22);
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(time);
        osc.stop(time + 0.25);
    }
}

function runSynthScheduler() {
    const scheduleAhead = 0.1;
    while (synthNextNoteTime < audioCtx.currentTime + scheduleAhead) {
        scheduleSynthNote(synthStep, synthNextNoteTime);
        const secondsPerBeat = 60.0 / SYNTH_TEMPO;
        synthNextNoteTime += 0.25 * secondsPerBeat;
        synthStep = (synthStep + 1) % 16;
    }
}

function startSynthMusic() {
    initAudio();
    synthNextNoteTime = audioCtx.currentTime;
    synthStep = 0;
    if (!synthIntervalId) {
        synthIntervalId = setInterval(runSynthScheduler, SYNTH_LOOKAHEAD);
    }
    musicSource = 'synth';
}

function stopSynthMusic() {
    if (synthIntervalId) {
        clearInterval(synthIntervalId);
        synthIntervalId = null;
    }
}

function startYouTubeMusic() {
    const iframe = document.getElementById('youtube-music-iframe');
    if (!iframe) return false;

    iframe.src = getYouTubeEmbedUrl(true);
    musicSource = 'youtube';
    return true;
}

function stopYouTubeMusic() {
    const iframe = document.getElementById('youtube-music-iframe');
    if (iframe) {
        iframe.src = 'about:blank';
    }
}

function startMusic() {
    initAudio();

    if (canUseYouTubeEmbed()) {
        startYouTubeMusic();
        showMusicToast('Trilha do YouTube iniciada.');
        return;
    }

    startSynthMusic();
    showMusicToast('Arquivo local: trilha ambiente ativa. Para o YouTube, abra via servidor (ex: npx serve).');
}

function stopMusic() {
    if (musicSource === 'youtube') {
        stopYouTubeMusic();
    } else if (musicSource === 'synth') {
        stopSynthMusic();
    }
    musicSource = null;
}

function updateMusicButtonUI() {
    const btn = document.getElementById('toggle-sound');
    const txt = document.getElementById('music-status-txt');
    if (!btn || !txt) return;

    if (state.soundMuted) {
        btn.classList.remove('playing');
        txt.textContent = 'Música';
        btn.setAttribute('aria-pressed', 'false');
    } else {
        btn.classList.add('playing');
        txt.textContent = musicSource === 'youtube' ? 'YouTube' : 'Ambiente';
        btn.setAttribute('aria-pressed', 'true');
    }
}

document.getElementById('toggle-sound').addEventListener('click', () => {
    state.soundMuted = !state.soundMuted;
    localStorage.setItem('t20_sound_muted', state.soundMuted);

    if (state.soundMuted) {
        stopMusic();
    } else {
        startMusic();
    }

    updateMusicButtonUI();
});

state.soundMuted = localStorage.getItem('t20_sound_muted') !== 'false';
updateMusicButtonUI();

function playSlashSound() {
    if (state.soundMuted) return;
    initAudio();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    
    const now = audioCtx.currentTime;
    const bufferSize = audioCtx.sampleRate * 0.1; // 100ms
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
    }
    
    const noise = audioCtx.createBufferSource();
    noise.buffer = buffer;
    
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(800, now);
    filter.frequency.exponentialRampToValueAtTime(100, now + 0.1);
    
    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(audioCtx.destination);
    
    noise.start(now);
    noise.stop(now + 0.1);
}

// ==========================================================================
// BACKGROUND PARTICLES EFFECT
// ==========================================================================
function initParticles() {
    const container = document.getElementById('particles-container');
    const particleCount = 20;
    
    for (let i = 0; i < particleCount; i++) {
        createParticle(container);
    }
}

function createParticle(container) {
    const particle = document.createElement('div');
    particle.className = 'particle';
    
    const size = Math.random() * 3 + 2;
    particle.style.width = `${size}px`;
    particle.style.height = `${size}px`;
    particle.style.left = `${Math.random() * 100}vw`;
    
    const delay = Math.random() * 10;
    const duration = Math.random() * 10 + 6;
    particle.style.animationDelay = `-${delay}s`;
    particle.style.animationDuration = `${duration}s`;
    
    const colorType = Math.random();
    if (colorType < 0.6) {
        particle.style.backgroundColor = 'var(--crimson)';
        particle.style.boxShadow = '0 0 6px var(--crimson-glow)';
    } else if (colorType < 0.85) {
        particle.style.backgroundColor = 'var(--antique-gold)';
        particle.style.boxShadow = '0 0 6px var(--gold-glow)';
    } else {
        particle.style.backgroundColor = '#444';
    }
    
    container.appendChild(particle);
}

// ==========================================================================
// EVENT LISTENERS & DOM HELPERS
// ==========================================================================

// Input adjust buttons (+/-)
window.adjustInput = function(id, amount) {
    const input = document.getElementById(id);
    let val = parseInt(input.value) || 0;
    val = Math.max(parseInt(input.min) || 1, Math.min(parseInt(input.max) || 100, val + amount));
    input.value = val;
    
    const event = new Event('change', { bubbles: true });
    input.dispatchEvent(event);
    playSlashSound();
};

// Form element listeners
document.getElementById('party-size').addEventListener('change', (e) => {
    state.partySize = parseInt(e.target.value) || 4;
    calculateEncounter();
});
document.getElementById('party-level').addEventListener('change', (e) => {
    state.partyLevel = parseInt(e.target.value) || 1;
    calculateEncounter();
});
document.getElementById('player-exp').addEventListener('change', (e) => {
    state.playerExp = e.target.value;
    calculateEncounter();
});
document.getElementById('party-comp').addEventListener('change', (e) => {
    state.partyComp = e.target.value;
    calculateEncounter();
});
document.getElementById('environment-factor').addEventListener('change', (e) => {
    state.environmentFactor = e.target.value;
    calculateEncounter();
});
document.getElementById('daily-pacing').addEventListener('change', (e) => {
    state.dailyPacing = e.target.value;
    calculateEncounter();
});

// Advanced config toggle
window.toggleAdvancedParty = function() {
    const advPanel = document.getElementById('advanced-party-config');
    const advChevron = document.getElementById('adv-chevron');
    if (advPanel.classList.contains('collapsed')) {
        advPanel.classList.remove('collapsed');
        advChevron.style.transform = 'rotate(180deg)';
    } else {
        advPanel.classList.add('collapsed');
        advChevron.style.transform = 'rotate(0deg)';
    }
    playSlashSound();
};

// Templates
window.applyTemplate = function(name, ndStr) {
    document.getElementById('threat-name').value = name;
    document.getElementById('threat-nd').value = ndStr;
    document.getElementById('threat-qty').value = 1;
    playSlashSound();
};

// Add Threat
document.getElementById('btn-add-threat').addEventListener('click', () => {
    const nameInput = document.getElementById('threat-name');
    const ndSelect = document.getElementById('threat-nd');
    const qtyInput = document.getElementById('threat-qty');
    
    const name = nameInput.value.trim() || `Ameaça de ND ${ndSelect.value}`;
    const ndStr = ndSelect.value;
    const qty = parseInt(qtyInput.value) || 1;
    const ndVal = ND_MAP[ndStr];
    
    if (qty <= 0) return;
    
    const threat = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
        name: name,
        ndStr: ndStr,
        ndVal: ndVal,
        qty: qty
    };
    
    state.threats.push(threat);
    
    nameInput.value = '';
    qtyInput.value = 1;
    
    playSlashSound();
    renderThreatList();
    calculateEncounter();
});

// Remove Threat
window.removeThreat = function(id) {
    state.threats = state.threats.filter(t => t.id !== id);
    playSlashSound();
    renderThreatList();
    calculateEncounter();
};

// Modify Threat Qty from list card
window.adjustThreatQty = function(id, amount) {
    const threat = state.threats.find(t => t.id === id);
    if (threat) {
        threat.qty = Math.max(1, threat.qty + amount);
        playSlashSound();
        renderThreatList();
        calculateEncounter();
    }
};

// XP tabs
window.switchXpTab = function(type) {
    state.xpTab = type;
    const tabs = document.querySelectorAll('.xp-tabs .tab-btn');
    tabs.forEach(tab => {
        if (tab.getAttribute('onclick').includes(type)) {
            tab.classList.add('active');
        } else {
            tab.classList.remove('active');
        }
    });
    playSlashSound();
    calculateEncounter();
};

// Render the UI list of threats
function renderThreatList() {
    const listEl = document.getElementById('threat-list');
    const emptyEl = document.getElementById('empty-threats-msg');
    const badgeEl = document.getElementById('threat-count-badge');
    
    badgeEl.textContent = state.threats.reduce((acc, t) => acc + t.qty, 0);
    
    if (state.threats.length === 0) {
        listEl.style.display = 'none';
        emptyEl.style.display = 'flex';
        return;
    }
    
    listEl.style.display = 'flex';
    emptyEl.style.display = 'none';
    listEl.innerHTML = '';
    
    state.threats.forEach(t => {
        const card = document.createElement('div');
        card.className = 'threat-card';
        card.innerHTML = `
            <div class="threat-card-info">
                <span class="threat-card-name">${escapeHTML(t.name)}</span>
                <span class="threat-card-nd">Nível de Desafio: ND ${t.ndStr}</span>
            </div>
            <div class="threat-card-controls">
                <div class="threat-card-qty-wrapper">
                    <button type="button" onclick="adjustThreatQty('${t.id}', -1)">-</button>
                    <span class="threat-card-qty-val">${t.qty}</span>
                    <button type="button" onclick="adjustThreatQty('${t.id}', 1)">+</button>
                </div>
                <button type="button" class="btn-remove-threat" onclick="removeThreat('${t.id}')" title="Remover Ameaça">
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        <line x1="10" y1="11" x2="10" y2="17"></line>
                        <line x1="14" y1="11" x2="14" y2="17"></line>
                    </svg>
                </button>
            </div>
        `;
        listEl.appendChild(card);
    });
}

function escapeHTML(str) {
    return str.replace(/[&<>'"]/g, 
        tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
    );
}

// ==========================================================================
// CORE CALCULATION MOTOR
// ==========================================================================
function calculateEncounter() {
    if (state.threats.length === 0) {
        resetDashboard();
        return;
    }
    
    let breakdownHtml = '<ol>';
    
    // --- STEP 1: Group threats by ND ---
    breakdownHtml += `<li><span class="breakdown-step-title">Etapa 1: Agrupar NDs iguais</span><br>`;
    const groups = {};
    state.threats.forEach(t => {
        if (!groups[t.ndVal]) {
            groups[t.ndVal] = { ndVal: t.ndVal, qty: 0, names: [] };
        }
        groups[t.ndVal].qty += t.qty;
        groups[t.ndVal].names.push(`${t.qty}x ${t.name}`);
    });
    
    // Calculate combined ND for each group
    let combinedNDs = [];
    
    Object.values(groups).forEach(group => {
        const { ndVal, qty, names } = group;
        let groupResult = 0;
        
        if (ndVal < 1) {
            // ND < 1 rule: ND * quantity
            groupResult = ndVal * qty;
            breakdownHtml += `Grupo [${names.join(' + ')}] de ND ${formatND(ndVal)} (menor que 1):<br>`;
            breakdownHtml += `<span class="math-formula">${formatND(ndVal)} * ${qty} = ${formatND(groupResult)}</span><br>`;
        } else {
            // ND >= 1 rule: ND + 2 for each double of quantity
            const add = qty > 1 ? Math.round(2 * Math.log2(qty)) : 0;
            groupResult = ndVal + add;
            breakdownHtml += `Grupo [${names.join(' + ')}] de ND ${formatND(ndVal)} (maior ou igual a 1):<br>`;
            if (qty > 1) {
                breakdownHtml += `<span class="math-formula">${formatND(ndVal)} + 2 * log₂(${qty}) ≈ ${formatND(ndVal)} + ${add} = ${formatND(groupResult)}</span> (dobrou ${Math.log2(qty).toFixed(1)} vezes)<br>`;
            } else {
                breakdownHtml += `<span class="math-formula">Apenas 1 criatura = ND ${formatND(ndVal)}</span><br>`;
            }
        }
        
        combinedNDs.push({ baseNd: ndVal, combinedNd: groupResult });
    });
    breakdownHtml += `</li>`;
    
    // --- STEP 2: Recursive grouping ---
    breakdownHtml += `<li><span class="breakdown-step-title">Etapa 2: Resolver NDs combinados iguais recursivamente</span><br>`;
    
    let resolvedList = combinedNDs.map(x => x.combinedNd);
    let iterations = 0;
    let needsGroup = true;
    
    while (needsGroup && iterations < 10) {
        iterations++;
        const freq = {};
        resolvedList.forEach(v => freq[v] = (freq[v] || 0) + 1);
        
        const duplicates = Object.keys(freq).filter(k => freq[k] > 1).map(Number);
        
        if (duplicates.length === 0) {
            needsGroup = false;
            breakdownHtml += `Nenhum grupo resultante com ND idêntico. Lista de NDs combinados: [${resolvedList.map(formatND).join(', ')}].<br>`;
        } else {
            breakdownHtml += `Encontrado NDs idênticos repetidos. Agrupando e recalculando:<br>`;
            let nextList = [];
            let processed = new Set();
            
            resolvedList.forEach(v => {
                if (processed.has(v)) return;
                
                const count = freq[v];
                if (count > 1) {
                    processed.add(v);
                    let result = 0;
                    if (v < 1) {
                        result = v * count;
                        breakdownHtml += `<span class="math-formula">${count} grupos de ND ${formatND(v)} -> ND ${formatND(v)} * ${count} = ${formatND(result)}</span><br>`;
                    } else {
                        const add = Math.round(2 * Math.log2(count));
                        result = v + add;
                        breakdownHtml += `<span class="math-formula">${count} grupos de ND ${formatND(v)} -> ND ${formatND(v)} + 2 * log₂(${count}) ≈ ${formatND(v)} + ${add} = ${formatND(result)}</span><br>`;
                    }
                    nextList.push(result);
                } else {
                    nextList.push(v);
                }
            });
            resolvedList = nextList;
        }
    }
    breakdownHtml += `</li>`;
    
    // --- STEP 3: Different NDs calculation ---
    breakdownHtml += `<li><span class="breakdown-step-title">Etapa 3: Combinar NDs diferentes</span><br>`;
    
    resolvedList.sort((a, b) => b - a);
    
    const baseND = resolvedList[0];
    let runningND = baseND;
    breakdownHtml += `ND Base (maior valor): ND ${formatND(baseND)}<br>`;
    
    if (resolvedList.length > 1) {
        breakdownHtml += `Comparando outros NDs com o ND Base:<br>`;
        for (let i = 1; i < resolvedList.length; i++) {
            const currentND = resolvedList[i];
            const diff = baseND - currentND;
            let addition = 0;
            
            if (diff <= 1) {
                addition = 1;
                breakdownHtml += `- ND ${formatND(currentND)} (diferença de ${diff.toFixed(2)} [até 1 ponto]): adiciona +1<br>`;
            } else if (diff <= 2) {
                addition = 0.5;
                breakdownHtml += `- ND ${formatND(currentND)} (diferença de ${diff.toFixed(2)} [até 2 pontos]): adiciona +1/2<br>`;
            } else if (diff <= 3) {
                addition = 0.25;
                breakdownHtml += `- ND ${formatND(currentND)} (diferença de ${diff.toFixed(2)} [até 3 pontos]): adiciona +1/4<br>`;
            } else {
                addition = 0;
                breakdownHtml += `- ND ${formatND(currentND)} (diferença de ${diff.toFixed(2)} [4 pontos ou mais]): Muito fraco, adiciona +0<br>`;
            }
            
            runningND += addition;
        }
    } else {
        breakdownHtml += `Nenhum outro ND para somar ao ND Base.<br>`;
    }
    
    const roundedND = Math.floor(runningND);
    breakdownHtml += `<br>ND final calculado: ${runningND.toFixed(2)}<br>`;
    breakdownHtml += `Regra de arredondamento T20: arredonda para baixo -> ND ${roundedND}<br>`;
    breakdownHtml += `</li></ol>`;
    
    document.getElementById('calculation-breakdown').innerHTML = breakdownHtml;
    
    // Update Ruby Badge
    const valDisplay = document.getElementById('encounter-nd-val');
    const fracDisplay = document.getElementById('encounter-nd-frac');
    
    valDisplay.textContent = roundedND;
    const decimalPart = runningND - roundedND;
    if (decimalPart === 0.25) fracDisplay.textContent = '1/4';
    else if (decimalPart === 0.5) fracDisplay.textContent = '1/2';
    else if (decimalPart === 0.75) fracDisplay.textContent = '3/4';
    else fracDisplay.textContent = '';
    
    // --- DIFFICULTY EVALUATOR ---
    evaluateDifficulty(runningND);
    
    // --- XP AND REWARDS ---
    calculateXP(runningND);
}

function resetDashboard() {
    document.getElementById('encounter-nd-val').textContent = '-';
    document.getElementById('encounter-nd-frac').textContent = '';
    
    const diffTag = document.getElementById('diff-tag');
    diffTag.className = 'difficulty-tag';
    diffTag.textContent = 'Aguardando Ameaças';
    
    document.getElementById('encounter-title').textContent = 'Prepare seus heróis';
    document.getElementById('encounter-desc').textContent = 'Adicione ameaças à esquerda para calcular o nível de desafio deste encontro e avaliar o risco para o seu grupo.';
    
    document.getElementById('calculation-breakdown').innerHTML = '<p class="empty-message-inline">Cálculo será exibido passo a passo após a inserção de ameaças.</p>';
    
    document.getElementById('meter-fill').style.width = '0%';
    document.getElementById('meter-indicator').style.left = '0%';
    
    document.getElementById('total-xp-val').textContent = '0 XP';
    document.getElementById('xp-per-player-val').textContent = '0 XP';
    
    document.getElementById('treasure-result-area').classList.add('collapsed');
}

// Evaluate difficulty compared to the party Target ND
function evaluateDifficulty(encounterND) {
    let targetND = state.partyLevel;
    
    let sizeAdj = 0;
    const size = state.partySize;
    if (size === 1) sizeAdj = -3;
    else if (size === 2) sizeAdj = -2;
    else if (size === 3) sizeAdj = -1;
    else if (size === 4) sizeAdj = 0;
    else if (size === 5) sizeAdj = 1;
    else if (size === 6) sizeAdj = 2;
    else if (size >= 7) sizeAdj = 3;
    
    let expAdj = 0;
    if (state.playerExp === 'novice') expAdj = -1;
    else if (state.playerExp === 'veteran') expAdj = 1;
    
    let compAdj = 0;
    if (state.partyComp === 'weak') compAdj = -1;
    else if (state.partyComp === 'optimized') compAdj = 1;
    
    let envAdj = 0;
    if (state.environmentFactor === 'favorable-enemies') envAdj = -1;
    else if (state.environmentFactor === 'favorable-heroes') envAdj = 1;
    
    let pacingAdj = 0;
    if (state.dailyPacing === 'dungeon-crawl') pacingAdj = -1;
    else if (state.dailyPacing === 'boss-fight') pacingAdj = 1.5;
    
    const adjustedTarget = targetND + sizeAdj + expAdj + compAdj + envAdj + pacingAdj;
    const diff = encounterND - adjustedTarget;
    
    const diffTag = document.getElementById('diff-tag');
    const titleEl = document.getElementById('encounter-title');
    const descEl = document.getElementById('encounter-desc');
    const meterFill = document.getElementById('meter-fill');
    const meterIndicator = document.getElementById('meter-indicator');
    const rubyGem = document.getElementById('ruby-gem');
    const ndGlow = document.getElementById('nd-glow');
    
    let diffClass = '';
    let title = '';
    let desc = '';
    let meterPercent = 50;
    let rubyColor = '';
    let glowColor = '';
    
    if (diff <= -2.5) {
        diffClass = 'diff-very-easy';
        title = 'Combate Muito Fácil';
        desc = 'Os aventureiros devem superar este encontro sem gastar recursos significativos. Excelente para ambientação ou mostrar evolução do grupo.';
        meterPercent = 10;
        rubyColor = 'radial-gradient(circle at 35% 35%, #6ee7b7 0%, #10b981 40%, #065f46 80%, #022c22 100%)';
        glowColor = 'radial-gradient(circle, rgba(16, 185, 129, 0.15) 0%, transparent 60%)';
    } else if (diff <= -0.75) {
        diffClass = 'diff-easy';
        title = 'Combate Fácil';
        desc = 'Desafio leve. Exigirá apenas gasto mínimo de pontos de mana e dano superficial. Ideal para combates preparatórios ou bandos fracos.';
        meterPercent = 30;
        rubyColor = 'radial-gradient(circle at 35% 35%, #93c5fd 0%, #3b82f6 40%, #1e40af 80%, #172554 100%)';
        glowColor = 'radial-gradient(circle, rgba(59, 130, 246, 0.15) 0%, transparent 60%)';
    } else if (diff <= 0.75) {
        diffClass = 'diff-balanced';
        title = 'Encontro Equilibrado';
        desc = 'Desafio justo e padrão de Tormenta20. Exigirá tática, causará dano moderado nos heróis e gastará cerca de 20-30% de seus pontos de mana. Todos devem sobreviver se jogarem bem.';
        meterPercent = 50;
        rubyColor = 'radial-gradient(circle at 35% 35%, #fcd34d 0%, #f59e0b 40%, #b45309 80%, #78350f 100%)';
        glowColor = 'radial-gradient(circle, rgba(245, 158, 11, 0.15) 0%, transparent 60%)';
    } else if (diff <= 2.5) {
        diffClass = 'diff-hard';
        title = 'Combate Difícil';
        desc = 'Encontro perigoso! Alguns aventureiros podem cair inconscientes. O uso inteligente de magias e posicionamento é crucial. Exige descanso e cura logo após o combate.';
        meterPercent = 70;
        rubyColor = 'radial-gradient(circle at 35% 35%, #f87171 0%, #ef4444 40%, #b91c1c 80%, #450a0a 100%)';
        glowColor = 'radial-gradient(circle, rgba(239, 68, 68, 0.15) 0%, transparent 60%)';
    } else {
        diffClass = 'diff-deadly';
        title = 'Encontro Mortal';
        desc = 'Risco extremo de morte de personagem ou derrota total do grupo (TPK). Apenas com muita sorte, preparação específica ou fuga planejada os aventureiros conseguirão sobreviver.';
        meterPercent = 90;
        rubyColor = 'radial-gradient(circle at 35% 35%, #f472b6 0%, #ec4899 40%, #be185d 80%, #500724 100%)';
        glowColor = 'radial-gradient(circle, rgba(236, 72, 153, 0.2) 0%, transparent 60%)';
    }
    
    diffTag.className = `difficulty-tag ${diffClass}`;
    diffTag.textContent = titleEl.textContent = title;
    descEl.textContent = desc;
    
    meterFill.style.width = `${meterPercent}%`;
    meterIndicator.style.left = `${meterPercent}%`;
    
    rubyGem.style.background = rubyColor;
    ndGlow.style.background = glowColor;
}

// XP Calculation
function calculateXP(encounterND) {
    const xpValEl = document.getElementById('total-xp-val');
    const xpPerPlayerEl = document.getElementById('xp-per-player-val');
    const descTypeEl = document.getElementById('xp-desc-type');
    const playerDescEl = document.getElementById('xp-player-count-desc');
    
    let totalXp = 0;
    
    if (state.xpTab === 'encounter') {
        totalXp = Math.max(0, Math.round(encounterND * 1000));
        descTypeEl.textContent = 'Estimativa pelo ND final do encontro (não é regra oficial)';
    } else {
        totalXp = state.threats.reduce((acc, t) => acc + Math.round(t.ndVal * t.qty * 1000), 0);
        descTypeEl.textContent = 'Soma do XP de cada ameaça separadamente (regra oficial T20)';
    }
    
    const xpPerPlayer = Math.round(totalXp / state.partySize);
    
    xpValEl.textContent = `${totalXp.toLocaleString('pt-BR')} XP`;
    xpPerPlayerEl.textContent = `${xpPerPlayer.toLocaleString('pt-BR')} XP`;
    playerDescEl.textContent = `Dividido igualmente para ${state.partySize} aventureiros`;
}

// ==========================================================================
// TREASURE ROLLER — Planilha oficial T20
// ==========================================================================
document.getElementById('btn-roll-treasure').addEventListener('click', () => {
    if (state.threats.length === 0) return;

    playSlashSound();

    if (!window.T20Treasure || !window.T20_TREASURE_DATA) {
        showTreasureResult({ error: 'Tabelas de tesouro não carregadas. Recarregue a página.' });
        return;
    }

    T20Treasure.init(window.T20_TREASURE_DATA);

    const rollMode = document.getElementById('treasure-roll-mode').value;
    const treasureType = document.getElementById('treasure-type').value;

    if (treasureType === 'nenhum') {
        showTreasureResult({ empty: true, message: 'Nenhum tesouro (criaturas sem loot).' });
        return;
    }

    let result;
    if (rollMode === 'per-encounter') {
        result = T20Treasure.rollEncounterNd(state.lastEncounterNd || state.partyLevel, {
            treasureType,
            moneyMultiplier: 1
        });
    } else {
        result = T20Treasure.rollThreats(state.threats, {
            defaultTreasureType: treasureType,
            moneyMultiplier: 1
        });
    }

    showTreasureResult(result);
});

const LOOT_CATEGORY_LABELS = {
    item: 'Item',
    potion: 'Poção',
    magic: 'Mágico',
    superior: 'Superior',
    gear: 'Equipamento',
    wealth: 'Riqueza'
};

const lootSheetBackdrop = document.getElementById('loot-sheet-backdrop');
const lootQuickBar = document.getElementById('loot-quick-bar');
const lootQuickText = document.getElementById('loot-quick-text');
const btnCloseLootSheet = document.getElementById('btn-close-loot-sheet');
let lastLootSummary = '';

const lootMobileQuery = window.matchMedia('(max-width: 967px)');

function isLootMobileView() {
    return lootMobileQuery.matches;
}

function openLootSheet() {
    const resultBox = document.getElementById('treasure-result-area');
    resultBox.classList.remove('collapsed');

    if (isLootMobileView()) {
        document.body.classList.add('loot-sheet-open');
        if (lootSheetBackdrop) {
            lootSheetBackdrop.hidden = false;
            lootSheetBackdrop.setAttribute('aria-hidden', 'false');
            requestAnimationFrame(() => lootSheetBackdrop.classList.add('visible'));
        }
        if (lootQuickBar) {
            lootQuickBar.classList.add('hidden');
            document.body.classList.remove('loot-quick-visible');
        }
    } else {
        resultBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
}

function closeLootSheet() {
    const resultBox = document.getElementById('treasure-result-area');
    resultBox.classList.add('collapsed');
    document.body.classList.remove('loot-sheet-open');

    if (lootSheetBackdrop) {
        lootSheetBackdrop.classList.remove('visible');
        lootSheetBackdrop.setAttribute('aria-hidden', 'true');
        setTimeout(() => {
            if (!lootSheetBackdrop.classList.contains('visible')) {
                lootSheetBackdrop.hidden = true;
            }
        }, 260);
    }

    if (lootQuickBar && lastLootSummary) {
        lootQuickText.textContent = lastLootSummary;
        lootQuickBar.classList.remove('hidden');
        document.body.classList.add('loot-quick-visible');
    }
}

function buildLootSummary(result) {
    if (result.error || result.empty) {
        return result.error || result.message || 'Sem tesouro';
    }

    const parts = [];
    const coins = (result.moneyChips || []).filter(c => c.kind === 'coin');
    const wealth = (result.moneyChips || []).filter(c => c.kind === 'wealth');

    if (coins.length) {
        const total = coins.reduce((sum, c) => sum + c.amount, 0);
        const unit = coins[0].unit || 'T$';
        parts.push(`${total.toLocaleString('pt-BR')} ${unit}`);
    }
    if (wealth.length) {
        parts.push(`${wealth.length} riqueza${wealth.length > 1 ? 's' : ''}`);
    }

    const itemCount = result.totalItems || (result.itemList || []).length;
    if (itemCount > 0) {
        parts.push(`${itemCount} item${itemCount > 1 ? 'ns' : ''}`);
    }

    return parts.length ? parts.join(' · ') : 'Tesouro vazio nesta rolagem';
}

if (btnCloseLootSheet) {
    btnCloseLootSheet.addEventListener('click', closeLootSheet);
}

if (lootSheetBackdrop) {
    lootSheetBackdrop.addEventListener('click', closeLootSheet);
}

if (lootQuickBar) {
    lootQuickBar.addEventListener('click', openLootSheet);
}

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        const resultBox = document.getElementById('treasure-result-area');
        if (resultBox && !resultBox.classList.contains('collapsed')) {
            closeLootSheet();
        }
    }
});

function showTreasureResult(result) {
    const resultBox = document.getElementById('treasure-result-area');
    const moneyEl = document.getElementById('loot-money-chips');
    const itemsEl = document.getElementById('loot-items-list');
    const countEl = document.getElementById('loot-item-count');
    const logEl = document.getElementById('loot-rolls-log');

    if (result.error || result.empty) {
        moneyEl.innerHTML = `<p class="loot-empty-msg">${escapeHTML(result.error || result.message)}</p>`;
        itemsEl.innerHTML = '';
        countEl.textContent = '';
        logEl.innerHTML = '';
        lastLootSummary = buildLootSummary(result);
        openLootSheet();
        return;
    }

    if (!result.moneyChips || result.moneyChips.length === 0) {
        moneyEl.innerHTML = '<p class="loot-empty-msg">Nenhuma moeda ou riqueza nesta rolagem.</p>';
    } else {
        moneyEl.innerHTML = result.moneyChips.map(chip => {
            if (chip.kind === 'coin') {
                return `<div class="loot-chip loot-chip-coin">
                    <span class="loot-chip-amount">${chip.amount.toLocaleString('pt-BR')}</span>
                    <span class="loot-chip-unit">${escapeHTML(chip.unit)}</span>
                    <span class="loot-chip-sub">${escapeHTML(chip.label)}</span>
                </div>`;
            }
            return `<div class="loot-chip loot-chip-wealth">
                <span class="loot-chip-amount">${chip.amount.toLocaleString('pt-BR')} T$</span>
                <span class="loot-chip-desc">${escapeHTML(chip.label)}</span>
                ${chip.detail ? `<span class="loot-chip-sub">${escapeHTML(chip.detail)}</span>` : ''}
            </div>`;
        }).join('');
    }

    if (!result.itemList || result.itemList.length === 0) {
        itemsEl.innerHTML = '<li class="loot-empty-msg">Nenhum item adicional.</li>';
        countEl.textContent = '';
    } else {
        countEl.textContent = result.totalItems;
        itemsEl.innerHTML = result.itemList.map(item => {
            const cat = LOOT_CATEGORY_LABELS[item.category] || 'Item';
            return `<li class="loot-item-card loot-cat-${item.category}">
                <div class="loot-item-card-top">
                    ${item.count > 1 ? `<span class="loot-item-qty">${item.count}×</span>` : ''}
                    <span class="loot-item-cat">${escapeHTML(cat)}</span>
                </div>
                <p class="loot-item-name">${escapeHTML(item.name)}</p>
            </li>`;
        }).join('');
    }

    if (result.logLines && result.logLines.length) {
        logEl.innerHTML = result.logLines.map(line => {
            const safe = escapeHTML(line);
            if (line.startsWith('---')) {
                return `<div class="loot-log-block">${safe}</div>`;
            }
            if (line.startsWith('>>')) {
                return `<div class="loot-log-double">${safe}</div>`;
            }
            if (line.includes('d100=')) {
                return `<div class="loot-log-roll">${safe}</div>`;
            }
            return `<div class="loot-log-line">${safe}</div>`;
        }).join('');
    } else {
        logEl.innerHTML = '';
    }

    lastLootSummary = buildLootSummary(result);
    openLootSheet();
}

// ==========================================================================
// BROWSER CONSOLE UNIT TESTS (CLEAN LOGS - NO EMOJIS)
// ==========================================================================
function runConsoleTests() {
    const testCases = [
        {
            name: "4x ND 1/4 (Goblins)",
            threats: [{ name: "Goblin", ndVal: 0.25, qty: 4 }],
            expectedRounded: 1
        },
        {
            name: "2x ND 1/2 (Lobos)",
            threats: [{ name: "Lobo de Caça", ndVal: 0.5, qty: 2 }],
            expectedRounded: 1
        },
        {
            name: "2x ND 1 (Guerreiros Orcs)",
            threats: [{ name: "Orc", ndVal: 1, qty: 2 }],
            expectedRounded: 3
        },
        {
            name: "4x ND 5 (Decúrias)",
            threats: [{ name: "Decúria", ndVal: 5, qty: 4 }],
            expectedRounded: 9
        },
        {
            name: "Exemplo do Livro: ND 7, ND 6, ND 5, ND 3 (Misto)",
            threats: [
                { name: "Centurião", ndVal: 7, qty: 1 },
                { name: "Governador", ndVal: 6, qty: 1 },
                { name: "Decúria", ndVal: 5, qty: 1 },
                { name: "Minauro", ndVal: 3, qty: 1 }
            ],
            expectedRounded: 8
        },
        {
            name: "Mistura de iguais e diferentes: 2x ND 5 e 1x ND 6",
            threats: [
                { name: "Monstro ND 5", ndVal: 5, qty: 2 },
                { name: "Monstro ND 6", ndVal: 6, qty: 1 }
            ],
            expectedRounded: 8
        }
    ];

    console.log("%c=== INICIANDO TESTES CALCULADORA T20 (BROWSER) ===", "color: #d4af37; font-weight: bold;");
    let passedCount = 0;

    testCases.forEach((tc, idx) => {
        const result = testCalculateLogic(tc.threats);
        const passed = result.roundedND === tc.expectedRounded;
        
        if (passed) {
            console.log(`%c[OK] Teste #${idx + 1} PASSOU: "${tc.name}" | Esperado: ND ${tc.expectedRounded} | Obtido: ND ${result.roundedND}`, "color: #10b981;");
            passedCount++;
        } else {
            console.error(`[FAIL] Teste #${idx + 1} FALHOU: "${tc.name}" | Esperado: ND ${tc.expectedRounded} | Obtido: ND ${result.roundedND} (Preciso: ${result.preciseND})`);
        }
    });

    console.log(`%c=== FIM DOS TESTES: ${passedCount}/${testCases.length} PASSARAM ===`, "color: #d4af37; font-weight: bold;");
}

function testCalculateLogic(threats) {
    if (threats.length === 0) return { preciseND: 0, roundedND: 0 };
    
    const groups = {};
    threats.forEach(t => {
        if (!groups[t.ndVal]) {
            groups[t.ndVal] = { ndVal: t.ndVal, qty: 0 };
        }
        groups[t.ndVal].qty += t.qty;
    });
    
    let combinedNDs = [];
    Object.values(groups).forEach(group => {
        const { ndVal, qty } = group;
        let groupResult = 0;
        
        if (ndVal < 1) {
            groupResult = ndVal * qty;
        } else {
            const add = qty > 1 ? Math.round(2 * Math.log2(qty)) : 0;
            groupResult = ndVal + add;
        }
        combinedNDs.push({ combinedNd: groupResult });
    });
    
    let resolvedList = combinedNDs.map(x => x.combinedNd);
    let iterations = 0;
    let needsGroup = true;
    
    while (needsGroup && iterations < 10) {
        iterations++;
        const freq = {};
        resolvedList.forEach(v => freq[v] = (freq[v] || 0) + 1);
        
        const duplicates = Object.keys(freq).filter(k => freq[k] > 1).map(Number);
        
        if (duplicates.length === 0) {
            needsGroup = false;
        } else {
            let nextList = [];
            let processed = new Set();
            
            resolvedList.forEach(v => {
                if (processed.has(v)) return;
                
                const count = freq[v];
                if (count > 1) {
                    processed.add(v);
                    let result = 0;
                    if (v < 1) {
                        result = v * count;
                    } else {
                        const add = Math.round(2 * Math.log2(count));
                        result = v + add;
                    }
                    nextList.push(result);
                } else {
                    nextList.push(v);
                }
            });
            resolvedList = nextList;
        }
    }
    
    resolvedList.sort((a, b) => b - a);
    
    const baseND = resolvedList[0];
    let runningND = baseND;
    
    if (resolvedList.length > 1) {
        for (let i = 1; i < resolvedList.length; i++) {
            const currentND = resolvedList[i];
            const diff = baseND - currentND;
            let addition = 0;
            
            if (diff <= 1) {
                addition = 1;
            } else if (diff <= 2) {
                addition = 0.5;
            } else if (diff <= 3) {
                addition = 0.25;
            } else {
                addition = 0;
            }
            runningND += addition;
        }
    }
    
    const roundedND = Math.floor(runningND);
    return { preciseND: runningND, roundedND: roundedND };
}

function initBreakdownPanel() {
    const details = document.querySelector('.breakdown-details');
    if (!details) return;

    const desktopQuery = window.matchMedia('(min-width: 968px)');
    const sync = () => {
        if (desktopQuery.matches) {
            details.setAttribute('open', '');
        } else if (!details.dataset.userToggled) {
            details.removeAttribute('open');
        }
    };

    details.addEventListener('toggle', () => {
        if (!desktopQuery.matches) {
            details.dataset.userToggled = '1';
        }
    });

    sync();
    desktopQuery.addEventListener('change', sync);
}

// ==========================================================================
// INITIALIZATION
// ==========================================================================
window.addEventListener('DOMContentLoaded', () => {
    initParticles();
    resetDashboard();
    runConsoleTests();
    initBreakdownPanel();

    if (!canUseYouTubeEmbed()) {
        showMusicToast('Dica: abra via servidor local para ouvir a música do YouTube.');
    }
});
