import WebSocket, { WebSocketServer } from 'ws';
import { createReadStream, statSync, createWriteStream, WriteStream, ReadStream, existsSync, mkdirSync, readdirSync, lstatSync } from 'fs';
import { join, basename, parse, dirname, relative } from 'path';
import { type ClientTransferStatus, type ServerTransferStatus } from '../common/types';
import { MessageCodec, MessageType, type FileStartMessage, type FileStartAckMessage, type FileChunkMessage, type FileChunkAckMessage, type FileEndMessage, type FilePauseMessage, type FilePauseAckMessage, type FileResumeMessage, type FileResumeAckMessage, type FileCancelMessage, type FileCancelAckMessage, type FileControlMessage, type FileMessage, type FolderStartMessage, type FolderStartAckMessage, type FolderEndMessage, type FolderEndAckMessage } from '../common/MessageCodec';
import { randomUUID } from 'crypto';
import type { IncomingMessage } from 'http';
import { settings } from './settings';


// 文件传输状态枚举
enum FileTransferStatus {
    Pending = 'pending',      // 未传送
    InProgress = 'inprogress', // 正在传送
    Completed = 'completed'    // 已传送
}

// 文件队列项接口
interface QueuedFile {
    filePath: string;
    fileId: string;
    type: 'file' | 'directory';
    status: FileTransferStatus;
    folderId?: string; // 所属文件夹ID，若存在则表示此项属于文件夹传输
    folderRootPath?: string; // 文件夹根路径
    relativePath?: string; // 相对于文件夹根目录的相对路径
}

function generateClientId(): string {
    return randomUUID();
}


interface FileInfos {
    filename: string;
    filepath: string;
    fileSize: number;
    fileId: string;
    receivedChunks: number;
    bytesReceived: number;
    startTime: number; // 添加开始时间戳
    lastUpdateTime: number; // 添加上次更新时间戳
    receiveRate: number; // 添加接收速率
    isPaused: boolean; // 添加暂停状态
    lastChunkIndex: number; // 添加最后一个块索引，用于恢复传输
    folderId?: string; // 所属文件夹ID
    relativePath?: string; // 相对于文件夹根目录的相对路径
}

// 文件夹传输状态跟踪接口
interface FolderTransferStatus {
    folderId: string;
    folderName: string;
    totalFiles: number;
    receivedFiles: number;
    totalSize: number;
    receivedSize: number;
    startTime: number;
}


/* 消息协议由 MessageCodec 处理 */

export class FileTransferServer  {
    private wss: WebSocketServer;
    private port: number;
    private clients: Set<WebSocket>;
    private clientIds: Map<WebSocket, string>; // 存储每个连接的客户端ID
    private fileStreams: Map<WebSocket, WriteStream>; // 存储每个连接的文件写入流
    private fileInfos: Map<WebSocket, FileInfos>; // 存储每个连接的文件信息
    private folderStatus: Map<string, FolderTransferStatus>; // 文件夹传输状态跟踪
    private onProgressCallbacks: (status: ServerTransferStatus) => void; // 服务器连接的进度回调函数

    constructor(port: number = settings.settingData.defaultServerPort || 8080) {
        this.port = port;
        this.clients = new Set();
        this.clientIds = new Map();
        this.fileStreams = new Map();
        this.fileInfos = new Map();
        this.folderStatus = new Map();
        this.onProgressCallbacks = () => { };
        this.wss = new WebSocketServer({ port: this.port, perMessageDeflate: false, maxPayload: 100 * 1024 * 1024 });
        this.setupListeners();
    }

    // 设置进度回调函数
    public onProgress(callback: (status: ServerTransferStatus) => void) {
        this.onProgressCallbacks = callback;
    }



