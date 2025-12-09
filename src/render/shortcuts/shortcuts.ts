let instance: ShortcutManager | null = null;

export function getShortcutManager(platform?: Platform): ShortcutManager {
    if (!instance) {
        instance = new ShortcutManager(platform);
    }
    return instance;
}

export function destoryShortcutManager(): void {
    if (instance) {
        instance.destroy();
        instance = null;
    }
}


class ShortcutManager {
    private shortcuts: Map<string, ShortcutCallback> = new Map();
    private platform: Platform;

    constructor(platform?: Platform) {
        this.platform = platform || this.detectPlatform();
        this.initializeEventListeners();
    }

    private detectPlatform(): Platform {
        return /mac|iphone|ipod|ipad/i.test(navigator.platform) ? 'mac' : 'win';
    }

    private initializeEventListeners(): void {
        document.addEventListener('keydown', (e) => this.handleKeyPress(e));
    }

    private handleKeyPress(e: KeyboardEvent): void {
        const key = this.buildKeyString(e);
        const callback = this.shortcuts.get(key);
        if (callback) {
            e.preventDefault();
            callback();
        }
    }

    private buildKeyString(e: KeyboardEvent): string {
        const modifiers: string[] = [];
        if (e.ctrlKey || (this.platform === 'mac' && e.metaKey)) modifiers.push('ctrl');
        if (e.altKey) modifiers.push('alt');
        if (e.shiftKey) modifiers.push('shift');
        return `${modifiers.join('+')}+${e.key.toLowerCase()}`;
    }

    public addShortcut(shortcut: string, callback: ShortcutCallback): void {
        this.shortcuts.set(shortcut.toLowerCase(), callback);
    }

    public updateShortcut(shortcut: string, callback: ShortcutCallback): void {
        this.addShortcut(shortcut, callback);
    }

    public removeShortcut(shortcut: string): void {
        this.shortcuts.delete(shortcut.toLowerCase());
    }

    public destroy(): void {
        this.shortcuts.clear();
    }
}

type ShortcutCallback = () => void;
type Platform = 'mac' | 'win';