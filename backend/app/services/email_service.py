import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from ..config import settings


def send_email(to: str, subject: str, html_body: str):
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = settings.smtp_from
    msg["To"] = to
    msg.attach(MIMEText(html_body, "html"))

    try:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port) as server:
            if settings.smtp_user and settings.smtp_password:
                server.login(settings.smtp_user, settings.smtp_password)
            server.sendmail(settings.smtp_from, to, msg.as_string())
    except Exception as e:
        print(f"Email send failed to {to}: {e}")


def send_report_submitted(manager_email: str, manager_name: str, user_name: str, report_title: str, report_id: str):
    send_email(
        to=manager_email,
        subject=f"[NDF] Note de frais en attente de validation - {report_title}",
        html_body=f"""
        <p>Bonjour {manager_name},</p>
        <p><strong>{user_name}</strong> a soumis une note de frais <em>{report_title}</em> qui est en attente de votre validation.</p>
        <p><a href="{settings.frontend_url}/expenses/{report_id}">Consulter la note de frais</a></p>
        <p>Cordialement,<br>Système NDF</p>
        """,
    )


def send_report_approved_by_manager(accounting_emails: list, user_name: str, report_title: str, report_id: str):
    for email in accounting_emails:
        send_email(
            to=email,
            subject=f"[NDF] Note de frais à valider en comptabilité - {report_title}",
            html_body=f"""
            <p>Bonjour,</p>
            <p>La note de frais <em>{report_title}</em> de <strong>{user_name}</strong> a été validée par le manager et est en attente de validation comptable.</p>
            <p><a href="{settings.frontend_url}/accounting">Accéder au tableau de bord comptabilité</a></p>
            <p>Cordialement,<br>Système NDF</p>
            """,
        )


def send_report_approved_final(user_email: str, user_name: str, report_title: str):
    send_email(
        to=user_email,
        subject=f"[NDF] Note de frais acceptée - {report_title}",
        html_body=f"""
        <p>Bonjour {user_name},</p>
        <p>Votre note de frais <em>{report_title}</em> a été acceptée par la comptabilité. Un remboursement va bientôt être effectué sur votre compte.</p>
        <p>Cordialement,<br>Système NDF</p>
        """,
    )


def send_password_reset(user_email: str, user_name: str, token: str):
    reset_url = f"{settings.frontend_url}/reset-password?token={token}"
    send_email(
        to=user_email,
        subject="[NDF] Réinitialisation de votre mot de passe",
        html_body=f"""
        <p>Bonjour {user_name},</p>
        <p>Vous avez demandé la réinitialisation de votre mot de passe.</p>
        <p><a href="{reset_url}" style="background:#2563eb;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;">
        Réinitialiser mon mot de passe</a></p>
        <p style="color:#6b7280;font-size:12px;">Ce lien est valable 1 heure. Si vous n'avez pas fait cette demande, ignorez cet email.</p>
        <p>Cordialement,<br>Système NDF</p>
        """,
    )


def send_report_rejected(user_email: str, user_name: str, report_title: str, step: str, reason: str = None):
    step_label = "votre manager" if step == "manager" else "la comptabilité"
    reason_html = f"<p><strong>Motif :</strong> {reason}</p>" if reason else ""
    send_email(
        to=user_email,
        subject=f"[NDF] Note de frais refusée - {report_title}",
        html_body=f"""
        <p>Bonjour {user_name},</p>
        <p>Votre note de frais <em>{report_title}</em> a été refusée par {step_label}.</p>
        {reason_html}
        <p>Cordialement,<br>Système NDF</p>
        """,
    )
