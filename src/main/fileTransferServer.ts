import WebSocket, { WebSocketServer } from 'ws';
import { createReadStream, statSync, createWriteStream, WriteStream } from 'fs';
import { join, basename } from 'path';
import { type ServerTransferStatus } from '../common/types';

// 消息类型定义
const MessageType = {
    FILE_START: 1,
    FILE_START_ACK: 2,
    FILE_CHUNK: 3,
    FILE_CHUNK_ACK: 4,
    FILE_END: 5,
    FILE_PAUSE: 6,   //暂停传输
    FILE_PAUSE_ACK: 7,
    FILE_RESUME: 8,  //恢复传输
    FILE_RESUME_ACK: 9,
    FILE_CANCEL: 11,  //取消传输
    FILE_CANCEL_ACK: 12
} as const;

type MessageType = typeof MessageType[keyof typeof MessageType];

// 消息接口定义
interface FileStartMessage {
    type: MessageType;
    filename: string;
    fileSize: number;
}

interface FileStartAckMessage {
    type: MessageType;
}

interface FileChunkMessage {
    type: MessageType;
    chunkIndex: number;
    chunkData: Buffer;
}

interface FileAckMessage {
    type: MessageType;
    ackIndex: number;
}

interface FileEndMessage {
    type: MessageType;
}


interface FilePauseMessage {
    type: MessageType;
    filename: string;
}

interface FilePauseAckMessage {
    type: MessageType;
    filename: string;
    success: boolean;
}

interface FileResumeMessage {
    type: MessageType;
    filename: string;
}

interface FileResumeAckMessage {
    type: MessageType;
    filename: string;
    success: boolean;
    lastChunkIndex: number;  // 最后一个分片索引
}



interface FileCancelMessage {
    type: MessageType;
    filename: string;
}

interface FileCancelAckMessage {
    type: MessageType;
    filename: string;
    success: boolean;
}

interface FileInfos {
    filename: string;
    fileSize: number;
    receivedChunks: number;
    bytesReceived: number;
    startTime: number; // 添加开始时间戳
    lastUpdateTime: number; // 添加上次更新时间戳
    receiveRate: number; // 添加接收速率
    isPaused: boolean; // 添加暂停状态
    lastChunkIndex: number; // 添加最后一个块索引，用于恢复传输
}


/* 消息头结构：[魔数: 4字节][消息类型: 4字节][字段1: 4字节][字段2: 4字节]
FileStart: 字段1=文件名长度，字段2=文件大小，消息体=文件名
FileChunk: 字段1=分片索引，字段2=分片数据长度，消息体=分片数据
FileAck: 字段1=确认的分片索引，字段2=保留
FilePause: 字段1=文件名长度，字段2=保留，消息体=文件名
FilePauseAck: 字段1=文件名长度，字段2=保留，消息体=文件名
FileResume: 字段1=文件名长度，字段2=保留，消息体=文件名
FileResumeAck: 字段1=文件名长度，字段2=保留，消息体=文件名
FileCancel: 字段1=文件名长度，字段2=保留，消息体=文件名
FileCancelAck: 字段1=文件名长度，字段2=保留，消息体=文件名
FileStartAck/FileEnd：字段1和字段2均为保留字段*/
const MAGIC_NUMBER = 0x46544D53; // "FTMS"
const HEADER_SIZE = 16;

export class FileTransferServer {
    private wss: WebSocketServer;
    private port: number;
    private clients: Set<WebSocket>;
    private fileStreams: Map<WebSocket, WriteStream>; // 存储每个连接的文件写入流
    private fileInfos: Map<WebSocket, FileInfos>; // 存储每个连接的文件信息
    private onProgressCallbacks: Map<WebSocket, (progress: number) => void>; // 存储每个连接的进度回调函数
    private onServerProgress: ((status: ServerTransferStatus) => void) | null = null; // 服务端进度回调

    constructor(port: number = 8080) {
        this.port = port;
        this.clients = new Set();
        this.fileStreams = new Map();
        this.fileInfos = new Map();
        this.onProgressCallbacks = new Map();
        this.wss = new WebSocketServer({ port: this.port, perMessageDeflate: false, maxPayload: 100 * 1024 * 1024 });
        this.setupListeners();
    }

    // 设置服务端进度回调函数
    public setServerProgressCallback(callback: (status: ServerTransferStatus) => void) {
        this.onServerProgress = callback;
    }

    // 设置特定客户端的进度回调函数
    public setProgressCallback(ws: WebSocket, callback: (progress: number) => void) {
        this.onProgressCallbacks.set(ws, callback);
    }

    // 移除进度回调函数
    public removeProgressCallback(ws: WebSocket) {
        this.onProgressCallbacks.delete(ws);
    }

