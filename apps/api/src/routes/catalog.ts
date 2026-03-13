import { Router } from "express";
import { z } from "zod";
import { searchCatalogCandidates } from "../repositories/catalog-repo";

const CatalogSearchQuerySchema = z.object({
  apartmentName: z.string().trim().min(1).optional(),
  typeName: z.string().trim().min(1).optional(),
  region: z.string().trim().min(1).optional(),
  limit: z.coerce.number().int().positive().max(20).optional()
});

export const catalogRouter = Router();

catalogRouter.get("/catalog/search", async (request, response, next) => {
  try {
    const query = CatalogSearchQuerySchema.parse(request.query);
    const items = await searchCatalogCandidates(query);
    response.status(200).json({ items });
  } catch (error) {
    next(error);
  }
});
