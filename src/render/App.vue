<template>
  <div class="app-container" >
    <Navigation />
    <RouterView v-slot="{ Component }">
      <KeepAlive>
          <component :is="Component"/>
      </KeepAlive>
    </RouterView>
  </div>
</template>

<script setup lang="ts">
import { onMounted,KeepAlive } from 'vue';
import Navigation from './components/Navigation.vue'
import { RouterView } from 'vue-router'
import { getShortcutManager } from './shortcuts/shortcuts';

onMounted(()=>{
  getShortcutManager().addShortcut('ctrl+i', () => {
      window.electronAPI.openDevTools();
  });
})
</script>

<style lang="css" scoped>
.app-container {
  width: 100%;
  height: 100%;
  background: var(--bg-secondary);
  box-shadow: var(--shadow);
  overflow: hidden;
}
</style>
