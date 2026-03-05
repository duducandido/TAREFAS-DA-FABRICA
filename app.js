// Auth Check
if (!localStorage.getItem('isLoggedIn') && !window.location.href.includes('login.html')) {
    window.location.href = 'login.html';
}

// State Management
let currentUser = localStorage.getItem('userName') || 'Eduardo';
let tasks = [];
let editingTaskId = null;
let currentMemberFilter = 'Todos';

// Selectors
const todoList = document.getElementById('todo-list');
const progressList = document.getElementById('progress-list');
const doneList = document.getElementById('done-list');
const taskForm = document.getElementById('task-form');
const taskModal = document.getElementById('task-modal');
const openModalBtn = document.getElementById('open-modal-btn');
const closeModalBtn = document.querySelector('.close');
const searchInput = document.getElementById('search-input');
const themeToggle = document.getElementById('theme-toggle');
const filters = document.querySelectorAll('.filter');
const navItems = document.querySelectorAll('.nav-item');
const views = document.querySelectorAll('.app-view');
const logoutBtn = document.getElementById('logout-btn');

// --- Audio System (Web Audio API) ---
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playSound(type) {
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    if (type === 'success') {
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(523.25, audioCtx.currentTime); // C5
        oscillator.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.1);
        gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.3);
    } else if (type === 'move') {
        oscillator.type = 'triangle';
        oscillator.frequency.setValueAtTime(150, audioCtx.currentTime);
        gainNode.gain.setValueAtTime(0.05, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.1);
    }
}

// Load Tasks from MongoDB
async function loadTasksFromServer() {
    try {
        const response = await fetch('/api/tasks');
        if (response.ok) {
            tasks = await response.json();
            renderAllViews();
            updateProductivityStats();
            updateGlobalProgress();
            renderMemberFilters();
        }
    } catch (error) {
        console.error('Erro ao carregar:', error);
    }
}

function updateGlobalProgress() {
    const done = tasks.filter(t => t.status === 'done').length;
    const total = tasks.length;
    const percent = total === 0 ? 0 : Math.round((done / total) * 100);

    const bar = document.getElementById('global-progress-bar');
    const text = document.getElementById('global-progress-percent');

    if (bar) bar.style.width = percent + '%';
    if (text) text.textContent = percent + '%';
}

function renderMemberFilters() {
    const container = document.getElementById('member-initials-filters');
    if (!container) return;

    const team = [...new Set(tasks.map(t => t.assignee))].filter(m => m && m !== 'Membro');

    let html = `<div class="member-chip ${currentMemberFilter === 'Todos' ? 'active' : ''}" onclick="filterByMember('Todos')" title="Ver todos">All</div>`;

    team.forEach(name => {
        const initials = getInitials(name);
        html += `<div class="member-chip ${currentMemberFilter === name ? 'active' : ''}" 
                      style="background-color: ${getUserColor(name)}" 
                      onclick="filterByMember('${name}')" 
                      title="${name}">${initials}</div>`;
    });

    container.innerHTML = html;
}

window.filterByMember = function (member) {
    currentMemberFilter = member;
    renderMemberFilters();
    renderTasks(searchInput.value);
};

function renderAllViews() {
    renderTasks(searchInput ? searchInput.value : '');
    renderMyTasks();
    renderTeam();
}

// Initialize
async function init() {
    currentUser = localStorage.getItem('userName') || 'Visitante';

    const nameEl = document.querySelector('.user-profile .user-name');
    const statusEl = document.querySelector('.user-profile .user-status');
    const avatarImg = document.getElementById('user-avatar');

    if (nameEl) nameEl.textContent = currentUser;
    if (statusEl) statusEl.textContent = currentUser === 'Visitante' ? 'Convidado' : 'Equipe Zello';

    if (avatarImg) {
        const initialsCircle = document.createElement('div');
        initialsCircle.className = 'user-avatar-initials';
        initialsCircle.style.backgroundColor = getUserColor(currentUser);
        initialsCircle.textContent = getInitials(currentUser);
        avatarImg.parentNode.replaceChild(initialsCircle, avatarImg);
    }

    setupEventListeners();
    await loadTasksFromServer();
    switchView('dashboard');

    setInterval(updateClock, 1000);
    updateClock();
}

