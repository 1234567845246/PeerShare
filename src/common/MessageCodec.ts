// 共享的消息编解码类

export const MessageType = {
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
    FILE_CANCEL_ACK: 12,
    FILE_CONTROL: 13, //服务端控制请求
} as const;


export type MessageType = typeof MessageType[keyof typeof MessageType];

// 消息接口定义
export type FileStartMessage = {
    type: MessageType;
    fileId: string;
    filename: string;
    fileSize: number;
}

export type FileStartAckMessage = {
    type: MessageType;
}

export type FileChunkMessage = {
    type: MessageType;
    chunkIndex: number;
    chunkData: Buffer;
}

export type FileChunkAckMessage = {
    type: MessageType;
    ackIndex: number;
}

export type FileEndMessage = {
    type: MessageType;
}


export type FilePauseMessage = {
    type: MessageType;
    fileId: string;
}

export type FilePauseAckMessage = {
    type: MessageType;
    fileId: string;
    success: boolean;
}

export type FileResumeMessage = {
    type: MessageType;
    fileId: string;
}

export type FileResumeAckMessage = {
    type: MessageType;
    fileId: string;
    success: boolean;
    lastChunkIndex: number;  // 最后一个分片索引
}



export type FileCancelMessage = {
    type: MessageType;
    fileId: string;
}

export type FileCancelAckMessage = {
    type: MessageType;
    fileId: string;
    success: boolean;
}


//只有服务端能发
export type FileControlMessage = {
    type: MessageType;
    controlType: number; // 服务端控制类型
    fileId: string;
}



export type FileMessage = FileStartMessage | FileStartAckMessage | FileChunkMessage | FileChunkAckMessage | FileEndMessage | FilePauseMessage | FilePauseAckMessage | FileResumeMessage | FileResumeAckMessage | FileCancelMessage | FileCancelAckMessage | FileControlMessage;

const MAGIC_NUMBER = 0x46544D53; // "FTMS"
const HEADER_SIZE = 32;

export class MessageCodec {
    static readonly MAGIC_NUMBER = MAGIC_NUMBER;
    static readonly HEADER_SIZE = HEADER_SIZE;

