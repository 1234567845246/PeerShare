import { contextBridge, ipcRenderer ,webUtils} from 'electron';
import {type ServerTransferStatus,type ClientTransferStatus} from '../common/types';

export interface ElectronAPI {
  // 文件传输服务器控制
  startFileServer: (port: number) => Promise<{ success: boolean; message: string }>;
  stopFileServer: () => Promise<{ success: boolean; message: string }>;
  
  // 文件传输客户端控制
  connectFileClient: (url: string) => Promise<{ success: boolean; message: string }>;
  disconnectFileClient: () => Promise<{ success: boolean; message: string }>;
  
  // 文件发送
  sendFile: (filePath: string) => Promise<{ success: boolean; message: string }>;
  
  // 文件传输控制（从发送端发起）
  pauseFileTransfer: (filename: string) => Promise<{ success: boolean; message: string }>;
  resumeFileTransfer: (filename: string) => Promise<{ success: boolean; message: string }>;
  cancelFileTransfer: (filename: string) => Promise<{ success: boolean; message: string }>;
  
  // 文件传输控制（从接收端发起）
  pauseFileTransferFromServer: (filename: string) => Promise<{ success: boolean; message: string }>;
  resumeFileTransferFromServer: (filename: string) => Promise<{ success: boolean; message: string }>;
  cancelFileTransferFromServer: (filename: string) => Promise<{ success: boolean; message: string }>;
  
  // 监听接受端事件
  onServerFileTransferStatus: (callback: (data: ServerTransferStatus) => void) => void;
  onServerFileTransferError: (callback: (error: { message: string }) => void) => void;
  
  // 移除接收端监听器
  removeAllServerFileTransferListeners: () => void;

  //监听发送端事件
  onClientFileTransferStatus: (callback: (data: ClientTransferStatus) => void) => void;
  onClientFileTransferError: (callback: (error: { message: string }) => void) => void;

  // 移除发送端监听器
  removeAllClientFileTransferListeners: () => void;

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
  
  // 文件传输控制（从发送端发起）
  pauseFileTransfer: (filename: string) => ipcRenderer.invoke('pause-file-transfer', filename),
  resumeFileTransfer: (filename: string) => ipcRenderer.invoke('resume-file-transfer', filename),
  cancelFileTransfer: (filename: string) => ipcRenderer.invoke('cancel-file-transfer', filename),
  
  // 文件传输控制（从接收端发起）
  pauseFileTransferFromServer: (filename: string) => ipcRenderer.invoke('pause-file-transfer-from-server', filename),
  resumeFileTransferFromServer: (filename: string) => ipcRenderer.invoke('resume-file-transfer-from-server', filename),
  cancelFileTransferFromServer: (filename: string) => ipcRenderer.invoke('cancel-file-transfer-from-server', filename),
  
  // 监听接收端事件
  onServerFileTransferStatus: (callback) => ipcRenderer.on('receive-file-transfer-status', (_, data) => callback(data)),
  onServerFileTransferError: (callback) => ipcRenderer.on('receive-file-transfer-error', (_, error) => callback(error)),
  
  // 移除接收端监听器
  removeAllServerFileTransferListeners: () => {
    ipcRenderer.removeAllListeners('receive-file-transfer-status');
    ipcRenderer.removeAllListeners('receive-file-transfer-error');
  },
  
  onClientFileTransferStatus: (callback) => ipcRenderer.on('send-file-transfer-status', (_, data) => callback(data)),
  onClientFileTransferError: (callback) => ipcRenderer.on('send-file-transfer-error', (_, error) => callback(error)),
  removeAllClientFileTransferListeners: () => {
    ipcRenderer.removeAllListeners('send-file-transfer-status');
    ipcRenderer.removeAllListeners('send-file-transfer-error');
  },
  

   getPathForFile: (file: File) => webUtils.getPathForFile(file).replace(/\\/g, "/"),

   setTheme: (theme: 'dark' | 'light') => ipcRenderer.send('set-theme', theme),
   openDevTools: () => ipcRenderer.send('open-dev-tools'),
} as ElectronAPI);