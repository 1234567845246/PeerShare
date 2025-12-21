<template>
  <div 
    class="custom-select" 
    :class="[
      sizeClass, 
      { 'is-disabled': disabled, 'is-error': hasError }
    ]" 
    :style="{ width }"
    ref="containerRef"
  >
    <!-- 选择框触发器 -->
    <div 
      class="select-trigger"
      :class="{
        'is-open': dropdownVisible,
        'is-focused': isFocused,
        'has-value': !!modelValue
      }"
      @click="toggleDropdown"
      @mouseenter="triggerHover = true"
      @mouseleave="triggerHover = false"
      ref="triggerRef"
    >
      <!-- 选中的标签 -->
      <div class="selected-content">
        <span v-if="selectedOption" class="selected-label">
          {{ selectedOption.label }}
        </span>
        <span v-else class="placeholder">
          {{ placeholder }}
        </span>
      </div>
      
      <!-- 图标区域 -->
      <div class="select-icons">
        <!-- 清除按钮 -->
        <div 
          v-if="clearable && modelValue && !disabled && showClear"
          class="clear-icon"
          @click.stop="handleClear"
        >
          <svg viewBox="0 0 24 24" class="icon">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
          </svg>
        </div>
        
        <!-- 分隔线 -->
        <div class="icon-divider" v-if="clearable && modelValue && showClear"></div>
        
        <!-- 下拉箭头 -->
        <div class="arrow-icon" :class="{ 'is-open': dropdownVisible }">
          <svg viewBox="0 0 24 24" class="icon">
            <path d="M7 10l5 5 5-5z"/>
          </svg>
        </div>
      </div>
    </div>
    
    <!-- 下拉菜单 -->
    <teleport to="body">
      <div 
        v-if="dropdownVisible"
        class="select-dropdown"
        :style="dropdownStyle"
        ref="dropdownRef"
      >
        <!-- 搜索框 -->
        <div v-if="filterable" class="filter-section">
          <div class="filter-input-wrapper">
            <svg class="search-icon" viewBox="0 0 24 24">
              <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
            </svg>
            <input
              type="text"
              v-model="filterText"
              class="filter-input"
              :placeholder="filterPlaceholder"
              @input="handleFilter"
              ref="filterInputRef"
            />
            <div 
              v-if="filterText" 
              class="filter-clear"
              @click="filterText = ''"
            >
              <svg viewBox="0 0 24 24">
                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
              </svg>
            </div>
          </div>
        </div>
        
        <!-- 选项列表 -->
        <div 
          class="options-container"
          :class="{ 'has-filter': filterable, 'has-description': showDescription }"
          :style="{ maxHeight: optionsMaxHeight }"
          ref="optionsListRef"
        >
          <!-- 默认槽位 -->
          <template v-if="hasSlotOptions">
            <div 
              v-for="(option, index) in filteredSlotOptions"
              :key="`${option.value}-${index}`"
              class="option-item-wrapper"
            >
              <Option
                :value="option.value"
                :label="option.label"
                :description="option.description"
                :disabled="option.disabled"
                :default="option.default"
              />
            </div>
          </template>
          
          <!-- 通过 options prop -->
          <template v-else>
            <div 
              v-for="(option, index) in filteredOptions"
              :key="`${option.value}-${index}`"
              class="option-item-wrapper"
            >
              <Option
                :value="option.value"
                :label="option.label"
                :description="option.description"
                :disabled="option.disabled"
                :default="option.default"
              />
            </div>
          </template>
          
          <!-- 空状态 -->
          <div v-if="showEmptyState" class="empty-state">
            <svg class="empty-icon" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
            </svg>
            <div class="empty-text">{{ emptyText }}</div>
          </div>
        </div>
        
        <!-- 下拉框底部的描述区域 -->
        <div 
          v-if="showDescription && (currentDescription || hasError)"
          class="dropdown-description"
          :class="{ 'is-error': hasError }"
        >
          <div class="description-header">
            <svg 
              v-if="hasError" 
              class="description-icon error"
              viewBox="0 0 24 24"
            >
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
            </svg>
            <svg 
              v-else-if="currentDescription" 
              class="description-icon info"
              viewBox="0 0 24 24"
            >
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
            </svg>
            <div class="description-title">
              {{ hasError ? $t('select.error') : $t('select.description') }}
            </div>
          </div>
          <div class="description-text">
            {{ currentDescription || errorMessage }}
          </div>
        </div>
      </div>
    </teleport>
  </div>
