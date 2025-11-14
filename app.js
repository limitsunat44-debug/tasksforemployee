// Supabase Configuration
const SUPABASE_URL = 'https://crkaheknznmxqhxkjmve.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNya2FoZWtuem5teHFoeGtqbXZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE4OTM1NzUsImV4cCI6MjA3NzQ2OTU3NX0.nw70sunXPdqQNXDy_Z8UfJ4udXd83Nf5BMRLIlic_18';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Global state
let currentUser = null;
let allEmployees = [];
let allTasks = [];
let settings = {};

// Initialize app
document.addEventListener('DOMContentLoaded', async () => {
    await initializeDatabase();
    checkAuth();
});

// Database initialization
async function initializeDatabase() {
    try {
        // Check if admin exists
        const { data: adminExists } = await supabase
            .from('users')
            .select('id')
            .eq('username', 'admin')
            .single();

        if (!adminExists) {
            // Create admin user
            await supabase.from('users').insert({
                username: 'admin',
                password: 'admin123',
                role: 'admin',
                full_name: 'Администратор'
            });
        }

        // Check if settings exist
        const { data: settingsData } = await supabase
            .from('settings')
            .select('*');

        if (!settingsData || settingsData.length === 0) {
            // Create default settings
            await supabase.from('settings').insert([
                { name: 'silver_threshold', value: 20 },
                { name: 'gold_threshold', value: 50 }
            ]);
        }
    } catch (error) {
        console.error('Database initialization error:', error);
    }
}

// Authentication - ✅ ОБНОВЛЕНО С ПОДДЕРЖКОЙ LOCALSTORAGE
function checkAuth() {
    // ✅ Сначала проверяем localStorage
    const savedUser = localStorage.getItem('currentUser');
    
    if (savedUser) {
        try {
            currentUser = JSON.parse(savedUser);
            console.log('✅ Пользователь восстановлен из localStorage:', currentUser.username);
        } catch (error) {
            console.error('❌ Ошибка при загрузке пользователя из localStorage:', error);
            localStorage.removeItem('currentUser');
            showLoginPage();
            return;
        }
    }
    
    // Затем проверяем currentUser переменную
    if (currentUser) {
        if (currentUser.role === 'admin') {
            showAdminPanel();
        } else {
            showEmployeePanel();
        }
    } else {
        showLoginPage();
    }
}

function showLoginPage() {
    document.getElementById('loginPage').classList.remove('hidden');
    document.getElementById('adminPanel').classList.add('hidden');
    document.getElementById('employeePanel').classList.add('hidden');
}

function showAdminPanel() {
    document.getElementById('loginPage').classList.add('hidden');
    document.getElementById('adminPanel').classList.remove('hidden');
    document.getElementById('employeePanel').classList.add('hidden');
    document.getElementById('adminUsername').textContent = currentUser.full_name || currentUser.username;
    loadAdminData();
}

function showEmployeePanel() {
    document.getElementById('loginPage').classList.add('hidden');
    document.getElementById('adminPanel').classList.add('hidden');
    document.getElementById('employeePanel').classList.remove('hidden');
    document.getElementById('employeeUsername').textContent = currentUser.full_name || currentUser.username;
    loadEmployeeData();
}

// Login form - ✅ ОБНОВЛЕНО С СОХРАНЕНИЕМ СЕССИИ
document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const errorDiv = document.getElementById('loginError');

    try {
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('username', username)
            .eq('password', password)
            .single();

        if (error || !data) {
            errorDiv.textContent = 'Неверное имя пользователя или пароль';
            errorDiv.classList.remove('hidden');
            return;
        }

        // Check and reset points if needed
        await checkAndResetPoints(data);

        // Reload user data after potential reset
        const { data: userData } = await supabase
            .from('users')
            .select('*')
            .eq('id', data.id)
            .single();

        currentUser = userData;
        
        // ✅ СОХРАНЯЕМ ПОЛЬЗОВАТЕЛЯ В LOCALSTORAGE
        localStorage.setItem('currentUser', JSON.stringify(userData));
        console.log('💾 Пользователь сохранен в localStorage');

        if (currentUser.role === 'admin') {
            showAdminPanel();
        } else {
            showEmployeePanel();
        }
    } catch (error) {
        console.error('Login error:', error);
        errorDiv.textContent = 'Произошла ошибка при входе';
        errorDiv.classList.remove('hidden');
    }
});

