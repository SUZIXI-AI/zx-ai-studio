#!/usr/bin/env python3
"""Migrate old ComfyUI-KJNodes LTXVImgToVideoInplaceKJ workflow nodes.

Old workflows may store dynamic inputs as image_1/index_1/strength_1.
Current KJNodes stores them under the DynamicCombo namespace:
num_images.image_1 / num_images.index_1 / num_images.strength_1.
"""

from __future__ import annotations

import argparse
import copy
import json
import re
import shutil
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any


TARGET_NODE_TYPE = "LTXVImgToVideoInplaceKJ"
OLD_DYNAMIC_RE = re.compile(r"^(image|index|strength)_(\d+)$")
NEW_DYNAMIC_RE = re.compile(r"^num_images\.(image|index|strength)_(\d+)$")


@dataclass
class NodeChange:
    node_id: Any
    selected_images: int
    migrated_images: int
    old_inputs: list[str]
    new_inputs: list[str]
    rewired_links: int = 0
    warnings: list[str] = field(default_factory=list)


@dataclass
class FileChange:
    path: Path
    node_changes: list[NodeChange] = field(default_factory=list)
    skipped_reason: str | None = None

    @property
    def changed(self) -> bool:
        return bool(self.node_changes)


def iter_json_files(paths: list[Path]) -> list[Path]:
    files: list[Path] = []
    for path in paths:
        if path.is_file() and path.suffix.lower() == ".json":
            files.append(path)
        elif path.is_dir():
            files.extend(
                p
                for p in path.rglob("*.json")
                if ".bak" not in p.name and not p.name.endswith(".backup")
            )
    return sorted(set(files))


def input_name(input_item: dict[str, Any]) -> str:
    return str(input_item.get("name", ""))


def parse_int(value: Any, default: int) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def parse_old_widgets(values: list[Any], count: int) -> tuple[list[Any], list[Any]]:
    strengths: list[Any] = []
    indices: list[Any] = []
    for i in range(count):
        strengths.append(values[1 + i * 2] if 1 + i * 2 < len(values) else 1)
        indices.append(values[2 + i * 2] if 2 + i * 2 < len(values) else 0)
    return strengths, indices


def make_combo_input(selected_images: int) -> dict[str, Any]:
    return {
        "localized_name": "num_images",
        "name": "num_images",
        "type": "COMFY_DYNAMICCOMBO_V3",
        "widget": {"name": "num_images"},
        "link": None,
    }


def migrate_input(
    old_by_name: dict[str, dict[str, Any]],
    old_name: str,
    new_name: str,
    input_type: str,
    label: str | None = None,
) -> dict[str, Any]:
    item = copy.deepcopy(old_by_name.get(old_name, {}))
    item["name"] = new_name
    item["localized_name"] = new_name
    item["type"] = item.get("type") or input_type
    if label is not None:
        item["label"] = label
    else:
        item.pop("label", None)
    if input_type in {"INT", "FLOAT"}:
        item["widget"] = {"name": new_name}
        item.setdefault("shape", 7)
    return item


def collect_connected_dynamic_indices(inputs: list[dict[str, Any]]) -> int:
    highest = 0
    for item in inputs:
        name = input_name(item)
        match = OLD_DYNAMIC_RE.match(name)
        if match and item.get("link") is not None:
            highest = max(highest, int(match.group(2)))
    return highest


def build_clean_inputs(
    node: dict[str, Any],
    selected_images: int,
    migrated_images: int,
) -> tuple[list[dict[str, Any]], dict[int, int], list[str]]:
    old_inputs = node.get("inputs", [])
    old_by_name = {input_name(item): item for item in old_inputs}
    old_slot_by_name = {input_name(item): idx for idx, item in enumerate(old_inputs)}

    warnings: list[str] = []
    new_inputs: list[dict[str, Any]] = []
    old_slot_to_new_slot: dict[int, int] = {}

    def append_old_or_default(old_name: str, default: dict[str, Any]) -> None:
        old_item = copy.deepcopy(old_by_name.get(old_name, default))
        old_item["name"] = old_name
        new_slot = len(new_inputs)
        new_inputs.append(old_item)
        if old_name in old_slot_by_name:
            old_slot_to_new_slot[old_slot_by_name[old_name]] = new_slot

    append_old_or_default("vae", {"label": "vae", "name": "vae", "type": "VAE", "link": None})
    append_old_or_default("latent", {"label": "latent", "name": "latent", "type": "LATENT", "link": None})

    combo_slot = len(new_inputs)
    new_inputs.append(make_combo_input(selected_images))
    if "num_images" in old_slot_by_name:
        old_slot_to_new_slot[old_slot_by_name["num_images"]] = combo_slot

    for i in range(1, migrated_images + 1):
        old_name = f"strength_{i}"
        new_name = f"num_images.strength_{i}"
        new_slot = len(new_inputs)
        new_inputs.append(migrate_input(old_by_name, old_name, new_name, "FLOAT"))
        if old_name in old_slot_by_name:
            old_slot_to_new_slot[old_slot_by_name[old_name]] = new_slot

    for i in range(1, migrated_images + 1):
        image_old = f"image_{i}"
        image_new = f"num_images.image_{i}"
        image_slot = len(new_inputs)
        new_inputs.append(migrate_input(old_by_name, image_old, image_new, "IMAGE", label=f"image_{i}"))
        if image_old in old_slot_by_name:
            old_slot_to_new_slot[old_slot_by_name[image_old]] = image_slot

        index_old = f"index_{i}"
        index_new = f"num_images.index_{i}"
        index_slot = len(new_inputs)
        new_inputs.append(migrate_input(old_by_name, index_old, index_new, "INT"))
        if index_old in old_slot_by_name:
            old_slot_to_new_slot[old_slot_by_name[index_old]] = index_slot

    for item in old_inputs:
        name = input_name(item)
        match = OLD_DYNAMIC_RE.match(name)
        if match and int(match.group(2)) > migrated_images and item.get("link") is not None:
            warnings.append(f"linked input {name} is beyond migrated count {migrated_images}")

    return new_inputs, old_slot_to_new_slot, warnings


