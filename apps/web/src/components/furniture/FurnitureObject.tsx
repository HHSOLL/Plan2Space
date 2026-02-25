import type { Furniture } from "../../types";

type FurnitureObjectProps = {
  item: Furniture;
};

export function FurnitureObject({ item }: FurnitureObjectProps) {
  return <div className="text-xs text-stone-400">{item.name}</div>;
}
