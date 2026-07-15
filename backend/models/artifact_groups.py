from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, field_serializer


def _format_artifact_group_timestamp(value: datetime) -> str:
    return value.strftime("%b %d, %Y, %I:%M %p").replace(" 0", " ")


class ArtifactGroupRecord(BaseModel):
    artifact_group_id: int
    artifact_group_name: str
    artifact_group_description: str | None = None
    membership_mapping_id: int | None = None
    sample_mapping_id: int | None = None
    position_rule: dict[str, object] | None = None
    mapping_type: str
    status: str
    created_at: datetime
    model_config = ConfigDict(extra="forbid")


class ArtifactGroupCreateRequest(BaseModel):
    artifact_group_name: str
    artifact_group_description: str | None = None
    membership_mapping_id: int | None = None
    sample_mapping_id: int | None = None
    position_rule: dict[str, object] | None = None
    mapping_type: str = "one-to-one"

    model_config = ConfigDict(extra="forbid")


class ArtifactGroupDeleteRequest(BaseModel):
    artifact_group_ids: list[int]

    model_config = ConfigDict(extra="forbid")


class ArtifactGroupResponse(ArtifactGroupRecord):
    @field_serializer("created_at")
    def serialize_created_at(self, value: datetime) -> str:
        return _format_artifact_group_timestamp(value)


class ArtifactGroupSummaryResponse(BaseModel):
    artifact_group_id: int
    artifact_group_name: str
    artifact_group_description: str | None = None
    mapping_type: str
    status: str
    created_at: datetime

    model_config = ConfigDict(extra="forbid")

    @field_serializer("created_at")
    def serialize_created_at(self, value: datetime) -> str:
        return _format_artifact_group_timestamp(value)
