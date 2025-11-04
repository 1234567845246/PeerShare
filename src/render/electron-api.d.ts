
interface ElectronAPI {
  startServer: (port: number) => Promise<{ success: boolean }>;
  stopServer: () => Promise<{ success: boolean }>;
  connectClient: (host: string, port: number) => Promise<{ success: boolean }>;
  disconnectClient: () => Promise<{ success: boolean }>;
  sendMessage: (message: string) => Promise<{ success: boolean }>;
  onTcpStatus: (callback: (data: any) => void) => void;
  onTcpMessage: (callback: (data: any) => void) => void;
  onTcpError: (callback: (data: any) => void) => void;
  removeAllListeners: (channel: string) => void;
}


declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

