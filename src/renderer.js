// Import Electron
const { ipcRenderer } = require('electron');
const Sortable = require('sortablejs');

// At the top of renderer.js, update your Firestore imports:
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, setDoc, deleteDoc, doc, getDoc, updateDoc } = require('firebase/firestore');

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBeHfo632M6ujCSx1N7ymTUlSBrDZwA-bY",
  authDomain: "taskflow-6b8f1.firebaseapp.com",
  projectId: "taskflow-6b8f1",
  storageBucket: "taskflow-6b8f1.appspot.com",
  messagingSenderId: "984525100419",
  appId: "1:984525100419:web:f95120b811dd39ed4252b6"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const firestoreDB = getFirestore(app);

// ✅ Test Firebase connection safely
async function testFirebase() {
  try {
    console.log("Testing Firebase connection...");
    
    // Attempt to retrieve a test collection
    const querySnapshot = await getDocs(collection(firestoreDB, 'testCollection'));
    
    if (querySnapshot.empty) {
      console.warn("⚠️ No documents found in 'testCollection'. Check Firestore.");
    } else {
      querySnapshot.forEach((doc) => {
        console.log(`📄 Document ID: ${doc.id} =>`, doc.data());
      });
    }
    
    console.log("✅ Firebase connection test completed.");
  } catch (error) {
    console.error('❌ Firebase connection error:', error);
  }
}

// Run Firebase test on startup
testFirebase();

// Initialize IndexedDB
let indexedDBInstance = null;

function initDB() {
  const request = indexedDB.open('TaskFlowDB', 1);

  request.onupgradeneeded = (event) => {
    indexedDBInstance = event.target.result;
    if (!indexedDBInstance.objectStoreNames.contains('tasks')) {
      indexedDBInstance.createObjectStore('tasks', { keyPath: 'id' });
    }
  };

  request.onsuccess = (event) => {
    indexedDBInstance = event.target.result;
    console.log('IndexedDB initialized successfully.');
    renderTaskList();
  };

  request.onerror = (event) => {
    console.error('IndexedDB initialization failed:', event.target.error);
  };
}

// Save task to IndexedDB
async function saveTaskToDB(task) {
  if (!indexedDBInstance) {
    console.error("❌ IndexedDB is not initialized.");
    return;
  }

  console.log(`📥 BEFORE Saving Task: ${task.id} → ${task.status}`);

  try {
    const transaction = indexedDBInstance.transaction('tasks', 'readwrite');
    const store = transaction.objectStore('tasks');
    await store.put(task);

    console.log(`✅ AFTER Saving Task: ${task.id} → ${task.status}`);
  } catch (error) {
    console.error("❌ Error saving task to IndexedDB:", error);
  }
}

// Get all tasks from IndexedDB
function getAllTasks() {
  return new Promise(async (resolve, reject) => {
    if (!indexedDBInstance) {
      return reject("IndexedDB not initialized");
    }
    // Always fetch local tasks first
    const transaction = indexedDBInstance.transaction('tasks', 'readonly');
    const store = transaction.objectStore('tasks');
    const request = store.getAll();
    request.onsuccess = async () => {
      const localTasks = request.result;
      // Always use local tasks if they exist—even if navigator.onLine is true.
      if (localTasks && localTasks.length > 0) {
        resolve(localTasks);
      } else {
        // Only if there are no local tasks, try to fetch from Firestore.
        if (navigator.onLine) {
          try {
            const querySnapshot = await getDocs(collection(firestoreDB, 'tasks'));
            const tasks = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            resolve(tasks);
          } catch (error) {
            console.error('Error fetching Firestore tasks:', error);
            reject(error);
          }
        } else {
          resolve([]); // Offline and no local tasks.
        }
      }
    };
    request.onerror = () => reject(request.error);
  });
}

// Remove task from IndexedDB
function deleteTaskFromDB(id) {
  return new Promise((resolve, reject) => {
    const transaction = indexedDBInstance.transaction('tasks', 'readwrite');
    const store = transaction.objectStore('tasks');
    const request = store.delete(id);
    request.onsuccess = () => {
      console.log(`✅ Task ${id} deleted from IndexedDB`);
      resolve();
    };
    request.onerror = () => {
      console.error("❌ Error deleting task from IndexedDB:", request.error);
      reject(request.error);
    };
  });
}

