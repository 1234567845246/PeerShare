<template>
  <div class="send-container">

    <div class="send-page">
      <h2 class="section-title">
        <i class="fas fa-paper-plane"></i>
        发送文件
      </h2>


      <!-- 客户端控制 -->
      <div class="control-section">
        <h3>连接接收方</h3>
        <div class="control-group">
          <label for="clientUrl">地址:</label>
          <input type="text" id="clientUrl" v-model="clientUrl" :disabled="isClientConnected"
            placeholder="例如: ws://192.168.1.100:8080" />
          <button @click="connectClient" :disabled="isClientConnected">
            {{ isClientConnected ? '已连接' : '连接' }}
          </button>
          <button @click="disconnectClient" :disabled="!isClientConnected">
            断开连接
          </button>
        </div>
      </div>

      <div class="send-section">
        <div class="file-selector" :class="{ active: isFileSelected }" @click="selectFile" @drop="handleFileDrop"
          @dragover="handleFileDragOver">
          <div class="file-icon">
            <i class="fas fa-cloud-upload-alt"></i>
          </div>
          <p class="file-selector-text">点击选择文件或拖放文件到此处</p>
          <button class="browse-btn">浏览文件</button>
          <input type="file" ref="fileInput" @change="handleFileSelect" style="display: none;">
        </div>

        <div class="selected-file" v-if="selectedFile">
          <div class="file-info">
            <div class="file-icon-small">
              <i class="fas fa-file"></i>
            </div>
            <div class="file-details">
              <div class="file-name">{{ selectedFile.name }}</div>
              <div class="file-size-rate">
                <div class="file-size">{{ formatFileSize(selectedFile.size) }}</div>
              </div>
            </div>
          </div>

          <div class="progress-section">
            <div class="progress-bar">
              <div class="progress-fill" :style="{ width: progress + '%' }"></div>
            </div>
            <div class="progress-info">
              <span>{{ progressMessage }}</span>
              <span>{{ Math.round(progress) }}%</span>
            </div>
          </div>

          <div class="action-buttons-row">
            <button class="btn primary" @click="sendFile" v-show="isSending || !isCompleted">
              <i class="fas fa-paper-plane"></i>
              发送文件  
            </button>
            <button class="btn secondary" @click="pauseResumeFile" 
              v-show="isPaused || isSending">
              <i class="fas fa-pause" v-if="!isPaused"></i>
              <i class="fas fa-play" v-if="isPaused"></i>
              {{ isPaused ? '恢复' : '暂停' }}
            </button>
            <button class="btn secondary" @click="cancelSend" v-show="isCancel || isSending" >
              <i class="fas fa-times"></i>
              取消
            </button>
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

// 组件引用
const fileInput = ref<HTMLInputElement | null>(null)

// 响应式数据
const selectedFile = ref<File | null>(null)
const isFileSelected = ref(false)
const isSending = ref(false)
const isPaused = ref(false)
const isCompleted = ref(false)
const isCancel = ref(false)
const progress = ref(0)
const progressMessage = ref('准备发送')
const isClientConnected = ref(false)
const clientUrl = ref('ws://localhost:8080');
let filePath = '' // 存储文件路径

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
    const file = target.files[0]
    if (file) {
      selectedFile.value = file
      isFileSelected.value = true
      isCompleted.value = false
      progress.value = 0
      progressMessage.value = '准备发送'
    }
  }
}

const handleFileDrop = (event: DragEvent) => {
  event.preventDefault();
  console.log('File dropped');
  const file = event.dataTransfer?.files[0]
  if (file) {
    selectedFile.value = file
    isFileSelected.value = true
    isCompleted.value = false
    progress.value = 0
    progressMessage.value = '准备发送'
  }
}

const handleFileDragOver = (event: DragEvent) => {
  event.preventDefault();
}

