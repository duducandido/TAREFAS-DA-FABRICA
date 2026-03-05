// Auth Check
if (!localStorage.getItem('isLoggedIn') && !window.location.href.includes('login.html')) {
    window.location.href = 'login.html';
}

// State Management
let currentUser = localStorage.getItem('userName') || 'Eduardo';
const teamMembers = [
    { name: 'Eduardo', role: 'Líder do Time', photo: 'Eduardo' },
    { name: 'Julia', role: 'Designer UI/UX', photo: 'Julia' },
    { name: 'Carlos', role: 'Engenheiro de Processos', photo: 'Carlos' },
    { name: 'Beatriz', role: 'Controle de Qualidade', photo: 'Beatriz' }
];

let tasks = [];

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

// Sound Effects (Web Audio API or simple Audio objects)
// We'll use a small "ping" for notifications later if desired, but let's stick to visuals for now to avoid large assets.

// Initialize
async function init() {
    currentUser = localStorage.getItem('userName') || 'Visitante';

    // Update Sidebar Profiling
    const nameEl = document.querySelector('.user-profile .user-name');
    const statusEl = document.querySelector('.user-profile .user-status');
    const avatarEl = document.getElementById('user-avatar');

    if (nameEl) nameEl.textContent = currentUser;
    if (statusEl) statusEl.textContent = currentUser === 'Visitante' ? 'Acesso Convidado' : 'Membro da Equipe';
    if (avatarEl) avatarEl.src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${currentUser}`;

    setupEventListeners();
    await loadTasksFromServer();

    // Default view
    switchView('dashboard');
}

function switchView(viewId) {
    views.forEach(v => v.classList.remove('active'));
    navItems.forEach(n => n.classList.remove('active'));

    document.getElementById(`view-${viewId}`).classList.add('active');
    document.getElementById(`nav-${viewId}`).classList.add('active');

    if (viewId === 'my-tasks') renderMyTasks();
    if (viewId === 'team') renderTeam();
    if (viewId === 'productivity') renderProductivity();
}

// Render Tasks
function renderTasks(filter = '') {
    // Clear lists
    todoList.innerHTML = '';
    progressList.innerHTML = '';
    doneList.innerHTML = '';

    const currentFilter = document.querySelector('.filter.active').textContent;

    let filteredTasks = tasks.filter(task =>
        task.title.toLowerCase().includes(filter.toLowerCase()) ||
        task.description.toLowerCase().includes(filter.toLowerCase())
    );

    // Apply category filters
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

function updateCounters() {
    const todoCount = tasks.filter(t => t.status === 'todo').length;
    const progressCount = tasks.filter(t => t.status === 'in-progress').length;
    const doneCount = tasks.filter(t => t.status === 'done').length;

    if (document.getElementById('count-todo')) document.getElementById('count-todo').textContent = todoCount;
    if (document.getElementById('count-progress')) document.getElementById('count-progress').textContent = progressCount;
    if (document.getElementById('count-done')) document.getElementById('count-done').textContent = doneCount;
}

// Create Task Card element
function createTaskCard(task) {
    const div = document.createElement('div');
    div.className = 'task-card';

    // Check for long duration (3+ days)
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
                <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=${task.assignee}" alt="${task.assignee}">
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

// Save / Update to MongoDB
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

// Task Actions
let editingTaskId = null;

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
            colors: ['#4f46e5', '#a855f7', '#10b981']
        });
        notifyUser('🎉 Parabéns! Tarefa concluída!');
    } else {
        notifyUser('Tarefa movida!');
    }
}

function renderMyTasks() {
    const list = document.getElementById('my-tasks-list');
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
    grid.innerHTML = '';

    teamMembers.forEach(member => {
        const memberTasks = tasks.filter(t => t.assignee === member.name);
        const completed = memberTasks.filter(t => t.status === 'done').length;
        const total = memberTasks.length;
        const progress = total === 0 ? 0 : Math.round((completed / total) * 100);

        const card = document.createElement('div');
        card.className = 'team-card';
        card.innerHTML = `
            <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=${member.photo}" alt="${member.name}">
            <h3>${member.name}</h3>
            <span class="role">${member.role}</span>
            <div class="progress-bar-container">
                <div class="progress-bar" style="width: ${progress}%"></div>
            </div>
            <div style="font-size: 0.75rem; color: var(--text-muted);">
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

    document.getElementById('stat-total-done').textContent = done;
    document.getElementById('stat-hours-planned').textContent = `${Math.floor(totalMinutes / 60)}h`;
    document.getElementById('stat-efficiency').textContent = `${efficiency}%`;
}

