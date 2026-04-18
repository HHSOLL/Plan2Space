from __future__ import annotations

import math
from pathlib import Path

import bpy


REPO_ROOT = Path(__file__).resolve().parents[3]
BLEND_ROOT = REPO_ROOT / "assets" / "blender" / "openings"


def purge_scene() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    bpy.ops.outliner.orphans_purge(do_recursive=True)
    scene = bpy.context.scene
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.scale_length = 1.0
    scene.render.engine = "BLENDER_EEVEE_NEXT"


def ensure_material(
    name: str,
    *,
    base_color: tuple[float, float, float, float],
    roughness: float,
    metallic: float = 0.0,
    transmission: float = 0.0,
    ior: float = 1.45,
    alpha: float = 1.0,
    emission_color: tuple[float, float, float, float] | None = None,
    emission_strength: float = 0.0,
) -> bpy.types.Material:
    material = bpy.data.materials.get(name)
    if material is None:
        material = bpy.data.materials.new(name=name)
    material.use_nodes = True
    bsdf = material.node_tree.nodes.get("Principled BSDF")
    if bsdf is None:
      raise RuntimeError(f"Principled BSDF missing for material {name}")
    bsdf.inputs["Base Color"].default_value = base_color
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Transmission Weight"].default_value = transmission
    bsdf.inputs["IOR"].default_value = ior
    bsdf.inputs["Alpha"].default_value = alpha
    if emission_color is not None and "Emission Color" in bsdf.inputs:
        bsdf.inputs["Emission Color"].default_value = emission_color
        bsdf.inputs["Emission Strength"].default_value = emission_strength
    material.blend_method = "BLEND" if alpha < 1.0 or transmission > 0.0 else "OPAQUE"
    return material


def build_materials() -> dict[str, bpy.types.Material]:
    return {
        "frame": ensure_material(
            "P2SFramePaint", base_color=(0.94, 0.94, 0.935, 1.0), roughness=0.54
        ),
        "wood": ensure_material(
            "P2SWarmOak", base_color=(0.78, 0.64, 0.46, 1.0), roughness=0.48
        ),
        "handle": ensure_material(
            "P2SHandleMetal", base_color=(0.7, 0.71, 0.72, 1.0), roughness=0.24, metallic=0.92
        ),
        "glass": ensure_material(
            "P2SGlassClear",
            base_color=(0.83, 0.91, 0.96, 0.25),
            roughness=0.06,
            transmission=0.82,
            ior=1.45,
            alpha=0.22,
        ),
    }


def assign_material(obj: bpy.types.Object, material: bpy.types.Material) -> None:
    if obj.data.materials:
        obj.data.materials[0] = material
    else:
        obj.data.materials.append(material)


def add_bevel(obj: bpy.types.Object, width: float, segments: int = 2) -> None:
    modifier = obj.modifiers.new(name="Bevel", type="BEVEL")
    modifier.width = width
    modifier.segments = segments
    modifier.limit_method = "ANGLE"


