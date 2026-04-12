export function buildPreviewDataUrl(
  floorOutline: Array<[number, number]>,
  openings: { type: "door" | "window"; wallId: string }[]
) {
  const points =
    floorOutline.length > 0
      ? floorOutline
      : ([
          [0, 0],
          [6, 0],
          [6, 4],
          [0, 4]
        ] as Array<[number, number]>);

  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const padding = 24;
  const width = 640;
  const height = 420;
  const scale = Math.min(
    (width - padding * 2) / Math.max(1, maxX - minX),
    (height - padding * 2) / Math.max(1, maxY - minY)
  );

  const toPoint = ([x, y]: [number, number]) => `${padding + (x - minX) * scale},${padding + (y - minY) * scale}`;
  const polyline = points.map(toPoint).join(" ");

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <rect width="${width}" height="${height}" rx="28" fill="#f6f1e8" />
      <g opacity="0.25" stroke="#c7baa9">
        ${Array.from({ length: 10 })
          .map((_, index) => `<line x1="0" y1="${index * 42}" x2="${width}" y2="${index * 42}" />`)
          .join("")}
        ${Array.from({ length: 15 })
          .map((_, index) => `<line x1="${index * 42}" y1="0" x2="${index * 42}" y2="${height}" />`)
          .join("")}
      </g>
      <polygon points="${polyline}" fill="#fdfbf7" stroke="#181713" stroke-width="10" stroke-linejoin="round" />
      <g fill="#c96f3b">
        ${openings
          .map(
            (opening, index) =>
              `<circle cx="${72 + index * 28}" cy="${height - 42}" r="8" fill="${opening.type === "door" ? "#c96f3b" : "#6b8b9d"}" />`
          )
          .join("")}
      </g>
    </svg>
  `;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
