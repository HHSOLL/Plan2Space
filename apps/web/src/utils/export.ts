"use client";

type CaptureOptions = {
  width: number;
  height: number;
  background: "white" | "black" | "transparent";
};

export const downloadDataUrl = (dataUrl: string, filename: string) => {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = filename;
  link.click();
};

export const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

export const captureCanvas = (canvas: HTMLCanvasElement, options: CaptureOptions) => {
  const output = document.createElement("canvas");
  output.width = options.width;
  output.height = options.height;
  const context = output.getContext("2d");
  if (!context) return null;

  if (options.background !== "transparent") {
    context.fillStyle = options.background === "white" ? "#ffffff" : "#000000";
    context.fillRect(0, 0, output.width, output.height);
  }

  context.drawImage(canvas, 0, 0, output.width, output.height);
  return output.toDataURL("image/png");
};
