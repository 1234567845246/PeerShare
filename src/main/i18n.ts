import { app } from 'electron';
import {existsSync, readFileSync} from 'fs';
import {join} from 'path';

class I18n {
  private locale: string;
  private messages: Record<string, string>;
  private static instance: I18n | null = null;

  public static getInstance(): I18n {
    if (!this.instance) {
      this.instance = new I18n();
    }
    return this.instance;
  }
  private constructor() {
    this.locale = app.getLocale();
    this.messages = {};
    this.loadMessages();
  }
      

  private loadMessages(): void {
    try {
      const localesPath = join(__dirname, '../locales');
      const filePath = join(localesPath, `${this.locale}.json`);
      
      if (existsSync(filePath)) {
        const data = readFileSync(filePath, 'utf-8');
        this.messages = JSON.parse(data);
      } else {
        // Fallback to default language (e.g., English)
        const defaultFilePath = join(localesPath, 'en.json');
        if (existsSync(defaultFilePath)) {
          const data = readFileSync(defaultFilePath, 'utf-8');
          this.messages = JSON.parse(data);
        }
      }
    } catch (error) {
      console.error('Failed to load locale messages:', error);
    }
  }

  public t(key: string, params?: Record<string, string | number>): string {
    let message = this.messages[key] || key;
    
    if (params) {
      // Handle named interpolation like {name}
      for (const [paramKey, paramValue] of Object.entries(params)) {
        const placeholder = `{${paramKey}}`;
        message = message.replace(new RegExp(placeholder, 'g'), String(paramValue));
      }
    }
    
    return message;
  }

  public setLocale(locale: string): void {
    this.locale = locale;
    this.loadMessages();
  }

  public getLocale(): string {
    return this.locale;
  }
}

// Create a singleton instance
export const i18n = I18n.getInstance();