    private setupListeners() {
        this.wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
            console.log('New client connected', req.socket.remoteAddress, req.socket.remotePort);
            this.clients.add(ws);
            this.clientIds.set(ws, generateClientId());
            ws.on('message', (data: WebSocket.Data) => {
                this.handleMessage(ws, data);
            });

            ws.on('close', () => {
                console.log('Client disconnected');
                // 清理资源
                const fileInfo = this.fileInfos.get(ws);
                if (fileInfo) {
                    this.onProgressCallbacks({
                        type: 'transfer-close',
                        clientId: this.clientIds.get(ws) || 'unknown',
                        fileId: fileInfo.fileId,
                        message: '已断开连接',
                    })
                }
                this.cleanupClientResources(ws);
            });

            ws.on('error', (error) => {
                console.error('WebSocket error:', error);
                // 发送错误信息给客户端
                this.onProgressCallbacks({
                    type: 'transfer-error',
                    message: `连接错误: ${error.message || '未知错误'}`,
                    clientId: this.clientIds.get(ws) || 'unknown',
                    fileId: ''
                });
                // 清理资源
                this.cleanupClientResources(ws);
            });
        });

        this.wss.on('listening', () => {
            console.log(`File transfer server listening on port ${this.port}`);
        });

        this.wss.on('error', (error) => {
            console.error('File transfer server error:', error);
        });
    }

    private cleanupClientResources(ws: WebSocket) {
        console.log('Cleaning up resources for client');

        // 关闭并清理该客户端的文件流
        const writeStream = this.fileStreams.get(ws);
        if (writeStream) {
            try {
                writeStream.end();
                console.log('File stream closed successfully');
            } catch (err) {
                console.error('Error closing file stream:', err);
            }
            this.fileStreams.delete(ws);
        }

        // 删除该客户端的文件信息
        this.fileInfos.delete(ws);

        this.clientIds.delete(ws);

        this.clients.delete(ws);

        // 移除进度回调函数
        this.onProgressCallbacks = () => { };

        console.log('Client resources cleaned up');
    }

    private handleMessage(ws: WebSocket, data: WebSocket.Data) {
        if (!Buffer.isBuffer(data)) {
            console.error('Received non-buffer data');
            return;
        }

        try {
            const message = MessageCodec.decodeMessage(data);
            this.processMessage(ws, message);
        } catch (e) {
            console.error('Failed to decode message:', e);
        }
    }

    private encodeMessage(message: any): Buffer {
        return MessageCodec.encodeMessage(message);
    }

    private processMessage(ws: WebSocket, message: FileMessage) {
        switch (message.type) {
            case MessageType.FILE_START:
                this.handleFileStart(ws, message as FileStartMessage);
                break;
            case MessageType.FILE_CHUNK:
                this.handleFileChunk(ws, message as FileChunkMessage);
                break;
            case MessageType.FILE_END:
                this.handleFileEnd(ws, message as FileEndMessage);
                break;
            case MessageType.FILE_PAUSE:
                this.handleFilePause(ws, message as FilePauseMessage);
                break;
            case MessageType.FILE_RESUME:
                this.handleFileResume(ws, message as FileResumeMessage);
                break;
            case MessageType.FILE_CANCEL:
                this.handleFileCancel(ws, message as FileCancelMessage);
                break;
            default:
                console.log('Unknown message type:', message.type);
        }
    }

    private handleFileStart(ws: WebSocket, message: FileStartMessage) {
        console.log(`Starting to receive file: ${message.filename} (${message.fileSize} bytes)`);

        // 创建文件写入流
        // 如果存在相对路径，则使用相对路径；否则使用文件名
        let filePath: string;
        if (message.relativePath) {
            // 文件夹传输的情况
            filePath = join(settings.settingData.defaultDownloadPath || __dirname, message.relativePath);
        } else {
            // 单个文件传输的情况
            filePath = join(settings.settingData.defaultDownloadPath || __dirname, message.filename);
        }

        // 创建文件夹结构
        try {
            const fileDir = dirname(filePath);
            if (!existsSync(fileDir)) {
                mkdirSync(fileDir, { recursive: true });
                console.log(`Created directory: ${fileDir}`);
            }
        } catch (err) {
            console.error('Failed to create directory:', err);
            this.onProgressCallbacks({
                type: 'transfer-error',
                message: `创建文件夹失败: ${(err as any).message || '未知错误'}`,
                clientId: this.clientIds.get(ws) || 'unknown',
                fileId: message.fileId
            });
            return;
        }

        // 处理文件覆盖问题
        if (!settings.settingData.overwriteExistingFiles) {
            let uniqueFilePath = filePath;
            let count = 1;
            while (existsSync(uniqueFilePath)) {
                const parsedPath = parse(filePath);
                uniqueFilePath = join(parsedPath.dir, `${parsedPath.name}(${count})${parsedPath.ext}`);
                count++;
            }
            if (uniqueFilePath !== filePath) {
                console.log(`File exists. Saving as: ${uniqueFilePath}`);
                filePath = uniqueFilePath;
            }
        }

        const writeStream = createWriteStream(filePath);

        this.fileStreams.set(ws, writeStream);
        this.fileInfos.set(ws, {
            filename: message.filename,
            filepath: filePath,
            fileSize: message.fileSize,
            fileId: message.fileId,
            receivedChunks: 0,
            bytesReceived: 0,
            startTime: Date.now(),
            lastUpdateTime: Date.now(),
            receiveRate: 0,
            isPaused: false,
            lastChunkIndex: -1,
            relativePath: message.relativePath
        });

        console.log(`File stream created for ${message.filename}`);
        // 发送确认消息
        const ackMessage: FileStartAckMessage = { type: MessageType.FILE_START_ACK };
        this.onProgressCallbacks({ type: 'transfer-start', clientId: this.clientIds.get(ws) || 'unknown', fileId: message.fileId, filename: message.filename, filepath: filePath, filesize: message.fileSize, message: '' });
        ws.send(this.encodeMessage(ackMessage));
    }

    private handleFileChunk(ws: WebSocket, message: FileChunkMessage) {
        // 根据连接标识找到对应的文件流
        const writeStream = this.fileStreams.get(ws);
        if (!writeStream) {
            console.error('File stream not found for this connection');
            return;
        }

        // 获取文件信息
        const fileInfo = this.fileInfos.get(ws);
        if (!fileInfo) {
            console.error('File info not found for this connection');
            return;
        }

        // 检查是否暂停：即使处于 paused 状态，也处理当前到达的分片并发送 ACK（不要直接丢弃）
        if (fileInfo.isPaused) {
            console.log(`File transfer is paused for ${fileInfo.filename}, writing arrived chunk ${message.chunkIndex} and will ACK`);
        }

        // 检查 WebSocket 连接状态
        if (ws.readyState !== WebSocket.OPEN) {
            console.log('WebSocket connection is not open, skipping chunk processing');
            return;
        }

        // 写入文件块数据
        writeStream.write(message.chunkData, (err: any) => {
            // 检查 WebSocket 连接状态
            if (ws.readyState !== WebSocket.OPEN) {
                console.log('WebSocket connection is not open, skipping ACK');
                return;
            }

            if (err) {
                console.error('Failed to write file chunk:', err);
                // 发送错误信息给客户端
                this.onProgressCallbacks({
                    type: 'transfer-error',
                    message: `写入文件块失败: ${err.message || '未知错误'}`,
                    clientId: this.clientIds.get(ws) || 'unknown',
                    fileId: fileInfo.fileId
                });
            } else {
                console.log(`Written chunk ${message.chunkIndex} (${message.chunkData.length} bytes) to file`);

                // 发送确认消息
                const ackMessage: FileChunkAckMessage = {
                    type: MessageType.FILE_CHUNK_ACK,
                    ackIndex: message.chunkIndex
                };
                ws.send(this.encodeMessage(ackMessage));

                // 更新接收块计数和字节数
                fileInfo.receivedChunks++;
                fileInfo.bytesReceived += message.chunkData.length;
                fileInfo.lastUpdateTime = Date.now();
                fileInfo.lastChunkIndex = message.chunkIndex; // 记录最后一个块索引
                this.fileInfos.set(ws, fileInfo);

                // 计算接收速率 (bytes/second)
                const elapsedTime = (fileInfo.lastUpdateTime - fileInfo.startTime) / 1000; // 转换为秒
                fileInfo.receiveRate = elapsedTime > 0 ? Math.floor(fileInfo.bytesReceived / elapsedTime) : 0;

                // 计算并报告进度
                const progress = Math.min(100, Math.floor((fileInfo.bytesReceived / fileInfo.fileSize) * 100));

                // 调用客户端进度回调函数
                if (!fileInfo.isPaused) {
                    this.onProgressCallbacks({
                        type: 'transfer-progress',
                        clientId: this.clientIds.get(ws) || 'unknown',
                        fileId: fileInfo.fileId,
                        progress,
                        message: '',
                        receiveRate: fileInfo.receiveRate // 添加接收速率
                    });
                }
            }
        });
    }

    private handleFileEnd(ws: WebSocket, _: FileEndMessage) {
        // 获取并关闭文件流
        const writeStream = this.fileStreams.get(ws);
        if (writeStream) {
            writeStream.end(() => {
                console.log('File transfer completed');
                const fileInfo = this.fileInfos.get(ws);
                if (fileInfo) {
                    console.log(`File ${fileInfo.filename} saved successfully with ${fileInfo.receivedChunks} chunks`);

                    // 发送100%进度完成
                    this.onProgressCallbacks(
                        { type: 'transfer-complete', clientId: this.clientIds.get(ws) || 'unknown', fileId: fileInfo.fileId, message: '' }
                    );
                }
                // 删除文件信息
                this.fileInfos.delete(ws);
            });
            this.fileStreams.delete(ws);
        }
    }

    // 处理文件暂停消息
    private handleFilePause(ws: WebSocket, message: FilePauseMessage) {
        console.log(`Received pause request for file: ${message.fileId}`);

        // 获取文件信息
        const fileInfo = this.fileInfos.get(ws);
        if (!fileInfo) {
            console.error('File info not found for this connection');
            // 发送暂停确认消息（失败）
            const ackMessage: FilePauseAckMessage = {
                type: MessageType.FILE_PAUSE_ACK,
                fileId: message.fileId,
                success: false
            };
            ws.send(this.encodeMessage(ackMessage));
            return;
        }

        // 检查文件名是否匹配
        if (fileInfo.fileId !== message.fileId) {
            console.error('Filename mismatch for pause request');
            // 发送暂停确认消息（失败）
            const ackMessage: FilePauseAckMessage = {
                type: MessageType.FILE_PAUSE_ACK,
                fileId: message.fileId,
                success: false
            };
            ws.send(this.encodeMessage(ackMessage));
            return;
        }

        // 设置暂停状态
        fileInfo.isPaused = true;
        this.fileInfos.set(ws, fileInfo);

        // 发送暂停确认消息
        const ackMessage: FilePauseAckMessage = {
            type: MessageType.FILE_PAUSE_ACK,
            fileId: message.fileId,
            success: true
        };
        ws.send(this.encodeMessage(ackMessage));

        // 调用服务端进度回调函数
        this.onProgressCallbacks({
            type: 'transfer-pause',
            clientId: this.clientIds.get(ws) || 'unknown',
            fileId: fileInfo.fileId,
            message: '传输已暂停'
        });
    }


    // 处理文件恢复消息
    private handleFileResume(ws: WebSocket, message: FileResumeMessage) {
        console.log(`Received resume request for file: ${message.fileId}`);

        // 获取文件信息
        const fileInfo = this.fileInfos.get(ws);
        if (!fileInfo) {
            console.error('File info not found for this connection');
            // 发送恢复确认消息（失败）
            const ackMessage: FileResumeAckMessage = {
                type: MessageType.FILE_RESUME_ACK,
                fileId: message.fileId,
                success: false,
                lastChunkIndex: -1
            };
            ws.send(this.encodeMessage(ackMessage));
            return;
        }

        // 检查文件名是否匹配
        if (fileInfo.fileId !== message.fileId) {
            console.error('Filename mismatch for resume request');
            // 发送恢复确认消息（失败）
            const ackMessage: FileResumeAckMessage = {
                type: MessageType.FILE_RESUME_ACK,
                fileId: message.fileId,
                success: false,
                lastChunkIndex: -1
            };
            ws.send(this.encodeMessage(ackMessage));
            return;
        }

        // 取消暂停状态
        fileInfo.isPaused = false;
        this.fileInfos.set(ws, fileInfo);

        // 发送恢复确认消息，包含最后一个块索引
        const ackMessage: FileResumeAckMessage = {
            type: MessageType.FILE_RESUME_ACK,
            fileId: message.fileId,
            success: true,
            lastChunkIndex: fileInfo.lastChunkIndex
        };
        ws.send(this.encodeMessage(ackMessage));

        // 调用服务端进度回调函数
        this.onProgressCallbacks({
            type: 'transfer-resume',
            clientId: this.clientIds.get(ws) || 'unknown',
            fileId: fileInfo.fileId,
            message: '传输已恢复'

        })
    }

    // 处理文件取消消息
    private handleFileCancel(ws: WebSocket, message: FileCancelMessage) {
        console.log(`Received cancel request for file: ${message.fileId}`);

        // 获取文件信息
        const fileInfo = this.fileInfos.get(ws);
        if (!fileInfo) {
            console.error('File info not found for this connection');
            // 发送取消确认消息（失败）
            const ackMessage: FileCancelAckMessage = {
                type: MessageType.FILE_CANCEL_ACK,
                fileId: message.fileId,
                success: false
            };
            ws.send(this.encodeMessage(ackMessage));
            return;
        }

        // 检查文件名是否匹配
        if (fileInfo.fileId !== message.fileId) {
            console.error('Filename mismatch for cancel request');
            // 发送取消确认消息（失败）
            const ackMessage: FileCancelAckMessage = {
                type: MessageType.FILE_CANCEL_ACK,
                fileId: message.fileId ,
                success: false
            };
            ws.send(this.encodeMessage(ackMessage));
            return;
        }

        // 关闭并清理该客户端的文件流
        const writeStream = this.fileStreams.get(ws);
        if (writeStream) {
            writeStream.end();
            this.fileStreams.delete(ws);
        }

        // 删除该客户端的文件信息
        this.fileInfos.delete(ws);

        // 发送取消确认消息（成功）
        const ackMessage: FileCancelAckMessage = {
            type: MessageType.FILE_CANCEL_ACK,
            fileId: message.fileId,
            success: true   
        };
        ws.send(this.encodeMessage(ackMessage));

        // 调用服务端进度回调函数
        this.onProgressCallbacks({
            type: 'transfer-cancel',
            clientId: this.clientIds.get(ws) || 'unknown',
            fileId: fileInfo.fileId,
            message: '传输已取消'
        });
    }


    public sendPauseToClient(clientId: string, filename: string): void {
        this.sendControlToClient(clientId, filename, MessageType.FILE_PAUSE);
    }
    public sendResumeToClient(clientId: string, filename: string): void {
        this.sendControlToClient(clientId, filename, MessageType.FILE_RESUME);
    }
    public sendCancelToClient(clientId: string, filename: string): void {
        this.sendControlToClient(clientId, filename, MessageType.FILE_CANCEL);
    }




    // 添加发送控制消息到客户端的方法
    public sendControlToClient(clientId: string, filename: string, controlType: number): void {
        // 遍历所有客户端连接，找到对应的客户端并发送控制消息
        for (const [ws, fileInfo] of this.fileInfos.entries()) {
            if (clientId === this.clientIds.get(ws) && fileInfo.filename === filename) {
                const controlMsg: FileControlMessage = {
                    type: MessageType.FILE_CONTROL,
                    controlType: controlType,
                    fileId: fileInfo.fileId
                };
                console.log(`Sending control message ${controlType} for file ${filename} to client ${clientId}`);
                ws.send(this.encodeMessage(controlMsg));
                break;
            }
        }
    }

    public broadcast(data: string | Buffer) {
        this.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(data);
            }
        });
    }

    public close() {
        console.log('Closing file transfer server');

        // 通知所有客户端服务器即将关闭
        this.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                try {
                    client.close();
                } catch (e) {
                    console.error('Error closing client connection:', e);
                }
            }
        });

        // 清理所有资源
        this.clients.forEach(client => {
            this.cleanupClientResources(client);
        });

        // 关闭WebSocket服务器
        try {
            this.wss.close();
            console.log('WebSocket server closed');
        } catch (e) {
            console.error('Error closing WebSocket server:', e);
        }

        console.log('File transfer server closed');
    }
}