// ✅ ОБНОВЛЕНО - LOGOUT УДАЛЯЕТ ИЗ LOCALSTORAGE
function logout() {
    currentUser = null;
    localStorage.removeItem('currentUser');
    console.log('🚪 Пользователь вышел из системы');
    showLoginPage();
}

// Check and reset points based on date
async function checkAndResetPoints(user) {
    const now = new Date();
    const lastLogin = new Date(user.created_at);
    
    // Check if new month
    if (now.getMonth() !== lastLogin.getMonth() || now.getFullYear() !== lastLogin.getFullYear()) {
        await supabase
            .from('users')
            .update({ points_current_month: 0 })
            .eq('id', user.id);
    }

    // Check if new week (Monday)
    const currentWeekStart = getWeekStart(now);
    const lastWeekStart = getWeekStart(lastLogin);
    
    if (currentWeekStart.getTime() !== lastWeekStart.getTime()) {
        await supabase
            .from('users')
            .update({ points_current_week: 0 })
            .eq('id', user.id);
    }
}

function getWeekStart(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
}

// Admin Panel Functions
async function loadAdminData() {
    await loadSettings();
    await loadAllEmployees();
    await loadAllTasks();
    updateAdminDashboard();
}

async function loadSettings() {
    const { data } = await supabase.from('settings').select('*');
    if (data) {
        data.forEach(setting => {
            settings[setting.name] = setting.value;
        });
        document.getElementById('silverThreshold').value = settings.silver_threshold || 20;
        document.getElementById('goldThreshold').value = settings.gold_threshold || 50;
    }
}

async function loadAllEmployees() {
    const { data } = await supabase
        .from('users')
        .select('*')
        .eq('role', 'employee')
        .order('created_at', { ascending: false });
    
    allEmployees = data || [];
    updateEmployeesTable();
}

async function loadAllTasks() {
    const { data } = await supabase
        .from('tasks')
        .select('*, employee:users!tasks_employee_id_fkey(full_name)')
        .order('created_at', { ascending: false });
    
    allTasks = data || [];
    updateTasksTable();
    updateAllTasksTable();
}

function updateAdminDashboard() {
    const totalEmployees = allEmployees.length;
    const totalTasks = allTasks.length;
    const completedTasks = allTasks.filter(t => t.status === 'completed').length;
    const inProgressTasks = allTasks.filter(t => t.status === 'in_progress').length;

    const statsHTML = `
        <div class="stat-card">
            <h4>Всего сотрудников</h4>
            <div class="value">${totalEmployees}</div>
        </div>
        <div class="stat-card">
            <h4>Всего задач</h4>
            <div class="value">${totalTasks}</div>
        </div>
        <div class="stat-card">
            <h4>Выполнено задач</h4>
            <div class="value">${completedTasks}</div>
        </div>
        <div class="stat-card">
            <h4>В процессе</h4>
            <div class="value">${inProgressTasks}</div>
        </div>
    `;
    document.getElementById('adminStats').innerHTML = statsHTML;
}

function updateAllTasksTable() {
    const tbody = document.getElementById('allTasksBody');
    tbody.innerHTML = allTasks.map(task => `
        <tr>
            <td>${task.title}</td>
            <td>${task.employee?.full_name || 'Не назначен'}</td>
            <td><span class="urgency-badge urgency-${task.urgency}">${task.urgency === 'urgent' ? 'Срочно' : 'Обычно'}</span></td>
            <td><span class="task-status-badge task-status-${task.status}">${getTaskStatusLabel(task.status)}</span></td>
            <td>
                <div class="progress-bar">
                    <div class="progress-bar-fill" style="width: ${task.progress_percent}%"></div>
                </div>
                <small style="color: var(--text-secondary);">${task.progress_percent}%</small>
            </td>
            <td>${formatDate(task.estimated_deadline)}</td>
        </tr>
    `).join('');
}

