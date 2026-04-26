const { app, BrowserWindow, dialog } = require("electron");
const path = require("path");
const { autoUpdater } = require("electron-updater");

let mainWindow = null;

function getFrontendPath() {
  return path.join(__dirname, "../frontend/build/index.html");
}

function getIconPath() {
  return path.join(__dirname, "../frontend/public/icon.ico");
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    title: "NPRAFS Service Center",
    icon: getIconPath(),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  mainWindow.loadFile(getFrontendPath());

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();

    // 🔥 Check for updates AFTER window is ready
    autoUpdater.checkForUpdatesAndNotify();
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// ----------------------
// AUTO UPDATER SETTINGS
// ----------------------

// Optional but useful for debugging
autoUpdater.logger = require("electron-log");
autoUpdater.logger.transports.file.level = "info";

// Prevent auto install without user confirmation
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;

// ----------------------
// AUTO UPDATER EVENTS
// ----------------------

autoUpdater.on("checking-for-update", () => {
  console.log("Checking for updates...");
});

autoUpdater.on("update-available", () => {
  dialog.showMessageBox({
    type: "info",
    title: "Update Available",
    message: "A new update is available and is being downloaded."
  });
});

autoUpdater.on("update-not-available", () => {
  console.log("No updates available.");
});

autoUpdater.on("download-progress", (progressObj) => {
  console.log(`Download speed: ${progressObj.bytesPerSecond}`);
  console.log(`Downloaded: ${progressObj.percent}%`);
});

autoUpdater.on("update-downloaded", () => {
  dialog
    .showMessageBox({
      type: "info",
      title: "Update Ready",
      message: "Update downloaded. Restart now to install?",
      buttons: ["Restart Now", "Later"]
    })
    .then((result) => {
      if (result.response === 0) {
        autoUpdater.quitAndInstall();
      }
    });
});

autoUpdater.on("error", (err) => {
  console.error("Auto updater error:", err);
});

// ----------------------
// APP LIFECYCLE
// ----------------------

app.whenReady().then(() => {
  createMainWindow();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createMainWindow();
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});