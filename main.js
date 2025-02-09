const { app, BrowserWindow, ipcMain, Notification, Tray, Menu } = require('electron');
const path = require('path');

let win;
let tray = null;

function createWindow() {
  win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  win.loadFile('src/index.html');

  // Minimize to tray but keep showing in taskbar
  win.on('minimize', (event) => {
    event.preventDefault();
    win.minimize();  // Keep in taskbar
    createTray();    // Also show in system tray
  });

  // Close the app completely when clicking the close button
  win.on('close', () => {
    if (tray) tray.destroy();  // Clean up tray icon when closing
    app.quit();                // Fully quit the app
  });
}

// Create Tray Icon and Handle Events
function createTray() {
  if (tray) return;  // Avoid creating multiple tray icons

  tray = new Tray(path.join(__dirname, 'assets', 'icon.png'));  // Ensure icon.png exists in assets folder

  const trayMenu = Menu.buildFromTemplate([
    { 
      label: 'Restore', 
      click: () => { 
        restoreApp();
      } 
    },
    { 
      label: 'Exit', 
      click: () => { 
        if (tray) tray.destroy();
        app.quit();
      } 
    }
  ]);

  tray.setToolTip('TaskFlow');
  tray.setContextMenu(trayMenu);

  // Restore the app on left-click of the tray icon
  tray.on('click', () => {
    restoreApp();
  });
}

// Restore the App Function
function restoreApp() {
  if (win.isMinimized()) {
    win.restore();  // Restore if minimized
  }
  win.show();  // Ensure window is visible
}

// Handle reminders from the renderer process
ipcMain.on('schedule-reminder', (event, task) => {
  const reminderTime = new Date(`${task.reminderDate}T${task.reminderTime}`).getTime();
  const now = Date.now();
  const delay = reminderTime - now;

  if (delay > 0) {
    setTimeout(() => {
      new Notification({
        title: `Reminder: ${task.title}`,
        body: `${task.description}\nDue: ${task.reminderDate} at ${task.reminderTime}`
      }).show();

      if (win) win.webContents.send('trigger-reminder', task);
    }, delay);
  }
});

app.whenReady().then(createWindow);

// For macOS: Re-create window if the dock icon is clicked after all windows are closed
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
