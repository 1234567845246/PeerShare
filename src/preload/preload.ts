import { contextBridge, ipcRenderer ,webUtils} from 'electron';

export interface ElectronAPI {
  // 文件传输服务器控制
  startFileServer: (port: number) => Promise<{ success: boolean; message: string }>;
  stopFileServer: () => Promise<{ success: boolean; message: string }>;
  
  // 文件传输客户端控制
  connectFileClient: (url: string) => Promise<{ success: boolean; message: string }>;
  disconnectFileClient: () => Promise<{ success: boolean; message: string }>;
  
  // 文件发送
  sendFile: (filePath: string) => Promise<{ success: boolean; message: string }>;
  
  // 监听事件
  onFileTransferStatus: (callback: (data: { 
    type: "transfer-progress" | "transfer-start" | "transfer-complete" | "transfer-error"; 
    message: string; 
    progress?: number;
    filename?: string;
    filesize?: number;
    clientId?: string;
  }) => void) => void;
  onFileTransferError: (callback: (error: { message: string }) => void) => void;
  
  // 移除监听器
  removeAllFileTransferListeners: () => void;

  getPathForFile: (file: File) => string;

  setTheme: (theme: 'dark' | 'light') => void;

  openDevTools: () => void;
}

contextBridge.exposeInMainWorld('electronAPI', {
  // 文件传输服务器控制
  startFileServer: (port: number) => ipcRenderer.invoke('start-file-server', port),
  stopFileServer: () => ipcRenderer.invoke('stop-file-server'),
  
  // 文件传输客户端控制
  connectFileClient: (url: string) => ipcRenderer.invoke('connect-file-client', url),
  disconnectFileClient: () => ipcRenderer.invoke('disconnect-file-client'),
  
  // 文件发送
  sendFile: (filePath: string) => ipcRenderer.invoke('send-file', filePath),
  
  // 监听事件
  onFileTransferStatus: (callback) => ipcRenderer.on('file-transfer-status', (_, data) => callback(data)),
  onFileTransferError: (callback) => ipcRenderer.on('file-transfer-error', (_, error) => callback(error)),
  
  // 移除监听器
  removeAllFileTransferListeners: () => {
    ipcRenderer.removeAllListeners('file-transfer-status');
    ipcRenderer.removeAllListeners('file-transfer-error');
  },

   getPathForFile: (file: File) => webUtils.getPathForFile(file).replace(/\\/g, "/"),

   setTheme: (theme: 'dark' | 'light') => ipcRenderer.send('set-theme', theme),
   openDevTools: () => ipcRenderer.send('open-dev-tools'),
} as ElectronAPI);