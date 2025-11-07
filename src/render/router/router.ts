import { createMemoryHistory, createRouter } from "vue-router";
import HomePage from '../components/HomePage.vue';
import SendPage from '../components/SendPage.vue';
import ReceivePage from '../components/ReceivePage.vue';

const routes = [
  {
    path: '/',
    component: HomePage
  },
  {
    path: '/send',
    component: SendPage
  },
  {
    path: '/receive',
    component: ReceivePage
  }
] as const;

export const router = createRouter({
  history: createMemoryHistory(),
  routes: routes as any,
});