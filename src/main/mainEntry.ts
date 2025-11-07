// src\main\mainEntry.ts
import { app, BrowserWindow, ipcMain, Menu, nativeImage, nativeTheme } from 'electron'
import { join } from 'path'
import { FileTransferServer, FileTransferClient } from './fileTransferServer'
import { type ServerTransferStatus } from '../common/types'

class Application {
    private mainWindow: BrowserWindow | null = null;
    private fileServer: FileTransferServer | null = null;
    private fileClient: FileTransferClient | null = null;

    constructor() {
        this.createmainWindow();
        this.setupIPC();
    }

    private setupIPC() {
        // 文件传输服务器控制
        ipcMain.handle('start-file-server', async (_, port: number) => {
            try {
                if (this.fileServer) {
                    return { success: false, message: 'File server is already running' };
                }
                
                this.fileServer = new FileTransferServer(port);
                
                // 设置服务端进度回调，将进度信息发送到渲染进程
                this.fileServer.setServerProgressCallback((status: ServerTransferStatus) => {
                    this.mainWindow?.webContents.send('file-transfer-status',status);
                });
                
                return { success: true, message: `File server started on port ${port}` };
            } catch (error: any) {
                return { success: false, message: error.message };
            }
        });

        ipcMain.handle('stop-file-server', async () => {
            try {
                if (!this.fileServer) {
                    return { success: false, message: 'File server is not running' };
                }
                
                this.fileServer.close();
                this.fileServer = null;
                return { success: true, message: 'File server stopped' };
            } catch (error: any) {
                return { success: false, message: error.message };
            }
        });

        // 文件传输客户端控制
        ipcMain.handle('connect-file-client', async (_, url: string) => {
            try {
                if (this.fileClient) {
                    return { success: false, message: 'File client is already connected' };
                }
                
                this.fileClient = new FileTransferClient(url);
                await this.fileClient.connect();
                return { success: true, message: `Connected to file server at ${url}` };
            } catch (error: any) {
                return { success: false, message: error.message };
            }
        });

        ipcMain.handle('disconnect-file-client', async () => {
            try {
                if (!this.fileClient) {
                    return { success: false, message: 'File client is not connected' };
                }
                
                this.fileClient.disconnect();
                this.fileClient = null;
                return { success: true, message: 'Disconnected from file server' };
            } catch (error: any) {
                return { success: false, message: error.message };
            }
        });

        // 文件发送
        ipcMain.handle('send-file', async (_, filePath: string) => {
            try {
                if (!this.fileClient) {
                    return { success: false, message: 'File client is not connected' };
                }
                
                // 发送状态更新到渲染进程
                this.mainWindow?.webContents.send('file-transfer-status', {
                    type: 'transfer-start',
                    message: `Starting to send file: ${filePath}`
                });
                
                // 设置进度回调函数
                this.fileClient.setProgressCallback((progress: number) => {
                    this.mainWindow?.webContents.send('file-transfer-status', {
                        type: 'transfer-progress',
                        message: `Transfer progress: ${progress}%`,
                        progress: progress
                    });
                });
                
                await this.fileClient.sendFile(filePath);
                
                this.mainWindow?.webContents.send('file-transfer-status', {
                    type: 'transfer-complete',
                    message: 'File transfer completed successfully'
                });
                
                return { success: true, message: 'File sent successfully' };
            } catch (error: any) {
                this.mainWindow?.webContents.send('file-transfer-error', {
                    message: error.message
                });
                return { success: false, message: error.message };
            }
        });


        ipcMain.on('set-theme', (_, theme: 'dark' | 'light') => {
            nativeTheme.themeSource = theme;
        })

        ipcMain.on('open-dev-tools', () => {
            this.mainWindow?.webContents.openDevTools({ mode: 'undocked' });
        })
    }

    private createmainWindow() {
        this.mainWindow = new BrowserWindow({
            minHeight: 640,
            minWidth: 800,
            width: 1000,
            height: 800,
            title:'PeerShare',
            icon :nativeImage.createFromPath(join(__dirname, 'icon.png')),
            webPreferences: {
                preload: join(__dirname, 'preload.js'),
                nodeIntegration: false,
                webSecurity: true,
                sandbox: true,
                allowRunningInsecureContent: false,
                contextIsolation: true,
                webviewTag: false,
                spellcheck: false,
                disableHtmlFullscreenWindowResize: true,
            },
        });
        
        this.mainWindow.on('closed', () => {
            this.mainWindow = null;
        })
        Menu.setApplicationMenu(null);
        
        if (process.argv[2]) {
            // this.mainWindow.webContents.openDevTools({ mode: 'undocked' });
            this.mainWindow.loadURL(process.argv[2]);
        } else {
            this.mainWindow.loadFile(join(__dirname, 'index.html'));
        }
    }
}

app.whenReady().then(() => {
    new Application();
})