<template>
  <div :class="['notification', `notification-${type}`, placement, customClass]" :style="customStyle" @mouseenter="handleMouseEnter" @mouseleave="handleMouseLeave">
    <div class="notification-content">
      <div class="notification-icon">
        <i v-if="!icon" :class="getIconClass()"></i>
        <component v-else :is="icon" />
      </div>
      <div class="notification-body">
        <div v-if="title" class="notification-title">{{ title }}</div>
        <div v-if="description" class="notification-description">{{ description }}</div>
      </div>
      <button class="notification-close" @click="handleClose">
        <i class="fas fa-times"></i>
      </button>
    </div>
    <div :class="['notification-progress', { active: showProgress }]"></div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed} from 'vue'
import type { CustomNotification } from '../notification/Customnotification';



const props = withDefaults(defineProps<CustomNotification & {id:string}>(), {
  type: 'info',
  duration: 4500,
  placement: 'topRight'
})

const isHovering = ref(false)
const showProgress = ref(props.duration !== null && props.duration > 0)
let timeoutId: ReturnType<typeof setTimeout> | null = null
let progressInterval: ReturnType<typeof setInterval> | null = null
let remainingTime = props.duration ?? 0
let startTime = 0

const getIconClass = () => {
  const iconMap: Record<string, string> = {
    info: 'fas fa-circle-info',
    error: 'fas fa-circle-exclamation',
    success: 'fas fa-circle-check'
  }
  return iconMap[props.type || 'info']
}

const handleMouseEnter = () => {
  isHovering.value = true
  if (timeoutId !== null) {
    // 计算已用时间，更新剩余时间
    const elapsed = Date.now() - startTime
    remainingTime = Math.max(0, remainingTime - elapsed)
    clearTimeout(timeoutId)
    timeoutId = null
  }
  if (progressInterval !== null) {
    clearInterval(progressInterval)
    progressInterval = null
  }
}

const handleMouseLeave = () => {
  isHovering.value = false
  if (props.duration !== null && props.duration > 0) {
    startAutoClose()
  }
}

const startAutoClose = () => {
  if (props.duration === null || props.duration <= 0) return

  startTime = Date.now()
  timeoutId = setTimeout(() => {
    handleClose()
  }, remainingTime)
}

const startProgressAnimation = () => {
  // 进度条使用 CSS 动画，_这里保留定时器用于在需要时清理_
  if (props.duration === null || props.duration <= 0) return
  // no-op; CSS handles the visual progress when `showProgress` is true
}

const handleClose = () => {
  if (timeoutId !== null) {
    clearTimeout(timeoutId)
    timeoutId = null
  }
  if (progressInterval !== null) {
    clearInterval(progressInterval)
    progressInterval = null
  }
  props.onClose?.()
}

onMounted(() => {
  if (!isHovering.value) {
    // 初始化剩余时间（防止外部修改 props.duration）
    remainingTime = props.duration ?? 0
    startAutoClose()
    startProgressAnimation()
  }
})

onUnmounted(() => {
  if (timeoutId !== null) {
    clearTimeout(timeoutId)
  }
  if (progressInterval !== null) {
    clearInterval(progressInterval)
  }
})

const customClass = computed(() => props.class || '')
const customStyle = computed(() => {
  const base = (props.style as any) || {}
  // 将进度条动画时长注入为 CSS 变量，供样式使用
  if (props.duration && props.duration > 0) {
    return { ...base, ['--progress-duration' as any]: `${props.duration}ms` }
  }
  return base
})

</script>

<style scoped>
.notification {
  position: relative;
  min-width: 300px;
  max-width: 400px;
  margin-bottom: 12px;
  border-radius: 8px;
  box-shadow: var(--notification-shadow);
  animation: slideIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
  overflow: hidden;
}

.notification.topLeft {
  animation: slideInLeft 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.notification.topRight {
  animation: slideInRight 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.notification.bottomLeft {
  animation: slideInLeftBottom 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.notification.bottomRight {
  animation: slideInRightBottom 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

@keyframes slideInRight {
  from {
    opacity: 0;
    transform: translateX(400px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

@keyframes slideInLeft {
  from {
    opacity: 0;
    transform: translateX(-400px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

@keyframes slideInRightBottom {
  from {
    opacity: 0;
    transform: translateX(400px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

@keyframes slideInLeftBottom {
  from {
    opacity: 0;
    transform: translateX(-400px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

/* 类型特定样式 */
.notification-info {
  background: linear-gradient(135deg, var(--notification-info-bg-start) 0%, var(--notification-info-bg-end) 100%);
  border-left: 4px solid var(--notification-info-border);
  color: var(--notification-info-text);
}

.notification-success {
  background: linear-gradient(135deg, var(--notification-success-bg-start) 0%, var(--notification-success-bg-end) 100%);
  border-left: 4px solid var(--notification-success-border);
  color: var(--notification-success-text);
}

.notification-error {
  background: linear-gradient(135deg, var(--notification-error-bg-start) 0%, var(--notification-error-bg-end) 100%);
  border-left: 4px solid var(--notification-error-border);
  color: var(--notification-error-text);
}

.notification-content {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px 16px;
}

.notification-icon {
  flex-shrink: 0;
  font-size: 20px;
  margin-top: 2px;
}

.notification-icon i {
  font-weight: 600;
}

.notification-body {
  flex: 1;
  min-width: 0;
}

.notification-title {
  font-weight: 600;
  font-size: 14px;
  margin-bottom: 4px;
  line-height: 1.4;
}

.notification-description {
  font-size: 13px;
  opacity: 0.85;
  line-height: 1.4;
  word-break: break-word;
}

.notification-close {
  flex-shrink: 0;
  background: none;
  border: none;
  padding: 4px;
  cursor: pointer;
  opacity: 0.6;
  transition: opacity 0.2s;
  font-size: 16px;
  color: currentColor;
  display: flex;
  align-items: center;
  justify-content: center;
}

.notification-close:hover {
  opacity: 1;
}

.notification-progress {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: var(--notification-progress-bg);
  overflow: hidden;
}

.notification-progress.active {
  animation: progressBar linear;
}

.notification-progress.active::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: currentColor;
  opacity: 0.6;
  animation: progress linear forwards;
  animation-duration: var(--progress-duration, 4500ms);
}

@keyframes slideOut {
  from {
    opacity: 1;
    transform: translateX(0);
  }
  to {
    opacity: 0;
    transform: translateX(400px);
  }
}

@keyframes progress {
  from {
    width: 0;
  }
  to {
    width: 100%;
  }
}

/* 响应式设计 */
@media (max-width: 480px) {
  .notification {
    min-width: 280px;
    max-width: 100vw;
    margin: 0 12px 12px 12px;
  }
}
</style>
