const { app, BrowserWindow } = require("electron");
const path = require("path");

let mainWindow = null;

function getFrontendPath() {
  return path.join(__dirname, "../frontend/build/index.html");
}

function getIconPath() {
  // Make sure this file exists: /public/icon.ico
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
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

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