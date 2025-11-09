// src\main\mainEntry.ts
import { app, BrowserWindow, ipcMain, Menu, nativeImage, nativeTheme } from 'electron'
import { join } from 'path'
import { FileTransferServer, FileTransferClient } from './fileTransferServer'
import { type ServerTransferStatus } from '../common/types'
import { formatRate } from '../common/tools';

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
        ipcMain.handle('send-file', async (_, filePath: string) => {
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
                
                // 发送状态更新到渲染进程
                this.mainWindow?.webContents.send('send-file-transfer-status', {
                    type: 'transfer-start',
                    message: `Starting to send file: ${filePath}`
                });
                
                // 设置进度回调函数
                this.fileClient.setProgressCallback((progress: number) => {
                    // 计算传输速率
                    const transferRate = this.fileClient ? (this.fileClient as any).transferRate || 0 : 0;
                    
                    this.mainWindow?.webContents.send('send-file-transfer-status', {
                        type: 'transfer-progress',
                        message: `Transfer progress: ${progress}%` + (transferRate > 0 ? ` ${formatRate(transferRate)}` : ''),
                        progress: progress,
                        transferRate: transferRate
                    });
                });
                
                await this.fileClient.sendFile(filePath);
                
                this.mainWindow?.webContents.send('send-file-transfer-status', {
                    type: 'transfer-complete',
                    message: 'File transfer completed successfully'
                });
                
                return { success: true, message: 'File sent successfully' };
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
        ipcMain.handle('pause-file-transfer-from-server', async (_, filename: string) => {
            try {
                if (!this.fileServer) {
                    return { success: false, message: 'File server is not running' };
                }
                
                // 让服务器向客户端发送暂停消息
                this.fileServer.sendPauseToClient(filename);
                
                return { success: true, message: 'Pause request sent to client' };
            } catch (error: any) {
                return { success: false, message: error.message || 'Error sending pause request to client' };
            }
        });

        // 恢复文件传输（从接收端发起）
        ipcMain.handle('resume-file-transfer-from-server', async (_, filename: string) => {
            try {
                if (!this.fileServer) {
                    return { success: false, message: 'File server is not running' };
                }
                
                // 让服务器向客户端发送恢复消息
                this.fileServer.sendResumeToClient(filename);
                
                return { success: true, message: 'Resume request sent to client' };
            } catch (error: any) {
                return { success: false, message: error.message || 'Error sending resume request to client' };
            }
        });

        // 取消文件传输（从接收端发起）
        ipcMain.handle('cancel-file-transfer-from-server', async (_, filename: string) => {
            try {
                if (!this.fileServer) {
                    return { success: false, message: 'File server is not running' };
                }
                
                // 让服务器向客户端发送取消消息
                this.fileServer.sendCancelToClient(filename);
                
                return { success: true, message: 'Cancel request sent to client' };
            } catch (error: any) {
                return { success: false, message: error.message || 'Error sending cancel request to client' };
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