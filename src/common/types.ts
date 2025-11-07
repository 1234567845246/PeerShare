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
}