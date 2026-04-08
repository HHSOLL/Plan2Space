import { Router } from "express";
import { listPublishedSnapshots } from "../repositories/projects-repo";

export const showcaseRouter = Router();

showcaseRouter.get("/showcase", async (request, response, next) => {
  try {
    const limit = Math.min(Math.max(Number(request.query.limit ?? 24), 1), 60);
    const items = await listPublishedSnapshots(limit);
    response.status(200).json({ items });
  } catch (error) {
    next(error);
  }
});