def update_link_slots(data: dict[str, Any], node_id: Any, old_slot_to_new_slot: dict[int, int]) -> int:
    changed = 0
    for link in data.get("links", []) or []:
        if not isinstance(link, list) or len(link) < 5:
            continue
        if link[3] != node_id:
            continue
        old_slot = link[4]
        if old_slot in old_slot_to_new_slot and link[4] != old_slot_to_new_slot[old_slot]:
            link[4] = old_slot_to_new_slot[old_slot]
            changed += 1
    return changed


def migrate_node(data: dict[str, Any], node: dict[str, Any]) -> NodeChange | None:
    inputs = node.get("inputs", [])
    names = [input_name(item) for item in inputs]
    old_dynamic_names = [name for name in names if OLD_DYNAMIC_RE.match(name)]
    new_dynamic_names = [name for name in names if NEW_DYNAMIC_RE.match(name)]

    if not old_dynamic_names:
        return None

    if new_dynamic_names:
        # Mixed nodes are uncommon, but the same rewrite removes stale old names.
        pass

    widgets = node.get("widgets_values") or []
    selected_images = max(1, min(20, parse_int(widgets[0] if widgets else 1, 1)))
    connected_highest = collect_connected_dynamic_indices(inputs)
    migrated_images = max(selected_images, connected_highest)
    migrated_images = max(1, min(20, migrated_images))

    strengths, indices = parse_old_widgets(widgets, migrated_images)
    node["widgets_values"] = [str(migrated_images), *strengths[:migrated_images], *indices[:migrated_images]]

    old_input_names = names
    new_inputs, old_slot_to_new_slot, warnings = build_clean_inputs(
        node,
        selected_images=migrated_images,
        migrated_images=migrated_images,
    )
    node["inputs"] = new_inputs
    rewired = update_link_slots(data, node.get("id"), old_slot_to_new_slot)

    return NodeChange(
        node_id=node.get("id"),
        selected_images=selected_images,
        migrated_images=migrated_images,
        old_inputs=old_input_names,
        new_inputs=[input_name(item) for item in new_inputs],
        rewired_links=rewired,
        warnings=warnings,
    )


def migrate_file(path: Path) -> tuple[FileChange, dict[str, Any] | None]:
    change = FileChange(path=path)
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:  # noqa: BLE001
        change.skipped_reason = f"invalid json: {exc}"
        return change, None

    if not isinstance(data, dict):
        change.skipped_reason = f"top-level json is {type(data).__name__}, not workflow object"
        return change, None

    nodes = data.get("nodes")
    if not isinstance(nodes, list):
        change.skipped_reason = "no nodes array"
        return change, None

    for node in nodes:
        if isinstance(node, dict) and node.get("type") == TARGET_NODE_TYPE:
            node_change = migrate_node(data, node)
            if node_change:
                change.node_changes.append(node_change)

    return change, data if change.changed else None


def write_json(path: Path, data: dict[str, Any], backup_suffix: str) -> Path:
    backup_path = path.with_name(path.name + backup_suffix)
    if not backup_path.exists():
        shutil.copy2(path, backup_path)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return backup_path


def print_report(changes: list[FileChange], applied: bool) -> None:
    changed = [change for change in changes if change.changed]
    print(f"Mode: {'apply' if applied else 'dry-run'}")
    print(f"Files with changes: {len(changed)}")
    for change in changed:
        print(f"\n{change.path}")
        for node_change in change.node_changes:
            print(
                f"  node {node_change.node_id}: "
                f"{len(node_change.old_inputs)} inputs -> {len(node_change.new_inputs)} inputs, "
                f"images={node_change.migrated_images}, rewired_links={node_change.rewired_links}"
            )
            print(f"    old: {', '.join(node_change.old_inputs)}")
            print(f"    new: {', '.join(node_change.new_inputs)}")
            for warning in node_change.warnings:
                print(f"    warning: {warning}")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--path", action="append", required=True, help="Workflow JSON file or directory")
    parser.add_argument("--apply", action="store_true", help="Write changes. Default is dry-run.")
    parser.add_argument(
        "--backup-suffix",
        default=f".bak-{datetime.now().strftime('%Y%m%d-%H%M%S')}",
        help="Suffix for backup files when --apply is used.",
    )
    args = parser.parse_args()

    paths = [Path(item).expanduser().resolve() for item in args.path]
    files = iter_json_files(paths)
    changes: list[FileChange] = []

    for file_path in files:
        change, migrated_data = migrate_file(file_path)
        changes.append(change)
        if args.apply and migrated_data is not None:
            backup_path = write_json(file_path, migrated_data, args.backup_suffix)
            print(f"Backed up {file_path} -> {backup_path}")

    print_report(changes, applied=args.apply)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
