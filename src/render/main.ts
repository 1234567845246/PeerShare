import { createApp } from 'vue'
import './assets/style.css'
import'@fortawesome/fontawesome-free/css/all.min.css'
import { router } from './router/router.ts'
import App from './App.vue'

const app = createApp(App)

app.use(router as any)

app.mount('#app')