</template>
<script lang="ts">
import { i18n } from '../i18n/i18n';
let query = i18n.global.t('select.placeholder');
</script>

<script setup lang="ts">
import { 
  ref, 
  computed, 
  watch, 
  onMounted, 
  onUnmounted, 
  nextTick,
  useSlots,
  provide
} from 'vue';
import Option from './Option.vue';
import type { SelectOption, SelectProps, SelectEmits } from '../../common/types';
import {useI18n} from 'vue-i18n';
const { t } = useI18n();

const props = withDefaults(defineProps<SelectProps>(), {
  options: () => [],
  placeholder: query,
  disabled: false,
  clearable: false,
  filterable: false,
  size: 'medium',
  width: '100%',
  showDescription: true
});

const emit = defineEmits<SelectEmits>();

// 状态管理
const dropdownVisible = ref(false);
const isFocused = ref(false);
const triggerHover = ref(false);
const filterText = ref('');
const currentDescription = ref('');
const showClear = ref(false);
const hasError = ref(false);
const errorMessage = ref('');

// DOM 引用
const containerRef = ref<HTMLElement>();
const triggerRef = ref<HTMLElement>();
const dropdownRef = ref<HTMLElement>();
const optionsListRef = ref<HTMLElement>();
const filterInputRef = ref<HTMLInputElement>();

// 提供上下文给 Option 组件
const selectContext = {
  selectedValue: computed(() => props.modelValue),
  hoveredDescription: currentDescription,
  
  // 选中选项
  updateSelected: (value: string | number, option: SelectOption) => {
    emit('update:modelValue', value);
    emit('change', value, option);
    currentDescription.value = option.description || '';
    closeDropdown();
  },
  
  // 更新悬停描述
  updateHoveredDescription: (description: string | undefined) => {
    if (description) {
      currentDescription.value = description;
    }
  },
  
  // 清除悬停描述（恢复为选中项描述）
  clearHoveredDescription: () => {
    if (selectedOption.value?.description) {
      currentDescription.value = selectedOption.value.description;
    } else {
      currentDescription.value = '';
    }
  },
  
  // 设置错误状态
  setError: (message: string) => {
    hasError.value = true;
    errorMessage.value = message;
  },
  
  // 清除错误状态
  clearError: () => {
    hasError.value = false;
    errorMessage.value = '';
  },
  
  // 更新选项属性
  updateOptionProperty: (value: string | number, property: keyof SelectOption, newValue: string|number) => {
    updateOptionProperty(value, property, newValue as string | number);
  }
};

provide('selectContext', selectContext);

// 计算属性
const selectedOption = computed(() => {
  const allOptions = hasSlotOptions.value ? slotOptions.value : props.options;
  return allOptions.find(opt => opt.value === props.modelValue);
});

const filteredOptions = computed(() => {
  if (!props.filterable || !filterText.value.trim()) {
    return props.options;
  }
  
  const searchText = filterText.value.toLowerCase();
  return props.options.filter(option => 
    option.label.toLowerCase().includes(searchText) ||
    (option.description && option.description.toLowerCase().includes(searchText))
  );
});