// 连接客户端
const connectClient = async () => {
  try {
    const result = await window.electronAPI.connectFileClient(clientUrl.value)
    if (result.success) {
      isClientConnected.value = true
      progressMessage.value = `已连接到 ${clientUrl.value}`
    } else {
      progressMessage.value = `连接失败: ${result.message}`
    }
    console.log('Connect client result:', result);
  } catch (error: any) {
    progressMessage.value = `连接错误: ${error.message || '未知错误'}`
  }
}

// 断开客户端连接
const disconnectClient = async () => {
  try {
    const result = await window.electronAPI.disconnectFileClient()
    if (result.success) {
      isClientConnected.value = false
      progressMessage.value = '已断开连接'
    } else {
      progressMessage.value = `断开连接失败: ${result.message}`
    }
  } catch (error: any) {
    progressMessage.value = `断开连接错误: ${error.message || '未知错误'}`
  }
}

// 发送文件
const sendFile = async () => {
  if (!selectedFile.value) {
    progressMessage.value = '请先选择文件'
    return
  }

  if (!isClientConnected.value) {
    progressMessage.value = '请先连接到接收方'
    return
  }

  isSending.value = true
  isPaused.value = false
  isCompleted.value = false
  isCancel.value = false
  progress.value = 0
  progressMessage.value = '准备发送文件...'

  try {
    // 获取文件路径
    filePath = window.electronAPI.getPathForFile(selectedFile.value)

    // 发送文件
    await window.electronAPI.sendFile(filePath)

  } catch (error: any) {
    console.error('发送文件失败:', error)
    progressMessage.value = `发送文件错误: ${error.message || '未知错误'}`
  } finally {
    isSending.value = false
  }
}

// 暂停/恢复文件传输
const pauseResumeFile = async () => {
  if (!selectedFile.value) {
    progressMessage.value = '请先选择文件'
    return
  }

  if (isPaused.value) {
    // 恢复传输
    try {

      const result = await window.electronAPI.resumeFileTransfer(selectedFile.value.name);
      if (!result.success) {
        progressMessage.value = `恢复失败: ${result.message}`
      }

    } catch (error: any) {
      progressMessage.value = `恢复错误: ${error.message || '未知错误'}`
    }
  } else {
    // 暂停传输
    try {
      const result = await window.electronAPI.pauseFileTransfer(selectedFile.value.name);
      if (!result.success) {
        progressMessage.value = `暂停失败: ${result.message}`
      }
    } catch (error: any) {
      progressMessage.value = `暂停错误: ${error.message || '未知错误'}`
    }
  }
}

// 取消发送
const cancelSend = async () => {
  try {
    if (!selectedFile.value) return
    const result = await window.electronAPI.cancelFileTransfer(selectedFile.value.name)
    if (!result.success) {
      progressMessage.value = `取消失败: ${result.message}`
    }
  } catch (error: any) {
    progressMessage.value = `取消错误: ${error.message || '未知错误'}`
  }
}

// 处理文件传输状态更新
const handleFileTransferStatus = (data: ClientTransferStatus) => {
  console.log('Send file transfer status:', data);
  if (data.type === 'transfer-progress') {
    progress.value = data.progress;
    // 更新传输速率
    if ('transferRate' in data && data.transferRate) {
      // 在消息中显示传输速率
      progressMessage.value = `传输进度: ${data.progress}% (${formatRate(data.transferRate)})`;
    }
  }

  if (data.type === 'transfer-pause') {
    isPaused.value = true;
    isSending.value = false;
    progressMessage.value = data.message || '传输已暂停';
  }

  if (data.type === 'transfer-resume') {
    isPaused.value = false;
    isSending.value = true;
    progressMessage.value = data.message || '传输已恢复';
  }

  if (data.type === 'transfer-cancel') {
    isSending.value = false;
    isCancel.value = true;
    progressMessage.value = data.message || '传输已取消';
  }

  if (data.message) {
    progressMessage.value = data.message;
  }

  // 如果是完成状态，重置发送状态
  if (data.type === 'transfer-complete') {
    isSending.value = false
    isCompleted.value = true
  }
}

// 处理文件传输错误
const handleFileTransferError = (error: { message: string }) => {
  progressMessage.value = `传输错误: ${error.message}`
  isSending.value = false
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