    /**
     * 编码消息为 Buffer
     * @param message 消息对象
     * @returns 编码后的 Buffer
     */
    static encodeMessage(message: FileMessage): Buffer {
        switch (message.type) {
            case MessageType.FILE_START: {
                const filenameBuffer = Buffer.from((message as FileStartMessage).filename, 'utf8');
                const filenameLength = filenameBuffer.length;
                const fileIdBuffer = Buffer.from((message as FileStartMessage).fileId, 'utf8');
                const fileIdLength = fileIdBuffer.length;

                const fileStartBuffer = Buffer.alloc(HEADER_SIZE + filenameLength + fileIdLength);
                fileStartBuffer.writeUInt32BE(MAGIC_NUMBER, 0);
                fileStartBuffer.writeUInt32BE(MessageType.FILE_START, 4);
                fileStartBuffer.writeUInt32BE(filenameLength, 8);
                fileStartBuffer.writeUInt32BE((message as FileStartMessage).fileSize, 12);
                fileStartBuffer.writeUInt32BE(fileIdLength, 16);
                // 预留字段填充为0
                fileStartBuffer.writeUInt32BE(0, 20);
                fileStartBuffer.writeUInt32BE(0, 24);
                fileStartBuffer.writeUInt32BE(0, 28);
                filenameBuffer.copy(fileStartBuffer, HEADER_SIZE);
                fileIdBuffer.copy(fileStartBuffer, HEADER_SIZE + filenameLength);   
                return fileStartBuffer;
            }
            case MessageType.FILE_START_ACK: {
                const fileStartAckBuffer = Buffer.alloc(HEADER_SIZE);
                fileStartAckBuffer.writeUInt32BE(MAGIC_NUMBER, 0);
                fileStartAckBuffer.writeUInt32BE(MessageType.FILE_START_ACK, 4);
                fileStartAckBuffer.writeUInt32BE(0, 8);
                fileStartAckBuffer.writeUInt32BE(0, 12);
                // 填充额外的头部字节为0
                fileStartAckBuffer.writeUInt32BE(0, 16);
                fileStartAckBuffer.writeUInt32BE(0, 20);
                fileStartAckBuffer.writeUInt32BE(0, 24);
                fileStartAckBuffer.writeUInt32BE(0, 28);
                return fileStartAckBuffer;
            }
            case MessageType.FILE_CHUNK: {
                const chunkLength = (message as FileChunkMessage).chunkData.length;

                const fileChunkBuffer = Buffer.alloc(HEADER_SIZE + chunkLength);
                fileChunkBuffer.writeUInt32BE(MAGIC_NUMBER, 0);
                fileChunkBuffer.writeUInt32BE(MessageType.FILE_CHUNK, 4);
                fileChunkBuffer.writeUInt32BE((message as FileChunkMessage).chunkIndex, 8);
                fileChunkBuffer.writeUInt32BE(chunkLength, 12);
                // 填充额外的头部字节为0
                fileChunkBuffer.writeUInt32BE(0, 16);
                fileChunkBuffer.writeUInt32BE(0, 20);
                fileChunkBuffer.writeUInt32BE(0, 24);
                fileChunkBuffer.writeUInt32BE(0, 28);
                (message as FileChunkMessage).chunkData.copy(fileChunkBuffer, HEADER_SIZE);
                return fileChunkBuffer;
            }
            case MessageType.FILE_CHUNK_ACK: {
                const fileAckBuffer = Buffer.alloc(HEADER_SIZE);
                fileAckBuffer.writeUInt32BE(MAGIC_NUMBER, 0);
                fileAckBuffer.writeUInt32BE(MessageType.FILE_CHUNK_ACK, 4);
                fileAckBuffer.writeUInt32BE((message as FileChunkAckMessage).ackIndex, 8);
                fileAckBuffer.writeUInt32BE(0, 12);
                // 填充额外的头部字节为0
                fileAckBuffer.writeUInt32BE(0, 16);
                fileAckBuffer.writeUInt32BE(0, 20);
                fileAckBuffer.writeUInt32BE(0, 24);
                fileAckBuffer.writeUInt32BE(0, 28);
                return fileAckBuffer;
            }
            case MessageType.FILE_END: {
                const fileEndBuffer = Buffer.alloc(HEADER_SIZE);
                fileEndBuffer.writeUInt32BE(MAGIC_NUMBER, 0);
                fileEndBuffer.writeUInt32BE(MessageType.FILE_END, 4);
                fileEndBuffer.writeUInt32BE(0, 8);
                fileEndBuffer.writeUInt32BE(0, 12);
                // 填充额外的头部字节为0
                fileEndBuffer.writeUInt32BE(0, 16);
                fileEndBuffer.writeUInt32BE(0, 20);
                fileEndBuffer.writeUInt32BE(0, 24);
                fileEndBuffer.writeUInt32BE(0, 28);
                return fileEndBuffer;
            }
      
        
            case MessageType.FILE_PAUSE_ACK: {
                const pauseAckIdBuffer = Buffer.from((message as FilePauseAckMessage).fileId, 'utf8');
                const pauseAckIdLength = pauseAckIdBuffer.length;

                const filePauseAckBuffer = Buffer.alloc(HEADER_SIZE + pauseAckIdLength);
                filePauseAckBuffer.writeUInt32BE(MAGIC_NUMBER, 0);
                filePauseAckBuffer.writeUInt32BE(MessageType.FILE_PAUSE_ACK, 4);
                filePauseAckBuffer.writeUInt32BE(pauseAckIdLength, 8);
                filePauseAckBuffer.writeUInt32BE(0, 12);
                // 填充额外的头部字节为0
                filePauseAckBuffer.writeUInt32BE(0, 16);
                filePauseAckBuffer.writeUInt32BE(0, 20);
                filePauseAckBuffer.writeUInt32BE(0, 24);
                filePauseAckBuffer.writeUInt32BE(0, 28);
                pauseAckIdBuffer.copy(filePauseAckBuffer, HEADER_SIZE);
                return filePauseAckBuffer;
            }
            case MessageType.FILE_RESUME_ACK: {
                const resumeAckIdBuffer = Buffer.from((message as FileResumeAckMessage).fileId, 'utf8');
                const resumeAckIdLength = resumeAckIdBuffer.length;

                const fileResumeAckBuffer = Buffer.alloc(HEADER_SIZE + resumeAckIdLength);
                fileResumeAckBuffer.writeUInt32BE(MAGIC_NUMBER, 0);
                fileResumeAckBuffer.writeUInt32BE(MessageType.FILE_RESUME_ACK, 4);
                fileResumeAckBuffer.writeUInt32BE(resumeAckIdLength, 8);
                fileResumeAckBuffer.writeUInt32BE((message as FileResumeAckMessage).lastChunkIndex, 12);
                // 填充额外的头部字节为0
                fileResumeAckBuffer.writeUInt32BE(0, 16);
                fileResumeAckBuffer.writeUInt32BE(0, 20);
                fileResumeAckBuffer.writeUInt32BE(0, 24);
                fileResumeAckBuffer.writeUInt32BE(0, 28);
                resumeAckIdBuffer.copy(fileResumeAckBuffer, HEADER_SIZE);
                return fileResumeAckBuffer;
            }
            case MessageType.FILE_CANCEL_ACK: {
                const cancelAckIdBuffer = Buffer.from((message as FileCancelAckMessage).fileId, 'utf8');
                const cancelAckIdLength = cancelAckIdBuffer.length;

                const fileCancelAckBuffer = Buffer.alloc(HEADER_SIZE + cancelAckIdLength);
                fileCancelAckBuffer.writeUInt32BE(MAGIC_NUMBER, 0);
                fileCancelAckBuffer.writeUInt32BE(MessageType.FILE_CANCEL_ACK, 4);
                fileCancelAckBuffer.writeUInt32BE(cancelAckIdLength, 8);
                fileCancelAckBuffer.writeUInt32BE((message as FileCancelAckMessage).success ? 1 : 0, 12);
                // 填充额外的头部字节为0
                fileCancelAckBuffer.writeUInt32BE(0, 16);
                fileCancelAckBuffer.writeUInt32BE(0, 20);
                fileCancelAckBuffer.writeUInt32BE(0, 24);
                fileCancelAckBuffer.writeUInt32BE(0, 28);
                cancelAckIdBuffer.copy(fileCancelAckBuffer, HEADER_SIZE);
                return fileCancelAckBuffer;
            }
            case MessageType.FILE_CONTROL: {
                const controlIdBuffer = Buffer.from((message as FileControlMessage).fileId, 'utf8');
                const controlIdLength = controlIdBuffer.length;

                const fileControlBuffer = Buffer.alloc(HEADER_SIZE + controlIdLength);
                fileControlBuffer.writeUInt32BE(MAGIC_NUMBER, 0);
                fileControlBuffer.writeUInt32BE(MessageType.FILE_CONTROL, 4);
                fileControlBuffer.writeUInt32BE(controlIdLength, 8);
                fileControlBuffer.writeUInt32BE((message as FileControlMessage).controlType, 12);
                // 填充额外的头部字节为0
                fileControlBuffer.writeUInt32BE(0, 16);
                fileControlBuffer.writeUInt32BE(0, 20);
                fileControlBuffer.writeUInt32BE(0, 24);
                fileControlBuffer.writeUInt32BE(0, 28);
                controlIdBuffer.copy(fileControlBuffer, HEADER_SIZE);
                return fileControlBuffer;
            }
            case MessageType.FILE_PAUSE: {
                const pauseIdBuffer = Buffer.from((message as FilePauseMessage).fileId, 'utf8');
                const pauseIdLength = pauseIdBuffer.length;

                const filePauseBuffer = Buffer.alloc(HEADER_SIZE + pauseIdLength);
                filePauseBuffer.writeUInt32BE(MAGIC_NUMBER, 0);
                filePauseBuffer.writeUInt32BE(MessageType.FILE_PAUSE, 4);
                filePauseBuffer.writeUInt32BE(pauseIdLength, 8);
                filePauseBuffer.writeUInt32BE(0, 12);
                // 填充额外的头部字节为0
                filePauseBuffer.writeUInt32BE(0, 16);
                filePauseBuffer.writeUInt32BE(0, 20);
                filePauseBuffer.writeUInt32BE(0, 24);
                filePauseBuffer.writeUInt32BE(0, 28);
                pauseIdBuffer.copy(filePauseBuffer, HEADER_SIZE);
                return filePauseBuffer;
            }
            case MessageType.FILE_RESUME: {
                const resumeIdBuffer = Buffer.from((message as FileResumeMessage).fileId, 'utf8');
                const resumeIdLength = resumeIdBuffer.length;

                const fileResumeBuffer = Buffer.alloc(HEADER_SIZE + resumeIdLength);
                fileResumeBuffer.writeUInt32BE(MAGIC_NUMBER, 0);
                fileResumeBuffer.writeUInt32BE(MessageType.FILE_RESUME, 4);
                fileResumeBuffer.writeUInt32BE(resumeIdLength, 8);
                fileResumeBuffer.writeUInt32BE(0, 12);
                // 填充额外的头部字节为0
                fileResumeBuffer.writeUInt32BE(0, 16);
                fileResumeBuffer.writeUInt32BE(0, 20);
                fileResumeBuffer.writeUInt32BE(0, 24);
                fileResumeBuffer.writeUInt32BE(0, 28);
                resumeIdBuffer.copy(fileResumeBuffer, HEADER_SIZE);
                return fileResumeBuffer;
            }
            case MessageType.FILE_CANCEL: {
                const cancelIdBuffer = Buffer.from((message as FileCancelMessage).fileId, 'utf8');
                const cancelIdLength = cancelIdBuffer.length;

                const fileCancelBuffer = Buffer.alloc(HEADER_SIZE + cancelIdLength);
                fileCancelBuffer.writeUInt32BE(MAGIC_NUMBER, 0);
                fileCancelBuffer.writeUInt32BE(MessageType.FILE_CANCEL, 4);
                fileCancelBuffer.writeUInt32BE(cancelIdLength, 8);
                fileCancelBuffer.writeUInt32BE(0, 12);
                // 填充额外的头部字节为0
                fileCancelBuffer.writeUInt32BE(0, 16);
                fileCancelBuffer.writeUInt32BE(0, 20);
                fileCancelBuffer.writeUInt32BE(0, 24);
                fileCancelBuffer.writeUInt32BE(0, 28);
                cancelIdBuffer.copy(fileCancelBuffer, HEADER_SIZE);
                return fileCancelBuffer;
            }
            default:
                throw new Error(`Unknown message type`);
        }
    }

