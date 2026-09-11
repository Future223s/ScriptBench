"""Validate against catalog schemas, independently of output specifications."""
import base64
from copy import deepcopy
from jsonschema import Draft202012Validator
from jsonschema.exceptions import ValidationError


def _json_value(value):
    # Resolved payloads carry raw file bytes. Validate their serialized shape.
    if isinstance(value, bytes):
        return base64.b64encode(value).decode("ascii")
    if isinstance(value, dict):
        return {key: _json_value(item) for key, item in value.items()}
    if isinstance(value, list):
        return [_json_value(item) for item in value]
    return value


def validate_value(schema, value):
    try:
        Draft202012Validator(schema).validate(_json_value(value))
    except ValidationError as exc:
        path = ".".join(str(item) for item in exc.absolute_path) or "value"
        raise ValueError(f"{path}: {exc.message}") from exc


def validate_config(definition, config, method):
    if definition is None or not definition["active"]:
        raise ValueError("Select an active step executor")
    if method not in {item["name"] for item in definition["methods"]}:
        raise ValueError("Select a supported executor method")
    if method not in definition["input_schema"] or method not in definition["output_schema"]:
        raise ValueError("Executor method is missing validation schemas")
    result = deepcopy(config)
    for key, option in definition["config_schema"].get("properties", {}).items():
        if key not in result and "default" in option:
            result[key] = deepcopy(option["default"])
    validate_value(definition["config_schema"], result)
    return {key: value for key, value in result.items() if value is not None}
