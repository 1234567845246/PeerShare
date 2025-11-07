<template>
  <div class="home-container">
    <div class="home-page">
      <div class="logo">
        <i class="fas fa-exchange-alt"></i>
      </div>
      <h1 class="welcome-text">欢迎使用文件传输器</h1>
      <p class="subtitle">安全、快速地在设备间传输文件。支持大文件传输，操作简单便捷。</p>
      
      <div class="action-buttons">
        <div class="action-btn send" @click="goToSend">
          <div class="action-icon">
            <i class="fas fa-file-export"></i>
          </div>
          <div class="action-text">发送文件</div>
        </div>
        <div class="action-btn receive" @click="goToReceive">
          <div class="action-icon">
            <i class="fas fa-file-import"></i>
          </div>
          <div class="action-text">接收文件</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'

const router = useRouter()

const goToSend = () => {
  router.push('/send')
}

const goToReceive = () => {
  router.push('/receive')
}
</script>

<style scoped>
.home-container {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.home-page {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  text-align: center;
  height: 100%;
  padding: 20px;
  flex: 1;
}

.logo {
  font-size: 48px;
  margin-bottom: 20px;
  color: var(--bg-button);
}

.welcome-text {
  font-size: 28px;
  margin-bottom: 10px;
  color: var(--text-primary);
}

.subtitle {
  font-size: 16px;
  color: var(--text-secondary);
  margin-bottom: 40px;
  max-width: 500px;
}

.action-buttons {
  display: flex;
  gap: 30px;
  margin-top: 20px;
}

.action-btn {
  width: 200px;
  height: 200px;
  border-radius: 20px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  cursor: pointer;
  transition: var(--transition);
  color: var(--text-light);
  text-decoration: none;
  box-shadow: 0 10px 20px rgba(0, 0, 0, 0.15);
}

.action-btn.send {
  background: var(--bg-send);
}

.action-btn.receive {
  background: var(--bg-receive);
}

.action-btn:hover {
  transform: translateY(-5px);
  box-shadow: 0 15px 25px rgba(0, 0, 0, 0.2);
}

.action-icon {
  font-size: 60px;
  margin-bottom: 15px;
}

.action-text {
  font-size: 22px;
  font-weight: 600;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .action-buttons {
    flex-direction: column;
    gap: 20px;
  }

  .action-btn {
    width: 100%;
    max-width: 250px;
    height: 150px;
  }
}
</style>