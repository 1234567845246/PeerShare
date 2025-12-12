import { type SystemNotificationOptions, type NotificationType } from "../../common/types";
import errorIcon from "../assets/error.png"
import normalIcon from "../assets/info.png"
import successIcon from "../assets/success.png"
class NotificationManager {
    private static instance: NotificationManager;

    private constructor() {

    }

    public static getInstance(): NotificationManager {
        if (!NotificationManager.instance) {
            NotificationManager.instance = new NotificationManager();
        }
        return NotificationManager.instance;
    }
    private buildNotification(title: string, option?: Partial<SystemNotificationOptions>, type: NotificationType = 'info'): SystemNotificationOptions {
        const defaultOptions: SystemNotificationOptions = {
            title,
            body: '',
            icon: this.getIcon(type),
            silent: false,
            requireInteraction: type === 'error',
            tag: `${type}-${Date.now()}`,
            timestamp: Date.now(),

        };
        return { ...defaultOptions, ...option, title };
    }
    private getIcon(type: NotificationType): string {
        switch (type) {
            case 'error':
                return errorIcon;
            case 'success':
                return successIcon;
            default:
                return normalIcon;
        }
    }

    private send( option:SystemNotificationOptions, type: NotificationType = 'info'): Notification {
        const SystemNotificationOptions = this.buildNotification(option.title, option, type);
        const notification = new Notification(SystemNotificationOptions.title, SystemNotificationOptions);
        notification.onclick = () => {
            console.log('Notification clicked');
            if (window.focus) {
                window.focus();
            }
        }
        return notification;
    }

    public sendNormal( option: SystemNotificationOptions): Notification {
        return this.send(option, 'info');
    }
    public sendError( option: SystemNotificationOptions): Notification {
        return this.send(option, 'error');
    }

    public sendSuccess( option: SystemNotificationOptions): Notification {
        return this.send(option, 'success');
    }
}

const systemNotificationManager = NotificationManager.getInstance();

export const useSystemNotification = () => {

    return {
        info: ( option: SystemNotificationOptions) => {
            systemNotificationManager.sendNormal( option);
        },
        error: ( option: SystemNotificationOptions) => {

            systemNotificationManager.sendError(option);

        },
        success: ( option: SystemNotificationOptions) => {

            systemNotificationManager.sendSuccess( option);

        }
    };
}