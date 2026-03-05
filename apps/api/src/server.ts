import { createApp } from "./app";
import { env } from "./config/env";

const app = createApp();

app.listen(env.API_PORT, () => {
  console.log(`[api] listening on :${env.API_PORT}`);
});
