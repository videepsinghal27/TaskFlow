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
    win.hide();
    createTray();
  });

  // Fully close the app when clicking the close button (X)
  win.on('close', () => {
    if (tray) tray.destroy();  // Destroy tray icon
    app.quit();                // Fully quit the app
  });
}

// Create Tray Icon and Handle Events
function createTray() {
  if (tray) return;

  tray = new Tray(path.join(__dirname, 'assets', 'icon.png'));

  const trayMenu = Menu.buildFromTemplate([
    { label: 'Restore', click: restoreApp },
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
  tray.on('click', restoreApp);

  // Double-click to fully exit from tray
  tray.on('double-click', () => {
    if (tray) tray.destroy();
    app.quit();
  });
}

// Restore the App
function restoreApp() {
  if (win.isMinimized() || !win.isVisible()) {
    win.show();
  }
  win.focus();
}

// Handle reminders with Snooze and Dismiss options
ipcMain.on('schedule-reminder', (event, task) => {
  const now = Date.now();
  const reminderTime = new Date(`${task.reminderDate}T${task.reminderTime}`).getTime();
  const delay = Math.max(reminderTime - now, 0);

  setTimeout(() => {
    const notification = new Notification({
      title: `Reminder: ${task.title}`,
      body: `${task.description}\nDue: ${task.reminderDate} at ${task.reminderTime}`,
      actions: [
        { type: 'button', text: 'Snooze' },
        { type: 'button', text: 'Dismiss' }
      ],
      closeButtonText: 'Close'
    });

    notification.show();

    notification.on('action', (event, index) => {
      if (index === 0) {
        win.webContents.send('snooze-reminder', task);
      } else if (index === 1) {
        win.webContents.send('dismiss-reminder', task);
      }
    });

    if (win && !win.isDestroyed()) {
      win.webContents.send('trigger-reminder', task);
    }
  }, delay);
});

// Handle snooze requests
ipcMain.on('snooze-reminder', (event, task) => {
  const snoozeDuration = 5 * 60 * 1000;

  setTimeout(() => {
    const notification = new Notification({
      title: `Snoozed Reminder: ${task.title}`,
      body: `${task.description}\n(Snoozed by 5 mins)`
    });
    notification.show();

    if (win && !win.isDestroyed()) {
      win.webContents.send('trigger-reminder', task);
    }
  }, snoozeDuration);
});

app.whenReady().then(createWindow);

// For macOS: Recreate window if dock icon is clicked and no windows are open
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// Ensure app quits when all windows are closed (except on macOS)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
