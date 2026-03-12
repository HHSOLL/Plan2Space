import { Router } from "express";
import { getLayoutRevisionVisibleToOwner } from "../repositories/revisions-repo";
import { ApiError } from "../services/errors";

export const revisionsRouter = Router();

revisionsRouter.get("/layout-revisions/:layoutRevisionId", async (request, response, next) => {
  try {
    const ownerId = request.user?.id;
    if (!ownerId) throw new ApiError(401, "Unauthorized");

    const revision = await getLayoutRevisionVisibleToOwner(request.params.layoutRevisionId, ownerId);
    if (!revision) throw new ApiError(404, "Layout revision not found.");

    response.status(200).json({ revision });
  } catch (error) {
    next(error);
  }
});
