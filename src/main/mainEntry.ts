// src\main\mainEntry.ts



// src/main.ts
import { app, BrowserWindow, ipcMain } from 'electron';
import { Server, Socket, createServer } from 'net';
import { join } from 'path';

class TCPSignalingServer {
    private server: Server | null = null;
    private clients: Map<string, Socket> = new Map();
    private mainWindow: BrowserWindow | null = null;

    constructor(mainWindow: BrowserWindow) {
        this.mainWindow = mainWindow;
    }

    startServer(port: number = 8080) {
        this.server = createServer((socket: Socket) => {
            const clientId = `${socket.remoteAddress}:${socket.remotePort}`;
            console.log(`Client connected: ${clientId}`);

            this.clients.set(clientId, socket);

            socket.on('data', (data) => {
                const message = data.toString();
                console.log(`Received from ${clientId}:`, message);

                // 转发到渲染进程
                this.mainWindow?.webContents.send('tcp-message', {
                    type: 'message',
                    from: clientId,
                    data: message
                });

                // 广播给其他客户端
                this.broadcast(message, clientId);
            });

            socket.on('close', () => {
                console.log(`Client disconnected: ${clientId}`);
                this.clients.delete(clientId);
                this.mainWindow?.webContents.send('tcp-message', {
                    type: 'client-disconnected',
                    from: clientId
                });
            });

            socket.on('error', (err) => {
                console.error(`Socket error for ${clientId}:`, err);
            });

        });

        this.server.listen(port, () => {
            console.log(`TCP signaling server listening on port ${port}`);
            this.mainWindow?.webContents.send('tcp-status', {
                type: 'server-started',
                port
            });
        });

        this.server.on('error', (err) => {
            console.error('Server error:', err);
            this.mainWindow?.webContents.send('tcp-error', {
                type: 'server-error',
                error: err.message
            });
        });
    }

    private broadcast(message: string, excludeClientId: string) {
        for (const [clientId, socket] of this.clients) {
            if (clientId !== excludeClientId && socket.writable) {
                socket.write(message);
            }
        }
    }

    sendToClient(clientId: string, message: string) {
        const socket = this.clients.get(clientId);
        if (socket && socket.writable) {
            socket.write(message);
            return true;
        }
        return false;
    }

    stopServer() {
        if (this.server) {
            this.server.close();
            this.server = null;
            this.clients.clear();
        }
    }
}

class TCPClient {
    private client: Socket | null = null;
    private mainWindow: BrowserWindow | null = null;
    private isConnected: boolean = false;

    constructor(mainWindow: BrowserWindow) {
        this.mainWindow = mainWindow;
    }

    connect(host: string, port: number) {
        this.client = new Socket();

        this.client.connect(port, host, () => {
            console.log(`Connected to server ${host}:${port}`);
            this.isConnected = true;
            this.mainWindow?.webContents.send('tcp-status', {
                type: 'client-connected',
                host,
                port
            });
        });

        this.client.on('data', (data) => {
            const message = data.toString();
            console.log('Received from server:', message);

            this.mainWindow?.webContents.send('tcp-message', {
                type: 'message',
                from: 'server',
                data: message
            });
        });

        this.client.on('close', () => {
            console.log('Connection closed');
            this.isConnected = false;
            this.mainWindow?.webContents.send('tcp-status', {
                type: 'client-disconnected'
            });
        });

        this.client.on('error', (err) => {
            console.error('Client error:', err);
            this.mainWindow?.webContents.send('tcp-error', {
                type: 'client-error',
                error: err.message
            });
        });
    }

    send(message: string) {
        if (this.client && this.isConnected) {
            this.client.write(message);
            return true;
        }
        return false;
    }

    disconnect() {
        if (this.client) {
            this.client.destroy();
            this.client = null;
            this.isConnected = false;
        }
    }
}

class MainProcess {
    private mainWindow: BrowserWindow | null = null;
    private tcpServer: TCPSignalingServer | null = null;
    private tcpClient: TCPClient | null = null;
    private mode: 'server' | 'client' | null = null;

    constructor() {
        this.createWindow();
        this.setupIPC();
    }

    private createWindow() {
        this.mainWindow = new BrowserWindow({
            minHeight: 1000,
            minWidth: 1250,
            width: 1450,
            height: 1200,
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
        this.mainWindow.webContents.openDevTools({ mode: "undocked" });
        this.mainWindow.loadURL(process.argv[2] as string);
    }

    private setupIPC() {
        // TCP 服务器控制
        ipcMain.handle('start-server', async (_, port: number) => {
            this.mode = 'server';
            this.tcpServer = new TCPSignalingServer(this.mainWindow!);
            this.tcpServer.startServer(port);
            return { success: true };
        });

        ipcMain.handle('stop-server', async () => {
            if (this.tcpServer) {
                this.tcpServer.stopServer();
                this.tcpServer = null;
            }
            return { success: true };
        });

        // TCP 客户端控制
        ipcMain.handle('connect-client', async (_, host: string, port: number) => {
            this.mode = 'client';
            this.tcpClient = new TCPClient(this.mainWindow!);
            this.tcpClient.connect(host, port);
            return { success: true };
        });

        ipcMain.handle('disconnect-client', async () => {
            if (this.tcpClient) {
                this.tcpClient.disconnect();
                this.tcpClient = null;
            }
            return { success: true };
        });

        // 发送消息
        ipcMain.handle('send-message', async (_, message: string) => {
            if (this.mode === 'server' && this.tcpServer) {
                // 服务器模式广播消息
                // 这里简化处理，实际应该指定客户端
                return { success: true };
            } else if (this.mode === 'client' && this.tcpClient) {
                return { success: this.tcpClient.send(message) };
            }
            return { success: false };
        });
    }
}

// 启动应用
app.whenReady().then(() => {
    new MainProcess();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            new MainProcess();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});