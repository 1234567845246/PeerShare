import { type BrowserWindow, Menu, Tray } from "electron";
import { join } from "path";
import { i18n } from "./i18n";


class SystemTray{
    private tray :Tray;
    constructor(private mainwindows:BrowserWindow){
        this.tray = new Tray(join(__dirname,'icon.png'));
        this.tray.setToolTip(i18n.t('title'));
        this.tray.setContextMenu(Menu.buildFromTemplate([{
            label:i18n.t('tray.exit'),
            role:'quit'
        }]))
        this.tray.on('double-click',()=>{
            if(this.mainwindows.isMinimized() || !this.mainwindows.isFocused()){
                this.mainwindows.show();
            }
        })
    }
    public destroy(){
        if(!this.tray.isDestroyed()){
            this.tray.destroy();
        }
    }

    public changelang(){
        this.tray.setToolTip(i18n.t('title'));
        this.tray.setContextMenu(Menu.buildFromTemplate([{
            role:'quit',
            label:i18n.t('tray.exit')
        }]))
    }


}

export default SystemTray;