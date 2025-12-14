import { createApp } from 'vue'
import './assets/style.css'
import'@fortawesome/fontawesome-free/css/all.min.css'
import { router } from './router/router.ts'
import App from './App.vue'
import { i18n } from './i18n/i18n.ts'

const app = createApp(App)

app.use(router as any).use(i18n);

app.mount('#app')