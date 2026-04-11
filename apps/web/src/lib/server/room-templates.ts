import {
  builderFloorFinishes,
  builderTemplates,
  builderWallFinishes,
  type BuilderTemplate
} from "../builder/templates";

export type RoomTemplateBrowseResponse = {
  templates: BuilderTemplate[];
  wallFinishes: Array<(typeof builderWallFinishes)[number]>;
  floorFinishes: Array<(typeof builderFloorFinishes)[number]>;
};

export function getRoomTemplateBrowseData(): RoomTemplateBrowseResponse {
  return {
    templates: builderTemplates,
    wallFinishes: [...builderWallFinishes],
    floorFinishes: [...builderFloorFinishes]
  };
}
