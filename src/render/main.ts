import { createApp } from 'vue'
import './style.css'
import { router } from './router/router.ts'
import App from './App.vue'

const app = createApp(App)

app.use(router as any)

app.mount('#app')