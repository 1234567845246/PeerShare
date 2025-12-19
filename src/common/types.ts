export type ServerTransferStatus = {
    type: 'transfer-start',
    clientId: string;
    filename: string;
    filesize: number;
    message: string;
} | {
    type: 'transfer-progress',
    clientId: string;
    filename: string;
    progress: number;
    message: string;
    receiveRate: number; // 接收速率 (bytes/second)
} | {
    type: 'transfer-complete',
    clientId: string;
    filename: string;
    message: string;
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
} | {
    type: 'transfer-close';
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
} | {
    type: 'transfer-close',
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