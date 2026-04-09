import { assetsRouter } from "./routes/assets";
import { catalogRouter } from "./routes/catalog";
import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import { env, isCorsOriginAllowed } from "./config/env";
import { requireAuth } from "./middleware/auth";
import { ApiError } from "./services/errors";
import { floorplansRouter } from "./routes/floorplans";
import { healthRouter } from "./routes/health";
import { intakeRouter } from "./routes/intake";
import { jobsRouter } from "./routes/jobs";
import { projectsRouter } from "./routes/projects";
import { revisionsRouter } from "./routes/revisions";
import { scenesRouter } from "./routes/scenes";
import { showcaseRouter } from "./routes/showcase";

function serializeUnknownError(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  if (error && typeof error === "object") {
    try {
      return JSON.stringify(error);
    } catch {
      return "[unserializable error object]";
    }
  }

  return String(error);
}

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
  app.use("/v1", showcaseRouter);

  app.use("/v1", requireAuth, projectsRouter);
  app.use("/v1", requireAuth, assetsRouter);
  app.use("/v1", requireAuth, catalogRouter);

  if (env.ENABLE_LEGACY_API_ROUTES) {
    app.use("/v1", requireAuth, intakeRouter);
    app.use("/v1", requireAuth, floorplansRouter);
    app.use("/v1", requireAuth, jobsRouter);
    app.use("/v1", requireAuth, revisionsRouter);
    app.use("/v1", requireAuth, scenesRouter);
  }

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

    const message = serializeUnknownError(error);
    response.status(500).json({ error: "Internal server error", details: message });
  });

  return app;
}
