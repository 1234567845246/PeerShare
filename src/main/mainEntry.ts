// src\main\mainEntry.ts
import { app, BrowserWindow, dialog, ipcMain, Menu, nativeImage, nativeTheme, shell } from 'electron'
import { join } from 'path'
import { existsSync } from 'fs'
import ProgressTracker from './progressTracker'
import { FileTransferServer, FileTransferClient } from './fileTransferServer'
import { type ServerTransferStatus, type ClientTransferStatus } from '../common/types'
import { settings } from './settings'
import SystemTray from './tray'
import { i18n } from './i18n'

class Application {
    private mainWindow: BrowserWindow | null = null;
    private fileServer: FileTransferServer | null = null;
    private fileClient: FileTransferClient | null = null;
    private progressTracker: ProgressTracker | null = null;
    private systemTray: SystemTray | null = null;

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
                this.fileServer.onProgress((status: ServerTransferStatus) => {
                    if (status.type === 'transfer-complete' || status.type === 'transfer-error') {
                        this.progressTracker?.completeProgress();
                    }
                    if (status.type === 'transfer-progress' && typeof status.progress === 'number') {
                        this.progressTracker?.updateProgress(status.progress / 100);
                    }
                    this.mainWindow?.webContents.send('receive-file-transfer-status', status);
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
                this.fileClient.setProgressCallback((status: ClientTransferStatus) => {
                    if (status.type === 'transfer-close' || status.type === 'transfer-error') {
                        this.progressTracker?.completeProgress({ mode: 'error' });
                        if (this.fileClient) {
                            this.fileClient = null;
                        }
                    }
                    if (status.type === 'transfer-complete') {
                        this.progressTracker?.completeProgress();
                    }
                    if (status.type === 'transfer-progress' && typeof status.progress === 'number') {
                        this.progressTracker?.updateProgress(status.progress / 100);
                    }
                    this.mainWindow?.webContents.send('send-file-transfer-status', status);
                });
                await this.fileClient.connect();
                return { success: true, message: `Connected to file server at ${url}` };
            } catch (error: any) {
                // 确保在连接失败时清理 fileClient 实例
                if (this.fileClient) {
                    try {
                        this.fileClient.disconnect();
                    } catch (disconnectError) {
                        // 忽略断开连接时的错误
                    }
                    this.fileClient = null;
                }
                return { success: false, message: error.message || 'Failed to connect to file server' };
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
                // 即使出现错误也确保清理 fileClient
                this.fileClient = null;
                return { success: false, message: error.message || 'Error disconnecting from file server' };
            }
        });

        // 文件发送
        ipcMain.handle('send-file', async (_, files: { filePath: string; fileId: string }[]) => {
            try {
                if (!this.fileClient) {
                    return { success: false, message: 'File client is not connected' };
                }

                // 检查 WebSocket 连接状态
                // 注意：这里需要访问 FileTransferClient 的私有属性，所以我们使用类型断言
                const clientWs = (this.fileClient as any).ws;
                if (!clientWs || clientWs.readyState !== WebSocket.OPEN) {
                    // 清理无效的客户端连接
                    if (this.fileClient) {
                        try {
                            this.fileClient.disconnect();
                        } catch (disconnectError) {
                            // 忽略断开连接时的错误
                        }
                        this.fileClient = null;
                    }
                    return { success: false, message: 'File client connection is not open' };
                }




                await this.fileClient.sendFile(files);
            } catch (error: any) {
                // 确保在发送失败时清理 fileClient
                if (this.fileClient) {
                    try {
                        this.fileClient.disconnect();
                    } catch (disconnectError) {
                        // 忽略断开连接时的错误
                    }
                    this.fileClient = null;
                }

                this.mainWindow?.webContents.send('send-file-transfer-error', {
                    message: error.message || 'Error sending file'
                });
                return { success: false, message: error.message || 'Error sending file' };
            }
        });

        // 暂停文件传输（从发送端发起）
        ipcMain.handle('pause-file-transfer', async (_, filename: string) => {
            try {
                if (!this.fileClient) {
                    return { success: false, message: 'File client is not connected' };
                }

                // 检查 WebSocket 连接状态
                const clientWs = (this.fileClient as any).ws;
                if (!clientWs || clientWs.readyState !== WebSocket.OPEN) {
                    return { success: false, message: 'File client connection is not open' };
                }

                // 调用客户端的暂停方法
                this.fileClient.pauseTransfer(filename);

                this.mainWindow?.webContents.send('send-file-transfer-status', {
                    type: 'transfer-pause',
                    filename: filename,
                    message: 'File transfer paused'
                });

                return { success: true, message: 'File transfer paused' };
            } catch (error: any) {
                return { success: false, message: error.message || 'Error pausing file transfer' };
            }
        });

        // 恢复文件传输（从发送端发起）
        ipcMain.handle('resume-file-transfer', async (_, filename: string) => {
            try {
                if (!this.fileClient) {
                    return { success: false, message: 'File client is not connected' };
                }

                // 检查 WebSocket 连接状态
                const clientWs = (this.fileClient as any).ws;
                if (!clientWs || clientWs.readyState !== WebSocket.OPEN) {
                    return { success: false, message: 'File client connection is not open' };
                }

                // 调用客户端的恢复方法
                this.fileClient.resumeTransfer(filename);

                this.mainWindow?.webContents.send('send-file-transfer-status', {
                    type: 'transfer-resume',
                    filename: filename,
                    message: 'File transfer resumed'
                });



                return { success: true, message: 'File transfer resumed' };
            } catch (error: any) {
                return { success: false, message: error.message || 'Error resuming file transfer' };
            }
        });

        // 取消文件传输（从发送端发起）
        ipcMain.handle('cancel-file-transfer', async (_, filename: string) => {
            try {
                if (!this.fileClient) {
                    return { success: false, message: 'File client is not connected' };
                }

                // 检查 WebSocket 连接状态
                const clientWs = (this.fileClient as any).ws;
                if (!clientWs || clientWs.readyState !== WebSocket.OPEN) {
                    return { success: false, message: 'File client connection is not open' };
                }

                // 调用客户端的取消方法
                this.fileClient.cancelTransfer(filename);

                this.mainWindow?.webContents.send('send-file-transfer-status', {
                    type: 'transfer-cancel',
                    filename: filename,
                    message: 'File transfer cancelled'
                });



                return { success: true, message: 'File transfer cancelled' };
            } catch (error: any) {
                return { success: false, message: error.message || 'Error cancelling file transfer' };
            }
        });

        // 暂停文件传输（从接收端发起）
        ipcMain.handle('pause-file-transfer-from-server', async (_, clientId: string, filename: string) => {
            try {
                if (!this.fileServer) {
                    return { success: false, message: 'File server is not running' };
                }

                // 让服务器向客户端发送暂停消息
                this.fileServer.sendPauseToClient(clientId, filename);


                return { success: true, message: 'Pause request sent to client' };
            } catch (error: any) {
                return { success: false, message: error.message || 'Error sending pause request to client' };
            }
        });

        // 恢复文件传输（从接收端发起）
        ipcMain.handle('resume-file-transfer-from-server', async (_, clientId: string, filename: string) => {
            try {
                if (!this.fileServer) {
                    return { success: false, message: 'File server is not running' };
                }

                // 让服务器向客户端发送恢复消息
                this.fileServer.sendResumeToClient(clientId, filename);



                return { success: true, message: 'Resume request sent to client' };
            } catch (error: any) {
                return { success: false, message: error.message || 'Error sending resume request to client' };
            }
        });

        // 取消文件传输（从接收端发起）
        ipcMain.handle('cancel-file-transfer-from-server', async (_, clientId: string, filename: string) => {
            try {
                if (!this.fileServer) {
                    return { success: false, message: 'File server is not running' };
                }

                // 让服务器向客户端发送取消消息
                this.fileServer.sendCancelToClient(clientId, filename);



                return { success: true, message: 'Cancel request sent to client' };
            } catch (error: any) {
                return { success: false, message: error.message || 'Error sending cancel request to client' };
            }
        });


        ipcMain.on('set-theme', (_, theme: 'dark' | 'light') => {
            nativeTheme.themeSource = theme;
        })

        ipcMain.handle('get-settings', async () => {
            try {
                return settings.settingData;;
            } catch (error: any) {
                return null;
            }
        });

        ipcMain.handle('get-default-settings', async () => {
            try {
                return settings.getdefaultSettings();
            } catch (error: any) {
                return null;
            }
        });

        ipcMain.handle('save-settings', async (_, newSettings) => {
            try {
                if (settings.settingData.language !== newSettings.language) {
                    i18n.setLocale(newSettings.language);
                    this.systemTray?.changelang();
                }
                settings.setSettingsSync(newSettings);
                return { success: true, message: 'Settings saved successfully' };
            } catch (error: any) {
                return { success: false, message: error.message || 'Error saving settings' };
            }
        });

        ipcMain.on('open-dev-tools', () => {
            this.mainWindow?.webContents.openDevTools({ mode: 'undocked' });
        })

        ipcMain.on('open-file-explorer', (_, path: string) => {
            if (existsSync(path)) {
                shell.showItemInFolder(path);
            }
        })

        ipcMain.handle('choose-directory', async (_, title: string) => {

            const result = await dialog.showOpenDialog(this.mainWindow!, {
                title,
                defaultPath: settings.settingData.defaultDownloadPath || app.getPath('downloads'),
                properties: ['openDirectory', 'createDirectory'],
            });

            if (!result.canceled && result.filePaths.length > 0) {
                return result.filePaths[0];
            }
            return null;

        });

    }

    private createmainWindow() {
        this.mainWindow = new BrowserWindow({
            minHeight: 640,
            minWidth: 800,
            width: 1000,
            height: 800,
            title: i18n.t('title'),
            icon: nativeImage.createFromPath(join(__dirname, 'icon.png')),
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
            this.fileServer?.close();
            this.fileClient?.disconnect();
            this.systemTray?.destroy();
        })
        Menu.setApplicationMenu(null);
        this.systemTray = new SystemTray(this.mainWindow);
        this.progressTracker = new ProgressTracker(this.mainWindow);

        // 根据命令行参数加载不同的URL或文件
        if (process.argv[2]) {
            this.mainWindow.loadURL(process.argv[2]);
        } else {
            this.mainWindow.loadFile(join(__dirname, 'index.html'));
        }
    }
}

app.whenReady().then(() => {
    new Application();
})