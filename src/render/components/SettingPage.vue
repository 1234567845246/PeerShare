<template>
    <div class="setting-page">
        <h2 class="section-title">
            <i class="fas fa-cog"></i>
            设置
        </h2>

        <div class="card setting-card">
            <div class="form-row">
                <label class="form-label">默认接收端口</label>
                <input type="number" v-model.number="setting.defaultServerPort" class="form-input" min="1" max="65535" />
            </div>

            <div class="form-row">
                <label class="form-label">默认下载地址</label>
                <div class="form-input-row">
                    <input type="text" v-model="setting.defaultDownloadPath" class="form-input"
                        placeholder="请选择或输入默认下载地址" />
                    <button class="btn small" @click="pickDirectory">选择</button>
                </div>
            </div>

            <div class="form-row checkbox-row">
                <input type="checkbox" id="overwrite" v-model="setting.overwriteExistingFiles" />
                <label for="overwrite">是否覆盖原有文件</label>
            </div>
            <div class="form-row checkbox-row">
                <input type="checkbox" id="notifications" v-model="setting.enableNotifications" />
                <label for="notifications">启用通知</label>
            </div>
            <div class="action-row">
                <button class="btn primary" @click="saveSettings">保存</button>
                <button class="btn" @click="resetDefaults">重置为默认</button>
                <span class="status">{{ statusMessage }}</span>
            </div>
        </div>
    </div>
</template>


<script setup lang="ts">
import { reactive, ref, onMounted } from 'vue'

const statusMessage = ref('')

let defaultSettings = {
    overwriteExistingFiles: false,
    enableNotifications: false,
    defaultServerPort: 8080,
    defaultDownloadPath: ''
}

const setting = reactive({ ...defaultSettings })

// 从主进程或 localStorage 加载设置
const loadSettings = async () => {
    try {
        if (window.electronAPI && window.electronAPI.getSettings) {
            const s = await window.electronAPI.getSettings()
            if (s) {
                setting.overwriteExistingFiles = !!s.overwriteExistingFiles
                setting.defaultServerPort = s.defaultServerPort ?? defaultSettings.defaultServerPort
                setting.defaultDownloadPath = s.defaultDownloadPath ?? defaultSettings.defaultDownloadPath
                setting.enableNotifications = !!s.enableNotifications
                statusMessage.value = '已加载设置'
                return
            }
        }

        // fallback: localStorage
        const raw = localStorage.getItem('peershare-settings')
        if (raw) {
            const s = JSON.parse(raw)
            setting.overwriteExistingFiles = !!s.overwriteExistingFiles
            setting.defaultServerPort = s.defaultServerPort ?? defaultSettings.defaultServerPort
            setting.defaultDownloadPath = s.defaultDownloadPath ?? defaultSettings.defaultDownloadPath
            setting.enableNotifications = !!s.enableNotifications
            statusMessage.value = '已加载本地设置'
        }
    } catch (err: any) {
        statusMessage.value = `加载设置失败: ${err?.message || err}`
    }
}

// 选择目录（通过主进程）
const pickDirectory = async () => {
    
    window.showDirectoryPicker().then((files: FileSystemDirectoryHandle) => {

    }).catch((err: any) => {
        statusMessage.value = `选择目录失败: ${err?.message || err}`
    })
}

// 保存设置
const saveSettings = async () => {
    try {
        const payload = {
            overwriteExistingFiles: !!setting.overwriteExistingFiles,
            defaultServerPort: Number(setting.defaultServerPort) || defaultSettings.defaultServerPort,
            defaultDownloadPath: setting.defaultDownloadPath || defaultSettings.defaultDownloadPath,
            enableNotifications: !!setting.enableNotifications
        }

        if (window.electronAPI && window.electronAPI.saveSettings) {
            await window.electronAPI.saveSettings(payload)
            statusMessage.value = '设置已保存'
        } else {
            // fallback: localStorage
            localStorage.setItem('peershare-settings', JSON.stringify(payload))
            statusMessage.value = '设置已保存到本地'
        }
    } catch (err: any) {
        statusMessage.value = `保存失败: ${err?.message || err}`
    }
}

const resetDefaults = () => {
    setting.overwriteExistingFiles = defaultSettings.overwriteExistingFiles;
    setting.defaultServerPort = defaultSettings.defaultServerPort;
    setting.defaultDownloadPath = defaultSettings.defaultDownloadPath;
    setting.enableNotifications = defaultSettings.enableNotifications;
    statusMessage.value = '已恢复默认值'
}

onMounted(() => {
    loadSettings()
})
</script>


<style lang="css" scoped>
.setting-page {
    padding: 20px;
}

.section-title {
    font-size: 20px;
    margin-bottom: 12px;
    display: flex;
    align-items: center;
    color: var(--text-primary);
}

.section-title i {
    margin-right: 10px;
    font-size: 20px
}

.card.setting-card {
    background: var(--bg-card);
    padding: 18px;
    border-radius: 10px;
    box-shadow: var(--shadow-light);
    max-width: 720px;
}

.form-row {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 12px;
    flex-wrap: wrap;
}

.form-label {
    min-width: 120px;
    color: var(--text-primary);
    font-weight: 600;
}

.form-input-row {
    display: flex;
    gap: 8px;
    align-items: center;
    flex: 1
}

.form-input {
    flex: 1;
    padding: 8px 10px;
    border-radius: 6px;
    border: 1px solid var(--border-color);
    background: transparent
}

.checkbox-row {
    align-items: center
}

.action-row {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-top: 8px
}

.status {
    color: var(--text-secondary);
    margin-left: 8px
}

.btn {
    padding: 8px 12px;
    border-radius: 6px;
    border: none;
    cursor: pointer;
    background: var(--bg-button-muted);
    color: var(--text-light)
}

.btn.small {
    padding: 6px 8px;
    font-size: 13px
}

.btn.primary {
    background: var(--bg-button)
}

@media (max-width: 768px) {
    .form-label {
        min-width: 100%;
    }

    .form-row {
        flex-direction: column;
        align-items: stretch
    }

    .form-input-row {
        width: 100%
    }
}
</style>