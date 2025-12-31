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
    FOLDER_START: 14, //文件夹开始
    FOLDER_START_ACK: 15, //文件夹开始确认
    FOLDER_END: 16, //文件夹结束
    FOLDER_END_ACK: 17, //文件夹结束确认
} as const;


export type MessageType = typeof MessageType[keyof typeof MessageType];

// 消息接口定义
export type FileStartMessage = {
    type: MessageType;
    fileId: string;
    filename: string;
    fileSize: number;
    relativePath?: string; // 文件相对于文件夹根目录的相对路径
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

// 文件夹开始消息
export type FolderStartMessage = {
    type: MessageType;
    folderId: string; // 文件夹唯一ID
    folderName: string; // 文件夹名称
}

// 文件夹开始确认消息
export type FolderStartAckMessage = {
    type: MessageType;
    folderId: string;
}

// 文件夹结束消息
export type FolderEndMessage = {
    type: MessageType;
    folderId: string; // 文件夹唯一ID
    totalFiles: number; // 文件夹内文件总数
    totalSize: number; // 文件夹总大小
}

// 文件夹结束确认消息
export type FolderEndAckMessage = {
    type: MessageType;
    folderId: string;
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



export type FileMessage = FileStartMessage | FileStartAckMessage | FileChunkMessage | FileChunkAckMessage | FileEndMessage | FilePauseMessage | FilePauseAckMessage | FileResumeMessage | FileResumeAckMessage | FileCancelMessage | FileCancelAckMessage | FileControlMessage | FolderStartMessage | FolderStartAckMessage | FolderEndMessage | FolderEndAckMessage;

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
                const relativePathBuffer = Buffer.from((message as FileStartMessage).relativePath || '', 'utf8');
                const relativePathLength = relativePathBuffer.length;

                const fileStartBuffer = Buffer.alloc(HEADER_SIZE + filenameLength + fileIdLength + relativePathLength);
                fileStartBuffer.writeUInt32BE(MAGIC_NUMBER, 0);
                fileStartBuffer.writeUInt32BE(MessageType.FILE_START, 4);
                fileStartBuffer.writeUInt32BE(filenameLength, 8);
                fileStartBuffer.writeUInt32BE((message as FileStartMessage).fileSize, 12);
                fileStartBuffer.writeUInt32BE(fileIdLength, 16);
                fileStartBuffer.writeUInt32BE(relativePathLength, 20);
                fileStartBuffer.writeUInt32BE(0, 24);
                fileStartBuffer.writeUInt32BE(0, 28);
                filenameBuffer.copy(fileStartBuffer, HEADER_SIZE);
                fileIdBuffer.copy(fileStartBuffer, HEADER_SIZE + filenameLength);   
                relativePathBuffer.copy(fileStartBuffer, HEADER_SIZE + filenameLength + fileIdLength);
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
            case MessageType.FOLDER_START: {
                const folderIdBuffer = Buffer.from((message as FolderStartMessage).folderId, 'utf8');
                const folderIdLength = folderIdBuffer.length;
                const folderNameBuffer = Buffer.from((message as FolderStartMessage).folderName, 'utf8');
                const folderNameLength = folderNameBuffer.length;

                const folderStartBuffer = Buffer.alloc(HEADER_SIZE + folderIdLength + folderNameLength);
                folderStartBuffer.writeUInt32BE(MAGIC_NUMBER, 0);
                folderStartBuffer.writeUInt32BE(MessageType.FOLDER_START, 4);
                folderStartBuffer.writeUInt32BE(folderIdLength, 8);
                folderStartBuffer.writeUInt32BE(folderNameLength, 12);
                folderStartBuffer.writeUInt32BE(0, 16);
                folderStartBuffer.writeUInt32BE(0, 20);
                folderStartBuffer.writeUInt32BE(0, 24);
                folderStartBuffer.writeUInt32BE(0, 28);
                folderIdBuffer.copy(folderStartBuffer, HEADER_SIZE);
                folderNameBuffer.copy(folderStartBuffer, HEADER_SIZE + folderIdLength);
                return folderStartBuffer;
            }
            case MessageType.FOLDER_START_ACK: {
                const folderAckIdBuffer = Buffer.from((message as FolderStartAckMessage).folderId, 'utf8');
                const folderAckIdLength = folderAckIdBuffer.length;

                const folderStartAckBuffer = Buffer.alloc(HEADER_SIZE + folderAckIdLength);
                folderStartAckBuffer.writeUInt32BE(MAGIC_NUMBER, 0);
                folderStartAckBuffer.writeUInt32BE(MessageType.FOLDER_START_ACK, 4);
                folderStartAckBuffer.writeUInt32BE(folderAckIdLength, 8);
                folderStartAckBuffer.writeUInt32BE(0, 12);
                folderStartAckBuffer.writeUInt32BE(0, 16);
                folderStartAckBuffer.writeUInt32BE(0, 20);
                folderStartAckBuffer.writeUInt32BE(0, 24);
                folderStartAckBuffer.writeUInt32BE(0, 28);
                folderAckIdBuffer.copy(folderStartAckBuffer, HEADER_SIZE);
                return folderStartAckBuffer;
            }
            case MessageType.FOLDER_END: {
                const folderEndIdBuffer = Buffer.from((message as FolderEndMessage).folderId, 'utf8');
                const folderEndIdLength = folderEndIdBuffer.length;

                const folderEndBuffer = Buffer.alloc(HEADER_SIZE + folderEndIdLength);
                folderEndBuffer.writeUInt32BE(MAGIC_NUMBER, 0);
                folderEndBuffer.writeUInt32BE(MessageType.FOLDER_END, 4);
                folderEndBuffer.writeUInt32BE(folderEndIdLength, 8);
                folderEndBuffer.writeUInt32BE((message as FolderEndMessage).totalFiles, 12);
                // 使用20-24存储totalSize的高32位，24-28存储低32位（如果需要支持大数字）
                // 这里暂时只存储低32位
                folderEndBuffer.writeUInt32BE(0, 16);
                folderEndBuffer.writeUInt32BE(0, 20);
                folderEndBuffer.writeUInt32BE(0, 24);
                folderEndBuffer.writeUInt32BE((message as FolderEndMessage).totalSize, 28);
                folderEndIdBuffer.copy(folderEndBuffer, HEADER_SIZE);
                return folderEndBuffer;
            }
            case MessageType.FOLDER_END_ACK: {
                const folderEndAckIdBuffer = Buffer.from((message as FolderEndAckMessage).folderId, 'utf8');
                const folderEndAckIdLength = folderEndAckIdBuffer.length;

                const folderEndAckBuffer = Buffer.alloc(HEADER_SIZE + folderEndAckIdLength);
                folderEndAckBuffer.writeUInt32BE(MAGIC_NUMBER, 0);
                folderEndAckBuffer.writeUInt32BE(MessageType.FOLDER_END_ACK, 4);
                folderEndAckBuffer.writeUInt32BE(folderEndAckIdLength, 8);
                folderEndAckBuffer.writeUInt32BE(0, 12);
                folderEndAckBuffer.writeUInt32BE(0, 16);
                folderEndAckBuffer.writeUInt32BE(0, 20);
                folderEndAckBuffer.writeUInt32BE(0, 24);
                folderEndAckBuffer.writeUInt32BE(0, 28);
                folderEndAckIdBuffer.copy(folderEndAckBuffer, HEADER_SIZE);
                return folderEndAckBuffer;
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
                const relativePathLength = buffer.readUInt32BE(20);
                
                if (buffer.length < HEADER_SIZE + filenameLength + fileIdLength + relativePathLength) {
                    throw new Error('Incomplete FILE_START message - body too short');
                }
                
                const filename = buffer.subarray(HEADER_SIZE, HEADER_SIZE + filenameLength).toString('utf8');
                const fileId = buffer.subarray(HEADER_SIZE + filenameLength, HEADER_SIZE + filenameLength + fileIdLength).toString('utf8');
                const relativePath = relativePathLength > 0 ? buffer.subarray(HEADER_SIZE + filenameLength + fileIdLength, HEADER_SIZE + filenameLength + fileIdLength + relativePathLength).toString('utf8') : undefined;
                
                return { type: MessageType.FILE_START, filename, fileSize, fileId, relativePath };
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

            case MessageType.FOLDER_START: {
                const folderIdLength = field1;
                const folderNameLength = field2;
                if (buffer.length < HEADER_SIZE + folderIdLength + folderNameLength) {
                    throw new Error('Incomplete FOLDER_START message');
                }
                const folderId = buffer.subarray(HEADER_SIZE, HEADER_SIZE + folderIdLength).toString('utf8');
                const folderName = buffer.subarray(HEADER_SIZE + folderIdLength, HEADER_SIZE + folderIdLength + folderNameLength).toString('utf8');
                return { type: MessageType.FOLDER_START, folderId, folderName };
            }

            case MessageType.FOLDER_START_ACK: {
                const folderAckIdLength = field1;
                if (buffer.length < HEADER_SIZE + folderAckIdLength) {
                    throw new Error('Incomplete FOLDER_START_ACK message');
                }
                const folderId = buffer.subarray(HEADER_SIZE, HEADER_SIZE + folderAckIdLength).toString('utf8');
                return { type: MessageType.FOLDER_START_ACK, folderId };
            }

            case MessageType.FOLDER_END: {
                const folderEndIdLength = field1;
                const totalFiles = field2;
                const totalSize = buffer.readUInt32BE(28);
                if (buffer.length < HEADER_SIZE + folderEndIdLength) {
                    throw new Error('Incomplete FOLDER_END message');
                }
                const folderId = buffer.subarray(HEADER_SIZE, HEADER_SIZE + folderEndIdLength).toString('utf8');
                return { type: MessageType.FOLDER_END, folderId, totalFiles, totalSize };
            }

            case MessageType.FOLDER_END_ACK: {
                const folderEndAckIdLength = field1;
                if (buffer.length < HEADER_SIZE + folderEndAckIdLength) {
                    throw new Error('Incomplete FOLDER_END_ACK message');
                }
                const folderId = buffer.subarray(HEADER_SIZE, HEADER_SIZE + folderEndAckIdLength).toString('utf8');
                return { type: MessageType.FOLDER_END_ACK, folderId };
            }

            default:
                throw new Error(`Unknown message type: ${messageType}`);
        }
    }
}
