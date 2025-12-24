// State
let medicines = [];
let historyLog = [];

try {
    medicines = JSON.parse(localStorage.getItem('medicines')) || [];
} catch (error) {
    console.error("Error loading medicines:", error);
    medicines = [];
}

try {
    historyLog = JSON.parse(localStorage.getItem('historyLog')) || [];
} catch (error) {
    console.error("Error loading history:", error);
    historyLog = [];
}

let alarmInterval;
let activeAlarm = null;
let audioContext = null;

// DOM Elements
const clockEl = document.getElementById('clock');
const medicineListEl = document.getElementById('medicine-list');
const upcomingListEl = document.getElementById('upcoming-list');
const modal = document.getElementById('medicine-modal');
const form = document.getElementById('medicine-form');
const addBtn = document.getElementById('add-btn');
const closeBtn = document.getElementById('close-modal');
const themeToggle = document.getElementById('theme-toggle');
const alarmOverlay = document.getElementById('alarm-overlay');
const snoozeBtn = document.getElementById('snooze-btn');
const takeBtn = document.getElementById('take-btn');
const previewBtn = document.getElementById('preview-sound');

// History DOM
const historyBtn = document.getElementById('history-btn');
const historyModal = document.getElementById('history-modal');
const closeHistoryBtn = document.getElementById('close-history');
const historyListEl = document.getElementById('history-list');
const clearHistoryBtn = document.getElementById('clear-history-btn');

// New DOM Elements
const presetGroup = document.getElementById('preset-group');
const customGroup = document.getElementById('custom-group');
const customFile = document.getElementById('custom-file');
const customSoundData = document.getElementById('custom-sound-data');
const fileNameDisplay = document.getElementById('file-name-display');
const volumeSlider = document.getElementById('med-volume');
const volumeValue = document.getElementById('volume-value');
const soundTypeRadios = document.getElementsByName('sound-type');

// Initialization
document.addEventListener('DOMContentLoaded', () => {
    updateClock();
    renderMedicines();
    requestNotificationPermission();
    setupUIListeners();
    
    // Start clock and alarm checker
    setInterval(() => {
        updateClock();
        checkAlarms();
    }, 1000);

    // Initialize Theme
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
        document.body.setAttribute('data-theme', 'dark');
        themeToggle.innerHTML = '<i class="fas fa-sun"></i>';
    }
});

function setupUIListeners() {
    // Radio toggle
    soundTypeRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            if (e.target.value === 'custom') {
                presetGroup.classList.add('hidden');
                customGroup.classList.remove('hidden');
            } else {
                presetGroup.classList.remove('hidden');
                customGroup.classList.add('hidden');
            }
        });
    });

    // Frequency Toggle
    const frequencyRadios = document.getElementsByName('frequency');
    const daysGroup = document.getElementById('days-group');

    frequencyRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            if (e.target.value === 'weekly') {
                daysGroup.classList.remove('hidden');
            } else {
                daysGroup.classList.add('hidden');
            }
        });
    });

    // History Listeners
    historyBtn.addEventListener('click', openHistory);
    closeHistoryBtn.addEventListener('click', closeHistory);
    clearHistoryBtn.addEventListener('click', clearHistory);
    
    // Close history on outside click
    window.addEventListener('click', (event) => {
        if (event.target == historyModal) closeHistory();
    });

    // File Upload
    customFile.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            if (file.size > 500 * 1024) { // 500KB limit
                alert('File is too large! Please upload a ringtone under 500KB.');
                customFile.value = '';
                return;
            }

            const reader = new FileReader();
            reader.onload = function(event) {
                customSoundData.value = event.target.result;
                fileNameDisplay.textContent = `Selected: ${file.name}`;
            };
            reader.readAsDataURL(file);
        }
    });

    // Volume Slider
    volumeSlider.addEventListener('input', (e) => {
        volumeValue.textContent = `${e.target.value}%`;
    });
}

// Clock Function
function updateClock() {
    const now = new Date();
    const timeString = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
    clockEl.textContent = timeString;
}

