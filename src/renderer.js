// Load tasks on startup
window.onload = () => {
  renderTaskList();
};

// Task Creation Handler
function addTaskHandler(e) {
  e.preventDefault();

  const title = document.getElementById('taskTitle').value;
  const description = document.getElementById('taskDescription').value;

  if (title.trim() === '') {
    alert('Task title is required!');
    return;
  }

  const task = { title, description };

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

// Add task to DOM with Edit and Delete buttons
function addTaskToDOM(task, index) {
  const taskList = document.getElementById('taskList');

  const taskDiv = document.createElement('div');
  taskDiv.className = 'task';
  taskDiv.innerHTML = `
    <h3>${task.title}</h3>
    <p>${task.description}</p>
    <button onclick="editTask(${index})">Edit</button>
    <button onclick="deleteTask(${index})">Delete</button>
  `;

  taskList.appendChild(taskDiv);
}

// Edit Task Functionality
function editTask(index) {
  const tasks = JSON.parse(localStorage.getItem('tasks')) || [];
  const task = tasks[index];

  // Populate the form with the task's current details
  document.getElementById('taskTitle').value = task.title;
  document.getElementById('taskDescription').value = task.description;

  // Change the submit button text to "Update Task"
  const submitButton = document.querySelector('#taskForm button');
  submitButton.textContent = 'Update Task';

  // Remove the existing add task event listener
  const form = document.getElementById('taskForm');
  form.removeEventListener('submit', addTaskHandler);

  // Add the update task functionality
  form.addEventListener('submit', function updateTask(e) {
    e.preventDefault();

    // Update the task with new values
    task.title = document.getElementById('taskTitle').value;
    task.description = document.getElementById('taskDescription').value;

    // Save the updated task list back to localStorage
    tasks[index] = task;
    localStorage.setItem('tasks', JSON.stringify(tasks));

    // Reset the form and UI
    form.reset();
    submitButton.textContent = 'Add Task';

    // Re-render the task list
    renderTaskList();

    // Remove the update listener and restore the add task functionality
    form.removeEventListener('submit', updateTask);
    form.addEventListener('submit', addTaskHandler);
  });
}

// Delete Task Functionality
function deleteTask(index) {
  const tasks = JSON.parse(localStorage.getItem('tasks')) || [];

  // Confirm deletion with the user
  const confirmDelete = confirm('Are you sure you want to delete this task?');
  if (!confirmDelete) return;

  // Remove the task from the array
  tasks.splice(index, 1);

  // Save the updated task list back to localStorage
  localStorage.setItem('tasks', JSON.stringify(tasks));

  // Re-render the task list to reflect the deletion
  renderTaskList();
}