    private setupListeners() {
        this.wss.on('connection', (ws: WebSocket) => {
            console.log('New client connected');
            this.clients.add(ws);

            // 为新连接设置默认进度回调（输出到控制台）
            this.setProgressCallback(ws, (progress: number) => {
                const fileInfo = this.fileInfos.get(ws);
                if (fileInfo) {
                    console.log(`Server receiving progress for ${fileInfo.filename}: ${progress}%`);
                }
            });

            ws.on('message', (data: WebSocket.Data) => {
                this.handleMessage(ws, data);
            });

            ws.on('close', () => {
                console.log('Client disconnected');
                // 清理资源
                this.cleanupClientResources(ws);
                this.clients.delete(ws);
            });

            ws.on('error', (error) => {
                console.error('WebSocket error:', error);
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
        // 关闭并清理该客户端的文件流
        const writeStream = this.fileStreams.get(ws);
        if (writeStream) {
            writeStream.end();
            this.fileStreams.delete(ws);
        }

        // 删除该客户端的文件信息
        this.fileInfos.delete(ws);

        // 移除进度回调函数
        this.onProgressCallbacks.delete(ws);
    }

    private handleMessage(ws: WebSocket, data: WebSocket.Data) {
        if (!Buffer.isBuffer(data)) {
            console.error('Received non-buffer data');
            return;
        }

        try {
            const message = this.decodeMessage(data);
            this.processMessage(ws, message);
        } catch (e) {
            console.error('Failed to decode message:', e);
        }
    }

    private decodeMessage(buffer: Buffer): any {
        if (buffer.length < HEADER_SIZE) {
            throw new Error('Message too short');
        }

        // 解析消息头
        const magic = buffer.readUInt32BE(0);
        if (magic !== MAGIC_NUMBER) {
            throw new Error('Invalid magic number');
        }

        const messageType = buffer.readUInt32BE(4);
        const field1 = buffer.readUInt32BE(8);
        const field2 = buffer.readUInt32BE(12);

        // 根据消息类型解析消息体
        switch (messageType) {
            case MessageType.FILE_START:
                const filenameLength = field1;
                const fileSize = field2;
                if (buffer.length < HEADER_SIZE + filenameLength) {
                    throw new Error('Incomplete FILE_START message');
                }
                const filename = buffer.subarray(HEADER_SIZE, HEADER_SIZE + filenameLength).toString('utf8');
                return { type: MessageType.FILE_START, filename, fileSize };

            case MessageType.FILE_START_ACK:
                return { type: MessageType.FILE_START_ACK };

            case MessageType.FILE_CHUNK:
                const chunkIndex = field1;
                const chunkLength = field2;
                if (buffer.length < HEADER_SIZE + chunkLength) {
                    throw new Error('Incomplete FILE_CHUNK message');
                }
                const chunkData = buffer.subarray(HEADER_SIZE, HEADER_SIZE + chunkLength);
                return { type: MessageType.FILE_CHUNK, chunkIndex, chunkData };

            case MessageType.FILE_CHUNK_ACK:
                const ackIndex = field1;
                return { type: MessageType.FILE_CHUNK_ACK, ackIndex };

            case MessageType.FILE_END:
                return { type: MessageType.FILE_END };
                
            case MessageType.FILE_PAUSE:
                const pauseFilenameLength = field1;
                if (buffer.length < HEADER_SIZE + pauseFilenameLength) {
                    throw new Error('Incomplete FILE_PAUSE message');
                }
                const pauseFilename = buffer.subarray(HEADER_SIZE, HEADER_SIZE + pauseFilenameLength).toString('utf8');
                return { type: MessageType.FILE_PAUSE, filename: pauseFilename };
                
            case MessageType.FILE_RESUME:
                const resumeFilenameLength = field1;
                if (buffer.length < HEADER_SIZE + resumeFilenameLength) {
                    throw new Error('Incomplete FILE_RESUME message');
                }
                const resumeFilename = buffer.subarray(HEADER_SIZE, HEADER_SIZE + resumeFilenameLength).toString('utf8');
                return { type: MessageType.FILE_RESUME, filename: resumeFilename };
                
            case MessageType.FILE_CANCEL:
                const cancelFilenameLength = field1;
                if (buffer.length < HEADER_SIZE + cancelFilenameLength) {
                    throw new Error('Incomplete FILE_CANCEL message');
                }
                const cancelFilename = buffer.subarray(HEADER_SIZE, HEADER_SIZE + cancelFilenameLength).toString('utf8');
                return { type: MessageType.FILE_CANCEL, filename: cancelFilename };

            default:
                throw new Error(`Unknown message type: ${messageType}`);
        }
    }

    private encodeMessage(message: any): Buffer {
        switch (message.type) {
            case MessageType.FILE_START:
                const filenameBuffer = Buffer.from(message.filename, 'utf8');
                const filenameLength = filenameBuffer.length;

                const fileStartBuffer = Buffer.alloc(HEADER_SIZE + filenameLength);
                fileStartBuffer.writeUInt32BE(MAGIC_NUMBER, 0);
                fileStartBuffer.writeUInt32BE(MessageType.FILE_START, 4);
                fileStartBuffer.writeUInt32BE(filenameLength, 8);
                fileStartBuffer.writeUInt32BE(message.fileSize, 12);
                filenameBuffer.copy(fileStartBuffer, HEADER_SIZE);
                return fileStartBuffer;

            case MessageType.FILE_START_ACK:
                const fileStartAckBuffer = Buffer.alloc(HEADER_SIZE);
                fileStartAckBuffer.writeUInt32BE(MAGIC_NUMBER, 0);
                fileStartAckBuffer.writeUInt32BE(MessageType.FILE_START_ACK, 4);
                fileStartAckBuffer.writeUInt32BE(0, 8);
                fileStartAckBuffer.writeUInt32BE(0, 12);
                return fileStartAckBuffer;

            case MessageType.FILE_CHUNK:
                const chunkLength = message.chunkData.length;

                const fileChunkBuffer = Buffer.alloc(HEADER_SIZE + chunkLength);
                fileChunkBuffer.writeUInt32BE(MAGIC_NUMBER, 0);
                fileChunkBuffer.writeUInt32BE(MessageType.FILE_CHUNK, 4);
                fileChunkBuffer.writeUInt32BE(message.chunkIndex, 8);
                fileChunkBuffer.writeUInt32BE(chunkLength, 12);
                message.chunkData.copy(fileChunkBuffer, HEADER_SIZE);
                return fileChunkBuffer;

            case MessageType.FILE_CHUNK_ACK:
                const fileAckBuffer = Buffer.alloc(HEADER_SIZE);
                fileAckBuffer.writeUInt32BE(MAGIC_NUMBER, 0);
                fileAckBuffer.writeUInt32BE(MessageType.FILE_CHUNK_ACK, 4);
                fileAckBuffer.writeUInt32BE(message.ackIndex, 8);
                fileAckBuffer.writeUInt32BE(0, 12);
                return fileAckBuffer;

            case MessageType.FILE_END:
                const fileEndBuffer = Buffer.alloc(HEADER_SIZE);
                fileEndBuffer.writeUInt32BE(MAGIC_NUMBER, 0);
                fileEndBuffer.writeUInt32BE(MessageType.FILE_END, 4);
                fileEndBuffer.writeUInt32BE(0, 8);
                fileEndBuffer.writeUInt32BE(0, 12);
                return fileEndBuffer;
                
            case MessageType.FILE_PAUSE_ACK:
                const pauseAckFilenameBuffer = Buffer.from(message.filename, 'utf8');
                const pauseAckFilenameLength = pauseAckFilenameBuffer.length;
                
                const filePauseAckBuffer = Buffer.alloc(HEADER_SIZE + pauseAckFilenameLength);
                filePauseAckBuffer.writeUInt32BE(MAGIC_NUMBER, 0);
                filePauseAckBuffer.writeUInt32BE(MessageType.FILE_PAUSE_ACK, 4);
                filePauseAckBuffer.writeUInt32BE(pauseAckFilenameLength, 8);
                filePauseAckBuffer.writeUInt32BE(0, 12); // 保留字段
                pauseAckFilenameBuffer.copy(filePauseAckBuffer, HEADER_SIZE);
                return filePauseAckBuffer;
                
            case MessageType.FILE_RESUME_ACK:
                const resumeAckFilenameBuffer = Buffer.from(message.filename, 'utf8');
                const resumeAckFilenameLength = resumeAckFilenameBuffer.length;
                
                const fileResumeAckBuffer = Buffer.alloc(HEADER_SIZE + resumeAckFilenameLength);
                fileResumeAckBuffer.writeUInt32BE(MAGIC_NUMBER, 0);
                fileResumeAckBuffer.writeUInt32BE(MessageType.FILE_RESUME_ACK, 4);
                fileResumeAckBuffer.writeUInt32BE(resumeAckFilenameLength, 8);
                fileResumeAckBuffer.writeUInt32BE(message.lastChunkIndex, 12);
                resumeAckFilenameBuffer.copy(fileResumeAckBuffer, HEADER_SIZE);
                return fileResumeAckBuffer;
                
            case MessageType.FILE_CANCEL_ACK:
                const cancelAckFilenameBuffer = Buffer.from(message.filename, 'utf8');
                const cancelAckFilenameLength = cancelAckFilenameBuffer.length;
                
                const fileCancelAckBuffer = Buffer.alloc(HEADER_SIZE + cancelAckFilenameLength);
                fileCancelAckBuffer.writeUInt32BE(MAGIC_NUMBER, 0);
                fileCancelAckBuffer.writeUInt32BE(MessageType.FILE_CANCEL_ACK, 4);
                fileCancelAckBuffer.writeUInt32BE(cancelAckFilenameLength, 8);
                fileCancelAckBuffer.writeUInt32BE(message.success ? 1 : 0, 12);
                cancelAckFilenameBuffer.copy(fileCancelAckBuffer, HEADER_SIZE);
                return fileCancelAckBuffer;

            default:
                throw new Error(`Unknown message type: ${message.type}`);
        }
    }

    private processMessage(ws: WebSocket, message: any) {
        switch (message.type) {
            case MessageType.FILE_START:
                this.handleFileStart(ws, message);
                break;
            case MessageType.FILE_CHUNK:
                this.handleFileChunk(ws, message);
                break;
            case MessageType.FILE_END:
                this.handleFileEnd(ws, message);
                break;
            case MessageType.FILE_PAUSE:
                this.handleFilePause(ws, message);
                break;
            case MessageType.FILE_RESUME:
                this.handleFileResume(ws, message);
                break;
            case MessageType.FILE_CANCEL:
                this.handleFileCancel(ws, message);
                break;
            case MessageType.FILE_CHUNK_ACK:
                // 客户端确认收到文件块（服务端不需要处理）
                console.log(`Received ACK for chunk ${message.ackIndex}`);
                break;
            case MessageType.FILE_START_ACK:
                // 客户端确认收到文件开始（服务端不需要处理）
                console.log('Received FILE_START_ACK');
                break;
            default:
                console.log('Unknown message type:', message.type);
        }
    }

    private handleFileStart(ws: WebSocket, message: FileStartMessage) {
        console.log(`Starting to receive file: ${message.filename} (${message.fileSize} bytes)`);

        // 创建文件写入流
        const filePath = join(__dirname, message.filename);
        const writeStream = createWriteStream(filePath);

        this.fileStreams.set(ws, writeStream);
        this.fileInfos.set(ws, {
            filename: message.filename,
            fileSize: message.fileSize,
            receivedChunks: 0,
            bytesReceived: 0,
            startTime: Date.now(),
            lastUpdateTime: Date.now(),
            receiveRate: 0,
            isPaused: false,
            lastChunkIndex: -1
        });

        console.log(`File stream created for ${message.filename}`);

        // 发送确认消息
        const ackMessage: FileStartAckMessage = { type: MessageType.FILE_START_ACK };
        if (this.onServerProgress) {
            this.onServerProgress({ type: 'transfer-start', clientId: ws.url || 'unknown', filename: message.filename, filesize: message.fileSize, message: '' });
        }
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

        // 检查是否暂停
        if (fileInfo.isPaused) {
            console.log(`File transfer is paused for ${fileInfo.filename}`);
            return;
        }

        // 写入文件块数据
        writeStream.write(message.chunkData, (err: any) => {
            if (err) {
                console.error('Failed to write file chunk:', err);
            } else {
                console.log(`Written chunk ${message.chunkIndex} (${message.chunkData.length} bytes) to file`);

                // 发送确认消息
                const ackMessage: FileAckMessage = {
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
                const progressCallback = this.onProgressCallbacks.get(ws);
                if (progressCallback) {
                    progressCallback(progress);
                }

                // 调用服务端进度回调函数
                if (this.onServerProgress) {
                    this.onServerProgress({ 
                        type: 'transfer-progress', 
                        clientId: ws.url || 'unknown', 
                        filename: fileInfo.filename, 
                        progress, 
                        message: '',
                        receiveRate: fileInfo.receiveRate // 添加接收速率
                    } ); 
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
                    const progressCallback = this.onProgressCallbacks.get(ws);
                    if (progressCallback) {
                        progressCallback(100);
                    }

                    // 调用服务端进度回调函数
                    if (this.onServerProgress) {
                        this.onServerProgress({ type: 'transfer-complete', clientId: ws.url || 'unknown', filename: fileInfo.filename, message: '' });
                    }
                }
                // 删除文件信息
                this.fileInfos.delete(ws);
            });
            this.fileStreams.delete(ws);
        }
    }

    // 处理文件暂停消息
    private handleFilePause(ws: WebSocket, message: FilePauseMessage) {
        console.log(`Received pause request for file: ${message.filename}`);
        
        // 获取文件信息
        const fileInfo = this.fileInfos.get(ws);
        if (!fileInfo) {
            console.error('File info not found for this connection');
            // 发送暂停确认消息（失败）
            const ackMessage: FilePauseAckMessage = {
                type: MessageType.FILE_PAUSE_ACK,
                filename: message.filename,
                success: false
            };
            ws.send(this.encodeMessage(ackMessage));
            return;
        }
        
        // 检查文件名是否匹配
        if (fileInfo.filename !== message.filename) {
            console.error('Filename mismatch for pause request');
            // 发送暂停确认消息（失败）
            const ackMessage: FilePauseAckMessage = {
                type: MessageType.FILE_PAUSE_ACK,
                filename: message.filename,
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
            filename: message.filename,
            success: true
        };
        ws.send(this.encodeMessage(ackMessage));
        
        // 调用服务端进度回调函数
        if (this.onServerProgress) {
            this.onServerProgress({ 
                type: 'transfer-pause', 
                clientId: ws.url || 'unknown', 
                filename: fileInfo.filename, 
                message: '传输已暂停'
            }); 
        }
    }

    // 处理文件恢复消息
    private handleFileResume(ws: WebSocket, message: FileResumeMessage) {
        console.log(`Received resume request for file: ${message.filename}`);
        
        // 获取文件信息
        const fileInfo = this.fileInfos.get(ws);
        if (!fileInfo) {
            console.error('File info not found for this connection');
            // 发送恢复确认消息（失败）
            const ackMessage: FileResumeAckMessage = {
                type: MessageType.FILE_RESUME_ACK,
                filename: message.filename,
                success: false,
                lastChunkIndex: -1
            };
            ws.send(this.encodeMessage(ackMessage));
            return;
        }
        
        // 检查文件名是否匹配
        if (fileInfo.filename !== message.filename) {
            console.error('Filename mismatch for resume request');
            // 发送恢复确认消息（失败）
            const ackMessage: FileResumeAckMessage = {
                type: MessageType.FILE_RESUME_ACK,
                filename: message.filename,
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
            filename: message.filename,
            success: true,
            lastChunkIndex: fileInfo.lastChunkIndex
        };
        ws.send(this.encodeMessage(ackMessage));
        
        // 调用服务端进度回调函数
        if (this.onServerProgress) {
            this.onServerProgress({ 
                type: 'transfer-resume', 
                clientId: ws.url || 'unknown', 
                filename: fileInfo.filename, 
                message: '传输已恢复'
            }); 
        }
    }

    // 处理文件取消消息
    private handleFileCancel(ws: WebSocket, message: FileCancelMessage) {
        console.log(`Received cancel request for file: ${message.filename}`);
        
        // 获取文件信息
        const fileInfo = this.fileInfos.get(ws);
        if (!fileInfo) {
            console.error('File info not found for this connection');
            // 发送取消确认消息（失败）
            const ackMessage: FileCancelAckMessage = {
                type: MessageType.FILE_CANCEL_ACK,
                filename: message.filename,
                success: false
            };
            ws.send(this.encodeMessage(ackMessage));
            return;
        }
        
        // 检查文件名是否匹配
        if (fileInfo.filename !== message.filename) {
            console.error('Filename mismatch for cancel request');
            // 发送取消确认消息（失败）
            const ackMessage: FileCancelAckMessage = {
                type: MessageType.FILE_CANCEL_ACK,
                filename: message.filename,
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
            filename: message.filename,
            success: true
        };
        ws.send(this.encodeMessage(ackMessage));
        
        // 调用服务端进度回调函数
        if (this.onServerProgress) {
            this.onServerProgress({ 
                type: 'transfer-cancel', 
                clientId: ws.url || 'unknown', 
                filename: fileInfo.filename, 
                message: '传输已取消'
            }); 
        }
    }

    // 添加发送暂停消息到客户端的方法
    public sendPauseToClient(filename: string): void {
        // 遍历所有客户端连接，找到对应的客户端并发送暂停消息
        for (const [ws, fileInfo] of this.fileInfos.entries()) {
            if (fileInfo.filename === filename) {
                const pauseMsg: FilePauseMessage = {
                    type: MessageType.FILE_PAUSE,
                    filename: filename
                };
                ws.send(this.encodeMessage(pauseMsg));
                break;
            }
        }
    }

    // 添加发送恢复消息到客户端的方法
    public sendResumeToClient(filename: string): void {
        // 遍历所有客户端连接，找到对应的客户端并发送恢复消息
        for (const [ws, fileInfo] of this.fileInfos.entries()) {
            if (fileInfo.filename === filename) {
                const resumeMsg: FileResumeMessage = {
                    type: MessageType.FILE_RESUME,
                    filename: filename
                };
                ws.send(this.encodeMessage(resumeMsg));
                break;
            }
        }
    }

    // 添加发送取消消息到客户端的方法
    public sendCancelToClient(filename: string): void {
        // 遍历所有客户端连接，找到对应的客户端并发送取消消息
        for (const [ws, fileInfo] of this.fileInfos.entries()) {
            if (fileInfo.filename === filename) {
                const cancelMsg: FileCancelMessage = {
                    type: MessageType.FILE_CANCEL,
                    filename: filename
                };
                ws.send(this.encodeMessage(cancelMsg));
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
        this.clients.forEach(client => {
            client.close();
        });
        this.wss.close();
    }
}

export class FileTransferClient {
    private ws: WebSocket | null = null;
    private url: string;
    private readonly chunkSize: number = 1024 * 1024; // 1MB chunks
    private readonly START_ACK_TIMEOUT = 30000;  // 30秒
    private readonly CHUNK_ACK_TIMEOUT = 5000;  // 5秒
    private pendingAcks: Set<number> = new Set(); // 等待确认的块索引
    private onProgress: ((progress: number) => void) | null = null; // 进度回调函数
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
    private fileStream: ReadableStream | null = null; // 文件流引用

    constructor(url: string) {
        this.url = url;
    }

    public setProgressCallback(callback: (progress: number) => void) {
        this.onProgress = callback;
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
                reject(error);
            });

            this.ws.on('close', () => {
                console.log('Disconnected from file transfer server');
                // 清理所有定时器
                this.ackTimeouts.forEach(timeout => clearTimeout(timeout));
                this.ackTimeouts.clear();
            });
        });
    }

    private handleMessage(data: WebSocket.Data) {
        if (!Buffer.isBuffer(data)) {
            console.error('Received non-buffer data');
            return;
        }

        try {
            const message = this.decodeMessage(data);
            this.processMessage(message);
        } catch (e) {
            console.error('Failed to decode message:', e);
        }
    }

    private decodeMessage(buffer: Buffer): any {
        if (buffer.length < HEADER_SIZE) {
            throw new Error('Message too short');
        }

        // 解析消息头
        const magic = buffer.readUInt32BE(0);
        if (magic !== MAGIC_NUMBER) {
            throw new Error('Invalid magic number');
        }

        const messageType = buffer.readUInt32BE(4);
        const field1 = buffer.readUInt32BE(8);
        const field2 = buffer.readUInt32BE(12);

        // 根据消息类型解析消息体
        switch (messageType) {
            case MessageType.FILE_START:
                const filenameLength = field1;
                const fileSize = field2;
                if (buffer.length < HEADER_SIZE + filenameLength) {
                    throw new Error('Incomplete FILE_START message');
                }
                const filename = buffer.subarray(HEADER_SIZE, HEADER_SIZE + filenameLength).toString('utf8');
                return { type: MessageType.FILE_START, filename, fileSize };

            case MessageType.FILE_START_ACK:
                return { type: MessageType.FILE_START_ACK };

            case MessageType.FILE_CHUNK:
                const chunkIndex = field1;
                const chunkLength = field2;
                if (buffer.length < HEADER_SIZE + chunkLength) {
                    throw new Error('Incomplete FILE_CHUNK message');
                }
                const chunkData = buffer.subarray(HEADER_SIZE, HEADER_SIZE + chunkLength);
                return { type: MessageType.FILE_CHUNK, chunkIndex, chunkData };

            case MessageType.FILE_CHUNK_ACK:
                const ackIndex = field1;
                return { type: MessageType.FILE_CHUNK_ACK, ackIndex };
            case MessageType.FILE_PAUSE:
                return { type: MessageType.FILE_PAUSE };
            case MessageType.FILE_PAUSE_ACK:
                return { type: MessageType.FILE_PAUSE_ACK };
            case MessageType.FILE_RESUME:
                return { type: MessageType.FILE_RESUME };
            case MessageType.FILE_RESUME_ACK:
                return { type: MessageType.FILE_RESUME_ACK, lastChunkIndex: field2 };
            case MessageType.FILE_CANCEL:
                return { type: MessageType.FILE_CANCEL };
            case MessageType.FILE_CANCEL_ACK:
                return { type: MessageType.FILE_CANCEL_ACK, success: field2 === 1 };
            case MessageType.FILE_END:
                return { type: MessageType.FILE_END };

            default:
                throw new Error(`Unknown message type: ${messageType}`);
        }
    }

    private encodeMessage(message: any): Buffer {
        switch (message.type) {
            case MessageType.FILE_START:
                const filenameBuffer = Buffer.from(message.filename, 'utf8');
                const filenameLength = filenameBuffer.length;

                const fileStartBuffer = Buffer.alloc(HEADER_SIZE + filenameLength);
                fileStartBuffer.writeUInt32BE(MAGIC_NUMBER, 0);
                fileStartBuffer.writeUInt32BE(MessageType.FILE_START, 4);
                fileStartBuffer.writeUInt32BE(filenameLength, 8);
                fileStartBuffer.writeUInt32BE(message.fileSize, 12);
                filenameBuffer.copy(fileStartBuffer, HEADER_SIZE);
                return fileStartBuffer;

            case MessageType.FILE_START_ACK:
                const fileStartAckBuffer = Buffer.alloc(HEADER_SIZE);
                fileStartAckBuffer.writeUInt32BE(MAGIC_NUMBER, 0);
                fileStartAckBuffer.writeUInt32BE(MessageType.FILE_START_ACK, 4);
                fileStartAckBuffer.writeUInt32BE(0, 8);
                fileStartAckBuffer.writeUInt32BE(0, 12);
                return fileStartAckBuffer;

            case MessageType.FILE_CHUNK:
                const chunkLength = message.chunkData.length;

                const fileChunkBuffer = Buffer.alloc(HEADER_SIZE + chunkLength);
                fileChunkBuffer.writeUInt32BE(MAGIC_NUMBER, 0);
                fileChunkBuffer.writeUInt32BE(MessageType.FILE_CHUNK, 4);
                fileChunkBuffer.writeUInt32BE(message.chunkIndex, 8);
                fileChunkBuffer.writeUInt32BE(chunkLength, 12);
                message.chunkData.copy(fileChunkBuffer, HEADER_SIZE);
                return fileChunkBuffer;

            case MessageType.FILE_CHUNK_ACK:
                const fileAckBuffer = Buffer.alloc(HEADER_SIZE);
                fileAckBuffer.writeUInt32BE(MAGIC_NUMBER, 0);
                fileAckBuffer.writeUInt32BE(MessageType.FILE_CHUNK_ACK, 4);
                fileAckBuffer.writeUInt32BE(message.ackIndex, 8);
                fileAckBuffer.writeUInt32BE(0, 12);
                return fileAckBuffer;

            case MessageType.FILE_END:
                const fileEndBuffer = Buffer.alloc(HEADER_SIZE);
                fileEndBuffer.writeUInt32BE(MAGIC_NUMBER, 0);
                fileEndBuffer.writeUInt32BE(MessageType.FILE_END, 4);
                fileEndBuffer.writeUInt32BE(0, 8);
                fileEndBuffer.writeUInt32BE(0, 12);
                return fileEndBuffer;

            default:
                throw new Error(`Unknown message type: ${message.type}`);
        }
    }

    private processMessage(message: any) {
        switch (message.type) {
            case MessageType.FILE_START_ACK:
                console.log('Received FILE_START_ACK');
                this.receivedFileStartAck = true;
                if (this.fileStartAckResolver) {
                    this.fileStartAckResolver();
                    this.fileStartAckResolver = null;
                }
                break;
            case MessageType.FILE_CHUNK_ACK:
                this.handleAck(message.ackIndex);
                break;
            case MessageType.FILE_PAUSE:
                console.log('Received FILE_PAUSE from server');
                this.isPaused = true;
                if (this.onProgress) {
                    this.onProgress(-1); // -1 表示暂停
                }
                // 发送暂停确认消息
                const pauseAckMsg = {
                    type: MessageType.FILE_PAUSE_ACK,
                    filename: message.filename,
                    success: true
                };
                this.ws?.send(this.encodeMessage(pauseAckMsg));
                break;
            case MessageType.FILE_RESUME:
                console.log('Received FILE_RESUME from server');
                this.isPaused = false;
                if (this.onProgress) {
                    this.onProgress(-2); // -2 表示恢复
                }
                // 发送恢复确认消息
                const resumeAckMsg = {
                    type: MessageType.FILE_RESUME_ACK,
                    filename: message.filename,
                    success: true,
                    lastChunkIndex: this.lastChunkIndex
                };
                this.ws?.send(this.encodeMessage(resumeAckMsg));
                break;
            case MessageType.FILE_CANCEL:
                console.log('Received FILE_CANCEL from server');
                this.isCancelled = true;
                if (this.onProgress) {
                    this.onProgress(-3); // -3 表示取消
                }
                // 发送取消确认消息
                const cancelAckMsg = {
                    type: MessageType.FILE_CANCEL_ACK,
                    filename: message.filename,
                    success: true
                };
                this.ws?.send(this.encodeMessage(cancelAckMsg));
                break;
            case MessageType.FILE_PAUSE_ACK:
                console.log('Received FILE_PAUSE_ACK');
                if (this.onProgress) {
                    this.onProgress(-1); // -1 表示暂停
                }
                break;
            case MessageType.FILE_RESUME_ACK:
                console.log('Received FILE_RESUME_ACK');
                this.isPaused = false;
                this.lastChunkIndex = message.lastChunkIndex;
                if (this.onProgress) {
                    this.onProgress(-2); // -2 表示恢复
                }
                break;
            case MessageType.FILE_CANCEL_ACK:
                console.log('Received FILE_CANCEL_ACK');
                this.isCancelled = true;
                if (this.onProgress) {
                    this.onProgress(-3); // -3 表示取消
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
        console.log(`Received ACK for chunk ${index}`);
        this.pendingAcks.delete(index);

        // 清除超时定时器
        const timeout = this.ackTimeouts.get(index);
        if (timeout) {
            clearTimeout(timeout);
            this.ackTimeouts.delete(index);
        }
    }

    public async sendFile(filePath: string): Promise<void> {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            throw new Error('WebSocket is not connected');
        }

        const filename = basename(filePath);
        const fileSize = statSync(filePath).size;

        console.log(`Sending file: ${filename} (${fileSize} bytes)`);

        // 初始化传输统计信息
        this.startTime = Date.now();
        this.lastUpdateTime = Date.now();
        this.bytesSent = 0;
        this.isPaused = false;
        this.isCancelled = false;
        this.lastChunkIndex = -1;

        // 1. 发送文件开始信号
        const fileStartMsg: FileStartMessage = {
            type: MessageType.FILE_START,
            filename: filename,
            fileSize: fileSize
        };
        this.ws.send(this.encodeMessage(fileStartMsg));

        // 2. 等待文件开始确认
        this.receivedFileStartAck = false;
        await new Promise<void>((resolve, reject) => {
            this.fileStartAckResolver = resolve;
            // 设置30秒超时
            setTimeout(() => {
                if (!this.receivedFileStartAck) {
                    reject(new Error('Timeout waiting for FILE_START_ACK'));
                }
            }, this.START_ACK_TIMEOUT);
        });

        // 3. 分块读取并发送文件
        const fileStream = createReadStream(filePath, { highWaterMark: this.chunkSize });
        this.fileStream = fileStream as any; // 保存文件流引用
        let chunkIndex = 0;
        let bytesSent = 0;

        for await (const chunk of fileStream) {
            // 检查是否暂停
            while (this.isPaused && !this.isCancelled) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }

            // 检查是否取消
            if (this.isCancelled) {
                console.log('File transfer cancelled');
                return;
            }

            // 等待之前的块被确认（停等协议）
            while (this.pendingAcks.size > 0) {
                await this.waitForAcks();
            }

            // 发送文件块
            const fileChunkMsg: FileChunkMessage = {
                type: MessageType.FILE_CHUNK,
                chunkIndex: chunkIndex,
                chunkData: chunk
            };

            this.ws.send(this.encodeMessage(fileChunkMsg));
            this.pendingAcks.add(chunkIndex);

            // 设置超时定时器
            const timeout = setTimeout(() => {
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
            
            if (this.onProgress) {
                this.onProgress(progress);
            }

            chunkIndex++;
        }

        // 等待所有块被确认
        while (this.pendingAcks.size > 0) {
            await this.waitForAcks();
        }

        // 4. 发送文件结束信号
        const fileEndMsg: FileEndMessage = { type: MessageType.FILE_END };
        this.ws.send(this.encodeMessage(fileEndMsg));

        // 发送100%进度完成
        if (this.onProgress) {
            this.onProgress(100);
        }

        console.log('File transfer completed');
    }

    // 添加暂停传输方法
    public pauseTransfer(filename: string): void {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            throw new Error('WebSocket is not connected');
        }

        const pauseMsg: FilePauseMessage = {
            type: MessageType.FILE_PAUSE,
            filename: filename
        };
        this.ws.send(this.encodeMessage(pauseMsg));
    }

    // 添加恢复传输方法
    public resumeTransfer(filename: string): void {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            throw new Error('WebSocket is not connected');
        }

        const resumeMsg: FileResumeMessage = {
            type: MessageType.FILE_RESUME,
            filename: filename
        };
        this.ws.send(this.encodeMessage(resumeMsg));
    }

    // 添加取消传输方法
    public cancelTransfer(filename: string): void {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            throw new Error('WebSocket is not connected');
        }

        // 设置取消状态
        this.isCancelled = true;

        // 如果有文件流，销毁它
        if (this.fileStream) {
            // 注意：这里需要根据实际的文件流类型来调用适当的方法
            // this.fileStream.destroy(); // 如果是 ReadableStream
        }

        const cancelMsg: FileCancelMessage = {
            type: MessageType.FILE_CANCEL,
            filename: filename
        };
        this.ws.send(this.encodeMessage(cancelMsg));
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
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    }
}