const sizeClass = computed(() => `select-size-${props.size}`);
const dropdownStyle = computed(() => {
  if (!triggerRef.value) return {};
  
  const rect = triggerRef.value.getBoundingClientRect();
  const windowHeight = window.innerHeight;
  
  const top = rect.bottom + 5;
  const left = rect.left;
  const width = rect.width;
  
  // 计算下拉框高度
  const optionCount = hasSlotOptions.value ? filteredSlotOptions.value.length : filteredOptions.value.length;
  const optionHeight = props.size === 'small' ? 36 : props.size === 'large' ? 48 : 40;
  const filterHeight = props.filterable ? 56 : 0;
  const descriptionHeight = ( (currentDescription.value || hasError.value)) ? 80 : 0;
  
  const estimatedHeight = Math.min(
    optionCount * optionHeight + filterHeight + descriptionHeight,
    400
  );
  
  // 判断空间
  const spaceBelow = windowHeight - rect.bottom - 10;
  const spaceAbove = rect.top - 10;
  
  let actualTop = top;
  if (spaceBelow < estimatedHeight && spaceAbove > estimatedHeight) {
    actualTop = rect.top - estimatedHeight - 5;
  }
  
  return {
    top: `${actualTop}px`,
    left: `${left}px`,
    width: `${width}px`,
    minHeight: '120px',
    maxHeight: '400px'
  };
});

// 计算选项列表的最大高度
const optionsMaxHeight = computed(() => {
  const filterHeight = props.filterable ? 56 : 0;
  const descriptionHeight = ((currentDescription.value || hasError.value)) ? 80 : 0;
  const maxDropdownHeight = 400;
  
  return `${maxDropdownHeight - filterHeight - descriptionHeight}px`;
});

const filterPlaceholder = computed(() => `搜索${props.filterable ? '选项或描述' : '选项'}...`);
const showEmptyState = computed(() => {
  console.log('showEmptyState', filteredOptions.value.length,filteredSlotOptions.value);
  if (hasSlotOptions.value) {
    return filteredSlotOptions.value.length === 0;
  }
  return filteredOptions.value.length === 0;
});
const emptyText = computed(() => 
  filterText.value ? t('select.notFound') : t('select.noData')
);

// 处理插槽选项
const slots = useSlots();
const slotOptions = ref<SelectOption[]>([]);
// 创建响应式的选项列表，用于跟踪动态变化
const reactiveSlotOptions = ref<SelectOption[]>([]);

const filteredSlotOptions = computed(() => {
  if (!props.filterable || !filterText.value.trim()) {
    return reactiveSlotOptions.value;
  }
  
  const searchText = filterText.value.toLowerCase();
  return reactiveSlotOptions.value.filter(option => 
    option.label.toLowerCase().includes(searchText) ||
    (option.description && option.description.toLowerCase().includes(searchText))
  );
});
const hasSlotOptions = computed(() => {
  return slots.default && (slotOptions.value.length > 0 || reactiveSlotOptions.value.length > 0);
});

