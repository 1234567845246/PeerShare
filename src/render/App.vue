<template>
  <div class="app-container">
    <Navigation />
    <RouterView v-slot="{ Component }">
      <KeepAlive>
        <component :is="Component" />
      </KeepAlive>
    </RouterView>
  </div>
</template>

<script setup lang="ts">
import { onMounted, KeepAlive } from 'vue';
import Navigation from './components/Navigation.vue'
import { RouterView } from 'vue-router'
import { getShortcutManager } from './shortcuts/shortcuts';
// import { notify, notifyError, notifySuccess } from './notification/notification';

onMounted(() => {
  // notify({ title: 'App Loaded', body: 'Welcome back to PeerShare!' });
  // notifyError({ title: 'Test Error', body: 'This is a test error notification.' });
  // notifySuccess({ title: 'Test Success', body: 'This is a test success notification.' });
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
