"use client";

import { useState } from "react";
import { ModelCard } from "./ModelCard";
import { ModelPreview } from "./ModelPreview";
import {
  ALL_CATEGORIES,
  FURNITURE_MODELS,
  type FurnitureModel,
  type FurnitureModelCategory
} from "../../data/furnitureModels";

type ModelLibraryModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onAddFurniture: (model: FurnitureModel) => void;
};

export function ModelLibraryModal({ isOpen, onClose, onAddFurniture }: ModelLibraryModalProps) {
  const [selectedModel, setSelectedModel] = useState<FurnitureModel | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<FurnitureModelCategory | "all">("all");

  if (!isOpen) return null;

  const filteredModels =
    selectedCategory === "all"
      ? FURNITURE_MODELS
      : FURNITURE_MODELS.filter((model) => model.category === selectedCategory);

  const handleAddFurniture = () => {
    if (!selectedModel) return;
    onAddFurniture(selectedModel);
    setSelectedModel(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="flex h-[90vh] w-[90vw] max-w-6xl gap-6 rounded-lg bg-white p-6 shadow-2xl">
        <div className="flex flex-1 flex-col gap-4 overflow-hidden">
          <div className="flex items-center justify-between border-b pb-4">
            <h2 className="text-2xl font-bold">Furniture Library</h2>
            <button onClick={onClose} className="text-2xl text-gray-400 hover:text-gray-600">
              ×
            </button>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-2">
            <button
              onClick={() => setSelectedCategory("all")}
              className={`whitespace-nowrap rounded-full px-4 py-2 font-medium transition-colors ${
                selectedCategory === "all"
                  ? "bg-blue-500 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              All
            </button>
            {ALL_CATEGORIES.map((category) => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`whitespace-nowrap rounded-full px-4 py-2 font-medium transition-colors ${
                  selectedCategory === category
                    ? "bg-blue-500 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                {category}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto">
            <div className="grid grid-cols-2 gap-4">
              {filteredModels.map((model) => (
                <ModelCard
                  key={model.id}
                  model={model}
                  isSelected={selectedModel?.id === model.id}
                  onSelect={setSelectedModel}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="flex w-80 flex-col gap-4">
          {selectedModel ? (
            <>
              <div className="flex-1 rounded-lg border border-gray-200 bg-gray-50">
                <ModelPreview modelPath={selectedModel.modelPath} />
              </div>

              <div className="rounded-lg border border-gray-200 p-4">
                <h3 className="font-bold text-gray-900">{selectedModel.name}</h3>
                <p className="mt-2 text-sm text-gray-600">{selectedModel.description}</p>

                {selectedModel.boundingBox && (
                  <div className="mt-4 border-t pt-4">
                    <p className="text-xs font-semibold text-gray-700">Dimensions</p>
                    <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <p className="text-gray-500">Width</p>
                        <p className="font-medium">{selectedModel.boundingBox.width.toFixed(2)}m</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Height</p>
                        <p className="font-medium">{selectedModel.boundingBox.height.toFixed(2)}m</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Depth</p>
                        <p className="font-medium">{selectedModel.boundingBox.depth.toFixed(2)}m</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <button
                  onClick={onClose}
                  className="flex-1 rounded-lg border border-gray-300 bg-white py-2 font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddFurniture}
                  className="flex-1 rounded-lg bg-blue-500 py-2 font-medium text-white hover:bg-blue-600"
                >
                  Add to Scene
                </button>
              </div>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center rounded-lg border border-gray-200 bg-gray-50 text-center">
              <p className="text-gray-500">Select a model to preview</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
