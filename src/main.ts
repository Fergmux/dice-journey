import "./style.css";

import { createApp } from "vue";

import Tooltip from "primevue/tooltip";

import App from "./App.vue";
import { router } from "./router";

createApp(App)
  .directive("tooltip", Tooltip)
  .use(router)
  .mount("#app");
