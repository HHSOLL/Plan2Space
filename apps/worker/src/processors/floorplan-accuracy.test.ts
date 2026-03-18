import test from "node:test";
import assert from "node:assert/strict";
import { normalizeScaleInfo, normalizeTopology, scoreCandidate } from "@plan2space/floorplan-core";

test("normalizeScaleInfo upgrades unknown source when dimension evidence is strong", () => {
  const scaleInfo = normalizeScaleInfo(
    {
      value: 0.025,
      source: "unknown",
      confidence: 0.2,
      evidence: {
        mmValue: 3000,
        pxDistance: 120,
        p1: [0, 0],
        p2: [120, 0]
      }
    },
    0.025
  );

  assert.equal(scaleInfo.source, "ocr_dimension");
  assert.ok(scaleInfo.confidence >= 0.7);
});

test("normalizeTopology derives scale and semantic room hints from Korean annotations", () => {
  const normalized = normalizeTopology({
    walls: [
      { id: "w1", start: [0, 0], end: [260, 0], thickness: 12, type: "exterior" },
      { id: "w2", start: [260, 0], end: [260, 160], thickness: 12, type: "exterior" },
      { id: "w3", start: [260, 160], end: [0, 160], thickness: 12, type: "exterior" },
      { id: "w4", start: [0, 160], end: [0, 0], thickness: 12, type: "exterior" }
    ],
    openings: [{ id: "d1", position: [24, 0], width: 28, type: "door", isEntrance: true }],
    scale: 1,
    scaleInfo: {
      value: 1,
      source: "unknown",
      confidence: 0.1
    },
    roomHints: [
      {
        label: "거실",
        position: [70, 80],
        polygon: [
          [0, 0],
          [130, 0],
          [130, 160],
          [0, 160]
        ]
      },
      {
        label: "주방/식당",
        position: [195, 80],
        polygon: [
          [130, 0],
          [260, 0],
          [260, 160],
          [130, 160]
        ]
      }
    ],
    dimensionAnnotations: [
      {
        text: "10,060",
        p1: [0, 0],
        p2: [260, 0]
      }
    ]
  });

  assert.equal(normalized.scaleInfo.source, "ocr_dimension");
  assert.ok(normalized.scaleInfo.value > 0.03);
  assert.ok(normalized.scaleInfo.value < 0.05);
  assert.equal(normalized.semanticAnnotations.roomHints.length, 2);
  assert.equal(normalized.semanticAnnotations.roomHints[0]?.roomType, "living_room");
  assert.equal(normalized.semanticAnnotations.roomHints[1]?.roomType, "kitchen");
  assert.equal(normalized.semanticAnnotations.dimensionAnnotations[0]?.mmValue, 10060);
  assert.equal(normalized.semanticAnnotations.roomHints[0]?.id, "rh1");
  assert.equal(normalized.semanticAnnotations.roomHints[1]?.id, "rh2");
});

test("normalizeTopology reads nested semanticAnnotations payload and canonicalizes ordering", () => {
  const normalized = normalizeTopology({
    walls: [
      { id: "w1", start: [0, 0], end: [260, 0], thickness: 12, type: "exterior" },
      { id: "w2", start: [260, 0], end: [260, 160], thickness: 12, type: "exterior" },
      { id: "w3", start: [260, 160], end: [0, 160], thickness: 12, type: "exterior" },
      { id: "w4", start: [0, 160], end: [0, 0], thickness: 12, type: "exterior" }
    ],
    openings: [{ id: "d1", position: [24, 0], width: 28, type: "door", isEntrance: true }],
    scale: 1,
    scaleInfo: {
      value: 1,
      source: "unknown",
      confidence: 0.1
    },
    semanticAnnotations: {
      roomHints: [
        {
          label: "침실",
          position: [195, 80],
          polygon: [
            [130, 0],
            [260, 0],
            [260, 160],
            [130, 160]
          ]
        },
        {
          label: "거실",
          position: [70, 80],
          polygon: [
            [0, 0],
            [130, 0],
            [130, 160],
            [0, 160]
          ]
        }
      ],
      dimensionAnnotations: [
        {
          text: "10,060",
          p1: [0, 0],
          p2: [260, 0]
        }
      ]
    }
  });

  assert.equal(normalized.scaleInfo.source, "ocr_dimension");
  assert.equal(normalized.semanticAnnotations.roomHints.length, 2);
  assert.equal(normalized.semanticAnnotations.roomHints[0]?.label, "거실");
  assert.equal(normalized.semanticAnnotations.roomHints[0]?.id, "rh1");
  assert.equal(normalized.semanticAnnotations.roomHints[1]?.label, "침실");
  assert.equal(normalized.semanticAnnotations.roomHints[1]?.id, "rh2");
  assert.equal(normalized.semanticAnnotations.dimensionAnnotations[0]?.id, "dim1");
});