/**
 * 递归收集文件夹中的所有文件
 * @param folderPath 文件夹路径
 * @returns 文件数组，包含文件路径、相对路径等信息
 */
function collectFilesFromFolder(folderPath: string): Array<{ filePath: string; relativePath: string }> {
    const files: Array<{ filePath: string; relativePath: string }> = [];

    function traverse(currentPath: string, basePath: string) {
        try {
            const entries = readdirSync(currentPath);
            for (const entry of entries) {
                const fullPath = join(currentPath, entry);
                const stat = lstatSync(fullPath);

                if (stat.isDirectory()) {
                    // 递归遍历子文件夹
                    traverse(fullPath, basePath);
                } else if (stat.isFile()) {
                    // 计算相对路径
                    const relativePath = relative(basePath, fullPath);
                    files.push({
                        filePath: fullPath,
                        relativePath: relativePath
                    });
                }
            }
        } catch (err) {
            console.error(`Error traversing folder ${currentPath}:`, err);
        }
    }

    traverse(folderPath, folderPath);
    return files;
}

export class FileTransferClient {
    private ws: WebSocket | null = null;
    private url: string;
    private readonly chunkSize: number = 1024 * 1024; // 1MB chunks
    private readonly START_ACK_TIMEOUT = 30000;  // 30秒
    private readonly CHUNK_ACK_TIMEOUT = 5000;  // 5秒
    private pendingAcks: Set<number> = new Set(); // 等待确认的块索引
    private onProgressCallbacks: (status: ClientTransferStatus) => void;;
    private ackTimeouts: Map<number, NodeJS.Timeout> = new Map(); // 确认超时定时器
    private receivedFileStartAck: boolean = false; // 是否已收到FILE_START_ACK
    private fileStartAckResolver: ((value: void) => void) | null = null; // FILE_START_ACK的Promise resolver
    private startTime: number = 0; // 添加开始时间戳
    private lastUpdateTime: number = 0; // 添加上次更新时间戳
    private bytesSent: number = 0; // 添加已发送字节数
    public transferRate: number = 0; // 公共传输速率属性
    private isPaused: boolean = false; // 添加暂停状态
    private isCancelled: boolean = false; // 添加取消状态
    private lastChunkIndex: number = -1; // 添加最后一个块索引
    private fileStream: ReadStream | null = null; // 文件流引用
    private activeFileId: string | null = null; // 正在传输的本地文件ID
    private sendingInProgress: boolean = false; // 标记是否正在发送中

