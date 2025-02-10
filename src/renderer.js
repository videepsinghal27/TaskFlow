const { ipcRenderer } = require('electron');

// Load tasks on startup
window.onload = () => {
  requestNotificationPermission();
  ensureTaskIds();
  renderTaskList();
  scheduleExistingReminders();
};

// Ensure all tasks have unique IDs
function ensureTaskIds() {
  const tasks = JSON.parse(localStorage.getItem('tasks')) || [];
  let modified = false;

  const updatedTasks = tasks.map(task => {
    if (!task.id) {
      task.id = Date.now() + Math.random();
      modified = true;
    }
    return task;
  });

  if (modified) {
    localStorage.setItem('tasks', JSON.stringify(updatedTasks));
  }
}

// Request Notification Permission
function requestNotificationPermission() {
  if (Notification.permission !== 'granted') {
    Notification.requestPermission();
  }
}

// Handle Task Form Submission
let currentTaskId = null;

document.getElementById('taskForm').addEventListener('submit', (e) => {
  e.preventDefault();

  if (currentTaskId) {
    updateTask(currentTaskId);
  } else {
    addNewTask();
  }
});

// Add New Task
function addNewTask() {
  const task = getFormData();
  const tasks = JSON.parse(localStorage.getItem('tasks')) || [];

  tasks.push(task);
  localStorage.setItem('tasks', JSON.stringify(tasks));

  renderTaskList();
  scheduleReminder(task);
  resetForm();
}

// Get Data from Form
function getFormData() {
  const title = document.getElementById('taskTitle').value.trim();
  const description = document.getElementById('taskDescription').value.trim();
  const priority = document.getElementById('taskPriority').value;
  const tagsInput = document.getElementById('taskTags').value.trim();
  const reminderDate = document.getElementById('taskReminderDate').value;
  const reminderTime = document.getElementById('taskReminderTime').value;
  const reminderSound = document.getElementById('taskReminderSound').value;

  if (!title) {
    alert('Task title is required!');
    throw new Error('Task title is required');
  }

  return {
    id: Date.now() + Math.random(),
    title,
    description,
    priority,
    tags: tagsInput.split(',').map(tag => tag.trim()),
    reminderDate,
    reminderTime,
    reminderSound,
    completed: false,
    reminderTriggered: false
  };
}

// Render All Tasks
function renderTaskList() {
  const taskList = document.getElementById('taskList');
  taskList.innerHTML = '';

  const tasks = JSON.parse(localStorage.getItem('tasks')) || [];
  const priorityOrder = { high: 1, medium: 2, low: 3 };

  tasks.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
  tasks.forEach(task => addTaskToDOM(task));
}

// Add Task to DOM
function addTaskToDOM(task) {
  const taskList = document.getElementById('taskList');
  const taskDiv = document.createElement('div');
  taskDiv.className = `task priority-${task.priority}`;
  taskDiv.dataset.id = task.id;

  const tagsHTML = task.tags.length
    ? `<div class="tags">${task.tags.map(tag => `<span class="tag">${tag}</span>`).join('')}</div>`
    : '';

  const reminderHTML = task.reminderDate && task.reminderTime
    ? `<p class="reminder">Reminder: ${task.reminderDate} at ${task.reminderTime}</p>`
    : '';

  taskDiv.innerHTML = `
    <input type="checkbox" class="task-checkbox" ${task.completed ? 'checked' : ''}>
    <h3 class="${task.completed ? 'completed' : ''}">${task.title}</h3>
    <p class="${task.completed ? 'completed' : ''}">${task.description}</p>
    <span class="priority-label">${task.priority.charAt(0).toUpperCase() + task.priority.slice(1)} Priority</span>
    ${tagsHTML}
    ${reminderHTML}
    <button class="edit-btn">Edit</button>
    <button class="delete-btn">Delete</button>
  `;

  taskList.appendChild(taskDiv);
}

// Event Delegation for Edit, Delete, and Checkbox
document.getElementById('taskList').addEventListener('click', (e) => {
  const taskDiv = e.target.closest('.task');
  if (!taskDiv) return;

  const taskId = Number(taskDiv.dataset.id);

  if (e.target.classList.contains('edit-btn')) {
    loadTaskForEditing(taskId);
  } else if (e.target.classList.contains('delete-btn')) {
    deleteTask(taskId);
  } else if (e.target.classList.contains('task-checkbox')) {
    toggleTaskCompletion(taskId);
  }
});