test("normalizeTopology ignores area labels and respects dimension orientation", () => {
  const normalized = normalizeTopology({
    walls: [
      { id: "w1", start: [0, 0], end: [260, 0], thickness: 12, type: "exterior" },
      { id: "w2", start: [260, 0], end: [260, 160], thickness: 12, type: "exterior" },
      { id: "w3", start: [260, 160], end: [0, 160], thickness: 12, type: "exterior" },
      { id: "w4", start: [0, 160], end: [0, 0], thickness: 12, type: "exterior" }
    ],
    openings: [{ id: "d1", position: [24, 0], width: 28, type: "door", isEntrance: true }],
    scale: 0.025,
    scaleInfo: {
      value: 0.025,
      source: "door_heuristic",
      confidence: 0.72
    },
    semanticAnnotations: {
      roomHints: [],
      dimensionAnnotations: [
        {
          text: "9.84m²",
          p1: [0, 0],
          p2: [0, 111]
        },
        {
          text: "10,060 x 7,800",
          p1: [0, 0],
          p2: [0, 160]
        }
      ]
    }
  });

  assert.equal(normalized.scaleInfo.source, "ocr_dimension");
  assert.ok(Math.abs(normalized.scaleInfo.value - 0.04875) < 0.0001);
});

test("normalizeTopology removes duplicate and tiny walls, then reattaches valid openings", () => {
  const normalized = normalizeTopology({
    walls: [
      { id: "w1", start: [0, 0], end: [100, 2], thickness: 12, type: "exterior" },
      { id: "w2", start: [100, 0], end: [0, 0], thickness: 12, type: "exterior" },
      { id: "w3", start: [100, 0], end: [100, 100], thickness: 12, type: "exterior" },
      { id: "w4", start: [100, 100], end: [0, 100], thickness: 12, type: "exterior" },
      { id: "w5", start: [0, 100], end: [0, 0], thickness: 12, type: "exterior" },
      { id: "noise", start: [52, 52], end: [57, 57], thickness: 6, type: "interior" }
    ],
    openings: [
      { id: "door-1", position: [48, 4], width: 20, type: "door", isEntrance: true },
      { id: "junk", position: [320, 280], width: 30, type: "door" }
    ],
    scale: 0.025,
    scaleInfo: {
      value: 0.025,
      source: "door_heuristic",
      confidence: 0.6
    }
  });

  assert.equal(normalized.walls.length, 4);
  assert.equal(normalized.openings.length, 1);
  assert.equal(normalized.openings[0]?.isEntrance, true);
  assert.ok((normalized.openings[0]?.offset ?? -1) >= 0);
  assert.ok((normalized.openings[0]?.offset ?? 9999) <= (normalized.walls[0]?.length ?? 0));
});

