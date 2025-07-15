const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs').promises;

class LanguageLearningApp {
  constructor() {
    this.mainWindow = null;
    this.isDev = process.argv.includes('--dev');
  }

  createWindow() {
    this.mainWindow = new BrowserWindow({
      width: 1400,
      height: 900,
      minWidth: 800,
      minHeight: 600,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        enableRemoteModule: false,
        preload: path.join(__dirname, 'preload.js')
      },
      titleBarStyle: 'hiddenInset',
      backgroundColor: '#1a1a1a',
      show: false,
      icon: path.join(__dirname, 'assets', 'icon.png')
    });

    this.mainWindow.loadFile('index.html');

    this.mainWindow.once('ready-to-show', () => {
      this.mainWindow.show();
      if (this.isDev) {
        this.mainWindow.webContents.openDevTools();
      }
    });

    this.mainWindow.on('closed', () => {
      this.mainWindow = null;
    });

    // Handle external links
    this.mainWindow.webContents.setWindowOpenHandler(({ url }) => {
      shell.openExternal(url);
      return { action: 'deny' };
    });
  }

  setupIPC() {
    // Handle file selection
    ipcMain.handle('select-image', async () => {
      try {
        const result = await dialog.showOpenDialog(this.mainWindow, {
          properties: ['openFile'],
          filters: [
            {
              name: 'Images',
              extensions: ['jpg', 'jpeg', 'png', 'webp', 'gif']
            }
          ]
        });

        if (!result.canceled && result.filePaths.length > 0) {
          const filePath = result.filePaths[0];
          const fileData = await fs.readFile(filePath);
          const base64Data = fileData.toString('base64');
          const fileName = path.basename(filePath);
          const fileSize = fileData.length;

          return {
            success: true,
            data: {
              path: filePath,
              name: fileName,
              size: fileSize,
              base64: base64Data,
              mimeType: this.getMimeType(path.extname(filePath))
            }
          };
        }

        return { success: false, error: 'No file selected' };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });

    // Handle settings save/load
    ipcMain.handle('save-settings', async (event, settings) => {
      try {
        const settingsPath = path.join(app.getPath('userData'), 'settings.json');
        await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2));
        return { success: true };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('load-settings', async () => {
      try {
        const settingsPath = path.join(app.getPath('userData'), 'settings.json');
        const data = await fs.readFile(settingsPath, 'utf8');
        return { success: true, data: JSON.parse(data) };
      } catch (error) {
        return { 
          success: true, 
          data: {
            language: 'spanish',
            theme: 'dark',
            ollamaUrl: 'http://localhost:11434'
          }
        };
      }
    });

    // Handle export functionality
    ipcMain.handle('export-data', async (event, data, type) => {
      try {
        const result = await dialog.showSaveDialog(this.mainWindow, {
          defaultPath: `language-learning-${type}-${Date.now()}.json`,
          filters: [
            { name: 'JSON Files', extensions: ['json'] },
            { name: 'All Files', extensions: ['*'] }
          ]
        });

        if (!result.canceled && result.filePath) {
          await fs.writeFile(result.filePath, JSON.stringify(data, null, 2));
          return { success: true, path: result.filePath };
        }

        return { success: false, error: 'Export cancelled' };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });
  }

  getMimeType(extension) {
    const mimeTypes = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.webp': 'image/webp',
      '.gif': 'image/gif'
    };
    return mimeTypes[extension.toLowerCase()] || 'application/octet-stream';
  }

  init() {
    app.whenReady().then(() => {
      this.createWindow();
      this.setupIPC();

      app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
          this.createWindow();
        }
      });
    });

    app.on('window-all-closed', () => {
      if (process.platform !== 'darwin') {
        app.quit();
      }
    });

    // Security: Prevent new window creation
    app.on('web-contents-created', (event, contents) => {
      contents.on('new-window', (event, navigationUrl) => {
        event.preventDefault();
        shell.openExternal(navigationUrl);
      });
    });
  }
}

const languageLearningApp = new LanguageLearningApp();
languageLearningApp.init();