function updateClock() {
    const now = new Date();
    const clockEl = document.getElementById('digital-clock');
    if (clockEl) clockEl.textContent = now.toLocaleTimeString('pt-BR', { hour12: false });
}

function switchView(viewId) {
    views.forEach(v => v.classList.remove('active'));
    navItems.forEach(n => n.classList.remove('active'));

    const viewEl = document.getElementById(`view-${viewId}`);
    const navEl = document.getElementById(`nav-${viewId}`);

    if (viewEl) viewEl.classList.add('active');
    if (navEl) navEl.classList.add('active');

    renderAllViews();
}

function getInitials(name) {
    if (!name || name === 'Visitante') return 'V';
    return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
}

function getUserColor(name) {
    const colors = ['#0ea5e9', '#6366f1', '#ec4899', '#f43f5e', '#f59e0b', '#84cc16', '#10b981', '#06b6d4'];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
}

function updateCounters() {
    if (document.getElementById('count-todo')) document.getElementById('count-todo').textContent = tasks.filter(t => t.status === 'todo').length;
    if (document.getElementById('count-progress')) document.getElementById('count-progress').textContent = tasks.filter(t => t.status === 'in-progress').length;
    if (document.getElementById('count-done')) document.getElementById('count-done').textContent = tasks.filter(t => t.status === 'done').length;
}

function renderTasks(filterText = '') {
    if (!todoList || !progressList || !doneList) return;
    todoList.innerHTML = '';
    progressList.innerHTML = '';
    doneList.innerHTML = '';

    const activeF = document.querySelector('.filter.active');
    const filter = activeF ? activeF.textContent : 'Todos';

    const filtered = tasks.filter(t => {
        const matchesSearch = t.title.toLowerCase().includes(filterText.toLowerCase()) ||
            (t.description && t.description.toLowerCase().includes(filterText.toLowerCase()));
        const matchesCategory = filter === 'Todos' ||
            (filter === 'Urgentes' && t.priority === 'high') ||
            (filter === 'Pendentes' && t.status !== 'done');
        const matchesMember = currentMemberFilter === 'Todos' || t.assignee === currentMemberFilter;
        return matchesSearch && matchesCategory && matchesMember;
    });

    filtered.forEach(task => {
        const card = createTaskCard(task);
        if (task.status === 'todo') todoList.appendChild(card);
        else if (task.status === 'in-progress') progressList.appendChild(card);
        else if (task.status === 'done') doneList.appendChild(card);
    });
    updateCounters();
}

