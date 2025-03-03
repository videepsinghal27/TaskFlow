// Import Electron
const { ipcRenderer } = require('electron');
const Sortable = require('sortablejs');
const { jsPDF } = require("jspdf");
const FileSaver = require("file-saver");

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

/// IndexedDB Initialization
let indexedDBInstance = null;
let dbReadyPromise = new Promise((resolve) => {
  window.resolveDBReady = resolve;
});

async function initDB() {
  if (window.dbInitialized) return;
  window.dbInitialized = true;

  const request = indexedDB.open('TaskFlowDB', 1);
  
  request.onupgradeneeded = (event) => {
    indexedDBInstance = event.target.result;
    if (!indexedDBInstance.objectStoreNames.contains('tasks')) {
      indexedDBInstance.createObjectStore('tasks', { keyPath: 'id' });
    }
  };

  request.onsuccess = (event) => {
    indexedDBInstance = event.target.result;
    console.log('✅ IndexedDB initialized.');
    window.resolveDBReady();
  };

  request.onerror = (event) => {
    console.error('❌ IndexedDB initialization failed:', event.target.error);
  };
}

// Utility function to wait for IndexedDB to be ready
async function waitForDBReady() {
  await dbReadyPromise;
}

// Save task to IndexedDB
async function saveTaskToDB(task) {
  await waitForDBReady();  // ✅ Ensure IndexedDB is initialized

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
  await populateBoardView();
}

