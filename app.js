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
        } else {
            console.error('Falha na resposta da API');
        }
    } catch (error) {
        console.error('Erro ao carregar tarefas:', error);
        notifyUser('Conectando ao banco de dados...');
    }
}

// Initialize
async function init() {
    currentUser = localStorage.getItem('userName') || 'Visitante';

    // Update Sidebar Profiling
    const nameEl = document.querySelector('.user-profile .user-name');
    const statusEl = document.querySelector('.user-profile .user-status');
    const avatarEl = document.getElementById('user-avatar');

    if (nameEl) nameEl.textContent = currentUser;
    if (statusEl) statusEl.textContent = currentUser === 'Visitante' ? 'Acesso Convidado' : 'Membro da Equipe';

    // Update Sidebar Avatar (with initials)
    if (avatarEl) {
        const initialsCircle = document.createElement('div');
        initialsCircle.className = 'user-avatar-initials';
        initialsCircle.style.backgroundColor = getUserColor(currentUser);
        initialsCircle.textContent = getInitials(currentUser);
        avatarEl.parentNode.replaceChild(initialsCircle, avatarEl);
    }

    setupEventListeners();
    await loadTasksFromServer();

    // Default view
    switchView('dashboard');

    // Start Clock
    setInterval(updateClock, 1000);
    updateClock();
}

