<template>
    <div class="setting-page">
        <h2 class="section-title">
            <i class="fas fa-cog"></i>
            设置
        </h2>

        <div class="card setting-card">
            <div class="form-row">
                <label class="form-label">默认接收端口</label>
                <input type="number" v-model.number="setting.defaultServerPort" class="form-input" min="1"
                    max="65535" />
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
                <input type="checkbox" id="tray" v-model="setting.exitOrMinimizeToTray" />
                <label for="tray">窗口关闭时最小化到系统托盘</label>
            </div>
            <div class="form-row">
                <label class="form-label">语言</label>
                <Select v-model="setting.language" placeholder="选择语言" >
                    <Option value="zh" label="简体中文" description="中文简体" default />
                    <Option value="en" label="English" description="English"  />
                </Select>
            </div>
            <div class="form-row">
                <label class="form-label">通知类型</label>
                <Select v-model="setting.NotificationType" placeholder="选择通知类型" >
                    <Option value="system" label="系统通知" description="使用系统默认的通知方式" />
                    <Option value="custom" label="自定义通知" description="使用自定义的通知样式和行为" />
                    <Option value="none" label="无通知" description="不显示任何通知消息" default/>
                </Select>
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
import { reactive, ref, onMounted, toRefs } from 'vue'
import { useAppSettings } from '../setting/setting'
import Select from './Select.vue'
import Option from './Option.vue'

const statusMessage = ref('')

const setting = reactive(toRefs(useAppSettings().settings))

// 从主进程或 localStorage 加载设置
const loadSettings = async () => {
    setting.defaultServerPort = useAppSettings().settings.defaultServerPort
    setting.defaultDownloadPath = useAppSettings().settings.defaultDownloadPath
    setting.overwriteExistingFiles = useAppSettings().settings.overwriteExistingFiles
    setting.NotificationType = useAppSettings().settings.NotificationType
    setting.exitOrMinimizeToTray = useAppSettings().settings.exitOrMinimizeToTray
    setting.language = useAppSettings().settings.language
}

// 选择目录（通过主进程）
const pickDirectory = async () => {

    try {
        if (window.electronAPI && window.electronAPI.chooseDirectory) {
            const dir = await window.electronAPI.chooseDirectory('选择默认下载目录')
            if (dir) {
                setting.defaultDownloadPath = dir
            }
        } else {
            statusMessage.value = '无法打开目录选择对话框'
        }
    } catch (err: any) {
        statusMessage.value = `选择目录失败: ${err?.message || err}`
    }
}

// 保存设置
const saveSettings = async () => {
    useAppSettings().updateSettings({
        overwriteExistingFiles: setting.overwriteExistingFiles,
        defaultServerPort: setting.defaultServerPort,
        defaultDownloadPath: setting.defaultDownloadPath,
        NotificationType: setting.NotificationType,
        exitOrMinimizeToTray: setting.exitOrMinimizeToTray,
        language: setting.language
    })
    useAppSettings().saveSettings();
}

const resetDefaults = () => {
    useAppSettings().resetSettings();
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
    background-color: transparent;
    color: va;
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
    background-color: var(--bg-button-muted);
    color: var(--text-light)
}

.btn.small {
    padding: 6px 8px;
    font-size: 13px;
    background-color: var(--bg-button);
}

.btn.small:hover {
    background-color: var(--bg-button-hover);
}

.btn.primary {
    background-color: var(--bg-button)
}

.btn.primary:hover {
    background-color: var(--bg-button-hover)
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