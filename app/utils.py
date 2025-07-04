from django.core.mail import send_mail
from django.conf import settings
from django.template.loader import render_to_string
from django.utils.html import strip_tags
import logging

logger = logging.getLogger(__name__)


def send_otp_email(user, otp):
    """
    Send OTP via email for password reset
    """
    subject = 'Password Reset OTP - Vendor Management System'
    
    # Create HTML email content
    html_message = f"""
    <html>
    <body>
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">Password Reset Request</h2>
            <p>Hello {user.first_name or user.username},</p>
            <p>You have requested to reset your password for your Vendor Management System account.</p>
            
            <div style="background-color: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0;">
                <h3 style="margin: 0; color: #333;">Your OTP Code:</h3>
                <p style="font-size: 24px; font-weight: bold; color: #007bff; margin: 10px 0; letter-spacing: 3px;">{otp}</p>
            </div>
            
            <p><strong>Important:</strong></p>
            <ul>
                <li>This OTP is valid for 10 minutes only</li>
                <li>Do not share this OTP with anyone</li>
                <li>If you didn't request this, please ignore this email</li>
            </ul>
            
            <p>Best regards,<br>Vendor Management System Team</p>
        </div>
    </body>
    </html>
    """
    
    # Create plain text version
    plain_message = f"""
    Password Reset Request
    
    Hello {user.first_name or user.username},
    
    You have requested to reset your password for your Vendor Management System account.
    
    Your OTP Code: {otp}
    
    Important:
    - This OTP is valid for 10 minutes only
    - Do not share this OTP with anyone
    - If you didn't request this, please ignore this email
    
    Best regards,
    Vendor Management System Team
    """
    
    try:
        send_mail(
            subject=subject,
            message=plain_message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[user.email],
            html_message=html_message,
            fail_silently=False,
        )
        logger.info(f"OTP email sent successfully to {user.email}")
        return True
    except Exception as e:
        logger.error(f"Failed to send OTP email to {user.email}: {str(e)}")
        return False


def send_password_reset_confirmation(user):
    """
    Send confirmation email after successful password reset
    """
    subject = 'Password Reset Successful - Vendor Management System'
    
    html_message = f"""
    <html>
    <body>
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #28a745;">Password Reset Successful</h2>
            <p>Hello {user.first_name or user.username},</p>
            <p>Your password has been successfully reset for your Vendor Management System account.</p>
            
            <div style="background-color: #d4edda; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #28a745;">
                <p style="margin: 0; color: #155724;">✓ Your password has been updated successfully</p>
            </div>
            
            <p>If you did not make this change, please contact our support team immediately.</p>
            
            <p>Best regards,<br>Vendor Management System Team</p>
        </div>
    </body>
    </html>
    """
    
    plain_message = f"""
    Password Reset Successful
    
    Hello {user.first_name or user.username},
    
    Your password has been successfully reset for your Vendor Management System account.
    
    If you did not make this change, please contact our support team immediately.
    
    Best regards,
    Vendor Management System Team
    """
    
    try:
        send_mail(
            subject=subject,
            message=plain_message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[user.email],
            html_message=html_message,
            fail_silently=False,
        )
        logger.info(f"Password reset confirmation email sent to {user.email}")
        return True
    except Exception as e:
        logger.error(f"Failed to send confirmation email to {user.email}: {str(e)}")
        return False