    // 多文件传输相关属性
    private fileQueue: QueuedFile[] = []; // 文件传输队列
    private isProcessingQueue: boolean = false; // 是否正在处理队列

    constructor(url: string) {
        this.url = url;
        this.onProgressCallbacks = () => {
        };
        this.fileQueue = [];
        this.isProcessingQueue = false;
    }
    public setProgressCallback(callback: (status: ClientTransferStatus) => void) {
        this.onProgressCallbacks = callback;
    }

    public connect(): Promise<void> {
        return new Promise((resolve, reject) => {
            this.ws = new WebSocket(this.url);

            this.ws.on('open', () => {
                console.log('Connected to file transfer server');
                resolve();
            });

            this.ws.on('message', (data: WebSocket.Data) => {
                this.handleMessage(data);
            });

            this.ws.on('error', (error) => {
                console.error('File transfer client error:', error);
                // 发送错误信息
                if (this.onProgressCallbacks) {
                    this.onProgressCallbacks({
                        type: 'transfer-error',
                        fileId: '',
                        filePath: '',
                        message: '连接错误: ' + (error.message || '未知错误')
                    });
                }
                // 清理资源
                this.disconnect();
                reject(error);
            });

            this.ws.on('close', () => {
                console.log('Disconnected from file transfer server');
                // 发送断开连接信息
                if (this.onProgressCallbacks) {
                    this.onProgressCallbacks({
                        type: 'transfer-close',
                        message: '与文件传输服务器的连接已断开',
                        fileId: '',
                        filePath: ''
                    });
                }
                // 清理资源
                this.clearTimeouts();
                // 如果正在发送文件，需要清理相关资源
                if (this.sendingInProgress) {
                    this.sendingInProgress = false;
                    this.activeFileId = null;
                    this.disconnect();
                }
            });
        });
    }

    private handleMessage(data: WebSocket.Data) {
        // 检查WebSocket连接状态
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            console.log('WebSocket is not open, ignoring incoming message');
            return;
        }

        if (!Buffer.isBuffer(data)) {
            console.error('Received non-buffer data');
            return;
        }