// 初始化插槽选项
const extractOptionsFromSlots = () => {
  const defaultSlot = slots.default?.();
  if (!defaultSlot) {
    slotOptions.value = [];
    reactiveSlotOptions.value = [];
    return;
  }
  
  const options: SelectOption[] = [];
  
  const processVNodes = (vnodes: any[]) => {
    vnodes.forEach(vnode => {
      // 处理 v-for 生成的节点
      if (vnode.children && Array.isArray(vnode.children)) {
        processVNodes(vnode.children);
      }
      // 处理单个 Option 组件
      else if (vnode.type === Option) {
        const props = vnode.props || {};
        // 确保 value 和 label 存在且不为 undefined
        if (props.value !== undefined && props.label !== undefined) {
          options.push({
            value: props.value,
            label: props.label,
            description: props.description,
            disabled: props.disabled,
            default: props.default
          });
        }
      }
    });
  };
  
  processVNodes(defaultSlot);
  
  slotOptions.value = options;
  // 更新响应式选项列表
  reactiveSlotOptions.value = [...options];
};
// 监听插槽选项的更新
const updateSlotOptions = () => {
  const defaultSlot = slots.default?.();
  if (!defaultSlot) return;
  
  const processVNodes = (vnodes: any[]) => {
    vnodes.forEach(vnode => {
      // 处理 v-for 生成的节点
      if (vnode.children && Array.isArray(vnode.children)) {
        processVNodes(vnode.children);
      }
      // 处理单个 Option 组件
      else if (vnode.type === Option) {
        const props = vnode.props || {};
        // 确保 value 存在且不为 undefined
        if (props.value === undefined) return;
        
        const index = reactiveSlotOptions.value.findIndex(opt => opt.value === props.value);
        if (index !== -1  && reactiveSlotOptions.value[index]) {
          // 更新现有选项的属性
          if (props.label !== undefined ){
            reactiveSlotOptions.value[index].label = props.label;
          }
          if (props.description !== undefined) {
            reactiveSlotOptions.value[index].description = props.description;
          }
          if (props.disabled !== undefined) {
            reactiveSlotOptions.value[index].disabled = props.disabled;
          }
          if (props.default !== undefined) {
            reactiveSlotOptions.value[index].default = props.default;
          }
        } else if (props.label !== undefined) {
          // 如果选项不存在但有必要的属性，则添加新选项
          reactiveSlotOptions.value.push({
            value: props.value,
            label: props.label,
            description: props.description,
            disabled: props.disabled,
            default: props.default
          });
        }
      }
    });
  };
  
  processVNodes(defaultSlot);
};
// 更新特定选项的属性
const updateOptionProperty = (value: string | number, property: keyof SelectOption, newValue: string | number) => {
  // 更新插槽选项
  const slotIndex = reactiveSlotOptions.value.findIndex(opt => opt.value === value);
  if (slotIndex !== -1 && reactiveSlotOptions.value[slotIndex]) {
    reactiveSlotOptions.value[slotIndex] = {
      ...reactiveSlotOptions.value[slotIndex],
      [property]: newValue
    };
    console.log(reactiveSlotOptions.value);
  }
};

// 方法
const toggleDropdown = () => {
  if (props.disabled) return;
  
  dropdownVisible.value = !dropdownVisible.value;
  
  if (dropdownVisible.value) {
    nextTick(() => {
      // 聚焦到搜索框
      if (props.filterable && filterInputRef.value) {
        filterInputRef.value.focus();
      }
      
      // 滚动到选中项
      scrollToSelectedOption();
      
      // 初始描述
      if (selectedOption.value?.description && !currentDescription.value) {
        currentDescription.value = selectedOption.value.description;
      }
    });
  }
  
  emit('visible-change', dropdownVisible.value);
};

const closeDropdown = () => {
  dropdownVisible.value = false;
  filterText.value = '';
  emit('visible-change', false);
};

const handleClear = (e: Event) => {
  e.stopPropagation();
  emit('update:modelValue', '');
  emit('clear');
  selectContext.clearError();
  closeDropdown();
};

const handleFilter = () => {
  // 过滤逻辑已在 computed 中实现
};

const scrollToSelectedOption = () => {
  if (!optionsListRef.value || !props.modelValue) return;
  
  nextTick(() => {
    const selectedElement = optionsListRef.value?.querySelector('.option-item.is-selected');
    if (selectedElement) {
      selectedElement.scrollIntoView({ block: 'nearest' });
    }
  });
};

// 生命周期
onMounted(() => {
  // 提取插槽选项
  extractOptionsFromSlots();
  
  // 监听外部点击
  document.addEventListener('click', handleClickOutside);
  
  // 监听键盘事件
  document.addEventListener('keydown', handleKeydown);
  
  // 控制清除按钮显示
  watch(triggerHover, (newVal) => {
    if (props.clearable && props.modelValue !== undefined && props.modelValue !== '' && !props.disabled) {
      showClear.value = newVal;
    }
  });
  
  // 监听 modelValue 变化，更新描述
  watch(() => props.modelValue, (newVal, oldVal) => {
    if (newVal !== oldVal) {
      const allOptions = hasSlotOptions.value ? slotOptions.value : props.options;
      const option = allOptions.find(opt => opt.value === newVal);
      if (option?.description) {
        currentDescription.value = option.description;
      } else {
        currentDescription.value = '';
      }
      selectContext.clearError();
    }
  });
  
  // 监听插槽变化
  watch(() => slots.default, () => {
    updateSlotOptions();
  }, { deep: true });
  
  // 监听props.options变化
  watch(() => props.options, (newOptions) => {
    // 当props.options变化时，更新内部状态
    if (!hasSlotOptions.value) {
      // 如果不是使用插槽选项，则更新过滤后的选项
      // 触发重新计算filteredOptions
    }
  }, { deep: true });
});

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside);
  document.removeEventListener('keydown', handleKeydown);
});