// Load tasks on startup
window.onload = async () => {
  updateOfflineStatus();
  window.addEventListener('online', updateOfflineStatus);
  window.addEventListener('offline', updateOfflineStatus);

  initDB();

  await new Promise((resolve) => {
    const checkInterval = setInterval(() => {
      if (indexedDBInstance !== null) {
        clearInterval(checkInterval);
        resolve();
    }
  }, 100);
  });
  renderTaskList();
  scheduleExistingReminders();

  requestNotificationPermission();
  loadThemePreference();

  // Initialize drag-and-drop functionality
  const taskList = document.getElementById('taskList');
  new Sortable(taskList, {
    animation: 150,
    onEnd: () => {
      updateTaskOrder();
    },
  });

    // Add event listener after rendering tasks
    document.getElementById('taskList').addEventListener('click', async (e) => {
      const taskDiv = e.target.closest('.task');
      if (!taskDiv) return;
    
      const taskId = taskDiv.dataset.id;
    
      if (e.target.classList.contains('edit-btn')) {
        await loadTaskForEditing(taskId);
      } else if (e.target.classList.contains('delete-btn')) {
        await deleteTask(taskId);
      } else if (e.target.classList.contains('task-checkbox')) {
        await toggleTaskCompletion(taskId);
      }
    });    
    

  // Display network status
  updateNetworkStatus();
  enableDragAndDrop();
  window.addEventListener('online', updateNetworkStatus);
  window.addEventListener('offline', updateNetworkStatus);

  document.getElementById("statusFilter").addEventListener("change", populateBoardView);
  document.getElementById("priorityFilter").addEventListener("change", populateBoardView);
  document.getElementById("tagFilter").addEventListener("input", populateBoardView);

};

// Update Task Status (Firestore + IndexedDB)
let updatingTasks = new Set(); // ✅ Prevents multiple updates at once

async function updateTaskStatus(taskId, newStatus) {
  let task = await getTaskById(taskId);
  if (!task) {
    console.warn(`⚠️ Task ${taskId} not found in IndexedDB`);
    return;
  }

  console.log(`🟢 BEFORE updateTaskStatus: Task ${taskId} → ${task.status} | New Status: ${newStatus}`);

  // ✅ FORCE status update
  task.status = newStatus;

  // ✅ Save to IndexedDB
  await saveTaskToDB(task);

  // ✅ Confirm IndexedDB saved correctly
  let updatedTask = await getTaskById(taskId);
  console.log(`✅ AFTER updateTaskStatus: IndexedDB Task ${updatedTask.id} → ${updatedTask.status}`);

  if (navigator.onLine) {
    try {
      await updateDoc(doc(firestoreDB, 'tasks', taskId), { status: newStatus });
      console.log(`✅ Firestore Updated: Task ${taskId} → ${newStatus}`);

      // 🛠 Fetch the Firestore task again to avoid IndexedDB mismatches
      const updatedTaskRef = doc(firestoreDB, 'tasks', taskId);
      const updatedTaskSnap = await getDoc(updatedTaskRef);
      if (updatedTaskSnap.exists()) {
        let firestoreTask = { id: updatedTaskSnap.id, ...updatedTaskSnap.data() };

        // ✅ Save the Firestore version again to IndexedDB (to avoid mismatches)
        await saveTaskToDB(firestoreTask);
        console.log(`✅ IndexedDB Reconfirmed from Firestore: Task ${firestoreTask.id} → ${firestoreTask.status}`);
      }
    } catch (error) {
      console.error(`❌ Firestore update failed: Task ${taskId}`, error);
    }
  }

  // ✅ Refresh board
  await populateBoardView();
}

// --- View Switching Functionality ---
// Call this function when a user selects a view.
function switchView(view) {
  // Hide all view containers
  document.getElementById('listView').style.display = 'none';
  document.getElementById('boardView').style.display = 'none';
  document.getElementById('calendarView').style.display = 'none';

  // Show the selected view and populate if needed
  if (view === 'list') {
    document.getElementById('listView').style.display = 'block';
  } else if (view === 'board') {
    document.getElementById('boardView').style.display = 'flex';
    populateBoardView();
  } else if (view === 'calendar') {
    document.getElementById('calendarView').style.display = 'block';
    populateCalendarView();
  }
}

// Attach event listeners for view switching buttons.
// Make sure these IDs match your index.html buttons.
document.getElementById('listViewBtn').addEventListener('click', () => switchView('list'));
document.getElementById('boardViewBtn').addEventListener('click', () => switchView('board'));
document.getElementById('calendarViewBtn').addEventListener('click', () => switchView('calendar'));

