from __future__ import annotations

from bson import ObjectId

from ..core.database import db
from ..core.config import logger
from ..utils.common import utc_now_iso


class EmailService:
    """Simple notification email facade. Replace with a real provider in production."""

    @staticmethod
    async def send_email(to: str, subject: str, html: str, email_type: str = "general") -> bool:
        logger.info("[MOCK EMAIL] To: %s, Subject: %s, Type: %s", to, subject, email_type)
        await db.email_logs.insert_one(
            {
                "to": to,
                "subject": subject,
                "html": html,
                "email_type": email_type,
                "sent_at": utc_now_iso(),
                "status": "mocked",
            }
        )
        return True

    @staticmethod
    async def send_notification_email(user_id: str, notification_type: str, data: dict) -> bool:
        user = await db.users.find_one({"_id": ObjectId(user_id)})
        if not user:
            return False

        templates = {
            "new_follower": {
                "subject": "You have a new follower on MzansiBuilds!",
                "html": f"<p>{data.get('follower_name', 'Someone')} started following you.</p>",
            },
            "new_comment": {
                "subject": "New comment on your project",
                "html": f"<p>{data.get('commenter_name', 'Someone')} commented on {data.get('project_title', 'your project')}.</p>",
            },
            "new_like": {
                "subject": "Someone liked your content!",
                "html": f"<p>{data.get('liker_name', 'Someone')} liked your {data.get('content_type', 'content')}.</p>",
            },
            "collaboration_request": {
                "subject": "New collaboration request",
                "html": f"<p>{data.get('requester_name', 'Someone')} wants to collaborate on {data.get('project_title', 'your project')}.</p>",
            },
        }

        template = templates.get(
            notification_type,
            {"subject": "Notification", "html": "<p>You have a new notification.</p>"},
        )
        return await EmailService.send_email(
            user["email"],
            template["subject"],
            template["html"],
            notification_type,
        )


email_service = EmailService()
