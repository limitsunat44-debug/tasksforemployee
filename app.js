// Supabase Configuration
const SUPABASE_URL = 'https://jyhlrjrrmemttyvicibq.supabase.com';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp5aGxyanJybWVtdHR5dmljaWJxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEzNjk2NjgsImV4cCI6MjA3Njk0NTY2OH0.XrkLM9jFmnnGQMkU2dxy286gzdYE43QdMzBj3Z4Ig7s';

// In-Memory State Management
let currentUser = null;
let employees = [];
let tasks = [];
let taskProgress = [];
let adminSettings = { silver_threshold: 20, gold_threshold: 50 };
let userStats = [];

// Utility Functions
function showLoading() {
  document.getElementById('loadingOverlay').classList.remove('hidden');
}

function hideLoading() {
  document.getElementById('loadingOverlay').classList.add('hidden');
}

function showToast(message, isError = false) {
  const toast = document.createElement('div');
  toast.className = `toast ${isError ? 'error' : ''}`;
  toast.textContent = message;
  document.getElementById('toastContainer').appendChild(toast);
  
  setTimeout(() => {
    toast.remove();
  }, 3000);
}

function showScreen(screenId) {
  document.querySelectorAll('.screen').forEach(screen => {
    screen.classList.add('hidden');
  });
  document.getElementById(screenId).classList.remove('hidden');
}

function openModal(modalId) {
  document.getElementById(modalId).classList.remove('hidden');
}

function closeModal(modalId) {
  document.getElementById(modalId).classList.add('hidden');
}

