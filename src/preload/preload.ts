import { contextBridge, ipcRenderer } from 'electron';


contextBridge.exposeInMainWorld('electronAPI', {
  // TCP 服务器控制
  startServer: (port: number) => ipcRenderer.invoke('start-server', port),
  stopServer: () => ipcRenderer.invoke('stop-server'),
  
  // TCP 客户端控制
  connectClient: (host: string, port: number) => ipcRenderer.invoke('connect-client', host, port),
  disconnectClient: () => ipcRenderer.invoke('disconnect-client'),
  
  // 发送消息
  sendMessage: (message: string) => ipcRenderer.invoke('send-message', message),
  
  // 监听事件
  onTcpStatus: (callback: (data: any) => void) => 
    ipcRenderer.on('tcp-status', (_, data) => callback(data)),
  
  onTcpMessage: (callback: (data: any) => void) => 
    ipcRenderer.on('tcp-message', (_, data) => callback(data)),
  
  onTcpError: (callback: (data: any) => void) => 
    ipcRenderer.on('tcp-error', (_, data) => callback(data)),
  
  // 移除监听器
  removeAllListeners: (channel: string) => ipcRenderer.removeAllListeners(channel)
});