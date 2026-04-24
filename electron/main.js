const { app, BrowserWindow } = require("electron");
const path = require("path");
const { spawn } = require("child_process");
const http = require("http");

let mainWindow = null;
let loadingWindow = null;
let backendProcess = null;

const BACKEND_PORT = 5000;
const BACKEND_URL = `http://localhost:${BACKEND_PORT}`;

function getBackendPath() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "backend", "server.js");
  }

  return path.join(__dirname, "../backend/server.js");
}

function getBackendCwd() {
  if (app.isPackaged) {
    return app.getPath("userData");
  }

  return path.join(__dirname, "../backend");
}

function getFrontendPath() {
  return path.join(__dirname, "../frontend/build/index.html");
}

function isBackendRunning() {
  return new Promise((resolve) => {
    const req = http.get(BACKEND_URL, () => {
      resolve(true);
    });

    req.on("error", () => {
      resolve(false);
    });

    req.setTimeout(1000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

function waitForBackend() {
  return new Promise((resolve) => {
    const check = async () => {
      const running = await isBackendRunning();

      if (running) {
        resolve(true);
      } else {
        setTimeout(check, 500);
      }
    };

    check();
  });
}

function startBackend() {
  return new Promise((resolve, reject) => {
    const backendPath = getBackendPath();
    const backendCwd = getBackendCwd();

    console.log("Starting backend from:", backendPath);
    console.log("Backend working directory:", backendCwd);

    backendProcess = spawn(process.execPath, [backendPath], {
      cwd: backendCwd,
      env: {
        ...process.env,
        ELECTRON_RUN_AS_NODE: "1"
      },
      windowsHide: true,
      shell: false,
      stdio: "pipe"
    });

    backendProcess.stdout.on("data", (data) => {
      console.log(`Backend: ${data.toString()}`);
    });

    backendProcess.stderr.on("data", (data) => {
      console.error(`Backend Error: ${data.toString()}`);
    });

    backendProcess.on("error", (err) => {
      console.error("Failed to start backend:", err);
      reject(err);
    });

    backendProcess.on("exit", (code) => {
      console.log("Backend exited with code:", code);
    });

    waitForBackend().then(resolve);
  });
}

function createLoadingWindow() {
  loadingWindow = new BrowserWindow({
    width: 420,
    height: 260,
    frame: false,
    resizable: false,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  loadingWindow.loadFile(path.join(__dirname, "loading.html"));

  loadingWindow.once("ready-to-show", () => {
    loadingWindow.show();
  });
}

function closeLoadingWindow() {
  if (loadingWindow) {
    loadingWindow.close();
    loadingWindow = null;
  }
}

function createMainWindow() {
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

  mainWindow.loadFile(getFrontendPath());

  mainWindow.once("ready-to-show", () => {
    closeLoadingWindow();
    mainWindow.show();
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  createLoadingWindow();

  const backendRunning = await isBackendRunning();

  if (!backendRunning) {
    await startBackend();
  }

  createMainWindow();
});

app.on("before-quit", () => {
  if (backendProcess) {
    backendProcess.kill();
    backendProcess = null;
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});