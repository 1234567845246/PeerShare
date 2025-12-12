import { useSystemNotification } from "./Systemnotification";
import { useCustomNotification } from "./Customnotification";
import { useAppSettings } from "../setting/setting";
import { type SystemNotificationOptions  } from '../../common/types';
import { type CustomNotification } from "./Customnotification";
export function notify(options: SystemNotificationOptions | CustomNotification) {
    if(useAppSettings().settings.NotificationType === 'system') {
        options = options as SystemNotificationOptions;
        return useSystemNotification().info(options);
    }else if(useAppSettings().settings.NotificationType === 'custom') {
        options = options as CustomNotification;
        return useCustomNotification().info(options);
    }else{
        console.warn(`Unknown notification type: ${useAppSettings().settings.NotificationType}`);
        return null;
    }

}

export function notifyError(options: SystemNotificationOptions | CustomNotification) {
    if(useAppSettings().settings.NotificationType === 'system') {
        options = options as SystemNotificationOptions;
        return useSystemNotification().error(options);
    }else if(useAppSettings().settings.NotificationType === 'custom') {
        options = options as CustomNotification;
        return useCustomNotification().error(options);
    }else{
        console.warn(`Unknown notification type: ${useAppSettings().settings.NotificationType}`);
        return null;
    }
}

export function notifySuccess(options: SystemNotificationOptions | CustomNotification) {
    if(useAppSettings().settings.NotificationType === 'system') {
        options = options as SystemNotificationOptions;
        return useSystemNotification().success(options);
    }
    else if(useAppSettings().settings.NotificationType === 'custom') {
        options = options as CustomNotification;
        return useCustomNotification().success(options);
    }else{
        console.warn(`Unknown notification type: ${useAppSettings().settings.NotificationType}`);
        return null;
    }
}
