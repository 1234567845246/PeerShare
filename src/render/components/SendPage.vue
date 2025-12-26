<template>
  <div class="send-container">

    <div class="send-page">
      <h2 class="section-title">
        <i class="fas fa-paper-plane"></i>
        {{ $t('send.title') }}
      </h2>


      <!-- 客户端控制 -->
      <div class="control-section">
        <h3>{{ $t('send.connectReceiver') }}</h3>
        <div class="control-group">
          <label for="clientUrl">地址:</label>
          <input type="text" id="clientUrl" v-model="clientUrl" :disabled="isClientConnected"
            :placeholder="$t('send.urlplaceholder')" />
          <button @click="connectClient" :disabled="isClientConnected">
            {{ isClientConnected ? $t('send.connected') : $t('send.connect') }}
          </button>
          <button @click="disconnectClient" :disabled="!isClientConnected">
            {{ $t('send.disconnect') }}
          </button>
          <button @click="sendAllFiles" :disabled="!isClientConnected || sendFiles.length === 0" class="btn primary">
            {{ $t('send.sendAll') }}
          </button>
        </div>
      </div>

      <div class="send-section">
        <div class="file-selector" :class="{ active: isFileSelected }" @click="selectFile" @drop="handleFileDrop"
          @dragover="handleFileDragOver">
          <div class="file-icon">
            <i class="fas fa-cloud-upload-alt"></i>
          </div>
          <p class="file-selector-text">{{ $t('send.clickOrDrop') }}</p>
          <button class="browse-btn">{{ $t('send.browse') }}</button>
          <input type="file" ref="fileInput" @change="handleFileSelect" style="display: none;" multiple>
        </div>

        <!-- 文件传输列表 -->
        <div class="transfer-list" v-if="sendFiles.length > 0">
          <div class="transfer-item" v-for="(file, index) in sendFiles" :key="index">
            <div class="transfer-header">
              <div class="transfer-file">
                <div class="transfer-icon">
                  <i class="fas fa-file"></i>
                </div>
                <div>
                  <div class="transfer-name">
                    {{ file.name }}
                    <button class="muted-btn" @click="openFileExplorer(file.path)">
                      <i class="fas fa-folder-open"></i>
                    </button>
                  </div>
                  <div class="transfer-size-rate">
                    <div class="transfer-size">{{ formatFileSize(file.size) }}</div>
                    <div class="transfer-rate">{{ formatRate(file.transferRate || 0) }}</div>
                  </div>
                </div>
              </div>
              <div class="transfer-status" :class="`status-${file.status}`">
                {{ getStatusText(file.status) }}
              </div>
            </div>

            <!-- 进度条 -->
            <div class="progress-section" v-if="file.status === 'in-progress' || file.status === 'complete'">
              <div class="progress-bar">
                <div class="progress-fill" :style="{ width: file.progress + '%' }"></div>
              </div>
              <div class="progress-info">
                <span>{{ Math.round(file.progress) }}%</span>
              </div>
            </div>

            <!-- 控制按钮 -->
            <div class="transfer-controls">
              <button class="btn primary" @click="sendFile(index)" v-show="!file.isCancel && !file.isCompleted">
                <i class="fas fa-paper-plane"></i>
                {{ $t('send.title') }}
              </button>
              <button class="btn secondary" @click="pauseResumeFile(file)" v-show="!file.isCancel && !file.isCompleted">
                <i class="fas fa-pause" v-if="!file.isPaused"></i>
                <i class="fas fa-play" v-if="file.isPaused"></i>
                {{ file.isPaused ? $t('send.resume') : $t('send.pause') }}
              </button>
              <button class="btn secondary" @click="cancelSend(file)" v-show="!file.isCompleted && !file.isPaused">
                <i class="fas fa-times"></i>
                {{ $t('send.cancel') }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { formatFileSize, formatRate } from '../../common/tools'
import type { ClientTransferStatus } from '../../common/types'
import { useAppSettings } from '../setting/setting'
import { useI18n } from 'vue-i18n'
const { t } = useI18n()

// 组件引用
const fileInput = ref<HTMLInputElement | null>(null)

// 响应式数据
const sendFiles = ref<Array<{
  name: string
  path: string
  progress: number
  size: number
  processmessage: string
  status: 'ready' | 'in-progress' | 'complete' | 'error' | 'paused' | 'cancel'
  transferRate: number
  isPaused: boolean
  isCancel: boolean
  isCompleted: boolean
  fileId: string
}>>([])
const isFileSelected = ref(false)
const isClientConnected = ref(false)
const clientUrl = ref(`ws://localhost:${useAppSettings().settings.defaultServerPort}`);

// 获取状态文本
function getStatusText(status: 'ready' | 'in-progress' | 'complete' | 'error' | 'paused' | 'cancel'): string {
  switch (status) {
    case 'ready':
      return t('send.ready')
    case 'in-progress':
      return t('send.inProgress')
    case 'complete':
      return t('send.complete')
    case 'error':
      return t('send.error')
    case 'paused':
      return t('send.paused')
    case 'cancel':
      return t('send.cancel')
    default:
      return t('send.unknown')
  }
}

// 选择文件
const selectFile = () => {
  if (fileInput.value) {
    fileInput.value.click()
  }
}

// 处理文件选择
const handleFileSelect = (event: Event) => {
  const target = event.target as HTMLInputElement
  if (target.files && target.files.length > 0) {
    // 处理多个文件
    for (let i = 0; i < target.files.length; i++) {
      const file = target.files[i]
      if (file) {
        // 检查文件是否已经存在于列表中
        const existingFileIndex = sendFiles.value.findIndex(f => f.name === file.name && f.size === file.size)
        if (existingFileIndex === -1) {
          // 添加新文件到列表
          const filePath = window.electronAPI.getPathForFile(file)
          sendFiles.value.push({
            name: file.name,
            path: filePath,
            progress: 0,
            processmessage: '',
            size: file.size,
            status: 'ready',
            transferRate: 0,
            isPaused: false,
            isCancel: false,
            isCompleted: false,
            fileId: window.crypto.randomUUID(),
          })
        }
      }
    }
    isFileSelected.value = true
  }
}

const handleFileDrop = (event: DragEvent) => {
  event.preventDefault();
  console.log('File dropped');
  if (event.dataTransfer?.files) {
    // 处理拖拽的多个文件
    for (let i = 0; i < event.dataTransfer.files.length; i++) {
      const file = event.dataTransfer.files[i]
      if (file) {
        // 检查文件是否已经存在于列表中
        const filePath = window.electronAPI.getPathForFile(file)
        const existingFileIndex = sendFiles.value.findIndex(f => f.path === filePath)
        if (existingFileIndex === -1) {
          // 添加新文件到列表
          sendFiles.value.push({
            name: file.name,
            path: filePath,
            progress: 0,
            processmessage: '',
            size: file.size,
            status: 'ready',
            transferRate: 0,
            isPaused: false,
            isCancel: false,
            isCompleted: false,
            fileId: window.crypto.randomUUID()
          })
        }
      }
    }
    isFileSelected.value = true
  }
}

const handleFileDragOver = (event: DragEvent) => {
  event.preventDefault();
}

//发送单个文件
const sendFile = async (index:number) => {
  if(index >= 0 && sendFiles.value[index]){
    await window.electronAPI.sendFile([{ filePath: sendFiles.value[index].path, fileId: sendFiles.value[index].fileId }]);
  }
}


// 发送所有准备好的文件
const sendAllFiles = async () => {
  if (sendFiles.value.length === 0) {
    console.log(t('send.noFileSelected'));
    return
  }

  if (!isClientConnected.value) {
    console.log(t('send.noClientConnected'));
    return
  }

  let sendfiles = sendFiles.value.filter(file => file.status === 'ready').map(file => ({ filePath: file.path, fileId: file.fileId }));
  await window.electronAPI.sendFile(sendfiles);

}

const openFileExplorer = (path: string) => {
  window.electronAPI.openFileExplorer(path);
}

// 连接客户端
const connectClient = async () => {
  try {
    const result = await window.electronAPI.connectFileClient(clientUrl.value)
    if (result.success) {
      isClientConnected.value = true
    } else {
      console.error(t('send.connectionFailed', { message: result.message }))
    }
    console.log('Connect client result:', result);
  } catch (error: any) {
    console.error(t('send.connectionError', { message: error.message || t('send.unknownError') }))
  }
}

// 断开客户端连接
const disconnectClient = async () => {
  try {
    const result = await window.electronAPI.disconnectFileClient()
    if (result.success) {
      isClientConnected.value = false
    }
  } catch (error: any) {
    console.error(t('send.disconnectionError', { message: error.message || t('send.unknownError') }))
  }
}



// 暂停/恢复文件传输
const pauseResumeFile = async (file: { name: string; isPaused: boolean }) => {
  if (file.isPaused) {
    // 恢复传输
    try {
      const result = await window.electronAPI.resumeFileTransfer(file.name);
      if (!result.success) {
        console.error(t('send.resumeFailed', { message: result.message }));
      }
    } catch (error: any) {
      console.error(t('send.resumeError', { message: error.message || t('send.unknownError') }));
    }
  } else {
    // 暂停传输
    try {
      const result = await window.electronAPI.pauseFileTransfer(file.name);
      if (!result.success) {
        console.error(t('send.pauseFailed', { message: result.message }));
      }
    } catch (error: any) {
      console.error(t('send.pauseError', { message: error.message || t('send.unknownError') }));
    }
  }
}

// 取消发送
const cancelSend = async (file: { name: string; isCancel: boolean }) => {
  try {
    const result = await window.electronAPI.cancelFileTransfer(file.name)
    if (!result.success) {
      console.error(t('send.cancelFailed', { message: result.message }))
    }
  } catch (error: any) {
    console.error(t('send.cancelError', { message: error.message || t('send.unknownError') }))
  }
}

// 处理文件传输状态更新
const handleFileTransferStatus = (data: ClientTransferStatus) => {
  console.log('Send file transfer status:', data);

  // 查找对应的文件项
  const fileIndex = sendFiles.value.findIndex(file => file.fileId === data.fileId && file.path === data.filePath);
  if (fileIndex === -1 || sendFiles.value[fileIndex] === undefined) return;
  const file = sendFiles.value[fileIndex];

  if (data.type === 'transfer-start') {
    file.status = 'in-progress';
    file.progress = 0;
  }
  else if (data.type === 'transfer-progress') {
    file.progress = data.progress;
    file.status = 'in-progress';
    // 更新传输速率
    if ('transferRate' in data && data.transferRate) {
      file.transferRate = data.transferRate;
    }
  } else if (data.type === 'transfer-complete') {
    file.progress = 100;
    file.transferRate = 0;
    file.status = 'complete';
    file.isPaused = false;
    file.isCompleted = true;
  } else if (data.type === 'transfer-pause') {
    file.isPaused = true;
    file.status = 'paused';
  } else if (data.type === 'transfer-resume') {
    file.isPaused = false;
    file.status = 'in-progress';
  } else if (data.type === 'transfer-cancel') {
    file.status = 'cancel';
    file.progress = 0;
    file.isPaused = false;
    file.isCancel = true;
  }
}

// 处理文件传输错误
const handleFileTransferError = (error: { message: string, filename?: string }) => {
  console.error('文件传输错误:', error);

  // 如果指定了文件名，则更新对应文件的状态
  if (error.filename) {
    const fileIndex = sendFiles.value.findIndex(file => file.name === error.filename);
    if (sendFiles.value[fileIndex] !== undefined) {
      const file = sendFiles.value[fileIndex];
      file.status = 'error';
      file.transferRate = 0;
    }
  }
}

// 组件挂载时设置事件监听器
onMounted(() => {
  window.electronAPI.onClientFileTransferStatus(handleFileTransferStatus)
  window.electronAPI.onClientFileTransferError(handleFileTransferError)
})

// 组件卸载时移除事件监听器
onUnmounted(() => {
  window.electronAPI.removeAllClientFileTransferListeners()
})
</script>

<style scoped>
.send-container {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.send-page {
  padding: 20px;
  height: 100%;
  overflow-y: auto;
}

.section-title {
  font-size: 20px;
  margin-bottom: 15px;
  color: var(--text-primary);
  display: flex;
  align-items: center;
}

.section-title i {
  margin-right: 10px;
  font-size: 24px;
}

.control-section {
  background: var(--bg-card);
  border-radius: 10px;
  padding: 15px;
  margin-bottom: 20px;
  box-shadow: var(--shadow-light);
}

.control-section h3 {
  margin-top: 0;
  color: var(--text-primary);
}

.control-group {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
  flex-wrap: wrap;
}

.control-group label {
  font-weight: bold;
  color: var(--text-primary);
  min-width: 50px;
}

.control-group input {
  padding: 8px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  flex: 1;
  min-width: 100px;
}

.control-group button {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  background-color: var(--bg-button);
  color: var(--text-light);
  cursor: pointer;
  transition: var(--transition);
  min-width: 80px;
}

.control-group button:hover:not(:disabled) {
  background-color: var(--bg-button-hover);
}

.control-group button:disabled {
  background-color: var(--border-color);
  color: var(--text-muted);
  cursor: not-allowed;
}

.send-section {
  margin-bottom: 30px;
}

.file-selector {
  border: 2px dashed var(--border-color);
  border-radius: 10px;
  padding: 40px 20px;
  text-align: center;
  cursor: pointer;
  transition: var(--transition);
  margin-bottom: 20px;
  background: var(--bg-card);
}

.file-selector:hover {
  border-color: var(--bg-button);
  background: rgba(79, 109, 245, 0.05);
}

.file-selector.active {
  border-color: var(--bg-button);
  background: rgba(79, 109, 245, 0.1);
}

.file-icon {
  font-size: 48px;
  color: var(--bg-button);
  margin-bottom: 15px;
}

.file-selector-text {
  font-size: 16px;
  color: var(--text-secondary);
  margin-bottom: 10px;
}

.browse-btn {
  background: var(--bg-button);
  color: var(--text-light);
  border: none;
  padding: 10px 20px;
  border-radius: 5px;
  cursor: pointer;
  font-size: 14px;
  transition: var(--transition);
}

.browse-btn:hover {
  background: var(--bg-button-hover);
}

.selected-file {
  background: var(--bg-card);
  border-radius: 10px;
  padding: 15px;
  margin-top: 20px;
  display: block;
  box-shadow: var(--shadow-light);
}

.file-info {
  display: flex;
  align-items: center;
  margin-bottom: 15px;
}

.file-icon-small {
  font-size: 24px;
  margin-right: 10px;
  color: var(--bg-button);
}

.file-details {
  flex: 1;
}

.file-name {
  font-weight: 600;
  margin-bottom: 5px;
  color: var(--text-primary);
}

.file-size-rate {
  display: flex;
  align-items: center;
  gap: 10px;
}

.file-size,
.file-rate {
  color: var(--text-secondary);
  font-size: 14px;
}

.progress-section {
  margin-top: 20px;
}

.progress-bar {
  height: 10px;
  background: var(--border-color);
  border-radius: 5px;
  overflow: hidden;
  margin-bottom: 10px;
}

.progress-fill {
  height: 100%;
  background: var(--bg-send);
  border-radius: 5px;
  width: 0%;
  transition: width 0.3s ease;
}

.progress-info {
  display: flex;
  justify-content: space-between;
  font-size: 14px;
  color: var(--text-secondary);
}

.action-buttons-row {
  display: flex;
  gap: 10px;
  margin-top: 20px;
}

.muted-btn {
  border: none;
  outline: none;
  background-color: var(--bg-card);
}

.muted-btn:not(:disabled):hover {
  background-color: var(--text-muted);
}


.btn {
  padding: 10px 20px;
  border-radius: 5px;
  border: none;
  cursor: pointer;
  font-size: 14px;
  transition: var(--transition);
}

.btn.primary {
  background: var(--bg-button);
  color: var(--text-light);
}

.btn.primary:not(:disabled):hover {
  background: var(--bg-button-hover);
}

.btn.secondary {
  background: var(--text-muted);
  color: var(--text-light);
}

.btn.secondary:not(:disabled):hover {
  background: var(--text-secondary);
}

.btn:disabled {
  background: var(--border-color);
  color: var(--text-muted);
  cursor: not-allowed;
}

/* 文件传输列表样式 */
.transfer-list {
  flex: 1;
  overflow-y: auto;
  margin-top: 20px;
}

.transfer-item {
  background: var(--bg-card);
  border-radius: 10px;
  padding: 15px;
  margin-bottom: 15px;
  box-shadow: var(--shadow-light);
  border-left: 4px solid var(--bg-send);
}

.transfer-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.transfer-file {
  display: flex;
  align-items: center;
}

.transfer-icon {
  font-size: 20px;
  margin-right: 10px;
  color: var(--bg-send);
}

.transfer-name {
  font-weight: 600;
  color: var(--text-primary);
}

.transfer-size-rate {
  display: flex;
  align-items: center;
  gap: 10px;
}

.transfer-size,
.transfer-rate {
  color: var(--text-secondary);
  font-size: 14px;
  font-style: italic;
}

.transfer-status {
  font-size: 14px;
  font-weight: 600;
}

.status-ready {
  color: #6c757d;
}

.status-in-progress {
  color: #17a2b8;
}

.status-complete {
  color: #28a745;
}

.status-error {
  color: #dc3545;
}

.status-paused {
  color: #ffc107;
}

.status-cancel {
  color: #dc3545;
}

/* 进度条样式 */
.progress-section {
  margin-top: 15px;
}

.progress-bar {
  height: 10px;
  background: var(--border-color);
  border-radius: 5px;
  overflow: hidden;
  margin-bottom: 10px;
}

.progress-fill {
  height: 100%;
  background: var(--bg-send);
  border-radius: 5px;
  width: 0%;
  transition: width 0.3s ease;
}

.progress-info {
  display: flex;
  justify-content: space-between;
  font-size: 14px;
  color: var(--text-secondary);
}

.transfer-controls {
  display: flex;
  justify-content: flex-start;
  flex-direction: row;
  gap: 20px
}

/* 响应式设计 */
@media (max-width: 768px) {
  .control-group {
    flex-direction: column;
    align-items: stretch;
  }

  .control-group input,
  .control-group button {
    width: 100%;
  }
}
</style>