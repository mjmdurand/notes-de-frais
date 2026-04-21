import smtplib
import ssl
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.utils import formataddr

import httpx

from ..config import settings


# ── Template ─────────────────────────────────────────────────────────────────

def _template(title: str, body: str, cta_url: str = "", cta_label: str = "") -> str:
    cta_block = ""
    if cta_url and cta_label:
        cta_block = f"""
        <tr>
          <td style="padding:8px 0 24px;">
            <a href="{cta_url}"
               style="display:inline-block;background:#2563eb;color:#ffffff;font-size:14px;
                      font-weight:600;text-decoration:none;padding:12px 28px;
                      border-radius:8px;line-height:1;">
              {cta_label}
            </a>
          </td>
        </tr>"""

    return f"""<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>{title}</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
         style="background:#f1f5f9;padding:40px 16px;">
    <tr>
      <td align="center">

        <!-- Card -->
        <table width="600" cellpadding="0" cellspacing="0" role="presentation"
               style="background:#ffffff;border-radius:16px;overflow:hidden;
                      box-shadow:0 4px 24px rgba(0,0,0,.07);max-width:600px;width:100%;">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#1d4ed8 0%,#2563eb 100%);
                       padding:28px 40px;">
              <table cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td style="padding-right:12px;vertical-align:middle;">
                    <div style="width:40px;height:40px;background:rgba(255,255,255,.2);
                                border-radius:10px;display:flex;align-items:center;
                                justify-content:center;font-size:22px;line-height:40px;
                                text-align:center;">
                      📄
                    </div>
                  </td>
                  <td style="vertical-align:middle;">
                    <span style="color:#ffffff;font-size:20px;font-weight:700;
                                 letter-spacing:-.3px;">Notes de Frais</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px 40px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td>
                    <h1 style="margin:0 0 24px;font-size:22px;font-weight:700;
                               color:#0f172a;line-height:1.3;">
                      {title}
                    </h1>
                  </td>
                </tr>
                <tr>
                  <td style="font-size:15px;line-height:1.7;color:#334155;">
                    {body}
                  </td>
                </tr>
                {cta_block}
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f8fafc;border-top:1px solid #e2e8f0;
                       padding:20px 40px;text-align:center;">
              <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.6;">
                Cet email a été envoyé automatiquement par le système Notes de Frais.<br/>
                Merci de ne pas répondre à ce message.
              </p>
            </td>
          </tr>

        </table>
        <!-- /Card -->

      </td>
    </tr>
  </table>
</body>
</html>"""


def _status_badge(label: str, color: str) -> str:
    """Génère un badge de statut inline."""
    colors = {
        "orange": ("background:#fff7ed;color:#c2410c;border:1px solid #fed7aa;"),
        "blue":   ("background:#eff6ff;color:#1d4ed8;border:1px solid #bfdbfe;"),
        "green":  ("background:#f0fdf4;color:#15803d;border:1px solid #bbf7d0;"),
        "red":    ("background:#fef2f2;color:#b91c1c;border:1px solid #fecaca;"),
    }
    style = colors.get(color, colors["blue"])
    return (f'<span style="{style}font-size:12px;font-weight:600;'
            f'padding:3px 10px;border-radius:999px;">{label}</span>')


def _report_info_block(report_title: str, user_name: str, extra: str = "") -> str:
    return f"""
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
           style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;
                  margin:20px 0;overflow:hidden;">
      <tr>
        <td style="padding:16px 20px;border-left:4px solid #2563eb;">
          <p style="margin:0 0 4px;font-size:13px;color:#64748b;font-weight:500;">
            NOTE DE FRAIS
          </p>
          <p style="margin:0 0 6px;font-size:16px;font-weight:700;color:#0f172a;">
            {report_title}
          </p>
          <p style="margin:0;font-size:13px;color:#475569;">
            Soumise par <strong>{user_name}</strong>{extra}
          </p>
        </td>
      </tr>
    </table>"""


# ── Transport ─────────────────────────────────────────────────────────────────

def _sender() -> str:
    if settings.smtp_from_name:
        return formataddr((settings.smtp_from_name, settings.smtp_from))
    return settings.smtp_from


def _build_message(to: str, subject: str, html_body: str) -> MIMEMultipart:
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = _sender()
    msg["To"] = to
    msg.attach(MIMEText(html_body, "html"))
    return msg


def _send_via_smtp(to: str, subject: str, html_body: str):
    msg = _build_message(to, subject, html_body)
    mode = settings.smtp_mode

    if mode == "ssl":
        ctx = ssl.create_default_context()
        with smtplib.SMTP_SSL(settings.smtp_host, settings.smtp_port, context=ctx) as server:
            if settings.smtp_user:
                server.login(settings.smtp_user, settings.smtp_password)
            server.sendmail(settings.smtp_from, to, msg.as_string())
    else:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port) as server:
            if mode == "starttls":
                server.starttls(context=ssl.create_default_context())
            if settings.smtp_user:
                server.login(settings.smtp_user, settings.smtp_password)
            server.sendmail(settings.smtp_from, to, msg.as_string())


def _get_oauth2_token() -> str:
    import msal
    app = msal.ConfidentialClientApplication(
        client_id=settings.smtp_oauth_client_id,
        client_credential=settings.smtp_oauth_client_secret,
        authority=f"https://login.microsoftonline.com/{settings.smtp_oauth_tenant_id}",
    )
    result = app.acquire_token_for_client(scopes=["https://graph.microsoft.com/.default"])
    if "access_token" not in result:
        raise RuntimeError(f"OAuth2 token error: {result.get('error_description', result)}")
    return result["access_token"]


