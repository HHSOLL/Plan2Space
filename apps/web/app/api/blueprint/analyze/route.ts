import { NextResponse } from "next/server";

type Units = "mm" | "cm" | "m";

type NormalizedLayout = {
  units: Units;
  rooms: Array<{ id: string; label: string; polygon: Array<[number, number]>; height?: number }>;
  walls: Array<{ id: string; from: [number, number]; to: [number, number]; thickness?: number; height?: number }>;
  doors: Array<{ id: string; wall: string; offset: number; width: number; height?: number; swing?: "cw" | "ccw" }>;
  windows: Array<{ id: string; wall: string; offset: number; width: number; sillHeight?: number; height?: number }>;
  openings?: Array<{ id: string; wall: string; offset: number; width: number; height?: number }>;
  metadata?: Record<string, unknown>;
};

type GeminiResponse = {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
};

type ImagePayload = {
  data: string;
  mimeType: string;
};

async function fileToBase64(file: File): Promise<ImagePayload> {
  const buffer = Buffer.from(await file.arrayBuffer());
  return { data: buffer.toString("base64"), mimeType: file.type || "image/jpeg" };
}

async function imageUrlToBase64(url: string): Promise<ImagePayload> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch imageUrl: ${res.status}`);
  }
  const buffer = Buffer.from(await res.arrayBuffer());
  const mimeType = res.headers.get("content-type")?.split(";")[0] || "image/jpeg";
  return { data: buffer.toString("base64"), mimeType };
}

function buildPrompt() {
  return `