        try {
            const message = MessageCodec.decodeMessage(data);
            this.processMessage(message);
        } catch (e) {
            console.error('Failed to decode message:', e);
        }
    }

    private encodeMessage(message: any): Buffer {
        return MessageCodec.encodeMessage(message);
    }

    private processMessage(message: FileMessage) {
        switch (message.type) {
            case MessageType.FILE_START_ACK:
                console.log('Received FILE_START_ACK');
                this.onProgressCallbacks({
                    type: 'transfer-start',
                    message: `Starting to send file: ${this.getfilePathFromId(this.activeFileId) || '' }`,
                    fileId: this.activeFileId || '',
                    filePath: this.getfilePathFromId(this.activeFileId ) || ''
                });
                this.receivedFileStartAck = true;
                if (this.fileStartAckResolver) {
                    this.fileStartAckResolver();
                    this.fileStartAckResolver = null;
                }
                break;
            case MessageType.FILE_CHUNK_ACK:
                this.handleAck((message as FileChunkAckMessage).ackIndex);
                break;
            case MessageType.FILE_PAUSE_ACK:
                console.log('Received FILE_PAUSE_ACK');
                // 设置暂停状态，停止发送
                this.isPaused = true;
                // 如果存在文件流，销毁它以确保不会再产出已缓冲的 chunk
                try {
                    if (this.fileStream) {
                        this.fileStream.destroy();
                        this.fileStream = null;
                    }
                } catch (e) {
                    // ignore
                }
                // 发送循环将退出；标记发送不在进行

                this.sendingInProgress = false;
                let fileId = (message as FilePauseAckMessage).fileId;
                this.onProgressCallbacks({
                    type: 'transfer-pause',
                    message: '传输已暂停',
                    fileId,
                    filePath: (this.getfilePathFromId((message as FilePauseAckMessage).fileId)) || ''
                });
                break;
            case MessageType.FILE_RESUME_ACK:
                console.log('Received FILE_RESUME_ACK');
                // 服务器返回最后一个已写入的块索引，客户端根据此索引重新从后续块开始发送
                this.lastChunkIndex = (message as FileResumeAckMessage).lastChunkIndex;
                this.isPaused = false;
                // 如果存在活动文件路径且当前没有正在发送，则从 lastChunkIndex+1 处继续发送
                if (this.activeFileId !== null && !this.sendingInProgress) {
                    // 异步恢复发送，不阻塞消息处理
                    const queuedFile = this.fileQueue.find(f => f.fileId === this.activeFileId);
                    let file = {
                        'filePath': this.getfilePathFromId(this.activeFileId) as string, 
                        'fileId': this.activeFileId,
                        'relativePath': queuedFile?.relativePath
                    }
                    this.sendFileFromOffset(file, this.lastChunkIndex + 1).catch(err => {
                        console.error('Error while resuming transfer:', err);
                        // 发送错误信息
                        this.onProgressCallbacks({
                            type: 'transfer-error',
                            message: `恢复传输失败: ${err.message || '未知错误'}`,
                            fileId: this.activeFileId || '',
                            filePath: this.getfilePathFromId(this.activeFileId) || ''
                            
                        });
                    });
                }

                this.onProgressCallbacks({
                    type: 'transfer-resume',
                    message: '传输已恢复',
                    fileId: (message as FileResumeAckMessage).fileId,
                    filePath: (this.getfilePathFromId((message as FileResumeAckMessage).fileId)) || ''
                });
                break;
            case MessageType.FILE_CANCEL_ACK:
                console.log('Received FILE_CANCEL_ACK');
                this.isCancelled = true;
                // 停止发送
                this.onProgressCallbacks({
                    type: 'transfer-cancel',
                    message: '传输已取消',
                    fileId: (message as FileCancelAckMessage).fileId,
                    filePath: (this.getfilePathFromId((message as FileCancelAckMessage).fileId)) || ''
                });
                break;
            case MessageType.FILE_CONTROL:
                console.log('Received FILE_CONTROL from server');
                // 根据控制类型执行相应的操作
                switch ((message as FileControlMessage).controlType) {
                    case MessageType.FILE_PAUSE:
                        this.pauseTransfer((message as FileControlMessage).fileId);
                        break;
                    case MessageType.FILE_RESUME:
                        this.resumeTransfer((message as FileControlMessage).fileId);
                        break;
                    case MessageType.FILE_CANCEL:
                        this.cancelTransfer((message as FileControlMessage).fileId);
                        break;
                }
                break;
            case MessageType.FILE_START:
            case MessageType.FILE_CHUNK:
            case MessageType.FILE_END:
                // 客户端不应该收到这些消息
                console.warn(`Unexpected message type received: ${message.type}`);
                break;
            default:
                console.log('Unknown message type:', message.type);
        }
    }

    private handleAck(index: number) {
        // 处理暂停状态下的特殊ACK（index = -1）
        if (index === -1) {
            console.log('Received pause ACK, chunk was not processed by server');
            // 不删除pendingAcks，因为我们没有实际发送这个块
            return;
        }

        console.log(`Received ACK for chunk ${index}`);
        this.pendingAcks.delete(index);

        // 清除超时定时器
        const timeout = this.ackTimeouts.get(index);
        if (timeout) {
            clearTimeout(timeout);
            this.ackTimeouts.delete(index);
        }
    }

    /**
     * 统一发送文件和文件夹
     * @param items 包含文件或文件夹的数组，type可以是'file'或'directory'
     */
    public async send(items: { filePath: string; fileId: string; type: 'file' | 'directory' }[]): Promise<void> {
        // 处理文件夹类型，展开为文件列表并添加文件夹元数据
        const expandedQueue: QueuedFile[] = [];
        const folderInfo: Map<string, { name: string; files: QueuedFile[]; totalSize: number }> = new Map();

        for (const item of items) {
            if (item.type === 'directory') {
                // 文件夹类型：收集文件并标记文件夹ID
                const folderId = item.fileId;
                const folderPath = item.filePath;
                const folderName = basename(folderPath);

                console.log(`Preparing to send folder: ${folderName} (ID: ${folderId})`);

                const collectedFiles = collectFilesFromFolder(folderPath);

                if (collectedFiles.length === 0) {
                    console.warn(`Folder ${folderName} is empty`);
                    if (this.onProgressCallbacks) {
                        this.onProgressCallbacks({
                            type: 'transfer-error',
                            message: `文件夹${folderName}为空`,
                            fileId: folderId,
                            filePath: folderPath
                        });
                    }
                    continue;
                }

                // 计算总大小
                const totalSize = collectedFiles.reduce((sum, file) => {
                    try {
                        return sum + statSync(file.filePath).size;
                    } catch {
                        return sum;
                    }
                }, 0);

                const folderFiles: QueuedFile[] = collectedFiles.map((file, index) => ({
                    filePath: file.filePath,
                    fileId: `${folderId}-file-${index}`,
                    type: 'file' as const,
                    status: FileTransferStatus.Pending,
                    folderId: folderId,
                    folderRootPath: folderPath,
                    relativePath: file.relativePath
                }));

                expandedQueue.push(...folderFiles);
                folderInfo.set(folderId, {
                    name: folderName,
                    files: folderFiles,
                    totalSize: totalSize
                });

                console.log(`Found ${collectedFiles.length} files in folder ${folderName}`);
            } else {
                // 普通文件类型
                expandedQueue.push({
                    ...item,
                    status: FileTransferStatus.Pending
                });
            }
        }

        // 更新队列
        this.fileQueue = expandedQueue;

        // 保存文件夹元数据供processFileQueue使用
        (this as any).pendingFolderInfo = folderInfo;

        // 如果没有正在处理队列，则开始处理
        if (!this.isProcessingQueue && this.fileQueue.length > 0) {
            this.isProcessingQueue = true;
            await this.processFileQueue();
        }
    }

    // 处理文件传输队列
    private async processFileQueue(): Promise<void> {
        const pendingFolderInfo = (this as any).pendingFolderInfo as Map<string, any> || new Map();
        const processedFolders = new Set<string>(); // 记录已处理的文件夹

        for (const queuedFile of this.fileQueue) {
            // 只处理未完成的文件
            if (queuedFile.status !== FileTransferStatus.Completed) {
                const folderId = queuedFile.folderId;

                // 如果是文件夹中的第一个文件，发送FOLDER_START
                if (folderId && !processedFolders.has(folderId)) {
                    processedFolders.add(folderId);
                    const folderData = pendingFolderInfo.get(folderId);
                    if (folderData) {
                        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
                            throw new Error('WebSocket is not connected');
                        }

                        const folderStartMsg: FolderStartMessage = {
                            type: MessageType.FOLDER_START,
                            folderId: folderId,
                            folderName: folderData.name
                        };

                        this.ws.send(this.encodeMessage(folderStartMsg));
                        console.log(`Sent FOLDER_START message for ${folderData.name}`);
                    }
                }

                // 更新状态为正在传输
                queuedFile.status = FileTransferStatus.InProgress;

                try {
                    // 从头开始发送文件（chunkIndex = 0）
                    await this.sendFileFromOffset(
                        {
                            filePath: queuedFile.filePath,
                            fileId: queuedFile.fileId,
                            relativePath: queuedFile.relativePath
                        },
                        0
                    );

                    // 传输成功后更新状态为已完成
                    queuedFile.status = FileTransferStatus.Completed;
                } catch (error: unknown) {
                    console.error(`Failed to send file ${queuedFile.filePath}:`, error);
                    // 发送错误信息
                    if (this.onProgressCallbacks) {
                        this.onProgressCallbacks({
                            type: 'transfer-error',
                            filePath: queuedFile.filePath,
                            fileId: queuedFile.fileId,
                            message: `文件传输失败: ${(error as any).message || '未知错误'}`,
                        });
                    }
                }

                // 检查是否是文件夹中的最后一个文件，如果是则发送FOLDER_END
                if (folderId) {
                    const remainingFolderFiles = this.fileQueue.filter(
                        f => f.folderId === folderId && f.status !== FileTransferStatus.Completed
                    );

                    if (remainingFolderFiles.length === 0) {
                        const folderData = pendingFolderInfo.get(folderId);
                        if (folderData && this.ws && this.ws.readyState === WebSocket.OPEN) {
                            const folderEndMsg: FolderEndMessage = {
                                type: MessageType.FOLDER_END,
                                folderId: folderId,
                                totalFiles: folderData.files.length,
                                totalSize: folderData.totalSize
                            };

                            this.ws.send(this.encodeMessage(folderEndMsg));
                            console.log(
                                `Sent FOLDER_END message for ${folderData.name}, total files: ${folderData.files.length}, total size: ${folderData.totalSize} bytes`
                            );
                        }
                    }
                }
            }
        }

        // 清理临时文件夹信息
        (this as any).pendingFolderInfo = null;

        // 队列处理完成
        this.isProcessingQueue = false;
    }
    // 辅助函数：检查WebSocket连接状态并清理资源
    private checkWebSocketConnection(fileStream: ReadStream, onWsClose: () => void, onStreamError: (err: any) => void, onStreamClose: () => void): boolean {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            console.log('WebSocket connection lost during file transfer');
            // 清理资源
            try { fileStream.destroy(); } catch (e) { }
            this.clearTimeouts();
            this.sendingInProgress = false;
            this.activeFileId = null;

            // 移除事件监听器
            if (this.ws) {
                this.ws.removeListener('close', onWsClose);
            }
            try {
                fileStream.off('error', onStreamError);
                fileStream.off('close', onStreamClose);
            } catch (e) { }

            return false; // 连接已断开
        }
        return true; // 连接正常
    }

    // 辅助函数：处理传输取消或暂停
    private handleTransferCancellation(fileStream: ReadStream, onWsClose: () => void, onStreamError: (err: any) => void, onStreamClose: () => void): boolean {
        if (this.isCancelled) {
            console.log('File transfer cancelled');
            // 清理发送状态
            this.sendingInProgress = false;
            this.activeFileId = null;
            this.clearTimeouts();
            // 确保流已关闭
            try { fileStream.destroy(); } catch (e) { }

            // 移除事件监听器
            if (this.ws) {
                this.ws.removeListener('close', onWsClose);
            }
            try {
                fileStream.off('error', onStreamError);
                fileStream.off('close', onStreamClose);
            } catch (e) { }

            return true; // 传输已取消
        }

        if (this.isPaused) {
            console.log('File transfer paused');
            return true; // 传输已暂停
        }

        return false; // 传输未被取消或暂停
    }

    public async sendFileFromOffset(file:{filePath:string,fileId:string,relativePath?:string} ,startChunkIndex: number): Promise<void> {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            throw new Error('WebSocket is not connected');
        }
        let { filePath, fileId, relativePath } = file;
        const filename = basename(filePath);
        const fileSize = statSync(filePath).size;

        console.log(`Sending file: ${filename} (${fileSize} bytes) from chunk index ${startChunkIndex}`);

        // 记录正在传输的文件路径，供 resume 使用
        this.activeFileId = fileId;
        this.sendingInProgress = true;

        // 初始化传输统计信息
        if (startChunkIndex === 0) {
            this.startTime = Date.now();
            this.lastUpdateTime = Date.now();
            this.bytesSent = 0;
        }
        this.isPaused = false;
        this.isCancelled = false;
        this.lastChunkIndex = startChunkIndex - 1; // 设置为上一个chunk索引

        // 如果是从头开始，发送文件开始信号
        if (startChunkIndex === 0) {
            // 1. 发送文件开始信号
            const fileStartMsg: FileStartMessage = {
                type: MessageType.FILE_START,
                filename: filename,
                fileId: fileId,
                fileSize: fileSize,
                relativePath: relativePath // 添加相对路径
            };

            // 检查WebSocket连接状态
            if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
                throw new Error('WebSocket connection lost before sending file start');
            }

            this.ws.send(this.encodeMessage(fileStartMsg));

            // 2. 等待文件开始确认
            this.receivedFileStartAck = false;
            await new Promise<void>((resolve, reject) => {
                this.fileStartAckResolver = resolve;
                // 设置30秒超时
                const timeout = setTimeout(() => {
                    if (!this.receivedFileStartAck) {
                        reject(new Error('Timeout waiting for FILE_START_ACK'));
                        // 发送错误信息
                        if (this.onProgressCallbacks) {
                            this.onProgressCallbacks({
                                type: 'transfer-error',
                                message: '等待文件开始确认超时',
                                fileId,
                                filePath,
                            });
                        }
                    }
                }, this.START_ACK_TIMEOUT);

                // 添加清理函数
                const cleanup = () => {
                    clearTimeout(timeout);
                };

                // 如果连接断开，清理并拒绝Promise
                const onClose = () => {
                    cleanup();
                    reject(new Error('Connection closed while waiting for FILE_START_ACK'));
                };

                if (this.ws) {
                    this.ws.once('close', onClose);
                }

                // 修改resolver以清理资源
                const originalResolver = this.fileStartAckResolver;
                this.fileStartAckResolver = () => {
                    if (this.ws) {
                        this.ws.removeListener('close', onClose);
                    }
                    cleanup();
                    if (originalResolver) originalResolver();
                };
            });
        }

        // 3. 分块读取并发送文件，从指定的偏移位置开始
        const startByteOffset = startChunkIndex * this.chunkSize;
        const fileStream = createReadStream(filePath, {
            highWaterMark: this.chunkSize,
            start: startByteOffset
        });
        this.fileStream = fileStream; // 保存文件流引用

        // 添加错误处理器，避免在主动 destroy 时出现不必要的错误日志
        const onStreamError = (err: any) => {
            // 当我们主动取消或暂停且销毁流时，忽略该错误
            if (this.isCancelled || this.isPaused) {
                return;
            }
            console.error('Read stream error:', err);
            // 发送错误信息
            if (this.onProgressCallbacks) {
                this.onProgressCallbacks({
                    type: 'transfer-error',
                    message: `文件读取错误: ${err.message || '未知错误'}`,
                    fileId,
                    filePath,
                });
            }
        };

        const onStreamClose = () => {
            // no-op for now, placeholder for future cleanup if needed
        };

        fileStream.on('error', onStreamError);
        fileStream.on('close', onStreamClose);

        // 监听WebSocket关闭事件
        const onWsClose = () => {
            console.log('WebSocket closed during file transfer');
            // 清理资源
            try {
                fileStream.destroy();
            } catch (e) {
                // ignore
            }
            this.clearTimeouts();
            this.sendingInProgress = false;
            this.activeFileId = null;
        };

        if (this.ws) {
            this.ws.once('close', onWsClose);
        }

        let chunkIndex = startChunkIndex;
        let bytesSent = startByteOffset;

        try {
            for await (const chunk of fileStream) {
                // 检查WebSocket连接状态
                if (!this.checkWebSocketConnection(fileStream, onWsClose, onStreamError, onStreamClose)) {
                    throw new Error('WebSocket connection lost during file transfer');
                }

                // 检查是否暂停或取消
                while (this.isPaused && !this.isCancelled) {
                    // 检查WebSocket连接状态
                    if (!this.checkWebSocketConnection(fileStream, onWsClose, onStreamError, onStreamClose)) {
                        throw new Error('WebSocket connection lost during file transfer');
                    }
                    await new Promise(resolve => setTimeout(resolve, 100));
                }

                // 检查是否取消
                if (this.handleTransferCancellation(fileStream, onWsClose, onStreamError, onStreamClose)) {
                    return;
                }

                // 等待之前的块被确认（停等协议）
                while (this.pendingAcks.size > 0) {
                    // 检查WebSocket连接状态
                    if (!this.checkWebSocketConnection(fileStream, onWsClose, onStreamError, onStreamClose)) {
                        throw new Error('WebSocket connection lost during file transfer');
                    }
                    await this.waitForAcks();
                }

                // 发送文件块
                const fileChunkMsg: FileChunkMessage = {
                    type: MessageType.FILE_CHUNK,
                    chunkIndex: chunkIndex,
                    chunkData: chunk
                };

                // 检查WebSocket连接状态
                if (!this.checkWebSocketConnection(fileStream, onWsClose, onStreamError, onStreamClose)) {
                    throw new Error('WebSocket connection lost during file transfer');
                }

                this.ws.send(this.encodeMessage(fileChunkMsg));
                this.pendingAcks.add(chunkIndex);

                // 设置超时定时器
                const timeout = setTimeout(() => {
                    // 检查WebSocket连接状态
                    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
                        return;
                    }

                    console.warn(`Timeout for chunk ${chunkIndex}, resending...`);
                    this.pendingAcks.delete(chunkIndex);
                    this.ws?.send(this.encodeMessage(fileChunkMsg));
                    this.pendingAcks.add(chunkIndex);
                }, this.CHUNK_ACK_TIMEOUT); // 5秒超时

                this.ackTimeouts.set(chunkIndex, timeout);

                console.log(`Sent chunk ${chunkIndex} (${chunk.length} bytes)`);

                // 更新已发送字节数
                bytesSent += chunk.length;
                this.bytesSent = bytesSent; // 更新实例变量
                this.lastUpdateTime = Date.now(); // 更新最后更新时间
                this.lastChunkIndex = chunkIndex; // 记录最后一个块索引

                // 计算并报告进度
                const progress = Math.min(100, Math.floor((bytesSent / fileSize) * 100));

                // 计算传输速率 (bytes/second)
                const elapsedTime = (this.lastUpdateTime - this.startTime) / 1000; // 转换为秒
                this.transferRate = elapsedTime > 0 ? Math.floor(this.bytesSent / elapsedTime) : 0;

                if (this.onProgressCallbacks) {
                    this.onProgressCallbacks({
                        type: 'transfer-progress',
                        progress: progress,
                        transferRate: this.transferRate,
                        message: '',
                        fileId,
                        filePath,
                    });
                }

                chunkIndex++;
            }
        } catch (err: any) {
            if (this.isPaused || this.isCancelled) {
                // 如果是因为暂停或取消导致的流关闭，忽略错误
                console.log('File stream closed due to pause or cancel');
                // 清理所有待确认的块和超时定时器
                if (this.isCancelled) {
                    this.clearTimeouts();
                }

                // 移除事件监听器
                if (this.ws) {
                    this.ws.removeListener('close', onWsClose);
                }
                try {
                    fileStream.off('error', onStreamError);
                    fileStream.off('close', onStreamClose);
                } catch (e) { }
                return;
            }

            // 处理其他错误
            console.error('File transfer error:', err);
            if (this.onProgressCallbacks) {
                this.onProgressCallbacks({
                    type: 'transfer-error',
                    message: `文件传输错误: ${err.message || '未知错误'}`,
                    fileId,
                    filePath,
                });
            }

            // 清理资源
            try { fileStream.destroy(); } catch (e) { }
            this.clearTimeouts();
            this.sendingInProgress = false;
            this.activeFileId = null;

            // 移除事件监听器
            if (this.ws) {
                this.ws.removeListener('close', onWsClose);
            }
            try {
                fileStream.off('error', onStreamError);
                fileStream.off('close', onStreamClose);
            } catch (e) { }

            throw err;
        }

        // 移除事件监听器
        if (this.ws) {
            this.ws.removeListener('close', onWsClose);
        }

        // 当 for-await 结束时，可能是因为文件读完，或因为暂停/销毁流导致提前结束。
        if (this.isPaused || this.isCancelled) {
            // 如果被暂停或取消，不发送文件结束，等待 resume 或用户操作。
            this.sendingInProgress = false;

            // activeFilePath 保留以便 resume 使用（若取消则清理）
            if (this.isCancelled) {
                this.activeFileId = null; 
                this.clearTimeouts();
            }
            try {
                fileStream.off('error', onStreamError);
                fileStream.off('close', onStreamClose);
            } catch (e) { }
            return;
        }

        // 检查WebSocket连接状态
        if (!this.checkWebSocketConnection(fileStream, onWsClose, onStreamError, onStreamClose)) {
            throw new Error('WebSocket connection lost during file transfer');
        }

        // 等待所有块被确认
        while (this.pendingAcks.size > 0) {
            // 检查WebSocket连接状态
            if (!this.checkWebSocketConnection(fileStream, onWsClose, onStreamError, onStreamClose)) {
                throw new Error('WebSocket connection lost during file transfer');
            }
            await this.waitForAcks();
        }

        // 4. 发送文件结束信号
        const fileEndMsg: FileEndMessage = { type: MessageType.FILE_END };
        this.ws.send(this.encodeMessage(fileEndMsg));

        // 发送100%进度完成
        if (this.onProgressCallbacks) {
            this.onProgressCallbacks({
                type: 'transfer-complete',
                message: '传输完成',
                fileId,
                filePath,
            });
        }

        console.log('File transfer completed');
        
        // 更新队列中对应文件的状态为已完成
        const queuedFile = this.fileQueue.find(f => f.fileId === fileId);
        if (queuedFile) {
            queuedFile.status = FileTransferStatus.Completed;
        }
        
        this.sendingInProgress = false;
        this.activeFileId = null;
        try {
            fileStream.off('error', onStreamError);
            fileStream.off('close', onStreamClose);
        } catch (e) { }

        // 如果还有文件在队列中，继续处理下一个文件
        if (this.fileQueue.length > 0) {
            // 不在这里直接调用processFileQueue，而是在下一次事件循环中调用
            // 这样可以确保当前函数完全结束后再处理下一个文件
            setImmediate(() => {
                if (!this.isProcessingQueue) {
                    this.isProcessingQueue = true;
                    this.processFileQueue().catch(err => {
                        console.error('Error processing file queue:', err);
                    });
                }
            });
        }
    }    

    // 批量添加文件到传输队列
    public async sendFiles(files: { filePath: string; fileId: string }[]): Promise<void> {
        // 将所有文件添加到传输队列，并设置初始状态为待处理
        this.fileQueue = files.map(file => ({
            ...file,
            type: 'file',
            status: FileTransferStatus.Pending
        }));

        // 如果没有正在处理队列，则开始处理
        if (!this.isProcessingQueue && this.fileQueue.length > 0) {
            this.isProcessingQueue = true;
            await this.processFileQueue();
        }
    }

    // 清空传输队列
    public clearFileQueue(): void {
        this.fileQueue = [];
    }

    // 获取队列中的文件数量
    public getFileQueueLength(): number {
        return this.fileQueue.length;
    }
    
    // 获取队列中特定状态的文件数量
    public getFileQueueLengthByStatus(status: FileTransferStatus): number {
        return this.fileQueue.filter(file => file.status === status).length;
    }
    
    // 获取队列中特定状态的文件列表
    public getFilesByStatus(status: FileTransferStatus): QueuedFile[] {
        return this.fileQueue.filter(file => file.status === status);
    }
    
    // 添加暂停传输方法
    public pauseTransfer(fileId: string): void {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            throw new Error('WebSocket is not connected');
        }

        const pauseMsg: FilePauseMessage = {
            type: MessageType.FILE_PAUSE,
            fileId
        };
        this.ws.send(this.encodeMessage(pauseMsg));
    }

    // 添加恢复传输方法
    public resumeTransfer(fileId: string): void {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            throw new Error('WebSocket is not connected');
        }

        const resumeMsg: FileResumeMessage = {
            type: MessageType.FILE_RESUME,
            fileId
        };
        this.ws.send(this.encodeMessage(resumeMsg));
    }

 

    // 添加取消传输方法
    public cancelTransfer(fileId: string): void {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            throw new Error('WebSocket is not connected');
        }

        // 设置取消状态
        this.isCancelled = true;

        // 如果有文件流，销毁它
        if (this.fileStream) {
            try {
                this.fileStream.destroy();
            } catch (e) {
                // ignore
            }
        }

        this.clearTimeouts();

        const cancelMsg: FileCancelMessage = {
            type: MessageType.FILE_CANCEL,
            fileId
        };
        this.ws.send(this.encodeMessage(cancelMsg));
    }

    private clearTimeouts() {
        this.pendingAcks.clear();
        this.ackTimeouts.forEach(timeout => clearTimeout(timeout));
        this.ackTimeouts.clear();
    }

    private waitForAcks(): Promise<void> {
        return new Promise(resolve => {
            const check = () => {
                if (this.pendingAcks.size === 0) {
                    resolve();
                } else {
                    setTimeout(check, 100);
                }
            };
            check();
        });
    }

    public sendMessage(message: string) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(message);
        }
    }



    public disconnect() {
        console.log('Disconnecting client');

        // 设置取消状态以停止任何正在进行的传输
        this.isCancelled = true;

        // 如果有文件流，销毁它
        if (this.fileStream) {
            try {
                this.fileStream.destroy();
                console.log('File stream destroyed');
            } catch (e) {
                console.error('Error destroying file stream:', e);
            }
            this.fileStream = null;
        }

        // 清理所有待确认的块和超时定时器
        this.clearTimeouts();
        this.onProgressCallbacks = () => {
        };

        // 重置状态
        this.sendingInProgress = false;
        this.activeFileId = null;

        // 将队列中正在进行的文件状态改回待处理
        this.fileQueue.forEach(file => {
            if (file.status === FileTransferStatus.InProgress) {
                file.status = FileTransferStatus.Pending;
            }
        });
        
        this.isProcessingQueue = false;

        if (this.ws) {
            try {
                this.ws.close();
                console.log('WebSocket closed');
            } catch (e) {
                console.error('Error closing WebSocket:', e);
            }
            this.ws = null;
        }

        console.log('Client disconnected');
    }


    getfilePathFromId(fileId: string | null): string | null {
        if(fileId === null || fileId === undefined) return null;
        const queuedFile = this.fileQueue.find(file => file.fileId === fileId);
        return queuedFile?.filePath || null;
    }
}