def cube(
    name: str,
    size: tuple[float, float, float],
    location: tuple[float, float, float],
    *,
    parent: bpy.types.Object | None = None,
    material: bpy.types.Material | None = None,
    bevel: float = 0.0,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cube_add(location=location)
    obj = bpy.context.active_object
    if obj is None:
        raise RuntimeError(f"Failed to create cube {name}")
    obj.name = name
    obj.scale = (size[0] / 2, size[1] / 2, size[2] / 2)
    if parent is not None:
        obj.parent = parent
    if material is not None:
        assign_material(obj, material)
    if bevel > 0:
        add_bevel(obj, bevel)
    return obj


def cylinder(
    name: str,
    radius: float,
    depth: float,
    location: tuple[float, float, float],
    *,
    rotation: tuple[float, float, float] = (math.pi / 2, 0.0, 0.0),
    parent: bpy.types.Object | None = None,
    material: bpy.types.Material | None = None,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cylinder_add(vertices=18, radius=radius, depth=depth, location=location, rotation=rotation)
    obj = bpy.context.active_object
    if obj is None:
        raise RuntimeError(f"Failed to create cylinder {name}")
    obj.name = name
    if parent is not None:
        obj.parent = parent
    if material is not None:
        assign_material(obj, material)
    bpy.ops.object.shade_smooth()
    return obj


def empty(name: str, location: tuple[float, float, float], *, parent: bpy.types.Object | None = None) -> bpy.types.Object:
    obj = bpy.data.objects.new(name, None)
    obj.empty_display_type = "PLAIN_AXES"
    obj.location = location
    bpy.context.scene.collection.objects.link(obj)
    if parent is not None:
        obj.parent = parent
    return obj


def add_handle_set(
    name_prefix: str,
    x: float,
    y: float,
    z: float,
    *,
    length: float = 0.1,
    parent: bpy.types.Object | None = None,
    material: bpy.types.Material,
) -> None:
    cylinder(
        f"{name_prefix}StemOuter",
        radius=0.008,
        depth=0.028,
        location=(x, y, z + 0.012),
        rotation=(0.0, math.pi / 2, 0.0),
        parent=parent,
        material=material,
    )
    cylinder(
        f"{name_prefix}GripOuter",
        radius=0.008,
        depth=length,
        location=(x + length / 2, y, z + 0.02),
        rotation=(0.0, 0.0, math.pi / 2),
        parent=parent,
        material=material,
    )


def build_single_door() -> None:
    materials = build_materials()
    width = 0.92
    height = 2.1
    depth = 0.09
    jamb = 0.055
    header = 0.075
    root = empty("P2SSingleDoorRoot", (0.0, 0.0, 0.0))
    cube("DoorFrameLeft", (jamb, height, depth), (-jamb / 2, height / 2, 0.0), parent=root, material=materials["frame"], bevel=0.004)
    cube("DoorFrameRight", (jamb, height, depth), (width + jamb / 2, height / 2, 0.0), parent=root, material=materials["frame"], bevel=0.004)
    cube("DoorFrameHeader", (width + jamb * 2, header, depth), (width / 2, height + header / 2, 0.0), parent=root, material=materials["frame"], bevel=0.004)
    pivot = empty("DoorLeafPivot", (0.0, 0.0, 0.0), parent=root)
    leaf = cube("DoorLeaf", (width, height, depth * 0.92), (width / 2, height / 2, 0.0), parent=pivot, material=materials["wood"], bevel=0.005)
    cube("InsetPanelTop", (width * 0.7, height * 0.22, depth * 0.2), (width / 2, height * 0.72, depth * 0.02), parent=pivot, material=materials["frame"], bevel=0.002)
    cube("InsetPanelBottom", (width * 0.7, height * 0.36, depth * 0.2), (width / 2, height * 0.34, depth * 0.02), parent=pivot, material=materials["frame"], bevel=0.002)
    add_handle_set("DoorHandle", width * 0.84, height * 0.5, depth * 0.42, parent=pivot, material=materials["handle"])
    leaf.select_set(True)


def build_double_door() -> None:
    materials = build_materials()
    width = 1.4
    height = 2.1
    depth = 0.09
    jamb = 0.055
    header = 0.075
    leaf_width = width / 2
    root = empty("P2SDoubleDoorRoot", (0.0, 0.0, 0.0))
    cube("DoorFrameLeft", (jamb, height, depth), (-jamb / 2, height / 2, 0.0), parent=root, material=materials["frame"], bevel=0.004)
    cube("DoorFrameRight", (jamb, height, depth), (width + jamb / 2, height / 2, 0.0), parent=root, material=materials["frame"], bevel=0.004)
    cube("DoorFrameHeader", (width + jamb * 2, header, depth), (width / 2, height + header / 2, 0.0), parent=root, material=materials["frame"], bevel=0.004)

    left_pivot = empty("DoorLeafLeftPivot", (0.0, 0.0, 0.0), parent=root)
    right_pivot = empty("DoorLeafRightPivot", (width, 0.0, 0.0), parent=root)
    cube("DoorLeafLeft", (leaf_width, height, depth * 0.92), (leaf_width / 2, height / 2, 0.0), parent=left_pivot, material=materials["wood"], bevel=0.005)
    cube("DoorLeafRight", (leaf_width, height, depth * 0.92), (-leaf_width / 2, height / 2, 0.0), parent=right_pivot, material=materials["wood"], bevel=0.005)
    cube("DoorInsetLeft", (leaf_width * 0.68, height * 0.62, depth * 0.18), (leaf_width / 2, height * 0.48, depth * 0.02), parent=left_pivot, material=materials["frame"], bevel=0.002)
    cube("DoorInsetRight", (leaf_width * 0.68, height * 0.62, depth * 0.18), (-leaf_width / 2, height * 0.48, depth * 0.02), parent=right_pivot, material=materials["frame"], bevel=0.002)
    add_handle_set("DoorHandleLeft", leaf_width * 0.82, height * 0.5, depth * 0.42, parent=left_pivot, length=0.08, material=materials["handle"])
    add_handle_set("DoorHandleRight", -leaf_width * 0.82, height * 0.5, depth * 0.42, parent=right_pivot, length=0.08, material=materials["handle"])


def build_french_door() -> None:
    materials = build_materials()
    width = 1.6
    height = 2.1
    depth = 0.09
    jamb = 0.055
    header = 0.075
    leaf_width = width / 2
    root = empty("P2SFrenchDoorRoot", (0.0, 0.0, 0.0))
    cube("DoorFrameLeft", (jamb, height, depth), (-jamb / 2, height / 2, 0.0), parent=root, material=materials["frame"], bevel=0.004)
    cube("DoorFrameRight", (jamb, height, depth), (width + jamb / 2, height / 2, 0.0), parent=root, material=materials["frame"], bevel=0.004)
    cube("DoorFrameHeader", (width + jamb * 2, header, depth), (width / 2, height + header / 2, 0.0), parent=root, material=materials["frame"], bevel=0.004)

    left_pivot = empty("DoorLeafLeftPivot", (0.0, 0.0, 0.0), parent=root)
    right_pivot = empty("DoorLeafRightPivot", (width, 0.0, 0.0), parent=root)
    cube("DoorLeafLeft", (leaf_width, height, depth * 0.82), (leaf_width / 2, height / 2, 0.0), parent=left_pivot, material=materials["frame"], bevel=0.004)
    cube("DoorLeafRight", (leaf_width, height, depth * 0.82), (-leaf_width / 2, height / 2, 0.0), parent=right_pivot, material=materials["frame"], bevel=0.004)
    cube("GlassLeft", (leaf_width * 0.72, height * 0.72, depth * 0.2), (leaf_width / 2, height * 0.54, 0.0), parent=left_pivot, material=materials["glass"], bevel=0.001)
    cube("GlassRight", (leaf_width * 0.72, height * 0.72, depth * 0.2), (-leaf_width / 2, height * 0.54, 0.0), parent=right_pivot, material=materials["glass"], bevel=0.001)

    for index in range(1, 3):
        y = height * (0.22 + index * 0.18)
        cube(f"MuntinLeftH{index}", (leaf_width * 0.72, 0.022, depth * 0.24), (leaf_width / 2, y, 0.0), parent=left_pivot, material=materials["frame"])
        cube(f"MuntinRightH{index}", (leaf_width * 0.72, 0.022, depth * 0.24), (-leaf_width / 2, y, 0.0), parent=right_pivot, material=materials["frame"])
    for index, x_factor in enumerate((0.38, 0.62), start=1):
        cube(f"MuntinLeftV{index}", (0.022, height * 0.72, depth * 0.24), (leaf_width * x_factor, height * 0.54, 0.0), parent=left_pivot, material=materials["frame"])
        cube(f"MuntinRightV{index}", (0.022, height * 0.72, depth * 0.24), (-leaf_width * x_factor, height * 0.54, 0.0), parent=right_pivot, material=materials["frame"])

    add_handle_set("DoorHandleLeft", leaf_width * 0.86, height * 0.48, depth * 0.4, parent=left_pivot, length=0.09, material=materials["handle"])
    add_handle_set("DoorHandleRight", -leaf_width * 0.86, height * 0.48, depth * 0.4, parent=right_pivot, length=0.09, material=materials["handle"])


def build_single_window() -> None:
    materials = build_materials()
    width = 1.8
    height = 1.3
    depth = 0.12
    frame = 0.055
    sill_depth = 0.18
    root = empty("P2SSingleWindowRoot", (0.0, 0.0, 0.0))
    cube("WindowFrameOuter", (width + frame * 2, height + frame * 2, depth), (width / 2, height / 2, 0.0), parent=root, material=materials["frame"], bevel=0.004)
    cube("WindowGlass", (width - frame * 1.7, height - frame * 1.7, depth * 0.28), (width / 2, height / 2, 0.0), parent=root, material=materials["glass"], bevel=0.001)
    cube("WindowMullionV", (0.03, height - frame * 1.3, depth * 0.34), (width / 2, height / 2, 0.0), parent=root, material=materials["frame"])
    cube("WindowMullionH", (width - frame * 1.3, 0.03, depth * 0.34), (width / 2, height / 2, 0.0), parent=root, material=materials["frame"])
    cube("WindowSill", (width + frame * 2.2, 0.035, sill_depth), (width / 2, -0.02, depth * 0.1), parent=root, material=materials["frame"], bevel=0.003)


def build_wide_window() -> None:
    materials = build_materials()
    width = 2.4
    height = 1.3
    depth = 0.12
    frame = 0.055
    root = empty("P2SWideWindowRoot", (0.0, 0.0, 0.0))
    cube("WindowFrameOuter", (width + frame * 2, height + frame * 2, depth), (width / 2, height / 2, 0.0), parent=root, material=materials["frame"], bevel=0.004)
    cube("WindowGlassLeft", (width * 0.42, height - frame * 1.7, depth * 0.24), (width * 0.28, height / 2, 0.0), parent=root, material=materials["glass"], bevel=0.001)
    cube("WindowGlassRight", (width * 0.42, height - frame * 1.7, depth * 0.24), (width * 0.72, height / 2, 0.0), parent=root, material=materials["glass"], bevel=0.001)
    cube("WindowCenterMullion", (0.045, height - frame * 1.2, depth * 0.34), (width / 2, height / 2, 0.0), parent=root, material=materials["frame"])
    cube("WindowTrackLower", (width - frame * 1.4, 0.03, depth * 0.28), (width / 2, frame * 0.46, 0.0), parent=root, material=materials["frame"])
    cube("WindowTrackUpper", (width - frame * 1.4, 0.03, depth * 0.28), (width / 2, height - frame * 0.46, 0.0), parent=root, material=materials["frame"])
    cube("WindowSill", (width + frame * 2.1, 0.035, 0.2), (width / 2, -0.02, depth * 0.12), parent=root, material=materials["frame"], bevel=0.003)


ASSETS = {
    "p2s_opening_door_single": build_single_door,
    "p2s_opening_door_double": build_double_door,
    "p2s_opening_door_french": build_french_door,
    "p2s_opening_window_single": build_single_window,
    "p2s_opening_window_wide": build_wide_window,
}


def save_asset(asset_name: str, builder) -> None:
    purge_scene()
    builder()
    BLEND_ROOT.mkdir(parents=True, exist_ok=True)
    output_path = BLEND_ROOT / f"{asset_name}.blend"
    bpy.ops.wm.save_as_mainfile(filepath=str(output_path))


def main() -> None:
    for asset_name, builder in ASSETS.items():
        save_asset(asset_name, builder)
        print(f"saved {asset_name}")


if __name__ == "__main__":
    main()
