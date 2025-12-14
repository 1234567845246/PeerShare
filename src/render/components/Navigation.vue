<template>
  <div class="app-header">
    <div class="app-title">文件传输器</div>
    <div class="nav-controls">
      <div class="nav-buttons">
        <button class="nav-btn" :class="{ active: route.path === '/' }" @click="goToHome">
          {{ $t('nav.navBtn1') }}
        </button>
        <button class="nav-btn" :class="{ active: route.path === '/send' }" @click="goToSend">
          {{ $t('nav.navBtn2') }}
        </button>
        <button class="nav-btn" :class="{ active: route.path === '/receive' }" @click="goToReceive">
          {{ $t('nav.navBtn3') }}
        </button>
        <button class="nav-btn" :class="{ active: route.path === '/setting' }" @click="goToSetting">
          {{ $t('nav.navBtn4') }}
        </button>
      </div>
      <button class="theme-toggle" id="theme-toggle" :title="$t('nav.themeToggle')" @click="toggleTheme">
        <i class="fas fa-moon"></i>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()

const goToHome = () => {
  router.push('/')
}

const goToSend = () => {
  router.push('/send')
}

const goToReceive = () => {
  router.push('/receive')
}

const goToSetting = () => {
  router.push('/setting')
} 

const toggleTheme = () => {
  const currentTheme = document.documentElement.getAttribute('data-theme')
  const newTheme = currentTheme === 'light' ? 'dark' : 'light'

  document.documentElement.setAttribute('data-theme', newTheme)

  const themeIcon = document.querySelector('.theme-toggle i')
  if (themeIcon) {
    if (newTheme === 'dark') {
      themeIcon.classList.remove('fa-moon')
      themeIcon.classList.add('fa-sun')
      window.electronAPI.setTheme('dark');
    } else {
      themeIcon.classList.remove('fa-sun')
      themeIcon.classList.add('fa-moon')
      window.electronAPI.setTheme('light');
    }
  }
}
</script>

<style scoped>
.app-header {
  background: var(--bg-header);
  color: var(--text-light);
  padding: 20px 30px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.app-title {
  font-size: 24px;
  font-weight: 600;
}

.nav-controls {
  display: flex;
  gap: 10px;
  align-items: center;
}

.nav-buttons {
  display: flex;
  gap: 10px;
}

.nav-btn {
  background: rgba(255, 255, 255, 0.2);
  border: none;
  color: var(--text-light);
  padding: 8px 16px;
  border-radius: 20px;
  cursor: pointer;
  transition: var(--transition);
  font-size: 14px;
}

.nav-btn:hover {
  background: rgba(255, 255, 255, 0.3);
}

.nav-btn.active {
  background: rgba(255, 255, 255, 0.4);
  font-weight: 600;
}

.theme-toggle {
  background: rgba(255, 255, 255, 0.2);
  border: none;
  color: var(--text-light);
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  justify-content: center;
  align-items: center;
  cursor: pointer;
  transition: var(--transition);
  margin-left: 10px;
}

.theme-toggle:hover {
  background: rgba(255, 255, 255, 0.3);
  transform: rotate(30deg);
}

/* 响应式设计 */
@media (max-width: 768px) {
  .nav-controls {
    flex-direction: column;
    gap: 10px;
  }

  .nav-buttons {
    order: 2;
  }

  .theme-toggle {
    order: 1;
    align-self: flex-end;
  }
}
</style>