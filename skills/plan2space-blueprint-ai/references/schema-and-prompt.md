# Schema and Prompt

## JSON Schema (Example)
```json
{
  "walls": [
    {"id": "wall-1", "start": [120, 80], "end": [420, 80], "thickness": 12, "type": "exterior"}
  ],
  "openings": [
    {"id": "open-1", "wallId": "wall-1", "type": "door", "offset": 160, "width": 90, "height": 210}
  ]
}
```

## Prompt Template
```
You are a floorplan analyst. Extract only walls and openings.
Coordinates are image pixels, origin at top-left (0,0).
Return ONLY JSON in this schema:
{ walls: [{id, start:[x,y], end:[x,y], thickness, type?}], openings:[{id, wallId?, type, offset?, width, height?}] }
Ignore furniture, text, and symbols not part of structure.
If tools are available, return the JSON using the tool output.
```