function updateClock() {
    const now = new Date();
    const clockEl = document.getElementById('digital-clock');
    if (clockEl) {
        clockEl.textContent = now.toLocaleTimeString('pt-BR', { hour12: false });
    }
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

// Helper Functions for Initials/Colors
function getInitials(name) {
    if (!name || name === 'Visitante') return 'V';
    return name.split(' ')
        .map(n => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase();
}

function getUserColor(name) {
    const colors = [
        '#2563eb', '#7c3aed', '#db2777', '#dc2626',
        '#ea580c', '#ca8a04', '#16a34a', '#0891b2'
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
}

function updateCounters() {
    const todoCount = tasks.filter(t => t.status === 'todo').length;
    const progressCount = tasks.filter(t => t.status === 'in-progress').length;
    const doneCount = tasks.filter(t => t.status === 'done').length;

    if (document.getElementById('count-todo')) document.getElementById('count-todo').textContent = todoCount;
    if (document.getElementById('count-progress')) document.getElementById('count-progress').textContent = progressCount;
    if (document.getElementById('count-done')) document.getElementById('count-done').textContent = doneCount;
}

// Render Tasks
function renderTasks(filter = '') {
    todoList.innerHTML = '';
    progressList.innerHTML = '';
    doneList.innerHTML = '';

    const filterActive = document.querySelector('.filter.active');
    const currentFilter = filterActive ? filterActive.textContent : 'Todos';

    let filteredTasks = tasks.filter(task =>
        task.title.toLowerCase().includes(filter.toLowerCase()) ||
        task.description.toLowerCase().includes(filter.toLowerCase())
    );

    if (currentFilter === 'Urgentes') {
        filteredTasks = filteredTasks.filter(t => t.priority === 'high');
    } else if (currentFilter === 'Pendentes') {
        filteredTasks = filteredTasks.filter(t => t.status !== 'done');
    }

    filteredTasks.forEach(task => {
        const card = createTaskCard(task);
        if (task.status === 'todo') todoList.appendChild(card);
        if (task.status === 'in-progress') progressList.appendChild(card);
        if (task.status === 'done') doneList.appendChild(card);
    });

    updateCounters();
}

function createTaskCard(task) {
    const div = document.createElement('div');
    div.className = 'task-card';

    if (task.startDate && task.endDate) {
        const start = new Date(`${task.startDate}T${task.startTime || '00:00'}`);
        const end = new Date(`${task.endDate}T${task.endTime || '23:59'}`);
        if ((end - start) / (1000 * 60 * 60 * 24) >= 3) {
            div.classList.add('task-long-duration');
        }
    }

    div.draggable = true;
    div.dataset.id = task.id;
    div.ondragstart = (e) => e.dataTransfer.setData('text/plain', task.id);

    const isLong = div.classList.contains('task-long-duration');
    const initials = getInitials(task.assignee);
    const userColor = getUserColor(task.assignee);

    div.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: start;">
            <span class="task-priority priority-${task.priority}">${task.priority}</span>
            ${isLong ? '<span style="font-size: 0.65rem; color: #f59e0b; font-weight: 700; text-transform: uppercase;"><i class="fas fa-exclamation-triangle"></i> Longa</span>' : ''}
        </div>
        <h3>${task.title}</h3>
        <p class="task-description">${task.description}</p>
        <div class="task-date-time">
            <span><i class="fas fa-calendar-alt"></i> ${task.startDate || ''} ${task.endDate && task.endDate !== task.startDate ? 'até ' + task.endDate : ''}</span>
            ${task.startTime ? `<span><i class="fas fa-clock"></i> ${task.startTime} - ${task.endTime || ''} 
                <small style="opacity: 0.7">(${calculateDuration(task.startDate, task.startTime, task.endDate, task.endTime)})</small>
            </span>` : ''}
        </div>
        <div class="task-footer">
            <div class="task-assignee">
                <div class="user-avatar-circle" style="background-color: ${userColor}">
                    ${initials}
                </div>
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

// Task Handlers
async function saveTasks(task, method = 'POST') {
    try {
        const response = await fetch('/api/tasks', {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(task)
        });
        if (!response.ok) throw new Error('Falha ao salvar');
        await loadTasksFromServer();
    } catch (error) {
        console.error('Erro:', error);
        notifyUser('Erro ao salvar no banco de dados');
    }
}

async function deleteTask(id) {
    if (confirm('Deseja excluir esta tarefa?')) {
        try {
            const response = await fetch(`/api/tasks?id=${id}`, { method: 'DELETE' });
            if (response.ok) {
                await loadTasksFromServer();
                notifyUser('Tarefa excluída!');
            }
        } catch (error) {
            notifyUser('Erro ao excluir');
        }
    }
}

async function moveTask(id) {
    const task = tasks.find(t => t.id === id);
    if (!task) return;

    if (task.status === 'todo') task.status = 'in-progress';
    else if (task.status === 'in-progress') task.status = 'done';
    else task.status = 'todo';

    await saveTasks(task, 'PUT');

    if (task.status === 'done') {
        confetti({
            particleCount: 150,
            spread: 70,
            origin: { y: 0.6 },
            colors: ['#3b82f6', '#10b981', '#f59e0b']
        });
        notifyUser('🎉 Parabéns! Tarefa concluída!');
    } else {
        notifyUser('Tarefa movida!');
    }
}

function renderMyTasks() {
    const list = document.getElementById('my-tasks-list');
    if (!list) return;
    list.innerHTML = '';
    const myTasks = tasks.filter(t => t.assignee === currentUser);

    if (myTasks.length === 0) {
        list.innerHTML = '<p class="text-muted">Você não tem tarefas atribuídas.</p>';
        return;
    }

    myTasks.forEach(task => {
        const card = createTaskCard(task);
        list.appendChild(card);
    });
}

function renderTeam() {
    const grid = document.getElementById('team-stats-grid');
    if (!grid) return;
    grid.innerHTML = '';

    const assignees = [...new Set(tasks.map(t => t.assignee).filter(name => name && name !== 'Membro'))];

    if (assignees.length === 0) {
        grid.innerHTML = '<p class="text-muted" style="grid-column: 1/-1; text-align: center; padding: 2rem;">Aguardando atribuição de tarefas para exibir a equipe.</p>';
        return;
    }

    assignees.forEach(name => {
        const memberTasks = tasks.filter(t => t.assignee === name);
        const completed = memberTasks.filter(t => t.status === 'done').length;
        const total = memberTasks.length;
        const progress = total === 0 ? 0 : Math.round((completed / total) * 100);

        const card = document.createElement('div');
        card.className = 'team-card';
        card.innerHTML = `
            <div class="team-avatar-circle" style="background-color: ${getUserColor(name)}">
                ${getInitials(name)}
            </div>
            <h3>${name}</h3>
            <span class="role">${name === currentUser ? 'Você' : 'Membro da Equipe'}</span>
            <div class="progress-bar-container">
                <div class="progress-bar" style="width: ${progress}%"></div>
            </div>
            <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.5rem;">
                ${completed}/${total} Tarefas Concluídas
            </div>
        `;
        grid.appendChild(card);
    });
}

function renderProductivity() {
    updateProductivityStats();
}

function updateProductivityStats() {
    const done = tasks.filter(t => t.status === 'done').length;
    const total = tasks.length;
    const efficiency = total === 0 ? 0 : Math.round((done / total) * 100);

    let totalMinutes = 0;
    tasks.forEach(t => {
        if (t.startDate && t.endDate && t.startTime && t.endTime) {
            const start = new Date(`${t.startDate}T${t.startTime}`);
            const end = new Date(`${t.endDate}T${t.endTime}`);
            totalMinutes += Math.floor((end - start) / 1000 / 60);
        }
    });

    const totalDoneEl = document.getElementById('stat-total-done');
    const hoursPlannedEl = document.getElementById('stat-hours-planned');
    const efficiencyEl = document.getElementById('stat-efficiency');

    if (totalDoneEl) totalDoneEl.textContent = done;
    if (hoursPlannedEl) hoursPlannedEl.textContent = `${Math.floor(totalMinutes / 60)}h`;
    if (efficiencyEl) efficiencyEl.textContent = `${efficiency}%`;
}

// Global Edit function (needs to be global for onclick)
window.editTask = function (id) {
    const task = tasks.find(t => t.id === id);
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

// Event Listeners setup
function setupEventListeners() {
    // Modal
    openModalBtn.onclick = () => {
        taskModal.style.display = 'flex';
        taskForm.reset();
        editingTaskId = null;
        document.querySelector('.modal-header h3').textContent = 'Criar Nova Tarefa';

        const now = new Date();
        const dateString = now.toISOString().split('T')[0];
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const timeString = `${hours}:${minutes}`;

        document.getElementById('task-start-date').value = dateString;
        document.getElementById('task-start-time').value = timeString;
        document.getElementById('task-end-date').value = dateString;

        const endHours = String((now.getHours() + 1) % 24).padStart(2, '0');
        document.getElementById('task-end-time').value = `${endHours}:${minutes}`;
        document.getElementById('task-assignee').value = currentUser;
    };

    closeModalBtn.onclick = () => taskModal.style.display = 'none';
    window.onclick = (e) => { if (e.target === taskModal) taskModal.style.display = 'none'; };

    taskForm.onsubmit = async (e) => {
        e.preventDefault();

        const title = document.getElementById('task-title').value;
        const description = document.getElementById('task-description').value;
        const priority = document.getElementById('task-priority').value;
        const assignee = document.getElementById('task-assignee').value || 'Membro';
        const startDate = document.getElementById('task-start-date').value;
        const endDate = document.getElementById('task-end-date').value;
        const startTime = document.getElementById('task-start-time').value;
        const endTime = document.getElementById('task-end-time').value;

        if (startDate && endDate) {
            const startStr = `${startDate}T${startTime || '00:00'}`;
            const endStr = `${endDate}T${endTime || '23:59'}`;
            if (new Date(startStr) >= new Date(endStr)) {
                alert('Erro: A data/horário de término deve ser posterior ao início!');
                return;
            }
        }

        if (editingTaskId) {
            const task = {
                ...tasks.find(t => t.id === editingTaskId),
                title, description, priority, assignee, startDate, endDate, startTime, endTime
            };
            await saveTasks(task, 'PUT');
            notifyUser('Tarefa atualizada!');
            editingTaskId = null;
        } else {
            const newTask = {
                id: Date.now().toString(),
                title, description, priority, assignee, startDate, endDate, startTime, endTime,
                status: 'todo'
            };
            await saveTasks(newTask, 'POST');
            notifyUser('Tarefa criada com sucesso!');
        }

        taskForm.reset();
        taskModal.style.display = 'none';
    };

    themeToggle.onclick = () => {
        document.body.classList.toggle('light-theme');
        const icon = themeToggle.querySelector('i');
        if (document.body.classList.contains('light-theme')) {
            icon.className = 'fas fa-sun';
            localStorage.setItem('theme', 'light');
        } else {
            icon.className = 'fas fa-moon';
            localStorage.setItem('theme', 'dark');
        }
    };

    filters.forEach(filter => {
        filter.onclick = () => {
            filters.forEach(f => f.classList.remove('active'));
            filter.classList.add('active');
            renderTasks(searchInput.value);
        };
    });

    navItems.forEach(item => {
        item.onclick = (e) => {
            e.preventDefault();
            const view = item.id.replace('nav-', '');
            switchView(view);
        };
    });

    if (localStorage.getItem('theme') === 'light') {
        document.body.classList.add('light-theme');
        themeToggle.querySelector('i').className = 'fas fa-sun';
    }

    if (logoutBtn) {
        logoutBtn.onclick = (e) => {
            e.preventDefault();
            if (confirm('Deseja sair do sistema?')) {
                localStorage.removeItem('isLoggedIn');
                localStorage.removeItem('userEmail');
                localStorage.removeItem('userName');
                window.location.href = 'login.html';
            }
        };
    }

    searchInput.oninput = (e) => renderTasks(e.target.value);
}

// Drag & Drop
window.allowDrop = function (ev) {
    ev.preventDefault();
};

document.querySelectorAll('.column').forEach(column => {
    column.ondragenter = (e) => column.classList.add('drag-over');
    column.ondragleave = (e) => column.classList.remove('drag-over');
    column.ondrop = async (e) => {
        e.preventDefault();
        column.classList.remove('drag-over');
        const id = e.dataTransfer.getData('text/plain');
        const targetStatus = column.id;

        const task = tasks.find(t => t.id === id);
        if (task && task.status !== targetStatus) {
            task.status = targetStatus;
            await saveTasks(task, 'PUT');
            if (targetStatus === 'done') {
                confetti({ particleCount: 100, spread: 60, origin: { y: 0.7 } });
                notifyUser('🎉 Excelente trabalho!');
            } else {
                notifyUser('Status atualizado');
            }
        }
    };
});

// Utilities
function calculateDuration(startDate, startTime, endDate, endTime) {
    if (!startDate || !startTime || !endDate || !endTime) return 'Duração N/A';
    const start = new Date(`${startDate}T${startTime}`);
    const end = new Date(`${endDate}T${endTime}`);
    let diff = Math.floor((end - start) / 1000 / 60);
    if (diff < 0) return 'Inválido';
    const days = Math.floor(diff / (24 * 60));
    diff = diff % (24 * 60);
    const hours = Math.floor(diff / 60);
    const mins = diff % 60;
    let res = '';
    if (days > 0) res += `${days}d `;
    if (hours > 0) res += `${hours}h `;
    if (mins > 0 || (days === 0 && hours === 0)) res += `${mins}m`;
    return res.trim();
}

function notifyUser(msg) {
    const toast = document.createElement('div');
    toast.className = 'toast-notification';
    toast.innerHTML = `<i class="fas fa-check-circle"></i> <span>${msg}</span>`;
    document.body.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 100);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Start app
init();
