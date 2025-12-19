<template>
    <div class="setting-page">
        <h2 class="section-title">
            <i class="fas fa-cog"></i>
            {{ $t('setting.title') }}
        </h2>

        <div class="card setting-card">
            <div class="form-row">
                <label class="form-label">{{ $t('setting.defaultServerPort') }}</label>
                <input type="number" v-model.number="setting.defaultServerPort" class="form-input" min="1"
                    max="65535" />
            </div>

            <div class="form-row">
                <label class="form-label">{{ $t('setting.defaultDownloadPath') }}</label>
                <div class="form-input-row">
                    <input type="text" v-model="setting.defaultDownloadPath" class="form-input"
                        :placeholder="t('setting.defaultDownloadPathplaceholder')" />
                    <button class="btn small" @click="pickDirectory">{{ $t('setting.choosebtn') }}</button>
                </div>
            </div>

            <div class="form-row checkbox-row">
                <input type="checkbox" id="overwrite" v-model="setting.overwriteExistingFiles" />
                <label for="overwrite">{{ $t('setting.overwriteExistingFiles') }}</label>
            </div>

            <div class="form-row checkbox-row">
                <input type="checkbox" id="tray" v-model="setting.exitOrMinimizeToTray" />
                <label for="tray">{{ $t('setting.exitOrMinimizeToTray') }}</label>
            </div>
            <div class="form-row">
                <label class="form-label">{{ $t('setting.language') }}</label>
                <Select v-model="setting.language" placeholder="选择语言">
                    <Option value="zh" label="简体中文" description="中文简体" default />
                    <Option value="en" label="English" description="English" />
                    <Option value="ja" label="日本語" description="日本語" />
                </Select>
            </div>
            <div class="form-row">
                <label class="form-label">{{ $t('setting.notificationType') }}</label>
                <Select v-model="setting.NotificationType" placeholder="选择通知类型" :key="locale">
                    <Option v-for="(item, index) in notificationTypeopton" :key="index" :value="item.value"
                        :label="item.label" :description="item.description" :default="item.default" />
                </Select>
            </div>
            <div class="action-row">
                <button class="btn primary" @click="saveSettings">{{ $t('setting.save') }}</button>
                <button class="btn" @click="resetDefaults">{{ $t('setting.reset') }}</button>
                <span class="status">{{ statusMessage }}</span>
            </div>
        </div>
    </div>
</template>


<script setup lang="ts">
import { reactive, ref, onMounted, toRefs, watch } from 'vue'
import { useAppSettings } from '../setting/setting'
import Select from './Select.vue'
import Option from './Option.vue'
import { useI18n } from 'vue-i18n'
const { t, locale } = useI18n()

const statusMessage = ref('')

const notificationTypeopton = ref([{
    value: 'system', label: t('setting.notificationTypeoption1'), description: t('setting.notificationTypeoption1desc'), default: false
}, {
    value: 'custom', label: t('setting.notificationTypeoption2'), description: t('setting.notificationTypeoption2desc'), default: false
}, {
    value: 'none', label: t('setting.notificationTypeoption3'), description: t('setting.notificationTypeoption3desc'), default: true
}])

// 监听语言变化，更新选项文本
watch(locale, () => {
    notificationTypeopton.value = [{
        value: 'system', label: t('setting.notificationTypeoption1'), description: t('setting.notificationTypeoption1desc'), default: false
    }, {
        value: 'custom', label: t('setting.notificationTypeoption2'), description: t('setting.notificationTypeoption2desc'), default: false
    }, {
        value: 'none', label: t('setting.notificationTypeoption3'), description: t('setting.notificationTypeoption3desc'), default: true
    }]
})
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
            const dir = await window.electronAPI.chooseDirectory(t('setting.choosedir'))
            if (dir) {
                setting.defaultDownloadPath = dir
            }
        } else {
            statusMessage.value = t('setting.couldNotOpenDirectoryDialog')
        }
    } catch (err: any) {
        statusMessage.value = `选择目录失败: ${err?.message || err}` // Changed from statusMessage.value = `选择目录失败: ${err?.message || err}` to use t function
    }
}

// 保存设置
const saveSettings = async () => {

    if (locale.value !== setting.language) {
        locale.value = setting.language
    }


    useAppSettings().updateSettings({
        overwriteExistingFiles: setting.overwriteExistingFiles,
        defaultServerPort: setting.defaultServerPort,
        defaultDownloadPath: setting.defaultDownloadPath,
        NotificationType: setting.NotificationType,
        exitOrMinimizeToTray: setting.exitOrMinimizeToTray,
        language: setting.language
    })
    let res = await useAppSettings().saveSettings();
    statusMessage.value = res ? t('setting.saveSuccess') : t('setting.saveFailed')
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