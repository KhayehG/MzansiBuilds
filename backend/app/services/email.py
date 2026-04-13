from __future__ import annotations

import os
from bson import ObjectId

try:
    from resend import Resend
    RESEND_AVAILABLE = True
except ImportError:
    RESEND_AVAILABLE = False

from ..core.database import db
from ..core.config import logger
from ..utils.common import utc_now_iso


class EmailService:
    """Email notification service using Resend for production, mock for development."""

    _resend_client = None

    @classmethod
    def _get_resend_client(cls):
        """Lazy-load Resend client."""
        if cls._resend_client is None and RESEND_AVAILABLE:
            api_key = os.environ.get("RESEND_API_KEY")
            if api_key:
                cls._resend_client = Resend(api_key)
                logger.info("Resend email client initialized")
        return cls._resend_client

    @staticmethod
    async def send_email(to: str, subject: str, html: str, email_type: str = "general") -> bool:
        resend = EmailService._get_resend_client()
        from_email = os.environ.get("RESEND_FROM_EMAIL", "noreply@mzansibuilds.com")

        # Try real Resend first
        if resend:
            try:
                result = resend.emails.send(
                    {
                        "from": from_email,
                        "to": to,
                        "subject": subject,
                        "html": html,
                    }
                )
                status = "sent"
                logger.info("Email sent via Resend to %s (ID: %s)", to, result.get("id"))
            except Exception as e:
                logger.error("Resend email failed for %s: %s", to, str(e))
                status = "failed"
                return False
        else:
            # Fallback to mock for development
            logger.warning("[MOCK EMAIL] To: %s, Subject: %s, Type: %s (Resend not configured)", to, subject, email_type)
            status = "mocked"

        # Log all email attempts
        await db.email_logs.insert_one(
            {
                "to": to,
                "subject": subject,
                "html": html,
                "email_type": email_type,
                "sent_at": utc_now_iso(),
                "status": status,
                "from": from_email,
            }
        )
        return status in ("sent", "mocked")

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