function updateEmployeesTable() {
    const tbody = document.getElementById('employeesTableBody');
    tbody.innerHTML = allEmployees.map(emp => {
        const status = calculateStatus(emp.points_current_week);
        return `
            <tr>
                <td>${emp.full_name}</td>
                <td>${emp.position || '-'}</td>
                <td>${emp.workplace || '-'}</td>
                <td><span class="status-badge status-${status.toLowerCase()}">${status}</span></td>
                <td>${emp.points_current_week || 0}</td>
                <td>${emp.points_current_month || 0}</td>
                <td>
                    <button class="btn btn-secondary btn-small" onclick="editEmployee('${emp.id}')">Изменить</button>
                    <button class="btn btn-danger btn-small" onclick="deleteEmployee('${emp.id}')">Удалить</button>
                </td>
            </tr>
        `;
    }).join('');
}

function updateTasksTable() {
    const tbody = document.getElementById('tasksTableBody');
    tbody.innerHTML = allTasks.map(task => `
        <tr>
            <td>${task.title}</td>
            <td>${task.employee?.full_name || 'Не назначен'}</td>
            <td><span class="urgency-badge urgency-${task.urgency}">${task.urgency === 'urgent' ? 'Срочно' : 'Обычно'}</span></td>
            <td><span class="task-status-badge task-status-${task.status}">${getTaskStatusLabel(task.status)}</span></td>
            <td>${task.progress_percent}%</td>
            <td>${formatDate(task.estimated_deadline)}</td>
            <td>
                <button class="btn btn-secondary btn-small" onclick="editTask('${task.id}')">Изменить</button>
                <button class="btn btn-danger btn-small" onclick="deleteTask('${task.id}')">Удалить</button>
            </td>
        </tr>
    `).join('');
}

function calculateStatus(weekPoints) {
    if (weekPoints >= (settings.gold_threshold || 50)) return 'Gold';
    if (weekPoints >= (settings.silver_threshold || 20)) return 'Silver';
    return 'Standard';
}

function getTaskStatusLabel(status) {
    const labels = {
        'not_started': 'Не начата',
        'in_progress': 'В процессе',
        'completed': 'Выполнена',
        'rejected': 'Отклонена'
    };
    return labels[status] || status;
}

function formatDate(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('ru-RU');
}

// Tab navigation
function showAdminTab(tabName) {
    document.querySelectorAll('#adminPanel .tab').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('#adminPanel .tab-content').forEach(content => content.classList.add('hidden'));
    
    event.target.classList.add('active');
    
    const contentMap = {
        'dashboard': 'adminDashboard',
        'employees': 'adminEmployees',
        'tasks': 'adminTasks',
        'settings': 'adminSettings'
    };
    
    document.getElementById(contentMap[tabName]).classList.remove('hidden');
}

function showEmployeeTab(tabName) {
    document.querySelectorAll('#employeePanel .tab').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('#employeePanel .tab-content').forEach(content => content.classList.add('hidden'));
    
    event.target.classList.add('active');
    
    const contentMap = {
        'profile': 'employeeProfile',
        'myTasks': 'employeeMyTasks',
        'team': 'employeeTeam'
    };
    
    document.getElementById(contentMap[tabName]).classList.remove('hidden');
    
    if (tabName === 'myTasks') {
        loadEmployeeTasks();
    } else if (tabName === 'team') {
        loadTeamMembers();
    }
}

// Employee Modal
function openAddEmployeeModal() {
    document.getElementById('employeeModalTitle').textContent = 'Добавить сотрудника';
    document.getElementById('employeeForm').reset();
    
    // Очищаем каждое поле явно
    document.getElementById('employeeId').value = '';
    document.getElementById('employeeUsername').value = '';
    document.getElementById('employeePassword').value = '';
    document.getElementById('employeeFullName').value = '';
    document.getElementById('employeePosition').value = '';
    document.getElementById('employeeWorkplace').value = '';
    
    document.getElementById('employeePassword').required = true;
    document.getElementById('employeeModal').classList.add('active');
}

async function editEmployee(id) {
    const employee = allEmployees.find(e => e.id === id);
    if (!employee) return;

    document.getElementById('employeeModalTitle').textContent = 'Редактировать сотрудника';
    document.getElementById('employeeId').value = employee.id;
    document.getElementById('employeeUsername').value = employee.username;
    document.getElementById('employeePassword').value = '';
    document.getElementById('employeePassword').required = false;
    document.getElementById('employeeFullName').value = employee.full_name || '';
    document.getElementById('employeePosition').value = employee.position || '';
    document.getElementById('employeeWorkplace').value = employee.workplace || '';
    document.getElementById('employeeModal').classList.add('active');
}

