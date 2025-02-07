document.getElementById('taskForm').addEventListener('submit', function (e) {
    e.preventDefault();
  
    const title = document.getElementById('taskTitle').value;
    const description = document.getElementById('taskDescription').value;
  
    if (title.trim() === '') {
      alert('Task title is required!');
      return;
    }
  
    const task = {
      title,
      description,
    };
  
    addTaskToDOM(task);
    saveTaskToLocalStorage(task);
  
    document.getElementById('taskForm').reset();
  });
  
  function addTaskToDOM(task) {
    const taskList = document.getElementById('taskList');
  
    const taskDiv = document.createElement('div');
    taskDiv.className = 'task';
    taskDiv.innerHTML = `<h3>${task.title}</h3><p>${task.description}</p>`;
  
    taskList.appendChild(taskDiv);
  }
  
  function saveTaskToLocalStorage(task) {
    let tasks = JSON.parse(localStorage.getItem('tasks')) || [];
    tasks.push(task);
    localStorage.setItem('tasks', JSON.stringify(tasks));
  }
  
  // Load tasks from localStorage on startup
  window.onload = () => {
    const savedTasks = JSON.parse(localStorage.getItem('tasks')) || [];
    savedTasks.forEach(task => addTaskToDOM(task));
  };
  