You are an architectural parser. Extract a normalized floor plan JSON from the provided blueprint image.
Return only JSON, nothing else.
Schema (JSON only):
{
  "units": "mm",
  "rooms": [{ "id": "living", "label": "Living Room", "polygon": [[x,y], ...], "height": 2700 }],
  "walls": [{ "id": "w1", "from": [x,y], "to": [x,y], "thickness": 200, "height": 2700 }],
  "doors": [{ "id": "d1", "wall": "w1", "offset": 1200, "width": 900, "height": 2100, "swing": "cw" }],
  "windows": [{ "id": "win1", "wall": "w1", "offset": 2600, "width": 1500, "sillHeight": 900, "height": 1200 }],
  "openings": []
}
Rules:
- Use millimeters and integer coordinates.
- Origin is the bottom-left corner of the outer wall bounding box.
- X increases to the right, Y increases upward.
- Walls are centerlines. Merge colinear segments into a single wall when possible.
- Wall endpoints must meet at intersections (no gaps).
- Doors/windows must reference a wall id. Offset is along wall direction from "from".
- Keep room polygons clockwise and closed. Use room labels from text; if missing, use "Room".
- Ignore furniture and annotations that are not walls, doors, or windows.
- If unsure about doors/windows, return empty arrays for them but keep walls.
Output JSON only.
`.trim();
}

function parseModelJson(text: string): NormalizedLayout | null {
  try {
    const cleaned = text
      .replace(/```json/gi, "```")
      .replace(/```/g, "")
      .replace(/\u0000/g, "")
      .replace(/,\s*([}\]])/g, "$1");
    const jsonStart = cleaned.indexOf("{");
    const jsonEnd = cleaned.lastIndexOf("}");
    if (jsonStart === -1 || jsonEnd === -1) return null;
    const sliced = cleaned.slice(jsonStart, jsonEnd + 1);
    return JSON.parse(sliced) as NormalizedLayout;
  } catch (err) {
    console.error("Failed to parse model JSON", err);
    return null;
  }
}

function normalizeLayout(input: NormalizedLayout): NormalizedLayout {
  const units: Units = input.units === "cm" || input.units === "m" ? input.units : "mm";
  return {
    units,
    rooms: Array.isArray(input.rooms) ? input.rooms : [],
    walls: Array.isArray(input.walls) ? input.walls : [],
    doors: Array.isArray(input.doors) ? input.doors : [],
    windows: Array.isArray(input.windows) ? input.windows : [],
    openings: Array.isArray(input.openings) ? input.openings : [],
    metadata: input.metadata ?? {}
  };
}

function polygonArea(points: Array<[number, number]>) {
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const [x1, y1] = points[i]!;
    const [x2, y2] = points[(i + 1) % points.length]!;
    sum += x1 * y2 - x2 * y1;
  }
  return sum / 2;
}

function sanitizeLayout(layout: NormalizedLayout): NormalizedLayout {
  const snapMm = 10;
  const snap = (n: number) => (layout.units === "mm" ? Math.round(n / snapMm) * snapMm : n);
  const num = (value: unknown) => {
    const n = typeof value === "number" ? value : Number(value);
    return Number.isFinite(n) ? n : null;
  };
  const cleanPoint = (p: [number, number]) => {
    const x = num(p[0]);
    const y = num(p[1]);
    if (x === null || y === null) return null;
    return [snap(x), snap(y)] as [number, number];
  };

  const walls = layout.walls
    .map((w) => {
      if (!Array.isArray(w.from) || !Array.isArray(w.to)) return null;
      const from = cleanPoint(w.from);
      const to = cleanPoint(w.to);
      if (!from || !to) return null;
      const length = Math.hypot(to[0] - from[0], to[1] - from[1]);
      if (!Number.isFinite(length) || length < 50) return null;
      const thicknessValue = num(w.thickness);
      const heightValue = num(w.height);
      const thickness = thicknessValue ? Math.max(50, snap(thicknessValue)) : w.thickness;
      const height = heightValue ? Math.max(1800, snap(heightValue)) : w.height;
      return { ...w, from, to, thickness, height };
    })
    .filter(Boolean) as NormalizedLayout["walls"];

  const wallLengths = new Map<string, number>();
  for (const w of walls) {
    wallLengths.set(w.id, Math.hypot(w.to[0] - w.from[0], w.to[1] - w.from[1]));
  }

  const clampOffset = (wallId: string, offset: number, width: number) => {
    const length = wallLengths.get(wallId);
    if (!length || width <= 0) return null;
    const maxOffset = Math.max(0, length - width);
    return Math.min(Math.max(offset, 0), maxOffset);
  };

  const doors = layout.doors
    .map((d) => {
      if (!wallLengths.has(d.wall)) return null;
      const widthValue = num(d.width);
      const offsetValue = num(d.offset);
      if (widthValue === null || offsetValue === null) return null;
      const width = snap(Math.max(0, widthValue));
      const offset = clampOffset(d.wall, snap(offsetValue), width);
      if (offset === null || width <= 0) return null;
      const heightValue = num(d.height);
      const height = heightValue ? Math.max(1800, snap(heightValue)) : d.height;
      return { ...d, offset, width, height };
    })
    .filter(Boolean) as NormalizedLayout["doors"];

  const windows = layout.windows
    .map((w) => {
      if (!wallLengths.has(w.wall)) return null;
      const widthValue = num(w.width);
      const offsetValue = num(w.offset);
      if (widthValue === null || offsetValue === null) return null;
      const width = snap(Math.max(0, widthValue));
      const offset = clampOffset(w.wall, snap(offsetValue), width);
      if (offset === null || width <= 0) return null;
      const heightValue = num(w.height);
      const sillValue = num(w.sillHeight);
      const height = heightValue ? Math.max(400, snap(heightValue)) : w.height;
      const sillHeight = sillValue ? Math.max(200, snap(sillValue)) : w.sillHeight;
      return { ...w, offset, width, height, sillHeight };
    })
    .filter(Boolean) as NormalizedLayout["windows"];

  const openings = (layout.openings ?? [])
    .map((o) => {
      if (!wallLengths.has(o.wall)) return null;
      const widthValue = num(o.width);
      const offsetValue = num(o.offset);
      if (widthValue === null || offsetValue === null) return null;
      const width = snap(Math.max(0, widthValue));
      const offset = clampOffset(o.wall, snap(offsetValue), width);
      if (offset === null || width <= 0) return null;
      const heightValue = num(o.height);
      const height = heightValue ? Math.max(1800, snap(heightValue)) : o.height;
      return { ...o, offset, width, height };
    })
    .filter(Boolean) as NonNullable<NormalizedLayout["openings"]>;

  const rooms = layout.rooms
    .map((r) => {
      if (!Array.isArray(r.polygon)) return null;
      const polygon = r.polygon.map(cleanPoint).filter(Boolean) as Array<[number, number]>;
      const deduped = polygon.filter((p, idx) => {
        if (idx === 0) return true;
        const prev = polygon[idx - 1]!;
        return p[0] !== prev[0] || p[1] !== prev[1];
      });
      if (deduped.length < 3) return null;
      if (deduped.length > 3) {
        const first = deduped[0]!;
        const last = deduped[deduped.length - 1]!;
        if (first[0] === last[0] && first[1] === last[1]) deduped.pop();
      }
      if (deduped.length < 3) return null;
      if (polygonArea(deduped) > 0) deduped.reverse();
      const heightValue = num(r.height);
      const height = heightValue ? Math.max(2000, snap(heightValue)) : r.height;
      return { ...r, polygon: deduped, height };
    })
    .filter(Boolean) as NormalizedLayout["rooms"];

  return {
    ...layout,
    walls,
    doors,
    windows,
    openings,
    rooms
  };
}

function mockLayout(): NormalizedLayout {
  return {
    units: "mm",
    rooms: [
      { id: "living", label: "Living Room", polygon: [[0, 0], [5200, 0], [5200, 4200], [0, 4200]], height: 2700 },
      { id: "kitchen", label: "Kitchen", polygon: [[5200, 0], [9000, 0], [9000, 4200], [5200, 4200]], height: 2700 },
      { id: "bed", label: "Bedroom", polygon: [[0, 4200], [4500, 4200], [4500, 8200], [0, 8200]], height: 2700 },
      { id: "bath", label: "Bathroom", polygon: [[4500, 4200], [9000, 4200], [9000, 8200], [4500, 8200]], height: 2700 }
    ],
    walls: [
      { id: "w1", from: [0, 0], to: [9000, 0], thickness: 200, height: 2700 },
      { id: "w2", from: [9000, 0], to: [9000, 8200], thickness: 200, height: 2700 },
      { id: "w3", from: [9000, 8200], to: [0, 8200], thickness: 200, height: 2700 },
      { id: "w4", from: [0, 8200], to: [0, 0], thickness: 200, height: 2700 },
      { id: "w5", from: [5200, 0], to: [5200, 4200], thickness: 150, height: 2700 },
      { id: "w6", from: [0, 4200], to: [9000, 4200], thickness: 150, height: 2700 },
      { id: "w7", from: [4500, 4200], to: [4500, 8200], thickness: 150, height: 2700 }
    ],
    doors: [
      { id: "d_entry", wall: "w4", offset: 2000, width: 900, height: 2100, swing: "cw" },
      { id: "d_bed", wall: "w6", offset: 1500, width: 800, height: 2100, swing: "cw" },
      { id: "d_bath", wall: "w7", offset: 1200, width: 800, height: 2100, swing: "ccw" }
    ],
    windows: [
      { id: "win_living", wall: "w1", offset: 800, width: 1600, sillHeight: 900, height: 1200 },
      { id: "win_bed", wall: "w3", offset: 600, width: 1400, sillHeight: 900, height: 1200 }
    ],
    openings: []
  };
}

export async function POST(req: Request) {
  try {
    const contentType = req.headers.get("content-type") || "";
    if (!contentType.includes("multipart/form-data")) {
      return NextResponse.json({ error: "Use multipart/form-data with 'file' or 'imageUrl' field" }, { status: 400 });
    }

    const form = await req.formData();
    const file = form.get("file");
    const imageUrl = form.get("imageUrl") as string | null;

    if (!file && !imageUrl) {
      return NextResponse.json({ error: "Provide blueprint image via 'file' or 'imageUrl'." }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ source: "mock", layout: mockLayout(), warning: "GEMINI_API_KEY missing. Returning mock layout." });
    }

    const prompt = buildPrompt();
    const parts: Array<Record<string, unknown>> = [{ text: prompt }];

    if (file instanceof File) {
      const payload = await fileToBase64(file);
      parts.push({ inlineData: { mimeType: payload.mimeType, data: payload.data } });
    } else if (imageUrl) {
      const payload = await imageUrlToBase64(imageUrl);
      parts.push({ inlineData: { mimeType: payload.mimeType, data: payload.data } });
    }

    const model = "gemini-3-flash-preview";
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        contents: [{ role: "user", parts }],
        generationConfig: { temperature: 0.2 }
      })
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("Gemini API error", res.status, text);
      return NextResponse.json({ source: "mock", layout: mockLayout(), warning: `Gemini API failed: ${res.status}` }, { status: 200 });
    }

    const data = (await res.json()) as GeminiResponse;
    const candidateText =
      data.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("") || "";
    const parsed = parseModelJson(candidateText);
    if (!parsed) {
      return NextResponse.json({ source: "mock", layout: mockLayout(), warning: "Model response could not be parsed; using mock layout." }, { status: 200 });
    }

    const normalized = normalizeLayout(parsed);
    const cleaned = sanitizeLayout(normalized);

    return NextResponse.json({ source: model, layout: cleaned });
  } catch (err) {
    console.error("Blueprint analyze error", err);
    return NextResponse.json({ error: "Failed to analyze blueprint" }, { status: 500 });
  }
}
