const { app, BrowserWindow, ipcMain, Notification } = require('electron');
const path = require('path');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true, // Allows Node.js access
      contextIsolation: false, // Prevents script isolation
      enableRemoteModule: true, // Enables remote module
      sandbox: false, // Disables sandbox restrictions
      webSecurity: false, // ✅ Allows localStorage and loads local resources
      allowRunningInsecureContent: true // ✅ Ensures localStorage works properly
    }
  });

    // Load the correct file in packaged mode
    const startURL = app.isPackaged
    ? `file://${path.join(app.getAppPath(), 'src', 'index.html')}`
    : `file://${path.join(__dirname, 'src', 'index.html')}`;

  mainWindow.loadFile('src/index.html');

  // Apply saved theme when window loads
  mainWindow.webContents.on('did-finish-load', () => {
    checkForUpdates();
    mainWindow.webContents.executeJavaScript(`
      (() => {
        try {
          const theme = localStorage.getItem('theme') || 'light';
          document.documentElement.setAttribute('data-theme', theme);
        } catch (error) {
          console.error('⚠️ LocalStorage Access Error:', error);
        }
      })();
    `);
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// ✅ AutoUpdater Configuration
autoUpdater.autoDownload = false; // Only notify the user; don't auto-download

autoUpdater.on('update-available', (info) => {
  console.log(`Update available: Version ${info.version}`);
  dialog.showMessageBox({
    type: 'info',
    title: 'Update Available',
    message: `A new version (${info.version}) is available. Do you want to update now?`,
    buttons: ['Update', 'Later']
  }).then(result => {
    if (result.response === 0) { // User clicked 'Update'
      autoUpdater.downloadUpdate();
    }
  });
});

autoUpdater.on('update-downloaded', () => {
  dialog.showMessageBox({
    type: 'info',
    title: 'Update Ready',
    message: 'Update downloaded. Restart the app to apply changes.',
    buttons: ['Restart', 'Later']
  }).then(result => {
    if (result.response === 0) { // User clicked 'Restart'
      autoUpdater.quitAndInstall();
    }
  });
});

// ✅ Function to Manually Check for Updates
function checkForUpdates() {
  autoUpdater.checkForUpdates();
}

// Expose checkForUpdates to the Renderer Process
ipcMain.on('check-for-updates', () => {
  checkForUpdates();
});

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
