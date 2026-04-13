from __future__ import annotations

from typing import List, Literal, Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field

ProjectStage = Literal["idea", "in_progress", "completed"]
SdlcType = Literal["waterfall", "agile"]
WaterfallStage = Literal[
    "planning",
    "requirements",
    "design",
    "development",
    "testing",
    "deployment",
    "maintenance",
]
AgileStage = Literal[
    "backlog",
    "sprint_planning",
    "development",
    "testing",
    "review",
]
SdlcStage = Literal[
    "planning",
    "requirements",
    "design",
    "development",
    "testing",
    "deployment",
    "maintenance",
    "backlog",
    "sprint_planning",
    "review",
]


class StrictBaseModel(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class UserCreate(StrictBaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    username: str = Field(min_length=3, max_length=30)
    bio: Optional[str] = Field(default="", max_length=280)


class UserLogin(StrictBaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class ForgotPasswordRequest(StrictBaseModel):
    email: EmailStr


class ResetPasswordRequest(StrictBaseModel):
    token: str
    new_password: str = Field(min_length=8, max_length=128)


class UserProfileUpdate(StrictBaseModel):
    username: Optional[str] = Field(default=None, min_length=3, max_length=30)
    bio: Optional[str] = Field(default=None, max_length=280)
    profile_picture_url: Optional[str] = None
    skills: Optional[List[str]] = Field(default=None, max_length=10)
    github_url: Optional[str] = None
    linkedin_url: Optional[str] = None


class ProjectCreate(StrictBaseModel):
    title: str = Field(min_length=3, max_length=120)
    description: str = Field(min_length=10, max_length=5000)
    stage: ProjectStage = "idea"
    support_needed: Optional[str] = Field(default="", max_length=500)
    sdlc_type: SdlcType = "waterfall"
    current_stage: Optional[SdlcStage] = None


class ProjectUpdate(StrictBaseModel):
    title: Optional[str] = Field(default=None, min_length=3, max_length=120)
    description: Optional[str] = Field(default=None, min_length=10, max_length=5000)
    stage: Optional[ProjectStage] = None
    support_needed: Optional[str] = Field(default=None, max_length=500)
    current_stage: Optional[SdlcStage] = None


class UpdateCreate(StrictBaseModel):
    content: str = Field(min_length=1, max_length=2000)


class StageTransitionCreate(StrictBaseModel):
    to_stage: SdlcStage
    reason: str = Field(min_length=3, max_length=500)


class MilestoneCreate(StrictBaseModel):
    stage_name: SdlcStage
    title: str = Field(min_length=2, max_length=120)
    description: str = Field(min_length=1, max_length=2000)
    is_retrospective: bool = False


class MilestoneUpdate(StrictBaseModel):
    title: Optional[str] = Field(default=None, min_length=2, max_length=120)
    description: Optional[str] = Field(default=None, min_length=1, max_length=2000)
    stage_name: Optional[SdlcStage] = None


class CommentCreate(StrictBaseModel):
    content: str = Field(min_length=1, max_length=1000)
    parent_id: Optional[str] = None


class CollaborationRequestCreate(StrictBaseModel):
    message: Optional[str] = Field(default="", max_length=1000)



class LikeCreate(StrictBaseModel):
    project_id: Optional[str] = None
    update_id: Optional[str] = None
    comment_id: Optional[str] = None


# --- Messaging & Notification Schemas ---

from enum import Enum

class ConversationType(str, Enum):
    project = "project"
    private = "private"

class ConversationCreate(StrictBaseModel):
    type: ConversationType
    project_id: Optional[str] = None  # Only for project chat

class ConversationParticipantCreate(StrictBaseModel):
    conversation_id: str
    user_id: str

class MessageCreate(StrictBaseModel):
    conversation_id: str
    content: str = Field(min_length=1, max_length=4000)

class MessageReadUpdate(StrictBaseModel):
    message_id: str
    is_read: bool

class NotificationCreate(StrictBaseModel):
    user_id: str
    message: str
    is_read: bool = False