test("scoreCandidate prefers structurally clean topology over noisy topology", () => {
  const clean = normalizeTopology({
    walls: [
      { id: "w1", start: [0, 0], end: [100, 0], thickness: 12, type: "exterior" },
      { id: "w2", start: [100, 0], end: [100, 100], thickness: 12, type: "exterior" },
      { id: "w3", start: [100, 100], end: [0, 100], thickness: 12, type: "exterior" },
      { id: "w4", start: [0, 100], end: [0, 0], thickness: 12, type: "exterior" }
    ],
    openings: [{ id: "d1", position: [48, 0], width: 24, type: "door", isEntrance: true }],
    scale: 0.025,
    scaleInfo: {
      value: 0.025,
      source: "ocr_dimension",
      confidence: 0.9,
      evidence: { mmValue: 3000, pxDistance: 120, ocrText: "3000" }
    }
  });

  const noisy = normalizeTopology({
    walls: [
      { id: "w1", start: [0, 0], end: [100, 40], thickness: 12, type: "interior" },
      { id: "w2", start: [10, 90], end: [80, 20], thickness: 38, type: "interior" },
      { id: "w3", start: [30, 10], end: [40, 15], thickness: 4, type: "interior" },
      { id: "w4", start: [0, 80], end: [120, 10], thickness: 12, type: "interior" }
    ],
    openings: [{ id: "o1", position: [240, 240], width: 90, type: "door" }],
    scale: 1,
    scaleInfo: {
      value: 1,
      source: "unknown",
      confidence: 0
    }
  });

  const cleanScore = scoreCandidate(clean);
  const noisyScore = scoreCandidate(noisy);

  assert.ok(cleanScore.total > noisyScore.total);
  assert.equal(cleanScore.metrics.exteriorLoopClosed, true);
  assert.ok(noisyScore.metrics.axisAlignedRatio < cleanScore.metrics.axisAlignedRatio);
});

test("scoreCandidate does not let semantic annotations outrank structurally weak topology", () => {
  const clean = normalizeTopology({
    walls: [
      { id: "w1", start: [0, 0], end: [100, 0], thickness: 12, type: "exterior" },
      { id: "w2", start: [100, 0], end: [100, 100], thickness: 12, type: "exterior" },
      { id: "w3", start: [100, 100], end: [0, 100], thickness: 12, type: "exterior" },
      { id: "w4", start: [0, 100], end: [0, 0], thickness: 12, type: "exterior" }
    ],
    openings: [{ id: "d1", position: [48, 0], width: 24, type: "door", isEntrance: true }],
    scale: 0.025,
    scaleInfo: {
      value: 0.025,
      source: "ocr_dimension",
      confidence: 0.9,
      evidence: { mmValue: 3000, pxDistance: 120, ocrText: "3000" }
    }
  });

  const noisyButAnnotated = normalizeTopology({
    walls: [
      { id: "w1", start: [0, 0], end: [100, 40], thickness: 12, type: "interior" },
      { id: "w2", start: [10, 90], end: [80, 20], thickness: 38, type: "interior" },
      { id: "w3", start: [30, 10], end: [40, 15], thickness: 4, type: "interior" },
      { id: "w4", start: [0, 80], end: [120, 10], thickness: 12, type: "interior" }
    ],
    openings: [{ id: "o1", position: [240, 240], width: 90, type: "door" }],
    scale: 1,
    scaleInfo: {
      value: 1,
      source: "unknown",
      confidence: 0
    },
    semanticAnnotations: {
      roomHints: [
        {
          label: "거실",
          position: [30, 30],
          polygon: [
            [0, 0],
            [40, 0],
            [40, 40],
            [0, 40]
          ]
        },
        {
          label: "침실",
          position: [70, 70],
          polygon: [
            [50, 50],
            [90, 50],
            [90, 90],
            [50, 90]
          ]
        }
      ],
      dimensionAnnotations: [
        {
          text: "10,060",
          p1: [0, 0],
          p2: [260, 0]
        }
      ]
    }
  });

  const cleanScore = scoreCandidate(clean);
  const noisyScore = scoreCandidate(noisyButAnnotated);

  assert.ok(cleanScore.total > noisyScore.total);
});
