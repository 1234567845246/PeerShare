import { reactive, unref } from 'vue'
import { type AppSettings } from '../../common/types';

const defaultSettings: AppSettings = await window.electronAPI.getdefaultSettings();

const appSettings = reactive<AppSettings>(await window.electronAPI.getSettings() || defaultSettings);

export function useAppSettings() {
    const updateSettings = (partial: Partial<AppSettings>) => {
        Object.assign(appSettings, partial)
    }

    const resetSettings = () => {
        Object.assign(appSettings, defaultSettings)
    }
    
    const saveSettings = async () => {
        let setting:AppSettings = {
            defaultServerPort: unref(appSettings).defaultServerPort,
            overwriteExistingFiles: unref(appSettings).overwriteExistingFiles,
            defaultDownloadPath: unref(appSettings).defaultDownloadPath,
            NotificationType: unref(appSettings).NotificationType,
            exitOrMinimizeToTray: unref(appSettings).exitOrMinimizeToTray
        }
        const result = await window.electronAPI.saveSettings(setting);
        console.log('Settings saved:', result);
        return result;
    }

    return {
        settings: appSettings,
        updateSettings,
        resetSettings,
        saveSettings
    }
}