const handleClickOutside = (e: MouseEvent) => {
  if (!dropdownVisible.value) return;
  
  const target = e.target as HTMLElement;
  const isInside = 
    containerRef.value?.contains(target) || 
    dropdownRef.value?.contains(target);
  
  if (!isInside) {
    closeDropdown();
  }
};

const handleKeydown = (e: KeyboardEvent) => {
  if (!dropdownVisible.value) return;
  
  switch (e.key) {
    case 'Escape':
      closeDropdown();
      break;
    case 'Enter':
      if (document.activeElement === filterInputRef.value) {
        e.preventDefault();
        // 选择第一个选项
        const options = hasSlotOptions.value ? filteredSlotOptions.value : filteredOptions.value;
        if (options.length > 0 &&options[0] && !options[0].disabled) {
          selectContext.updateSelected(options[0].value, options[0]);
        }
      }
      break;
  }
};
</script>


<style scoped>
.custom-select {
  position: relative;
  display: inline-flex;
  flex-direction: column;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
}

.select-trigger {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 12px;
  background-color: var(--select-bg);
  border: 1px solid var(--select-border);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
  user-select: none;
  min-height: 40px;
  box-sizing: border-box;
}

.select-trigger:hover:not(.is-disabled) {
  border-color: var(--select-border-hover);
}

.select-trigger.is-focused:not(.is-disabled) {
  border-color: var(--select-border-focus);
  box-shadow: 0 0 0 2px rgba(64, 158, 255, 0.1);
}

.select-trigger.is-open:not(.is-disabled) {
  border-color: var(--select-border-focus);
}

.select-trigger.is-disabled {
  background-color: var(--select-disabled-bg);
  border-color: var(--select-disabled-border);
  color: var(--select-disabled-text);
  cursor: not-allowed;
}

.select-trigger.has-value .selected-label {
  color: var(--select-text-color);
}

.selected-content {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  line-height: 2;
}

.placeholder {
  color: var(--select-placeholder-color);
}

.select-icons {
  display: flex;
  align-items: center;
  margin-left: 8px;
  color: var(--select-placeholder-color);
  gap: 4px;
}

.clear-icon,
.arrow-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  cursor: pointer;
}

.clear-icon {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background-color: var(--select-clear-bg);
}

.clear-icon:hover {
  background-color: var(--select-clear-bg-hover);
  color: var(--select-description-text);
}

.clear-icon .icon,
.arrow-icon .icon {
  width: 14px;
  height: 14px;
  fill: currentColor;
}

.icon-divider {
  width: 1px;
  height: 16px;
  background-color: #e4e7ed;
}

.arrow-icon {
  transition: transform 0.2s ease;
}

.arrow-icon.is-open {
  transform: rotate(180deg);
}

/* 下拉菜单 */
.select-dropdown {
  position: fixed;
  background-color: var(--select-bg);
  border: 1px solid var(--select-border);
  border-radius: 6px;
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.1);
  z-index: 9999;
  overflow: hidden;
  animation: dropdown-slide-down 0.2s ease;
  display: flex;
  flex-direction: column;
}

