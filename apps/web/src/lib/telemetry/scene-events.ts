type SceneEventPayload = Record<string, unknown>;

function serializeError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack
    };
  }

  return {
    message: String(error)
  };
}

export function reportSceneEvent(event: string, payload: SceneEventPayload = {}) {
  console.info("[scene-event]", event, payload);
}

export function reportSceneError(event: string, error: unknown, payload: SceneEventPayload = {}) {
  console.error("[scene-error]", event, {
    ...payload,
    error: serializeError(error)
  });
}
