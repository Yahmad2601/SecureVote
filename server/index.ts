import "dotenv/config";
import { createApp } from "./app";
import { log } from "./vite";

const mode = process.env.NODE_ENV === "production" ? "production" : "development";

(async () => {
  try {
    const { server } = await createApp(mode);

    const port = parseInt(process.env.PORT || "5000", 10);
    server.listen(
      {
        port,
        host: "127.0.0.1",
      },
      () => {
        log(`serving on port ${port}`);
      }
    );
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
})();