// Event Listeners
function setupEventListeners() {
    // Modal
    openModalBtn.onclick = () => taskModal.style.display = 'flex';
    closeModalBtn.onclick = () => taskModal.style.display = 'none';
    window.onclick = (e) => { if (e.target === taskModal) taskModal.style.display = 'none'; };

    // Form Submit
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

        // Validation: End must be after start
        if (startDate && endDate) {
            const startStr = `${startDate}T${startTime || '00:00'}`;
            const endStr = `${endDate}T${endTime || '23:59'}`;
            if (new Date(startStr) >= new Date(endStr)) {
                alert('Erro: A data/horário de término deve ser posterior ao início!');
                return;
            }
        }

        if (editingTaskId) {
            const task = { ...tasks.find(t => t.id === editingTaskId), title, description, priority, assignee, startDate, endDate, startTime, endTime };
            await saveTasks(task, 'PUT');
            notifyUser('Tarefa atualizada!');
            editingTaskId = null;
        } else {
            const newTask = {
                id: Date.now().toString(),
                title,
                description,
                priority,
                assignee,
                startDate,
                endDate,
                startTime,
                endTime,
                status: 'todo'
            };
            await saveTasks(newTask, 'POST');
            notifyUser('Tarefa criada com sucesso!');
        }

        taskForm.reset();
        taskModal.style.display = 'none';
        document.querySelector('.modal-header h3').textContent = 'Criar Nova Tarefa';
    };

    // Theme Toggle
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

    // Filters
    filters.forEach(filter => {
        filter.onclick = () => {
            // Animate click
            filter.style.transform = 'scale(0.95)';
            setTimeout(() => filter.style.transform = 'scale(1)', 100);

            filters.forEach(f => f.classList.remove('active'));
            filter.classList.add('active');
            renderTasks(searchInput.value);
        };
    });

    // Sidebar Navigation
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

    // Logout
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

    // Search
    searchInput.oninput = (e) => renderTasks(e.target.value);
}

// Drag & Drop
function allowDrop(ev) {
    ev.preventDefault();
}

// Add these to make the columns highlight
document.querySelectorAll('.column').forEach(column => {
    column.ondragenter = (e) => column.classList.add('drag-over');
    column.ondragleave = (e) => column.classList.remove('drag-over');
});

async function drop(ev) {
    ev.preventDefault();
    ev.currentTarget.classList.remove('drag-over');
    const id = ev.dataTransfer.getData('text/plain');
    const targetStatus = ev.currentTarget.id; // e.g., 'todo', 'in-progress'

    const task = tasks.find(t => t.id === id);
    if (task) {
        const oldStatus = task.status;
        task.status = targetStatus;

        if (oldStatus !== 'done' && targetStatus === 'done') {
            confetti({
                particleCount: 100,
                spread: 60,
                origin: { y: 0.7 }
            });
            notifyUser('🎉 Excelente trabalho!');
        } else {
            notifyUser('Status atualizado');
        }

        await saveTasks(task, 'PUT');
        renderTasks(searchInput.value);
        updateProductivityStats();
    }
}

// Utilities
function calculateDuration(startDate, startTime, endDate, endTime) {
    if (!startDate || !startTime || !endDate || !endTime) return 'Duração N/A';

    const start = new Date(`${startDate}T${startTime}`);
    const end = new Date(`${endDate}T${endTime}`);

    let diffInMinutes = Math.floor((end - start) / 1000 / 60);

    if (diffInMinutes < 0) return 'Inválido';

    const days = Math.floor(diffInMinutes / (24 * 60));
    diffInMinutes = diffInMinutes % (24 * 60);

    const hours = Math.floor(diffInMinutes / 60);
    const mins = diffInMinutes % 60;

    let result = '';
    if (days > 0) result += `${days}d `;
    if (hours > 0) result += `${hours}h `;
    if (mins > 0 || (days === 0 && hours === 0)) result += `${mins}m`;

    return result.trim();
}

function notifyUser(msg) {
    const toast = document.createElement('div');
    toast.className = 'toast-notification';
    toast.innerHTML = `
        <i class="fas fa-check-circle"></i>
        <span>${msg}</span>
    `;
    document.body.appendChild(toast);

    // Fade in and out
    setTimeout(() => toast.classList.add('show'), 100);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Start app
init();
