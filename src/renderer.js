// Load tasks on startup
window.onload = () => {
  renderTaskList();
};

// Task Creation Handler
function addTaskHandler(e) {
  e.preventDefault();

  const title = document.getElementById('taskTitle').value;
  const description = document.getElementById('taskDescription').value;
  const priority = document.getElementById('taskPriority').value;
  const tagsInput = document.getElementById('taskTags').value;

  if (title.trim() === '') {
    alert('Task title is required!');
    return;
  }

  const tags = tagsInput ? tagsInput.split(',').map(tag => tag.trim()) : [];

  const task = { title, description, priority, tags, completed: false };

  // Save task to localStorage
  const tasks = JSON.parse(localStorage.getItem('tasks')) || [];
  tasks.push(task);
  localStorage.setItem('tasks', JSON.stringify(tasks));

  // Re-render task list and reset form
  renderTaskList();
  document.getElementById('taskForm').reset();
}

// Attach the add task handler on page load
document.getElementById('taskForm').addEventListener('submit', addTaskHandler);

// Render all tasks from localStorage
function renderTaskList() {
  const taskList = document.getElementById('taskList');
  taskList.innerHTML = ''; // Clear the current list

  const tasks = JSON.parse(localStorage.getItem('tasks')) || [];
  tasks.forEach((task, index) => addTaskToDOM(task, index));
}

// Add task to DOM with Edit, Delete, Complete buttons, and Tags
function addTaskToDOM(task, index) {
  const taskList = document.getElementById('taskList');

  const taskDiv = document.createElement('div');
  taskDiv.className = `task priority-${task.priority}`;

  const tagsHTML = task.tags && task.tags.length 
    ? `<div class="tags">${task.tags.map(tag => `<span class="tag">${tag}</span>`).join('')}</div>` 
    : '';

  taskDiv.innerHTML = `
    <input type="checkbox" onclick="toggleTaskCompletion(${index})" ${task.completed ? 'checked' : ''}>
    <h3 class="${task.completed ? 'completed' : ''}">${task.title}</h3>
    <p class="${task.completed ? 'completed' : ''}">${task.description}</p>
    <span class="priority-label">${task.priority.charAt(0).toUpperCase() + task.priority.slice(1)} Priority</span>
    ${tagsHTML}
    <button onclick="editTask(${index})">Edit</button>
    <button onclick="deleteTask(${index})">Delete</button>
  `;

  taskList.appendChild(taskDiv);
}

// Toggle Task Completion Functionality
function toggleTaskCompletion(index) {
  const tasks = JSON.parse(localStorage.getItem('tasks')) || [];

  tasks[index].completed = !tasks[index].completed;

  localStorage.setItem('tasks', JSON.stringify(tasks));
  renderTaskList();
}

// Edit Task Functionality
function editTask(index) {
  const tasks = JSON.parse(localStorage.getItem('tasks')) || [];
  const task = tasks[index];

  document.getElementById('taskTitle').value = task.title;
  document.getElementById('taskDescription').value = task.description;
  document.getElementById('taskPriority').value = task.priority;
  document.getElementById('taskTags').value = task.tags.join(', ');

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

    tasks[index] = task;
    localStorage.setItem('tasks', JSON.stringify(tasks));

    form.reset();
    submitButton.textContent = 'Add Task';
    renderTaskList();

    form.removeEventListener('submit', updateTask);
    form.addEventListener('submit', addTaskHandler);
  });
}

// Delete Task Functionality
function deleteTask(index) {
  const tasks = JSON.parse(localStorage.getItem('tasks')) || [];

  const confirmDelete = confirm('Are you sure you want to delete this task?');
  if (!confirmDelete) return;

  tasks.splice(index, 1);
  localStorage.setItem('tasks', JSON.stringify(tasks));
  renderTaskList();
}

// Filter Tasks by Tag
function filterTasksByTag() {
  const filterValue = document.getElementById('filterTags').value.trim().toLowerCase();
  const tasks = JSON.parse(localStorage.getItem('tasks')) || [];

  const filteredTasks = tasks.filter(task => 
    task.tags.some(tag => tag.toLowerCase().includes(filterValue))
  );

  renderFilteredTasks(filteredTasks);
}

function renderFilteredTasks(filteredTasks) {
  const taskList = document.getElementById('taskList');
  taskList.innerHTML = '';

  if (filteredTasks.length === 0 && document.getElementById('filterTags').value !== '') {
    taskList.innerHTML = '<p>No tasks found for this tag.</p>';
  } else {
    filteredTasks.forEach((task, index) => addTaskToDOM(task, index));
  }
}
