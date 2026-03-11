import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import { isCorsOriginAllowed } from "./config/env";
import { requireAuth } from "./middleware/auth";
import { ApiError } from "./services/errors";
import { floorplansRouter } from "./routes/floorplans";
import { healthRouter } from "./routes/health";
import { jobsRouter } from "./routes/jobs";
import { projectsRouter } from "./routes/projects";
import { scenesRouter } from "./routes/scenes";

export function createApp() {
  const app = express();

  app.use(
    cors({
      origin(origin, callback) {
        if (isCorsOriginAllowed(origin)) {
          callback(null, true);
          return;
        }
        callback(null, false);
      },
      credentials: true
    })
  );
  app.use(express.json({ limit: "20mb" }));

  app.use("/v1", healthRouter);

  app.use("/v1", requireAuth, projectsRouter);
  app.use("/v1", requireAuth, floorplansRouter);
  app.use("/v1", requireAuth, jobsRouter);
  app.use("/v1", requireAuth, scenesRouter);

  app.use((_request, response) => {
    response.status(404).json({ error: "Not found" });
  });

  app.use((error: unknown, _request: Request, response: Response, _next: NextFunction) => {
    if (error instanceof ApiError) {
      response.status(error.status).json({
        error: error.message,
        ...(error.payload ?? {})
      });
      return;
    }

    if (error && typeof error === "object" && "name" in error && error.name === "ZodError") {
      response.status(400).json({
        error: "Invalid request payload",
        details: (error as any).issues ?? []
      });
      return;
    }

    const message = error instanceof Error ? error.message : String(error);
    response.status(500).json({ error: "Internal server error", details: message });
  });

  return app;
}