function closeEmployeeModal() {
    document.getElementById('employeeModal').classList.remove('active');
}

document.getElementById('employeeForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Получаем элементы ПЕРЕД тем, как получить значения
    const employeeId = document.getElementById('employeeId');
    const employeeUsername = document.getElementById('employeeUsername');
    const employeePassword = document.getElementById('employeePassword');
    const employeeFullName = document.getElementById('employeeFullName');
    const employeePosition = document.getElementById('employeePosition');
    const employeeWorkplace = document.getElementById('employeeWorkplace');
    
    // Проверяем, что все элементы найдены в DOM
    if (!employeeId || !employeeUsername || !employeePassword || !employeeFullName || !employeePosition || !employeeWorkplace) {
        console.error('❌ КРИТИЧЕСКАЯ ОШИБКА: Элементы формы не найдены в DOM!');
        alert('Ошибка: форма повреждена. Перезагрузите страницу.');
        return;
    }
    
    // Получаем значения И СРАЗУ триммим
    const id = employeeId.value.trim();
    const username = employeeUsername.value.trim();
    const password = employeePassword.value.trim();
    const fullName = employeeFullName.value.trim();
    const position = employeePosition.value.trim();
    const workplace = employeeWorkplace.value.trim();
    
    console.log('📋 Форма отправлена:');
    console.log('  id:', id);
    console.log('  username:', username, '(длина:', username.length + ')');
    console.log('  password:', '***', '(длина:', password.length + ')');
    console.log('  fullName:', fullName);
    
    // ВАЛИДАЦИЯ
    if (!username || username === '') {
        alert('Укажите имя пользователя');
        console.error('❌ Username пуст!');
        return;
    }
    
    if (!id && (!password || password === '')) {
        alert('Укажите пароль для нового сотрудника');
        console.error('❌ Password пуст для нового сотрудника!');
        return;
    }
    
    const data = {
        username: username,
        full_name: fullName,
        position: position,
        workplace: workplace,
        role: 'employee'
    };

    if (password) {
        data.password = password;
    }

    try {
        if (id) {
            console.log('📝 Обновление сотрудника:', id);
            await supabase.from('users').update(data).eq('id', id);
            alert('Сотрудник обновлен успешно!');
        } else {
            console.log('➕ Создание нового сотрудника');
            const { error } = await supabase.from('users').insert([data]);
            
            if (error) {
                console.error('❌ Ошибка вставки:', error);
                alert('Ошибка при создании сотрудника: ' + error.message);
                return;
            }
            alert('Сотрудник создан успешно!');
        }
        
        closeEmployeeModal();
        await loadAllEmployees();
    } catch (error) {
        console.error('Error saving employee:', error);
        alert('Ошибка при сохранении сотрудника: ' + error.message);
    }
});

async function deleteEmployee(id) {
    if (!confirm('Вы уверены, что хотите удалить этого сотрудника?')) return;
    
    try {
        await supabase.from('users').delete().eq('id', id);
        await loadAllEmployees();
    } catch (error) {
        console.error('Error deleting employee:', error);
        alert('Ошибка при удалении сотрудника');
    }
}

// Task Modal
async function openAddTaskModal() {
    document.getElementById('taskModalTitle').textContent = 'Добавить задачу';
    document.getElementById('taskForm').reset();
    document.getElementById('taskId').value = '';
    
    // Load employees dropdown
    const select = document.getElementById('taskEmployee');
    select.innerHTML = '<option value="">Выберите сотрудника</option>' + 
        allEmployees.map(emp => `<option value="${emp.id}">${emp.full_name}</option>`).join('');
    
    document.getElementById('taskModal').classList.add('active');
}

async function editTask(id) {
    const task = allTasks.find(t => t.id === id);
    if (!task) return;

    document.getElementById('taskModalTitle').textContent = 'Редактировать задачу';
    document.getElementById('taskId').value = task.id;
    
    const select = document.getElementById('taskEmployee');
    select.innerHTML = '<option value="">Выберите сотрудника</option>' + 
        allEmployees.map(emp => `<option value="${emp.id}" ${emp.id === task.employee_id ? 'selected' : ''}>${emp.full_name}</option>`).join('');
    
    document.getElementById('taskTitle').value = task.title;
    document.getElementById('taskDescription').value = task.description || '';
    document.getElementById('taskUrgency').value = task.urgency;
    document.getElementById('taskDeadline').value = task.estimated_deadline;
    document.getElementById('taskModal').classList.add('active');
}