// Enable Drag-and-Drop for Kanban Board
function enableDragAndDrop() {
  console.log("🔄 Initializing Drag-and-Drop...");

  document.querySelectorAll('.column-tasks').forEach(column => {
    if (!column) {
      console.error("❌ Column not found:", column);
      return;
    }

    console.log(`✅ Enabling Drag-and-Drop for ${column.id}`);

    new Sortable(column, {
      group: 'tasks',
      animation: 150,
      onEnd: async (event) => {
        console.log(`🎯 Drag Ended: Task ${event.item.dataset.id}`);

        const taskId = event.item.dataset.id;
        if (!taskId) return;

        const columnId = event.to.id; // Gets the target column ID
        let newStatus = columnId.replace('Tasks', '').toLowerCase(); // Converts to lowercase

        // 🛠 Fix Status Mapping to Match Expected Cases
        if (newStatus === "inprogress") newStatus = "inProgress";  // Fix camel case issue

        if (!["todo", "inProgress", "done"].includes(newStatus)) {
          console.error(`❌ Invalid status detected: ${newStatus}`);
          return;
        }

        console.log(`🎯 Dragged Task ${taskId} → New Status: ${newStatus}`);

        // ✅ Delay update to prevent race conditions
        setTimeout(() => {
          updateTaskStatus(taskId, newStatus);
        }, 100);
      }
    });
  });

  console.log("✅ Drag-and-Drop initialized successfully.");
}

// Optional placeholder functions to populate board and calendar views
async function populateBoardView() {
  console.log("🖥 Populating board view with tasks...");

  const tasks = await getAllTasks();
  if (!tasks || tasks.length === 0) {
    console.warn('⚠️ No tasks found.');
    return;
  }

  // ✅ Get filter values
  const statusFilter = document.getElementById("statusFilter").value;
  const priorityFilter = document.getElementById("priorityFilter").value;
  const tagFilter = document.getElementById("tagFilter").value.toLowerCase().trim();

  const todoContainer = document.getElementById('todoTasks');
  const inProgressContainer = document.getElementById('inProgressTasks');
  const doneContainer = document.getElementById('doneTasks');

  // ✅ Ensure all columns are cleared before repopulating
  todoContainer.innerHTML = "";
  inProgressContainer.innerHTML = "";
  doneContainer.innerHTML = "";

  tasks.forEach(task => {
    // ✅ Apply Filters: Skip tasks that don't match selected filters
    if (
      (statusFilter !== "all" && task.status !== statusFilter) ||
      (priorityFilter !== "all" && task.priority !== priorityFilter) ||
      (tagFilter && !task.tags.some(tag => tag.toLowerCase().includes(tagFilter)))
    ) {
      return; // Skip task if it doesn't match filters
    }

    console.log(`📝 Task ${task.id}: ${task.title} → ${task.status}`);

    const taskDiv = document.createElement("div");
    taskDiv.className = "board-task";
    taskDiv.dataset.id = task.id;
    taskDiv.innerHTML = `<h4>${task.title}</h4><p>${task.description}</p>`;

    if (task.status === "todo") {
      todoContainer.appendChild(taskDiv);
    } else if (task.status === "inProgress") {
      inProgressContainer.appendChild(taskDiv);
    } else if (task.status === "done") {
      doneContainer.appendChild(taskDiv);
    }
  });

  console.log("✅ Board view populated.");
}

async function populateCalendarView() {
  const calendarGrid = document.getElementById('calendarGrid');
  calendarGrid.innerHTML = ""; // Clear any previous cells
  
  // Get current month and year
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth(); // 0-indexed
  
  // Determine number of days in this month
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  
  // Optionally, add header for days of week here if desired
  
  // Create a cell for each day of the month
  for (let day = 1; day <= daysInMonth; day++) {
    const cell = document.createElement('div');
    cell.className = "calendar-cell";
    cell.setAttribute("data-day", day);
    cell.innerHTML = `<div class="cell-date">${day}</div><div class="cell-tasks"></div>`;
    calendarGrid.appendChild(cell);
  }
  
  // Now, fetch tasks and place those with reminderDate in the correct cell
  try {
    const tasks = await getAllTasks();
    tasks.forEach(task => {
      if (task.reminderDate) {
        // Assuming reminderDate is in ISO format (YYYY-MM-DD)
        const taskDate = new Date(task.reminderDate);
        if (taskDate.getFullYear() === year && taskDate.getMonth() === month) {
          const day = taskDate.getDate();
          const cell = calendarGrid.querySelector(`.calendar-cell[data-day="${day}"]`);
          if (cell) {
            const cellTasks = cell.querySelector('.cell-tasks');
            const taskElement = document.createElement('div');
            taskElement.className = "calendar-task";
            taskElement.textContent = task.title;
            cellTasks.appendChild(taskElement);
          }
        }
      }
    });
    console.log("Calendar view populated.");
  } catch (err) {
    console.error("Error populating calendar view:", err);
  }
}

