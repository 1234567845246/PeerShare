import { createVNode, render, type VNode, type CSSProperties } from 'vue'
import Notification from '../components/Notification.vue'
import { type NotificationType } from '../../common/types'

/**
 * 通知接口定义
 */
export interface CustomNotification {
  /** 通知提醒标题 */
  title?: string
  /** 通知提醒内容 */
  description?: string
    /** 通知类型 */
  type?: NotificationType
  /** 自定义图标 */
  icon?: VNode
  /** 自定义类名 */
  class?: string
  /** 自定义样式 */
  style?: CSSProperties
  /** 自动关闭的延时时长，单位 ms；设置 null 时，不自动关闭 */
  duration?: number | null
  /** 通知提醒弹出位置 */
  placement?: 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight'
  /** 关闭时的回调函数 */
  onClose?: () => void
}


class CustomNotificationManager {
    private notifications: Map<string, { container: HTMLElement; id: string }> = new Map();
    private maxNotificationsPerContainer = 5;

    private getContainer(placement: string): HTMLElement {
        let container = document.querySelector(`[data-notification-placement="${placement}"]`) as HTMLElement
        if (!container) {
            container = document.createElement('div')
            container.setAttribute('data-notification-placement', placement)

            // 根据位置设置容器样式
            const isTop = placement.includes('top')
            const isLeft = placement.includes('Left')

            container.style.cssText = `
                position: fixed;
                z-index: 9999;
                pointer-events: none;
                ${isTop ? 'top: 20px' : 'bottom: 20px'};
                ${isLeft ? 'left: 20px' : 'right: 20px'};
                width: 400px;
                display: flex;
                flex-direction: ${isTop ? 'column' : 'column-reverse'};
                gap: 8px;
            `
            document.body.appendChild(container)
        }
        return container
    }

    private generateId(): string {
        return `notification-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    }

    show(options: CustomNotification): string {
        const id = this.generateId()
        if(this.notifications.size >= this.maxNotificationsPerContainer){
            const firstKey = Array.from(this.notifications.keys())[0];
            this.close(firstKey as string);
        }
        const placement = options.placement || 'topRight'
        const container = this.getContainer(placement)

        // 使 wrapper 可以接收鼠标事件
        const wrapper = document.createElement('div')
        wrapper.setAttribute('data-notification-id', id)
        wrapper.style.pointerEvents = 'auto'

        const notificationVNode = createVNode(Notification, {
            id,
            type: options.type || 'info',
            title: options.title,
            description: options.description,
            icon: options.icon,
            class: options.class,
            style: options.style,
            duration: options.duration ?? 4500,
            placement,
            onClose: () => {
                this.close(id)
                options.onClose?.()
            }
        })

        render(notificationVNode, wrapper)
        container.appendChild(wrapper)
        this.notifications.set(id, { container: wrapper, id })

        return id
    }

    close(id: string): void {
        const notification = this.notifications.get(id);
        if (notification) {
            render(null, notification.container)
            notification.container.remove()
            this.notifications.delete(id)
        }
    }

    /**
     * 清除所有通知
     */
    clearAll(): void {
        const ids = Array.from(this.notifications.keys())
        ids.forEach(id => this.close(id))
    }

    info(options: Omit<CustomNotification, 'type'>): string {
        return this.show({ ...options, type: 'info' })
    }

    error(options: Omit<CustomNotification, 'type'>): string {
        return this.show({ ...options, type: 'error' })
    }

    success(options: Omit<CustomNotification, 'type'>): string {
        return this.show({ ...options, type: 'success' })
    }
}

export const customnotificationManager = new CustomNotificationManager()

export const useCustomNotification = () => ({
    info: (options: Omit<CustomNotification, 'type'>) => customnotificationManager.info(options),
    error: (options: Omit<CustomNotification, 'type'>) => customnotificationManager.error(options),
    success: (options: Omit<CustomNotification, 'type'>) => customnotificationManager.success(options),
    clearAll: () => customnotificationManager.clearAll()
})