function closeTaskModal() {
    document.getElementById('taskModal').classList.remove('active');
}

document.getElementById('taskForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const id = document.getElementById('taskId').value;
    const data = {
        employee_id: document.getElementById('taskEmployee').value,
        title: document.getElementById('taskTitle').value.trim(),
        description: document.getElementById('taskDescription').value.trim(),
        urgency: document.getElementById('taskUrgency').value,
        estimated_deadline: document.getElementById('taskDeadline').value
    };

    try {
        if (id) {
            await supabase.from('tasks').update(data).eq('id', id);
        } else {
            await supabase.from('tasks').insert([data]);
        }
        
        closeTaskModal();
        await loadAllTasks();
    } catch (error) {
        console.error('Error saving task:', error);
        alert('Ошибка при сохранении задачи');
    }
});

async function deleteTask(id) {
    if (!confirm('Вы уверены, что хотите удалить эту задачу?')) return;
    
    try {
        await supabase.from('tasks').delete().eq('id', id);
        await loadAllTasks();
    } catch (error) {
        console.error('Error deleting task:', error);
        alert('Ошибка при удалении задачи');
    }
}

// Settings Form
document.getElementById('settingsForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const silverThreshold = parseInt(document.getElementById('silverThreshold').value);
    const goldThreshold = parseInt(document.getElementById('goldThreshold').value);

    try {
        await supabase.from('settings').update({ value: silverThreshold }).eq('name', 'silver_threshold');
        await supabase.from('settings').update({ value: goldThreshold }).eq('name', 'gold_threshold');
        
        settings.silver_threshold = silverThreshold;
        settings.gold_threshold = goldThreshold;
        
        alert('Настройки сохранены успешно!');
        await loadAllEmployees();
    } catch (error) {
        console.error('Error saving settings:', error);
        alert('Ошибка при сохранении настроек');
    }
});

// Employee Panel Functions
async function loadEmployeeData() {
    await loadSettings();
    
    // Reload current user data
    const { data } = await supabase
        .from('users')
        .select('*')
        .eq('id', currentUser.id)
        .single();
    
    if (data) {
        currentUser = data;
        // ✅ ОБНОВЛЯЕМ ДАННЫЕ И В LOCALSTORAGE
        localStorage.setItem('currentUser', JSON.stringify(data));
    }
    
    updateEmployeeProfile();
    await loadEmployeeTasks();
}

function updateEmployeeProfile() {
    const status = calculateStatus(currentUser.points_current_week);
    const statusClass = status.toLowerCase();
    
    const statsHTML = `
        <div class="stat-card">
            <h4>ФИО</h4>
            <div class="value" style="font-size: 20px;">${currentUser.full_name}</div>
        </div>
        <div class="stat-card">
            <h4>Должность</h4>
            <div class="value" style="font-size: 20px;">${currentUser.position || '-'}</div>
        </div>
        <div class="stat-card">
            <h4>Место работы</h4>
            <div class="value" style="font-size: 20px;">${currentUser.workplace || '-'}</div>
        </div>
        <div class="stat-card">
            <h4>Текущий статус</h4>
            <span class="status-badge status-${statusClass}" style="font-size: 16px; padding: 8px 16px;">${status}</span>
        </div>
        <div class="stat-card">
            <h4>Баллы за неделю</h4>
            <div class="value">${currentUser.points_current_week || 0}</div>
        </div>
        <div class="stat-card">
            <h4>Баллы за месяц</h4>
            <div class="value">${currentUser.points_current_month || 0}</div>
        </div>
    `;
    document.getElementById('employeeStats').innerHTML = statsHTML;
}