// Supabase API Helper
async function supabaseRequest(endpoint, method = 'GET', body = null) {
  const options = {
    method,
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    }
  };

  if (body && (method === 'POST' || method === 'PATCH')) {
    options.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/${endpoint}`, options);
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    
    const text = await response.text();
    return text ? JSON.parse(text) : null;
  } catch (error) {
    console.error('Supabase request error:', error);
    throw error;
  }
}

// Authentication Functions
async function login(username, password) {
  try {
    showLoading();
    const users = await supabaseRequest(`users?username=eq.${username}&password=eq.${password}&is_active=eq.true&select=*`);
    
    if (users && users.length > 0) {
      currentUser = users[0];
      return true;
    }
    return false;
  } catch (error) {
    console.error('Login error:', error);
    showToast('Ошибка при входе в систему', true);
    return false;
  } finally {
    hideLoading();
  }
}

function logout() {
  currentUser = null;
  employees = [];
  tasks = [];
  taskProgress = [];
  userStats = [];
  showScreen('loginScreen');
  document.getElementById('loginForm').reset();
}

// Data Loading Functions
async function loadEmployees() {
  try {
    employees = await supabaseRequest('users?is_active=eq.true&role=eq.employee&select=*');
    return employees;
  } catch (error) {
    console.error('Error loading employees:', error);
    showToast('Ошибка загрузки сотрудников', true);
    return [];
  }
}

async function loadTasks() {
  try {
    tasks = await supabaseRequest('tasks?select=*');
    return tasks;
  } catch (error) {
    console.error('Error loading tasks:', error);
    showToast('Ошибка загрузки задач', true);
    return [];
  }
}

async function loadTaskProgress() {
  try {
    taskProgress = await supabaseRequest('task_progress?select=*');
    return taskProgress;
  } catch (error) {
    console.error('Error loading task progress:', error);
    return [];
  }
}

async function loadAdminSettings() {
  try {
    const settings = await supabaseRequest('admin_settings?select=*&limit=1');
    if (settings && settings.length > 0) {
      adminSettings = settings[0];
    }
    return adminSettings;
  } catch (error) {
    console.error('Error loading admin settings:', error);
    return adminSettings;
  }
}

async function loadUserStats() {
  try {
    const currentMonth = new Date().toISOString().slice(0, 7);
    userStats = await supabaseRequest(`user_monthly_stats?month=eq.${currentMonth}&select=*`);
    return userStats;
  } catch (error) {
    console.error('Error loading user stats:', error);
    return [];
  }
}

// Admin Dashboard Functions
async function renderAdminDashboard() {
  await loadEmployees();
  await loadTasks();
  await loadTaskProgress();
  
  const activeEmployees = employees.filter(e => e.is_active).length;
  const activeTasks = tasks.filter(t => {
    const progress = taskProgress.find(p => p.task_id === t.id);
    return progress && progress.status !== 'completed';
  }).length;
  const completedTasks = taskProgress.filter(p => p.status === 'completed').length;
  
  document.getElementById('totalEmployees').textContent = activeEmployees;
  document.getElementById('activeTasks').textContent = activeTasks;
  document.getElementById('completedTasks').textContent = completedTasks;
}

async function renderEmployeesList() {
  await loadEmployees();
  await loadUserStats();
  
  const container = document.getElementById('employeesList');
  
  if (employees.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">👥</div>
        <div class="empty-state-text">Нет сотрудников</div>
      </div>
    `;
    return;
  }
  
  container.innerHTML = employees.map(emp => {
    const stats = userStats.find(s => s.user_id === emp.id) || { total_points: 0, status: 'standard' };
    return `
      <div class="item-card">
        <div class="item-header">
          <div class="item-title">${emp.full_name}</div>
          <div class="item-actions">
            <button class="btn btn-small btn-secondary" onclick="editEmployee(${emp.id})">Редактировать</button>
            <button class="btn btn-small btn-danger" onclick="deleteEmployee(${emp.id})">Удалить</button>
          </div>
        </div>
        <div class="item-body">
          <div class="item-row">
            <span class="item-label">Логин:</span>
            <span class="item-value">${emp.username}</span>
          </div>
          <div class="item-row">
            <span class="item-label">Должность:</span>
            <span class="item-value">${emp.position}</span>
          </div>
          <div class="item-row">
            <span class="item-label">Место работы:</span>
            <span class="item-value">${emp.workplace}</span>
          </div>
          <div class="item-row">
            <span class="item-label">Статус:</span>
            <span class="badge badge-${stats.status}">${getStatusLabel(stats.status)}</span>
          </div>
          <div class="item-row">
            <span class="item-label">Баллы этого месяца:</span>
            <span class="item-value">${stats.total_points}</span>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

async function renderTasksList() {
  await loadTasks();
  await loadEmployees();
  await loadTaskProgress();
  
  const filterEmployee = document.getElementById('filterEmployee').value;
  const filterPriority = document.getElementById('filterPriority').value;
  const filterStatus = document.getElementById('filterStatus').value;
  
  let filteredTasks = tasks;
  
  if (filterEmployee) {
    filteredTasks = filteredTasks.filter(t => t.assigned_to == filterEmployee);
  }
  if (filterPriority) {
    filteredTasks = filteredTasks.filter(t => t.priority === filterPriority);
  }
  if (filterStatus) {
    filteredTasks = filteredTasks.filter(t => {
      const progress = taskProgress.find(p => p.task_id === t.id);
      return progress && progress.status === filterStatus;
    });
  }
  
  const container = document.getElementById('tasksList');
  
  if (filteredTasks.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📋</div>
        <div class="empty-state-text">Нет задач</div>
      </div>
    `;
    return;
  }
  
  container.innerHTML = filteredTasks.map(task => {
    const employee = employees.find(e => e.id === task.assigned_to);
    const progress = taskProgress.find(p => p.task_id === task.id) || { status: 'not_started', progress_percentage: 0 };
    
    return `
      <div class="item-card">
        <div class="item-header">
          <div class="item-title">${task.title}</div>
          <div class="item-actions">
            <button class="btn btn-small btn-secondary" onclick="editTask(${task.id})">Редактировать</button>
          </div>
        </div>
        <div class="item-body">
          <div class="item-row">
            <span class="item-label">Описание:</span>
            <span class="item-value">${task.description}</span>
          </div>
          <div class="item-row">
            <span class="item-label">Сотрудник:</span>
            <span class="item-value">${employee ? employee.full_name : 'Не назначен'}</span>
          </div>
          <div class="item-row">
            <span class="item-label">Приоритет:</span>
            <span class="badge badge-${task.priority}">${task.priority === 'urgent' ? 'Срочно' : 'Обычно'}</span>
          </div>
          <div class="item-row">
            <span class="item-label">Срок:</span>
            <span class="item-value">${formatDate(task.deadline)}</span>
          </div>
          <div class="item-row">
            <span class="item-label">Статус:</span>
            <span class="badge badge-${progress.status}">${getProgressStatusLabel(progress.status)}</span>
          </div>
          <div class="progress-container">
            <div class="progress-bar">
              <div class="progress-fill" style="width: ${progress.progress_percentage}%"></div>
            </div>
            <div class="progress-text">Выполнено: ${progress.progress_percentage}%</div>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

async function populateEmployeeSelects() {
  await loadEmployees();
  
  const selects = [document.getElementById('filterEmployee'), document.getElementById('taskEmployee')];
  
  selects.forEach(select => {
    if (select.id === 'filterEmployee') {
      select.innerHTML = '<option value="">Все сотрудники</option>' + 
        employees.map(emp => `<option value="${emp.id}">${emp.full_name}</option>`).join('');
    } else {
      select.innerHTML = '<option value="">Выберите сотрудника</option>' + 
        employees.map(emp => `<option value="${emp.id}">${emp.full_name}</option>`).join('');
    }
  });
}

// Employee CRUD
function addEmployee() {
  document.getElementById('employeeModalTitle').textContent = 'Добавить сотрудника';
  document.getElementById('employeeForm').reset();
  document.getElementById('employeeId').value = '';
  document.getElementById('employeePassword').required = true;
  openModal('employeeModal');
}

async function editEmployee(id) {
  const employee = employees.find(e => e.id === id);
  if (!employee) return;
  
  document.getElementById('employeeModalTitle').textContent = 'Редактировать сотрудника';
  document.getElementById('employeeId').value = employee.id;
  document.getElementById('employeeUsername').value = employee.username;
  document.getElementById('employeePassword').value = '';
  document.getElementById('employeePassword').required = false;
  document.getElementById('employeeFullName').value = employee.full_name;
  document.getElementById('employeePosition').value = employee.position;
  document.getElementById('employeeWorkplace').value = employee.workplace;
  
  openModal('employeeModal');
}

async function deleteEmployee(id) {
  if (!confirm('Вы уверены, что хотите удалить этого сотрудника?')) return;
  
  try {
    showLoading();
    await supabaseRequest(`users?id=eq.${id}`, 'PATCH', { is_active: false });
    showToast('Сотрудник удален успешно');
    await renderEmployeesList();
  } catch (error) {
    console.error('Error deleting employee:', error);
    showToast('Ошибка при удалении сотрудника', true);
  } finally {
    hideLoading();
  }
}

// Task CRUD
function addTask() {
  document.getElementById('taskModalTitle').textContent = 'Добавить задачу';
  document.getElementById('taskForm').reset();
  document.getElementById('taskId').value = '';
  openModal('taskModal');
}

async function editTask(id) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;
  
  document.getElementById('taskModalTitle').textContent = 'Редактировать задачу';
  document.getElementById('taskId').value = task.id;
  document.getElementById('taskEmployee').value = task.assigned_to;
  document.getElementById('taskTitle').value = task.title;
  document.getElementById('taskDescription').value = task.description;
  document.getElementById('taskPriority').value = task.priority;
  document.getElementById('taskDeadline').value = task.deadline;
  
  openModal('taskModal');
}

// Employee Dashboard Functions
async function renderEmployeeDashboard() {
  await loadUserStats();
  await loadAdminSettings();
  
  const stats = userStats.find(s => s.user_id === currentUser.id) || { total_points: 0, status: 'standard' };
  
  document.getElementById('employeeName').textContent = currentUser.full_name;
  document.getElementById('employeePosition').textContent = currentUser.position;
  document.getElementById('employeeWorkplace').textContent = currentUser.workplace;
  document.getElementById('employeeStatus').innerHTML = `<span class="badge badge-${stats.status}">${getStatusLabel(stats.status)}</span>`;
  document.getElementById('employeePoints').textContent = stats.total_points;
}

async function renderMyTasks() {
  await loadTasks();
  await loadTaskProgress();
  
  const myTasks = tasks.filter(t => t.assigned_to === currentUser.id);
  const container = document.getElementById('myTasksList');
  
  if (myTasks.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📋</div>
        <div class="empty-state-text">У вас пока нет задач</div>
      </div>
    `;
    return;
  }
  
  container.innerHTML = myTasks.map(task => {
    const progress = taskProgress.find(p => p.task_id === task.id) || { status: 'not_started', progress_percentage: 0 };
    
    return `
      <div class="item-card">
        <div class="item-header">
          <div class="item-title">${task.title}</div>
          <div class="item-actions">
            <button class="btn btn-small btn-primary" onclick="updateTaskStatus(${task.id})">Обновить статус</button>
          </div>
        </div>
        <div class="item-body">
          <div class="item-row">
            <span class="item-label">Описание:</span>
            <span class="item-value">${task.description}</span>
          </div>
          <div class="item-row">
            <span class="item-label">Приоритет:</span>
            <span class="badge badge-${task.priority}">${task.priority === 'urgent' ? 'Срочно' : 'Обычно'}</span>
          </div>
          <div class="item-row">
            <span class="item-label">Срок:</span>
            <span class="item-value">${formatDate(task.deadline)}</span>
          </div>
          <div class="item-row">
            <span class="item-label">Статус:</span>
            <span class="badge badge-${progress.status}">${getProgressStatusLabel(progress.status)}</span>
          </div>
          <div class="progress-container">
            <div class="progress-bar">
              <div class="progress-fill" style="width: ${progress.progress_percentage}%"></div>
            </div>
            <div class="progress-text">Выполнено: ${progress.progress_percentage}%</div>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

async function renderColleagues() {
  await loadEmployees();
  await loadUserStats();
  
  const colleagues = employees.filter(e => e.id !== currentUser.id);
  const container = document.getElementById('colleaguesList');
  
  if (colleagues.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">👥</div>
        <div class="empty-state-text">Нет других сотрудников</div>
      </div>
    `;
    return;
  }
  
  container.innerHTML = colleagues.map(emp => {
    const stats = userStats.find(s => s.user_id === emp.id) || { total_points: 0, status: 'standard' };
    
    return `
      <div class="item-card">
        <div class="item-header">
          <div class="item-title">${emp.full_name}</div>
        </div>
        <div class="item-body">
          <div class="item-row">
            <span class="item-label">Должность:</span>
            <span class="item-value">${emp.position}</span>
          </div>
          <div class="item-row">
            <span class="item-label">Место работы:</span>
            <span class="item-value">${emp.workplace}</span>
          </div>
          <div class="item-row">
            <span class="item-label">Статус:</span>
            <span class="badge badge-${stats.status}">${getStatusLabel(stats.status)}</span>
          </div>
          <div class="item-row">
            <span class="item-label">Баллы:</span>
            <span class="item-value">${stats.total_points}</span>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

async function updateTaskStatus(taskId) {
  const task = tasks.find(t => t.id === taskId);
  const progress = taskProgress.find(p => p.task_id === taskId);
  
  if (!task || !progress) return;
  
  document.getElementById('statusTaskId').value = taskId;
  document.getElementById('taskStatus').value = progress.status;
  document.getElementById('taskProgress').value = progress.progress_percentage;
  
  toggleProgressInput();
  openModal('statusModal');
}

function toggleProgressInput() {
  const status = document.getElementById('taskStatus').value;
  const progressGroup = document.getElementById('progressGroup');
  const progressInput = document.getElementById('taskProgress');
  
  if (status === 'in_progress') {
    progressGroup.style.display = 'block';
    progressInput.required = true;
  } else {
    progressGroup.style.display = 'none';
    progressInput.required = false;
  }
}

// Utility Functions
function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString('ru-RU');
}

function getStatusLabel(status) {
  const labels = {
    'standard': 'Стандарт',
    'silver': 'Серебро',
    'gold': 'Золото'
  };
  return labels[status] || status;
}

function getProgressStatusLabel(status) {
  const labels = {
    'not_started': 'Не начата',
    'in_progress': 'В процессе',
    'completed': 'Выполнена',
    'rejected': 'Отклонена'
  };
  return labels[status] || status;
}

async function calculateUserStatus(userId, points) {
  await loadAdminSettings();
  
  if (points >= adminSettings.gold_threshold) {
    return 'gold';
  } else if (points >= adminSettings.silver_threshold) {
    return 'silver';
  }
  return 'standard';
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
  // Login Form
  document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    
    const success = await login(username, password);
    
    if (success) {
      if (currentUser.role === 'admin') {
        showScreen('adminScreen');
        await renderAdminDashboard();
        await populateEmployeeSelects();
      } else {
        showScreen('employeeScreen');
        await renderEmployeeDashboard();
      }
      showToast('Успешный вход в систему');
    } else {
      showToast('Неверный логин или пароль', true);
    }
  });
  
  // Admin Logout
  document.getElementById('adminLogout').addEventListener('click', logout);
  
  // Employee Logout
  document.getElementById('employeeLogout').addEventListener('click', logout);
  
  // Tab Navigation
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const tabName = btn.dataset.tab;
      
      // Update active tab button
      btn.parentElement.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      // Update active tab content
      const screen = btn.closest('.screen');
      screen.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
      document.getElementById(tabName).classList.add('active');
      
      // Load data for specific tabs
      if (tabName === 'adminEmployees') {
        await renderEmployeesList();
      } else if (tabName === 'adminTasks') {
        await populateEmployeeSelects();
        await renderTasksList();
      } else if (tabName === 'adminSettings') {
        await loadAdminSettings();
        document.getElementById('silverThreshold').value = adminSettings.silver_threshold;
        document.getElementById('goldThreshold').value = adminSettings.gold_threshold;
      } else if (tabName === 'employeeTasks') {
        await renderMyTasks();
      } else if (tabName === 'employeeColleagues') {
        await renderColleagues();
      }
    });
  });
  
  // Add Employee Button
  document.getElementById('addEmployeeBtn').addEventListener('click', addEmployee);
  
  // Employee Form Submit
  document.getElementById('employeeForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const id = document.getElementById('employeeId').value;
    const username = document.getElementById('employeeUsername').value;
    const password = document.getElementById('employeePassword').value;
    const fullName = document.getElementById('employeeFullName').value;
    const position = document.getElementById('employeePosition').value;
    const workplace = document.getElementById('employeeWorkplace').value;
    
    try {
      showLoading();
      
      if (id) {
        // Update existing employee
        const updateData = {
          username,
          full_name: fullName,
          position,
          workplace
        };
        
        if (password) {
          updateData.password = password;
        }
        
        await supabaseRequest(`users?id=eq.${id}`, 'PATCH', updateData);
        showToast('Сотрудник обновлен успешно');
      } else {
        // Create new employee
        await supabaseRequest('users', 'POST', {
          username,
          password,
          full_name: fullName,
          position,
          workplace,
          role: 'employee',
          is_active: true
        });
        
        showToast('Сотрудник добавлен успешно');
      }
      
      closeModal('employeeModal');
      await renderEmployeesList();
      await populateEmployeeSelects();
    } catch (error) {
      console.error('Error saving employee:', error);
      showToast('Ошибка при сохранении сотрудника', true);
    } finally {
      hideLoading();
    }
  });
  
  // Add Task Button
  document.getElementById('addTaskBtn').addEventListener('click', addTask);
  
  // Task Form Submit
  document.getElementById('taskForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const id = document.getElementById('taskId').value;
    const employeeId = document.getElementById('taskEmployee').value;
    const title = document.getElementById('taskTitle').value;
    const description = document.getElementById('taskDescription').value;
    const priority = document.getElementById('taskPriority').value;
    const deadline = document.getElementById('taskDeadline').value;
    
    if (!employeeId) {
      showToast('Пожалуйста, выберите сотрудника', true);
      return;
    }
    
    try {
      showLoading();
      
      if (id) {
        // Update existing task
        await supabaseRequest(`tasks?id=eq.${id}`, 'PATCH', {
          assigned_to: parseInt(employeeId),
          title,
          description,
          priority,
          deadline
        });
        showToast('Задача обновлена успешно');
      } else {
        // Create new task
        const newTask = await supabaseRequest('tasks', 'POST', {
          assigned_to: parseInt(employeeId),
          title,
          description,
          priority,
          deadline,
          created_by: currentUser.id
        });
        
        // Create task progress record
        if (newTask && newTask[0]) {
          await supabaseRequest('task_progress', 'POST', {
            task_id: newTask[0].id,
            status: 'not_started',
            progress_percentage: 0
          });
        }
        
        showToast('Задача добавлена успешно');
      }
      
      closeModal('taskModal');
      await renderTasksList();
    } catch (error) {
      console.error('Error saving task:', error);
      showToast('Ошибка при сохранении задачи', true);
    } finally {
      hideLoading();
    }
  });
  
  // Status Form Submit
  document.getElementById('statusForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const taskId = document.getElementById('statusTaskId').value;
    const status = document.getElementById('taskStatus').value;
    let progressPercentage = parseInt(document.getElementById('taskProgress').value) || 0;
    
    if (status === 'completed') {
      progressPercentage = 100;
    } else if (status === 'not_started' || status === 'rejected') {
      progressPercentage = 0;
    }
    
    try {
      showLoading();
      
      // Update task progress
      await supabaseRequest(`task_progress?task_id=eq.${taskId}`, 'PATCH', {
        status,
        progress_percentage: progressPercentage,
        updated_at: new Date().toISOString()
      });
      
      // If completed, award points
      if (status === 'completed') {
        const task = tasks.find(t => t.id == taskId);
        if (task) {
          const points = task.priority === 'urgent' ? 2 : 1;
          
          // Add points record
          await supabaseRequest('user_points', 'POST', {
            user_id: currentUser.id,
            task_id: parseInt(taskId),
            points_earned: points
          });
          
          // Update or create monthly stats
          const currentMonth = new Date().toISOString().slice(0, 7);
          const existingStats = await supabaseRequest(`user_monthly_stats?user_id=eq.${currentUser.id}&month=eq.${currentMonth}&select=*`);
          
          if (existingStats && existingStats.length > 0) {
            const newTotal = existingStats[0].total_points + points;
            const newStatus = await calculateUserStatus(currentUser.id, newTotal);
            
            await supabaseRequest(`user_monthly_stats?id=eq.${existingStats[0].id}`, 'PATCH', {
              total_points: newTotal,
              status: newStatus
            });
          } else {
            const newStatus = await calculateUserStatus(currentUser.id, points);
            await supabaseRequest('user_monthly_stats', 'POST', {
              user_id: currentUser.id,
              month: currentMonth,
              total_points: points,
              status: newStatus
            });
          }
          
          showToast(`Задача выполнена! Получено баллов: +${points}`);
        }
      } else {
        showToast('Статус задачи обновлен');
      }
      
      closeModal('statusModal');
      await renderMyTasks();
      await renderEmployeeDashboard();
    } catch (error) {
      console.error('Error updating task status:', error);
      showToast('Ошибка при обновлении статуса', true);
    } finally {
      hideLoading();
    }
  });
  
  // Settings Form Submit
  document.getElementById('settingsForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const silverThreshold = parseInt(document.getElementById('silverThreshold').value);
    const goldThreshold = parseInt(document.getElementById('goldThreshold').value);
    
    if (goldThreshold <= silverThreshold) {
      showToast('Порог для золота должен быть больше порога для серебра', true);
      return;
    }
    
    try {
      showLoading();
      
      if (adminSettings.id) {
        await supabaseRequest(`admin_settings?id=eq.${adminSettings.id}`, 'PATCH', {
          silver_threshold: silverThreshold,
          gold_threshold: goldThreshold
        });
      } else {
        await supabaseRequest('admin_settings', 'POST', {
          silver_threshold: silverThreshold,
          gold_threshold: goldThreshold
        });
      }
      
      showToast('Настройки сохранены успешно');
      await loadAdminSettings();
    } catch (error) {
      console.error('Error saving settings:', error);
      showToast('Ошибка при сохранении настроек', true);
    } finally {
      hideLoading();
    }
  });
  
  // Task Status Change
  document.getElementById('taskStatus').addEventListener('change', toggleProgressInput);
  
  // Filter Changes
  document.getElementById('filterEmployee').addEventListener('change', renderTasksList);
  document.getElementById('filterPriority').addEventListener('change', renderTasksList);
  document.getElementById('filterStatus').addEventListener('change', renderTasksList);
});

// Make functions globally accessible for onclick handlers
window.closeModal = closeModal;
window.editEmployee = editEmployee;
window.deleteEmployee = deleteEmployee;
window.editTask = editTask;
window.updateTaskStatus = updateTaskStatus;