"""Print the content schema of every layout in the given Presenton templates.

Run from `servers/fastapi` of an upstream checkout, with that directory on
PYTHONPATH. Each schema is the one upstream sends for slide content: built by
`get_template_schema`, then stripped of asset-only fields and given the
speaker note, as `generate_slide_content._prepare_response_schema` does.
`repeated` names, per component, the array field that upstream hydration maps
onto whole repeated groups (`hydrate_repeated_top_level_groups`).
"""

import json
import sys

from templates.v2.schema import (
    get_repeated_top_level_group_schema_name,
    get_template_schema,
)
from utils.schema_utils import (
    add_field_in_schema,
    ensure_array_schemas_have_items,
    remove_fields_from_schema,
)

ASSET_ONLY_FIELDS = ["__image_url__", "__icon_url__"]


def response_schema(schema):
    if not isinstance(schema, dict):
        return None
    prepared = remove_fields_from_schema(schema, ASSET_ONLY_FIELDS)
    properties = prepared.get("properties")
    if not isinstance(properties, dict) or not properties:
        return None
    prepared["type"] = "object"
    prepared = add_field_in_schema(
        prepared,
        {
            "__speaker_note__": {
                "type": "string",
                "minLength": 100,
                "maxLength": 500,
                "description": "Speaker note for the slide",
            }
        },
        True,
    )
    return ensure_array_schemas_have_items(prepared)


def main(paths):
    out = {}
    for path in paths:
        with open(path, encoding="utf-8") as handle:
            template = json.load(handle)
        generated = get_template_schema(template)
        layouts = []
        for index, entry in enumerate(generated["layouts"]):
            source = template["layouts"][index]
            schema = entry.get("schema") or {}
            components = source.get("components") or []
            layouts.append(
                {
                    "id": str(entry.get("layout_id") or source.get("id") or f"layout_{index + 1}"),
                    "name": source.get("name") or schema.get("title"),
                    "description": source.get("description") or schema.get("description"),
                    "schema": response_schema(schema),
                    "repeated": [
                        get_repeated_top_level_group_schema_name(component.get("elements") or [])
                        if isinstance(component, dict) and isinstance(component.get("elements"), list)
                        else None
                        for component in components
                    ],
                }
            )
        out[template["id"]] = layouts
    json.dump(out, sys.stdout, ensure_ascii=False)


if __name__ == "__main__":
    main(sys.argv[1:])
