import {
  createMemoryHistory,
  createRouter,
} from "vue-router";

import Builder from "./components/Builder.vue";
import History from "./components/History.vue";
import Home from "./components/Home.vue";
import Roller from "./components/Roller.vue";

const routes = [
  { path: '/', component: Home },
  { path: '/roller', component: Roller },
  { path: '/builder', component: Builder },
  { path: '/history', component: History },
]

export const router = createRouter({
  history: createMemoryHistory(),
  routes,
})