@keyframes dropdown-slide-down {
  from {
    opacity: 0;
    transform: translateY(-8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.filter-section {
  padding: 8px;
  background-color: var(--select-bg);
  border-bottom: 1px solid var(--select-description-border);
  flex-shrink: 0;
}

.filter-input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.search-icon {
  position: absolute;
  left: 10px;
  width: 16px;
  height: 16px;
  fill: var(--select-placeholder-color);
  pointer-events: none;
}

.filter-input {
  width: 100%;
  padding: 8px 32px 8px 34px;
  border: 1px solid var(--select-border);
  border-radius: 4px;
  font-size: 13px;
  outline: none;
  transition: border-color 0.2s ease;
  background-color: var(--select-disabled-bg);
  color: var(--select-text-color);
}

.filter-input:focus {
  border-color: var(--select-border-focus);
  background-color: var(--select-bg);
}

.filter-clear {
  position: absolute;
  right: 10px;
  width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: var(--select-placeholder-color);
  border-radius: 50%;
  background-color: var(--select-clear-bg);
  transition: all 0.2s ease;
}

.filter-clear:hover {
  background-color: var(--select-clear-bg-hover);
  color: var(--select-description-text);
}

.filter-clear svg {
  width: 12px;
  height: 12px;
}

.options-container {
  overflow-y: auto;
  flex: 1;
  padding: 4px 0;
}

.options-container.has-filter {
  border-top: 1px solid #f0f0f0;
}

.option-item-wrapper {
  margin: 0;
  padding: 0;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 32px 16px;
  color: #c0c4cc;
}

.empty-icon {
  width: 48px;
  height: 48px;
  fill: #e4e7ed;
  margin-bottom: 12px;
}

.empty-text {
  font-size: 14px;
  text-align: center;
}

/* 下拉框底部的描述区域 */
.dropdown-description {
  border-top: 1px solid var(--select-border);
  background-color: var(--select-bg);
  padding: 12px;
  flex-shrink: 0;
  animation: description-fade-in 0.2s ease;
}

.dropdown-description.is-error {
  background-color: #fef0f0;
  border-color: #fde2e2;
}

@keyframes description-fade-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.description-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.description-icon {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
}

.description-icon.info {
  fill: var(--select-secondary-text);
}

.description-icon.error {
  fill: var(--select-error-text);
}

.description-title {
  font-size: 12px;
  font-weight: 500;
  color: var(--select-secondary-text);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.dropdown-description.is-error .description-title {
  color: var(--select-error-text);
}

.description-text {
  font-size: 13px;
  line-height: 1.5;
  color: var(--select-description-text);
  word-break: break-word;
  max-height: 60px;
  overflow-y: auto;
}

.dropdown-description.is-error .description-text {
  color: var(--select-error-text);
}

/* 尺寸样式 */
.select-size-small .select-trigger {
  min-height: 32px;
  font-size: 12px;
}

.select-size-small .selected-content {
  font-size: 12px;
}

.select-size-small .dropdown-description {
  padding: 8px 12px;
}

.select-size-small .description-title {
  font-size: 11px;
}

.select-size-small .description-text {
  font-size: 12px;
}

.select-size-large .select-trigger {
  min-height: 48px;
  font-size: 16px;
}

.select-size-large .selected-content {
  font-size: 16px;
}

.select-size-large .dropdown-description {
  padding: 16px;
}

.select-size-large .description-title {
  font-size: 13px;
}

.select-size-large .description-text {
  font-size: 14px;
}

/* 错误状态 */
.custom-select.is-error .select-trigger {
  border-color: var(--select-error-text);
}

.custom-select.is-error .select-trigger:hover:not(.is-disabled) {
  border-color: var(--select-error-text);
}

.custom-select.is-error .select-trigger.is-focused:not(.is-disabled) {
  border-color: var(--select-error-text);
  box-shadow: 0 0 0 2px rgba(245, 108, 108, 0.1);
}

/* 滚动条样式 */
.options-container::-webkit-scrollbar,
.description-text::-webkit-scrollbar {
  width: 6px;
}

.options-container::-webkit-scrollbar-track,
.description-text::-webkit-scrollbar-track {
  background: #f5f5f5;
  border-radius: 3px;
}

.options-container::-webkit-scrollbar-thumb,
.description-text::-webkit-scrollbar-thumb {
  background: #c1c1c1;
  border-radius: 3px;
}

.options-container::-webkit-scrollbar-thumb:hover,
.description-text::-webkit-scrollbar-thumb:hover {
  background: #a8a8a8;
}
</style>