const { ipcRenderer } = require('electron');

// Load tasks on startup
window.onload = () => {
  requestNotificationPermission();
  renderTaskList();
  scheduleExistingReminders();  // Schedule reminders on load
};

// Request Notification Permission
function requestNotificationPermission() {
  if (Notification.permission !== 'granted') {
    Notification.requestPermission();
  }
}

// Task Creation Handler
function addTaskHandler(e) {
  e.preventDefault();

  const title = document.getElementById('taskTitle').value;
  const description = document.getElementById('taskDescription').value;
  const priority = document.getElementById('taskPriority').value;
  const tagsInput = document.getElementById('taskTags').value;
  const reminderDate = document.getElementById('taskReminderDate').value;
  const reminderTime = document.getElementById('taskReminderTime').value;
  const reminderSound = document.getElementById('taskReminderSound').value;

  if (title.trim() === '') {
    alert('Task title is required!');
    return;
  }

  const tags = tagsInput ? tagsInput.split(',').map(tag => tag.trim()) : [];

  const task = { 
    title, 
    description, 
    priority, 
    tags, 
    reminderDate, 
    reminderTime,
    reminderSound,
    completed: false,
    reminderTriggered: false
  };

  const tasks = JSON.parse(localStorage.getItem('tasks')) || [];
  tasks.push(task);
  localStorage.setItem('tasks', JSON.stringify(tasks));

  renderTaskList();
  scheduleReminder(task);  // Schedule the reminder
  document.getElementById('taskForm').reset();
}

// Attach the add task handler on page load
document.getElementById('taskForm').addEventListener('submit', addTaskHandler);

// Render all tasks
function renderTaskList() {
  const taskList = document.getElementById('taskList');
  taskList.innerHTML = '';

  const tasks = JSON.parse(localStorage.getItem('tasks')) || [];
  tasks.forEach((task, index) => addTaskToDOM(task, index));
}

// Add task to DOM
function addTaskToDOM(task, index) {
  const taskList = document.getElementById('taskList');

  const taskDiv = document.createElement('div');
  taskDiv.className = `task priority-${task.priority}`;
  taskDiv.dataset.index = index;  // Store index in data attribute

  const tagsHTML = task.tags && task.tags.length 
    ? `<div class="tags">${task.tags.map(tag => `<span class="tag">${tag}</span>`).join('')}</div>` 
    : '';

  const reminderHTML = task.reminderDate && task.reminderTime 
    ? `<p class="reminder">Reminder: ${task.reminderDate} at ${task.reminderTime}</p>`
    : '';

  taskDiv.innerHTML = `
    <input type="checkbox" ${task.completed ? 'checked' : ''}>
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
document.getElementById('taskList').addEventListener('click', function(e) {
  const index = e.target.closest('.task')?.dataset.index;

  if (!index) return;

  if (e.target.classList.contains('edit-btn')) {
    editTask(index);
  } else if (e.target.classList.contains('delete-btn')) {
    deleteTask(index);
  } else if (e.target.type === 'checkbox') {
    toggleTaskCompletion(index);
  }
});

// Toggle Task Completion
function toggleTaskCompletion(index) {
  const tasks = JSON.parse(localStorage.getItem('tasks')) || [];
  tasks[index].completed = !tasks[index].completed;

  localStorage.setItem('tasks', JSON.stringify(tasks));
  renderTaskList();

  if (tasks[index].completed) {
    showNotification(`Task Completed: ${tasks[index].title}`, 'Great job! You’ve completed a task.', tasks[index].reminderSound);
  }
}

// Edit Task
function editTask(index) {
  const tasks = JSON.parse(localStorage.getItem('tasks')) || [];
  const task = tasks[index];

  document.getElementById('taskTitle').value = task.title;
  document.getElementById('taskDescription').value = task.description;
  document.getElementById('taskPriority').value = task.priority;
  document.getElementById('taskTags').value = task.tags.join(', ');
  document.getElementById('taskReminderDate').value = task.reminderDate || '';
  document.getElementById('taskReminderTime').value = task.reminderTime || '';
  document.getElementById('taskReminderSound').value = task.reminderSound || 'default';

  const submitButton = document.querySelector('#taskForm button');
  submitButton.textContent = 'Update Task';

  const form = document.getElementById('taskForm');
  form.removeEventListener('submit', addTaskHandler);

  form.addEventListener('submit', function updateTask(e) {
    e.preventDefault();

    task.title = document.getElementById('taskTitle').value;
    task.description = document.getElementById('taskDescription').value;
    task.priority = document.getElementById('taskPriority').value;
    task.tags = document.getElementById('taskTags').value.split(',').map(tag => tag.trim());
    task.reminderDate = document.getElementById('taskReminderDate').value;
    task.reminderTime = document.getElementById('taskReminderTime').value;
    task.reminderSound = document.getElementById('taskReminderSound').value;
    task.reminderTriggered = false;

    tasks[index] = task;
    localStorage.setItem('tasks', JSON.stringify(tasks));

    form.reset();
    submitButton.textContent = 'Add Task';
    renderTaskList();

    form.removeEventListener('submit', updateTask);
    form.addEventListener('submit', addTaskHandler);
  });
}

// Delete Task with Confirmation
function deleteTask(index) {
  const tasks = JSON.parse(localStorage.getItem('tasks')) || [];

  if (confirm('Are you sure you want to delete this task?')) {
    const deletedTask = tasks.splice(index, 1)[0];
    localStorage.setItem('tasks', JSON.stringify(tasks));
    renderTaskList();
    showNotification(`Task Deleted: ${deletedTask.title}`, 'A task has been removed from your list.', deletedTask.reminderSound);
  }
}

// Schedule Reminder in Background using Electron
function scheduleReminder(task) {
  if (task.reminderDate && task.reminderTime && !task.completed && !task.reminderTriggered) {
    ipcRenderer.send('schedule-reminder', task);
    console.log(`Sent reminder to main process for: ${task.title}`);
  }
}

// Schedule existing reminders on app load
function scheduleExistingReminders() {
  const tasks = JSON.parse(localStorage.getItem('tasks')) || [];
  tasks.forEach(task => {
    if (!task.reminderTriggered && !task.completed) {
      scheduleReminder(task);
    }
  });
}

// Listen for reminders triggered by Electron's main process
ipcRenderer.on('trigger-reminder', (event, task) => {
  showNotification(task.title, task.description, task.reminderSound);
  markReminderTriggered(task.title);
});

// Mark reminder as triggered in localStorage
function markReminderTriggered(taskTitle) {
  const tasks = JSON.parse(localStorage.getItem('tasks')) || [];
  const updatedTasks = tasks.map(task => {
    if (task.title === taskTitle) {
      task.reminderTriggered = true;
    }
    return task;
  });

  localStorage.setItem('tasks', JSON.stringify(updatedTasks));
  renderTaskList();
}

// Show Notification with Custom Sound
function showNotification(title, description, sound) {
  if (Notification.permission === 'granted') {
    new Notification(title, { body: description });
  }
  playSound(sound);
}

// Play Sound Based on User Selection
function playSound(soundType) {
  let soundSrc = '';

  switch (soundType) {
    case 'chime':
      soundSrc = '../assets/sounds/chime.mp3';
      break;
    case 'alert':
      soundSrc = '../assets/sounds/alert.mp3';
      break;
    case 'beep':
      soundSrc = '../assets/sounds/beep.mp3';
      break;
    default:
      soundSrc = '../assets/sounds/default.mp3';
  }

  const audio = new Audio(soundSrc);
  audio.play().catch(error => console.error('Error playing sound:', error));
}