function createTaskCard(task) {
    const div = document.createElement('div');
    div.className = 'task-card';

    // Check for deadline alerts
    if (task.endDate && task.status !== 'done') {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const deadline = new Date(task.endDate);
        const diffTime = deadline - today;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays < 0) div.classList.add('urgent-deadline'); // Expired
        else if (diffDays <= 1) div.classList.add('urgent-deadline'); // Today or Tomorrow
        else if (diffDays <= 3) div.classList.add('warning-deadline'); // Approaching
    }

    div.draggable = true;
    div.dataset.id = task.id;

    div.ondragstart = (e) => {
        e.dataTransfer.setData('text/plain', task.id);
        div.classList.add('dragging');
        if (audioCtx.state === 'suspended') audioCtx.resume();
    };
    div.ondragend = () => div.classList.remove('dragging');

    div.innerHTML = `
        <div class="task-card-header" style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.8rem;">
            <span class="task-priority priority-${task.priority}">${task.priority}</span>
            ${div.classList.contains('urgent-deadline') ? '<span style="color:var(--urgent); font-size: 0.7rem; font-weight:700;"><i class="fas fa-fire"></i> URGENTE</span>' : ''}
        </div>
        <h3 style="margin-bottom: 0.5rem; font-size: 1rem;">${task.title}</h3>
        <p class="task-description" style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 1rem;">${task.description || ''}</p>
        <div class="task-footer" style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--glass-border); padding-top: 0.8rem;">
            <div class="task-assignee" style="display: flex; align-items: center; gap: 0.5rem;">
                <div class="user-avatar-circle" style="background-color: ${getUserColor(task.assignee)}">${getInitials(task.assignee)}</div>
                <span style="font-size: 0.8rem;">${task.assignee}</span>
            </div>
            <div class="task-actions" style="display: flex; gap: 0.8rem; color: var(--text-muted);">
                <i class="fas fa-edit" style="cursor: pointer;" onclick="editTask('${task.id}')"></i>
                <i class="fas fa-trash" style="cursor: pointer;" onclick="deleteTask('${task.id}')"></i>
                <i class="fas fa-arrow-right" style="cursor: pointer;" onclick="moveTask('${task.id}')"></i>
            </div>
        </div>
    `;
    return div;
}

async function saveTasks(task, method = 'POST') {
    const payload = { ...task };
    delete payload._id;

    try {
        const response = await fetch('/api/tasks', {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!response.ok) throw new Error('Falha ao salvar');
        await loadTasksFromServer();
    } catch (error) {
        console.error('Erro:', error);
        notifyUser('Erro ao salvar no banco.');
    }
}

window.moveTask = async function (id) {
    const task = tasks.find(t => t.id == id);
    if (!task) return;
    if (audioCtx.state === 'suspended') audioCtx.resume();

    const oldStatus = task.status;
    const nextMap = { 'todo': 'in-progress', 'in-progress': 'done', 'done': 'todo' };
    task.status = nextMap[task.status];

    renderAllViews();
    updateGlobalProgress();

    if (task.status === 'done' && oldStatus !== 'done') {
        playSound('success');
        confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 }, colors: ['#38bdf8', '#10b981', '#f59e0b'] });
        notifyUser('🎉 Excelente trabalho! Tarefa concluída!');
    } else {
        playSound('move');
    }

    await saveTasks(task, 'PUT');
};

window.deleteTask = async function (id) {
    if (confirm('Excluir tarefa?')) {
        const response = await fetch(`/api/tasks?id=${id}`, { method: 'DELETE' });
        if (response.ok) await loadTasksFromServer();
    }
};

window.editTask = function (id) {
    const task = tasks.find(t => t.id == id);
    if (!task) return;
    editingTaskId = id;
    document.querySelector('.modal-header h3').textContent = 'Editar Tarefa';
    document.getElementById('task-title').value = task.title;
    document.getElementById('task-description').value = task.description || '';
    document.getElementById('task-priority').value = task.priority;
    document.getElementById('task-assignee').value = task.assignee;
    document.getElementById('task-start-date').value = task.startDate || '';
    document.getElementById('task-end-date').value = task.endDate || '';
    taskModal.style.display = 'flex';
};

