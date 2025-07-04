# Password Reset API Testing Guide

## Prerequisites
1. Set up email configuration in Railway environment variables:
   - `EMAIL_HOST_USER`: Your Gmail address
   - `EMAIL_HOST_PASSWORD`: Your Gmail app password

## API Endpoints

### 1. Forgot Password
**POST** `/forgot-password/`

```json
{
    "username": "testuser",
    "email": "user@example.com"
}
```

**Response:**
```json
{
    "message": "OTP sent successfully to your email address.",
    "username": "testuser"
}
```

### 2. Verify OTP
**POST** `/verify-otp/`

```json
{
    "username": "testuser",
    "otp": "123456"
}
```

**Response:**
```json
{
    "message": "OTP verified successfully. You can now reset your password.",
    "username": "testuser",
    "otp": "123456"
}
```

### 3. Reset Password
**POST** `/reset-password/`

```json
{
    "username": "testuser",
    "otp": "123456",
    "new_password": "newpassword123",
    "confirm_password": "newpassword123"
}
```

**Response:**
```json
{
    "message": "Password reset successfully. You can now login with your new password."
}
```

### 4. Resend OTP
**POST** `/resend-otp/`

```json
{
    "username": "testuser"
}
```

**Response:**
```json
{
    "message": "New OTP sent successfully to your email address."
}
```

## Frontend Integration Example

```javascript
// 1. Forgot Password
const forgotPassword = async (username, email) => {
    const response = await fetch('https://vendor-backendproduction.up.railway.app/forgot-password/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, email })
    });
    return response.json();
};

// 2. Verify OTP
const verifyOTP = async (username, otp) => {
    const response = await fetch('https://vendor-backendproduction.up.railway.app/verify-otp/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, otp })
    });
    return response.json();
};

// 3. Reset Password
const resetPassword = async (username, otp, newPassword, confirmPassword) => {
    const response = await fetch('https://vendor-backendproduction.up.railway.app/reset-password/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
            username, 
            otp, 
            new_password: newPassword,
            confirm_password: confirmPassword
        })
    });
    return response.json();
};

// 4. Resend OTP
const resendOTP = async (username) => {
    const response = await fetch('https://vendor-backendproduction.up.railway.app/resend-otp/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username })
    });
    return response.json();
};
```

## Testing Steps

1. **Test with existing user**: Use a user that already exists in your database
2. **Check email**: Make sure the email in the user profile is valid
3. **Configure Gmail**: Set up Gmail app password in Railway environment variables
4. **Test the flow**:
   - Call forgot-password API
   - Check email for OTP
   - Call verify-otp API
   - Call reset-password API
   - Try logging in with new password

## Error Handling

The APIs return appropriate error messages for:
- User not found
- Invalid/expired OTP
- Password mismatch
- Email sending failures

## Security Features

- OTP expires in 10 minutes
- OTP is deleted after successful password reset
- Previous unverified OTPs are deleted when new one is generated
- Email confirmation sent after successful password reset