    /**
     * 解码 Buffer 为消息对象
     * @param buffer 接收到的 Buffer
     * @returns 解析后的消息对象
     */
    static decodeMessage(buffer: Buffer): FileMessage {
        if (buffer.length < HEADER_SIZE) {
            throw new Error('Message too short');
        }

        const magic = buffer.readUInt32BE(0);
        if (magic !== MAGIC_NUMBER) {
            throw new Error('Invalid magic number');
        }

        if (buffer.length < HEADER_SIZE) {
            throw new Error('Message header too short');
        }
        
        const messageType = buffer.readUInt32BE(4);
        const field1 = buffer.readUInt32BE(8);
        const field2 = buffer.readUInt32BE(12);

        switch (messageType) {
            case MessageType.FILE_START: {
                const filenameLength = field1;
                const fileSize = field2;
                
                // 读取fileId长度（在32字节头部的第16字节位置）
                if (buffer.length < HEADER_SIZE) {
                    throw new Error('Incomplete FILE_START message - header too short');
                }
                const fileIdLength = buffer.readUInt32BE(16);
                
                if (buffer.length < HEADER_SIZE + filenameLength + fileIdLength) {
                    throw new Error('Incomplete FILE_START message - body too short');
                }
                
                const filename = buffer.subarray(HEADER_SIZE, HEADER_SIZE + filenameLength).toString('utf8');
                const fileId = buffer.subarray(HEADER_SIZE + filenameLength, HEADER_SIZE + filenameLength + fileIdLength).toString('utf8');
                
                return { type: MessageType.FILE_START, filename, fileSize, fileId };
            }

            case MessageType.FILE_START_ACK:
                if (buffer.length < HEADER_SIZE) {
                    throw new Error('Incomplete FILE_START_ACK message');
                }
                return { type: MessageType.FILE_START_ACK };

            case MessageType.FILE_CHUNK: {
                const chunkIndex = field1;
                const chunkLength = field2;
                if (buffer.length < HEADER_SIZE + chunkLength) {
                    throw new Error('Incomplete FILE_CHUNK message');
                }
                const chunkData = buffer.subarray(HEADER_SIZE, HEADER_SIZE + chunkLength);
                return { type: MessageType.FILE_CHUNK, chunkIndex, chunkData };
            }

            case MessageType.FILE_CHUNK_ACK: {
                if (buffer.length < HEADER_SIZE) {
                    throw new Error('Incomplete FILE_CHUNK_ACK message');
                }
                const ackIndex = field1;
                return { type: MessageType.FILE_CHUNK_ACK, ackIndex };
            }

            case MessageType.FILE_PAUSE_ACK: {
                const pauseAckIdLength = field1;
                if (buffer.length < HEADER_SIZE + pauseAckIdLength) {
                    throw new Error('Incomplete FILE_PAUSE_ACK message');
                }
                const pauseAckId = buffer.subarray(HEADER_SIZE, HEADER_SIZE + pauseAckIdLength).toString('utf8');
                return { type: MessageType.FILE_PAUSE_ACK, fileId: pauseAckId };
            }

            case MessageType.FILE_RESUME_ACK: {
                const resumeAckIdLength = field1;
                if (buffer.length < HEADER_SIZE + resumeAckIdLength) {
                    throw new Error('Incomplete FILE_RESUME_ACK message');
                }
                const resumeAckId = buffer.subarray(HEADER_SIZE, HEADER_SIZE + resumeAckIdLength).toString('utf8');
                return { type: MessageType.FILE_RESUME_ACK, fileId: resumeAckId, lastChunkIndex: field2 };
            }

            case MessageType.FILE_CANCEL_ACK: {
                const cancelAckIdLength = field1;
                if (buffer.length < HEADER_SIZE + cancelAckIdLength) {
                    throw new Error('Incomplete FILE_CANCEL_ACK message');
                }
                const cancelAckId = buffer.subarray(HEADER_SIZE, HEADER_SIZE + cancelAckIdLength).toString('utf8');
                const success = field2 === 1;
                return { type: MessageType.FILE_CANCEL_ACK, fileId: cancelAckId, success };
            }

            case MessageType.FILE_CONTROL: {
                const controlIdLength = field1;
                const controlType = field2;
                if (buffer.length < HEADER_SIZE + controlIdLength) {
                    throw new Error('Incomplete FILE_CONTROL message');
                }
                const controlId = buffer.subarray(HEADER_SIZE, HEADER_SIZE + controlIdLength).toString('utf8');
                return { type: MessageType.FILE_CONTROL, controlType, fileId: controlId };
            }
         

            case MessageType.FILE_END:
                if (buffer.length < HEADER_SIZE) {
                    throw new Error('Incomplete FILE_END message');
                }
                return { type: MessageType.FILE_END };

            case MessageType.FILE_PAUSE: {
                const pauseIdLength = field1;
                if (buffer.length < HEADER_SIZE + pauseIdLength) {
                    throw new Error('Incomplete FILE_PAUSE message');
                }
                const pauseId = buffer.subarray(HEADER_SIZE, HEADER_SIZE + pauseIdLength).toString('utf8');
                return { type: MessageType.FILE_PAUSE, fileId: pauseId };
            }

            case MessageType.FILE_RESUME: {
                const resumeIdLength = field1;
                if (buffer.length < HEADER_SIZE + resumeIdLength) {
                    throw new Error('Incomplete FILE_RESUME message');
                }
                const resumeId = buffer.subarray(HEADER_SIZE, HEADER_SIZE + resumeIdLength).toString('utf8');
                return { type: MessageType.FILE_RESUME, fileId: resumeId };
            }

            case MessageType.FILE_CANCEL: {
                const cancelIdLength = field1;
                if (buffer.length < HEADER_SIZE + cancelIdLength) {
                    throw new Error('Incomplete FILE_CANCEL message');
                }
                const cancelId = buffer.subarray(HEADER_SIZE, HEADER_SIZE + cancelIdLength).toString('utf8');
                return { type: MessageType.FILE_CANCEL, fileId: cancelId };
            }

            default:
                throw new Error(`Unknown message type: ${messageType}`);
        }
    }
}