// Load Task for Editing
function loadTaskForEditing(taskId) {
  const tasks = JSON.parse(localStorage.getItem('tasks')) || [];
  const task = tasks.find(t => t.id === taskId);

  document.getElementById('taskTitle').value = task.title;
  document.getElementById('taskDescription').value = task.description;
  document.getElementById('taskPriority').value = task.priority;
  document.getElementById('taskTags').value = task.tags.join(', ');
  document.getElementById('taskReminderDate').value = task.reminderDate || '';
  document.getElementById('taskReminderTime').value = task.reminderTime || '';
  document.getElementById('taskReminderSound').value = task.reminderSound || 'default';

  const submitButton = document.querySelector('#taskForm button');
  submitButton.textContent = 'Update Task';
  
  currentTaskId = taskId;
}

// Update Task
function updateTask(taskId) {
  const tasks = JSON.parse(localStorage.getItem('tasks')) || [];
  const taskIndex = tasks.findIndex(t => t.id === taskId);

  if (taskIndex !== -1) {
    tasks[taskIndex] = { ...tasks[taskIndex], ...getFormData(), id: taskId };
    localStorage.setItem('tasks', JSON.stringify(tasks));
    renderTaskList();
    resetForm();
  }
}

// Reset Form
function resetForm() {
  document.getElementById('taskForm').reset();
  const submitButton = document.querySelector('#taskForm button');
  submitButton.textContent = 'Add Task';
  currentTaskId = null;
}

// Delete Task with Confirmation
function deleteTask(taskId) {
  if (confirm('Are you sure you want to delete this task?')) {
    const tasks = JSON.parse(localStorage.getItem('tasks')) || [];
    const updatedTasks = tasks.filter(task => task.id !== taskId);

    localStorage.setItem('tasks', JSON.stringify(updatedTasks));
    renderTaskList();
  }
}

// Toggle Task Completion
function toggleTaskCompletion(taskId) {
  const tasks = JSON.parse(localStorage.getItem('tasks')) || [];
  const task = tasks.find(t => t.id === taskId);

  if (task) {
    task.completed = !task.completed;
    localStorage.setItem('tasks', JSON.stringify(tasks));
    renderTaskList();
  }
}

// Schedule Reminders with Snooze/Dismiss
function scheduleReminder(task) {
  if (task.reminderDate && task.reminderTime && !task.completed && !task.reminderTriggered) {
    ipcRenderer.send('schedule-reminder', task);
  }
}

// Schedule Existing Reminders
function scheduleExistingReminders() {
  const tasks = JSON.parse(localStorage.getItem('tasks')) || [];
  tasks.forEach(task => {
    if (!task.reminderTriggered && !task.completed) {
      scheduleReminder(task);
    }
  });
}

// Handle Reminders with Snooze and Dismiss
ipcRenderer.on('trigger-reminder', (event, task) => {
  const snooze = confirm(`Reminder: ${task.title}\n\n${task.description}\n\nDo you want to snooze? Click 'OK' to snooze for 5 minutes, or 'Cancel' to dismiss.`);
  
  if (snooze) {
    ipcRenderer.send('snooze-reminder', task);
  } else {
    completeDismissedTask(task.id);  // Mark task as completed when dismissed
    ipcRenderer.send('dismiss-reminder', task);
  }
});

// Complete Dismissed Task
function completeDismissedTask(taskId) {
  const tasks = JSON.parse(localStorage.getItem('tasks')) || [];
  const task = tasks.find(t => t.id === taskId);

  if (task) {
    task.completed = true;
    localStorage.setItem('tasks', JSON.stringify(tasks));
    renderTaskList();
  }
}

// Play Custom Sound
function playSound(soundType) {
  let soundSrc = '';

  switch (soundType) {
    case 'chime': soundSrc = '../assets/sounds/chime.mp3'; break;
    case 'alert': soundSrc = '../assets/sounds/alert.mp3'; break;
    case 'beep': soundSrc = '../assets/sounds/beep.mp3'; break;
    default: soundSrc = '../assets/sounds/default.mp3';
  }

  const audio = new Audio(soundSrc);
  audio.play().catch(err => console.error('Error playing sound:', err));
}
