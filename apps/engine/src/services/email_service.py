import logging
import mailtrap as mt
from config import settings

logger = logging.getLogger("engine.services.email")

def generate_verification_email_html(recipient_email: str, verification_code: str) -> str:
    """Generates a responsive, elegant HTML verification email template."""
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verify Your Email - Agentic Workflow</title>
  <style>
    body {{
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background-color: #09090b;
      color: #f4f4f5;
      margin: 0;
      padding: 40px 20px;
    }}
    .container {{
      max-width: 520px;
      margin: 0 auto;
      background: #18181b;
      border: 1px solid rgba(168, 85, 247, 0.2);
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);
    }}
    .header {{
      background: linear-gradient(135deg, #7c3aed 0%, #db2777 100%);
      padding: 32px 24px;
      text-align: center;
    }}
    .header h1 {{
      margin: 0;
      font-size: 24px;
      font-weight: 800;
      color: #ffffff;
      letter-spacing: -0.5px;
    }}
    .header p {{
      margin: 6px 0 0 0;
      font-size: 13px;
      color: rgba(255, 255, 255, 0.85);
    }}
    .content {{
      padding: 32px 28px;
      text-align: center;
    }}
    .greeting {{
      font-size: 16px;
      color: #e4e4e7;
      margin-bottom: 16px;
    }}
    .message {{
      font-size: 14px;
      color: #a1a1aa;
      line-height: 1.6;
      margin-bottom: 28px;
    }}
    .code-box {{
      background: #09090b;
      border: 1px border #a855f7;
      border-radius: 12px;
      padding: 18px;
      display: inline-block;
      margin: 12px 0 28px 0;
      box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.6);
    }}
    .code {{
      font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
      font-size: 32px;
      font-weight: 800;
      letter-spacing: 8px;
      color: #c084fc;
      margin: 0;
    }}
    .footer {{
      border-top: 1px solid #27272a;
      padding: 20px 24px;
      text-align: center;
      font-size: 12px;
      color: #71717a;
    }}
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Agentic Workflow Engine</h1>
      <p>Secure Account Email Verification</p>
    </div>
    <div class="content">
      <div class="greeting">Hello, 👋</div>
      <div class="message">
        Thank you for signing up for Agentic Workflow Engine. Please use the 6-digit verification code below to complete your email verification:
      </div>
      <div class="code-box">
        <div class="code">{verification_code}</div>
      </div>
      <div class="message" style="font-size: 12px; color: #71717a;">
        This verification code expires shortly. If you did not request this account, you can safely ignore this email.
      </div>
    </div>
    <div class="footer">
      &copy; Agentic Workflow Platform. All rights reserved.
    </div>
  </div>
</body>
</html>"""


def send_verification_email(recipient_email: str, verification_code: str) -> bool:
    """
    Sends email verification via official Mailtrap Python SDK.
    Falls back gracefully if MAILTRAP_API_TOKEN is not set.
    """
    if not settings.MAILTRAP_API_TOKEN:
        logger.warning(f"[EMAIL MOCK] Mailtrap API Token not configured. Verification code for {recipient_email}: {verification_code}")
        return False

    try:
        client = mt.MailtrapClient(token=settings.MAILTRAP_API_TOKEN)
        mail = mt.Mail(
            sender=mt.Address(email=settings.SENDER_EMAIL, name=settings.SENDER_NAME),
            to=[mt.Address(email=recipient_email)],
            subject="Verify Your Email Address - Agentic Workflow",
            html=generate_verification_email_html(recipient_email, verification_code),
        )
        client.send(mail)
        logger.info(f"Verification email sent via Mailtrap SDK to {recipient_email}")
        return True
    except Exception as e:
        logger.error(f"Failed to send email via Mailtrap SDK: {e}")
        return False