function setupEventListeners() {
    if (openModalBtn) openModalBtn.onclick = () => {
        taskModal.style.display = 'flex';
        taskForm.reset();
        editingTaskId = null;
        document.querySelector('.modal-header h3').textContent = 'Nova Tarefa';
        document.getElementById('task-start-date').value = new Date().toISOString().split('T')[0];
        document.getElementById('task-assignee').value = currentUser;
    };
    if (closeModalBtn) closeModalBtn.onclick = () => taskModal.style.display = 'none';

    if (taskForm) {
        taskForm.onsubmit = async (e) => {
            e.preventDefault();
            const data = {
                title: document.getElementById('task-title').value,
                description: document.getElementById('task-description').value,
                priority: document.getElementById('task-priority').value,
                assignee: document.getElementById('task-assignee').value || 'Membro',
                startDate: document.getElementById('task-start-date').value,
                endDate: document.getElementById('task-end-date').value,
                startTime: '',
                endTime: ''
            };
            if (editingTaskId) await saveTasks({ ...tasks.find(t => t.id == editingTaskId), ...data }, 'PUT');
            else await saveTasks({ ...data, id: Date.now().toString(), status: 'todo' }, 'POST');
            taskModal.style.display = 'none';
        };
    }

    document.querySelectorAll('.column').forEach(column => {
        column.addEventListener('dragover', (e) => e.preventDefault());
        column.addEventListener('drop', async (e) => {
            e.preventDefault();
            if (audioCtx.state === 'suspended') audioCtx.resume();
            const id = e.dataTransfer.getData('text/plain');
            const task = tasks.find(t => t.id == id);
            if (task && task.status !== column.id) {
                const oldStatus = task.status;
                task.status = column.id;
                renderAllViews();
                updateGlobalProgress();

                if (task.status === 'done' && oldStatus !== 'done') {
                    playSound('success');
                    confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 }, colors: ['#38bdf8', '#10b981', '#f59e0b'] });
                    notifyUser('🎉 Tarefa finalizada!');
                } else {
                    playSound('move');
                }

                await saveTasks(task, 'PUT');
            }
        });
    });

    if (themeToggle) themeToggle.onclick = () => {
        document.body.classList.toggle('light-theme');
        localStorage.setItem('theme', document.body.classList.contains('light-theme') ? 'light' : 'dark');
        const i = themeToggle.querySelector('i');
        if (i) i.className = document.body.classList.contains('light-theme') ? 'fas fa-sun' : 'fas fa-moon';
    };

    filters.forEach(f => f.onclick = () => {
        filters.forEach(x => x.classList.remove('active'));
        f.classList.add('active');
        renderTasks(searchInput.value);
    });

    navItems.forEach(i => i.onclick = (e) => {
        e.preventDefault();
        switchView(i.id.replace('nav-', ''));
    });

    if (logoutBtn) logoutBtn.onclick = () => { localStorage.clear(); window.location.href = 'login.html'; };
    if (searchInput) searchInput.oninput = (e) => renderTasks(e.target.value);
}

function updateProductivityStats() {
    const done = tasks.filter(t => t.status === 'done').length;
    const eff = tasks.length === 0 ? 0 : Math.round((done / tasks.length) * 100);
    if (document.getElementById('stat-total-done')) document.getElementById('stat-total-done').textContent = done;
    if (document.getElementById('stat-efficiency')) document.getElementById('stat-efficiency').textContent = eff + '%';
}

function renderMyTasks() {
    const list = document.getElementById('my-tasks-list');
    if (!list) return;
    list.innerHTML = '';
    const my = tasks.filter(t => t.assignee === currentUser);
    if (my.length === 0) list.innerHTML = '<p style="text-align: center; color: var(--text-muted); padding: 2rem;">Nenhuma tarefa para você.</p>';
    else my.forEach(t => list.appendChild(createTaskCard(t)));
}

function renderTeam() {
    const grid = document.getElementById('team-stats-grid');
    if (!grid) return;
    grid.innerHTML = '';
    const team = [...new Set(tasks.map(t => t.assignee))].filter(m => m && m !== 'Membro');
    team.forEach(m => {
        const card = document.createElement('div');
        card.className = 'team-card';
        card.innerHTML = `<div class="team-avatar-circle" style="background-color:${getUserColor(m)}">${getInitials(m)}</div><h3 style="text-align:center">${m}</h3>`;
        grid.appendChild(card);
    });
}

function notifyUser(msg) {
    const toast = document.createElement('div');
    toast.className = 'toast-notification';
    toast.innerHTML = `<i class="fas fa-info-circle"></i> <span>${msg}</span>`;
    document.body.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 100);
    setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 300); }, 3000);
}

init();
