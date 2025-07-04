from django.urls import path, include
from rest_framework_simplejwt.views import TokenRefreshView
from rest_framework.urlpatterns import format_suffix_patterns  # ✅ For better API format handling
from rest_framework.routers import DefaultRouter
from .views import (
    CustomAuthToken, ProductViewSet,CategoryViewSet,add_retailer,get_employee_id,logout_view, get_employees, get_retailers,get_counts,
    get_orders,get_users,get_employee_orders,recent_actions,get_employee_shipments,update_shipment_status,get_logged_in_user,allocate_order, get_trucks, get_shipments,category_stock_data,store_qr_code,
    save_odoo_credentials,register_user,get_available_employees_for_order, get_available_groups, InvoiceViewSet, CompanyViewSet, shipment_stats, invoice_count, approve_order,
    forgot_password, verify_otp, reset_password, resend_otp
)
# Add the router for InvoiceViewSet
router = DefaultRouter()
router.register(r'invoices', InvoiceViewSet, basename='invoice')
router.register(r'company', CompanyViewSet, basename='company')
router.register(r'products', ProductViewSet)
router.register(r'categories', CategoryViewSet, basename='category')

urlpatterns = [
    # Registration Endpoint
    path('register/', register_user, name='register_user'),

    # ✅ Authentication Endpoints
    path("token/", CustomAuthToken.as_view(), name="api_token_auth"),  # Login (Returns JWT tokens)
    path("token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),  # Refresh JWT token
    path("logout/", logout_view, name="api_logout"),  # Logout (Blacklist refresh token)

    # ✅ API Endpoints (Protected)
    path('retailers/add/', add_retailer, name='add_retailer'),
    path("employees/", get_employees, name="get_employees"),  # Admin Only
    path("retailers/", get_retailers, name="get_retailers"),  # Admin Only
    path("orders/", get_orders, name="get_orders"),  # Admin & Employees
    path("allocate-order/", allocate_order, name="allocate_orders"),  # Employees Only
    path("trucks/", get_trucks, name="get_trucks"),  # Admin Only
    path("shipments/", get_shipments, name="get_shipments"),  # Admin & Employees.
    path('category-stock/', category_stock_data, name='category-stock-data'),
    path('store_qr/', store_qr_code, name='store_qr'),
    
    #count
    path('approve_order/', approve_order),
    path('get_available_employees_for_order/', get_available_employees_for_order),
    path('invoices/count/', invoice_count, name='invoice-count'),
    path('shipment-stats/', shipment_stats, name='shipment_stats'),
    path('count/', get_counts, name='count'),   
    path('users/', get_users, name='get_users'), 
    path('user_detail/', get_logged_in_user, name='get_logged_in_user'),
    path('employee_shipments/', get_employee_shipments, name='employee_shipments'),
    path('update_shipment_status/', update_shipment_status, name='update-shipment-status'),
    path('employee_orders/', get_employee_orders, name='get_employee_orders'),
    path('recent_actions/', recent_actions, name='recent_actions'),
    path('employee_id/', get_employee_id, name='get_employee_id'),
    path('odoo/save-credentials/', save_odoo_credentials, name='save_odoo_credentials'),
    path('groups/', get_available_groups, name='get_available_groups'),
    
    # Password Reset Endpoints
    path('forgot-password/', forgot_password, name='forgot_password'),
    path('verify-otp/', verify_otp, name='verify_otp'),
    path('reset-password/', reset_password, name='reset_password'),
    path('resend-otp/', resend_otp, name='resend_otp'),
    
     # Add router URLs here
    path('', include(router.urls)),
]

# ✅ Support API requests with format suffixes (e.g., /orders.json, /orders.xml)
#urlpatterns = format_suffix_patterns(urlpatterns, allowed=["json", "html"])


