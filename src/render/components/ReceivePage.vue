<template>
  <div class="receive-container">
    <div class="receive-page">
      <div class="connection-status">
        <div class="status-indicator">
          <div class="status-dot" :class="connectionStatus"></div>
          <div class="status-text">{{ statusText }}</div>
        </div>
        <p class="connection-info">{{ connectionInfo }}</p>
        <div style="width: 100%; display: flex; justify-content: center;">
          <input class="connection-address" v-model="serverPort"/>
        </div>
        <button class="btn primary" @click="toggleReceiveService">
          {{ isReceiving ? '停止接收服务' : '启动接收服务' }}
        </button>
      </div>

      <h2 class="section-title">
        <i class="fas fa-download"></i>
        接收文件
      </h2>
      
      <div class="transfer-list">
        <div class="transfer-item" v-for="(file, index) in receivedFiles" :key="index">
          <div class="transfer-header">
            <div class="transfer-file">
              <div class="transfer-icon">
                <i class="fas fa-file"></i>
              </div>
              <div>
                <div class="transfer-name">{{ file.name }}</div>
                <div class="transfer-size">{{ formatFileSize(file.size) }}</div>
                <div class="transfer-progress">{{ file.progress }} %</div>
              </div>
            </div>
            <div class="transfer-status" :class="`status-${file.status}`">
              {{ getStatusText(file.status) }}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { formatFileSize } from '../../common/tools'
import {type ServerTransferStatus } from '../../common/types'


// 响应式数据
const isReceiving = ref(false)
const serverPort = ref(8080)
const receivedFiles = ref<Array<{
  name: string
  progress: number
  clientId: string
  size:number
  status: 'complete' | 'in-progress' | 'error'
}>>([])

// 计算属性
const connectionStatus = computed(() => {
  if (!isReceiving.value) return 'waiting'
  return 'connected'
})

const statusText = computed(() => {
  if (!isReceiving.value) return '等待连接'
  return '已连接'
})

const connectionInfo = computed(() => {
  if (!isReceiving.value) return '接收器正在等待发送方连接'
  return '接收服务正在运行，等待文件传输...'
})


// 获取状态文本
function getStatusText(status: 'complete' | 'in-progress' | 'error'): string {
  switch (status) {
    case 'complete':
      return '已完成'
    case 'in-progress':
      return '接收中'
    case 'error':
      return '错误'
    default:
      return '未知'
  }
}

// 切换接收服务
const toggleReceiveService = async () => {
  if (!isReceiving.value) {
    // 启动接收服务
    try {
      const result = await window.electronAPI.startFileServer(serverPort.value)
      if (result.success) {
        isReceiving.value = true
        // 添加系统通知
        // receivedFiles.value.unshift({
        //   name: `接收服务已启动 (端口: ${serverPort.value})`,
        //   progress: 0,
        //   status: 'complete'
        // })
      } else {
        // 添加错误通知
        // receivedFiles.value.unshift({
        //   name: `启动失败: ${result.message}`,
        //   progress: 0,
        //   status: 'error'
        // })
      }
    } catch (error: any) {
      // 添加错误通知
      // receivedFiles.value.unshift({
      //   name: `启动错误: ${error.message || '未知错误'}`,
      //   progress: 0,
      //   status: 'error'
      // })
    }
  } else {
    // 停止接收服务
    try {
      const result = await window.electronAPI.stopFileServer()
      if (result.success) {
        isReceiving.value = false
        // 添加系统通知
        // receivedFiles.value.unshift({
        //   name: '接收服务已停止',
        //   progress: 0,
        //   status: 'complete'
        // })
      } else {
        // 添加错误通知
        // receivedFiles.value.unshift({
        //   name: `停止失败: ${result.message}`,
        //   progress: 0,
        //   status: 'error'
        // })
      }
    } catch (error: any) {
      // 添加错误通知
      // receivedFiles.value.unshift({
      //   name: `停止错误: ${error.message || '未知错误'}`,
      //   progress: 0,
      //   status: 'error'
      // })
    }
  }
}

