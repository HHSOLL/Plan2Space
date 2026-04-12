import type { BuilderTemplateOption } from "../types";
import type { ReactNode } from "react";

type BuilderShapeStepProps = {
  templateOptions: BuilderTemplateOption[];
  templateId: BuilderTemplateOption["id"];
  onSelectTemplate: (templateId: BuilderTemplateOption["id"]) => void;
};

export function BuilderShapeStep({
  templateOptions,
  templateId,
  onSelectTemplate
}: BuilderShapeStepProps) {
  const shapePreviewById: Record<string, ReactNode> = {
    "rect-studio": (
      <svg viewBox="0 0 100 70" className="h-14 w-16" aria-hidden>
        <rect x="14" y="12" width="72" height="46" fill="#dfd8cf" stroke="#1d1813" strokeWidth="4" rx="2" />
      </svg>
    ),
    "l-shape": (
      <svg viewBox="0 0 100 70" className="h-14 w-16" aria-hidden>
        <path d="M14 14H86V56H50V40H14Z" fill="#dfd8cf" stroke="#1d1813" strokeWidth="4" strokeLinejoin="round" />
      </svg>
    ),
    "cut-shape": (
      <svg viewBox="0 0 100 70" className="h-14 w-16" aria-hidden>
        <path d="M14 14H86V44L66 56H14Z" fill="#dfd8cf" stroke="#1d1813" strokeWidth="4" strokeLinejoin="round" />
      </svg>
    ),
    "t-shape": (
      <svg viewBox="0 0 100 70" className="h-14 w-16" aria-hidden>
        <path d="M14 14H86V34H62V56H38V34H14Z" fill="#dfd8cf" stroke="#1d1813" strokeWidth="4" strokeLinejoin="round" />
      </svg>
    ),
    "u-shape": (
      <svg viewBox="0 0 100 70" className="h-14 w-16" aria-hidden>
        <path d="M14 14H86V56H62V36H38V56H14Z" fill="#dfd8cf" stroke="#1d1813" strokeWidth="4" strokeLinejoin="round" />
      </svg>
    ),
    "slanted-shape": (
      <svg viewBox="0 0 100 70" className="h-14 w-16" aria-hidden>
        <path d="M14 24L26 14H74L86 24V56H14Z" fill="#dfd8cf" stroke="#1d1813" strokeWidth="4" strokeLinejoin="round" />
      </svg>
    )
  };

  return (
    <div className="grid grid-cols-2 gap-3">
      {templateOptions.map((template) => (
        <button
          key={template.id}
          type="button"
          onClick={() => onSelectTemplate(template.id)}
          className={`w-full rounded-[22px] border px-4 py-4 text-left transition ${
            templateId === template.id
              ? "border-black/30 bg-[#f2ebe2]"
              : "border-black/10 bg-[#fbf8f3] hover:border-black/30"
          }`}
        >
          <div className="flex justify-center">{shapePreviewById[template.id] ?? shapePreviewById["rect-studio"]}</div>
          <div className="mt-3 text-center text-sm font-semibold text-[#1d1611]">{template.name}</div>
        </button>
      ))}
    </div>
  );
}
