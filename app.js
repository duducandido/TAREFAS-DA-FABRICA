// Auth Check
if (!localStorage.getItem('isLoggedIn') && !window.location.href.includes('login.html')) {
    window.location.href = 'login.html';
}

// State Management
let currentUser = localStorage.getItem('userName') || 'Eduardo';
let tasks = [];
let editingTaskId = null;

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

// Load Tasks from MongoDB
async function loadTasksFromServer() {
    try {
        const response = await fetch('/api/tasks');
        if (response.ok) {
            tasks = await response.json();
            renderTasks();
            updateProductivityStats();
        }
    } catch (error) {
        console.error('Erro ao carregar tarefas:', error);
        notifyUser('Erro ao conectar com o servidor.');
    }
}

// Initialize
async function init() {
    currentUser = localStorage.getItem('userName') || 'Visitante';

    const nameEl = document.querySelector('.user-profile .user-name');
    const statusEl = document.querySelector('.user-profile .user-status');
    const avatarEl = document.getElementById('user-avatar');

    if (nameEl) nameEl.textContent = currentUser;
    if (statusEl) statusEl.textContent = currentUser === 'Visitante' ? 'Acesso Convidado' : 'Membro da Equipe';

    if (avatarEl) {
        const initialsCircle = document.createElement('div');
        initialsCircle.className = 'user-avatar-initials';
        initialsCircle.style.backgroundColor = getUserColor(currentUser);
        initialsCircle.textContent = getInitials(currentUser);
        avatarEl.parentNode.replaceChild(initialsCircle, avatarEl);
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
    if (viewId === 'my-tasks') renderMyTasks();
    if (viewId === 'team') renderTeam();
    if (viewId === 'productivity') renderProductivity();
}

function getInitials(name) {
    if (!name || name === 'Visitante') return 'V';
    return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
}

function getUserColor(name) {
    const colors = ['#38bdf8', '#7c3aed', '#db2777', '#dc2626', '#ea580c', '#ca8a04', '#16a34a', '#0891b2'];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
}

function updateCounters() {
    const todo = tasks.filter(t => t.status === 'todo').length;
    const progress = tasks.filter(t => t.status === 'in-progress').length;
    const done = tasks.filter(t => t.status === 'done').length;
    if (document.getElementById('count-todo')) document.getElementById('count-todo').textContent = todo;
    if (document.getElementById('count-progress')) document.getElementById('count-progress').textContent = progress;
    if (document.getElementById('count-done')) document.getElementById('count-done').textContent = done;
}

function renderTasks(filter = '') {
    if (!todoList || !progressList || !doneList) return;
    todoList.innerHTML = '';
    progressList.innerHTML = '';
    doneList.innerHTML = '';

    const filterActive = document.querySelector('.filter.active');
    const currentFilter = filterActive ? filterActive.textContent : 'Todos';

    const filtered = tasks.filter(t =>
        (t.title.toLowerCase().includes(filter.toLowerCase()) ||
            (t.description && t.description.toLowerCase().includes(filter.toLowerCase()))) &&
        (currentFilter === 'Todos' || (currentFilter === 'Urgentes' && t.priority === 'high') || (currentFilter === 'Pendentes' && t.status !== 'done'))
    );

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
    if (task.startDate && task.endDate) {
        const start = new Date(`${task.startDate}T${task.startTime || '00:00'}`);
        const end = new Date(`${task.endDate}T${task.endTime || '23:59'}`);
        if (!isNaN(start) && !isNaN(end) && (end - start) / (1000 * 60 * 60 * 24) >= 3) {
            div.classList.add('task-long-duration');
        }
    }
    div.draggable = true;
    div.dataset.id = task.id;

    // Drag data
    div.ondragstart = (e) => {
        e.dataTransfer.setData('text/plain', task.id);
        div.classList.add('dragging');
    };
    div.ondragend = () => div.classList.remove('dragging');

    div.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: start;">
            <span class="task-priority priority-${task.priority}">${task.priority}</span>
            ${div.classList.contains('task-long-duration') ? '<span style="font-size: 0.65rem; color: #f59e0b; font-weight: 700;"><i class="fas fa-exclamation-triangle"></i> Longa</span>' : ''}
        </div>
        <h3>${task.title}</h3>
        <p class="task-description">${task.description || ''}</p>
        <div class="task-date-time">
            <span><i class="fas fa-calendar-alt"></i> ${task.startDate || ''}</span>
            ${task.startTime ? `<span><i class="fas fa-clock"></i> ${task.startTime} - ${task.endTime || ''}</span>` : ''}
        </div>
        <div class="task-footer">
            <div class="task-assignee">
                <div class="user-avatar-circle" style="background-color: ${getUserColor(task.assignee)}">${getInitials(task.assignee)}</div>
                <span>${task.assignee}</span>
            </div>
            <div class="task-actions">
                <i class="fas fa-edit" onclick="editTask('${task.id}')"></i>
                <i class="fas fa-trash" onclick="deleteTask('${task.id}')"></i>
                <i class="fas fa-arrow-right" onclick="moveTask('${task.id}')"></i>
            </div>
        </div>
    `;
    return div;
}

async function saveTasks(task, method = 'POST') {
    try {
        const response = await fetch('/api/tasks', {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(task)
        });
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || 'Erro ao sincronizar');
        }
        await loadTasksFromServer();
    } catch (error) {
        console.error('Save Error:', error);
        notifyUser('Erro: ' + error.message);
    }
}

window.moveTask = async function (id) {
    const task = tasks.find(t => t.id == id);
    if (!task) return;
    const order = ['todo', 'in-progress', 'done', 'todo'];
    task.status = order[order.indexOf(task.status) + 1];

    // Feedback visual imediato
    renderTasks(searchInput.value);
    await saveTasks(task, 'PUT');

    if (task.status === 'done') {
        confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 }, colors: ['#38bdf8', '#10b981', '#f59e0b'] });
        notifyUser('🎉 Concluída!');
    }
};

window.deleteTask = async function (id) {
    if (confirm('Deseja excluir?')) {
        const response = await fetch(`/api/tasks?id=${id}`, { method: 'DELETE' });
        if (response.ok) {
            await loadTasksFromServer();
            notifyUser('Excluída!');
        }
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
    document.getElementById('task-start-time').value = task.startTime || '';
    document.getElementById('task-end-time').value = task.endTime || '';
    taskModal.style.display = 'flex';
};

function setupEventListeners() {
    if (openModalBtn) openModalBtn.onclick = () => {
        taskModal.style.display = 'flex';
        taskForm.reset();
        editingTaskId = null;
        document.querySelector('.modal-header h3').textContent = 'Criar Nova Tarefa';
        const now = new Date();
        document.getElementById('task-start-date').value = now.toISOString().split('T')[0];
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
                startTime: document.getElementById('task-start-time').value,
                endTime: document.getElementById('task-end-time').value
            };
            if (editingTaskId) await saveTasks({ ...tasks.find(t => t.id == editingTaskId), ...data }, 'PUT');
            else await saveTasks({ ...data, id: Date.now().toString(), status: 'todo' }, 'POST');
            taskForm.reset();
            taskModal.style.display = 'none';
        };
    }

    // Drag & Drop Listeners
    document.querySelectorAll('.column').forEach(column => {
        column.addEventListener('dragover', (e) => e.preventDefault());
        column.addEventListener('dragenter', (e) => {
            e.preventDefault();
            column.classList.add('drag-over');
        });
        column.addEventListener('dragleave', () => column.classList.remove('drag-over'));
        column.addEventListener('drop', async (e) => {
            e.preventDefault();
            column.classList.remove('drag-over');
            const id = e.dataTransfer.getData('text/plain');
            const target = column.id;
            const task = tasks.find(t => t.id == id);
            if (task && task.status !== target) {
                task.status = target;
                renderTasks(searchInput.value); // Atualiza UI na hora
                await saveTasks(task, 'PUT');
            }
        });
    });

    if (themeToggle) themeToggle.onclick = () => {
        document.body.classList.toggle('light-theme');
        localStorage.setItem('theme', document.body.classList.contains('light-theme') ? 'light' : 'dark');
        const icon = themeToggle.querySelector('i');
        if (icon) icon.className = document.body.classList.contains('light-theme') ? 'fas fa-sun' : 'fas fa-moon';
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

    if (logoutBtn) logoutBtn.onclick = () => { localStorage.removeItem('isLoggedIn'); window.location.href = 'login.html'; };
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
    if (my.length === 0) list.innerHTML = '<p class="text-muted">Sem tarefas.</p>';
    else my.forEach(t => list.appendChild(createTaskCard(t)));
}

function renderTeam() {
    const grid = document.getElementById('team-stats-grid');
    if (!grid) return;
    grid.innerHTML = '';
    const members = [...new Set(tasks.map(t => t.assignee))];
    members.forEach(m => {
        const card = document.createElement('div');
        card.className = 'team-card';
        card.innerHTML = `<div class="team-avatar-circle" style="background-color: ${getUserColor(m)}">${getInitials(m)}</div><h3>${m}</h3>`;
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