let wasOnline = false;

async function pollConnectivity() {
  const isConnected = await checkConnectivity();
  // Detect transition: previously offline and now online
  if (!wasOnline && isConnected) {
    console.log("Connectivity restored – triggering syncTasks()");
    syncTasks();
  }
  wasOnline = isConnected;
}

// Check connectivity every 5 seconds
setInterval(pollConnectivity, 5000);

async function checkConnectivity() {
  try {
    // A lightweight request that doesn't require CORS (e.g., using no-cors mode)
    await fetch("https://www.google.com", { mode: 'no-cors' });
    return true;
  } catch (error) {
    console.error("Connectivity check failed:", error);
    return false;
  }
}

async function updateNetworkStatus() {
  const isConnected = await checkConnectivity();
  console.log("updateNetworkStatus: isConnected =", isConnected);
  const statusElement = document.getElementById('networkStatus');
  if (isConnected) {
    statusElement.textContent = '🟢 Online - Syncing enabled';
    statusElement.style.color = 'green';
    syncTasks();
  } else {
    statusElement.textContent = '🔴 Offline - Changes will sync when reconnected';
    statusElement.style.color = 'red';
  }
}

// Show offline status
function updateOfflineStatus() {
  const offlineStatus = document.getElementById('offlineStatus');
  offlineStatus.style.display = navigator.onLine ? 'none' : 'block';
}

// Schedule reminders for existing tasks
function scheduleExistingReminders() {
  getAllTasks().then(tasks => {
    const now = Date.now();
    tasks.forEach(task => {
      if (task.reminderDate && task.reminderTime) {
        const reminderTime = new Date(`${task.reminderDate}T${task.reminderTime}`).getTime();
        if (reminderTime > now) {
          ipcRenderer.send('schedule-reminder', task);
        }
      }
    });
  });
}

// Request notification permission
function requestNotificationPermission() {
  if (Notification.permission !== 'granted') {
    Notification.requestPermission();
  }
}

// Handle Task Form Submission
let currentTaskId = null;

document.getElementById('taskForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (currentTaskId) {
    await updateTask(currentTaskId);
  } else {
    await addNewTask();
  }
});

// Add new task
async function addNewTask() {
  const task = getFormData();

  if (!task.title.trim()) {
    alert("Task title is required!");
    return;
  }

  try {
    // Save task to IndexedDB
    await saveTaskToDB(task);

    if (navigator.onLine) {
      // Use setDoc with the locally generated task.id to keep IDs consistent
      await setDoc(doc(firestoreDB, 'tasks', task.id.toString()), task);
      console.log("✅ Task added to Firestore with ID:", task.id);
    }

    renderTaskList();
    ipcRenderer.send('schedule-reminder', task);
    resetForm();
  } catch (error) {
    console.error("❌ Error adding task:", error);
  }
}

// Get data from form
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
    // Create an ID that is clearly non-numeric by appending a random alphanumeric string.
    id: Date.now().toString() + "_" + Math.random().toString(36).substring(2),
    title,
    description,
    priority,
    tags: tagsInput.split(',').map(tag => tag.trim()),
    reminderDate,
    reminderTime,
    reminderSound,
    completed: false
  };
}

// Render all tasks
async function renderTaskList() {
  const taskList = document.getElementById('taskList');
  taskList.innerHTML = '';

  const tasks = await getAllTasks();
  if (!tasks || tasks.length === 0) {
    console.warn('⚠️ No tasks found.');
    return;
  }

  tasks.sort((a, b) => a.priority.localeCompare(b.priority));
  tasks.forEach(task => addTaskToDOM(task));
  console.log("✅ Task list updated.");
}

async function syncTasks() {
  console.log("🔄 syncTasks() called");

  if (!navigator.onLine) {
    console.warn("❌ Offline - Cannot sync tasks.");
    return;
  }

  console.log("📤 Syncing local tasks with Firestore...");

  try {
    const querySnapshot = await getDocs(collection(firestoreDB, 'tasks'));
    const firestoreTasks = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    console.log(`📥 Fetched ${firestoreTasks.length} tasks from Firestore.`);

    for (const firestoreTask of firestoreTasks) {
      console.log(`📥 Checking Firestore Task: ${firestoreTask.id} → ${firestoreTask.status}`);

      let localTask = await getTaskById(firestoreTask.id);

      // 🚫 Ignore outdated updates
      if (localTask && localTask.lastModified > (firestoreTask.lastModified || 0)) {
        console.warn(`🚫 Skipping Firestore update for Task ${firestoreTask.id} (Local task is newer).`);
        continue;
      }

      console.log(`🔄 Updating IndexedDB with Firestore Task: ${firestoreTask.id} → ${firestoreTask.status}`);
      await saveTaskToDB(firestoreTask);
    }

    await populateBoardView();
  } catch (err) {
    console.error("❌ Transaction error in syncTasks:", err);
  }
}


