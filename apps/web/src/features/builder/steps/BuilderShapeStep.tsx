import type { BuilderTemplateOption } from "../types";

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
  return (
    <div className="space-y-3">
      {templateOptions.map((template) => (
        <button
          key={template.id}
          type="button"
          onClick={() => onSelectTemplate(template.id)}
          className={`w-full rounded-[22px] border px-5 py-5 text-left transition ${
            templateId === template.id
              ? "border-black/30 bg-[#f2ebe2]"
              : "border-black/10 bg-[#fbf8f3] hover:border-black/30"
          }`}
        >
          <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#887a6d]">
            {template.eyebrow}
          </div>
          <div className="mt-2 text-3xl font-light text-[#1d1611]">{template.name}</div>
          <p className="mt-2 text-sm leading-6 text-[#5a4f44]">{template.description}</p>
        </button>
      ))}
    </div>
  );
}