// 处理文件传输状态更新
const handleFileTransferStatus = (data: ServerTransferStatus) => {
  // 添加新的文件传输记录
  // if (data.filename ) {
  //   const existingFileIndex = receivedFiles.value.findIndex((file: { name: string }) => file.name === data.filename)
    
  //   if (existingFileIndex >= 0) {
  //     // 更新现有文件状态
  //     const fileToUpdate = receivedFiles.value[existingFileIndex]
  //     if (fileToUpdate) {
  //       fileToUpdate.progress = data.progress || 0;
  //       fileToUpdate.status = 
  //         data.type === 'transfer-complete' ? 'complete' : 
  //         data.type === 'transfer-error' ? 'error' : 'in-progress'
  //     }
  //   } else {
  //     // 添加新文件记录
  //     receivedFiles.value.unshift({
  //       name: data.filename,
  //       progress: data.progress || 0,
  //       status: data.type === 'transfer-complete' ? 'complete' : 
  //              data.type === 'transfer-error' ? 'error' : 'in-progress'
  //     })
  //   }
  // }
  if(data.type === 'transfer-start'){
    receivedFiles.value.unshift({
      name: data.filename,
      progress: 0,
      size: data.filesize,
      clientId: data.clientId,
      status: 'in-progress'
    })
  }
  else if(data.type === 'transfer-progress'){
    const existingFileIndex = receivedFiles.value.findIndex((file: { name: string; clientId: string }) => file.name === data.filename && file.clientId === data.clientId)
    if (existingFileIndex >= 0) {
      const fileToUpdate = receivedFiles.value[existingFileIndex]
      if (fileToUpdate) {
        fileToUpdate.progress = data.progress || 0;
        fileToUpdate.status = 'in-progress'
      }
    }
  }else if(data.type === 'transfer-complete'){
    const existingFileIndex = receivedFiles.value.findIndex((file: { name: string; clientId: string }) => file.name === data.filename && file.clientId === data.clientId)
    if (existingFileIndex >= 0) {
      const fileToUpdate = receivedFiles.value[existingFileIndex]
      if (fileToUpdate) {
        fileToUpdate.progress = 100;
        fileToUpdate.status = 'complete'
      }
    }
  }
}

// 处理文件传输错误
const handleFileTransferError = (error: { message: string }) => {
  // 添加错误通知
  // receivedFiles.value.unshift({
  //   name: `传输错误: ${error.message}`,
  //   progress: 0,
  //   size: 0,
  //   status: 'error'
  // })
}

// 组件挂载时设置事件监听器
onMounted(() => {
  window.electronAPI.onFileTransferStatus(handleFileTransferStatus)
  window.electronAPI.onFileTransferError(handleFileTransferError)
})

// 组件卸载时移除事件监听器
onUnmounted(() => {
  window.electronAPI.removeAllFileTransferListeners()
})
</script>

<style scoped>
.receive-container {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.receive-page {
  padding: 20px;
}

.connection-status {
  background: var(--bg-card);
  border-radius: 10px;
  padding: 20px;
  margin-bottom: 30px;
  text-align: center;
  box-shadow: var(--shadow-light);
}

.status-indicator {
  display: inline-flex;
  align-items: center;
  margin-bottom: 15px;
}

.status-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  margin-right: 10px;
}

.status-dot.waiting {
  background: #ffc107;
  animation: pulse 2s infinite;
}

.status-dot.connected {
  background: #28a745;
}

.status-dot.error {
  background: #dc3545;
}

@keyframes pulse {
  0% {
    opacity: 1;
  }

  50% {
    opacity: 0.5;
  }

  100% {
    opacity: 1;
  }
}

.status-text {
  font-weight: 600;
  color: var(--text-primary);
}

.connection-info {
  color: var(--text-secondary);
  font-size: 14px;
  margin-bottom: 15px;
}

.connection-address {
  background: var(--bg-secondary);
  padding: 10px 15px;
  border-radius: 5px;
  width: 40%;
  font-family: monospace;
  margin: 10px 0;
  border: 1px solid var(--border-color);
  color: var(--text-primary);
}

.section-title {
  font-size: 20px;
  margin-bottom: 15px;
  color: #333;
  display: flex;
  align-items: center;
}

.section-title i {
  margin-right: 10px;
  font-size: 24px;
}

.btn {
  padding: 10px 20px;
  border-radius: 5px;
  border: none;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.3s ease;
}

.btn.primary {
  background: var(--bg-button);
  color: var(--text-light);
}

.btn.primary:hover {
  background: var(--bg-button-hover);
}

.transfer-list {
  flex: 1;
  overflow-y: auto;
}

.transfer-item {
  background: var(--bg-card);
  border-radius: 10px;
  padding: 15px;
  margin-bottom: 15px;
  box-shadow: var(--shadow-light);
  border-left: 4px solid var(--bg-button);
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
  color: var(--bg-button);
}

.transfer-name {
  font-weight: 600;
  color: var(--text-primary);
}

.transfer-progress {
  color: var(--text-secondary);
  font-size: 14px;
}

.transfer-status {
  font-size: 14px;
  font-weight: 600;
}

.status-complete {
  color: #28a745;
}

.status-in-progress {
  color: #17a2b8;
}

.status-error {
  color: #dc3545;
}
</style>