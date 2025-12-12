import { type BrowserWindow, Menu, Tray } from "electron";
import { join } from "path";


class SystemTray{
    private tray :Tray;
    constructor(private mainwindows:BrowserWindow){
        this.tray = new Tray(join(__dirname,'icon.png'));
        this.tray.setToolTip('Peershare');
        this.tray.setContextMenu(Menu.buildFromTemplate([{
            label:'退出',
            role:'quit'
        }]))
        this.tray.on('double-click',()=>{
            if(this.mainwindows.isMinimized() || !this.mainwindows.isFocused()){
                this.mainwindows.show();
            }
        })
    }
    public destory(){
        if(!this.tray.isDestroyed()){
            this.tray.destroy();
        }
    }

    public setTitle(title:string){
        this.tray.setTitle(title);
    }


}

export default SystemTray;