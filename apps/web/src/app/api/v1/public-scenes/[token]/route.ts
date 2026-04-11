import { NextResponse } from "next/server";
import { fetchPublicSceneByToken, PublicSceneError } from "../../../../../lib/server/public-scenes";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: { token: string } }) {
  const token = context.params.token?.trim();
  if (!token) {
    return NextResponse.json({ error: "Token is required." }, { status: 400 });
  }

  try {
    const scene = await fetchPublicSceneByToken(token);
    return NextResponse.json(
      { scene },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store"
        }
      }
    );
  } catch (error) {
    if (error instanceof PublicSceneError) {
      return NextResponse.json(
        { error: error.message },
        {
          status: error.status,
          headers: {
            "Cache-Control": "no-store"
          }
        }
      );
    }

    return NextResponse.json(
      { error: "Public scene is unavailable right now." },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store"
        }
      }
    );
  }
}
