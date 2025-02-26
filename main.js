const { app, BrowserWindow, ipcMain, Notification } = require('electron');
const path = require('path');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  mainWindow.loadFile('src/index.html');

  // Apply saved theme when window loads
  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.executeJavaScript(`
      const theme = localStorage.getItem('theme') || 'light';
      document.documentElement.setAttribute('data-theme', theme);
    `);
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

// Listen for theme changes from renderer
ipcMain.on('set-theme', (event, theme) => {
  if (mainWindow) {
    mainWindow.webContents.send('apply-theme', theme);
  }
});

// Handle Reminder Scheduling from Renderer
ipcMain.on('schedule-reminder', (event, task) => {
    const reminderDateTime = new Date(`${task.reminderDate}T${task.reminderTime}`).getTime();
    const now = Date.now();
    const delay = reminderDateTime - now;
  
    if (delay > 0) {
      setTimeout(() => {
        triggerReminder(task);
      }, delay);
      console.log(`Reminder set for task: ${task.title} in ${delay / 1000} seconds`);
    } else {
      console.log(`Reminder time for task: ${task.title} has already passed.`);
    }
  });

// Trigger Reminder with Snooze/Dismiss
function triggerReminder(task) {
    console.log(`Triggering reminder for task: ${task.title}`);
  
    const notification = new Notification({
      title: `Reminder: ${task.title}`,
      body: task.description || 'You have a task scheduled!',
      silent: false
    });
  
    notification.show();
  
    notification.on('show', () => {
      console.log(`Notification displayed for task: ${task.title}`);
    });
  
    if (mainWindow) {
      mainWindow.webContents.send('trigger-reminder', task);
    }
}
  

ipcMain.on('snooze-reminder', (event, task) => {
  const snoozeTime = 5 * 60 * 1000;  // 5 minutes snooze
  setTimeout(() => {
    triggerReminder(task);
  }, snoozeTime);
});

ipcMain.on('dismiss-reminder', (event, taskId) => {
  if (mainWindow) {
    mainWindow.webContents.send('dismiss-reminder', taskId);
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
