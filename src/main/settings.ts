
import { app } from "electron";
import { join } from "path";
import { existsSync, readFileSync, writeFileSync } from "fs";
import { type AppSettings } from "../common/types";

app.setPath('userData', join(app.getPath('appData'), 'PeerShare'));
class Settings {
    private readonly settingpath = join(app.getPath('userData'), 'settings.json');
    private static instance: Settings;
    public settingData: AppSettings ;

    static defaultSettings: AppSettings = {
        overwriteExistingFiles: false,
        defaultServerPort: 8080,
        defaultDownloadPath: app.getPath('downloads'),
        NotificationType: 'none',
        exitOrMinimizeToTray: false,
    };

    private constructor() {
        this.settingData = this.getSettingsSync(); // 初始化设置
    }

    static getInstance(): Settings {
        if(!Settings.instance) {
            Settings.instance = new Settings();
        }
        return Settings.instance;
    }

    private getSettingsSync(): AppSettings {
        if(existsSync(this.settingpath)){
            const data = readFileSync(this.settingpath, 'utf-8');
            return JSON.parse(data) as AppSettings;
        }else{
            writeFileSync(this.settingpath, JSON.stringify(Settings.defaultSettings, null, 4), 'utf-8');
            return Settings.defaultSettings;
        }
    }

    public getdefaultSettings(): AppSettings {
        return Settings.defaultSettings;
    }
    public setSettingsSync(settings: AppSettings): void {
        this.settingData = settings;
        writeFileSync(this.settingpath, JSON.stringify(settings, null, 4), 'utf-8');
    }
}

export const settings = Settings.getInstance();