// Render UI
function renderMedicines() {
    medicineListEl.innerHTML = '';
    upcomingListEl.innerHTML = '';
    
    // Sort medicines by time
    medicines.sort((a, b) => a.time.localeCompare(b.time));

    const now = new Date();
    const currentTime = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });

    if (medicines.length === 0) {
        medicineListEl.innerHTML = '<div class="empty-state">No medicines added yet. Tap + to add one.</div>';
    }

    let upcomingCount = 0;

    medicines.forEach(med => {
        // Create Card
        const card = document.createElement('div');
        card.className = 'medicine-card';
        
        let stockHtml = '';
        if (med.stock !== null && med.stock !== undefined && med.stock !== '') {
            const isLow = med.lowAlert && med.stock <= med.lowAlert;
            stockHtml = `<div class="med-stock-badge ${isLow ? 'low-stock' : ''}">
                            ${isLow ? '<i class="fas fa-exclamation-triangle"></i>' : ''} Stock: ${med.stock}
                         </div>`;
        }

        let scheduleHtml = '';
        if (med.frequency === 'weekly' && med.days && med.days.length > 0) {
            const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
            const daysStr = med.days.sort().map(d => dayNames[d]).join(', ');
            scheduleHtml = `<div class="sub-label"><i class="fas fa-calendar-alt"></i> ${daysStr}</div>`;
        } else {
             scheduleHtml = `<div class="sub-label"><i class="fas fa-sync-alt"></i> Daily</div>`;
        }

        card.innerHTML = `
            <div class="med-info">
                <div class="med-time">${med.time}</div>
                ${scheduleHtml}
                <h3>${med.name}</h3>
                <div class="med-notes">${med.notes || ''}</div>
                ${stockHtml}
            </div>
            <div class="card-actions">
                <button class="action-btn" onclick="editMedicine('${med.id}')">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="action-btn delete-btn" onclick="deleteMedicine('${med.id}')">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;
        medicineListEl.appendChild(card);

        // Check if upcoming (within next hour)
        if (med.time > currentTime && med.time <= addHours(currentTime, 1)) {
            const upCard = card.cloneNode(true);
            // Remove delete button from dashboard view to keep it clean
            upCard.querySelector('.card-actions').innerHTML = ''; 
            upcomingListEl.appendChild(upCard);
            upcomingCount++;
        }
    });

    if (upcomingCount === 0) {
        upcomingListEl.innerHTML = '<div class="empty-state">No upcoming medicines in the next hour.</div>';
    }
}

// Helper to add hours to time string HH:mm
function addHours(timeStr, hours) {
    const [h, m] = timeStr.split(':').map(Number);
    const date = new Date();
    date.setHours(h + hours);
    date.setMinutes(m);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
}

// CRUD Operations
form.addEventListener('submit', (e) => {
    e.preventDefault();
    
    const id = document.getElementById('med-id').value || Date.now().toString();
    const name = document.getElementById('med-name').value;
    const time = document.getElementById('med-time').value;
    const notes = document.getElementById('med-notes').value;
    
    // Inventory
    const stock = document.getElementById('med-stock').value;
    const lowAlert = document.getElementById('med-low-alert').value;

    // Frequency & Days
    const frequency = document.querySelector('input[name="frequency"]:checked').value;
    const selectedDays = Array.from(document.querySelectorAll('.days-selector input:checked')).map(cb => parseInt(cb.value));

    // New fields
    const soundType = document.querySelector('input[name="sound-type"]:checked').value;
    const volume = document.getElementById('med-volume').value;
    const sound = document.getElementById('med-sound').value;
    const customSound = document.getElementById('custom-sound-data').value;
    
    // Get file name if available
    let customSoundName = '';
    const displayText = document.getElementById('file-name-display').textContent;
    if (displayText && displayText.includes('Selected:')) {
        customSoundName = displayText.replace('Selected: ', '');
    } else if (displayText) {
        customSoundName = displayText; // Already just the name
    }

    const newMed = { 
        id, name, time, notes, 
        stock: stock ? parseInt(stock) : null,
        lowAlert: lowAlert ? parseInt(lowAlert) : null,
        frequency,
        days: frequency === 'weekly' ? selectedDays : [],
        soundType, volume, sound, 
        customSound: soundType === 'custom' ? customSound : null,
        customSoundName: soundType === 'custom' ? customSoundName : null
    };

    // Check if edit or add
    const index = medicines.findIndex(m => m.id === id);
    if (index > -1) {
        medicines[index] = newMed;
    } else {
        medicines.push(newMed);
    }

    saveMedicines();
    toggleModal();
    renderMedicines();
    form.reset();
});

window.editMedicine = (id) => {
    const med = medicines.find(m => m.id === id);
    if (med) {
        document.getElementById('med-id').value = med.id;
        document.getElementById('med-name').value = med.name;
        document.getElementById('med-time').value = med.time;
        document.getElementById('med-notes').value = med.notes;
        
        // Inventory
        document.getElementById('med-stock').value = med.stock !== null ? med.stock : '';
        document.getElementById('med-low-alert').value = med.lowAlert !== null ? med.lowAlert : '';

        // Frequency
        if (med.frequency === 'weekly') {
            document.querySelector('input[name="frequency"][value="weekly"]').checked = true;
            document.getElementById('days-group').classList.remove('hidden');
            // Reset all checkboxes first
            document.querySelectorAll('.days-selector input').forEach(cb => cb.checked = false);
            // Check saved days
            if (med.days) {
                med.days.forEach(day => {
                    const cb = document.querySelector(`.days-selector input[value="${day}"]`);
                    if (cb) cb.checked = true;
                });
            }
        } else {
            document.querySelector('input[name="frequency"][value="daily"]').checked = true;
            document.getElementById('days-group').classList.add('hidden');
            document.querySelectorAll('.days-selector input').forEach(cb => cb.checked = false);
        }

        // New fields
        document.getElementById('med-volume').value = med.volume || 100;
        document.getElementById('volume-value').textContent = (med.volume || 100) + '%';
        
        if (med.soundType === 'custom') {
            document.querySelector('input[name="sound-type"][value="custom"]').checked = true;
            presetGroup.classList.add('hidden');
            customGroup.classList.remove('hidden');
            document.getElementById('custom-sound-data').value = med.customSound || '';
            document.getElementById('file-name-display').textContent = med.customSoundName || 'Existing Custom Sound';
        } else {
            document.querySelector('input[name="sound-type"][value="preset"]').checked = true;
            presetGroup.classList.remove('hidden');
            customGroup.classList.add('hidden');
            document.getElementById('med-sound').value = med.sound || 'beep';
        }

        document.getElementById('modal-title').textContent = 'Edit Medicine';
        toggleModal(true);
    }
};

window.deleteMedicine = (id) => {
    if (confirm('Delete this medicine?')) {
        medicines = medicines.filter(m => m.id !== id);
        saveMedicines();
        renderMedicines();
    }
};

function saveMedicines() {
    localStorage.setItem('medicines', JSON.stringify(medicines));
}

// Alarm Logic
let lastCheckedMinute = null;

function checkAlarms() {
    const now = new Date();
    const currentMinute = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
    const currentDay = now.getDay(); // 0 = Sun, 1 = Mon, etc.
    
    // Check if we already checked this minute
    if (lastCheckedMinute === currentMinute) return;
    lastCheckedMinute = currentMinute;

    medicines.forEach(med => {
        if (med.time === currentMinute) {
            // Check Frequency
            let shouldTrigger = false;
            if (!med.frequency || med.frequency === 'daily') {
                shouldTrigger = true;
            } else if (med.frequency === 'weekly') {
                if (med.days && med.days.includes(currentDay)) {
                    shouldTrigger = true;
                }
            }

            if (shouldTrigger) {
                triggerAlarm(med);
            }
        }
    });
}

function triggerAlarm(med) {
    activeAlarm = med;
    
    // UI Overlay
    document.getElementById('alarm-med-name').textContent = `Time for ${med.name}!`;
    document.getElementById('alarm-med-notes').textContent = med.notes || '';
    alarmOverlay.classList.remove('hidden');

    // Audio
    playAlarmSound(med);

    // System Notification
    if (Notification.permission === 'granted') {
        new Notification(`Medicine Reminder: ${med.name}`, {
            body: med.notes || 'Time to take your medicine!',
            icon: 'https://cdn-icons-png.flaticon.com/512/883/883407.png' // Generic pill icon
        });
    }
}

let activeAudioElement = null;

// Sound Logic using Web Audio API
function playAlarmSound(med) {
    if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
    stopAlarmSound();

    const vol = (med.volume !== undefined ? med.volume : 100) / 100;

    // Custom File Logic
    if (med.soundType === 'custom' && med.customSound) {
        activeAudioElement = new Audio(med.customSound);
        activeAudioElement.volume = vol;
        activeAudioElement.loop = true;
        activeAudioElement.play().catch(e => console.error("Play error", e));
        return;
    }

    // Preset Logic
    const type = med.sound || 'beep';
    
    // Master Volume Gain for Presets
    const masterGain = audioContext.createGain();
    masterGain.gain.value = vol;
    masterGain.connect(audioContext.destination);
    
    const now = audioContext.currentTime;
    
    // Initial Note
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    osc.connect(gain);
    gain.connect(masterGain);

    if (type === 'beep') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, now);
        osc.frequency.setValueAtTime(0, now + 0.1);
        osc.frequency.setValueAtTime(800, now + 0.2);
        osc.frequency.setValueAtTime(0, now + 0.3);
        osc.start();
        osc.stop(now + 2); 
        
        alarmInterval = setInterval(() => {
            const o = audioContext.createOscillator();
            const g = audioContext.createGain();
            o.connect(g);
            g.connect(masterGain);
            o.frequency.setValueAtTime(800, audioContext.currentTime);
            o.start();
            o.stop(audioContext.currentTime + 0.1);
        }, 500);

    } else if (type === 'chime') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(600, now);
        osc.frequency.exponentialRampToValueAtTime(0.01, now + 1.5);
        gain.gain.setValueAtTime(1, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 1.5);
        osc.start();
        
        alarmInterval = setInterval(() => {
             const o = audioContext.createOscillator();
             const g = audioContext.createGain();
             o.type = 'triangle';
             o.connect(g);
             g.connect(masterGain);
             o.frequency.setValueAtTime(600, audioContext.currentTime);
             o.frequency.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 1.5);
             g.gain.setValueAtTime(1, audioContext.currentTime);
             g.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 1.5);
             o.start();
             o.stop(audioContext.currentTime + 2);
        }, 2000);

    } else { // Bell
        osc.type = 'sine';
        osc.frequency.setValueAtTime(400, now);
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(1, now + 0.1);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 1);
        osc.start();

        alarmInterval = setInterval(() => {
            const o = audioContext.createOscillator();
            const g = audioContext.createGain();
            o.connect(g);
            g.connect(masterGain);
            o.frequency.setValueAtTime(400, audioContext.currentTime);
            g.gain.setValueAtTime(0, audioContext.currentTime);
            g.gain.linearRampToValueAtTime(1, audioContext.currentTime + 0.1);
            g.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 1);
            o.start();
            o.stop(audioContext.currentTime + 1.5);
        }, 1500);
    }
}

function stopAlarmSound() {
    if (alarmInterval) clearInterval(alarmInterval);
    if (activeAudioElement) {
        activeAudioElement.pause();
        activeAudioElement.currentTime = 0;
        activeAudioElement = null;
    }
}

// Alarm Actions
takeBtn.addEventListener('click', () => {
    alarmOverlay.classList.add('hidden');
    stopAlarmSound();
    
    if (activeAlarm) {
        // 1. Decrement Stock
        if (activeAlarm.stock !== null && activeAlarm.stock > 0) {
            activeAlarm.stock--;
            // Update in local storage
            const index = medicines.findIndex(m => m.id === activeAlarm.id);
            if (index > -1) {
                medicines[index].stock = activeAlarm.stock;
                saveMedicines();
                renderMedicines(); // Refresh UI
                
                // Low stock alert immediately?
                if (activeAlarm.lowAlert && activeAlarm.stock <= activeAlarm.lowAlert) {
                   alert(`Low Stock Warning: ${activeAlarm.name} has only ${activeAlarm.stock} left!`);
                }
            }
        }

        // 2. Log History
        const now = new Date();
        const logEntry = {
            id: Date.now().toString(),
            medName: activeAlarm.name,
            action: 'Taken',
            timestamp: now.toLocaleString()
        };
        historyLog.unshift(logEntry); // Add to beginning
        localStorage.setItem('historyLog', JSON.stringify(historyLog));
    }
});

snoozeBtn.addEventListener('click', () => {
    alarmOverlay.classList.add('hidden');
    stopAlarmSound();
    
    // Add snooze logic: Create a temp alarm 5 mins later
    if (activeAlarm) {
        // Simple alert for demo, real implementation would schedule another check
        setTimeout(() => {
            triggerAlarm(activeAlarm);
        }, 5 * 60 * 1000); // 5 mins
    }
});

// Sound Preview
previewBtn.addEventListener('click', () => {
    const soundType = document.querySelector('input[name="sound-type"]:checked').value;
    const sound = document.getElementById('med-sound').value;
    const volume = document.getElementById('med-volume').value;
    const customSound = document.getElementById('custom-sound-data').value;

    const mockMed = {
        soundType,
        sound,
        volume: parseInt(volume),
        customSound
    };

    playAlarmSound(mockMed);
    
    // Stop after a few seconds
    setTimeout(stopAlarmSound, 3000); 
});

// UI Event Listeners
addBtn.addEventListener('click', () => toggleModal(false));
closeBtn.addEventListener('click', () => toggleModal(true)); // Just close, param doesn't matter for closing but let's be safe. Actually for closing it just toggles.
window.onclick = (event) => {
    if (event.target == modal) toggleModal(true); // Close
};

function toggleModal(keepForm = false) {
    const isHidden = modal.classList.contains('hidden');
    
    if (isHidden) {
        // Opening
        modal.classList.remove('hidden');
        if (!keepForm) {
            document.getElementById('modal-title').textContent = 'Add Medicine';
            document.getElementById('med-id').value = ''; 
            form.reset();
            document.getElementById('med-stock').value = '';
            document.getElementById('med-low-alert').value = '';
            
            const now = new Date();
            const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
            document.getElementById('med-time').value = timeStr;
        }
    } else {
        // Closing
        modal.classList.add('hidden');
    }
}

themeToggle.addEventListener('click', () => {
    const isDark = document.body.getAttribute('data-theme') === 'dark';
    if (isDark) {
        document.body.removeAttribute('data-theme');
        themeToggle.innerHTML = '<i class="fas fa-moon"></i>';
        localStorage.setItem('theme', 'light');
    } else {
        document.body.setAttribute('data-theme', 'dark');
        themeToggle.innerHTML = '<i class="fas fa-sun"></i>';
        localStorage.setItem('theme', 'dark');
    }
});

function requestNotificationPermission() {
    if ('Notification' in window) {
        Notification.requestPermission();
    }
}

// History Functions
function openHistory() {
    historyModal.classList.remove('hidden');
    renderHistory();
}

function closeHistory() {
    historyModal.classList.add('hidden');
}

function renderHistory() {
    historyListEl.innerHTML = '';
    
    if (historyLog.length === 0) {
        historyListEl.innerHTML = '<div class="empty-state">No history yet.</div>';
        return;
    }

    historyLog.forEach(item => {
        const div = document.createElement('div');
        div.className = 'history-item';
        div.innerHTML = `
            <div>
                <strong>${item.medName}</strong>
                <div class="history-time">${item.timestamp}</div>
            </div>
            <div style="color: var(--success-color); font-weight: bold;">
                ${item.action}
            </div>
        `;
        historyListEl.appendChild(div);
    });
}

function clearHistory() {
    if (confirm('Clear all history?')) {
        historyLog = [];
        localStorage.setItem('historyLog', JSON.stringify(historyLog));
        renderHistory();
    }
}
