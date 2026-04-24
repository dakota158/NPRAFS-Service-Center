const { app, BrowserWindow, dialog } = require("electron");
const path = require("path");
const { autoUpdater } = require("electron-updater");

let mainWindow;
let updateChecked = false;

function createWindow() {
  if (mainWindow) return;

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  mainWindow.loadFile(path.join(__dirname, "../frontend/build/index.html"));

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function setupUpdater() {
  autoUpdater.autoDownload = true;

  autoUpdater.on("checking-for-update", () => {
    console.log("Checking for update...");
  });

  autoUpdater.on("update-available", () => {
    console.log("Update available. Downloading...");
  });

  autoUpdater.on("update-not-available", () => {
    console.log("No update available.");
    updateChecked = true;
    createWindow();
  });

  autoUpdater.on("error", (err) => {
    console.error("Update error:", err);
    updateChecked = true;
    createWindow();
  });

  autoUpdater.on("update-downloaded", () => {
    dialog
      .showMessageBox({
        type: "info",
        title: "Update Ready",
        message: "A new update has been downloaded. Restart now to install it?",
        buttons: ["Restart Now", "Later"],
        defaultId: 0,
        cancelId: 1
      })
      .then((result) => {
        if (result.response === 0) {
          autoUpdater.quitAndInstall();
        } else {
          updateChecked = true;
          createWindow();
        }
      });
  });
}

app.whenReady().then(() => {
  if (app.isPackaged) {
    setupUpdater();
    autoUpdater.checkForUpdates();
  } else {
    createWindow();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0 && updateChecked) {
    createWindow();
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});