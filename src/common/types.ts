export type ServerTransferStatus = {
    type: 'transfer-start',
    clientId: string;
    filename: string;
    filesize: number;
    message:string;
} | {
    type: 'transfer-progress',
    clientId: string;
    filename: string;
    progress: number;
    message:string;
    receiveRate: number; // 接收速率 (bytes/second)
} | {
    type: 'transfer-complete',
    clientId: string;
    filename: string;
    message:string;
} | {
    type: 'transfer-error',
    clientId: string;
    filename: string;
    message: string;
} | {
    type: 'transfer-pause',
    clientId: string;
    filename: string;
    message: string;
} | {
    type: 'transfer-resume',
    clientId: string;
    filename: string;
    message: string;
} | {
    type: 'transfer-cancel',
    clientId: string;
    filename: string;
    message: string;
}

export type ClientTransferStatus = {
    type: 'transfer-start',
    message: string;
} | {
    type: 'transfer-progress',
    message: string;
    progress: number;
    transferRate?: number;
} | {
    type: 'transfer-complete',
    message: string;
} | {
    type: 'transfer-error',
    message: string;
} | {
    type: 'transfer-pause',
    filename: string;
    message: string;
} | {
    type: 'transfer-resume',
    filename: string;
    message: string;
} | {
    type: 'transfer-cancel',
    filename: string;
    message: string;
}




export interface AppSettings {
    overwriteExistingFiles: boolean;
    defaultServerPort: number;
    defaultDownloadPath: string;
    enableNotifications: boolean;
}