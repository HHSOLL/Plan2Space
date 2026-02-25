"use client";

import { useState } from "react";
import Image from "next/image";
import type { FurnitureModel } from "../../data/furnitureModels";

type ModelCardProps = {
  model: FurnitureModel;
  isSelected?: boolean;
  onSelect?: (model: FurnitureModel) => void;
};

export function ModelCard({ model, isSelected = false, onSelect }: ModelCardProps) {
  const [imageError, setImageError] = useState(false);

  return (
    <button
      onClick={() => onSelect?.(model)}
      className={`flex flex-col gap-3 rounded-lg border-2 p-4 transition-all ${
        isSelected
          ? "border-blue-500 bg-blue-50 shadow-lg"
          : "border-gray-200 bg-white hover:border-blue-300 hover:shadow-md"
      }`}
    >
      <div className="relative h-40 w-full overflow-hidden rounded bg-gray-100">
        {!imageError ? (
          <Image
            src={model.thumbnailUrl}
            alt={model.name}
            fill
            className="object-cover"
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <div className="text-xs text-gray-400">No image</div>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <h3 className="font-semibold text-gray-900">{model.name}</h3>
        <p className="text-xs text-gray-600">{model.description}</p>
        <span className="mt-1 inline-block w-fit rounded bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700">
          {model.category}
        </span>
      </div>

      {isSelected && (
        <div className="flex items-center justify-center rounded bg-blue-500 py-2 text-sm font-medium text-white">
          ✓ Selected
        </div>
      )}
    </button>
  );
}