// Get all tasks from IndexedDB
async function getAllTasks() {
  if (!indexedDBInstance) return [];

  const transaction = indexedDBInstance.transaction('tasks', 'readonly');
  const store = transaction.objectStore('tasks');
  const request = store.getAll();

  return new Promise((resolve, reject) => {
      request.onsuccess = async () => {
          let localTasks = request.result || [];
          
          // ✅ Always fetch Firestore tasks when online
          if (navigator.onLine) {
              try {
                  const querySnapshot = await getDocs(collection(firestoreDB, 'tasks'));
                  const firestoreTasks = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

                  // ✅ Merge Firestore and IndexedDB tasks, avoiding duplicates
                  const mergedTasks = [...new Map([...localTasks, ...firestoreTasks].map(task => [task.id, task])).values()];
                  
                  resolve(mergedTasks);
              } catch (error) {
                  console.error('❌ Firestore fetch failed:', error);
                  resolve(localTasks);
              }
          } else {
              resolve(localTasks);
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
  await dbReadyPromise;  // ✅ Ensure IndexedDB is ready before continuing

  await renderTaskList();

  if (!window.remindersScheduled) {
    scheduleExistingReminders();
    window.remindersScheduled = true;
  }

  requestNotificationPermission();
  loadThemePreference();
  enableDragAndDrop();

// ✅ Add Event Listeners for Report Generation Buttons
document.getElementById('weeklyReportBtn').addEventListener('click', () => generateReport('weekly'));
document.getElementById('monthlyReportBtn').addEventListener('click', () => generateReport('monthly'));

// ✅ Attach Click Events to Export Buttons
document.querySelector("button[onclick=\"exportReport('pdf')\"]").addEventListener('click', () => exportReport('pdf'));
document.querySelector("button[onclick=\"exportReport('csv')\"]").addEventListener('click', () => exportReport('csv'));

  // ✅ Get references only once (better performance)
  document.getElementById('menuToggle').addEventListener('click', function () {
    let sidebar = document.querySelector('.sidebar');
    let isOpen = sidebar.classList.toggle('open');

    // Adjust body margin when sidebar opens or closes
    document.body.style.marginLeft = isOpen ? "180px" : "0";
});

  document.getElementById('analyticsTabBtn').addEventListener('click', function () {
    switchView('analytics');
});
  const taskList = document.getElementById('taskList');
  const statusFilter = document.getElementById("statusFilter");
  const priorityFilter = document.getElementById("priorityFilter");
  const tagFilter = document.getElementById("tagFilter");
  const taskSearch = document.getElementById('taskSearch');

  // ✅ Ensure taskList exists before attaching listeners
  if (taskList && !taskList.hasAttribute('listener')) {
    taskList.addEventListener('click', async (e) => {
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

    taskList.setAttribute('listener', 'true');
  }

  // ✅ Prevent multiple event listeners on filter buttons
  const addUniqueListener = (elem, event, handler) => {
    if (elem && !elem.hasAttribute('listener')) {
      elem.addEventListener(event, handler);
      elem.setAttribute('listener', 'true');
    }
  };

  addUniqueListener(statusFilter, "change", populateBoardView);
  addUniqueListener(priorityFilter, "change", populateBoardView);
  addUniqueListener(tagFilter, "input", populateBoardView);
  addUniqueListener(taskSearch, "input", filterTasksByKeyword);

  // ✅ Avoid adding duplicate network status listeners
  if (!window.networkListenersAdded) {
    window.addEventListener('online', updateNetworkStatus);
    window.addEventListener('offline', updateNetworkStatus);
    window.networkListenersAdded = true;
  }

  updateNetworkStatus();
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

function exportReport(format) {
  console.log(`📤 Exporting report as ${format.toUpperCase()}...`);

  // Ensure elements exist before reading values
  const completedElement = document.getElementById("reportCompleted");
  const pendingElement = document.getElementById("reportPending");
  const overdueElement = document.getElementById("reportOverdue");
  const taskListElement = document.getElementById("reportTaskList");

  if (!completedElement || !pendingElement || !overdueElement || !taskListElement) {
      console.error("❌ Report elements missing!");
      alert("Generate a report first.");
      return;
  }

  const completed = completedElement.textContent;
  const pending = pendingElement.textContent;
  const overdue = overdueElement.textContent;
  const tasks = Array.from(taskListElement.querySelectorAll("li")).map(task => task.textContent);

  if (format === "pdf") {
      generatePDF(completed, pending, overdue, tasks);
  } else if (format === "csv") {
      generateCSV(completed, pending, overdue, tasks);
  }
}


// ✅ Generate PDF Report
function generatePDF(title, completed, pending, overdue, tasks) {
  const doc = new jsPDF();
  doc.setFont("helvetica", "bold");
  doc.text(title, 20, 20);
  doc.setFont("helvetica", "normal");

  doc.text(`✅ Completed Tasks: ${completed}`, 20, 40);
  doc.text(`⏳ Pending Tasks: ${pending}`, 20, 50);
  doc.text(`⚠️ Overdue Tasks: ${overdue}`, 20, 60);

  doc.text("📋 Task List:", 20, 80);
  let y = 90;
  tasks.forEach((task, index) => {
      doc.text(`${index + 1}. ${task}`, 20, y);
      y += 10;
  });

  doc.save(`${title.replace(/\s+/g, "_")}.pdf`);
  console.log("✅ PDF report generated successfully!");
}

// ✅ Generate CSV Report
function generateCSV(title, completed, pending, overdue, tasks) {
  let csvContent = `Task Report,Value\n`;
  csvContent += `Completed Tasks,${completed}\n`;
  csvContent += `Pending Tasks,${pending}\n`;
  csvContent += `Overdue Tasks,${overdue}\n\n`;
  csvContent += `Task List\n`;

  tasks.forEach(task => {
      csvContent += `${task}\n`;
  });

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  FileSaver.saveAs(blob, `${title.replace(/\s+/g, "_")}.csv`);
  console.log("✅ CSV report generated successfully!");
}

async function sendReportByEmail() {
  const email = document.getElementById("reportEmail").value.trim();
  if (!email) {
      alert("Please enter an email address.");
      return;
  }

  const completed = document.getElementById("reportCompleted").textContent;
  const pending = document.getElementById("reportPending").textContent;
  const overdue = document.getElementById("reportOverdue").textContent;
  const tasks = Array.from(document.getElementById("reportTaskList").querySelectorAll("li"))
      .map(task => task.textContent).join("\n");

  const reportText = `
      ✅ Completed: ${completed}
      ⏳ Pending: ${pending}
      ⚠️ Overdue: ${overdue}

      📋 Task List:
      ${tasks}
  `;

  try {
      const response = await fetch("http://localhost:5000/send-report", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, report: reportText })
      });

      const result = await response.text();
      alert(result);
  } catch (error) {
      console.error("❌ Email error:", error);
      alert("Failed to send email.");
  }
}

// Function to filter analytics based on the selected date range
async function filterAnalyticsByDate() {
  const startDate = document.getElementById("startDate").value;
  const endDate = document.getElementById("endDate").value;

  if (!startDate || !endDate) {
      alert("Please select both start and end dates!");
      return;
  }

  console.log(`📊 Filtering analytics from ${startDate} to ${endDate}`);

  const tasks = await getAllTasks(); // Fetch tasks
  const filteredTasks = tasks.filter(task => {
      if (!task.reminderDate) return false; // Ignore tasks without a reminder date
      return task.reminderDate >= startDate && task.reminderDate <= endDate;
  });

  updateAnalyticsUI(filteredTasks);
}

// Function to update analytics UI after filtering
function updateAnalyticsUI(filteredTasks) {
  let totalTasks = filteredTasks.length;
  let completedTasks = filteredTasks.filter(task => task.completed).length;
  let pendingTasks = filteredTasks.filter(task => !task.completed).length;

  const today = new Date().toISOString().split('T')[0]; // Today's date
  let overdueTasks = filteredTasks.filter(task => !task.completed && task.reminderDate && task.reminderDate < today).length;

  // Update UI Elements
  document.getElementById("totalTasks").textContent = totalTasks;
  document.getElementById("completedTasks").textContent = completedTasks;
  document.getElementById("pendingTasks").textContent = pendingTasks;
  document.getElementById("overdueTasks").textContent = overdueTasks;

  // Update Charts
  generateTaskChart(completedTasks, pendingTasks, overdueTasks);
}

// Event Listener for Apply Filter Button
document.getElementById("applyDateFilter").addEventListener("click", filterAnalyticsByDate);

// Function to populate tag filter dropdown
async function populateTagFilter() {
  const tasks = await getAllTasks();
  const tagSet = new Set();

  tasks.forEach(task => {
      if (task.tags) {
          task.tags.forEach(tag => tagSet.add(tag.trim()));
      }
  });

  const tagFilterDropdown = document.getElementById("analyticsTagFilter");
  tagFilterDropdown.innerHTML = '<option value="all">All Tags</option>'; // Reset
  tagSet.forEach(tag => {
      let option = document.createElement("option");
      option.value = tag;
      option.textContent = tag;
      tagFilterDropdown.appendChild(option);
  });

  console.log("🏷 Tag filter dropdown populated.");
}

// Function to filter analytics by selected tag
async function filterAnalyticsByTag() {
  const selectedTag = document.getElementById("analyticsTagFilter").value;
  
  const tasks = await getAllTasks(); // Fetch tasks

  let filteredTasks = tasks;
  if (selectedTag !== "all") {
      filteredTasks = tasks.filter(task => task.tags && task.tags.includes(selectedTag));
  }

  updateAnalyticsUI(filteredTasks);
}

// Event Listener for Apply Tag Filter Button
document.getElementById("applyTagFilter").addEventListener("click", filterAnalyticsByTag);

// Populate tag filter on page load
window.addEventListener("load", populateTagFilter);

// Function to filter analytics by priority
async function filterAnalyticsByPriority() {
  const selectedPriority = document.getElementById("analyticsPriorityFilter").value;

  const tasks = await getAllTasks(); // Fetch tasks

  let filteredTasks = tasks;
  if (selectedPriority !== "all") {
      filteredTasks = tasks.filter(task => task.priority === selectedPriority);
  }

  updateAnalyticsUI(filteredTasks);
}

// Event Listener for Apply Priority Filter Button
document.getElementById("applyPriorityFilter").addEventListener("click", filterAnalyticsByPriority);

// --- View Switching Functionality ---
// Call this function when a user selects a view.
function switchView(view) {
  // Hide all view containers
  document.getElementById('listView').style.display = 'none';
  document.getElementById('boardView').style.display = 'none';
  document.getElementById('calendarView').style.display = 'none';
  document.getElementById('analyticsTab').style.display = 'none';

  // Show the selected view and populate if needed
  if (view === 'list') {
      document.getElementById('listView').style.display = 'block';
  } else if (view === 'board') {
      document.getElementById('boardView').style.display = 'flex';
      populateBoardView();  // ✅ Make sure board updates when switched
  } else if (view === 'calendar') {
      document.getElementById('calendarView').style.display = 'block';
      populateCalendarView();
  } else if (view === 'analytics') {
    document.getElementById('analyticsTab').style.display = 'block';
    updateAnalytics();  // ✅ Call function to update stats when switching
}
}

// Attach event listeners for view switching buttons.
// Make sure these IDs match your index.html buttons.
document.getElementById('listViewBtn').addEventListener('click', () => switchView('list'));
document.getElementById('boardViewBtn').addEventListener('click', () => switchView('board'));
document.getElementById('calendarViewBtn').addEventListener('click', () => switchView('calendar'));

function updateAnalytics() {
  getAllTasks().then(tasks => {
      document.getElementById('totalTasks').textContent = tasks.length;
      document.getElementById('completedTasks').textContent = tasks.filter(t => t.completed).length;
      document.getElementById('pendingTasks').textContent = tasks.filter(t => !t.completed).length;
      
      // Overdue tasks logic (Assuming dueDate is stored in YYYY-MM-DD format)
      const today = new Date().toISOString().split('T')[0];
      document.getElementById('overdueTasks').textContent = tasks.filter(t => t.dueDate && t.dueDate < today && !t.completed).length;
  });
}

let taskChart; // Store chart instance globally

let priorityChart, statusChart; // Store chart instances globally

async function populateAnalytics() {
  const tasks = await getAllTasks();  // Fetch tasks from IndexedDB & Firestore

  let totalTasks = tasks.length;
  let completedTasks = 0;
  let pendingTasks = 0;
  let overdueTasks = 0;
  let totalTrackedTime = 0; // Initialize total tracked time

  // Priority Counters
  let lowPriority = 0;
  let mediumPriority = 0;
  let highPriority = 0;

  // Status Counters
  let todoCount = 0;
  let inProgressCount = 0;
  let doneCount = 0;

  const today = new Date().toISOString().split('T')[0]; // Get today's date

  tasks.forEach(task => {
      if (task.completed) {
          completedTasks++;
      } else {
          pendingTasks++;
      }

      if (!task.completed && task.reminderDate && task.reminderDate < today) {
          overdueTasks++;
      }

      // Count Priorities
      if (task.priority === "low") lowPriority++;
      if (task.priority === "medium") mediumPriority++;
      if (task.priority === "high") highPriority++;

      // Count Statuses
      if (task.status === "todo") todoCount++;
      if (task.status === "inProgress") inProgressCount++;
      if (task.status === "done") doneCount++;

      // Sum up tracked time for all tasks
      totalTrackedTime += task.trackedTime || 0;
  });

  // Update statistics in UI
  document.getElementById("totalTasks").textContent = totalTasks;
  document.getElementById("completedTasks").textContent = completedTasks;
  document.getElementById("pendingTasks").textContent = pendingTasks;
  document.getElementById("overdueTasks").textContent = overdueTasks;
  document.getElementById("totalTrackedTime").textContent = formatTime(totalTrackedTime); // Show formatted time

  console.log("📊 Task analytics updated successfully!");

  // Generate or Update Charts
  generateTaskChart(completedTasks, pendingTasks, overdueTasks);
  generatePriorityChart(lowPriority, mediumPriority, highPriority);
  generateStatusChart(todoCount, inProgressCount, doneCount);
}

document.getElementById('weeklyReportBtn').addEventListener('click', () => {
  generateReport('weekly');
});

document.getElementById('monthlyReportBtn').addEventListener('click', () => {
  generateReport('monthly');
});

async function generateReport(type) {
    console.log(`📊 Generating ${type} report...`);

    const reportData = await fetchReportData(type);

    // Update UI Elements with Task Counts
    document.getElementById("reportCompleted").textContent = reportData.completedCount;
    document.getElementById("reportPending").textContent = reportData.pendingCount;
    document.getElementById("reportOverdue").textContent = reportData.overdueCount;

    const reportList = document.getElementById("reportTaskList");
    reportList.innerHTML = ""; // Clear previous tasks

    if (reportData.tasks.length === 0) {
        reportList.innerHTML = "<li>No tasks found for this period.</li>";
    } else {
        reportData.tasks.forEach(task => {
            const listItem = document.createElement("li");
            listItem.innerHTML = `📌 <strong>${task.title}</strong> - ${task.status.toUpperCase()} (${task.priority})`;
            reportList.appendChild(listItem);
        });
    }

    console.log(`📋 ${type.toUpperCase()} Report Updated.`);
}

async function fetchReportData(reportType) {
  const tasks = await getAllTasks(); // Fetch tasks from IndexedDB & Firestore
  const today = new Date();
  
  // Determine start date based on report type
  let startDate;
  if (reportType === 'weekly') {
      startDate = new Date();
      startDate.setDate(today.getDate() - 7); // Past 7 days
  } else if (reportType === 'monthly') {
      startDate = new Date();
      startDate.setMonth(today.getMonth() - 1); // Past month
  }

  // Filter tasks within the selected range
  const filteredTasks = tasks.filter(task => {
      if (!task.reminderDate) return false; // Ignore tasks without a date
      const taskDate = new Date(task.reminderDate);
      return taskDate >= startDate && taskDate <= today;
  });

  // Count completed, pending, and overdue tasks
  let completedCount = 0, pendingCount = 0, overdueCount = 0;
  const todayString = today.toISOString().split('T')[0];

  filteredTasks.forEach(task => {
      if (task.completed) {
          completedCount++;
      } else {
          pendingCount++;
      }

      if (!task.completed && task.reminderDate < todayString) {
          overdueCount++;
      }
  });

  console.log(`📊 ${reportType.toUpperCase()} REPORT`);
  console.log(`✅ Completed: ${completedCount}`);
  console.log(`⏳ Pending: ${pendingCount}`);
  console.log(`⚠️ Overdue: ${overdueCount}`);

  return { completedCount, pendingCount, overdueCount, tasks: filteredTasks };
}

function generatePriorityChart(low, medium, high) {
  const ctx = document.getElementById('priorityChart').getContext('2d');

  // Destroy previous instance to prevent duplicates
  if (priorityChart) {
      priorityChart.destroy();
  }

  priorityChart = new Chart(ctx, {
      type: 'bar',
      data: {
          labels: ["Low", "Medium", "High"],
          datasets: [{
              label: "Task Count",
              data: [low, medium, high],
              backgroundColor: ["#2ecc71", "#f1c40f", "#e74c3c"], // Green, Yellow, Red
              borderColor: ["#27ae60", "#d4ac0d", "#c0392b"],
              borderWidth: 1
          }]
      },
      options: {
          responsive: true,
          scales: {
              y: {
                  beginAtZero: true
              }
          }
      }
  });

  console.log("📊 Priority chart updated!");
}

function generateStatusChart(todo, inProgress, done) {
  const ctx = document.getElementById('statusChart').getContext('2d');

  // Destroy previous instance to prevent duplicates
  if (statusChart) {
      statusChart.destroy();
  }

  statusChart = new Chart(ctx, {
      type: 'bar',
      data: {
          labels: ["To Do", "In Progress", "Done"],
          datasets: [{
              label: "Task Count",
              data: [todo, inProgress, done],
              backgroundColor: ["#3498db", "#e67e22", "#2ecc71"], // Blue, Orange, Green
              borderColor: ["#2980b9", "#d35400", "#27ae60"],
              borderWidth: 1
          }]
      },
      options: {
          responsive: true,
          scales: {
              y: {
                  beginAtZero: true
              }
          }
      }
  });

  console.log("📊 Status chart updated!");
}

// Ensure analytics are populated when the tab is loaded
document.getElementById('analyticsTabBtn').addEventListener('click', () => {
  populateAnalytics();
});

function createTaskHTML(task) {
  return `
      <input type="checkbox" class="task-checkbox" ${task.completed ? 'checked' : ''}>
      <h3 class="${task.completed ? 'completed' : ''}">${task.title}</h3>
      <p class="${task.completed ? 'completed' : ''}">${task.description}</p>
      <span class="priority-label">${task.priority}</span>
      <div class="tags">${(task.tags || []).map(tag => `<span class="tag">${tag}</span>`).join('')}</div>
      <p class="reminder">
          ${task.reminderDate && task.reminderTime ? `Reminder: ${task.reminderDate} at ${task.reminderTime}` : ''}
      </p>
      
      <!-- Time Tracking UI -->
      <div class="time-tracking">
          ⏱ Time Spent: <span id="time-${task.id}">${typeof formatTime === 'function' ? formatTime(task.trackedTime || 0) : 'N/A'}</span>
          <button class="start-btn" data-id="${task.id}">▶ Start</button>
          <button class="stop-btn" data-id="${task.id}" disabled>⏹ Stop</button>
      </div>

      <div class="task-actions">
          <button class="edit-btn">Edit</button>
          <button class="delete-btn">Delete</button>
      </div>
  `;
}

function formatTime(seconds) {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${hrs}h ${mins}m ${secs}s`;
}

let activeTimers = {}; // Store active timers

document.addEventListener('click', async (event) => {
    if (event.target.classList.contains('start-btn')) {
        const taskId = event.target.dataset.id;
        startTaskTimer(taskId);
    }
    if (event.target.classList.contains('stop-btn')) {
        const taskId = event.target.dataset.id;
        stopTaskTimer(taskId);
    }
});

async function startTaskTimer(taskId) {
    if (activeTimers[taskId]) return; // Prevent multiple timers for one task

    const startTime = Date.now();
    activeTimers[taskId] = { startTime, interval: null };

    const stopBtn = document.querySelector(`.stop-btn[data-id="${taskId}"]`);
    const startBtn = document.querySelector(`.start-btn[data-id="${taskId}"]`);

    stopBtn.disabled = false;
    startBtn.disabled = true;

    activeTimers[taskId].interval = setInterval(async () => {
        let task = await getTaskById(taskId);
        if (!task) return;

        const elapsed = Math.floor((Date.now() - activeTimers[taskId].startTime) / 1000);
        task.trackedTime = (task.trackedTime || 0) + elapsed;

        document.getElementById(`time-${taskId}`).textContent = formatTime(task.trackedTime);
    }, 1000);
}

async function stopTaskTimer(taskId) {
    if (!activeTimers[taskId]) return;

    clearInterval(activeTimers[taskId].interval);

    let task = await getTaskById(taskId);
    if (!task) return;

    const elapsed = Math.floor((Date.now() - activeTimers[taskId].startTime) / 1000);
    task.trackedTime = (task.trackedTime || 0) + elapsed;

    await saveTaskToDB(task); // Save updated time to IndexedDB

    if (navigator.onLine) {
        const taskRef = doc(firestoreDB, 'tasks', taskId);
        await updateDoc(taskRef, { trackedTime: task.trackedTime });
    }

    document.getElementById(`time-${taskId}`).textContent = formatTime(task.trackedTime);

    const stopBtn = document.querySelector(`.stop-btn[data-id="${taskId}"]`);
    const startBtn = document.querySelector(`.start-btn[data-id="${taskId}"]`);

    stopBtn.disabled = true;
    startBtn.disabled = false;

    delete activeTimers[taskId]; // Remove from active timers
}


function generateTaskChart(completed, pending, overdue) {
  const ctx = document.getElementById('taskChart').getContext('2d');

  // Destroy previous chart instance to prevent duplicates
  if (taskChart) {
      taskChart.destroy();
  }

  // Create new Chart.js Pie Chart
  taskChart = new Chart(ctx, {
      type: 'pie',
      data: {
          labels: ["Completed", "Pending", "Overdue"],
          datasets: [{
              data: [completed, pending, overdue],
              backgroundColor: ["#2ecc71", "#f1c40f", "#e74c3c"], // Green, Yellow, Red
              hoverOffset: 4
          }]
      },
      options: {
          responsive: true,
          plugins: {
              legend: {
                  position: 'bottom'
              }
          }
      }
  });

  console.log("📊 Task chart updated!");
}

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
  console.log("📥 Retrieved tasks:", tasks); // ✅ Ensure this retrieves the latest tasks
  if (!tasks || tasks.length === 0) {
      console.warn("⚠️ No tasks found.");
      return;
  }

  // ✅ Get search keyword for filtering
  const keyword = document.getElementById("taskSearch").value.toLowerCase().trim();

  // ✅ Get board column containers
  const todoContainer = document.getElementById("todoTasks");
  const inProgressContainer = document.getElementById("inProgressTasks");
  const doneContainer = document.getElementById("doneTasks");

  // ✅ Clear existing tasks before repopulating
  todoContainer.innerHTML = "";
  inProgressContainer.innerHTML = "";
  doneContainer.innerHTML = "";

  // ✅ Iterate and add tasks while applying the search filter
  tasks.forEach(task => {
      console.log(`📝 Task ${task.id}: ${task.title} → ${task.status}`);
      const taskTitle = task.title.toLowerCase();
      const taskDesc = task.description.toLowerCase();
      
      // ✅ Apply search filtering
      if (keyword && !taskTitle.includes(keyword) && !taskDesc.includes(keyword)) return;

      // ✅ Ensure status is not undefined
      if (!task.status) {
        console.warn(`⚠️ Task ${task.id} has undefined status. Assigning 'todo'.`);
        task.status = "todo";
    }

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

  console.log("✅ Board view populated with search filtering.");
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
          await setDoc(doc(firestoreDB, 'tasks', task.id.toString()), task);
          console.log("✅ Task added to Firestore with ID:", task.id);
      }

      renderTaskList();  // ✅ Update List View
      await populateBoardView();  // ✅ Update Board View immediately after task is added
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
    status: "todo",
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
  taskList.innerHTML = ''; // ✅ Clear before rendering

  const tasks = await getAllTasks();
  console.log("📥 Retrieved tasks:", tasks);

  const fragment = document.createDocumentFragment();

  tasks.forEach(task => {
    const taskDiv = document.createElement('div');
    taskDiv.className = `task priority-${task.priority}`;
    taskDiv.dataset.id = task.id;
    taskDiv.innerHTML = createTaskHTML(task);
    fragment.appendChild(taskDiv);
  });

  taskList.appendChild(fragment); // ✅ Batch insert for better performance
  console.log("✅ Task list updated.");
}

async function syncTasks() {
  console.log("🔄 Syncing tasks...");

  if (!navigator.onLine) {
    console.warn("❌ Offline - Cannot sync tasks.");
    return;
  }

  try {
    const querySnapshot = await getDocs(collection(firestoreDB, 'tasks'));
    const firestoreTasks = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    console.log(`📥 Fetched ${firestoreTasks.length} tasks from Firestore.`);

    for (const firestoreTask of firestoreTasks) {
      let localTask = await getTaskById(firestoreTask.id);

      if (localTask && localTask.lastModified > (firestoreTask.lastModified || 0)) {
        console.warn(`🚫 Skipping Firestore update for Task ${firestoreTask.id} (Local task is newer).`);
        continue;
      }

      console.log(`🔄 Updating IndexedDB with Firestore Task: ${firestoreTask.id}`);
      await saveTaskToDB({ ...firestoreTask, lastModified: Date.now() }); // ✅ Ensure timestamps are updated
    }

    await populateBoardView();
  } catch (err) {
    console.error("❌ Error in syncTasks:", err);
  }
}

// Add task to DOM
function addTaskToDOM(task) {
  const existingTask = document.querySelector(`[data-id="${task.id}"]`);
  if (existingTask) {
    console.warn(`⚠️ Task ${task.id} already exists in DOM, updating instead.`);
    existingTask.outerHTML = createTaskHTML(task); // ✅ Updates instead of duplicating
    return;
  }

  const taskList = document.getElementById('taskList');
  const taskDiv = document.createElement('div');
  taskDiv.className = `task priority-${task.priority}`;
  taskDiv.dataset.id = task.id;
  taskDiv.innerHTML = createTaskHTML(task);
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

function filterTasksByKeyword() {
  const keyword = document.getElementById("taskSearch").value.toLowerCase().trim();

  // Apply filter to List View
  document.querySelectorAll(".task").forEach(task => {
    const title = task.querySelector("h3").textContent.toLowerCase();
    const description = task.querySelector("p").textContent.toLowerCase();
    
    task.style.display = (title.includes(keyword) || description.includes(keyword)) ? "block" : "none";
  });

  // Apply filter to Board View
  populateBoardView(); // Calls board view update with search filtering
}