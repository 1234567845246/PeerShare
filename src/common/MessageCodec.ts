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
    filename: string;
}

export type FilePauseAckMessage = {
    type: MessageType;
    filename: string;
    success: boolean;
}

export type FileResumeMessage = {
    type: MessageType;
    filename: string;
}

export type FileResumeAckMessage = {
    type: MessageType;
    filename: string;
    success: boolean;
    lastChunkIndex: number;  // 最后一个分片索引
}



export type FileCancelMessage = {
    type: MessageType;
    filename: string;
}

export type FileCancelAckMessage = {
    type: MessageType;
    filename: string;
    success: boolean;
}


//只有服务端能发
export type FileControlMessage = {
    type: MessageType;
    controlType: number; // 服务端控制类型
    filename: string;
}

//程序退出，收到对端的关闭文件传输请求.直接断开连接
export type FileCloseMessage = {
    type: MessageType;
}

export type FileMessage = FileStartMessage | FileStartAckMessage | FileChunkMessage | FileChunkAckMessage | FileEndMessage | FileCloseMessage | FilePauseMessage | FilePauseAckMessage | FileResumeMessage | FileResumeAckMessage | FileCancelMessage | FileCancelAckMessage | FileControlMessage;

const MAGIC_NUMBER = 0x46544D53; // "FTMS"
const HEADER_SIZE = 16;

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

                const fileStartBuffer = Buffer.alloc(HEADER_SIZE + filenameLength);
                fileStartBuffer.writeUInt32BE(MAGIC_NUMBER, 0);
                fileStartBuffer.writeUInt32BE(MessageType.FILE_START, 4);
                fileStartBuffer.writeUInt32BE(filenameLength, 8);
                fileStartBuffer.writeUInt32BE((message as FileStartMessage).fileSize, 12);
                filenameBuffer.copy(fileStartBuffer, HEADER_SIZE);
                return fileStartBuffer;
            }
            case MessageType.FILE_START_ACK: {
                const fileStartAckBuffer = Buffer.alloc(HEADER_SIZE);
                fileStartAckBuffer.writeUInt32BE(MAGIC_NUMBER, 0);
                fileStartAckBuffer.writeUInt32BE(MessageType.FILE_START_ACK, 4);
                fileStartAckBuffer.writeUInt32BE(0, 8);
                fileStartAckBuffer.writeUInt32BE(0, 12);
                return fileStartAckBuffer;
            }
            case MessageType.FILE_CHUNK: {
                const chunkLength = (message as FileChunkMessage).chunkData.length;

                const fileChunkBuffer = Buffer.alloc(HEADER_SIZE + chunkLength);
                fileChunkBuffer.writeUInt32BE(MAGIC_NUMBER, 0);
                fileChunkBuffer.writeUInt32BE(MessageType.FILE_CHUNK, 4);
                fileChunkBuffer.writeUInt32BE((message as FileChunkMessage).chunkIndex, 8);
                fileChunkBuffer.writeUInt32BE(chunkLength, 12);
                (message as FileChunkMessage).chunkData.copy(fileChunkBuffer, HEADER_SIZE);
                return fileChunkBuffer;
            }
            case MessageType.FILE_CHUNK_ACK: {
                const fileAckBuffer = Buffer.alloc(HEADER_SIZE);
                fileAckBuffer.writeUInt32BE(MAGIC_NUMBER, 0);
                fileAckBuffer.writeUInt32BE(MessageType.FILE_CHUNK_ACK, 4);
                fileAckBuffer.writeUInt32BE((message as FileChunkAckMessage).ackIndex, 8);
                fileAckBuffer.writeUInt32BE(0, 12);
                return fileAckBuffer;
            }
            case MessageType.FILE_END: {
                const fileEndBuffer = Buffer.alloc(HEADER_SIZE);
                fileEndBuffer.writeUInt32BE(MAGIC_NUMBER, 0);
                fileEndBuffer.writeUInt32BE(MessageType.FILE_END, 4);
                fileEndBuffer.writeUInt32BE(0, 8);
                fileEndBuffer.writeUInt32BE(0, 12);
                return fileEndBuffer;
            }
      
        
            case MessageType.FILE_PAUSE_ACK: {
                const pauseAckFilenameBuffer = Buffer.from((message as FilePauseAckMessage).filename, 'utf8');
                const pauseAckFilenameLength = pauseAckFilenameBuffer.length;

                const filePauseAckBuffer = Buffer.alloc(HEADER_SIZE + pauseAckFilenameLength);
                filePauseAckBuffer.writeUInt32BE(MAGIC_NUMBER, 0);
                filePauseAckBuffer.writeUInt32BE(MessageType.FILE_PAUSE_ACK, 4);
                filePauseAckBuffer.writeUInt32BE(pauseAckFilenameLength, 8);
                filePauseAckBuffer.writeUInt32BE(0, 12);
                pauseAckFilenameBuffer.copy(filePauseAckBuffer, HEADER_SIZE);
                return filePauseAckBuffer;
            }
            case MessageType.FILE_RESUME_ACK: {
                const resumeAckFilenameBuffer = Buffer.from((message as FileResumeAckMessage).filename, 'utf8');
                const resumeAckFilenameLength = resumeAckFilenameBuffer.length;

                const fileResumeAckBuffer = Buffer.alloc(HEADER_SIZE + resumeAckFilenameLength);
                fileResumeAckBuffer.writeUInt32BE(MAGIC_NUMBER, 0);
                fileResumeAckBuffer.writeUInt32BE(MessageType.FILE_RESUME_ACK, 4);
                fileResumeAckBuffer.writeUInt32BE(resumeAckFilenameLength, 8);
                fileResumeAckBuffer.writeUInt32BE((message as FileResumeAckMessage).lastChunkIndex, 12);
                resumeAckFilenameBuffer.copy(fileResumeAckBuffer, HEADER_SIZE);
                return fileResumeAckBuffer;
            }
            case MessageType.FILE_CANCEL_ACK: {
                const cancelAckFilenameBuffer = Buffer.from((message as FileCancelAckMessage).filename, 'utf8');
                const cancelAckFilenameLength = cancelAckFilenameBuffer.length;

                const fileCancelAckBuffer = Buffer.alloc(HEADER_SIZE + cancelAckFilenameLength);
                fileCancelAckBuffer.writeUInt32BE(MAGIC_NUMBER, 0);
                fileCancelAckBuffer.writeUInt32BE(MessageType.FILE_CANCEL_ACK, 4);
                fileCancelAckBuffer.writeUInt32BE(cancelAckFilenameLength, 8);
                fileCancelAckBuffer.writeUInt32BE((message as FileCancelAckMessage).success ? 1 : 0, 12);
                cancelAckFilenameBuffer.copy(fileCancelAckBuffer, HEADER_SIZE);
                return fileCancelAckBuffer;
            }
            case MessageType.FILE_CONTROL: {
                const controlFilenameBuffer = Buffer.from((message as FileControlMessage).filename, 'utf8');
                const controlFilenameLength = controlFilenameBuffer.length;

                const fileControlBuffer = Buffer.alloc(HEADER_SIZE + controlFilenameLength);
                fileControlBuffer.writeUInt32BE(MAGIC_NUMBER, 0);
                fileControlBuffer.writeUInt32BE(MessageType.FILE_CONTROL, 4);
                fileControlBuffer.writeUInt32BE(controlFilenameLength, 8);
                fileControlBuffer.writeUInt32BE((message as FileControlMessage).controlType, 12);
                controlFilenameBuffer.copy(fileControlBuffer, HEADER_SIZE);
                return fileControlBuffer;
            }
            case MessageType.FILE_PAUSE: {
                const pauseFilenameBuffer = Buffer.from((message as FilePauseMessage).filename, 'utf8');
                const pauseFilenameLength = pauseFilenameBuffer.length;

                const filePauseBuffer = Buffer.alloc(HEADER_SIZE + pauseFilenameLength);
                filePauseBuffer.writeUInt32BE(MAGIC_NUMBER, 0);
                filePauseBuffer.writeUInt32BE(MessageType.FILE_PAUSE, 4);
                filePauseBuffer.writeUInt32BE(pauseFilenameLength, 8);
                filePauseBuffer.writeUInt32BE(0, 12);
                pauseFilenameBuffer.copy(filePauseBuffer, HEADER_SIZE);
                return filePauseBuffer;
            }
            case MessageType.FILE_RESUME: {
                const resumeFilenameBuffer = Buffer.from((message as FileResumeMessage).filename, 'utf8');
                const resumeFilenameLength = resumeFilenameBuffer.length;

                const fileResumeBuffer = Buffer.alloc(HEADER_SIZE + resumeFilenameLength);
                fileResumeBuffer.writeUInt32BE(MAGIC_NUMBER, 0);
                fileResumeBuffer.writeUInt32BE(MessageType.FILE_RESUME, 4);
                fileResumeBuffer.writeUInt32BE(resumeFilenameLength, 8);
                fileResumeBuffer.writeUInt32BE(0, 12);
                resumeFilenameBuffer.copy(fileResumeBuffer, HEADER_SIZE);
                return fileResumeBuffer;
            }
            case MessageType.FILE_CANCEL: {
                const cancelFilenameBuffer = Buffer.from((message as FileCancelMessage).filename, 'utf8');
                const cancelFilenameLength = cancelFilenameBuffer.length;

                const fileCancelBuffer = Buffer.alloc(HEADER_SIZE + cancelFilenameLength);
                fileCancelBuffer.writeUInt32BE(MAGIC_NUMBER, 0);
                fileCancelBuffer.writeUInt32BE(MessageType.FILE_CANCEL, 4);
                fileCancelBuffer.writeUInt32BE(cancelFilenameLength, 8);
                fileCancelBuffer.writeUInt32BE(0, 12);
                cancelFilenameBuffer.copy(fileCancelBuffer, HEADER_SIZE);
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

        const messageType = buffer.readUInt32BE(4);
        const field1 = buffer.readUInt32BE(8);
        const field2 = buffer.readUInt32BE(12);

        switch (messageType) {
            case MessageType.FILE_START: {
                const filenameLength = field1;
                const fileSize = field2;
                if (buffer.length < HEADER_SIZE + filenameLength) {
                    throw new Error('Incomplete FILE_START message');
                }
                const filename = buffer.subarray(HEADER_SIZE, HEADER_SIZE + filenameLength).toString('utf8');
                return { type: MessageType.FILE_START, filename, fileSize };
            }

            case MessageType.FILE_START_ACK:
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
                const ackIndex = field1;
                return { type: MessageType.FILE_CHUNK_ACK, ackIndex };
            }

            case MessageType.FILE_PAUSE_ACK: {
                const pauseAckFilenameLength = field1;
                if (buffer.length < HEADER_SIZE + pauseAckFilenameLength) {
                    throw new Error('Incomplete FILE_PAUSE_ACK message');
                }
                const pauseAckFilename = buffer.subarray(HEADER_SIZE, HEADER_SIZE + pauseAckFilenameLength).toString('utf8');
                return { type: MessageType.FILE_PAUSE_ACK, filename: pauseAckFilename };
            }

            case MessageType.FILE_RESUME_ACK: {
                const resumeAckFilenameLength = field1;
                if (buffer.length < HEADER_SIZE + resumeAckFilenameLength) {
                    throw new Error('Incomplete FILE_RESUME_ACK message');
                }
                const resumeAckFilename = buffer.subarray(HEADER_SIZE, HEADER_SIZE + resumeAckFilenameLength).toString('utf8');
                return { type: MessageType.FILE_RESUME_ACK, filename: resumeAckFilename, lastChunkIndex: field2 };
            }

            case MessageType.FILE_CANCEL_ACK: {
                const cancelAckFilenameLength = field1;
                if (buffer.length < HEADER_SIZE + cancelAckFilenameLength) {
                    throw new Error('Incomplete FILE_CANCEL_ACK message');
                }
                const cancelAckFilename = buffer.subarray(HEADER_SIZE, HEADER_SIZE + cancelAckFilenameLength).toString('utf8');
                const success = field2 === 1;
                return { type: MessageType.FILE_CANCEL_ACK, filename: cancelAckFilename, success };
            }

            case MessageType.FILE_CONTROL: {
                const controlFilenameLength = field1;
                const controlType = field2;
                if (buffer.length < HEADER_SIZE + controlFilenameLength) {
                    throw new Error('Incomplete FILE_CONTROL message');
                }
                const controlFilename = buffer.subarray(HEADER_SIZE, HEADER_SIZE + controlFilenameLength).toString('utf8');
                return { type: MessageType.FILE_CONTROL, controlType, filename: controlFilename };
            }
         

            case MessageType.FILE_END:
                return { type: MessageType.FILE_END };

            case MessageType.FILE_PAUSE: {
                const pauseFilenameLength = field1;
                if (buffer.length < HEADER_SIZE + pauseFilenameLength) {
                    throw new Error('Incomplete FILE_PAUSE message');
                }
                const pauseFilename = buffer.subarray(HEADER_SIZE, HEADER_SIZE + pauseFilenameLength).toString('utf8');
                return { type: MessageType.FILE_PAUSE, filename: pauseFilename };
            }

            case MessageType.FILE_RESUME: {
                const resumeFilenameLength = field1;
                if (buffer.length < HEADER_SIZE + resumeFilenameLength) {
                    throw new Error('Incomplete FILE_RESUME message');
                }
                const resumeFilename = buffer.subarray(HEADER_SIZE, HEADER_SIZE + resumeFilenameLength).toString('utf8');
                return { type: MessageType.FILE_RESUME, filename: resumeFilename };
            }

            case MessageType.FILE_CANCEL: {
                const cancelFilenameLength = field1;
                if (buffer.length < HEADER_SIZE + cancelFilenameLength) {
                    throw new Error('Incomplete FILE_CANCEL message');
                }
                const cancelFilename = buffer.subarray(HEADER_SIZE, HEADER_SIZE + cancelFilenameLength).toString('utf8');
                return { type: MessageType.FILE_CANCEL, filename: cancelFilename };
            }

            default:
                throw new Error(`Unknown message type: ${messageType}`);
        }
    }
}