async function loadEmployeeTasks() {
    const { data } = await supabase
        .from('tasks')
        .select('*')
        .eq('employee_id', currentUser.id)
        .order('created_at', { ascending: false });
    
    const tasks = data || [];
    const tasksList = document.getElementById('myTasksList');
    
    if (tasks.length === 0) {
        tasksList.innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 20px;">У вас пока нет задач</p>';
        return;
    }
    
    tasksList.innerHTML = tasks.map(task => `
        <div class="task-item" onclick="openTaskDetail('${task.id}')">
            <div class="task-item-header">
                <div>
                    <div class="task-item-title">${task.title}</div>
                    <p style="color: var(--text-secondary); margin: 4px 0; font-size: 14px;">${task.description}</p>
                </div>
            </div>
            <div class="task-item-meta">
                <span class="urgency-badge urgency-${task.urgency}">${task.urgency === 'urgent' ? 'Срочно' : 'Обычно'}</span>
                <span class="task-status-badge task-status-${task.status}">${getTaskStatusLabel(task.status)}</span>
                <span style="color: var(--text-secondary); font-size: 12px;">Срок: ${formatDate(task.estimated_deadline)}</span>
            </div>
            <div class="progress-bar">
                <div class="progress-bar-fill" style="width: ${task.progress_percent}%"></div>
            </div>
            <small style="color: var(--text-secondary);">Прогресс: ${task.progress_percent}%</small>
        </div>
    `).join('');
}

async function loadTeamMembers() {
    const { data } = await supabase
        .from('users')
        .select('*')
        .eq('role', 'employee')
        .order('points_current_week', { ascending: false });
    
    const employees = data || [];
    const teamList = document.getElementById('teamList');
    
    teamList.innerHTML = employees.map(emp => {
        const status = calculateStatus(emp.points_current_week);
        return `
            <div class="employee-card">
                <h4>${emp.full_name}</h4>
                <p>${emp.position || '-'}</p>
                <p>${emp.workplace || '-'}</p>
                <span class="status-badge status-${status.toLowerCase()}">${status}</span>
                <p style="margin-top: 8px; font-size: 12px;">Баллы: ${emp.points_current_week || 0}</p>
            </div>
        `;
    }).join('');
}

// Task Detail Modal for employees
function openTaskDetail(taskId) {
    supabase
        .from('tasks')
        .select('*')
        .eq('id', taskId)
        .single()
        .then(({ data: task }) => {
            if (!task) return;
            
            document.getElementById('taskDetailTitle').textContent = task.title;
            document.getElementById('detailTaskId').value = task.id;
            document.getElementById('taskDetailDescription').textContent = task.description;
            document.getElementById('taskDetailUrgency').innerHTML = 
                `<span class="urgency-badge urgency-${task.urgency}">${task.urgency === 'urgent' ? 'Срочно (+2 балла)' : 'Обычно (+1 балл)'}</span>`;
            document.getElementById('taskDetailDeadline').textContent = formatDate(task.estimated_deadline);
            document.getElementById('taskDetailStatus').value = task.status;
            document.getElementById('taskDetailProgress').value = task.progress_percent;
            
            document.getElementById('taskDetailModal').classList.add('active');
        });
}

function closeTaskDetailModal() {
    document.getElementById('taskDetailModal').classList.remove('active');
}

async function updateTaskStatus() {
    const taskId = document.getElementById('detailTaskId').value;
    const status = document.getElementById('taskDetailStatus').value;
    const progress = parseInt(document.getElementById('taskDetailProgress').value) || 0;
    
    try {
        const updateData = {
            status: status,
            progress_percent: progress
        };
        
        // Get current task data
        const { data: currentTask } = await supabase
            .from('tasks')
            .select('*')
            .eq('id', taskId)
            .single();
        
        // If task is being completed for the first time
        if (status === 'completed' && currentTask.status !== 'completed') {
            updateData.completed_at = new Date().toISOString();
            updateData.progress_percent = 100;
            
            // Add points to user
            const points = currentTask.urgency === 'urgent' ? 2 : 1;
            const { data: userData } = await supabase
                .from('users')
                .select('points_current_week, points_current_month')
                .eq('id', currentUser.id)
                .single();
            
            await supabase
                .from('users')
                .update({
                    points_current_week: (userData.points_current_week || 0) + points,
                    points_current_month: (userData.points_current_month || 0) + points
                })
                .eq('id', currentUser.id);
        }
        
        await supabase.from('tasks').update(updateData).eq('id', taskId);
        
        closeTaskDetailModal();
        await loadEmployeeData();
        alert('Статус задачи обновлен!');
    } catch (error) {
        console.error('Error updating task:', error);
        alert('Ошибка при обновлении статуса задачи');
    }
}