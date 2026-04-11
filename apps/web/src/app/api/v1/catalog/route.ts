import { NextResponse } from "next/server";
import { browseCatalog, CatalogApiError } from "../../../../lib/server/catalog";

export const runtime = "nodejs";
export const revalidate = 120;

const DEFAULT_LIMIT = 60;
const MAX_LIMIT = 240;

function parseIntegerParam(
  value: string | null,
  {
    fallback,
    min,
    max,
    name
  }: {
    fallback: number;
    min: number;
    max: number;
    name: string;
  }
) {
  if (value === null) {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new CatalogApiError(`Invalid ${name} query parameter.`, 400);
  }

  return parsed;
}

function toErrorResponse(error: unknown) {
  if (error instanceof CatalogApiError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  const message = error instanceof Error ? error.message : "Catalog browse is unavailable.";
  return NextResponse.json({ error: message }, { status: 500 });
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const result = await browseCatalog({
      query: searchParams.get("q")?.trim() ?? "",
      categoryId: searchParams.get("category")?.trim() || "all",
      limit: parseIntegerParam(searchParams.get("limit"), {
        fallback: DEFAULT_LIMIT,
        min: 1,
        max: MAX_LIMIT,
        name: "limit"
      }),
      offset: parseIntegerParam(searchParams.get("offset"), {
        fallback: 0,
        min: 0,
        max: Number.MAX_SAFE_INTEGER,
        name: "offset"
      })
    });

    return NextResponse.json(result, {
      status: 200,
      headers: {
        "Cache-Control": "s-maxage=120, stale-while-revalidate=600"
      }
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
