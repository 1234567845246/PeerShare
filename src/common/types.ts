export type ServerTransferStatus = {
    type: 'transfer-start',
    clientId: string;
    filename: string;
    filepath: string;
    filesize: number;
    fileId: string;
    message: string;
} | {
    type: 'transfer-progress',
    clientId: string;
    fileId: string;
    progress: number;
    message: string;
    receiveRate: number; // 接收速率 (bytes/second)
} | {
    type: 'transfer-complete',
    clientId: string;
    fileId: string;
    message: string;
} | {
    type: 'transfer-error',
    clientId: string;
    fileId: string;
    message: string;
} | {
    type: 'transfer-pause',
    clientId: string;
    fileId: string;
    message: string;
} | {
    type: 'transfer-resume',
    clientId: string;
    fileId: string;
    message: string;
} | {
    type: 'transfer-cancel',
    clientId: string;
    fileId: string;
    message: string;
} | {
    type: 'transfer-close';
    clientId: string;
    fileId: string;
    message: string;
}

export type ClientTransferStatus = {
    type: 'transfer-start',
    fileId: string;
    filePath: string;
    message: string;
} | {
    type: 'transfer-progress',
    message: string;
    progress: number;
    fileId: string;
    filePath: string;
    transferRate?: number;
} | {
    type: 'transfer-complete',
    fileId: string;
    filePath: string;
    message: string;
} | {
    type: 'transfer-error',
    fileId: string;
    filePath: string;
    message: string;
} | {
    type: 'transfer-pause',
    fileId: string;
    filePath: string;
    message: string;
} | {
    type: 'transfer-resume',
    fileId: string;
    filePath: string;
    message: string;
} | {
    type: 'transfer-cancel',
    fileId: string;
    filePath: string;
    message: string;
} | {
    type: 'transfer-close',
    fileId: string;
    filePath: string;   
    message:string;
}


export type Language = 'zh' | 'en' | 'ja';

export interface AppSettings {
    overwriteExistingFiles: boolean;
    defaultServerPort: number;
    defaultDownloadPath: string;
    NotificationType: 'system' | 'custom' | 'none';
    exitOrMinimizeToTray: boolean;
    language: Language;
}

export interface SystemNotificationOptions {
    title: string;
    body: string;
    icon?: string;
    silent?: boolean;
    requireInteraction?: boolean;
    tag?: string;
    timestamp?: number;
}



export type NotificationType = 'info' | 'error' | 'success';



export interface SelectOption {
    value: string | number;
    label: string;
    description?: string;
    disabled?: boolean;
    default?: boolean;
}

export interface SelectProps {
    modelValue?: string | number;
    options?: SelectOption[];
    placeholder?: string;
    disabled?: boolean;
    clearable?: boolean;
    filterable?: boolean;
    size?: 'small' | 'medium' | 'large';
    width?: string;
    showDescription?: boolean;
}

export interface SelectEmits {
    (e: 'update:modelValue', value: string | number): void;
    (e: 'change', value: string | number, option: SelectOption): void;
    (e: 'clear'): void;
    (e: 'visible-change', visible: boolean): void;
}

export interface OptionProps {
    value: string | number;
    label: string;
    description?: string;
    disabled?: boolean;
    default?: boolean
}