def _send_via_graph(to: str, subject: str, html_body: str):
    token = _get_oauth2_token()
    from_addr: dict = {"address": settings.smtp_from}
    if settings.smtp_from_name:
        from_addr["name"] = settings.smtp_from_name
    resp = httpx.post(
        f"https://graph.microsoft.com/v1.0/users/{settings.smtp_from}/sendMail",
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        json={
            "message": {
                "subject": subject,
                "body": {"contentType": "HTML", "content": html_body},
                "from": {"emailAddress": from_addr},
                "toRecipients": [{"emailAddress": {"address": to}}],
            },
            "saveToSentItems": False,
        },
        timeout=15,
    )
    if resp.status_code not in (200, 202):
        raise RuntimeError(f"Graph API error {resp.status_code}: {resp.text}")


def send_email(to: str, subject: str, html_body: str):
    try:
        if settings.smtp_mode == "oauth2":
            _send_via_graph(to, subject, html_body)
        else:
            _send_via_smtp(to, subject, html_body)
    except Exception as e:
        print(f"[email] Send failed to {to}: {e}")


# ── Emails métier ─────────────────────────────────────────────────────────────

def send_report_submitted(manager_email: str, manager_name: str, user_name: str,
                          report_title: str, report_id: str):
    cta = f"{settings.frontend_url}/expenses/{report_id}"
    body = f"""
    <p>Bonjour <strong>{manager_name}</strong>,</p>
    <p>Une note de frais est en attente de votre validation.</p>
    {_report_info_block(report_title, user_name)}
    <p style="color:#64748b;font-size:14px;">
      Cliquez sur le bouton ci-dessous pour consulter et valider cette note de frais.
    </p>"""
    send_email(
        to=manager_email,
        subject=f"[NDF] Note de frais en attente de validation — {report_title}",
        html_body=_template("Validation requise", body, cta, "Consulter la note de frais"),
    )


def send_report_approved_by_manager(accounting_emails: list, user_name: str,
                                    report_title: str, report_id: str):
    cta = f"{settings.frontend_url}/accounting"
    body = f"""
    <p>Bonjour,</p>
    <p>Une note de frais validée par le manager est en attente de votre validation comptable.</p>
    {_report_info_block(report_title, user_name,
                        f" · {_status_badge('Validée par le manager', 'orange')}")}
    <p style="color:#64748b;font-size:14px;">
      Accédez au tableau de bord comptabilité pour traiter cette note.
    </p>"""
    for email in accounting_emails:
        send_email(
            to=email,
            subject=f"[NDF] Note de frais à valider en comptabilité — {report_title}",
            html_body=_template("Action requise en comptabilité", body,
                                cta, "Accéder au tableau de bord"),
        )


def send_report_approved_final(user_email: str, user_name: str, report_title: str):
    body = f"""
    <p>Bonjour <strong>{user_name}</strong>,</p>
    <p>Bonne nouvelle ! Votre note de frais a été <strong>acceptée</strong> par la comptabilité.</p>
    {_report_info_block(report_title, user_name,
                        f" · {_status_badge('Approuvée', 'green')}")}
    <p style="color:#64748b;font-size:14px;">
      Un remboursement va prochainement être effectué sur votre compte.
    </p>"""
    send_email(
        to=user_email,
        subject=f"[NDF] Note de frais acceptée — {report_title}",
        html_body=_template("Note de frais acceptée ✓", body),
    )


def send_report_rejected(user_email: str, user_name: str, report_title: str,
                         step: str, reason: str = None):
    step_label = "votre manager" if step == "manager" else "la comptabilité"
    reason_block = ""
    if reason:
        reason_block = f"""
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
               style="background:#fef2f2;border:1px solid #fecaca;border-radius:10px;
                      margin:16px 0;">
          <tr>
            <td style="padding:14px 18px;">
              <p style="margin:0 0 4px;font-size:12px;font-weight:600;
                        color:#b91c1c;text-transform:uppercase;letter-spacing:.5px;">
                Motif du refus
              </p>
              <p style="margin:0;font-size:14px;color:#7f1d1d;">{reason}</p>
            </td>
          </tr>
        </table>"""
    body = f"""
    <p>Bonjour <strong>{user_name}</strong>,</p>
    <p>Votre note de frais a été <strong>refusée</strong> par {step_label}.</p>
    {_report_info_block(report_title, user_name,
                        f" · {_status_badge('Refusée', 'red')}")}
    {reason_block}
    <p style="color:#64748b;font-size:14px;">
      Si vous avez des questions, contactez votre responsable.
    </p>"""
    send_email(
        to=user_email,
        subject=f"[NDF] Note de frais refusée — {report_title}",
        html_body=_template("Note de frais refusée", body),
    )


def send_password_reset(user_email: str, user_name: str, token: str):
    reset_url = f"{settings.frontend_url}/reset-password?token={token}"
    body = f"""
    <p>Bonjour <strong>{user_name}</strong>,</p>
    <p>Vous avez demandé la réinitialisation de votre mot de passe.</p>
    <p>Cliquez sur le bouton ci-dessous pour choisir un nouveau mot de passe.
       Ce lien est valable <strong>1 heure</strong>.</p>
    <p style="margin-top:24px;padding:14px 18px;background:#f8fafc;border-radius:8px;
              font-size:13px;color:#64748b;border:1px solid #e2e8f0;">
      Si vous n'avez pas demandé cette réinitialisation, ignorez simplement cet email.
      Votre mot de passe ne sera pas modifié.
    </p>"""
    send_email(
        to=user_email,
        subject="[NDF] Réinitialisation de votre mot de passe",
        html_body=_template("Réinitialisation du mot de passe", body,
                            reset_url, "Réinitialiser mon mot de passe"),
    )