// Add task to DOM
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
    <span class="priority-label">${task.priority}</span>
    ${tagsHTML}
    ${reminderHTML}
    <div class="task-actions">
      <button class="edit-btn">Edit</button>
      <button class="delete-btn">Delete</button>
    </div>
  `;

  taskList.appendChild(taskDiv);
}

// Load task for editing
async function loadTaskForEditing(taskId) {
  const key = taskId.toString();
  const task = await getTaskById(key);
  if (!task) {
    console.warn(`Task with ID ${key} not found.`);
    alert("Task not found. It may not be synced properly.");
    return;
  }
  document.getElementById('taskTitle').value = task.title;
  document.getElementById('taskDescription').value = task.description;
  document.getElementById('taskPriority').value = task.priority;
  document.getElementById('taskTags').value = task.tags.join(', ');
  document.getElementById('taskReminderDate').value = task.reminderDate || '';
  document.getElementById('taskReminderTime').value = task.reminderTime || '';
  document.getElementById('taskReminderSound').value = task.reminderSound || 'default';
  currentTaskId = key;
}

// Update task
async function updateTask(taskId) {
  const task = getFormData();
  task.id = taskId;
  await saveTaskToDB(task);
  renderTaskList();
  resetForm();
}

// Reset form
function resetForm() {
  document.getElementById('taskForm').reset();
  currentTaskId = null;
}

// Delete task
async function deleteTask(taskId) {
  if (confirm('Are you sure you want to delete this task?')) {
    try {
      await deleteTaskFromDB(taskId);
      console.log(`✅ Task ${taskId} deleted locally.`);
      
      if (navigator.onLine) {
        const taskRef = doc(firestoreDB, 'tasks', taskId.toString());
        await deleteDoc(taskRef);
        console.log(`✅ Task ${taskId} deleted from Firestore.`);
      }
      renderTaskList();
    } catch (error) {
      console.error("❌ Error deleting task:", error);
    }
  }
}

async function getTaskById(taskId) {
  const key = taskId.toString();
  if (navigator.onLine) {
    try {
      const taskRef = doc(firestoreDB, 'tasks', key);
      const taskSnap = await getDoc(taskRef);
      if (taskSnap.exists()) {
        // Get the online version and update the local store for consistency
        const onlineTask = { id: taskSnap.id, ...taskSnap.data() };
        await saveTaskToDB(onlineTask);  // Update local IndexedDB with online data
        return onlineTask;
      } else {
        // If not found online, fallback to local copy
        return await getLocalTaskById(key);
      }
    } catch (error) {
      console.error("❌ Error fetching task from Firestore:", error);
      return await getLocalTaskById(key);
    }
  } else {
    // Offline: always use the local IndexedDB copy
    return await getLocalTaskById(key);
  }
}

// Toggle task completion
async function toggleTaskCompletion(taskId) {
  const key = taskId.toString();
  const task = await getTaskById(key);
  if (!task) return;

  task.completed = !task.completed;

  try {
    // If online, update Firestore as well
    if (navigator.onLine) {
      const taskRef = doc(firestoreDB, 'tasks', key);
      await updateDoc(taskRef, { completed: task.completed });
      console.log(`✅ Task ${key} marked as ${task.completed ? 'completed' : 'incomplete'} online.`);
    }
    // Update local IndexedDB
    await saveTaskToDB(task);
    renderTaskList();
  } catch (error) {
    console.error("❌ Error updating task:", error);
  }
}


// Show notifications
function showNotification(title, message) {
  if (Notification.permission === 'granted') {
    new Notification(title, { body: message });
  }
}

// Load theme preference
function loadThemePreference() {
  const currentTheme = localStorage.getItem('theme') || 'light';
  document.documentElement.setAttribute('data-theme', currentTheme);
  const toggle = document.getElementById('themeToggle');
  toggle.checked = currentTheme === 'dark';

  toggle.addEventListener('change', () => {
    const newTheme = toggle.checked ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
  });
}

// Helper: Always retrieve task from IndexedDB
async function getLocalTaskById(taskId) {
  const key = taskId.toString();
  return new Promise((resolve, reject) => {
    if (!indexedDBInstance) {
      return reject("IndexedDB not initialized");
    }
    const transaction = indexedDBInstance.transaction('tasks', 'readonly');
    const store = transaction.objectStore('tasks');
    const request = store.get(key);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}