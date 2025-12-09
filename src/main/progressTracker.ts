import { BrowserWindow, type ProgressBarOptions } from 'electron';

class ProgressTracker {
    private mainWindow: BrowserWindow;

    constructor(mainWindow: BrowserWindow) {
        this.mainWindow = mainWindow;
    }

    public updateProgress(progress: number,mode:ProgressBarOptions = { mode: 'normal' }) {
        if (progress >= 0 && progress <= 1) {
            this.mainWindow.setProgressBar(progress,mode);
        }
    }

    public completeProgress(mode:ProgressBarOptions = { mode: 'none' }) {
        this.mainWindow.setProgressBar(-1, mode);
    }
}

export default ProgressTracker;