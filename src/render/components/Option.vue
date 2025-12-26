<!-- components/BottomDescriptionSelect/Option.vue -->
<template>
  <div
    class="option-item"
    :class="[
      { 
        'is-selected': isSelected,
        'is-disabled': disabled,
        'is-hovered': isHovered
      }
    ]"
    @click="handleClick"
    @mouseenter="handleMouseEnter"
    @mouseleave="handleMouseLeave"
  >
    <div class="option-content">
      <!-- 选中图标 -->
      <div v-if="isSelected" class="selected-indicator">
        <svg viewBox="0 0 24 24" class="check-icon">
          <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
        </svg>
      </div>
      
      <!-- 选项内容 -->
      <div class="option-text">
        <div class="option-label">{{ dynamicLabel }}</div>
      </div>
      <!-- 右侧标记（如：默认） -->
      <div v-if="default" class="option-right">{{ $t('option.default') }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, inject, ref, watch } from 'vue';
import type { SelectOption ,OptionProps} from '../../common/types';



const props = withDefaults(defineProps<OptionProps>(), {
  default:false,
  disabled:false
});

const selectContext = inject('selectContext', {
  selectedValue: { value: null },
  hoveredDescription: ref(''),
  updateSelected: (_value: string | number, _option: SelectOption) => {},
  updateHoveredDescription: (_description: string | undefined) => {},
  clearHoveredDescription: () => {},
  setError: (_message: string) => {},
  clearError: () => {},
  updateOptionProperty: (_value: string | number, _property: keyof SelectOption, _newValue: string|number) => {}
});

// 创建响应式数据来存储动态变化的label和description
const dynamicLabel = ref(props.label);
const dynamicDescription = ref(props.description);

// 监听props变化并更新响应式数据
watch(() => props.label, (newLabel) => {
  dynamicLabel.value = newLabel;
  selectContext.updateOptionProperty(props.value, 'label', newLabel);
},{ immediate: true });

watch(() => props.description, (newDescription) => {
  dynamicDescription.value = newDescription;
  selectContext.updateOptionProperty(props.value, 'description', newDescription || '');
},{ immediate: true });




const isHovered = ref(false);


// 计算属性
const isSelected = computed(() => {
  return selectContext.selectedValue.value === props.value;
});

// 方法
const handleClick = () => {
  if (props.disabled) {
    selectContext.setError('此选项已被禁用');
    return;
  }
  
  const option: SelectOption = {
    value: props.value,
    label: dynamicLabel.value,
    description: dynamicDescription.value,
    disabled: props.disabled,
    default:props.default,
  };
  
  selectContext.updateSelected(props.value, option);
  selectContext.clearError();
};

const handleMouseEnter = () => {
  if (props.disabled) return;
  
  isHovered.value = true;
  if (dynamicDescription.value) {
    selectContext.updateHoveredDescription(dynamicDescription.value);
  }
};

const handleMouseLeave = () => {
  isHovered.value = false;
  selectContext.clearHoveredDescription();
};
</script>

<style scoped>
.option-item {
  padding: 8px 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  user-select: none;
}

.option-item:hover:not(.is-disabled) {
  background-color: var(--option-bg-hover);
}

.option-item.is-selected {
  background-color: var(--option-bg-selected);
  color: var(--option-text-selected);
  font-weight: 500;
}

.option-item.is-selected .check-icon {
  fill: var(--option-text-selected);
}

.option-item.is-hovered:not(.is-disabled) {
  background-color: var(--option-bg-hover);
}

.option-item.is-disabled {
  color: var(--option-text-disabled);
  cursor: not-allowed;
  background-color: transparent;
}

.option-item.is-disabled:hover {
  background-color: #fff;
}

.option-content {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 24px;
}

.selected-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}

.check-icon {
  width: 16px;
  height: 16px;
  fill: transparent;
}

.option-text {
  flex: 1;
  min-width: 0;
}

.option-right {
  margin-left: 8px;
  color: var(--option-badge-text);
  font-size: 12px;
  background: var(--option-badge-bg);
  padding: 2px 6px;
  border-radius: 4px;
  white-space: nowrap;
  align-self: center;
}

.option-label {
  font-size: 14px;
  line-height: 1.5;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.inline-description {
  font-size: 12px;
  color: #909399;
  margin-top: 2px;
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  line-clamp: 2;
  -webkit-box-orient: vertical;
}

/* 适配不同尺寸 */
:deep(.select-size-small) .option-item {
  padding: 6px 10px;
  min-height: 30px;
}

:deep(.select-size-small) .option-label {
  font-size: 12px;
}

:deep(.select-size-small) .inline-description {
  font-size: 11px;
}

:deep(.select-size-small) .selected-indicator {
  width: 14px;
  height: 14px;
}

:deep(.select-size-small) .check-icon {
  width: 14px;
  height: 14px;
}

:deep(.select-size-large) .option-item {
  padding: 12px 16px;
  min-height: 42px;
}

:deep(.select-size-large) .option-label {
  font-size: 16px;
}

:deep(.select-size-large) .inline-description {
  font-size: 14px;
}

:deep(.select-size-large) .selected-indicator {
  width: 18px;
  height: 18px;
}

:deep(.select-size-large) .check-icon {
  width: 18px;
  height: 18px;
}
</style>