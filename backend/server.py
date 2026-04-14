from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Response, UploadFile, File
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import StreamingResponse, FileResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import json
import logging
import re
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
import jwt
import secrets
import bcrypt
import httpx
import csv
import io
import asyncio
import resend
import stripe

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Settings
JWT_SECRET = os.environ.get('JWT_SECRET', 'earnrm_secret_key')
JWT_ALGORITHM = os.environ.get('JWT_ALGORITHM', 'HS256')
JWT_EXPIRY_HOURS = int(os.environ.get('JWT_EXPIRY_HOURS', 24))

# Resend Email Configuration
RESEND_API_KEY = os.environ.get('RESEND_API_KEY')
SENDER_EMAIL = os.environ.get('SENDER_EMAIL', 'onboarding@resend.dev')
if RESEND_API_KEY:
    resend.api_key = RESEND_API_KEY

# Stripe Configuration
STRIPE_API_KEY = os.environ.get('STRIPE_API_KEY')


class CheckoutSessionRequest(BaseModel):
    amount: float
    currency: str
    success_url: str
    cancel_url: str
    metadata: Dict[str, str] = Field(default_factory=dict)
    payment_methods: List[str] = Field(default_factory=lambda: ["card"])


class CheckoutSessionResponse(BaseModel):
    url: str
    session_id: str


class CheckoutStatusResponse(BaseModel):
    status: str
    payment_status: str
    amount_total: int
    currency: str


class StripeWebhookResponse(BaseModel):
    event_type: str
    session_id: Optional[str] = None
    payment_status: Optional[str] = None


class StripeCheckout:
    def __init__(self, api_key: str, webhook_url: str):
        self.api_key = api_key
        self.webhook_url = webhook_url
        stripe.api_key = api_key

    @staticmethod
    def _normalize_methods(payment_methods: List[str]) -> List[str]:
        allowed = {"card", "link", "us_bank_account", "sepa_debit", "cashapp"}
        normalized = [method for method in payment_methods if method in allowed]
        return normalized or ["card"]

    async def create_checkout_session(self, request: CheckoutSessionRequest) -> CheckoutSessionResponse:
        metadata = {str(k): str(v) for k, v in (request.metadata or {}).items()}
        payment_methods = self._normalize_methods(request.payment_methods)
        unit_amount = max(int(round(float(request.amount) * 100)), 1)

        def _create_session():
            return stripe.checkout.Session.create(
                mode="payment",
                payment_method_types=payment_methods,
                line_items=[
                    {
                        "price_data": {
                            "currency": (request.currency or "eur").lower(),
                            "unit_amount": unit_amount,
                            "product_data": {
                                "name": metadata.get("product", "EarnRM Payment")
                            },
                        },
                        "quantity": 1,
                    }
                ],
                success_url=request.success_url,
                cancel_url=request.cancel_url,
                metadata=metadata,
            )

        session = await asyncio.to_thread(_create_session)
        return CheckoutSessionResponse(url=session.url, session_id=session.id)

    async def get_checkout_status(self, session_id: str) -> CheckoutStatusResponse:
        session = await asyncio.to_thread(stripe.checkout.Session.retrieve, session_id)
        return CheckoutStatusResponse(
            status=getattr(session, "status", "unknown"),
            payment_status=getattr(session, "payment_status", "unpaid"),
            amount_total=int(getattr(session, "amount_total", 0) or 0),
            currency=(getattr(session, "currency", "eur") or "eur"),
        )

    async def handle_webhook(self, body: bytes, signature: Optional[str]) -> StripeWebhookResponse:
        payload = body.decode("utf-8")
        secret = os.environ.get("STRIPE_WEBHOOK_SECRET")

        if secret and signature:
            event = await asyncio.to_thread(
                stripe.Webhook.construct_event, payload, signature, secret
            )
        else:
            event = json.loads(payload)

        event_type = event.get("type", "")
        data_object = (event.get("data") or {}).get("object") or {}
        session_id = data_object.get("id")
        payment_status = data_object.get("payment_status")

        return StripeWebhookResponse(
            event_type=event_type,
            session_id=session_id,
            payment_status=payment_status,
        )

# Subscription Plans (amounts in EUR)
SUBSCRIPTION_PLANS = {
    "monthly": {
        "id": "monthly",
        "name": "Pro Monthly",
        "price": 15.00,
        "currency": "eur",
        "interval": "month",
        "description": "€15 per user per month"
    },
    "annual": {
        "id": "annual", 
        "name": "Pro Annual",
        "price": 144.00,  # €12/month * 12 = €144/year (20% discount)
        "currency": "eur",
        "interval": "year",
        "description": "€12 per user per month (20% discount)"
    }
}

# Create the main app
app = FastAPI(title="earnrm CRM API")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

security = HTTPBearer(auto_error=False)

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ==================== MODELS ====================

class UserBase(BaseModel):
    email: EmailStr
    name: str
    picture: Optional[str] = None

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: str
    organization_name: Optional[str] = None
    invite_code: Optional[str] = None
    ref_code: Optional[str] = None

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    user_id: str
    email: EmailStr
    name: str
    picture: Optional[str] = None
    organization_id: Optional[str] = None
    role: str = "member"
    created_at: datetime

class Organization(BaseModel):
    model_config = ConfigDict(extra="ignore")
    organization_id: str
    name: str
    owner_id: str
    plan: str = "free"
    user_count: int = 1
    max_free_users: int = 3
    created_at: datetime

class Lead(BaseModel):
    model_config = ConfigDict(extra="ignore")
    lead_id: str
    organization_id: str
    first_name: str
    last_name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    company: Optional[str] = None
    job_title: Optional[str] = None
    linkedin_url: Optional[str] = None
    source: str = "manual"
    status: str = "new"
    ai_score: Optional[int] = None
    notes: Optional[str] = None
    assigned_to: Optional[str] = None
    created_by: str
    created_at: datetime
    updated_at: datetime

class LeadCreate(BaseModel):
    first_name: str
    last_name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    company: Optional[str] = None
    job_title: Optional[str] = None
    linkedin_url: Optional[str] = None
    source: str = "manual"
    notes: Optional[str] = None

class Company(BaseModel):
    model_config = ConfigDict(extra="ignore")
    company_id: str
    organization_id: str
    name: str
    industry: Optional[str] = None
    website: Optional[str] = None
    size: Optional[str] = None
    description: Optional[str] = None
    created_by: str
    created_at: datetime

class CompanyCreate(BaseModel):
    name: str
    industry: Optional[str] = None
    website: Optional[str] = None
    size: Optional[str] = None
    description: Optional[str] = None

class Deal(BaseModel):
    model_config = ConfigDict(extra="ignore")
    deal_id: str
    organization_id: str
    name: str
    value: float = 0
    currency: str = "EUR"
    stage: str = "lead"
    probability: int = 0  # 0-100 percentage
    lead_id: Optional[str] = None
    company_id: Optional[str] = None
    assigned_to: Optional[str] = None
    expected_close_date: Optional[datetime] = None
    tags: List[str] = []  # Tags for filtering
    notes: Optional[str] = None
    created_by: str
    created_at: datetime
    updated_at: datetime

class DealCreate(BaseModel):
    name: str
    value: float = 0
    currency: str = "EUR"
    stage: str = "lead"
    probability: int = 0
    lead_id: Optional[str] = None
    contact_id: Optional[str] = None
    company_id: Optional[str] = None
    expected_close_date: Optional[datetime] = None
    tags: List[str] = []
    notes: Optional[str] = None
    task_title: Optional[str] = None
    task_owner_id: Optional[str] = None
    task_description: Optional[str] = None
    task_due_date: Optional[datetime] = None

class Task(BaseModel):
    model_config = ConfigDict(extra="ignore")
    task_id: str
    organization_id: str
    title: str
    description: Optional[str] = None
    status: str = "todo"
    priority: str = "medium"
    due_date: Optional[datetime] = None
    assigned_to: Optional[str] = None
    related_lead_id: Optional[str] = None
    related_deal_id: Optional[str] = None
    created_by: str
    created_at: datetime
    updated_at: datetime

class TaskCreate(BaseModel):
    title: str
    description: Optional[str] = None
    status: str = "todo"
    priority: str = "medium"
    due_date: Optional[datetime] = None
    assigned_to: Optional[str] = None
    related_lead_id: Optional[str] = None
    related_deal_id: Optional[str] = None
    project_id: Optional[str] = None

class Campaign(BaseModel):
    model_config = ConfigDict(extra="ignore")
    campaign_id: str
    organization_id: str
    name: str
    subject: str
    content: str
    status: str = "draft"
    recipients: List[str] = []
    sent_count: int = 0
    open_count: int = 0
    click_count: int = 0
    created_by: str
    created_at: datetime
    scheduled_at: Optional[datetime] = None

class CampaignCreate(BaseModel):
    name: str
    subject: str
    content: str
    recipients: List[str] = []
    scheduled_at: Optional[datetime] = None

class Subscription(BaseModel):
    model_config = ConfigDict(extra="ignore")
    subscription_id: str
    organization_id: str
    plan: str
    billing_cycle: str = "monthly"
    price_per_user: float = 15.0
    discount_percent: float = 0
    status: str = "active"
    payment_method: str = "stripe"
    current_period_start: datetime
    current_period_end: datetime
    created_at: datetime

class PaymentTransaction(BaseModel):
    model_config = ConfigDict(extra="ignore")
    transaction_id: str
    organization_id: str
    amount: float
    currency: str = "EUR"
    status: str = "pending"
    payment_method: str
    session_id: Optional[str] = None
    metadata: Dict[str, Any] = {}
    created_at: datetime

# ==================== DISCOUNT & AFFILIATE MODELS ====================

class DiscountCode(BaseModel):
    model_config = ConfigDict(extra="ignore")
    code_id: str
    code: str  # The actual discount code string
    discount_percent: float  # Percentage discount (0-100)
    discount_type: str = "percentage"  # percentage, fixed_amount
    fixed_amount: Optional[float] = None
    valid_from: Optional[datetime] = None
    valid_until: Optional[datetime] = None
    max_uses: Optional[int] = None  # None = unlimited
    current_uses: int = 0
    applicable_plans: List[str] = []  # empty = all plans
    created_by: str
    created_at: datetime
    is_active: bool = True

class DiscountCodeCreate(BaseModel):
    code: str
    discount_percent: float = 0
    discount_type: str = "percentage"
    fixed_amount: Optional[float] = None
    valid_from: Optional[str] = None
    valid_until: Optional[str] = None
    max_uses: Optional[int] = None
    applicable_plans: List[str] = []

class Affiliate(BaseModel):
    model_config = ConfigDict(extra="ignore")
    affiliate_id: str
    user_id: str  # The user who is an affiliate
    affiliate_code: str  # Unique referral code
    tier: int = 1  # 1, 2, or 3
    parent_affiliate_id: Optional[str] = None  # For tier 2 & 3
    grandparent_affiliate_id: Optional[str] = None  # For tier 3
    commission_rate_tier1: float = 20.0  # Direct referral commission %
    commission_rate_tier2: float = 10.0  # Tier 2 commission %
    commission_rate_tier3: float = 5.0   # Tier 3 commission %
    total_referrals: int = 0
    total_earnings: float = 0
    pending_earnings: float = 0
    paid_earnings: float = 0
    created_at: datetime
    is_active: bool = True

class AffiliateCreate(BaseModel):
    user_id: str
    affiliate_code: Optional[str] = None
    parent_affiliate_id: Optional[str] = None
    commission_rate_tier1: float = 20.0
    commission_rate_tier2: float = 10.0
    commission_rate_tier3: float = 5.0

class AffiliateReferral(BaseModel):
    model_config = ConfigDict(extra="ignore")
    referral_id: str
    affiliate_id: str  # Who referred
    referred_user_id: str  # Who was referred
    referred_org_id: Optional[str] = None
    tier_level: int  # 1, 2, or 3
    commission_amount: float = 0
    commission_status: str = "pending"  # pending, paid, cancelled
    payment_amount: float = 0  # The payment that triggered this
    created_at: datetime

class SuperAdminCreate(BaseModel):
    email: EmailStr
    password: str
    name: str

# ==================== SUPPORT & SETTINGS MODELS ====================

class ContactFormSubmit(BaseModel):
    name: str
    email: EmailStr
    subject: str
    message: str

# Bulk Operations Models
class BulkDeleteRequest(BaseModel):
    entity_type: str
    entity_ids: List[str]

class BulkUpdateRequest(BaseModel):
    entity_type: str
    entity_ids: List[str]
    updates: dict

class BulkEnrichRequest(BaseModel):
    entity_type: str
    entity_ids: List[str]

class BulkAddToCampaignRequest(BaseModel):
    campaign_id: str
    entity_type: str
    entity_ids: List[str]

class PlatformSettings(BaseModel):
    model_config = ConfigDict(extra="ignore")
    setting_id: str = "platform_settings"
    support_email: str = "support@earnrm.com"
    stripe_api_key: Optional[str] = None
    paypal_client_id: Optional[str] = None
    paypal_client_secret: Optional[str] = None
    crypto_wallet_address: Optional[str] = None
    # Pipeline stages configuration
    deal_stages: List[dict] = [
        {"id": "lead", "name": "Lead", "order": 1},
        {"id": "qualified", "name": "Qualified", "order": 2},
        {"id": "proposal", "name": "Proposal", "order": 3},
        {"id": "negotiation", "name": "Negotiation", "order": 4},
        {"id": "won", "name": "Won", "order": 5},
        {"id": "lost", "name": "Lost", "order": 6}
    ]
    task_stages: List[dict] = [
        {"id": "todo", "name": "To Do", "order": 1},
        {"id": "in_progress", "name": "In Progress", "order": 2},
        {"id": "done", "name": "Done", "order": 3}
    ]
    # UK VAT rate
    vat_rate: float = 20.0
    updated_at: Optional[datetime] = None

# ==================== PAYMENT & INVOICE MODELS ====================

class SubscriptionRequest(BaseModel):
    plan_id: str  # "monthly" or "annual"
    user_count: int = 1
    discount_code: Optional[str] = None
    use_crypto: bool = False  # If true, apply 5% crypto discount
    origin_url: str  # Frontend origin for success/cancel URLs

class PaymentTransaction(BaseModel):
    model_config = ConfigDict(extra="ignore")
    transaction_id: str
    organization_id: str
    user_id: str
    email: str
    amount: float
    currency: str
    plan_id: str
    user_count: int
    discount_code: Optional[str] = None
    discount_amount: float = 0
    vat_amount: float = 0
    vat_rate: float = 20.0
    total_amount: float
    stripe_session_id: str
    payment_status: str = "pending"  # pending, paid, failed, expired
    invoice_id: Optional[str] = None
    created_at: datetime
    updated_at: datetime

class Invoice(BaseModel):
    model_config = ConfigDict(extra="ignore")
    invoice_id: str
    invoice_number: str
    organization_id: str
    user_id: str
    email: str
    billing_name: str
    billing_address: Optional[str] = None
    # Line items
    plan_name: str
    user_count: int
    unit_price: float
    subtotal: float
    discount_code: Optional[str] = None
    discount_amount: float = 0
    net_amount: float
    vat_rate: float = 20.0
    vat_amount: float
    total_amount: float
    currency: str = "EUR"
    # Status
    status: str = "paid"  # draft, paid
    transaction_id: str
    stripe_session_id: str
    # Dates
    invoice_date: datetime
    created_at: datetime

# ==================== AUTH HELPERS ====================

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def create_jwt_token(user_id: str, email: str, organization_id: str = None) -> str:
    payload = {
        "user_id": user_id,
        "email": email,
        "organization_id": organization_id,
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRY_HOURS)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def decode_jwt_token(token: str) -> dict:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> dict:
    # Check cookie first
    session_token = request.cookies.get("session_token")
    if session_token:
        session = await db.user_sessions.find_one({"session_token": session_token}, {"_id": 0})
        if session:
            expires_at = session.get("expires_at")
            if isinstance(expires_at, str):
                expires_at = datetime.fromisoformat(expires_at)
            if expires_at.tzinfo is None:
                expires_at = expires_at.replace(tzinfo=timezone.utc)
            if expires_at > datetime.now(timezone.utc):
                user = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0})
                if user:
                    return user
    
    # Check Authorization header
    if credentials:
        token = credentials.credentials
        payload = decode_jwt_token(token)
        user = await db.users.find_one({"user_id": payload["user_id"]}, {"_id": 0})
        if user:
            return user
    
    raise HTTPException(status_code=401, detail="Not authenticated")

# Super Admin check helper
SUPER_ADMIN_EMAIL = os.environ.get("SUPER_ADMIN_EMAIL", "florian@unyted.world")

async def require_super_admin(current_user: dict = Depends(get_current_user)) -> dict:
    """Dependency that requires the user to be a super admin or deputy admin"""
    if current_user.get("role") not in ["super_admin", "deputy_admin"] and current_user.get("email") != SUPER_ADMIN_EMAIL:
        raise HTTPException(status_code=403, detail="Super admin access required")
    return current_user

# ==================== TAKO AI (Claude) ====================

ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")

# Internal domains and emails that get free AI via TAKO's Anthropic key
_TAKO_INTERNAL_DOMAINS = {
    "fintery.com", "tako.software", "aios.dev", "unyted.world",
    "unyted.chat", "openclaw.com", "floriankrueger.com",
}
_TAKO_INTERNAL_EMAILS = {
    "fbjk2000@gmail.com", "fbjk2000ai@gmail.com",
    "florian@floriankrueger.com", "florian@unyted.world",
}

def _is_internal_user(email: str) -> bool:
    """Check if user is part of TAKO's internal team"""
    if not email:
        return False
    email_lower = email.lower().strip()
    if email_lower in _TAKO_INTERNAL_EMAILS:
        return True
    domain = email_lower.split("@")[-1]
    return domain in _TAKO_INTERNAL_DOMAINS

async def _resolve_ai_key(user_email: str, org_id: str | None = None) -> str:
    """Determine the Anthropic API key to use.
    Priority: 1) internal team → platform key, 2) org-level key from DB, 3) reject."""
    if _is_internal_user(user_email):
        if ANTHROPIC_API_KEY:
            return ANTHROPIC_API_KEY
        raise HTTPException(status_code=500, detail="AI not configured — platform ANTHROPIC_API_KEY missing")

    # Look up org-level key
    if org_id:
        settings = await db.org_integrations.find_one({"organization_id": org_id}, {"anthropic_api_key": 1})
        if settings and settings.get("anthropic_api_key"):
            return settings["anthropic_api_key"]

    raise HTTPException(
        status_code=403,
        detail="AI features require an API key. Go to Settings → Integrations → AI / LLM to add your Anthropic API key."
    )

async def tako_ai_text(system_prompt: str, user_prompt: str, user_email: str = "", org_id: str | None = None) -> str:
    """Send a text-only request to Claude. Returns the response text.
    Raises HTTPException if user has no AI access."""
    import anthropic

    api_key = await _resolve_ai_key(user_email, org_id)

    client = anthropic.AsyncAnthropic(api_key=api_key)
    message = await client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=1024,
        system=system_prompt,
        messages=[{"role": "user", "content": user_prompt}],
    )
    return message.content[0].text

async def tako_ai_vision(system_prompt: str, user_prompt: str, image_b64: str, media_type: str = "image/jpeg", user_email: str = "", org_id: str | None = None) -> str:
    """Send an image + text request to Claude. Returns the response text."""
    import anthropic

    api_key = await _resolve_ai_key(user_email, org_id)

    client = anthropic.AsyncAnthropic(api_key=api_key)
    message = await client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=1024,
        system=system_prompt,
        messages=[{"role": "user", "content": [
            {"type": "image", "source": {"type": "base64", "media_type": media_type, "data": image_b64}},
            {"type": "text", "text": user_prompt},
        ]}],
    )
    return message.content[0].text


# ==================== AUTH ROUTES ====================

async def ensure_user_org(current_user: dict) -> str:
    """Ensure user has an organization. Auto-create a personal one if not."""
    org_id = current_user.get("organization_id")
    if org_id:
        return org_id
    
    # Auto-create a personal organization
    now = datetime.now(timezone.utc)
    user_name = current_user.get("name", "User")
    email_domain = current_user.get("email", "").split("@")[1] if "@" in current_user.get("email", "") else None
    org_id = f"org_{uuid.uuid4().hex[:12]}"
    
    org_doc = {
        "organization_id": org_id,
        "name": f"{user_name}'s Workspace",
        "owner_id": current_user["user_id"],
        "plan": "free",
        "user_count": 1,
        "max_free_users": 3,
        "max_users": 3,
        "email_domain": email_domain if email_domain and email_domain not in ["gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "icloud.com"] else None,
        "created_at": now.isoformat()
    }
    await db.organizations.insert_one(org_doc)
    await db.users.update_one({"user_id": current_user["user_id"]}, {"$set": {"organization_id": org_id, "role": "owner"}})
    return org_id

@api_router.post("/auth/register")
async def register(user_data: UserCreate, response: Response):
    existing = await db.users.find_one({"email": user_data.email}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user_id = f"user_{uuid.uuid4().hex[:12]}"
    now = datetime.now(timezone.utc)
    
    organization_id = None
    user_role = "member"
    
    # Check for invite code
    if user_data.invite_code:
        invite = await db.invites.find_one({
            "invite_code": user_data.invite_code,
            "is_active": True
        }, {"_id": 0})
        
        if not invite:
            raise HTTPException(status_code=400, detail="Invalid invitation code")
        
        if invite.get("expires_at") and invite["expires_at"] < now.isoformat():
            raise HTTPException(status_code=400, detail="Invitation has expired")
        
        if invite.get("used_count", 0) >= invite.get("max_uses", 1):
            raise HTTPException(status_code=400, detail="Invitation has reached maximum uses")
        
        # For email-specific invites, check email matches
        if invite.get("email") and invite["email"].lower() != user_data.email.lower():
            raise HTTPException(status_code=400, detail="This invitation is for a different email address")
        
        organization_id = invite["organization_id"]
        user_role = invite.get("role", "member")
        
        # Update invite usage
        await db.invites.update_one(
            {"invite_code": user_data.invite_code},
            {"$inc": {"used_count": 1}}
        )
        
        # Update organization user count
        await db.organizations.update_one(
            {"organization_id": organization_id},
            {"$inc": {"user_count": 1}}
        )
    
    # Create organization if name provided and no invite
    elif user_data.organization_name:
        organization_id = f"org_{uuid.uuid4().hex[:12]}"
        user_role = "owner"
        email_domain = user_data.email.split("@")[1].lower() if "@" in user_data.email else None
        org_doc = {
            "organization_id": organization_id,
            "name": user_data.organization_name,
            "owner_id": user_id,
            "plan": "free",
            "user_count": 1,
            "max_free_users": 3,
            "max_users": 3,
            "email_domain": email_domain,
            "created_at": now.isoformat()
        }
        await db.organizations.insert_one(org_doc)
    else:
        # Auto-join org by email domain
        email_domain = user_data.email.split("@")[1].lower() if "@" in user_data.email else None
        if email_domain and email_domain not in ["gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "icloud.com"]:
            matching_org = await db.organizations.find_one({"email_domain": email_domain}, {"_id": 0})
            if matching_org:
                max_users = matching_org.get("max_users", matching_org.get("max_free_users", 3))
                current_count = matching_org.get("user_count", 1)
                if current_count < max_users:
                    organization_id = matching_org["organization_id"]
                    user_role = "member"
                    await db.organizations.update_one(
                        {"organization_id": organization_id},
                        {"$inc": {"user_count": 1}}
                    )
    
    user_doc = {
        "user_id": user_id,
        "email": user_data.email,
        "name": user_data.name,
        "password_hash": hash_password(user_data.password),
        "organization_id": organization_id,
        "role": user_role,
        "referred_by": user_data.ref_code or None,
        "created_at": now.isoformat()
    }
    await db.users.insert_one(user_doc)
    
    token = create_jwt_token(user_id, user_data.email, organization_id)
    
    # Auto-create lead in super admin's organization for new signups
    try:
        super_admin = await db.users.find_one({"email": SUPER_ADMIN_EMAIL}, {"_id": 0})
        if super_admin and super_admin.get("organization_id"):
            lead_source = "signup"
            affiliate_info = None
            # Check if this is an affiliate referral (ref param stored in invite or URL)
            ref_code = getattr(user_data, 'ref_code', None)
            if ref_code:
                affiliate = await db.affiliates.find_one({"affiliate_code": ref_code}, {"_id": 0})
                if affiliate:
                    lead_source = f"affiliate:{ref_code}"
                    affiliate_info = {"affiliate_code": ref_code, "affiliate_id": affiliate.get("affiliate_id")}
            
            auto_lead = {
                "lead_id": f"lead_{uuid.uuid4().hex[:12]}",
                "organization_id": super_admin["organization_id"],
                "first_name": user_data.name.split(" ")[0] if user_data.name else user_data.email.split("@")[0],
                "last_name": " ".join(user_data.name.split(" ")[1:]) if " " in user_data.name else "",
                "email": user_data.email,
                "company": user_data.organization_name or "",
                "source": lead_source,
                "status": "new",
                "notes": f"Auto-created from platform signup. Org: {user_data.organization_name or 'No org'}",
                "ai_score": None,
                "assigned_to": None,
                "created_by": super_admin["user_id"],
                "created_at": now.isoformat(),
                "updated_at": now.isoformat()
            }
            if affiliate_info:
                auto_lead["affiliate_referral"] = affiliate_info
            await db.leads.insert_one(auto_lead)
    except Exception as e:
        logger.error(f"Auto-lead creation error: {e}")
    
    return {
        "user_id": user_id,
        "email": user_data.email,
        "name": user_data.name,
        "organization_id": organization_id,
        "role": user_role,
        "token": token
    }

@api_router.post("/auth/login")
async def login(credentials: UserLogin, response: Response):
    user = await db.users.find_one({"email": credentials.email}, {"_id": 0})
    if not user or not verify_password(credentials.password, user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    # Track last login
    await db.users.update_one({"user_id": user["user_id"]}, {"$set": {"last_login": datetime.now(timezone.utc).isoformat()}})
    
    token = create_jwt_token(user["user_id"], user["email"], user.get("organization_id"))
    
    return {
        "user_id": user["user_id"],
        "email": user["email"],
        "name": user["name"],
        "organization_id": user.get("organization_id"),
        "role": user.get("role", "member"),
        "token": token
    }

@api_router.post("/auth/forgot-password")
async def forgot_password(email: str):
    """Send password reset email"""
    user = await db.users.find_one({"email": email.lower()}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="no_account")
    
    reset_token = secrets.token_urlsafe(32)
    await db.password_resets.insert_one({
        "token": reset_token,
        "user_id": user["user_id"],
        "email": email.lower(),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "used": False
    })
    
    frontend_url = os.environ.get('FRONTEND_URL', '')
    reset_link = f"{frontend_url}/reset-password?token={reset_token}"
    
    if RESEND_API_KEY:
        try:
            import asyncio
            result = await asyncio.to_thread(resend.Emails.send, {
                "from": SENDER_EMAIL,
                "to": [email.lower()],
                "subject": "Reset your earnrm password",
                "html": f"""<div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
                    <h2 style="color: #3B0764;">Reset your password</h2>
                    <p>You requested a password reset for your earnrm account.</p>
                    <p><a href="{reset_link}" style="background: #7C3AED; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: bold;">Reset Password</a></p>
                    <p style="color: #666; font-size: 14px;">This link expires in 1 hour. If you did not request this, ignore this email.</p>
                </div>"""
            })
            logger.info(f"Reset email sent to {email}: {result}")
        except Exception as e:
            logger.error(f"Reset email error: {e}")
    
    return {"message": "If an account exists, a reset link has been sent."}

@api_router.post("/auth/reset-password")
async def reset_password(token: str, new_password: str):
    """Reset password using token"""
    reset = await db.password_resets.find_one({"token": token, "used": False}, {"_id": 0})
    if not reset:
        raise HTTPException(status_code=400, detail="Invalid or expired reset link")
    
    created = datetime.fromisoformat(reset["created_at"])
    if (datetime.now(timezone.utc) - created).total_seconds() > 3600:
        raise HTTPException(status_code=400, detail="Reset link has expired. Please request a new one.")
    
    await db.users.update_one({"user_id": reset["user_id"]}, {"$set": {"password_hash": hash_password(new_password)}})
    await db.password_resets.update_one({"token": token}, {"$set": {"used": True}})
    
    return {"message": "Password reset successfully. You can now sign in."}


@api_router.get("/auth/google/login")
async def google_login_redirect(request: Request):
    """Redirect user to Google OAuth for login/signup"""
    if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET:
        raise HTTPException(status_code=400, detail="Google login not configured")

    from urllib.parse import urlencode
    redirect_uri = f"{FRONTEND_URL}/api/auth/google/login/callback"
    state = secrets.token_urlsafe(32)

    # Store state for CSRF protection
    await db.google_login_states.insert_one({
        "state": state,
        "created_at": datetime.now(timezone.utc).isoformat()
    })

    params = urlencode({
        "client_id": GOOGLE_CLIENT_ID,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": "openid email profile",
        "access_type": "online",
        "state": state,
        "prompt": "select_account"
    })
    from fastapi.responses import RedirectResponse
    return RedirectResponse(url=f"https://accounts.google.com/o/oauth2/v2/auth?{params}")


@api_router.get("/auth/google/login/callback")
async def google_login_callback(code: str, state: str, response: Response):
    """Handle Google OAuth callback for login/signup"""
    if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET:
        raise HTTPException(status_code=400, detail="Google login not configured")

    # Verify state
    state_doc = await db.google_login_states.find_one({"state": state})
    if not state_doc:
        from fastapi.responses import RedirectResponse
        return RedirectResponse(url=f"{FRONTEND_URL}/login?error=invalid_state")
    await db.google_login_states.delete_one({"state": state})

    # Exchange code for tokens
    redirect_uri = f"{FRONTEND_URL}/api/auth/google/login/callback"
    async with httpx.AsyncClient() as client:
        token_resp = await client.post("https://oauth2.googleapis.com/token", data={
            "code": code,
            "client_id": GOOGLE_CLIENT_ID,
            "client_secret": GOOGLE_CLIENT_SECRET,
            "redirect_uri": redirect_uri,
            "grant_type": "authorization_code"
        })
        if token_resp.status_code != 200:
            logger.error(f"Google token exchange failed: {token_resp.text}")
            from fastapi.responses import RedirectResponse
            return RedirectResponse(url=f"{FRONTEND_URL}/login?error=token_exchange_failed")
        tokens = token_resp.json()

        # Get user info from Google
        userinfo_resp = await client.get(
            "https://www.googleapis.com/oauth2/v2/userinfo",
            headers={"Authorization": f"Bearer {tokens['access_token']}"}
        )
        if userinfo_resp.status_code != 200:
            from fastapi.responses import RedirectResponse
            return RedirectResponse(url=f"{FRONTEND_URL}/login?error=userinfo_failed")
        userinfo = userinfo_resp.json()

    email = userinfo["email"]
    name = userinfo.get("name", email.split("@")[0])
    picture = userinfo.get("picture")
    session_token = secrets.token_urlsafe(32)
    
    now = datetime.now(timezone.utc)
    
    # Find or create user
    user = await db.users.find_one({"email": email}, {"_id": 0})
    if not user:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        user_doc = {
            "user_id": user_id,
            "email": email,
            "name": name,
            "picture": picture,
            "organization_id": None,
            "role": "member",
            "created_at": now.isoformat()
        }
        await db.users.insert_one(user_doc)
        user = user_doc
        
        # Auto-create lead for new Google signups
        try:
            super_admin = await db.users.find_one({"email": SUPER_ADMIN_EMAIL}, {"_id": 0})
            if super_admin and super_admin.get("organization_id"):
                auto_lead = {
                    "lead_id": f"lead_{uuid.uuid4().hex[:12]}",
                    "organization_id": super_admin["organization_id"],
                    "first_name": name.split(" ")[0] if name else email.split("@")[0],
                    "last_name": " ".join(name.split(" ")[1:]) if " " in name else "",
                    "email": email,
                    "source": "google_signup",
                    "status": "new",
                    "notes": "Auto-created from Google OAuth signup",
                    "ai_score": None,
                    "assigned_to": None,
                    "created_by": super_admin["user_id"],
                    "created_at": now.isoformat(),
                    "updated_at": now.isoformat()
                }
                await db.leads.insert_one(auto_lead)
        except Exception as e:
            logger.error(f"Auto-lead creation (Google) error: {e}")
    else:
        user_id = user["user_id"]
        # Update picture if changed
        if picture and picture != user.get("picture"):
            await db.users.update_one({"user_id": user_id}, {"$set": {"picture": picture}})
        # Track last login
        await db.users.update_one({"user_id": user_id}, {"$set": {"last_login": datetime.now(timezone.utc).isoformat()}})
    
    # Store session
    session_doc = {
        "user_id": user_id,
        "session_token": session_token,
        "expires_at": (now + timedelta(days=7)).isoformat(),
        "created_at": now.isoformat()
    }
    await db.user_sessions.delete_many({"user_id": user_id})
    await db.user_sessions.insert_one(session_doc)
    
    # Generate JWT token for consistent auth (same as email/password login)
    jwt_token = create_jwt_token(user_id, email, user.get("organization_id"))

    # Store session cookie
    from fastapi.responses import RedirectResponse
    redirect = RedirectResponse(url=f"{FRONTEND_URL}/auth/callback?token={jwt_token}", status_code=302)
    redirect.set_cookie(
        key="session_token",
        value=session_token,
        httponly=True,
        secure=True,
        samesite="none",
        path="/",
        max_age=7*24*60*60
    )
    return redirect

@api_router.get("/auth/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    return {
        "user_id": current_user["user_id"],
        "email": current_user["email"],
        "name": current_user["name"],
        "picture": current_user.get("picture"),
        "organization_id": current_user.get("organization_id"),
        "role": current_user.get("role", "member")
    }

@api_router.post("/auth/logout")
async def logout(request: Request, response: Response):
    session_token = request.cookies.get("session_token")
    if session_token:
        await db.user_sessions.delete_one({"session_token": session_token})
    response.delete_cookie("session_token", path="/")
    return {"message": "Logged out successfully"}

# ==================== ORGANIZATION ROUTES ====================

@api_router.post("/organizations")
async def create_organization(name: str, current_user: dict = Depends(get_current_user)):
    if current_user.get("organization_id"):
        raise HTTPException(status_code=400, detail="User already belongs to an organization")
    
    organization_id = f"org_{uuid.uuid4().hex[:12]}"
    now = datetime.now(timezone.utc)
    
    org_doc = {
        "organization_id": organization_id,
        "name": name,
        "owner_id": current_user["user_id"],
        "plan": "free",
        "user_count": 1,
        "max_free_users": 3,
        "created_at": now.isoformat()
    }
    await db.organizations.insert_one(org_doc)
    
    await db.users.update_one(
        {"user_id": current_user["user_id"]},
        {"$set": {"organization_id": organization_id, "role": "owner"}}
    )
    
    # Remove MongoDB's _id field before returning
    org_doc.pop('_id', None)
    return org_doc

@api_router.get("/organizations/current")
async def get_current_organization(current_user: dict = Depends(get_current_user)):
    if not current_user.get("organization_id"):
        await ensure_user_org(current_user)
        return None
    org = await db.organizations.find_one(
        {"organization_id": current_user["organization_id"]},
        {"_id": 0}
    )
    return org

@api_router.get("/organizations/{organization_id}/members")
async def get_organization_members(organization_id: str, current_user: dict = Depends(get_current_user)):
    if current_user.get("organization_id") != organization_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    members = await db.users.find(
        {"organization_id": organization_id},
        {"_id": 0, "password_hash": 0}
    ).to_list(1000)
    return members

# ==================== ORGANIZATION SETTINGS & PIPELINES ====================

class OrgSettingsUpdate(BaseModel):
    deal_stages: Optional[List[dict]] = None
    task_stages: Optional[List[dict]] = None
    affiliate_enabled: Optional[bool] = None

class PipelineCreate(BaseModel):
    name: str
    stages: List[dict]
    is_default: bool = False

@api_router.get("/organizations/settings")
async def get_organization_settings(current_user: dict = Depends(get_current_user)):
    """Get organization-specific settings (deal stages, task stages, etc.)"""
    if not current_user.get("organization_id"):
        org_id = await ensure_user_org(current_user)
        current_user["organization_id"] = org_id
    
    org = await db.organizations.find_one(
        {"organization_id": current_user["organization_id"]},
        {"_id": 0}
    )
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    
    # Return org settings with defaults if not set
    return {
        "organization_id": org["organization_id"],
        "name": org["name"],
        "deal_stages": org.get("deal_stages", [
            {"id": "lead", "name": "Lead", "order": 1},
            {"id": "qualified", "name": "Qualified", "order": 2},
            {"id": "proposal", "name": "Proposal", "order": 3},
            {"id": "negotiation", "name": "Negotiation", "order": 4},
            {"id": "won", "name": "Won", "order": 5},
            {"id": "lost", "name": "Lost", "order": 6}
        ]),
        "task_stages": org.get("task_stages", [
            {"id": "todo", "name": "To Do", "order": 1},
            {"id": "in_progress", "name": "In Progress", "order": 2},
            {"id": "done", "name": "Done", "order": 3}
        ]),
        "pipelines": org.get("pipelines", []),
        "affiliate_enabled": org.get("affiliate_enabled", False)
    }

@api_router.put("/organizations/settings")
async def update_organization_settings(
    settings: OrgSettingsUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update organization settings (owner/admin only)"""
    if not current_user.get("organization_id"):
        org_id = await ensure_user_org(current_user)
        current_user["organization_id"] = org_id
    
    # Check if user is owner or admin
    if current_user.get("role") not in ["owner", "admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Only owners/admins can update organization settings")
    
    update_data = {}
    if settings.deal_stages is not None:
        update_data["deal_stages"] = settings.deal_stages
    if settings.task_stages is not None:
        update_data["task_stages"] = settings.task_stages
    if settings.affiliate_enabled is not None:
        update_data["affiliate_enabled"] = settings.affiliate_enabled
    
    if update_data:
        update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
        await db.organizations.update_one(
            {"organization_id": current_user["organization_id"]},
            {"$set": update_data}
        )
    
    return await get_organization_settings(current_user)

@api_router.get("/organizations/pipelines")
async def get_organization_pipelines(current_user: dict = Depends(get_current_user)):
    """Get all pipelines for the organization"""
    if not current_user.get("organization_id"):
        org_id = await ensure_user_org(current_user)
        current_user["organization_id"] = org_id
    
    org = await db.organizations.find_one(
        {"organization_id": current_user["organization_id"]},
        {"_id": 0, "pipelines": 1}
    )
    return {"pipelines": org.get("pipelines", []) if org else []}

@api_router.post("/organizations/pipelines")
async def create_pipeline(
    pipeline: PipelineCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create a new pipeline (owner/admin only)"""
    if not current_user.get("organization_id"):
        org_id = await ensure_user_org(current_user)
        current_user["organization_id"] = org_id
    
    if current_user.get("role") not in ["owner", "admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Only owners/admins can create pipelines")
    
    pipeline_id = f"pipeline_{uuid.uuid4().hex[:8]}"
    pipeline_doc = {
        "pipeline_id": pipeline_id,
        "name": pipeline.name,
        "stages": pipeline.stages,
        "is_default": pipeline.is_default,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    # If this is set as default, unset other defaults
    if pipeline.is_default:
        await db.organizations.update_one(
            {"organization_id": current_user["organization_id"]},
            {"$set": {"pipelines.$[].is_default": False}}
        )
    
    await db.organizations.update_one(
        {"organization_id": current_user["organization_id"]},
        {"$push": {"pipelines": pipeline_doc}}
    )
    
    return pipeline_doc

@api_router.put("/organizations/pipelines/{pipeline_id}")
async def update_pipeline(
    pipeline_id: str,
    pipeline: PipelineCreate,
    current_user: dict = Depends(get_current_user)
):
    """Update a pipeline (owner/admin only)"""
    if not current_user.get("organization_id"):
        org_id = await ensure_user_org(current_user)
        current_user["organization_id"] = org_id
    
    if current_user.get("role") not in ["owner", "admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Only owners/admins can update pipelines")
    
    await db.organizations.update_one(
        {"organization_id": current_user["organization_id"], "pipelines.pipeline_id": pipeline_id},
        {"$set": {
            "pipelines.$.name": pipeline.name,
            "pipelines.$.stages": pipeline.stages,
            "pipelines.$.is_default": pipeline.is_default,
            "pipelines.$.updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"message": "Pipeline updated"}

@api_router.delete("/organizations/pipelines/{pipeline_id}")
async def delete_pipeline(pipeline_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a pipeline (owner/admin only)"""
    if not current_user.get("organization_id"):
        org_id = await ensure_user_org(current_user)
        current_user["organization_id"] = org_id
    
    if current_user.get("role") not in ["owner", "admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Only owners/admins can delete pipelines")
    
    await db.organizations.update_one(
        {"organization_id": current_user["organization_id"]},
        {"$pull": {"pipelines": {"pipeline_id": pipeline_id}}}
    )
    
    return {"message": "Pipeline deleted"}

# ==================== USER ROLE MANAGEMENT (ORG LEVEL) ====================

@api_router.put("/organizations/members/{user_id}/role")
async def update_member_role(
    user_id: str,
    role: str,
    current_user: dict = Depends(get_current_user)
):
    """Update a team member's role (owner only can transfer ownership)"""
    if not current_user.get("organization_id"):
        org_id = await ensure_user_org(current_user)
        current_user["organization_id"] = org_id
    
    valid_roles = ["member", "admin", "owner"]
    if role not in valid_roles:
        raise HTTPException(status_code=400, detail=f"Invalid role. Must be one of: {valid_roles}")
    
    # Only owner can change roles
    if current_user.get("role") != "owner" and current_user.get("role") != "super_admin":
        raise HTTPException(status_code=403, detail="Only the owner can change member roles")
    
    # Check target user is in same org
    target_user = await db.users.find_one(
        {"user_id": user_id, "organization_id": current_user["organization_id"]},
        {"_id": 0}
    )
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found in organization")
    
    # If transferring ownership, demote current owner to admin
    if role == "owner" and user_id != current_user["user_id"]:
        await db.users.update_one(
            {"user_id": current_user["user_id"]},
            {"$set": {"role": "admin"}}
        )
        # Update organization owner_id
        await db.organizations.update_one(
            {"organization_id": current_user["organization_id"]},
            {"$set": {"owner_id": user_id}}
        )
    
    await db.users.update_one(
        {"user_id": user_id},
        {"$set": {"role": role}}
    )
    
    return {"message": f"User role updated to {role}"}

# ==================== TEAM INVITATIONS ====================

class InviteEmailRequest(BaseModel):
    emails: List[EmailStr]
    role: str = "member"

class InviteLinkResponse(BaseModel):
    invite_link: str
    invite_code: str
    expires_at: str

@api_router.post("/organizations/invites/link")
async def generate_invite_link(
    role: str = "member",
    current_user: dict = Depends(get_current_user)
):
    """Generate a shareable invite link for the organization"""
    if not current_user.get("organization_id"):
        org_id = await ensure_user_org(current_user)
        current_user["organization_id"] = org_id
    
    # Only owner/admin can invite
    if current_user.get("role") not in ["owner", "admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Only owners and admins can invite members")
    
    valid_roles = ["member", "admin"]
    if role not in valid_roles:
        raise HTTPException(status_code=400, detail=f"Invalid role. Must be one of: {valid_roles}")
    
    invite_code = f"inv_{uuid.uuid4().hex[:16]}"
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(days=7)  # Link valid for 7 days
    
    invite_doc = {
        "invite_id": f"invite_{uuid.uuid4().hex[:12]}",
        "invite_code": invite_code,
        "organization_id": current_user["organization_id"],
        "role": role,
        "created_by": current_user["user_id"],
        "created_at": now.isoformat(),
        "expires_at": expires_at.isoformat(),
        "type": "link",
        "used_count": 0,
        "max_uses": 100,  # Allow multiple uses
        "is_active": True
    }
    await db.invites.insert_one(invite_doc)
    
    # Use public URL for invite links
    app_url = os.environ.get('PUBLIC_URL', os.environ.get('FRONTEND_URL', ''))
    invite_link = f"{app_url}/signup?invite={invite_code}"
    
    return {
        "invite_link": invite_link,
        "invite_code": invite_code,
        "expires_at": expires_at.isoformat(),
        "role": role
    }

@api_router.post("/organizations/invites/email")
async def send_email_invites(
    request: InviteEmailRequest,
    current_user: dict = Depends(get_current_user)
):
    """Send email invitations to join the organization"""
    if not current_user.get("organization_id"):
        org_id = await ensure_user_org(current_user)
        current_user["organization_id"] = org_id
    
    # Only owner/admin can invite
    if current_user.get("role") not in ["owner", "admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Only owners and admins can invite members")
    
    valid_roles = ["member", "admin"]
    if request.role not in valid_roles:
        raise HTTPException(status_code=400, detail=f"Invalid role. Must be one of: {valid_roles}")
    
    # Get organization name
    org = await db.organizations.find_one(
        {"organization_id": current_user["organization_id"]},
        {"_id": 0, "name": 1}
    )
    org_name = org.get("name", "the team") if org else "the team"
    
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(days=7)
    app_url = os.environ.get('PUBLIC_URL', os.environ.get('FRONTEND_URL', ''))
    
    sent_invites = []
    failed_invites = []
    
    for email in request.emails:
        # Check if user already exists
        existing_user = await db.users.find_one({"email": email.lower()}, {"_id": 0})
        if existing_user:
            if existing_user.get("organization_id") == current_user["organization_id"]:
                failed_invites.append({"email": email, "reason": "Already a member"})
                continue
            # User exists in another org - still allow invite (they can switch)
        
        # Check for existing pending invite
        existing_invite = await db.invites.find_one({
            "email": email.lower(),
            "organization_id": current_user["organization_id"],
            "is_active": True,
            "expires_at": {"$gt": now.isoformat()}
        }, {"_id": 0})
        
        if existing_invite:
            failed_invites.append({"email": email, "reason": "Invite already sent"})
            continue
        
        invite_code = f"inv_{uuid.uuid4().hex[:16]}"
        invite_link = f"{app_url}/signup?invite={invite_code}"
        
        invite_doc = {
            "invite_id": f"invite_{uuid.uuid4().hex[:12]}",
            "invite_code": invite_code,
            "organization_id": current_user["organization_id"],
            "email": email.lower(),
            "role": request.role,
            "created_by": current_user["user_id"],
            "created_at": now.isoformat(),
            "expires_at": expires_at.isoformat(),
            "type": "email",
            "used_count": 0,
            "max_uses": 1,
            "is_active": True
        }
        await db.invites.insert_one(invite_doc)
        
        # Send email invitation
        if RESEND_API_KEY:
            try:
                resend.Emails.send({
                    "from": SENDER_EMAIL,
                    "to": [email],
                    "subject": f"You're invited to join {org_name} on earnrm",
                    "html": f"""
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <h2 style="color: #A100FF;">You're Invited!</h2>
                        <p>{current_user['name']} has invited you to join <strong>{org_name}</strong> on earnrm.</p>
                        <p>earnrm is an AI-powered CRM that helps teams manage leads, deals, and customer relationships more effectively.</p>
                        <p style="color: #666; font-size: 14px;">Already have an account? Log in and use the link below to switch organisations.</p>
                        <div style="margin: 30px 0;">
                            <a href="{invite_link}" style="background-color: #7C3AED; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: bold;">
                                Accept Invitation
                            </a>
                        </div>
                        <p style="color: #666; font-size: 14px;">This invitation expires in 7 days.</p>
                        <p style="color: #666; font-size: 14px;">If you didn't expect this invitation, you can safely ignore this email.</p>
                    </div>
                    """
                })
                sent_invites.append({"email": email, "status": "sent"})
            except Exception as e:
                logging.error(f"Failed to send invite email to {email}: {e}")
                sent_invites.append({"email": email, "status": "pending", "note": "Email delivery pending"})
        else:
            sent_invites.append({"email": email, "status": "pending", "note": "Email service not configured"})
    
    return {
        "sent": sent_invites,
        "failed": failed_invites,
        "total_sent": len(sent_invites),
        "total_failed": len(failed_invites)
    }

@api_router.post("/organizations/invites/csv")
async def import_invites_csv(
    file: UploadFile = File(...),
    role: str = "member",
    current_user: dict = Depends(get_current_user)
):
    """Import team members via CSV file (columns: email, name)"""
    if not current_user.get("organization_id"):
        org_id = await ensure_user_org(current_user)
        current_user["organization_id"] = org_id
    
    # Only owner/admin can invite
    if current_user.get("role") not in ["owner", "admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Only owners and admins can invite members")
    
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="File must be a CSV")
    
    content = await file.read()
    decoded = content.decode('utf-8')
    
    # Parse CSV
    reader = csv.DictReader(io.StringIO(decoded))
    emails = []
    
    for row in reader:
        email = row.get('email', '').strip().lower()
        if email and '@' in email:
            emails.append(email)
    
    if not emails:
        raise HTTPException(status_code=400, detail="No valid emails found in CSV. Ensure column header is 'email'")
    
    # Use the email invite function
    request = InviteEmailRequest(emails=emails, role=role)
    return await send_email_invites(request, current_user)

@api_router.get("/organizations/invites")
async def get_pending_invites(current_user: dict = Depends(get_current_user)):
    """Get all pending invitations for the organization"""
    if not current_user.get("organization_id"):
        org_id = await ensure_user_org(current_user)
        current_user["organization_id"] = org_id
    
    now = datetime.now(timezone.utc)
    
    invites = await db.invites.find({
        "organization_id": current_user["organization_id"],
        "is_active": True
    }, {"_id": 0}).sort("created_at", -1).to_list(100)
    
    # Mark expired invites
    for invite in invites:
        if invite.get("expires_at") and invite["expires_at"] < now.isoformat():
            invite["status"] = "expired"
        elif invite.get("used_count", 0) >= invite.get("max_uses", 1):
            invite["status"] = "used"
        else:
            invite["status"] = "pending"
    
    return {"invites": invites}

@api_router.delete("/organizations/invites/{invite_id}")
async def revoke_invite(
    invite_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Revoke a pending invitation"""
    if not current_user.get("organization_id"):
        org_id = await ensure_user_org(current_user)
        current_user["organization_id"] = org_id
    
    result = await db.invites.update_one(
        {"invite_id": invite_id, "organization_id": current_user["organization_id"]},
        {"$set": {"is_active": False}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Invite not found")
    
    return {"message": "Invite revoked"}

@api_router.post("/organizations/invites/accept")
async def accept_invite(invite_code: str, current_user: dict = Depends(get_current_user)):
    """Accept an invite and switch to the new organization"""
    now = datetime.now(timezone.utc)
    invite = await db.invites.find_one({"invite_code": invite_code, "is_active": True}, {"_id": 0})
    if not invite:
        raise HTTPException(status_code=400, detail="Invalid or expired invitation")
    if invite.get("expires_at") and invite["expires_at"] < now.isoformat():
        raise HTTPException(status_code=400, detail="Invitation has expired")
    if invite.get("email") and invite["email"].lower() != current_user.get("email", "").lower():
        raise HTTPException(status_code=400, detail="This invitation is for a different email")
    
    new_org_id = invite["organization_id"]
    old_org_id = current_user.get("organization_id")
    new_role = invite.get("role", "member")
    
    # Decrement old org user count
    if old_org_id and old_org_id != new_org_id:
        await db.organizations.update_one({"organization_id": old_org_id}, {"$inc": {"user_count": -1}})
    
    # Switch user to new org
    await db.users.update_one({"user_id": current_user["user_id"]}, {"$set": {"organization_id": new_org_id, "role": new_role}})
    await db.organizations.update_one({"organization_id": new_org_id}, {"$inc": {"user_count": 1}})
    await db.invites.update_one({"invite_code": invite_code}, {"$inc": {"used_count": 1}})
    
    org = await db.organizations.find_one({"organization_id": new_org_id}, {"_id": 0})
    return {"message": f"Joined {org.get('name', 'organization')}", "organization_id": new_org_id, "role": new_role}

@api_router.get("/invites/validate/{invite_code}")
async def validate_invite(invite_code: str):
    """Validate an invite code (public endpoint for signup page)"""
    now = datetime.now(timezone.utc)
    
    invite = await db.invites.find_one({
        "invite_code": invite_code,
        "is_active": True
    }, {"_id": 0})
    
    if not invite:
        raise HTTPException(status_code=404, detail="Invalid or expired invitation")
    
    if invite.get("expires_at") and invite["expires_at"] < now.isoformat():
        raise HTTPException(status_code=400, detail="Invitation has expired")
    
    if invite.get("used_count", 0) >= invite.get("max_uses", 1):
        raise HTTPException(status_code=400, detail="Invitation has reached maximum uses")
    
    # Get organization name
    org = await db.organizations.find_one(
        {"organization_id": invite["organization_id"]},
        {"_id": 0, "name": 1}
    )
    
    return {
        "valid": True,
        "organization_name": org.get("name", "Unknown") if org else "Unknown",
        "role": invite.get("role", "member"),
        "email": invite.get("email")  # For email-specific invites
    }

# ==================== AFFILIATE SELF-ENROLLMENT ====================

@api_router.post("/affiliate/enroll")
async def enroll_as_affiliate(current_user: dict = Depends(get_current_user)):
    """Self-enroll as an affiliate. Anyone can toggle this on."""
    if not current_user.get("organization_id"):
        org_id = await ensure_user_org(current_user)
        current_user["organization_id"] = org_id
    
    existing = await db.affiliates.find_one({"user_id": current_user["user_id"]}, {"_id": 0})
    if existing:
        return {"message": "Already enrolled", "affiliate": existing}
    
    affiliate_id = f"aff_{uuid.uuid4().hex[:12]}"
    affiliate_code = f"{current_user.get('name','user').split()[0].lower()}_{uuid.uuid4().hex[:6]}"
    now = datetime.now(timezone.utc)
    
    # Determine level based on who referred this user
    level = 0  # Default: direct invite by super admin or self-enrolled
    parent_affiliate_id = None
    
    # Check if user was referred by another affiliate
    user_doc = await db.users.find_one({"user_id": current_user["user_id"]}, {"_id": 0})
    ref_code = user_doc.get("referred_by") if user_doc else None
    if ref_code:
        parent = await db.affiliates.find_one({"affiliate_code": ref_code}, {"_id": 0})
        if parent:
            parent_level = parent.get("level", 0)
            level = min(parent_level + 1, 2)  # Max level 2
            parent_affiliate_id = parent["affiliate_id"]
    
    # Commission rates by level
    commission_rates = {0: 20.0, 1: 10.0, 2: 10.0}
    
    affiliate_doc = {
        "affiliate_id": affiliate_id,
        "user_id": current_user["user_id"],
        "email": current_user.get("email", ""),
        "name": current_user.get("name", ""),
        "organization_id": current_user["organization_id"],
        "affiliate_code": affiliate_code,
        "level": level,
        "parent_affiliate_id": parent_affiliate_id,
        "commission_rate": commission_rates.get(level, 10.0),
        "customer_discount": 20.0,  # Every affiliate link gives 20% off
        "total_referrals": 0,
        "total_earnings": 0,
        "pending_earnings": 0,
        "paid_earnings": 0,
        "created_at": now.isoformat(),
        "is_active": True
    }
    await db.affiliates.insert_one(affiliate_doc)
    affiliate_doc.pop('_id', None)
    
    return {"message": "Successfully enrolled as affiliate", "affiliate": affiliate_doc}

@api_router.get("/affiliate/me")
async def get_my_affiliate_status(current_user: dict = Depends(get_current_user)):
    """Get current user's affiliate status, link, and marketing material"""
    affiliate = await db.affiliates.find_one({"user_id": current_user["user_id"]}, {"_id": 0})
    
    if not affiliate:
        return {"enrolled": False, "affiliate": None}
    
    referrals = await db.affiliate_referrals.find({"affiliate_id": affiliate["affiliate_id"]}, {"_id": 0}).sort("created_at", -1).to_list(100)
    
    # Count downstream earnings (from levels below)
    downstream = await db.affiliate_referrals.find({"upstream_affiliate_ids": affiliate["affiliate_id"]}, {"_id": 0}).to_list(500)
    downstream_earnings = sum(r.get("upstream_commissions", {}).get(affiliate["affiliate_id"], 0) for r in downstream)
    
    public_url = os.environ.get('PUBLIC_URL', os.environ.get('FRONTEND_URL', ''))
    ref_link = f"{public_url}/signup?ref={affiliate['affiliate_code']}"
    level = affiliate.get("level", 0)
    
    # Marketing material per level
    level_labels = {0: "Partner", 1: "Ambassador", 2: "Advocate"}
    level_label = level_labels.get(level, "Affiliate")
    
    return {
        "enrolled": True,
        "affiliate": affiliate,
        "referral_link": ref_link,
        "referrals": referrals,
        "downstream_earnings": downstream_earnings,
        "level": level,
        "level_label": level_label,
        "customer_discount": "20%",
        "commission_summary": {
            0: "You earn 20% on direct referrals",
            1: "You earn 10% on direct referrals. Your inviter earns 10%.",
            2: "You earn 10% on direct referrals. Upstream affiliates each earn 10%."
        }.get(level, ""),
        "marketing_assets": {
            "banner": "https://static.prod-images.emergentagent.com/jobs/e7e50724-a043-4fd3-87b9-ed080078094d/images/d4c7d179cc49d6bcdd5bdeba2bd3c0ee15d214451c0e4ac91a8035ff9554f03b.png",
            "story": "https://static.prod-images.emergentagent.com/jobs/e7e50724-a043-4fd3-87b9-ed080078094d/images/787c03120f149891b257071153f2eb541a6f5057f2cc6d8c73a78a8d7720db63.png",
            "square": "https://static.prod-images.emergentagent.com/jobs/e7e50724-a043-4fd3-87b9-ed080078094d/images/21cf5a85c9e37c38bbb86ca92cb16d4d2f280e64b08783bff72de6dc2ce7650b.png"
        }
    }

@api_router.post("/affiliate/unenroll")
async def unenroll_from_affiliate(current_user: dict = Depends(get_current_user)):
    """Unenroll from affiliate program"""
    result = await db.affiliates.delete_one({"user_id": current_user["user_id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Not enrolled as affiliate")
    return {"message": "Successfully unenrolled from affiliate program"}

# ==================== LEADS ROUTES ====================

@api_router.get("/leads")
async def get_leads(
    status: Optional[str] = None,
    source: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    if not current_user.get("organization_id"):
        org_id = await ensure_user_org(current_user)
        current_user["organization_id"] = org_id
    
    query = {"organization_id": current_user["organization_id"]}
    if status:
        query["status"] = status
    if source:
        query["source"] = source
    
    leads = await db.leads.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return leads

@api_router.post("/leads")
async def create_lead(lead_data: LeadCreate, current_user: dict = Depends(get_current_user)):
    if not current_user.get("organization_id"):
        org_id = await ensure_user_org(current_user)
        current_user["organization_id"] = org_id
    
    lead_id = f"lead_{uuid.uuid4().hex[:12]}"
    now = datetime.now(timezone.utc)
    
    lead_doc = {
        "lead_id": lead_id,
        "organization_id": current_user["organization_id"],
        **lead_data.model_dump(),
        "status": "new",
        "ai_score": None,
        "assigned_to": None,
        "created_by": current_user["user_id"],
        "created_at": now.isoformat(),
        "updated_at": now.isoformat()
    }
    await db.leads.insert_one(lead_doc)
    # Remove MongoDB's _id field before returning
    lead_doc.pop('_id', None)
    return lead_doc

@api_router.get("/leads/{lead_id}")
async def get_lead(lead_id: str, current_user: dict = Depends(get_current_user)):
    lead = await db.leads.find_one(
        {"lead_id": lead_id, "organization_id": current_user.get("organization_id")},
        {"_id": 0}
    )
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    return lead

@api_router.put("/leads/{lead_id}")
async def update_lead(lead_id: str, updates: dict, current_user: dict = Depends(get_current_user)):
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    result = await db.leads.update_one(
        {"lead_id": lead_id, "organization_id": current_user.get("organization_id")},
        {"$set": updates}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Lead not found")
    return await get_lead(lead_id, current_user)

@api_router.delete("/leads/{lead_id}")
async def delete_lead(lead_id: str, current_user: dict = Depends(get_current_user)):
    result = await db.leads.delete_one(
        {"lead_id": lead_id, "organization_id": current_user.get("organization_id")}
    )
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Lead not found")
    return {"message": "Lead deleted"}

@api_router.post("/leads/import-csv")
async def import_leads_csv(file: UploadFile = File(...), current_user: dict = Depends(get_current_user)):
    if not current_user.get("organization_id"):
        org_id = await ensure_user_org(current_user)
        current_user["organization_id"] = org_id
    
    content = await file.read()
    decoded = content.decode('utf-8')
    reader = csv.DictReader(io.StringIO(decoded))
    
    now = datetime.now(timezone.utc)
    imported = 0
    
    for row in reader:
        lead_id = f"lead_{uuid.uuid4().hex[:12]}"
        lead_doc = {
            "lead_id": lead_id,
            "organization_id": current_user["organization_id"],
            "first_name": row.get("first_name", row.get("First Name", "")),
            "last_name": row.get("last_name", row.get("Last Name", "")),
            "email": row.get("email", row.get("Email", "")),
            "phone": row.get("phone", row.get("Phone", "")),
            "company": row.get("company", row.get("Company", "")),
            "job_title": row.get("job_title", row.get("Job Title", row.get("Position", ""))),
            "linkedin_url": row.get("linkedin_url", row.get("LinkedIn URL", row.get("Profile URL", ""))),
            "source": "linkedin_import",
            "status": "new",
            "ai_score": None,
            "notes": None,
            "assigned_to": None,
            "created_by": current_user["user_id"],
            "created_at": now.isoformat(),
            "updated_at": now.isoformat()
        }
        await db.leads.insert_one(lead_doc)
        imported += 1
    
    return {"message": f"Imported {imported} leads", "count": imported}

# ==================== COMPANIES ROUTES ====================

@api_router.get("/companies")
async def get_companies(current_user: dict = Depends(get_current_user)):
    if not current_user.get("organization_id"):
        org_id = await ensure_user_org(current_user)
        current_user["organization_id"] = org_id
    
    companies = await db.companies.find(
        {"organization_id": current_user["organization_id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(1000)
    return companies

@api_router.post("/companies")
async def create_company(company_data: CompanyCreate, current_user: dict = Depends(get_current_user)):
    if not current_user.get("organization_id"):
        org_id = await ensure_user_org(current_user)
        current_user["organization_id"] = org_id
    
    company_id = f"company_{uuid.uuid4().hex[:12]}"
    now = datetime.now(timezone.utc)
    
    company_doc = {
        "company_id": company_id,
        "organization_id": current_user["organization_id"],
        **company_data.model_dump(),
        "created_by": current_user["user_id"],
        "created_at": now.isoformat()
    }
    await db.companies.insert_one(company_doc)
    # Remove MongoDB's _id field before returning
    company_doc.pop('_id', None)
    return company_doc

@api_router.get("/companies/{company_id}")
async def get_company(company_id: str, current_user: dict = Depends(get_current_user)):
    company = await db.companies.find_one(
        {"company_id": company_id, "organization_id": current_user.get("organization_id")},
        {"_id": 0}
    )
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    return company

@api_router.put("/companies/{company_id}")
async def update_company(company_id: str, updates: dict, current_user: dict = Depends(get_current_user)):
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    result = await db.companies.update_one(
        {"company_id": company_id, "organization_id": current_user.get("organization_id")},
        {"$set": updates}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Company not found")
    return await get_company(company_id, current_user)

@api_router.delete("/companies/{company_id}")
async def delete_company(company_id: str, current_user: dict = Depends(get_current_user)):
    result = await db.companies.delete_one(
        {"company_id": company_id, "organization_id": current_user.get("organization_id")}
    )
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Company not found")
    return {"message": "Company deleted"}

@api_router.post("/companies/import-csv")
async def import_companies_csv(file: UploadFile = File(...), current_user: dict = Depends(get_current_user)):
    if not current_user.get("organization_id"):
        org_id = await ensure_user_org(current_user)
        current_user["organization_id"] = org_id
    content = await file.read()
    text = content.decode('utf-8-sig')
    reader = csv.DictReader(io.StringIO(text))
    now = datetime.now(timezone.utc)
    count = 0
    for row in reader:
        r = {k.strip().lower().replace(' ', '_'): v.strip() for k, v in row.items() if v and v.strip()}
        if not r.get('name') and not r.get('company'):
            continue
        doc = {
            "company_id": f"company_{uuid.uuid4().hex[:12]}",
            "organization_id": current_user["organization_id"],
            "name": r.get('name') or r.get('company', ''),
            "industry": r.get('industry'),
            "website": r.get('website') or r.get('url'),
            "size": r.get('size') or r.get('employees') or r.get('company_size'),
            "description": r.get('description') or r.get('notes'),
            "location": r.get('location') or r.get('city') or r.get('address'),
            "created_by": current_user["user_id"],
            "created_at": now.isoformat()
        }
        await db.companies.insert_one(doc)
        count += 1
    return {"count": count, "message": f"Imported {count} companies"}


# ==================== PER-ORG INTEGRATION SETTINGS ====================

@api_router.get("/settings/integrations")
async def get_org_integrations(current_user: dict = Depends(get_current_user)):
    """Get per-org integration keys (only admins/owners can see keys)"""
    if not current_user.get("organization_id"):
        return {"integrations": {}}
    org_id = current_user["organization_id"]
    settings = await db.org_integrations.find_one({"organization_id": org_id}, {"_id": 0})
    if not settings:
        settings = {"organization_id": org_id, "resend_api_key": "", "resend_sender_email": "", "kit_api_key": "", "kit_api_secret": "", "twilio_sid": "", "twilio_token": "", "twilio_phone": "", "google_client_id": "", "google_client_secret": "", "anthropic_api_key": "", "openai_api_key": ""}
    role = current_user.get("role", "member")
    if role not in ["admin", "owner", "super_admin", "deputy_admin"]:
        # Members can see which integrations are connected, but not the keys
        masked = {k: ("connected" if v else "") for k, v in settings.items() if k != "organization_id"}
        return {"integrations": masked}
    return {"integrations": settings}

@api_router.put("/settings/integrations")
async def update_org_integrations(updates: dict, current_user: dict = Depends(get_current_user)):
    """Update per-org integration keys (admin/owner only)"""
    role = current_user.get("role", "member")
    if role not in ["admin", "owner", "super_admin", "deputy_admin"]:
        raise HTTPException(status_code=403, detail="Only admins can update integrations")
    if not current_user.get("organization_id"):
        org_id = await ensure_user_org(current_user)
        current_user["organization_id"] = org_id
    org_id = current_user["organization_id"]
    allowed = {"resend_api_key", "resend_sender_email", "kit_api_key", "kit_api_secret", "twilio_sid", "twilio_token", "twilio_phone", "google_client_id", "google_client_secret", "anthropic_api_key", "openai_api_key"}
    filtered = {k: v for k, v in updates.items() if k in allowed}
    filtered["organization_id"] = org_id
    await db.org_integrations.update_one({"organization_id": org_id}, {"$set": filtered}, upsert=True)
    return {"message": "Integrations updated"}

@api_router.get("/settings/ai-status")
async def get_ai_status(current_user: dict = Depends(get_current_user)):
    """Check whether AI features are available for the current user."""
    email = current_user.get("email", "")
    if _is_internal_user(email):
        return {"ai_available": True, "source": "platform", "provider": "anthropic"}
    org_id = current_user.get("organization_id")
    if org_id:
        settings = await db.org_integrations.find_one({"organization_id": org_id}, {"anthropic_api_key": 1, "openai_api_key": 1})
        if settings:
            if settings.get("anthropic_api_key"):
                return {"ai_available": True, "source": "organization", "provider": "anthropic"}
            if settings.get("openai_api_key"):
                return {"ai_available": True, "source": "organization", "provider": "openai"}
    return {"ai_available": False, "source": None, "provider": None}


# ==================== CUSTOMIZABLE STAGES ====================

@api_router.get("/settings/stages")
async def get_custom_stages(current_user: dict = Depends(get_current_user)):
    if not current_user.get("organization_id"):
        org_id = await ensure_user_org(current_user)
        current_user["organization_id"] = org_id
    org_id = current_user["organization_id"]
    settings = await db.org_stage_settings.find_one({"organization_id": org_id}, {"_id": 0})
    if not settings:
        settings = {
            "organization_id": org_id,
            "deal_stages": [
                {"id": "lead", "name": "Lead"}, {"id": "qualified", "name": "Qualified"},
                {"id": "proposal", "name": "Proposal"}, {"id": "negotiation", "name": "Negotiation"},
                {"id": "won", "name": "Won"}, {"id": "lost", "name": "Lost"}
            ],
            "task_statuses": [
                {"id": "todo", "name": "To Do"}, {"id": "in_progress", "name": "In Progress"}, {"id": "done", "name": "Done"}
            ]
        }
    return settings

@api_router.put("/settings/stages")
async def update_custom_stages(stages: dict, current_user: dict = Depends(get_current_user)):
    if not current_user.get("organization_id"):
        org_id = await ensure_user_org(current_user)
        current_user["organization_id"] = org_id
    role = current_user.get("role", "member")
    if role not in ["admin", "owner", "super_admin", "deputy_admin"]:
        raise HTTPException(status_code=403, detail="Only admins can modify stages")
    org_id = current_user["organization_id"]
    stages["organization_id"] = org_id
    await db.org_stage_settings.update_one({"organization_id": org_id}, {"$set": stages}, upsert=True)
    return await get_custom_stages(current_user)

# ==================== DEALS ROUTES ====================

@api_router.get("/deals")
async def get_deals(
    stage: Optional[str] = None,
    tag: Optional[str] = None,
    assigned_to: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    if not current_user.get("organization_id"):
        org_id = await ensure_user_org(current_user)
        current_user["organization_id"] = org_id
    
    query = {"organization_id": current_user["organization_id"]}
    if stage:
        query["stage"] = stage
    if tag:
        query["tags"] = tag
    if assigned_to:
        query["assigned_to"] = assigned_to
    
    deals = await db.deals.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return deals

@api_router.get("/deals/tags")
async def get_deal_tags(current_user: dict = Depends(get_current_user)):
    """Get all unique tags used in deals"""
    if not current_user.get("organization_id"):
        org_id = await ensure_user_org(current_user)
        current_user["organization_id"] = org_id
    
    pipeline = [
        {"$match": {"organization_id": current_user["organization_id"]}},
        {"$unwind": "$tags"},
        {"$group": {"_id": "$tags"}},
        {"$sort": {"_id": 1}}
    ]
    tags = await db.deals.aggregate(pipeline).to_list(1000)
    return {"tags": [t["_id"] for t in tags]}

@api_router.post("/deals")
async def create_deal(deal_data: DealCreate, current_user: dict = Depends(get_current_user)):
    if not current_user.get("organization_id"):
        org_id = await ensure_user_org(current_user)
        current_user["organization_id"] = org_id
    
    deal_id = f"deal_{uuid.uuid4().hex[:12]}"
    now = datetime.now(timezone.utc)
    
    # Extract task data before creating deal_doc
    task_title = deal_data.task_title
    task_owner_id = deal_data.task_owner_id or current_user["user_id"]
    task_description = deal_data.task_description
    task_due_date = deal_data.task_due_date
    
    deal_dict = deal_data.model_dump()
    # Remove task fields from deal
    del deal_dict["task_title"]
    del deal_dict["task_owner_id"]
    del deal_dict["task_description"]
    del deal_dict["task_due_date"]
    
    deal_doc = {
        "deal_id": deal_id,
        "organization_id": current_user["organization_id"],
        **deal_dict,
        "assigned_to": task_owner_id,
        "created_by": current_user["user_id"],
        "created_at": now.isoformat(),
        "updated_at": now.isoformat()
    }
    if deal_doc.get("expected_close_date"):
        deal_doc["expected_close_date"] = deal_doc["expected_close_date"].isoformat()
    await db.deals.insert_one(deal_doc)
    
    # Create task only if task_title is provided
    task_id = None
    if task_title:
        task_id = f"task_{uuid.uuid4().hex[:12]}"
        task_doc = {
            "task_id": task_id,
            "organization_id": current_user["organization_id"],
            "title": task_title,
            "description": task_description or f"Initial task for deal: {deal_data.name}",
            "status": "todo",
            "priority": "medium",
            "due_date": task_due_date.isoformat() if task_due_date else None,
            "assigned_to": task_owner_id,
            "related_lead_id": deal_data.lead_id,
            "related_deal_id": deal_id,
            "created_by": current_user["user_id"],
            "created_at": now.isoformat(),
            "updated_at": now.isoformat()
        }
        await db.tasks.insert_one(task_doc)
    
    # Remove MongoDB's _id field before returning
    deal_doc.pop('_id', None)
    if task_id:
        deal_doc["created_task_id"] = task_id
    return deal_doc

@api_router.put("/deals/{deal_id}")
async def update_deal(deal_id: str, updates: dict, current_user: dict = Depends(get_current_user)):
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    if updates.get("expected_close_date") and isinstance(updates["expected_close_date"], datetime):
        updates["expected_close_date"] = updates["expected_close_date"].isoformat()
    
    # Check permission - org admin or owner can edit all, others only their own
    deal = await db.deals.find_one({"deal_id": deal_id}, {"_id": 0})
    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found")
    
    user_role = current_user.get("role", "member")
    is_admin = user_role in ["admin", "owner", "super_admin"]
    is_owner = deal.get("assigned_to") == current_user["user_id"] or deal.get("created_by") == current_user["user_id"]
    
    if not is_admin and not is_owner:
        raise HTTPException(status_code=403, detail="You can only edit your own deals")
    
    result = await db.deals.update_one(
        {"deal_id": deal_id, "organization_id": current_user.get("organization_id")},
        {"$set": updates}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Deal not found")
    
    deal = await db.deals.find_one({"deal_id": deal_id}, {"_id": 0})
    return deal

@api_router.delete("/deals/{deal_id}")
async def delete_deal(deal_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a deal"""
    deal = await db.deals.find_one({"deal_id": deal_id, "organization_id": current_user.get("organization_id")}, {"_id": 0})
    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found")
    
    user_role = current_user.get("role", "member")
    is_admin = user_role in ["admin", "owner", "super_admin", "deputy_admin"]
    is_owner = deal.get("assigned_to") == current_user["user_id"] or deal.get("created_by") == current_user["user_id"]
    if not is_admin and not is_owner:
        raise HTTPException(status_code=403, detail="Permission denied")
    
    await db.deals.delete_one({"deal_id": deal_id})
    return {"message": "Deal deleted"}

# ==================== TASKS ROUTES ====================

@api_router.get("/tasks")
async def get_tasks(
    status: Optional[str] = None,
    assigned_to: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    if not current_user.get("organization_id"):
        org_id = await ensure_user_org(current_user)
        current_user["organization_id"] = org_id
    
    query = {"organization_id": current_user["organization_id"]}
    if status:
        query["status"] = status
    if assigned_to:
        query["assigned_to"] = assigned_to
    
    tasks = await db.tasks.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    for t in tasks:
        subs = t.get("subtasks", [])
        t["subtask_count"] = len(subs)
        t["subtasks_done"] = len([s for s in subs if s.get("done")])
    return tasks

@api_router.post("/tasks")
async def create_task(task_data: TaskCreate, current_user: dict = Depends(get_current_user)):
    if not current_user.get("organization_id"):
        org_id = await ensure_user_org(current_user)
        current_user["organization_id"] = org_id
    
    task_id = f"task_{uuid.uuid4().hex[:12]}"
    now = datetime.now(timezone.utc)
    
    task_doc = {
        "task_id": task_id,
        "organization_id": current_user["organization_id"],
        **task_data.model_dump(),
        "subtasks": [],
        "comments": [],
        "activity": [{"action": "created", "by": current_user["user_id"], "by_name": current_user.get("name", ""), "at": now.isoformat()}],
        "created_by": current_user["user_id"],
        "created_at": now.isoformat(),
        "updated_at": now.isoformat()
    }
    if task_doc.get("due_date"):
        task_doc["due_date"] = task_doc["due_date"].isoformat()
    await db.tasks.insert_one(task_doc)
    task_doc.pop('_id', None)
    return task_doc

@api_router.put("/tasks/{task_id}")
async def update_task(task_id: str, updates: dict, current_user: dict = Depends(get_current_user)):
    now = datetime.now(timezone.utc)
    old_task = await db.tasks.find_one({"task_id": task_id, "organization_id": current_user.get("organization_id")}, {"_id": 0})
    if not old_task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    activities = []
    for field in ["status", "priority", "assigned_to", "due_date", "description", "title"]:
        if field in updates and updates[field] != old_task.get(field):
            activities.append({"action": f"{field}_changed", "from": str(old_task.get(field, "")), "to": str(updates[field]), "by": current_user["user_id"], "by_name": current_user.get("name", ""), "at": now.isoformat()})
    
    updates["updated_at"] = now.isoformat()
    if updates.get("due_date") and isinstance(updates["due_date"], datetime):
        updates["due_date"] = updates["due_date"].isoformat()
    
    update_ops = {"$set": updates}
    if activities:
        update_ops["$push"] = {"activity": {"$each": activities}}
    await db.tasks.update_one({"task_id": task_id}, update_ops)
    task = await db.tasks.find_one({"task_id": task_id}, {"_id": 0})
    return task

@api_router.delete("/tasks/{task_id}")
async def delete_task(task_id: str, current_user: dict = Depends(get_current_user)):
    result = await db.tasks.delete_one({"task_id": task_id, "organization_id": current_user.get("organization_id")})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Task not found")
    return {"message": "Task deleted"}

@api_router.post("/tasks/{task_id}/comments")
async def add_task_comment(task_id: str, content: str, current_user: dict = Depends(get_current_user)):
    now = datetime.now(timezone.utc)
    comment = {"id": f"cmt_{uuid.uuid4().hex[:8]}", "content": content, "by": current_user["user_id"], "by_name": current_user.get("name", ""), "at": now.isoformat()}
    activity = {"action": "comment_added", "by": current_user["user_id"], "by_name": current_user.get("name", ""), "at": now.isoformat()}
    result = await db.tasks.update_one({"task_id": task_id, "organization_id": current_user.get("organization_id")}, {"$push": {"comments": comment, "activity": activity}, "$set": {"updated_at": now.isoformat()}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Task not found")
    return comment

@api_router.post("/tasks/{task_id}/subtasks")
async def add_subtask(task_id: str, title: str, current_user: dict = Depends(get_current_user)):
    now = datetime.now(timezone.utc)
    subtask = {"id": f"sub_{uuid.uuid4().hex[:8]}", "title": title, "done": False, "created_at": now.isoformat()}
    activity = {"action": "subtask_added", "detail": title, "by": current_user["user_id"], "by_name": current_user.get("name", ""), "at": now.isoformat()}
    result = await db.tasks.update_one({"task_id": task_id, "organization_id": current_user.get("organization_id")}, {"$push": {"subtasks": subtask, "activity": activity}, "$set": {"updated_at": now.isoformat()}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Task not found")
    return subtask

@api_router.put("/tasks/{task_id}/subtasks/{subtask_id}")
async def toggle_subtask(task_id: str, subtask_id: str, done: bool, current_user: dict = Depends(get_current_user)):
    now = datetime.now(timezone.utc)
    task = await db.tasks.find_one({"task_id": task_id}, {"_id": 0})
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    subtasks = task.get("subtasks", [])
    title = ""
    for s in subtasks:
        if s["id"] == subtask_id:
            s["done"] = done
            title = s["title"]
    activity = {"action": "subtask_completed" if done else "subtask_reopened", "detail": title, "by": current_user["user_id"], "by_name": current_user.get("name", ""), "at": now.isoformat()}
    await db.tasks.update_one({"task_id": task_id}, {"$set": {"subtasks": subtasks, "updated_at": now.isoformat()}, "$push": {"activity": activity}})
    return {"subtask_id": subtask_id, "done": done}

@api_router.post("/tasks/{task_id}/reopen")
async def reopen_task(task_id: str, current_user: dict = Depends(get_current_user)):
    now = datetime.now(timezone.utc)
    activity = {"action": "reopened", "by": current_user["user_id"], "by_name": current_user.get("name", ""), "at": now.isoformat()}
    result = await db.tasks.update_one({"task_id": task_id, "organization_id": current_user.get("organization_id"), "status": "done"}, {"$set": {"status": "todo", "updated_at": now.isoformat()}, "$push": {"activity": activity}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Task not found or not done")
    return {"message": "Task reopened"}

# ==================== PROJECTS ROUTES ====================

class ProjectCreate(BaseModel):
    name: str
    description: Optional[str] = None
    status: str = "active"  # active, on_hold, completed
    deal_id: Optional[str] = None
    members: List[str] = []  # user_ids

@api_router.get("/projects")
async def get_projects(current_user: dict = Depends(get_current_user)):
    if not current_user.get("organization_id"):
        org_id = await ensure_user_org(current_user)
        current_user["organization_id"] = org_id
    projects = await db.projects.find({"organization_id": current_user["organization_id"]}, {"_id": 0}).sort("created_at", -1).to_list(200)
    
    # Batch task counts with aggregation instead of N+1 queries
    proj_ids = [p["project_id"] for p in projects]
    if proj_ids:
        task_stats = await db.tasks.aggregate([
            {"$match": {"project_id": {"$in": proj_ids}}},
            {"$group": {"_id": "$project_id", "total": {"$sum": 1}, "done": {"$sum": {"$cond": [{"$eq": ["$status", "done"]}, 1, 0]}}}}
        ]).to_list(500)
        stats_map = {s["_id"]: s for s in task_stats}
    else:
        stats_map = {}
    
    for p in projects:
        s = stats_map.get(p["project_id"], {"total": 0, "done": 0})
        p["task_count"] = s["total"]
        p["tasks_done"] = s["done"]
        p["progress"] = round((s["done"] / s["total"]) * 100) if s["total"] > 0 else 0
    return projects

@api_router.post("/projects")
async def create_project(data: ProjectCreate, current_user: dict = Depends(get_current_user)):
    if not current_user.get("organization_id"):
        org_id = await ensure_user_org(current_user)
        current_user["organization_id"] = org_id
    
    project_id = f"proj_{uuid.uuid4().hex[:12]}"
    now = datetime.now(timezone.utc)
    
    members = data.members if data.members else [current_user["user_id"]]
    if current_user["user_id"] not in members:
        members.append(current_user["user_id"])
    
    doc = {
        "project_id": project_id,
        "organization_id": current_user["organization_id"],
        "name": data.name,
        "description": data.description,
        "status": data.status,
        "deal_id": data.deal_id,
        "members": members,
        "created_by": current_user["user_id"],
        "created_at": now.isoformat(),
        "updated_at": now.isoformat()
    }
    await db.projects.insert_one(doc)
    
    # Auto-create project chat channel
    channel_doc = {
        "channel_id": f"proj_chat_{project_id}",
        "organization_id": current_user["organization_id"],
        "name": f"Project: {data.name}",
        "description": f"Discussion for project {data.name}",
        "channel_type": "project",
        "related_id": project_id,
        "members": members,
        "created_by": current_user["user_id"],
        "created_at": now.isoformat(),
        "last_message_at": None
    }
    await db.chat_channels.insert_one(channel_doc)
    
    doc.pop('_id', None)
    return doc

@api_router.get("/projects/{project_id}")
async def get_project(project_id: str, current_user: dict = Depends(get_current_user)):
    project = await db.projects.find_one(
        {"project_id": project_id, "organization_id": current_user.get("organization_id")},
        {"_id": 0}
    )
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Get tasks
    tasks = await db.tasks.find({"project_id": project_id}, {"_id": 0}).sort("created_at", -1).to_list(200)
    total = len(tasks)
    done = len([t for t in tasks if t.get("status") == "done"])
    
    # Get deal info
    deal = None
    if project.get("deal_id"):
        deal = await db.deals.find_one({"deal_id": project["deal_id"]}, {"_id": 0})
    
    project["tasks"] = tasks
    project["task_count"] = total
    project["tasks_done"] = done
    project["progress"] = round((done / total) * 100) if total > 0 else 0
    project["deal"] = deal
    return project

@api_router.put("/projects/{project_id}")
async def update_project(project_id: str, updates: dict, current_user: dict = Depends(get_current_user)):
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    result = await db.projects.update_one(
        {"project_id": project_id, "organization_id": current_user.get("organization_id")},
        {"$set": updates}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Project not found")
    return await get_project(project_id, current_user)

@api_router.delete("/projects/{project_id}")
async def delete_project(project_id: str, current_user: dict = Depends(get_current_user)):
    result = await db.projects.delete_one(
        {"project_id": project_id, "organization_id": current_user.get("organization_id")}
    )
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Project not found")
    # Archive the chat channel
    await db.chat_channels.update_one({"related_id": project_id, "channel_type": "project"}, {"$set": {"archived": True}})
    return {"message": "Project deleted"}

# ==================== CALENDAR ROUTES ====================

@api_router.get("/calendar/events")
async def get_calendar_events(start: Optional[str] = None, end: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    """Get all calendar events from tasks, calls, deals for date range"""
    if not current_user.get("organization_id"):
        org_id = await ensure_user_org(current_user)
        current_user["organization_id"] = org_id
    
    org_id = current_user["organization_id"]
    logger.info(f"Calendar events for org: {org_id}")
    events = []
    
    # Scheduled calls
    try:
        calls = await db.scheduled_calls.find({"organization_id": org_id, "status": "scheduled"}, {"_id": 0}).to_list(500)
        for c in calls:
            events.append({"id": c.get("schedule_id", ""), "title": f"Call: {c.get('lead_name', 'Unknown')}", "date": c.get("scheduled_at", ""), "end_date": None, "type": "call", "color": "#7C3AED", "entity_id": c.get("lead_id"), "entity_type": "lead", "notes": c.get("notes")})
    except Exception as e:
        logger.error(f"Calendar calls error: {e}")
    
    # Tasks with due dates
    try:
        tasks = await db.tasks.find({"organization_id": org_id, "due_date": {"$ne": None}}, {"_id": 0}).to_list(500)
        for t in tasks:
            events.append({"id": t.get("task_id", ""), "title": f"Task: {t.get('title', '')}", "date": t.get("due_date", ""), "end_date": None, "type": "task", "color": "#f59e0b" if t.get("status") != "done" else "#10b981", "entity_id": t.get("project_id") or t.get("related_deal_id"), "entity_type": "task", "status": t.get("status"), "priority": t.get("priority")})
    except Exception as e:
        logger.error(f"Calendar tasks error: {e}")
    
    # Deal close dates
    try:
        deals = await db.deals.find({"organization_id": org_id, "expected_close_date": {"$ne": None}, "stage": {"$nin": ["lost", "won"]}}, {"_id": 0}).to_list(500)
        for d in deals:
            events.append({"id": d.get("deal_id", ""), "title": f"Close: {d.get('name', '')}", "date": str(d.get("expected_close_date", "")), "end_date": None, "type": "deal", "color": "#6366f1", "value": d.get("value"), "stage": d.get("stage"), "entity_id": d.get("deal_id"), "entity_type": "deal"})
    except Exception as e:
        logger.error(f"Calendar deals error: {e}")
    
    # Custom calendar events
    try:
        custom = await db.calendar_events.find({"organization_id": org_id}, {"_id": 0}).to_list(500)
        for e in custom:
            events.append({"id": e.get("event_id", ""), "title": e.get("title", ""), "date": e.get("date", ""), "end_date": e.get("end_date"), "type": "event", "color": e.get("color", "#3B0764"), "notes": e.get("notes"), "location": e.get("location"), "blocks_booking": e.get("blocks_booking", True), "invitees": e.get("invitees", []), "linked_type": e.get("linked_type"), "linked_id": e.get("linked_id"), "entity_id": None, "entity_type": "event"})
    except Exception as ex:
        logger.error(f"Calendar custom events error: {ex}")
    
    return events

@api_router.post("/calendar/events")
async def create_calendar_event(title: str, date: str, end_date: Optional[str] = None, notes: Optional[str] = None, color: str = "#A100FF", linked_type: Optional[str] = None, linked_id: Optional[str] = None, location: Optional[str] = None, invitee_emails: Optional[str] = None, blocks_booking: bool = True, current_user: dict = Depends(get_current_user)):
    """Create a custom calendar event with start and end time"""
    if not current_user.get("organization_id"):
        org_id = await ensure_user_org(current_user)
        current_user["organization_id"] = org_id
    
    event_id = f"evt_{uuid.uuid4().hex[:12]}"
    doc = {
        "event_id": event_id,
        "organization_id": current_user["organization_id"],
        "title": title,
        "date": date,
        "end_date": end_date,
        "notes": notes,
        "color": color,
        "location": location,
        "blocks_booking": blocks_booking,
        "invitees": [e.strip() for e in invitee_emails.split(',') if e.strip()] if invitee_emails else [],
        "linked_type": linked_type,
        "linked_id": linked_id,
        "created_by": current_user["user_id"],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.calendar_events.insert_one(doc)
    doc.pop('_id', None)
    return doc

@api_router.delete("/calendar/events/{event_id}")
async def delete_calendar_event(event_id: str, current_user: dict = Depends(get_current_user)):
    result = await db.calendar_events.delete_one({"event_id": event_id, "organization_id": current_user.get("organization_id")})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Event not found")
    return {"message": "Event deleted"}

@api_router.put("/calendar/events/{event_id}")
async def update_calendar_event(event_id: str, updates: dict, current_user: dict = Depends(get_current_user)):
    """Edit a calendar event"""
    allowed = {"title", "date", "end_date", "notes", "color", "linked_type", "linked_id", "invitees", "location", "blocks_booking"}
    filtered = {k: v for k, v in updates.items() if k in allowed}
    filtered["updated_at"] = datetime.now(timezone.utc).isoformat()
    result = await db.calendar_events.update_one(
        {"event_id": event_id, "organization_id": current_user.get("organization_id")},
        {"$set": filtered}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Event not found")
    updated = await db.calendar_events.find_one({"event_id": event_id}, {"_id": 0})
    return updated

@api_router.post("/calendar/events/{event_id}/invite")
async def invite_to_event(event_id: str, emails: List[str], current_user: dict = Depends(get_current_user)):
    """Invite people to a calendar event via email"""
    event = await db.calendar_events.find_one({"event_id": event_id, "organization_id": current_user.get("organization_id")}, {"_id": 0})
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    now = datetime.now(timezone.utc)
    
    # Store invitees
    existing_invitees = event.get("invitees", [])
    new_invitees = [e for e in emails if e not in existing_invitees]
    all_invitees = existing_invitees + new_invitees
    await db.calendar_events.update_one({"event_id": event_id}, {"$set": {"invitees": all_invitees}})
    
    # Send invite emails
    sent = 0
    if RESEND_API_KEY and new_invitees:
        start_str = event.get("date", "")
        end_str = event.get("end_date", "")
        title = event.get("title", "Meeting")
        notes = event.get("notes", "")
        inviter = current_user.get("name", current_user.get("email", ""))
        
        # Build iCal
        try:
            start_dt = datetime.fromisoformat(start_str.replace('Z', '+00:00')) if start_str else now
            end_dt = datetime.fromisoformat(end_str.replace('Z', '+00:00')) if end_str else start_dt + timedelta(hours=1)
        except:
            start_dt = now
            end_dt = now + timedelta(hours=1)
        
        ical = f"""BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:{event_id}@earnrm.com
DTSTART:{start_dt.strftime('%Y%m%dT%H%M%SZ')}
DTEND:{end_dt.strftime('%Y%m%dT%H%M%SZ')}
SUMMARY:{title}
DESCRIPTION:{notes}
ORGANIZER:mailto:{current_user.get('email','')}
STATUS:CONFIRMED
END:VEVENT
END:VCALENDAR"""
        
        for email_addr in new_invitees:
            try:
                import asyncio
                await asyncio.to_thread(resend.Emails.send, {
                    "from": SENDER_EMAIL,
                    "to": [email_addr],
                    "subject": f"Invitation: {title} on {start_dt.strftime('%b %d at %H:%M')}",
                    "html": f"<div style='font-family:sans-serif;max-width:500px'><h2>{title}</h2><p><strong>When:</strong> {start_dt.strftime('%A, %B %d at %H:%M')} to {end_dt.strftime('%H:%M')}</p><p><strong>Invited by:</strong> {inviter}</p>{f'<p><strong>Notes:</strong> {notes}</p>' if notes else ''}<p style='color:#666;font-size:14px;margin-top:20px'>This invitation was sent from earnrm.</p></div>",
                    "attachments": [{"filename": "invite.ics", "content": ical}]
                })
                sent += 1
            except Exception as e:
                logger.error(f"Event invite email error for {email_addr}: {e}")
    
    return {"invited": sent, "total_invitees": len(all_invitees)}


@api_router.get("/calendar/team-events")
async def get_team_calendar_events(current_user: dict = Depends(get_current_user)):
    """Get calendar events for all team members in the org (for overlay view)"""
    if not current_user.get("organization_id"):
        org_id = await ensure_user_org(current_user)
        current_user["organization_id"] = org_id
    org_id = current_user["organization_id"]
    members = await db.users.find({"organization_id": org_id}, {"_id": 0, "password_hash": 0}).to_list(100)
    team_events = []
    for member in members:
        if member["user_id"] == current_user["user_id"]:
            continue
        uid = member["user_id"]
        name = member.get("name", member.get("email", ""))
        calls = await db.scheduled_calls.find({"organization_id": org_id, "created_by": uid, "status": "scheduled"}, {"_id": 0}).to_list(100)
        for c in calls:
            team_events.append({"id": c["schedule_id"], "title": f"{name}: Call with {c.get('lead_name','')}", "date": c["scheduled_at"], "end_date": None, "type": "team", "color": "#94a3b8", "member_name": name, "member_id": uid})
        events = await db.calendar_events.find({"organization_id": org_id, "created_by": uid}, {"_id": 0}).to_list(100)
        for e in events:
            team_events.append({"id": e["event_id"], "title": f"{name}: {e['title']}", "date": e["date"], "end_date": e.get("end_date"), "type": "team", "color": "#94a3b8", "member_name": name, "member_id": uid})
        bookings = await db.bookings.find({"host_user_id": uid, "status": "confirmed"}, {"_id": 0}).to_list(100)
        for b in bookings:
            team_events.append({"id": b["booking_id"], "title": f"{name}: Meeting with {b.get('guest_name','')}", "date": b["start_time"], "end_date": b.get("end_time"), "type": "team", "color": "#94a3b8", "member_name": name, "member_id": uid})
    return team_events


# ==================== GOOGLE CALENDAR INTEGRATION ====================

GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.environ.get("GOOGLE_CLIENT_SECRET")
GOOGLE_SCOPES = ["https://www.googleapis.com/auth/calendar.readonly", "https://www.googleapis.com/auth/calendar.events"]

@api_router.get("/calendar/google/auth-url")
async def google_calendar_auth_url(request: Request, current_user: dict = Depends(get_current_user)):
    """Get Google OAuth URL for Calendar access"""
    if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET:
        raise HTTPException(status_code=400, detail="Google Calendar not configured")
    
    from google_auth_oauthlib.flow import Flow
    
    redirect_uri = f"{FRONTEND_URL}/api/auth/google/callback"
    flow = Flow.from_client_config(
        {"web": {"client_id": GOOGLE_CLIENT_ID, "client_secret": GOOGLE_CLIENT_SECRET, "auth_uri": "https://accounts.google.com/o/oauth2/auth", "token_uri": "https://oauth2.googleapis.com/token"}},
        scopes=GOOGLE_SCOPES,
        redirect_uri=redirect_uri
    )
    auth_url, state = flow.authorization_url(access_type='offline', prompt='consent')
    
    # Store state for verification
    await db.google_calendar_states.insert_one({"state": state, "user_id": current_user["user_id"], "created_at": datetime.now(timezone.utc).isoformat()})
    
    return {"auth_url": auth_url, "state": state}

@api_router.get("/auth/google/callback")
async def google_calendar_callback(code: str, state: str):
    """Handle Google OAuth callback"""
    from google_auth_oauthlib.flow import Flow
    
    # Find the user from state
    state_doc = await db.google_calendar_states.find_one({"state": state})
    if not state_doc:
        raise HTTPException(status_code=400, detail="Invalid state")
    
    user_id = state_doc["user_id"]
    redirect_uri = f"{FRONTEND_URL}/api/auth/google/callback"
    
    flow = Flow.from_client_config(
        {"web": {"client_id": GOOGLE_CLIENT_ID, "client_secret": GOOGLE_CLIENT_SECRET, "auth_uri": "https://accounts.google.com/o/oauth2/auth", "token_uri": "https://oauth2.googleapis.com/token"}},
        scopes=GOOGLE_SCOPES,
        redirect_uri=redirect_uri,
        state=state
    )
    flow.fetch_token(code=code)
    credentials = flow.credentials
    
    # Store tokens
    token_doc = {
        "user_id": user_id,
        "access_token": credentials.token,
        "refresh_token": credentials.refresh_token,
        "token_uri": credentials.token_uri,
        "client_id": credentials.client_id,
        "client_secret": credentials.client_secret,
        "scopes": list(credentials.scopes) if credentials.scopes else GOOGLE_SCOPES,
        "expiry": credentials.expiry.isoformat() if credentials.expiry else None,
        "connected_at": datetime.now(timezone.utc).isoformat()
    }
    await db.google_calendar_tokens.delete_many({"user_id": user_id})
    await db.google_calendar_tokens.insert_one(token_doc)
    await db.google_calendar_states.delete_many({"user_id": user_id})
    
    # Redirect back to calendar settings
    from starlette.responses import RedirectResponse
    return RedirectResponse(url=f"{FRONTEND_URL}/settings?tab=integrations&google=connected")

@api_router.get("/calendar/google/status")
async def google_calendar_status(current_user: dict = Depends(get_current_user)):
    """Check if Google Calendar is connected"""
    token = await db.google_calendar_tokens.find_one({"user_id": current_user["user_id"]}, {"_id": 0, "access_token": 0, "refresh_token": 0, "client_secret": 0})
    return {"connected": token is not None, "connected_at": token.get("connected_at") if token else None}

@api_router.get("/calendar/google/events")
async def google_calendar_events(current_user: dict = Depends(get_current_user)):
    """Fetch events from Google Calendar"""
    token_doc = await db.google_calendar_tokens.find_one({"user_id": current_user["user_id"]}, {"_id": 0})
    if not token_doc:
        raise HTTPException(status_code=400, detail="Google Calendar not connected")
    
    try:
        from google.oauth2.credentials import Credentials
        from googleapiclient.discovery import build
        
        creds = Credentials(
            token=token_doc["access_token"],
            refresh_token=token_doc.get("refresh_token"),
            token_uri=token_doc.get("token_uri", "https://oauth2.googleapis.com/token"),
            client_id=token_doc.get("client_id", GOOGLE_CLIENT_ID),
            client_secret=token_doc.get("client_secret", GOOGLE_CLIENT_SECRET),
            scopes=token_doc.get("scopes", GOOGLE_SCOPES)
        )
        
        service = build('calendar', 'v3', credentials=creds)
        
        now = datetime.now(timezone.utc)
        time_min = (now - timedelta(days=30)).isoformat()
        time_max = (now + timedelta(days=90)).isoformat()
        
        events_result = service.events().list(
            calendarId='primary',
            timeMin=time_min,
            timeMax=time_max,
            maxResults=200,
            singleEvents=True,
            orderBy='startTime'
        ).execute()
        
        events = []
        for e in events_result.get('items', []):
            start = e.get('start', {}).get('dateTime', e.get('start', {}).get('date', ''))
            events.append({
                "id": f"gcal_{e['id']}",
                "title": e.get('summary', 'No title'),
                "date": start,
                "type": "google",
                "color": "#4285f4",
                "notes": e.get('description', ''),
                "location": e.get('location', ''),
                "google_id": e['id']
            })
        
        # Update stored token if refreshed
        if creds.token != token_doc["access_token"]:
            await db.google_calendar_tokens.update_one(
                {"user_id": current_user["user_id"]},
                {"$set": {"access_token": creds.token, "expiry": creds.expiry.isoformat() if creds.expiry else None}}
            )
        
        return events
    except Exception as e:
        logger.error(f"Google Calendar error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch Google Calendar: {str(e)}")

@api_router.delete("/calendar/google/disconnect")
async def disconnect_google_calendar(current_user: dict = Depends(get_current_user)):
    """Disconnect Google Calendar"""
    await db.google_calendar_tokens.delete_many({"user_id": current_user["user_id"]})
    return {"message": "Google Calendar disconnected"}

# ==================== CAMPAIGNS ROUTES ====================

@api_router.get("/campaigns")
async def get_campaigns(current_user: dict = Depends(get_current_user)):
    if not current_user.get("organization_id"):
        org_id = await ensure_user_org(current_user)
        current_user["organization_id"] = org_id
    
    campaigns = await db.campaigns.find(
        {"organization_id": current_user["organization_id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(1000)
    return campaigns

@api_router.post("/campaigns")
async def create_campaign(campaign_data: CampaignCreate, current_user: dict = Depends(get_current_user)):
    if not current_user.get("organization_id"):
        org_id = await ensure_user_org(current_user)
        current_user["organization_id"] = org_id
    
    campaign_id = f"campaign_{uuid.uuid4().hex[:12]}"
    now = datetime.now(timezone.utc)
    
    campaign_doc = {
        "campaign_id": campaign_id,
        "organization_id": current_user["organization_id"],
        **campaign_data.model_dump(),
        "status": "draft",
        "sent_count": 0,
        "open_count": 0,
        "click_count": 0,
        "created_by": current_user["user_id"],
        "created_at": now.isoformat()
    }
    if campaign_doc.get("scheduled_at"):
        campaign_doc["scheduled_at"] = campaign_doc["scheduled_at"].isoformat()
    await db.campaigns.insert_one(campaign_doc)
    # Remove MongoDB's _id field before returning
    campaign_doc.pop('_id', None)
    return campaign_doc

# ==================== KIT.COM EMAIL INTEGRATION ====================

KIT_API_KEY = os.environ.get("KIT_API_KEY")  # This is the public API key
KIT_API_SECRET = os.environ.get("KIT_API_SECRET")  # This is the secret API key
KIT_API_BASE = "https://api.convertkit.com/v3"

class LeadMagnetSubscribe(BaseModel):
    email: EmailStr
    first_name: Optional[str] = None
    source: str = "lead_magnet"

class KitBroadcastCreate(BaseModel):
    subject: str
    content: str
    send_at: Optional[str] = None  # ISO format datetime

@api_router.get("/kit/account")
async def get_kit_account():
    """Get Kit.com account information - returns basic info with public key"""
    try:
        # With public key, we can only get forms/tags info, not full account
        # Return a mock account info based on available data
        async with httpx.AsyncClient() as client:
            forms_response = await client.get(
                f"{KIT_API_BASE}/forms",
                params={"api_key": KIT_API_KEY}
            )
            tags_response = await client.get(
                f"{KIT_API_BASE}/tags",
                params={"api_key": KIT_API_KEY}
            )
            
            forms_count = len(forms_response.json().get("forms", [])) if forms_response.status_code == 200 else 0
            tags_count = len(tags_response.json().get("tags", [])) if tags_response.status_code == 200 else 0
            
            return {
                "name": "Kit.com Account",
                "plan_type": "Connected",
                "forms_count": forms_count,
                "tags_count": tags_count,
                "status": "active"
            }
    except httpx.RequestError as e:
        logger.error(f"Kit connection error: {e}")
        raise HTTPException(status_code=500, detail="Failed to connect to Kit.com")

@api_router.get("/kit/forms")
async def get_kit_forms():
    """List all Kit.com forms"""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{KIT_API_BASE}/forms",
                params={"api_key": KIT_API_KEY}
            )
            if response.status_code == 200:
                return response.json()
            raise HTTPException(status_code=response.status_code, detail="Failed to fetch forms")
    except httpx.RequestError as e:
        logger.error(f"Kit forms error: {e}")
        raise HTTPException(status_code=500, detail="Failed to connect to Kit.com")

@api_router.get("/kit/tags")
async def get_kit_tags():
    """List all Kit.com tags"""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{KIT_API_BASE}/tags",
                params={"api_key": KIT_API_KEY}
            )
            if response.status_code == 200:
                return response.json()
            raise HTTPException(status_code=response.status_code, detail="Failed to fetch tags")
    except httpx.RequestError as e:
        logger.error(f"Kit tags error: {e}")
        raise HTTPException(status_code=500, detail="Failed to connect to Kit.com")

@api_router.post("/kit/tags")
async def create_kit_tag(name: str):
    """Create a new tag in Kit.com (Note: requires api_secret, may fail with public key)"""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{KIT_API_BASE}/tags",
                json={
                    "api_key": KIT_API_KEY,
                    "tag": {"name": name}
                }
            )
            if response.status_code in [200, 201]:
                return response.json()
            # If it fails, it's likely because we need api_secret for write operations
            logger.warning(f"Kit create tag requires api_secret: {response.text}")
            raise HTTPException(status_code=response.status_code, detail="Creating tags requires Kit.com secret key")
    except httpx.RequestError as e:
        logger.error(f"Kit create tag error: {e}")
        raise HTTPException(status_code=500, detail="Failed to connect to Kit.com")

@api_router.post("/kit/subscribe/{tag_id}")
async def subscribe_to_tag(tag_id: int, subscriber: LeadMagnetSubscribe):
    """Subscribe an email to a specific tag"""
    try:
        async with httpx.AsyncClient() as client:
            payload = {
                "api_key": KIT_API_KEY,
                "email": subscriber.email
            }
            if subscriber.first_name:
                payload["first_name"] = subscriber.first_name
            
            response = await client.post(
                f"{KIT_API_BASE}/tags/{tag_id}/subscribe",
                json=payload
            )
            if response.status_code in [200, 201]:
                # Store in our database too
                now = datetime.now(timezone.utc)
                await db.lead_magnet_subscribers.insert_one({
                    "email": subscriber.email,
                    "first_name": subscriber.first_name,
                    "source": subscriber.source,
                    "kit_tag_id": tag_id,
                    "subscribed_at": now.isoformat()
                })
                return {"success": True, "message": "Subscribed successfully", "data": response.json()}
            raise HTTPException(status_code=response.status_code, detail="Failed to subscribe")
    except httpx.RequestError as e:
        logger.error(f"Kit subscribe error: {e}")
        raise HTTPException(status_code=500, detail="Failed to connect to Kit.com")

@api_router.post("/kit/subscribe-form/{form_id}")
async def subscribe_to_form(form_id: int, subscriber: LeadMagnetSubscribe):
    """Subscribe an email to a specific form"""
    try:
        async with httpx.AsyncClient() as client:
            payload = {
                "api_key": KIT_API_KEY,
                "email": subscriber.email
            }
            if subscriber.first_name:
                payload["first_name"] = subscriber.first_name
            
            response = await client.post(
                f"{KIT_API_BASE}/forms/{form_id}/subscribe",
                json=payload
            )
            if response.status_code in [200, 201]:
                # Store in our database too
                now = datetime.now(timezone.utc)
                await db.lead_magnet_subscribers.insert_one({
                    "email": subscriber.email,
                    "first_name": subscriber.first_name,
                    "source": subscriber.source,
                    "kit_form_id": form_id,
                    "subscribed_at": now.isoformat()
                })
                return {"success": True, "message": "Subscribed successfully", "data": response.json()}
            raise HTTPException(status_code=response.status_code, detail="Failed to subscribe")
    except httpx.RequestError as e:
        logger.error(f"Kit subscribe form error: {e}")
        raise HTTPException(status_code=500, detail="Failed to connect to Kit.com")

@api_router.post("/lead-magnet/subscribe")
async def lead_magnet_subscribe(subscriber: LeadMagnetSubscribe):
    """Public endpoint for lead magnet signups - subscribes directly to Kit.com"""
    try:
        # First check if we already have this subscriber
        existing = await db.lead_magnet_subscribers.find_one({"email": subscriber.email}, {"_id": 0})
        if existing:
            return {"success": True, "message": "Already subscribed", "existing": True}
        
        # Try to subscribe via Kit.com API (using forms endpoint)
        # If no form ID configured, just store locally
        async with httpx.AsyncClient() as client:
            # First get available forms
            forms_response = await client.get(
                f"{KIT_API_BASE}/forms",
                params={"api_key": KIT_API_KEY}
            )
            
            kit_synced = False
            if forms_response.status_code == 200:
                forms = forms_response.json().get("forms", [])
                if forms:
                    # Subscribe to the first available form
                    form_id = forms[0]["id"]
                    subscribe_response = await client.post(
                        f"{KIT_API_BASE}/forms/{form_id}/subscribe",
                        json={
                            "api_key": KIT_API_KEY,
                            "email": subscriber.email,
                            "first_name": subscriber.first_name or ""
                        }
                    )
                    kit_synced = subscribe_response.status_code in [200, 201]
        
        # Store in our database
        now = datetime.now(timezone.utc)
        await db.lead_magnet_subscribers.insert_one({
            "email": subscriber.email,
            "first_name": subscriber.first_name,
            "source": subscriber.source,
            "kit_synced": kit_synced,
            "subscribed_at": now.isoformat()
        })
        
        return {
            "success": True,
            "message": "Subscribed successfully! Check your email for the guide.",
            "kit_synced": kit_synced
        }
    except Exception as e:
        logger.error(f"Lead magnet subscribe error: {e}")
        # Still try to save locally even if Kit fails
        try:
            now = datetime.now(timezone.utc)
            await db.lead_magnet_subscribers.insert_one({
                "email": subscriber.email,
                "first_name": subscriber.first_name,
                "source": subscriber.source,
                "kit_synced": False,
                "subscribed_at": now.isoformat()
            })
            return {"success": True, "message": "Subscribed successfully!", "kit_synced": False}
        except:
            raise HTTPException(status_code=500, detail="Failed to subscribe")

@api_router.get("/lead-magnet/subscribers")
async def get_lead_magnet_subscribers(current_user: dict = Depends(get_current_user)):
    """Get all lead magnet subscribers (admin only)"""
    subscribers = await db.lead_magnet_subscribers.find({}, {"_id": 0}).sort("subscribed_at", -1).to_list(1000)
    return {"subscribers": subscribers, "count": len(subscribers)}

@api_router.get("/kit/subscribers")
async def get_kit_subscribers():
    """List Kit.com subscribers"""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{KIT_API_BASE}/subscribers",
                params={"api_secret": KIT_API_SECRET}
            )
            if response.status_code == 200:
                return response.json()
            raise HTTPException(status_code=response.status_code, detail="Failed to fetch subscribers")
    except httpx.RequestError as e:
        logger.error(f"Kit subscribers error: {e}")
        raise HTTPException(status_code=500, detail="Failed to connect to Kit.com")

@api_router.get("/kit/broadcasts")
async def get_kit_broadcasts():
    """List all broadcasts"""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{KIT_API_BASE}/broadcasts",
                params={"api_secret": KIT_API_SECRET}
            )
            if response.status_code == 200:
                return response.json()
            raise HTTPException(status_code=response.status_code, detail="Failed to fetch broadcasts")
    except httpx.RequestError as e:
        logger.error(f"Kit broadcasts error: {e}")
        raise HTTPException(status_code=500, detail="Failed to connect to Kit.com")

@api_router.post("/kit/broadcasts")
async def create_kit_broadcast(broadcast: KitBroadcastCreate):
    """Create a broadcast in Kit.com"""
    try:
        async with httpx.AsyncClient() as client:
            payload = {
                "api_secret": KIT_API_SECRET,
                "subject": broadcast.subject,
                "content": broadcast.content
            }
            if broadcast.send_at:
                payload["send_at"] = broadcast.send_at
            
            response = await client.post(
                f"{KIT_API_BASE}/broadcasts",
                json=payload
            )
            if response.status_code in [200, 201]:
                return response.json()
            raise HTTPException(status_code=response.status_code, detail="Failed to create broadcast")
    except httpx.RequestError as e:
        logger.error(f"Kit broadcast error: {e}")
        raise HTTPException(status_code=500, detail="Failed to connect to Kit.com")

@api_router.post("/campaigns/{campaign_id}/send")
async def send_campaign_via_kit(campaign_id: str, current_user: dict = Depends(get_current_user)):
    """Send a campaign as a Kit.com broadcast or via Resend email"""
    campaign = await db.campaigns.find_one(
        {"campaign_id": campaign_id, "organization_id": current_user.get("organization_id")},
        {"_id": 0}
    )
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    
    recipients = campaign.get("recipients", [])
    
    # Try Kit.com first if API secret is configured
    if KIT_API_SECRET:
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{KIT_API_BASE}/broadcasts",
                    json={
                        "api_secret": KIT_API_SECRET,
                        "subject": campaign["subject"],
                        "content": campaign["content"]
                    }
                )
                if response.status_code in [200, 201]:
                    await db.campaigns.update_one(
                        {"campaign_id": campaign_id},
                        {"$set": {"status": "sent", "sent_at": datetime.now(timezone.utc).isoformat(), "sent_count": len(recipients)}}
                    )
                    return {"success": True, "message": "Campaign sent via Kit.com", "broadcast": response.json()}
                logger.error(f"Kit.com error: {response.status_code} - {response.text}")
        except Exception as e:
            logger.error(f"Kit send error: {e}")
    
    # Fallback: send via Resend email
    if RESEND_API_KEY and recipients:
        sent = 0
        for email_addr in recipients:
            try:
                resend.emails.send({
                    "from": SENDER_EMAIL,
                    "to": [email_addr],
                    "subject": campaign["subject"],
                    "html": campaign["content"]
                })
                sent += 1
            except Exception as e:
                logger.error(f"Resend send error for {email_addr}: {e}")
        
        await db.campaigns.update_one(
            {"campaign_id": campaign_id},
            {"$set": {"status": "sent", "sent_at": datetime.now(timezone.utc).isoformat(), "sent_count": sent}}
        )
        if sent > 0:
            return {"success": True, "message": f"Campaign sent via email to {sent}/{len(recipients)} recipients"}
        else:
            raise HTTPException(status_code=400, detail=f"Could not send to any of {len(recipients)} recipients. Email domain (earnrm.com) may need verification in Resend, or add your Kit.com API Secret for Kit.com delivery.")
    
    # Neither Kit nor Resend configured properly
    if not KIT_API_SECRET and not recipients:
        raise HTTPException(status_code=400, detail="No recipients added to this campaign. Add leads or contacts first.")
    if not KIT_API_SECRET:
        raise HTTPException(status_code=400, detail="Kit.com API Secret not configured. Go to your Kit.com account → Settings → API to get your secret key, then add it as KIT_API_SECRET in the backend configuration.")
    raise HTTPException(status_code=500, detail="Failed to send campaign. Check Kit.com and Resend configuration.")

# ==================== AI ROUTES ====================

@api_router.post("/ai/score-lead/{lead_id}")
async def score_lead(lead_id: str, current_user: dict = Depends(get_current_user)):
    lead = await db.leads.find_one(
        {"lead_id": lead_id, "organization_id": current_user.get("organization_id")},
        {"_id": 0}
    )
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    try:
        lead_info = f"""
        Name: {lead.get('first_name', '')} {lead.get('last_name', '')}
        Company: {lead.get('company', 'Unknown')}
        Job Title: {lead.get('job_title', 'Unknown')}
        Email: {lead.get('email', 'Not provided')}
        LinkedIn: {lead.get('linkedin_url', 'Not provided')}
        Source: {lead.get('source', 'Unknown')}
        """

        response = await tako_ai_text(
            "You are a lead scoring AI. Analyze lead data and return a score from 1-100 based on their potential value. Return ONLY a number.",
            f"Score this lead (return only a number 1-100):\n{lead_info}",
            user_email=current_user.get("email", ""), org_id=current_user.get("organization_id")
        )
        
        try:
            score = int(response.strip())
            score = max(1, min(100, score))
        except:
            score = 50
        
        await db.leads.update_one(
            {"lead_id": lead_id},
            {"$set": {"ai_score": score, "updated_at": datetime.now(timezone.utc).isoformat()}}
        )
        
        return {"lead_id": lead_id, "ai_score": score}
    except Exception as e:
        logger.error(f"AI scoring error: {e}")
        raise HTTPException(status_code=500, detail="AI scoring failed")

@api_router.post("/ai/enrich-lead/{lead_id}")
async def enrich_lead(lead_id: str, current_user: dict = Depends(get_current_user)):
    """AI-powered lead enrichment - fills in missing info about a lead"""
    lead = await db.leads.find_one(
        {"lead_id": lead_id, "organization_id": current_user.get("organization_id")},
        {"_id": 0}
    )
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")

    try:
        lead_info = f"""Lead to enrich:
- Name: {lead.get('first_name','')} {lead.get('last_name','')}
- Email: {lead.get('email','Not provided')}
- Company: {lead.get('company','Not provided')}
- Job Title: {lead.get('job_title','Not provided')}
- Phone: {lead.get('phone','Not provided')}
- LinkedIn: {lead.get('linkedin_url','Not provided')}
- Source: {lead.get('source','Unknown')}"""

        response = await tako_ai_text(
            """You are a B2B lead enrichment AI. Based on available lead info, generate realistic and plausible enrichment data. Return ONLY a JSON object with these fields (use null if you truly cannot infer):
- company_description: brief company description (1-2 sentences)
- industry: company industry
- company_size: estimated employee count range (e.g. "11-50", "51-200")
- website: likely company website URL
- job_title: refined job title if missing or vague
- linkedin_url: likely LinkedIn profile URL format
- phone: likely business phone format if missing
- location: likely city/country
- technologies: array of likely tech stack used
- interests: array of likely business interests
- recommended_approach: 1-2 sentence sales approach recommendation
Return ONLY valid JSON, no markdown.""",
            f"Enrich this lead:\n{lead_info}",
            user_email=current_user.get("email", ""), org_id=current_user.get("organization_id")
        )

        import json
        try:
            enrichment = json.loads(response.strip().strip('```json').strip('```'))
        except:
            enrichment = {"recommended_approach": response[:300]}

        # Build update dict - only update fields that are empty/missing
        updates = {"updated_at": datetime.now(timezone.utc).isoformat()}
        field_map = {
            "job_title": "job_title",
            "linkedin_url": "linkedin_url",
            "phone": "phone",
            "website": "website",
            "location": "location",
            "industry": "industry",
            "company_size": "company_size",
            "company_description": "company_description",
        }
        for ai_field, db_field in field_map.items():
            if enrichment.get(ai_field) and not lead.get(db_field):
                updates[db_field] = enrichment[ai_field]

        # Always store enrichment metadata
        updates["enrichment"] = {
            "technologies": enrichment.get("technologies", []),
            "interests": enrichment.get("interests", []),
            "recommended_approach": enrichment.get("recommended_approach", ""),
            "enriched_at": datetime.now(timezone.utc).isoformat()
        }

        await db.leads.update_one({"lead_id": lead_id}, {"$set": updates})

        updated_lead = await db.leads.find_one({"lead_id": lead_id}, {"_id": 0})
        return {"lead_id": lead_id, "enrichment": enrichment, "lead": updated_lead}

    except Exception as e:
        logger.error(f"Lead enrichment error: {e}")
        raise HTTPException(status_code=500, detail=f"Enrichment failed: {str(e)}")

@api_router.post("/ai/draft-email")
async def draft_email(
    lead_id: Optional[str] = None,
    purpose: str = "introduction",
    tone: str = "professional",
    custom_context: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """AI-powered email drafting with personalization"""
    lead_context = ""
    lead_name = "there"
    company_name = "your company"
    
    if lead_id:
        lead = await db.leads.find_one(
            {"lead_id": lead_id, "organization_id": current_user.get("organization_id")},
            {"_id": 0}
        )
        if lead:
            lead_name = lead.get('first_name', 'there')
            company_name = lead.get('company', 'your company')
            lead_context = f"""
            Recipient: {lead.get('first_name', '')} {lead.get('last_name', '')}
            Company: {lead.get('company', 'their company')}
            Job Title: {lead.get('job_title', '')}
            LinkedIn: {lead.get('linkedin_url', '')}
            Previous interactions: {lead.get('notes', 'None yet')}
            Lead Status: {lead.get('status', 'new')}
            """
    
    try:
        tone_instructions = {
            "professional": "Write in a professional, business-like tone.",
            "friendly": "Write in a warm, friendly but professional tone.",
            "casual": "Write in a casual, conversational tone while remaining professional.",
            "formal": "Write in a very formal, executive-level tone."
        }

        purpose_templates = {
            "introduction": "Introduce yourself and your company, focusing on how you can help them.",
            "follow_up": "Follow up on a previous conversation or meeting.",
            "proposal": "Present a business proposal or offer.",
            "check_in": "Check in and see how they're doing, offer assistance.",
            "meeting_request": "Request a meeting or call to discuss opportunities.",
            "thank_you": "Thank them for their time or business."
        }

        system_msg = f"""You are an expert B2B sales email writer for earnrm CRM.
{tone_instructions.get(tone, tone_instructions['professional'])}
Write concise, engaging emails that get responses. Keep emails under 150 words.
Always include a clear call-to-action. Personalize based on the recipient's context."""

        prompt = f"""{purpose_templates.get(purpose, purpose_templates['introduction'])}

Lead Context:{lead_context}

Sender: {current_user.get('name', 'Sales Team')} from earnrm
{f"Additional context: {custom_context}" if custom_context else ""}

Write the email now. Start with a compelling subject line on the first line, then the email body."""

        response = await tako_ai_text(system_msg, prompt, user_email=current_user.get("email", ""), org_id=current_user.get("organization_id"))
        
        # Parse subject from response
        lines = response.strip().split('\n')
        subject = lines[0].replace('Subject:', '').replace('Subject Line:', '').strip()
        if subject.startswith('"') and subject.endswith('"'):
            subject = subject[1:-1]
        content = '\n'.join(lines[1:]).strip()
        
        return {
            "subject": subject,
            "content": content,
            "lead_name": lead_name,
            "company_name": company_name,
            "purpose": purpose,
            "tone": tone
        }
    except Exception as e:
        logger.error(f"AI email draft error: {e}")
        raise HTTPException(status_code=500, detail=f"Email drafting failed: {str(e)}")


@api_router.post("/ai/lead-summary/{lead_id}")
async def generate_lead_summary(lead_id: str, current_user: dict = Depends(get_current_user)):
    """Generate an AI-powered summary of a lead's activity and profile"""
    
    # Get lead data
    lead = await db.leads.find_one(
        {"lead_id": lead_id, "organization_id": current_user.get("organization_id")},
        {"_id": 0}
    )
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    # Get related deals
    deals = await db.deals.find(
        {"lead_id": lead_id, "organization_id": current_user.get("organization_id")},
        {"_id": 0}
    ).to_list(100)
    
    # Get related tasks
    tasks = await db.tasks.find(
        {"related_lead_id": lead_id, "organization_id": current_user.get("organization_id")},
        {"_id": 0}
    ).to_list(100)
    
    try:
        context = f"""
LEAD PROFILE:
- Name: {lead.get('first_name', '')} {lead.get('last_name', '')}
- Email: {lead.get('email', 'N/A')}
- Company: {lead.get('company', 'N/A')}
- Job Title: {lead.get('job_title', 'N/A')}
- Status: {lead.get('status', 'new')}
- Source: {lead.get('source', 'Unknown')}
- AI Score: {lead.get('ai_score', 'Not scored')}
- Created: {lead.get('created_at', 'Unknown')}
- Tags: {', '.join(lead.get('tags', [])) or 'None'}
- Notes: {lead.get('notes', 'No notes')}

DEALS ({len(deals)} total):
{chr(10).join([f"- {d.get('name')}: €{d.get('value', 0):,.0f} ({d.get('stage')})" for d in deals]) or 'No deals yet'}

TASKS ({len(tasks)} total):
{chr(10).join([f"- {t.get('title')} ({t.get('status')})" for t in tasks[:5]]) or 'No tasks yet'}

Provide a comprehensive summary with:
1. **Overview** - Quick profile summary
2. **Engagement Assessment** - How engaged is this lead?
3. **Deal Potential** - Revenue opportunity
4. **Recommended Actions** - Top 3 next steps
5. **Risk Factors** - Any concerns to address
"""
        
        response = await tako_ai_text(
            """You are a CRM analytics assistant. Provide concise, actionable summaries.
Focus on: engagement level, deal potential, recommended next steps, and key insights.
Format your response with clear sections using markdown.""",
            context,
            user_email=current_user.get("email", ""), org_id=current_user.get("organization_id")
        )

        return {
            "lead_id": lead_id,
            "lead_name": f"{lead.get('first_name', '')} {lead.get('last_name', '')}",
            "summary": response,
            "deals_count": len(deals),
            "tasks_count": len(tasks),
            "total_deal_value": sum(d.get('value', 0) for d in deals),
            "generated_at": datetime.now(timezone.utc).isoformat()
        }
    except Exception as e:
        logger.error(f"AI lead summary error: {e}")
        raise HTTPException(status_code=500, detail=f"Summary generation failed: {str(e)}")


@api_router.post("/ai/smart-search")
async def smart_search(
    query: str,
    current_user: dict = Depends(get_current_user)
):
    """Natural language search across CRM data"""
    org_id = current_user.get("organization_id")
    if not org_id:
        raise HTTPException(status_code=400, detail="No organization")
    
    try:
        # First, use AI to understand the search intent
        intent_response = await tako_ai_text(
            """You are a search query analyzer for a CRM system.
Analyze the user's natural language query and extract:
1. entity_type: one of [leads, deals, tasks, companies, all]
2. filters: any specific criteria (status, value range, date, name, company, etc.)
3. keywords: important search terms

Respond ONLY with valid JSON in this format:
{"entity_type": "leads", "filters": {"status": "qualified"}, "keywords": ["enterprise", "tech"]}""",
            f"Query: {query}",
            user_email=current_user.get("email", ""), org_id=current_user.get("organization_id")
        )
        
        # Parse the intent
        import json
        try:
            # Clean the response - remove markdown code blocks if present
            clean_response = intent_response.strip()
            if clean_response.startswith('```'):
                clean_response = clean_response.split('\n', 1)[1]
            if clean_response.endswith('```'):
                clean_response = clean_response.rsplit('\n', 1)[0]
            clean_response = clean_response.replace('```json', '').replace('```', '').strip()
            intent = json.loads(clean_response)
        except:
            intent = {"entity_type": "all", "filters": {}, "keywords": query.split()}
        
        results = {
            "query": query,
            "intent": intent,
            "leads": [],
            "deals": [],
            "tasks": [],
            "companies": []
        }
        
        keywords = intent.get("keywords", query.split())
        entity_type = intent.get("entity_type", "all")
        
        # Build regex pattern for keyword search
        keyword_pattern = "|".join([re.escape(k) for k in keywords]) if keywords else query
        
        # Search leads
        if entity_type in ["leads", "all"]:
            lead_query = {
                "organization_id": org_id,
                "$or": [
                    {"first_name": {"$regex": keyword_pattern, "$options": "i"}},
                    {"last_name": {"$regex": keyword_pattern, "$options": "i"}},
                    {"email": {"$regex": keyword_pattern, "$options": "i"}},
                    {"company": {"$regex": keyword_pattern, "$options": "i"}},
                    {"notes": {"$regex": keyword_pattern, "$options": "i"}},
                    {"job_title": {"$regex": keyword_pattern, "$options": "i"}}
                ]
            }
            # Add status filter if specified
            if intent.get("filters", {}).get("status"):
                lead_query["status"] = intent["filters"]["status"]
            
            leads = await db.leads.find(lead_query, {"_id": 0}).limit(10).to_list(10)
            results["leads"] = leads
        
        # Search deals
        if entity_type in ["deals", "all"]:
            deal_query = {
                "organization_id": org_id,
                "$or": [
                    {"name": {"$regex": keyword_pattern, "$options": "i"}},
                    {"notes": {"$regex": keyword_pattern, "$options": "i"}}
                ]
            }
            if intent.get("filters", {}).get("stage"):
                deal_query["stage"] = intent["filters"]["stage"]
            
            deals = await db.deals.find(deal_query, {"_id": 0}).limit(10).to_list(10)
            results["deals"] = deals
        
        # Search tasks
        if entity_type in ["tasks", "all"]:
            task_query = {
                "organization_id": org_id,
                "$or": [
                    {"title": {"$regex": keyword_pattern, "$options": "i"}},
                    {"description": {"$regex": keyword_pattern, "$options": "i"}}
                ]
            }
            if intent.get("filters", {}).get("status"):
                task_query["status"] = intent["filters"]["status"]
            
            tasks = await db.tasks.find(task_query, {"_id": 0}).limit(10).to_list(10)
            results["tasks"] = tasks
        
        # Search companies
        if entity_type in ["companies", "all"]:
            company_query = {
                "organization_id": org_id,
                "$or": [
                    {"name": {"$regex": keyword_pattern, "$options": "i"}},
                    {"industry": {"$regex": keyword_pattern, "$options": "i"}},
                    {"notes": {"$regex": keyword_pattern, "$options": "i"}}
                ]
            }
            companies = await db.companies.find(company_query, {"_id": 0}).limit(10).to_list(10)
            results["companies"] = companies
        
        # Generate AI summary of results
        total_results = len(results["leads"]) + len(results["deals"]) + len(results["tasks"]) + len(results["companies"])
        
        if total_results > 0:
            summary_prompt = f"""Search query: "{query}"
Found: {len(results['leads'])} leads, {len(results['deals'])} deals, {len(results['tasks'])} tasks, {len(results['companies'])} companies.
Top results: {[l.get('first_name', '') + ' ' + l.get('last_name', '') for l in results['leads'][:3]]}
Summarize what was found."""

            summary = await tako_ai_text(
                "Provide a brief, helpful summary of search results. Be concise (2-3 sentences max).",
                summary_prompt,
                user_email=current_user.get("email", ""), org_id=current_user.get("organization_id")
            )
            results["ai_summary"] = summary
        else:
            results["ai_summary"] = f"No results found for '{query}'. Try broader search terms or check spelling."
        
        results["total_count"] = total_results
        return results
        
    except Exception as e:
        logger.error(f"Smart search error: {e}")
        # Fallback to basic search
        return {
            "query": query,
            "error": str(e),
            "leads": [],
            "deals": [],
            "tasks": [],
            "companies": [],
            "ai_summary": "AI search unavailable. Please try a basic search.",
            "total_count": 0
        }


# ==================== PAYMENT ROUTES ====================

PRICING = {
    "monthly": {"price": 15.0, "discount": 0},
    "yearly": {"price": 15.0, "discount": 0.20},
    "crypto_monthly": {"price": 15.0, "discount": 0.05},
    "crypto_yearly": {"price": 15.0, "discount": 0.25}
}

@api_router.post("/payments/checkout/stripe")
async def create_stripe_checkout(
    request: Request,
    billing_cycle: str = "monthly",
    additional_users: int = 1,
    current_user: dict = Depends(get_current_user)
):
    body = await request.json()
    origin_url = body.get("origin_url", "")
    
    pricing = PRICING.get(billing_cycle, PRICING["monthly"])
    amount = additional_users * pricing["price"] * (1 - pricing["discount"])
    if billing_cycle in ["yearly", "crypto_yearly"]:
        amount = amount * 12
    
    api_key = os.environ.get("STRIPE_API_KEY")
    host_url = str(request.base_url).rstrip("/")
    webhook_url = f"{host_url}/api/webhook/stripe"
    
    stripe_checkout = StripeCheckout(api_key=api_key, webhook_url=webhook_url)
    
    success_url = f"{origin_url}/dashboard?payment=success&session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{origin_url}/settings?payment=cancelled"
    
    payment_methods = ["card"]
    currency = "eur"
    if "crypto" in billing_cycle:
        payment_methods = ["card", "crypto"]
        currency = "usd"
        amount = amount * 1.1
    
    checkout_request = CheckoutSessionRequest(
        amount=round(amount, 2),
        currency=currency,
        success_url=success_url,
        cancel_url=cancel_url,
        metadata={
            "user_id": current_user["user_id"],
            "organization_id": current_user.get("organization_id", ""),
            "billing_cycle": billing_cycle,
            "additional_users": str(additional_users)
        },
        payment_methods=payment_methods
    )
    
    session = await stripe_checkout.create_checkout_session(checkout_request)
    
    # Record transaction
    transaction_doc = {
        "transaction_id": f"txn_{uuid.uuid4().hex[:12]}",
        "organization_id": current_user.get("organization_id"),
        "user_id": current_user["user_id"],
        "amount": round(amount, 2),
        "currency": currency,
        "status": "pending",
        "payment_method": "stripe",
        "session_id": session.session_id,
        "metadata": checkout_request.metadata,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.payment_transactions.insert_one(transaction_doc)
    
    return {"url": session.url, "session_id": session.session_id}

@api_router.get("/payments/status/{session_id}")
async def get_payment_status(session_id: str, current_user: dict = Depends(get_current_user)):
    api_key = os.environ.get("STRIPE_API_KEY")
    stripe_checkout = StripeCheckout(api_key=api_key, webhook_url="")
    
    status = await stripe_checkout.get_checkout_status(session_id)
    
    # Update transaction
    if status.payment_status == "paid":
        await db.payment_transactions.update_one(
            {"session_id": session_id},
            {"$set": {"status": "completed", "payment_status": status.payment_status}}
        )
        
        # Get transaction metadata
        txn = await db.payment_transactions.find_one({"session_id": session_id}, {"_id": 0})
        if txn and txn.get("metadata"):
            org_id = txn["metadata"].get("organization_id")
            additional_users = int(txn["metadata"].get("additional_users", 1))
            billing_cycle = txn["metadata"].get("billing_cycle", "monthly")
            
            if org_id:
                await db.organizations.update_one(
                    {"organization_id": org_id},
                    {
                        "$inc": {"user_count": additional_users},
                        "$set": {
                            "plan": "paid",
                            "billing_cycle": billing_cycle
                        }
                    }
                )
    
    return {
        "status": status.status,
        "payment_status": status.payment_status,
        "amount": status.amount_total / 100,
        "currency": status.currency
    }


@api_router.post("/checkout/launch-edition")
async def launch_edition_checkout(request: Request):
    """Public checkout for Launch Edition (4999 EUR one-time)"""
    body = await request.json()
    origin_url = body.get("origin_url", "")
    buyer_name = body.get("name", "")
    buyer_email = body.get("email", "")
    api_key = os.environ.get("STRIPE_API_KEY")
    host_url = str(request.base_url).rstrip("/")
    webhook_url = f"{host_url}/api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=api_key, webhook_url=webhook_url)
    deal_id = f"deal_{uuid.uuid4().hex[:12]}"
    success_url = f"{origin_url}/?launch=success&session_id={{CHECKOUT_SESSION_ID}}&deal_id={deal_id}"
    cancel_url = f"{origin_url}/?launch=cancelled&deal_id={deal_id}"
    checkout_request = CheckoutSessionRequest(
        amount=4999.00, currency="eur", success_url=success_url, cancel_url=cancel_url,
        metadata={"product": "launch_edition", "deal_id": deal_id, "buyer_name": buyer_name, "buyer_email": buyer_email},
        payment_methods=["card"]
    )
    session = await stripe_checkout.create_checkout_session(checkout_request)
    now = datetime.now(timezone.utc)
    super_admin = await db.users.find_one({"email": SUPER_ADMIN_EMAIL}, {"_id": 0})
    org_id = super_admin.get("organization_id") if super_admin else None
    admin_uid = super_admin.get("user_id") if super_admin else None
    await db.deals.insert_one({
        "deal_id": deal_id, "organization_id": org_id,
        "name": f"Launch Edition: {buyer_name or buyer_email or 'Website'}", "value": 4999.0, "currency": "EUR",
        "stage": "negotiation", "probability": 60, "tags": ["launch-edition", "one-time"],
        "notes": f"Buyer: {buyer_name} ({buyer_email}). Checkout initiated.",
        "assigned_to": admin_uid, "created_by": admin_uid, "created_at": now.isoformat(), "updated_at": now.isoformat()
    })
    if buyer_email and org_id:
        name_parts = buyer_name.split(" ", 1) if buyer_name else [buyer_email.split("@")[0], ""]
        await db.leads.insert_one({
            "lead_id": f"lead_{uuid.uuid4().hex[:12]}", "organization_id": org_id,
            "first_name": name_parts[0], "last_name": name_parts[1] if len(name_parts) > 1 else "",
            "email": buyer_email, "source": "launch_edition", "status": "qualified",
            "notes": "Initiated Launch Edition checkout (EUR 4,999)", "ai_score": None,
            "assigned_to": admin_uid, "created_by": admin_uid, "created_at": now.isoformat(), "updated_at": now.isoformat()
        })
    await db.payment_transactions.insert_one({
        "transaction_id": f"txn_{uuid.uuid4().hex[:12]}", "deal_id": deal_id, "session_id": session.session_id,
        "product": "launch_edition", "amount": 4999.0, "currency": "eur", "status": "pending",
        "buyer_name": buyer_name, "buyer_email": buyer_email, "created_at": now.isoformat()
    })
    return {"checkout_url": session.url, "session_id": session.session_id, "deal_id": deal_id}

@api_router.get("/checkout/launch-edition/verify")
async def verify_launch_edition(session_id: str, deal_id: str):
    """Verify Launch Edition payment and update deal to won"""
    api_key = os.environ.get("STRIPE_API_KEY")
    stripe_checkout = StripeCheckout(api_key=api_key, webhook_url="")
    try:
        status = await stripe_checkout.get_checkout_status(session_id)
        if status.payment_status == "paid":
            now = datetime.now(timezone.utc)
            await db.deals.update_one({"deal_id": deal_id}, {"$set": {"stage": "won", "probability": 100, "updated_at": now.isoformat()}})
            await db.payment_transactions.update_one({"deal_id": deal_id}, {"$set": {"status": "completed", "payment_status": "paid"}})
            super_admin = await db.users.find_one({"email": SUPER_ADMIN_EMAIL}, {"_id": 0})
            admin_uid = super_admin.get("user_id") if super_admin else None
            org_id = super_admin.get("organization_id") if super_admin else None
            await db.tasks.insert_one({
                "task_id": f"task_{uuid.uuid4().hex[:12]}", "organization_id": org_id,
                "title": f"Deliver Launch Edition: {deal_id}", "description": "Launch Edition purchased. Deliver self-hosted CRM package, setup call, deployment guide, and handover.",
                "status": "todo", "priority": "high", "assigned_to": admin_uid, "related_deal_id": deal_id,
                "created_by": admin_uid, "created_at": now.isoformat(), "updated_at": now.isoformat()
            })
            return {"status": "paid", "deal_id": deal_id, "message": "Payment confirmed. Delivery task created."}
        return {"status": status.payment_status, "deal_id": deal_id}
    except Exception as e:
        logger.error(f"Launch edition verify error: {e}")
        return {"status": "error", "detail": str(e)}

@api_router.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    api_key = os.environ.get("STRIPE_API_KEY")
    stripe_checkout = StripeCheckout(api_key=api_key, webhook_url="")

UNYT_CONTRACT = "0x5305bF91163D97D0d93188611433F86D1bb69898"
UNYT_RECEIVER = "0xFf98458bEBA08e0a8967D45Ce216D9Ee5fdecD1A"
UNYT_PRICE_EUR = 0.50
UNYT_DECIMALS = 18

@api_router.post("/checkout/launch-edition/unyt")
async def launch_edition_unyt(request: Request):
    """Create a UNYT payment order for the Launch Edition"""
    body = await request.json()
    buyer_name = body.get("name", "")
    buyer_email = body.get("email", "")
    buyer_wallet = body.get("wallet", "")
    
    deal_id = f"deal_{uuid.uuid4().hex[:12]}"
    now = datetime.now(timezone.utc)
    amount_eur = 4999.0
    unyt_amount = amount_eur / UNYT_PRICE_EUR  # 9998 UNYT
    
    super_admin = await db.users.find_one({"email": SUPER_ADMIN_EMAIL}, {"_id": 0})
    org_id = super_admin.get("organization_id") if super_admin else None
    admin_uid = super_admin.get("user_id") if super_admin else None
    
    # Create deal as open opportunity
    await db.deals.insert_one({
        "deal_id": deal_id, "organization_id": org_id,
        "name": f"Launch Edition (UNYT): {buyer_name or buyer_email or buyer_wallet[:10]}",
        "value": amount_eur, "currency": "EUR", "stage": "negotiation", "probability": 60,
        "tags": ["launch-edition", "unyt-payment"],
        "notes": f"Buyer: {buyer_name} ({buyer_email}). Wallet: {buyer_wallet}. UNYT payment: {unyt_amount:.0f} UNYT.",
        "assigned_to": admin_uid, "created_by": admin_uid, "created_at": now.isoformat(), "updated_at": now.isoformat()
    })
    
    if buyer_email and org_id:
        name_parts = buyer_name.split(" ", 1) if buyer_name else [buyer_email.split("@")[0], ""]
        await db.leads.insert_one({
            "lead_id": f"lead_{uuid.uuid4().hex[:12]}", "organization_id": org_id,
            "first_name": name_parts[0], "last_name": name_parts[1] if len(name_parts) > 1 else "",
            "email": buyer_email, "source": "launch_edition_unyt", "status": "qualified",
            "notes": f"UNYT payment initiated. Wallet: {buyer_wallet}", "ai_score": None,
            "assigned_to": admin_uid, "created_by": admin_uid, "created_at": now.isoformat(), "updated_at": now.isoformat()
        })
    
    await db.payment_transactions.insert_one({
        "transaction_id": f"txn_{uuid.uuid4().hex[:12]}", "deal_id": deal_id,
        "product": "launch_edition", "amount": amount_eur, "currency": "eur",
        "payment_method": "unyt", "unyt_amount": unyt_amount,
        "buyer_wallet": buyer_wallet, "buyer_name": buyer_name, "buyer_email": buyer_email,
        "status": "pending", "created_at": now.isoformat()
    })
    
    return {
        "deal_id": deal_id,
        "unyt_amount": unyt_amount,
        "unyt_amount_wei": str(int(unyt_amount * (10 ** UNYT_DECIMALS))),
        "receiver": UNYT_RECEIVER,
        "contract": UNYT_CONTRACT,
        "chain_id": 42161,
        "price_per_unyt_eur": UNYT_PRICE_EUR,
        "total_eur": amount_eur
    }

@api_router.post("/checkout/launch-edition/unyt/confirm")
async def confirm_unyt_payment(deal_id: str, tx_hash: str):
    """Confirm UNYT payment after transaction is sent"""
    now = datetime.now(timezone.utc)
    
    await db.payment_transactions.update_one(
        {"deal_id": deal_id, "payment_method": "unyt"},
        {"$set": {"status": "submitted", "tx_hash": tx_hash, "submitted_at": now.isoformat()}}
    )
    
    # Update deal to won
    await db.deals.update_one({"deal_id": deal_id}, {"$set": {"stage": "won", "probability": 100, "updated_at": now.isoformat(), "notes_extra": f"UNYT tx: {tx_hash}"}})
    
    # Create delivery task
    super_admin = await db.users.find_one({"email": SUPER_ADMIN_EMAIL}, {"_id": 0})
    admin_uid = super_admin.get("user_id") if super_admin else None
    org_id = super_admin.get("organization_id") if super_admin else None
    
    await db.tasks.insert_one({
        "task_id": f"task_{uuid.uuid4().hex[:12]}", "organization_id": org_id,
        "title": f"Deliver Launch Edition (UNYT): {deal_id}",
        "description": f"UNYT payment received. TX: {tx_hash}. Verify on Arbiscan, then deliver self-hosted CRM package.",
        "status": "todo", "priority": "high", "assigned_to": admin_uid, "related_deal_id": deal_id,
        "subtasks": [], "comments": [], "activity": [{"action": "created", "by": admin_uid or "", "by_name": "System", "at": now.isoformat()}],
        "created_by": admin_uid, "created_at": now.isoformat(), "updated_at": now.isoformat()
    })
    
    return {"status": "submitted", "deal_id": deal_id, "tx_hash": tx_hash, "message": "Payment submitted. Delivery task created."}


    
    body = await request.body()
    signature = request.headers.get("Stripe-Signature")
    
    try:
        webhook_response = await stripe_checkout.handle_webhook(body, signature)
        
        if webhook_response.payment_status == "paid":
            await db.payment_transactions.update_one(
                {"session_id": webhook_response.session_id},
                {"$set": {"status": "completed", "payment_status": "paid"}}
            )
        
        return {"received": True}
    except Exception as e:
        logger.error(f"Webhook error: {e}")
        return {"received": False, "error": str(e)}

# ==================== DASHBOARD STATS ====================

@api_router.get("/dashboard/stats")
async def get_dashboard_stats(current_user: dict = Depends(get_current_user)):
    if not current_user.get("organization_id"):
        org_id = await ensure_user_org(current_user)
        current_user["organization_id"] = org_id
    
    org_id = current_user["organization_id"]
    
    total_leads = await db.leads.count_documents({"organization_id": org_id})
    total_deals = await db.deals.count_documents({"organization_id": org_id})
    total_tasks = await db.tasks.count_documents({"organization_id": org_id})
    
    pipeline = [
        {"$match": {"organization_id": org_id, "stage": {"$ne": "lost"}}},
        {"$group": {"_id": None, "total": {"$sum": "$value"}}}
    ]
    deal_value_result = await db.deals.aggregate(pipeline).to_list(1)
    deal_value = deal_value_result[0]["total"] if deal_value_result else 0
    
    recent_leads = await db.leads.find(
        {"organization_id": org_id},
        {"_id": 0}
    ).sort("created_at", -1).limit(5).to_list(5)
    
    recent_tasks = await db.tasks.find(
        {"organization_id": org_id},
        {"_id": 0}
    ).sort("created_at", -1).limit(5).to_list(5)
    
    return {
        "total_leads": total_leads,
        "total_deals": total_deals,
        "total_tasks": total_tasks,
        "deal_value": deal_value,
        "recent_leads": recent_leads,
        "recent_tasks": recent_tasks
    }

# ==================== ADMIN ROUTES ====================

@api_router.get("/admin/organizations")
async def admin_get_all_organizations(current_user: dict = Depends(get_current_user)):
    # Super admin check
    if current_user.get("role") != "super_admin" and current_user.get("email") != SUPER_ADMIN_EMAIL:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    organizations = await db.organizations.find({}, {"_id": 0}).to_list(1000)
    return organizations

@api_router.get("/admin/stats")
async def admin_get_stats(current_user: dict = Depends(get_current_user)):
    if current_user.get("role") != "super_admin" and current_user.get("email") != SUPER_ADMIN_EMAIL:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    total_users = await db.users.count_documents({})
    total_orgs = await db.organizations.count_documents({})
    total_leads = await db.leads.count_documents({})
    total_deals = await db.deals.count_documents({})
    total_affiliates = await db.affiliates.count_documents({})
    total_discount_codes = await db.discount_codes.count_documents({})
    
    # Revenue calculation
    pipeline = [
        {"$match": {"status": "completed"}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
    ]
    revenue_result = await db.payment_transactions.aggregate(pipeline).to_list(1)
    total_revenue = revenue_result[0]["total"] if revenue_result else 0
    
    # Affiliate earnings
    affiliate_pipeline = [
        {"$group": {"_id": None, "total": {"$sum": "$total_earnings"}}}
    ]
    affiliate_result = await db.affiliates.aggregate(affiliate_pipeline).to_list(1)
    total_affiliate_earnings = affiliate_result[0]["total"] if affiliate_result else 0
    
    return {
        "total_users": total_users,
        "total_organizations": total_orgs,
        "total_leads": total_leads,
        "total_deals": total_deals,
        "total_revenue": total_revenue,
        "total_affiliates": total_affiliates,
        "total_discount_codes": total_discount_codes,
        "total_affiliate_earnings": total_affiliate_earnings
    }

@api_router.get("/admin/users")
async def admin_get_all_users(current_user: dict = Depends(get_current_user)):
    """Get all users (super admin only)"""
    if current_user.get("role") != "super_admin" and current_user.get("email") != SUPER_ADMIN_EMAIL:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    users = await db.users.find({}, {"_id": 0, "password_hash": 0}).to_list(1000)
    return {"users": users, "count": len(users)}

@api_router.put("/admin/users/{user_id}/role")
async def admin_update_user_role(user_id: str, role: str, current_user: dict = Depends(get_current_user)):
    """Update a user's role (super admin only)"""
    if current_user.get("role") != "super_admin" and current_user.get("email") != SUPER_ADMIN_EMAIL:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    valid_roles = ["member", "admin", "owner", "deputy_admin", "support", "super_admin"]
    if role not in valid_roles:
        raise HTTPException(status_code=400, detail=f"Invalid role. Must be one of: {valid_roles}")
    
    result = await db.users.update_one(
        {"user_id": user_id},
        {"$set": {"role": role}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {"message": f"User role updated to {role}"}

@api_router.delete("/admin/users/{user_id}")
async def admin_delete_user(user_id: str, current_user: dict = Depends(require_super_admin)):
    """Delete a user (super admin only)"""
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.get("email") == SUPER_ADMIN_EMAIL:
        raise HTTPException(status_code=400, detail="Cannot delete the super admin")
    await db.users.delete_one({"user_id": user_id})
    await db.user_sessions.delete_many({"user_id": user_id})
    return {"message": "User deleted"}

@api_router.delete("/admin/organizations/{org_id}")
async def admin_delete_organization(org_id: str, current_user: dict = Depends(require_super_admin)):
    """Delete an organization and unlink all its users"""
    org = await db.organizations.find_one({"organization_id": org_id}, {"_id": 0})
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    await db.organizations.delete_one({"organization_id": org_id})
    await db.users.update_many({"organization_id": org_id}, {"$set": {"organization_id": None, "role": "member"}})
    return {"message": "Organization deleted"}

@api_router.put("/admin/organizations/{org_id}")
async def admin_update_organization(org_id: str, updates: dict, current_user: dict = Depends(require_super_admin)):
    """Edit organization details and license limits"""
    allowed = {"name", "plan", "max_users", "max_free_users", "email_domain"}
    filtered = {k: v for k, v in updates.items() if k in allowed}
    if not filtered:
        raise HTTPException(status_code=400, detail="No valid fields to update")
    result = await db.organizations.update_one({"organization_id": org_id}, {"$set": filtered})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Organization not found")
    updated = await db.organizations.find_one({"organization_id": org_id}, {"_id": 0})
    return updated

# ==================== ADMIN USER MANAGEMENT ====================

class AdminCreateUser(BaseModel):
    email: str
    name: str
    password: str
    role: str = "member"
    organization_id: Optional[str] = None

class AdminResetPassword(BaseModel):
    new_password: str

@api_router.post("/admin/users/create")
async def admin_create_user(data: AdminCreateUser, current_user: dict = Depends(require_super_admin)):
    """Create a user directly without signup flow"""
    existing = await db.users.find_one({"email": data.email}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user_id = f"user_{uuid.uuid4().hex[:12]}"
    now = datetime.now(timezone.utc)
    
    user_doc = {
        "user_id": user_id,
        "email": data.email,
        "name": data.name,
        "password_hash": hash_password(data.password),
        "organization_id": data.organization_id,
        "role": data.role,
        "created_at": now.isoformat(),
        "created_by_admin": current_user["user_id"]
    }
    await db.users.insert_one(user_doc)
    
    if data.organization_id:
        await db.organizations.update_one({"organization_id": data.organization_id}, {"$inc": {"user_count": 1}})
    
    return {"user_id": user_id, "email": data.email, "name": data.name, "role": data.role, "message": "User created"}

@api_router.put("/admin/users/{user_id}/password")
async def admin_reset_password(user_id: str, data: AdminResetPassword, current_user: dict = Depends(require_super_admin)):
    """Reset a user's password"""
    result = await db.users.update_one({"user_id": user_id}, {"$set": {"password_hash": hash_password(data.new_password)}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    return {"message": "Password reset successfully"}

# ==================== REPORTING ENGINE ====================

@api_router.get("/admin/reports/overview")
async def report_overview(current_user: dict = Depends(require_super_admin)):
    """Platform overview report"""
    total_users = await db.users.count_documents({})
    total_orgs = await db.organizations.count_documents({})
    total_leads = await db.leads.count_documents({})
    total_contacts = await db.contacts.count_documents({})
    total_deals = await db.deals.count_documents({})
    total_tasks = await db.tasks.count_documents({})
    
    deals_won = await db.deals.count_documents({"stage": "won"})
    deals_lost = await db.deals.count_documents({"stage": "lost"})
    
    pipeline_agg = await db.deals.aggregate([
        {"$match": {"stage": {"$ne": "lost"}}},
        {"$group": {"_id": None, "total": {"$sum": "$value"}}}
    ]).to_list(1)
    pipeline_value = pipeline_agg[0]["total"] if pipeline_agg else 0
    
    won_agg = await db.deals.aggregate([
        {"$match": {"stage": "won"}},
        {"$group": {"_id": None, "total": {"$sum": "$value"}}}
    ]).to_list(1)
    won_revenue = won_agg[0]["total"] if won_agg else 0
    
    return {
        "total_users": total_users, "total_orgs": total_orgs,
        "total_leads": total_leads, "total_contacts": total_contacts,
        "total_deals": total_deals, "total_tasks": total_tasks,
        "deals_won": deals_won, "deals_lost": deals_lost,
        "pipeline_value": pipeline_value, "won_revenue": won_revenue,
        "win_rate": round(deals_won / max(deals_won + deals_lost, 1) * 100, 1)
    }

@api_router.get("/admin/reports/user-performance")
async def report_user_performance(current_user: dict = Depends(require_super_admin)):
    """Performance report per user"""
    users = await db.users.find({}, {"_id": 0, "password_hash": 0}).to_list(500)
    
    performance = []
    for u in users:
        uid = u["user_id"]
        leads_created = await db.leads.count_documents({"created_by": uid})
        deals_created = await db.deals.count_documents({"created_by": uid})
        deals_won_count = await db.deals.count_documents({"created_by": uid, "stage": "won"})
        tasks_done = await db.tasks.count_documents({"assigned_to": uid, "status": "done"})
        tasks_total = await db.tasks.count_documents({"assigned_to": uid})
        
        won_val = await db.deals.aggregate([
            {"$match": {"created_by": uid, "stage": "won"}},
            {"$group": {"_id": None, "total": {"$sum": "$value"}}}
        ]).to_list(1)
        
        performance.append({
            "user_id": uid,
            "name": u.get("name", ""),
            "email": u.get("email", ""),
            "role": u.get("role", "member"),
            "last_login": u.get("last_login"),
            "leads_created": leads_created,
            "deals_created": deals_created,
            "deals_won": deals_won_count,
            "revenue_won": won_val[0]["total"] if won_val else 0,
            "tasks_completed": tasks_done,
            "tasks_total": tasks_total,
            "task_completion_rate": round(tasks_done / max(tasks_total, 1) * 100, 1)
        })
    
    return sorted(performance, key=lambda x: x["revenue_won"], reverse=True)

@api_router.get("/admin/reports/pipeline-forecast")
async def report_pipeline_forecast(current_user: dict = Depends(require_super_admin)):
    """Pipeline forecast by stage, user, and tags"""
    deals = await db.deals.find({"stage": {"$ne": "lost"}}, {"_id": 0}).to_list(5000)
    
    # By stage
    by_stage = {}
    for d in deals:
        stage = d.get("stage", "unknown")
        if stage not in by_stage:
            by_stage[stage] = {"count": 0, "value": 0, "weighted": 0}
        by_stage[stage]["count"] += 1
        by_stage[stage]["value"] += d.get("value", 0)
        by_stage[stage]["weighted"] += d.get("value", 0) * (d.get("probability", 0) / 100)
    
    # By user
    by_user = {}
    for d in deals:
        uid = d.get("created_by", "unknown")
        if uid not in by_user:
            user = await db.users.find_one({"user_id": uid}, {"_id": 0, "password_hash": 0})
            by_user[uid] = {"name": user.get("name", "Unknown") if user else "Unknown", "count": 0, "value": 0, "weighted": 0}
        by_user[uid]["count"] += 1
        by_user[uid]["value"] += d.get("value", 0)
        by_user[uid]["weighted"] += d.get("value", 0) * (d.get("probability", 0) / 100)
    
    # By tag (as proxy for product/market)
    by_tag = {}
    for d in deals:
        for tag in d.get("tags", []):
            if tag not in by_tag:
                by_tag[tag] = {"count": 0, "value": 0, "weighted": 0}
            by_tag[tag]["count"] += 1
            by_tag[tag]["value"] += d.get("value", 0)
            by_tag[tag]["weighted"] += d.get("value", 0) * (d.get("probability", 0) / 100)
    
    return {"by_stage": by_stage, "by_user": by_user, "by_tag": by_tag, "total_deals": len(deals)}

@api_router.get("/admin/reports/activity-log")
async def report_activity_log(days: int = 30, current_user: dict = Depends(require_super_admin)):
    """Recent activity across the platform"""
    since = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    
    recent_leads = await db.leads.count_documents({"created_at": {"$gte": since}})
    recent_contacts = await db.contacts.count_documents({"created_at": {"$gte": since}})
    recent_deals = await db.deals.count_documents({"created_at": {"$gte": since}})
    recent_tasks = await db.tasks.count_documents({"created_at": {"$gte": since}})
    recent_calls = await db.calls.count_documents({"created_at": {"$gte": since}})
    recent_bookings = await db.bookings.count_documents({"created_at": {"$gte": since}})
    recent_signups = await db.users.count_documents({"created_at": {"$gte": since}})
    
    # Login activity
    recent_logins = await db.users.find({"last_login": {"$gte": since}}, {"_id": 0, "password_hash": 0}).to_list(500)
    active_users = len(recent_logins)
    
    return {
        "period_days": days,
        "new_leads": recent_leads, "new_contacts": recent_contacts,
        "new_deals": recent_deals, "new_tasks": recent_tasks,
        "calls_made": recent_calls, "meetings_booked": recent_bookings,
        "new_signups": recent_signups, "active_users": active_users,
        "recent_logins": [{"name": u.get("name"), "email": u.get("email"), "last_login": u.get("last_login")} for u in recent_logins[:20]]
    }

@api_router.get("/admin/reports/export/{entity}")
async def export_report_csv(entity: str, current_user: dict = Depends(require_super_admin)):
    """Export data as CSV"""
    collections = {"leads": db.leads, "contacts": db.contacts, "deals": db.deals, "tasks": db.tasks, "users": db.users, "companies": db.companies}
    if entity not in collections:
        raise HTTPException(status_code=400, detail=f"Invalid entity. Options: {', '.join(collections.keys())}")
    
    projection = {"_id": 0}
    if entity == "users":
        projection["password_hash"] = 0
    
    docs = await collections[entity].find({}, projection).to_list(10000)
    if not docs:
        return Response(content="No data", media_type="text/csv")
    
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=docs[0].keys(), extrasaction='ignore')
    writer.writeheader()
    for d in docs:
        row = {}
        for k, v in d.items():
            row[k] = str(v) if isinstance(v, (dict, list)) else v
        writer.writerow(row)
    
    return Response(content=output.getvalue(), media_type="text/csv", headers={"Content-Disposition": f"attachment; filename=earnrm_{entity}_{datetime.now().strftime('%Y%m%d')}.csv"})

# ==================== SUPER ADMIN SETUP ====================

@api_router.post("/admin/setup-super-admin")
async def setup_super_admin(data: SuperAdminCreate):
    """Set up or reset super admin password"""
    if data.email != SUPER_ADMIN_EMAIL:
        raise HTTPException(status_code=403, detail="Only the designated super admin email can use this endpoint")
    
    now = datetime.now(timezone.utc)
    
    # Check if user exists
    existing = await db.users.find_one({"email": data.email}, {"_id": 0})
    if existing:
        # Update password
        await db.users.update_one(
            {"email": data.email},
            {"$set": {
                "password_hash": hash_password(data.password),
                "name": data.name,
                "role": "super_admin"
            }}
        )
        user_id = existing["user_id"]
    else:
        # Create new super admin
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        user_doc = {
            "user_id": user_id,
            "email": data.email,
            "name": data.name,
            "password_hash": hash_password(data.password),
            "organization_id": None,
            "role": "super_admin",
            "created_at": now.isoformat()
        }
        await db.users.insert_one(user_doc)
    
    token = create_jwt_token(user_id, data.email, None)
    
    return {
        "message": "Super admin account configured successfully",
        "user_id": user_id,
        "email": data.email,
        "token": token
    }

# ==================== DISCOUNT CODE ROUTES ====================

@api_router.get("/admin/discount-codes")
async def get_discount_codes(current_user: dict = Depends(require_super_admin)):
    """Get all discount codes (super admin only)"""
    codes = await db.discount_codes.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return {"discount_codes": codes, "count": len(codes)}

@api_router.post("/admin/discount-codes")
async def create_discount_code(data: DiscountCodeCreate, current_user: dict = Depends(require_super_admin)):
    """Create a new discount code (super admin only)"""
    # Check if code already exists
    existing = await db.discount_codes.find_one({"code": data.code.upper()}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Discount code already exists")
    
    code_id = f"discount_{uuid.uuid4().hex[:12]}"
    now = datetime.now(timezone.utc)
    
    code_doc = {
        "code_id": code_id,
        "code": data.code.upper(),
        "discount_percent": data.discount_percent,
        "discount_type": data.discount_type,
        "fixed_amount": data.fixed_amount,
        "valid_from": data.valid_from,
        "valid_until": data.valid_until,
        "max_uses": data.max_uses,
        "current_uses": 0,
        "applicable_plans": data.applicable_plans,
        "created_by": current_user["user_id"],
        "created_at": now.isoformat(),
        "is_active": True
    }
    await db.discount_codes.insert_one(code_doc)
    
    # Remove MongoDB's _id field before returning
    code_doc.pop('_id', None)
    return {"message": "Discount code created", "discount_code": code_doc}

@api_router.put("/admin/discount-codes/{code_id}")
async def update_discount_code(code_id: str, updates: dict, current_user: dict = Depends(require_super_admin)):
    """Update a discount code (super admin only)"""
    allowed_fields = ["discount_percent", "discount_type", "fixed_amount", "valid_from", "valid_until", "max_uses", "applicable_plans", "is_active"]
    filtered_updates = {k: v for k, v in updates.items() if k in allowed_fields}
    
    result = await db.discount_codes.update_one(
        {"code_id": code_id},
        {"$set": filtered_updates}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Discount code not found")
    
    return {"message": "Discount code updated"}

@api_router.delete("/admin/discount-codes/{code_id}")
async def delete_discount_code(code_id: str, current_user: dict = Depends(require_super_admin)):
    """Delete a discount code (super admin only)"""
    result = await db.discount_codes.delete_one({"code_id": code_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Discount code not found")
    return {"message": "Discount code deleted"}

@api_router.put("/admin/discount-codes/{code_id}")
async def edit_discount_code(code_id: str, updates: dict, current_user: dict = Depends(require_super_admin)):
    """Edit a discount code"""
    allowed = {"code", "discount_percent", "max_uses", "valid_until", "is_active", "applicable_plans"}
    filtered = {k: v for k, v in updates.items() if k in allowed}
    if "code" in filtered:
        filtered["code"] = filtered["code"].upper()
    result = await db.discount_codes.update_one({"code_id": code_id}, {"$set": filtered})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Discount code not found")
    updated = await db.discount_codes.find_one({"code_id": code_id}, {"_id": 0})
    return updated



class DiscountCodeValidateRequest(BaseModel):
    code: str
    plan: str = "monthly"

@api_router.post("/discount-codes/validate")
async def validate_discount_code(request: DiscountCodeValidateRequest):
    """Validate a discount code (public endpoint)"""
    discount = await db.discount_codes.find_one(
        {"code": request.code.upper(), "is_active": True},
        {"_id": 0}
    )
    
    if not discount:
        raise HTTPException(status_code=404, detail="Invalid discount code")
    
    now = datetime.now(timezone.utc)
    
    # Check validity period
    if discount.get("valid_from"):
        valid_from = datetime.fromisoformat(discount["valid_from"]) if isinstance(discount["valid_from"], str) else discount["valid_from"]
        if now < valid_from:
            raise HTTPException(status_code=400, detail="Discount code not yet active")
    
    if discount.get("valid_until"):
        valid_until = datetime.fromisoformat(discount["valid_until"]) if isinstance(discount["valid_until"], str) else discount["valid_until"]
        if now > valid_until:
            raise HTTPException(status_code=400, detail="Discount code has expired")
    
    # Check max uses
    if discount.get("max_uses") and discount["current_uses"] >= discount["max_uses"]:
        raise HTTPException(status_code=400, detail="Discount code has reached maximum uses")
    
    # Check applicable plans
    if discount.get("applicable_plans") and len(discount["applicable_plans"]) > 0:
        if request.plan not in discount["applicable_plans"]:
            raise HTTPException(status_code=400, detail="Discount code not applicable to this plan")
    
    # Return format expected by frontend
    return {
        "valid": True,
        "discount": {
            "code": discount["code"],
            "discount_percentage": discount["discount_percent"],
            "discount_type": discount["discount_type"],
            "fixed_amount": discount.get("fixed_amount")
        }
    }

# ==================== AFFILIATE SYSTEM ROUTES ====================

@api_router.get("/admin/affiliates")
async def get_all_affiliates(current_user: dict = Depends(require_super_admin)):
    """Get all affiliates (super admin only)"""
    affiliates = await db.affiliates.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    
    # Enrich with user info
    for affiliate in affiliates:
        user = await db.users.find_one({"user_id": affiliate["user_id"]}, {"_id": 0, "password_hash": 0})
        affiliate["user"] = user
        
        # Get referral stats
        referrals = await db.affiliate_referrals.find({"affiliate_id": affiliate["affiliate_id"]}, {"_id": 0}).to_list(100)
        affiliate["referrals"] = referrals
    
    return {"affiliates": affiliates, "count": len(affiliates)}

@api_router.post("/admin/affiliates")
async def create_affiliate(data: AffiliateCreate, current_user: dict = Depends(require_super_admin)):
    """Create a new affiliate (super admin only)"""
    # Check if user exists
    user = await db.users.find_one({"user_id": data.user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Check if already an affiliate
    existing = await db.affiliates.find_one({"user_id": data.user_id}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="User is already an affiliate")
    
    affiliate_id = f"aff_{uuid.uuid4().hex[:12]}"
    affiliate_code = data.affiliate_code or f"REF{uuid.uuid4().hex[:8].upper()}"
    now = datetime.now(timezone.utc)
    
    # Determine tier based on parent
    tier = 1
    grandparent_id = None
    if data.parent_affiliate_id:
        parent = await db.affiliates.find_one({"affiliate_id": data.parent_affiliate_id}, {"_id": 0})
        if parent:
            tier = min(parent["tier"] + 1, 3)
            grandparent_id = parent.get("parent_affiliate_id")
    
    affiliate_doc = {
        "affiliate_id": affiliate_id,
        "user_id": data.user_id,
        "affiliate_code": affiliate_code.upper(),
        "tier": tier,
        "parent_affiliate_id": data.parent_affiliate_id,
        "grandparent_affiliate_id": grandparent_id,
        "commission_rate_tier1": data.commission_rate_tier1,
        "commission_rate_tier2": data.commission_rate_tier2,
        "commission_rate_tier3": data.commission_rate_tier3,
        "total_referrals": 0,
        "total_earnings": 0,
        "pending_earnings": 0,
        "paid_earnings": 0,
        "created_at": now.isoformat(),
        "is_active": True
    }
    await db.affiliates.insert_one(affiliate_doc)
    
    # Remove MongoDB's _id field before returning
    affiliate_doc.pop('_id', None)
    return {"message": "Affiliate created", "affiliate": affiliate_doc}

@api_router.put("/admin/affiliates/{affiliate_id}")
async def update_affiliate(affiliate_id: str, updates: dict, current_user: dict = Depends(require_super_admin)):
    """Update an affiliate (super admin only)"""
    allowed_fields = ["commission_rate_tier1", "commission_rate_tier2", "commission_rate_tier3", "is_active", "parent_affiliate_id"]
    filtered_updates = {k: v for k, v in updates.items() if k in allowed_fields}
    
    result = await db.affiliates.update_one(
        {"affiliate_id": affiliate_id},
        {"$set": filtered_updates}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Affiliate not found")
    
    return {"message": "Affiliate updated"}

@api_router.delete("/admin/affiliates/{affiliate_id}")
async def delete_affiliate(affiliate_id: str, current_user: dict = Depends(require_super_admin)):
    """Delete an affiliate (super admin only)"""
    result = await db.affiliates.delete_one({"affiliate_id": affiliate_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Affiliate not found")
    return {"message": "Affiliate deleted"}

@api_router.post("/admin/affiliates/{affiliate_id}/payout")
async def process_affiliate_payout(affiliate_id: str, amount: float, current_user: dict = Depends(require_super_admin)):
    """Process a payout to an affiliate (super admin only)"""
    affiliate = await db.affiliates.find_one({"affiliate_id": affiliate_id}, {"_id": 0})
    if not affiliate:
        raise HTTPException(status_code=404, detail="Affiliate not found")
    
    if amount > affiliate["pending_earnings"]:
        raise HTTPException(status_code=400, detail="Payout amount exceeds pending earnings")
    
    await db.affiliates.update_one(
        {"affiliate_id": affiliate_id},
        {
            "$inc": {
                "pending_earnings": -amount,
                "paid_earnings": amount
            }
        }
    )
    
    # Record payout
    payout_doc = {
        "payout_id": f"payout_{uuid.uuid4().hex[:12]}",
        "affiliate_id": affiliate_id,
        "amount": amount,
        "processed_by": current_user["user_id"],
        "processed_at": datetime.now(timezone.utc).isoformat()
    }
    await db.affiliate_payouts.insert_one(payout_doc)
    
    return {"message": f"Payout of €{amount} processed", "payout": payout_doc}

@api_router.get("/admin/affiliates/{affiliate_id}/referrals")
async def get_affiliate_referrals(affiliate_id: str, current_user: dict = Depends(require_super_admin)):
    """Get referrals for a specific affiliate (super admin only)"""
    referrals = await db.affiliate_referrals.find(
        {"affiliate_id": affiliate_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(1000)
    
    # Enrich with user info
    for ref in referrals:
        user = await db.users.find_one({"user_id": ref["referred_user_id"]}, {"_id": 0, "password_hash": 0})
        ref["referred_user"] = user
    
    return {"referrals": referrals, "count": len(referrals)}

# Public affiliate endpoints
@api_router.get("/affiliates/validate/{code}")
async def validate_affiliate_code(code: str):
    """Validate an affiliate referral code (public endpoint)"""
    affiliate = await db.affiliates.find_one(
        {"affiliate_code": code.upper(), "is_active": True},
        {"_id": 0}
    )
    
    if not affiliate:
        raise HTTPException(status_code=404, detail="Invalid affiliate code")
    
    user = await db.users.find_one({"user_id": affiliate["user_id"]}, {"_id": 0, "password_hash": 0})
    
    return {
        "valid": True,
        "affiliate_code": affiliate["affiliate_code"],
        "affiliate_name": user.get("name") if user else "Unknown"
    }

@api_router.post("/affiliates/track-referral")
async def track_affiliate_referral(
    affiliate_code: str,
    referred_user_id: str,
    payment_amount: float = 0
):
    """Track a new referral through affiliate link (internal use)"""
    affiliate = await db.affiliates.find_one(
        {"affiliate_code": affiliate_code.upper(), "is_active": True},
        {"_id": 0}
    )
    
    if not affiliate:
        return {"success": False, "message": "Invalid affiliate code"}
    
    now = datetime.now(timezone.utc)
    
    # Calculate commission for tier 1
    tier1_commission = payment_amount * (affiliate["commission_rate_tier1"] / 100)
    
    # Create referral record
    referral_doc = {
        "referral_id": f"ref_{uuid.uuid4().hex[:12]}",
        "affiliate_id": affiliate["affiliate_id"],
        "referred_user_id": referred_user_id,
        "tier_level": 1,
        "commission_amount": tier1_commission,
        "commission_status": "pending" if tier1_commission > 0 else "none",
        "payment_amount": payment_amount,
        "created_at": now.isoformat()
    }
    await db.affiliate_referrals.insert_one(referral_doc)
    
    # Update affiliate stats
    await db.affiliates.update_one(
        {"affiliate_id": affiliate["affiliate_id"]},
        {
            "$inc": {
                "total_referrals": 1,
                "total_earnings": tier1_commission,
                "pending_earnings": tier1_commission
            }
        }
    )
    
    # Process tier 2 commission if parent exists
    if affiliate.get("parent_affiliate_id"):
        parent = await db.affiliates.find_one({"affiliate_id": affiliate["parent_affiliate_id"]}, {"_id": 0})
        if parent and parent["is_active"]:
            tier2_commission = payment_amount * (parent["commission_rate_tier2"] / 100)
            
            tier2_referral = {
                "referral_id": f"ref_{uuid.uuid4().hex[:12]}",
                "affiliate_id": parent["affiliate_id"],
                "referred_user_id": referred_user_id,
                "tier_level": 2,
                "commission_amount": tier2_commission,
                "commission_status": "pending" if tier2_commission > 0 else "none",
                "payment_amount": payment_amount,
                "created_at": now.isoformat()
            }
            await db.affiliate_referrals.insert_one(tier2_referral)
            
            await db.affiliates.update_one(
                {"affiliate_id": parent["affiliate_id"]},
                {
                    "$inc": {
                        "total_earnings": tier2_commission,
                        "pending_earnings": tier2_commission
                    }
                }
            )
            
            # Process tier 3 commission if grandparent exists
            if parent.get("parent_affiliate_id"):
                grandparent = await db.affiliates.find_one({"affiliate_id": parent["parent_affiliate_id"]}, {"_id": 0})
                if grandparent and grandparent["is_active"]:
                    tier3_commission = payment_amount * (grandparent["commission_rate_tier3"] / 100)
                    
                    tier3_referral = {
                        "referral_id": f"ref_{uuid.uuid4().hex[:12]}",
                        "affiliate_id": grandparent["affiliate_id"],
                        "referred_user_id": referred_user_id,
                        "tier_level": 3,
                        "commission_amount": tier3_commission,
                        "commission_status": "pending" if tier3_commission > 0 else "none",
                        "payment_amount": payment_amount,
                        "created_at": now.isoformat()
                    }
                    await db.affiliate_referrals.insert_one(tier3_referral)
                    
                    await db.affiliates.update_one(
                        {"affiliate_id": grandparent["affiliate_id"]},
                        {
                            "$inc": {
                                "total_earnings": tier3_commission,
                                "pending_earnings": tier3_commission
                            }
                        }
                    )
    
    return {"success": True, "message": "Referral tracked", "referral_id": referral_doc["referral_id"]}

# ==================== SUPPORT & CONTACT ROUTES ====================

@api_router.post("/support/contact")
async def submit_contact_form(contact: ContactFormSubmit):
    """Public endpoint for contact form submissions"""
    now = datetime.now(timezone.utc)
    
    # Store the contact request
    contact_doc = {
        "contact_id": f"contact_{uuid.uuid4().hex[:12]}",
        "name": contact.name,
        "email": contact.email,
        "subject": contact.subject,
        "message": contact.message,
        "status": "new",
        "created_at": now.isoformat()
    }
    await db.contact_requests.insert_one(contact_doc)
    
    # Get platform settings to find support email
    settings = await db.platform_settings.find_one({"setting_id": "platform_settings"}, {"_id": 0})
    support_email = settings.get("support_email", "support@earnrm.com") if settings else "support@earnrm.com"
    
    # Send email notification via Resend
    email_sent = False
    if RESEND_API_KEY:
        try:
            # Email to support team
            support_html = f"""
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #4f46e5;">New Contact Form Submission</h2>
                <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <p><strong>From:</strong> {contact.name} ({contact.email})</p>
                    <p><strong>Subject:</strong> {contact.subject}</p>
                    <p><strong>Message:</strong></p>
                    <div style="background: white; padding: 15px; border-radius: 4px; border-left: 4px solid #4f46e5;">
                        {contact.message}
                    </div>
                </div>
                <p style="color: #64748b; font-size: 12px;">This message was sent from the earnrm contact form.</p>
            </div>
            """
            
            await asyncio.to_thread(resend.Emails.send, {
                "from": SENDER_EMAIL,
                "to": [support_email],
                "subject": f"[earnrm Contact] {contact.subject}",
                "html": support_html
            })
            
            # Confirmation email to user
            confirmation_html = f"""
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #4f46e5;">Thank you for contacting us!</h2>
                <p>Hi {contact.name},</p>
                <p>We've received your message and will get back to you as soon as possible.</p>
                <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <p><strong>Your message:</strong></p>
                    <p style="color: #475569;">{contact.message}</p>
                </div>
                <p>Best regards,<br>The earnrm Team</p>
                <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;">
                <p style="color: #64748b; font-size: 12px;">earnrm CRM - Simplify your sales</p>
            </div>
            """
            
            await asyncio.to_thread(resend.Emails.send, {
                "from": SENDER_EMAIL,
                "to": [contact.email],
                "subject": "We received your message - earnrm",
                "html": confirmation_html
            })
            
            email_sent = True
            logger.info(f"Contact form emails sent successfully for {contact.email}")
            
        except Exception as e:
            logger.error(f"Failed to send contact form email: {str(e)}")
    
    logger.info(f"Contact form submitted: {contact.email} - {contact.subject}")
    
    return {
        "success": True, 
        "message": "Message received! We'll get back to you soon.", 
        "contact_id": contact_doc["contact_id"],
        "email_sent": email_sent
    }

@api_router.get("/admin/contact-requests")
async def get_contact_requests(current_user: dict = Depends(require_super_admin)):
    """Get all contact form submissions (super admin only)"""
    requests = await db.contact_requests.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return {"contact_requests": requests, "count": len(requests)}

@api_router.put("/admin/contact-requests/{request_id}/status")
async def update_contact_request_status(request_id: str, status: str, notes: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    """Update support request status (super_admin, deputy_admin, or support role)"""
    role = current_user.get("role", "member")
    if role not in ["super_admin", "deputy_admin", "support"] and current_user.get("email") != SUPER_ADMIN_EMAIL:
        raise HTTPException(status_code=403, detail="Access denied")
    
    updates = {"status": status, "updated_at": datetime.now(timezone.utc).isoformat(), "handled_by": current_user["user_id"]}
    if notes:
        updates["admin_notes"] = notes
    result = await db.contact_requests.update_one({"request_id": request_id}, {"$set": updates})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Request not found")
    return {"message": "Status updated"}

@api_router.get("/admin/analytics/users")
async def admin_user_analytics(current_user: dict = Depends(require_super_admin)):
    """Comprehensive user analytics"""
    users = await db.users.find({}, {"_id": 0, "password_hash": 0}).sort("created_at", -1).to_list(5000)
    orgs = await db.organizations.find({}, {"_id": 0}).to_list(1000)
    
    # Build org lookup
    org_map = {o["organization_id"]: o for o in orgs}
    
    # Get data counts per org
    org_stats = {}
    for org in orgs:
        oid = org["organization_id"]
        leads_count = await db.leads.count_documents({"organization_id": oid})
        contacts_count = await db.contacts.count_documents({"organization_id": oid})
        deals_count = await db.deals.count_documents({"organization_id": oid})
        org_stats[oid] = {"leads": leads_count, "contacts": contacts_count, "deals": deals_count, "org_name": org.get("name",""), "plan": org.get("plan","free"), "user_count": org.get("user_count",1)}
    
    # Enrich users with org info
    enriched_users = []
    for u in users:
        oid = u.get("organization_id")
        user_info = {
            "user_id": u["user_id"],
            "email": u.get("email"),
            "name": u.get("name"),
            "role": u.get("role", "member"),
            "organization_id": oid,
            "org_name": org_map.get(oid, {}).get("name", "No org") if oid else "No org",
            "org_plan": org_map.get(oid, {}).get("plan", "free") if oid else "none",
            "created_at": u.get("created_at"),
            "last_login": u.get("last_login"),
        }
        enriched_users.append(user_info)
    
    return {
        "users": enriched_users,
        "total_users": len(users),
        "total_organizations": len(orgs),
        "org_stats": org_stats
    }

# ==================== DATA EXPLORER (SUPER ADMIN ONLY) ====================

@api_router.get("/admin/data-explorer/{collection}")
async def data_explorer(collection: str, skip: int = 0, limit: int = 50, search: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    """Browse any MongoDB collection (super_admin only)"""
    if current_user.get("role") != "super_admin" and current_user.get("email") != SUPER_ADMIN_EMAIL:
        raise HTTPException(status_code=403, detail="Super admin access required")
    
    allowed = ["users", "organizations", "leads", "contacts", "deals", "tasks", "companies", "campaigns",
               "calls", "scheduled_calls", "chat_channels", "messages", "notifications", "invites",
               "affiliates", "affiliate_referrals", "discount_codes", "payment_transactions", "invoices",
               "contact_requests", "platform_settings", "user_sessions"]
    if collection not in allowed:
        raise HTTPException(status_code=400, detail=f"Collection not allowed. Available: {', '.join(allowed)}")
    
    coll = db[collection]
    query = {}
    if search:
        query = {"$or": [
            {f: {"$regex": search, "$options": "i"}}
            for f in ["email", "name", "first_name", "last_name", "title", "company", "organization_id", "status"]
        ]}
        # Ignore fields that don't exist — MongoDB handles this gracefully
    
    total = await coll.count_documents(query)
    
    # Exclude password hashes and _id
    projection = {"_id": 0}
    if collection == "users":
        projection["password_hash"] = 0
    
    docs = await coll.find(query, projection).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    # Get field names from first few docs
    fields = set()
    for d in docs[:10]:
        fields.update(d.keys())
    
    return {"collection": collection, "total": total, "skip": skip, "limit": limit, "fields": sorted(fields), "data": docs}

@api_router.get("/admin/data-explorer")
async def list_collections(current_user: dict = Depends(get_current_user)):
    """List available collections (super_admin only)"""
    if current_user.get("role") != "super_admin" and current_user.get("email") != SUPER_ADMIN_EMAIL:
        raise HTTPException(status_code=403, detail="Super admin access required")
    
    collections = ["users", "organizations", "leads", "contacts", "deals", "tasks", "companies", "campaigns",
                    "calls", "scheduled_calls", "chat_channels", "messages", "notifications", "invites",
                    "affiliates", "discount_codes", "payment_transactions", "invoices", "contact_requests"]
    
    stats = {}
    for c in collections:
        count = await db[c].count_documents({})
        if count > 0:
            stats[c] = count
    
    return {"collections": stats}

# ==================== PLATFORM SETTINGS ROUTES ====================

@api_router.get("/admin/settings")
async def get_platform_settings(current_user: dict = Depends(require_super_admin)):
    """Get platform settings (super admin only)"""
    settings = await db.platform_settings.find_one({"setting_id": "platform_settings"}, {"_id": 0})
    if not settings:
        # Return defaults
        settings = {
            "setting_id": "platform_settings",
            "support_email": "support@earnrm.com",
            "stripe_api_key": None,
            "paypal_client_id": None,
            "paypal_client_secret": None,
            "crypto_wallet_address": None,
            "deal_stages": [
                {"id": "lead", "name": "Lead", "order": 1},
                {"id": "qualified", "name": "Qualified", "order": 2},
                {"id": "proposal", "name": "Proposal", "order": 3},
                {"id": "negotiation", "name": "Negotiation", "order": 4},
                {"id": "won", "name": "Won", "order": 5},
                {"id": "lost", "name": "Lost", "order": 6}
            ],
            "task_stages": [
                {"id": "todo", "name": "To Do", "order": 1},
                {"id": "in_progress", "name": "In Progress", "order": 2},
                {"id": "done", "name": "Done", "order": 3}
            ],
            "vat_rate": 20.0
        }
    return settings

@api_router.put("/admin/settings")
async def update_platform_settings(updates: dict, current_user: dict = Depends(require_super_admin)):
    """Update platform settings (super admin only)"""
    allowed_fields = [
        "support_email", "stripe_api_key", "paypal_client_id", "paypal_client_secret",
        "crypto_wallet_address", "deal_stages", "task_stages", "vat_rate"
    ]
    filtered_updates = {k: v for k, v in updates.items() if k in allowed_fields}
    filtered_updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    result = await db.platform_settings.update_one(
        {"setting_id": "platform_settings"},
        {"$set": filtered_updates},
        upsert=True
    )
    
    return {"message": "Settings updated successfully"}

@api_router.get("/settings/stages")
async def get_stages(current_user: dict = Depends(get_current_user)):
    """Get deal and task stages (for dropdowns)"""
    settings = await db.platform_settings.find_one({"setting_id": "platform_settings"}, {"_id": 0})
    
    deal_stages = settings.get("deal_stages") if settings else None
    task_stages = settings.get("task_stages") if settings else None
    
    if not deal_stages:
        deal_stages = [
            {"id": "lead", "name": "Lead", "order": 1},
            {"id": "qualified", "name": "Qualified", "order": 2},
            {"id": "proposal", "name": "Proposal", "order": 3},
            {"id": "negotiation", "name": "Negotiation", "order": 4},
            {"id": "won", "name": "Won", "order": 5},
            {"id": "lost", "name": "Lost", "order": 6}
        ]
    
    if not task_stages:
        task_stages = [
            {"id": "todo", "name": "To Do", "order": 1},
            {"id": "in_progress", "name": "In Progress", "order": 2},
            {"id": "done", "name": "Done", "order": 3}
        ]
    
    return {"deal_stages": deal_stages, "task_stages": task_stages}

# ==================== PIPELINE REPORT ROUTES ====================

@api_router.get("/pipeline/report")
async def get_pipeline_report(current_user: dict = Depends(get_current_user)):
    """Get pipeline report - admins see all, users see only their own deals"""
    if not current_user.get("organization_id"):
        org_id = await ensure_user_org(current_user)
        current_user["organization_id"] = org_id
    
    org_id = current_user["organization_id"]
    user_role = current_user.get("role", "member")
    is_admin = user_role in ["admin", "owner", "super_admin"]
    
    # Build query - admins see all, regular users see only their deals
    query = {"organization_id": org_id}
    if not is_admin:
        query["$or"] = [
            {"assigned_to": current_user["user_id"]},
            {"created_by": current_user["user_id"]}
        ]
    
    deals = await db.deals.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    
    # Get stages from settings
    settings = await db.platform_settings.find_one({"setting_id": "platform_settings"}, {"_id": 0})
    default_stages = [
        {"id": "lead", "name": "Lead", "order": 1},
        {"id": "qualified", "name": "Qualified", "order": 2},
        {"id": "proposal", "name": "Proposal", "order": 3},
        {"id": "negotiation", "name": "Negotiation", "order": 4},
        {"id": "won", "name": "Won", "order": 5},
        {"id": "lost", "name": "Lost", "order": 6}
    ]
    deal_stages = (settings.get("deal_stages") if settings else None) or default_stages
    
    # Calculate stage summaries
    stage_summaries = []
    total_value = 0
    weighted_value = 0
    
    for stage in deal_stages:
        stage_deals = [d for d in deals if d.get("stage") == stage["id"]]
        stage_value = sum(d.get("value", 0) for d in stage_deals)
        stage_weighted = sum(d.get("value", 0) * (d.get("probability", 0) / 100) for d in stage_deals)
        # Lost deals don't count towards pipeline totals
        if stage["id"] != "lost":
            total_value += stage_value
            weighted_value += stage_weighted
        
        stage_summaries.append({
            "id": stage["id"],
            "name": stage["name"],
            "count": len(stage_deals),
            "value": stage_value,
            "weighted_value": stage_weighted
        })
    
    return {
        "stages": stage_summaries,
        "total_value": total_value,
        "weighted_value": weighted_value,
        "deals": deals,
        "is_admin_view": is_admin
    }

@api_router.get("/pipeline/team-summary")
async def get_team_pipeline_summary(current_user: dict = Depends(get_current_user)):
    """Get pipeline summary by team member (admin only)"""
    if not current_user.get("organization_id"):
        return {"members": []}
    
    user_role = current_user.get("role", "member")
    is_admin = user_role in ["admin", "owner", "super_admin"]
    
    if not is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    org_id = current_user["organization_id"]
    
    # Get all team members
    members = await db.users.find(
        {"organization_id": org_id},
        {"_id": 0, "password_hash": 0}
    ).to_list(100)
    
    # Get all deals for this org
    deals = await db.deals.find({"organization_id": org_id}, {"_id": 0}).to_list(1000)
    
    # Calculate summary per member
    member_summaries = []
    for member in members:
        member_deals = [d for d in deals if d.get("assigned_to") == member["user_id"] or d.get("created_by") == member["user_id"]]
        total_value = sum(d.get("value", 0) for d in member_deals)
        weighted_value = sum(d.get("value", 0) * (d.get("probability", 0) / 100) for d in member_deals)
        won_value = sum(d.get("value", 0) for d in member_deals if d.get("stage") == "won")
        
        member_summaries.append({
            "user_id": member["user_id"],
            "name": member["name"],
            "email": member["email"],
            "deal_count": len(member_deals),
            "total_value": total_value,
            "weighted_value": weighted_value,
            "won_value": won_value
        })
    
    return {"members": member_summaries}

# ==================== SUBSCRIPTION & PAYMENT ROUTES ====================

@api_router.get("/subscriptions/plans")
async def get_subscription_plans():
    """Get available subscription plans"""
    return {"plans": list(SUBSCRIPTION_PLANS.values())}

@api_router.post("/subscriptions/checkout")
async def create_subscription_checkout(
    request: SubscriptionRequest,
    http_request: Request,
    current_user: dict = Depends(get_current_user)
):
    """Create a Stripe checkout session for subscription"""
    if not STRIPE_API_KEY:
        raise HTTPException(status_code=500, detail="Payment system not configured")
    
    # Validate plan
    if request.plan_id not in SUBSCRIPTION_PLANS:
        raise HTTPException(status_code=400, detail="Invalid subscription plan")
    
    plan = SUBSCRIPTION_PLANS[request.plan_id]
    
    # Calculate pricing
    base_price = plan["price"] * request.user_count
    discount_amount = 0.0
    discount_info = None
    
    # Apply discount code if provided
    if request.discount_code:
        discount = await db.discount_codes.find_one({
            "code": request.discount_code.upper(),
            "is_active": True
        }, {"_id": 0})
        
        if discount:
            discount_amount = base_price * (discount["discount_percent"] / 100)
            discount_info = {
                "code": discount["code"],
                "percentage": discount["discount_percent"]
            }
    
    # Apply crypto discount (5%) if using crypto
    crypto_discount = 0.0
    if request.use_crypto:
        crypto_discount = (base_price - discount_amount) * 0.05
    
    # Calculate VAT
    settings = await db.platform_settings.find_one({"setting_id": "platform_settings"}, {"_id": 0})
    vat_rate = settings.get("vat_rate", 20.0) if settings else 20.0
    
    net_amount = base_price - discount_amount - crypto_discount
    vat_amount = net_amount * (vat_rate / 100)
    total_amount = net_amount + vat_amount
    
    # Create URLs
    success_url = f"{request.origin_url}/subscription/success?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{request.origin_url}/settings?payment=cancelled"
    
    # Initialize Stripe
    host_url = str(http_request.base_url).rstrip('/')
    webhook_url = f"{host_url}/api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
    
    # Create checkout session
    metadata = {
        "organization_id": current_user.get("organization_id", ""),
        "user_id": current_user["user_id"],
        "email": current_user["email"],
        "plan_id": request.plan_id,
        "user_count": str(request.user_count),
        "discount_code": request.discount_code or "",
        "vat_rate": str(vat_rate)
    }
    
    payment_methods = ["card", "crypto"] if request.use_crypto else ["card"]
    currency = "usd" if request.use_crypto else "eur"
    
    # Convert to USD if using crypto (required by Stripe)
    if request.use_crypto:
        total_amount = total_amount * 1.08  # Approximate EUR to USD conversion
    
    checkout_request = CheckoutSessionRequest(
        amount=round(total_amount, 2),
        currency=currency,
        success_url=success_url,
        cancel_url=cancel_url,
        metadata=metadata,
        payment_methods=payment_methods
    )
    
    session = await stripe_checkout.create_checkout_session(checkout_request)
    
    # Create payment transaction record
    now = datetime.now(timezone.utc)
    transaction_doc = {
        "transaction_id": f"txn_{uuid.uuid4().hex[:12]}",
        "organization_id": current_user.get("organization_id", ""),
        "user_id": current_user["user_id"],
        "email": current_user["email"],
        "amount": base_price,
        "currency": plan["currency"],
        "plan_id": request.plan_id,
        "user_count": request.user_count,
        "discount_code": request.discount_code,
        "discount_amount": discount_amount + crypto_discount,
        "vat_amount": vat_amount,
        "vat_rate": vat_rate,
        "total_amount": total_amount,
        "stripe_session_id": session.session_id,
        "payment_status": "pending",
        "created_at": now.isoformat(),
        "updated_at": now.isoformat()
    }
    await db.payment_transactions.insert_one(transaction_doc)
    
    return {
        "checkout_url": session.url,
        "session_id": session.session_id,
        "breakdown": {
            "base_price": base_price,
            "discount_amount": discount_amount,
            "crypto_discount": crypto_discount,
            "net_amount": net_amount,
            "vat_rate": vat_rate,
            "vat_amount": vat_amount,
            "total_amount": total_amount,
            "currency": currency.upper()
        }
    }

@api_router.get("/subscriptions/status/{session_id}")
async def get_subscription_status(session_id: str, http_request: Request):
    """Check payment status and update transaction"""
    if not STRIPE_API_KEY:
        raise HTTPException(status_code=500, detail="Payment system not configured")
    
    host_url = str(http_request.base_url).rstrip('/')
    webhook_url = f"{host_url}/api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
    
    try:
        status = await stripe_checkout.get_checkout_status(session_id)
    except Exception as e:
        logger.error(f"Failed to get checkout status: {str(e)}")
        raise HTTPException(status_code=404, detail="Session not found or expired")
    
    # Update transaction in database
    transaction = await db.payment_transactions.find_one(
        {"stripe_session_id": session_id}, 
        {"_id": 0}
    )
    
    if transaction and transaction.get("payment_status") != status.payment_status:
        now = datetime.now(timezone.utc)
        await db.payment_transactions.update_one(
            {"stripe_session_id": session_id},
            {"$set": {
                "payment_status": status.payment_status,
                "updated_at": now.isoformat()
            }}
        )
        
        # If payment successful, create invoice and update organization
        if status.payment_status == "paid" and not transaction.get("invoice_id"):
            invoice_id = await create_invoice_for_transaction(transaction)
            await db.payment_transactions.update_one(
                {"stripe_session_id": session_id},
                {"$set": {"invoice_id": invoice_id}}
            )
            
            # Update organization subscription status
            if transaction.get("organization_id"):
                await db.organizations.update_one(
                    {"organization_id": transaction["organization_id"]},
                    {"$set": {
                        "subscription_status": "active",
                        "subscription_plan": transaction["plan_id"],
                        "max_users": transaction["user_count"] + 3,  # +3 free users
                        "subscription_updated_at": now.isoformat()
                    }}
                )
    
    return {
        "status": status.status,
        "payment_status": status.payment_status,
        "amount_total": status.amount_total,
        "currency": status.currency,
        "transaction_id": transaction.get("transaction_id") if transaction else None,
        "invoice_id": transaction.get("invoice_id") if transaction else None
    }

@api_router.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    """Handle Stripe webhooks"""
    if not STRIPE_API_KEY:
        raise HTTPException(status_code=500, detail="Payment system not configured")
    
    body = await request.body()
    signature = request.headers.get("Stripe-Signature")
    
    host_url = str(request.base_url).rstrip('/')
    webhook_url = f"{host_url}/api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
    
    try:
        webhook_response = await stripe_checkout.handle_webhook(body, signature)
        
        # Update payment transaction
        if webhook_response.session_id:
            now = datetime.now(timezone.utc)
            await db.payment_transactions.update_one(
                {"stripe_session_id": webhook_response.session_id},
                {"$set": {
                    "payment_status": webhook_response.payment_status,
                    "updated_at": now.isoformat()
                }}
            )
        
        return {"received": True, "event_type": webhook_response.event_type}
    except Exception as e:
        logger.error(f"Webhook error: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))

# ==================== INVOICE ROUTES ====================

async def create_invoice_for_transaction(transaction: dict) -> str:
    """Create an invoice for a completed transaction"""
    now = datetime.now(timezone.utc)
    
    # Get the latest invoice number
    last_invoice = await db.invoices.find_one(
        {}, 
        {"_id": 0, "invoice_number": 1},
        sort=[("created_at", -1)]
    )
    
    if last_invoice:
        try:
            last_num = int(last_invoice["invoice_number"].split("-")[1])
            invoice_num = last_num + 1
        except:
            invoice_num = 1001
    else:
        invoice_num = 1001
    
    invoice_number = f"INV-{invoice_num:05d}"
    
    # Get plan details
    plan = SUBSCRIPTION_PLANS.get(transaction["plan_id"], {})
    
    # Get user details
    user = await db.users.find_one(
        {"user_id": transaction["user_id"]}, 
        {"_id": 0, "name": 1, "email": 1}
    )
    
    invoice_doc = {
        "invoice_id": f"inv_{uuid.uuid4().hex[:12]}",
        "invoice_number": invoice_number,
        "organization_id": transaction.get("organization_id", ""),
        "user_id": transaction["user_id"],
        "email": transaction["email"],
        "billing_name": user.get("name", transaction["email"]) if user else transaction["email"],
        "billing_address": None,
        "plan_name": plan.get("name", transaction["plan_id"]),
        "user_count": transaction["user_count"],
        "unit_price": plan.get("price", 0),
        "subtotal": transaction["amount"],
        "discount_code": transaction.get("discount_code"),
        "discount_amount": transaction.get("discount_amount", 0),
        "net_amount": transaction["amount"] - transaction.get("discount_amount", 0),
        "vat_rate": transaction.get("vat_rate", 20.0),
        "vat_amount": transaction.get("vat_amount", 0),
        "total_amount": transaction["total_amount"],
        "currency": transaction.get("currency", "EUR").upper(),
        "status": "paid",
        "transaction_id": transaction["transaction_id"],
        "stripe_session_id": transaction["stripe_session_id"],
        "invoice_date": now.isoformat(),
        "created_at": now.isoformat()
    }
    
    await db.invoices.insert_one(invoice_doc)
    
    # Send invoice email
    await send_invoice_email(invoice_doc)
    
    return invoice_doc["invoice_id"]

async def send_invoice_email(invoice: dict):
    """Send invoice email with PDF attachment"""
    if not RESEND_API_KEY:
        logger.warning("Resend not configured, skipping invoice email")
        return
    
    try:
        # Generate invoice HTML
        invoice_html = generate_invoice_html(invoice)
        
        # Terms and Conditions
        terms_html = """
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 20px auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
            <h2 style="color: #1e293b;">Terms & Conditions</h2>
            <h3>1. Service Agreement</h3>
            <p>By subscribing to earnrm CRM services, you agree to these terms and conditions.</p>
            
            <h3>2. Subscription & Billing</h3>
            <ul>
                <li>Subscriptions are billed in advance on a monthly or annual basis</li>
                <li>Prices are in EUR unless otherwise specified</li>
                <li>UK VAT at 20% is added to all invoices</li>
                <li>Refunds are available within 14 days of initial purchase</li>
            </ul>
            
            <h3>3. User Limits</h3>
            <p>Free tier includes up to 3 users. Additional users are charged at the subscribed rate.</p>
            
            <h3>4. Data Protection</h3>
            <p>We comply with GDPR and UK data protection regulations. Your data is stored securely and never shared with third parties.</p>
            
            <h3>5. Cancellation</h3>
            <p>You may cancel your subscription at any time. Access continues until the end of your billing period.</p>
            
            <h3>6. Contact</h3>
            <p>For support, please contact support@earnrm.com</p>
            
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;">
            <p style="color: #64748b; font-size: 12px;">
                <strong>Fintery Ltd.</strong><br>
                71-75 Shelton Street, Covent Garden, London, WC2H 9JQ, United Kingdom<br>
                Company Registration: UK Registered Company
            </p>
        </div>
        """
        
        # Combine invoice and terms
        full_html = f"""
        <div style="font-family: Arial, sans-serif;">
            <p>Dear {invoice['billing_name']},</p>
            <p>Thank you for subscribing to earnrm CRM! Please find your invoice details below.</p>
            
            {invoice_html}
            
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;">
            
            {terms_html}
            
            <p style="margin-top: 30px;">Best regards,<br>The earnrm Team</p>
        </div>
        """
        
        await asyncio.to_thread(resend.Emails.send, {
            "from": SENDER_EMAIL,
            "to": [invoice["email"]],
            "subject": f"Your earnrm Invoice {invoice['invoice_number']}",
            "html": full_html
        })
        
        logger.info(f"Invoice email sent: {invoice['invoice_number']} to {invoice['email']}")
        
    except Exception as e:
        logger.error(f"Failed to send invoice email: {str(e)}")

def generate_invoice_html(invoice: dict) -> str:
    """Generate HTML invoice"""
    return f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
        <div style="background: #4f46e5; color: white; padding: 20px;">
            <h1 style="margin: 0; font-size: 24px;">INVOICE</h1>
            <p style="margin: 5px 0 0 0; opacity: 0.9;">{invoice['invoice_number']}</p>
        </div>
        
        <div style="padding: 20px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 20px;">
                <div>
                    <h3 style="color: #64748b; margin: 0 0 5px 0; font-size: 12px;">FROM</h3>
                    <p style="margin: 0; font-weight: bold;">Fintery Ltd.</p>
                    <p style="margin: 0; color: #64748b; font-size: 14px;">71-75 Shelton Street</p>
                    <p style="margin: 0; color: #64748b; font-size: 14px;">Covent Garden, London</p>
                    <p style="margin: 0; color: #64748b; font-size: 14px;">WC2H 9JQ, United Kingdom</p>
                </div>
                <div style="text-align: right;">
                    <h3 style="color: #64748b; margin: 0 0 5px 0; font-size: 12px;">BILL TO</h3>
                    <p style="margin: 0; font-weight: bold;">{invoice['billing_name']}</p>
                    <p style="margin: 0; color: #64748b; font-size: 14px;">{invoice['email']}</p>
                </div>
            </div>
            
            <div style="margin-bottom: 20px;">
                <p style="margin: 0; color: #64748b; font-size: 14px;">Invoice Date: {invoice['invoice_date'][:10]}</p>
            </div>
            
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
                <thead>
                    <tr style="background: #f8fafc;">
                        <th style="padding: 10px; text-align: left; border-bottom: 1px solid #e2e8f0;">Description</th>
                        <th style="padding: 10px; text-align: center; border-bottom: 1px solid #e2e8f0;">Qty</th>
                        <th style="padding: 10px; text-align: right; border-bottom: 1px solid #e2e8f0;">Unit Price</th>
                        <th style="padding: 10px; text-align: right; border-bottom: 1px solid #e2e8f0;">Amount</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">{invoice['plan_name']}</td>
                        <td style="padding: 10px; text-align: center; border-bottom: 1px solid #e2e8f0;">{invoice['user_count']}</td>
                        <td style="padding: 10px; text-align: right; border-bottom: 1px solid #e2e8f0;">€{invoice['unit_price']:.2f}</td>
                        <td style="padding: 10px; text-align: right; border-bottom: 1px solid #e2e8f0;">€{invoice['subtotal']:.2f}</td>
                    </tr>
                </tbody>
            </table>
            
            <div style="text-align: right;">
                <p style="margin: 5px 0;"><span style="color: #64748b;">Subtotal:</span> €{invoice['subtotal']:.2f}</p>
                {"<p style='margin: 5px 0;'><span style='color: #64748b;'>Discount (" + invoice['discount_code'] + "):</span> -€" + f"{invoice['discount_amount']:.2f}" + "</p>" if invoice.get('discount_code') else ""}
                <p style="margin: 5px 0;"><span style="color: #64748b;">VAT ({invoice['vat_rate']}%):</span> €{invoice['vat_amount']:.2f}</p>
                <p style="margin: 10px 0 0 0; font-size: 20px; font-weight: bold; color: #4f46e5;">Total: €{invoice['total_amount']:.2f}</p>
            </div>
        </div>
        
        <div style="background: #f8fafc; padding: 15px 20px; text-align: center;">
            <p style="margin: 0; color: #64748b; font-size: 12px;">Thank you for your business!</p>
        </div>
    </div>
    """

@api_router.get("/invoices")
async def get_user_invoices(current_user: dict = Depends(get_current_user)):
    """Get invoices for the current user's organization"""
    query = {}
    if current_user.get("organization_id"):
        query["organization_id"] = current_user["organization_id"]
    else:
        query["user_id"] = current_user["user_id"]
    
    invoices = await db.invoices.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    return {"invoices": invoices}

@api_router.get("/invoices/{invoice_id}")
async def get_invoice(invoice_id: str, current_user: dict = Depends(get_current_user)):
    """Get a specific invoice"""
    invoice = await db.invoices.find_one({"invoice_id": invoice_id}, {"_id": 0})
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    
    # Check permission
    if invoice.get("organization_id") != current_user.get("organization_id") and invoice.get("user_id") != current_user["user_id"]:
        user_role = current_user.get("role", "member")
        if user_role not in ["super_admin"]:
            raise HTTPException(status_code=403, detail="Access denied")
    
    return invoice

@api_router.get("/invoices/{invoice_id}/html")
async def get_invoice_html(invoice_id: str, current_user: dict = Depends(get_current_user)):
    """Get invoice as HTML for printing/PDF"""
    invoice = await db.invoices.find_one({"invoice_id": invoice_id}, {"_id": 0})
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    
    html = generate_invoice_html(invoice)
    return Response(content=html, media_type="text/html")

@api_router.get("/admin/invoices")
async def get_all_invoices(current_user: dict = Depends(require_super_admin)):
    """Get all invoices (super admin only)"""
    invoices = await db.invoices.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return {"invoices": invoices, "count": len(invoices)}

@api_router.get("/admin/transactions")
async def get_all_transactions(current_user: dict = Depends(require_super_admin)):
    """Get all payment transactions (super admin only)"""
    transactions = await db.payment_transactions.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return {"transactions": transactions, "count": len(transactions)}

# ==================== TEAM CHAT ROUTES ====================

class ChatMessage(BaseModel):
    model_config = ConfigDict(extra="ignore")
    message_id: str
    organization_id: str
    channel_id: str  # 'general' or specific like 'lead_{id}', 'deal_{id}'
    sender_id: str
    sender_name: str
    sender_picture: Optional[str] = None
    content: str
    mentions: List[str] = []  # List of user_ids mentioned
    reply_to: Optional[str] = None  # message_id if this is a reply
    attachments: List[dict] = []
    reactions: Dict[str, List[str]] = {}  # emoji: [user_ids]
    is_edited: bool = False
    created_at: datetime
    updated_at: datetime

class ChatMessageCreate(BaseModel):
    model_config = ConfigDict(extra="ignore")
    channel_id: str = "general"
    content: str
    mentions: List[str] = []
    reply_to: Optional[str] = None
    attachments: List[dict] = []

class ChatChannel(BaseModel):
    model_config = ConfigDict(extra="ignore")
    channel_id: str
    organization_id: str
    name: str
    description: Optional[str] = None
    channel_type: str = "general"  # general, lead, deal, task, direct
    related_id: Optional[str] = None  # lead_id, deal_id, etc.
    members: List[str] = []  # For direct messages
    created_by: str
    created_at: datetime
    last_message_at: Optional[datetime] = None

class ChatChannelCreate(BaseModel):
    name: str
    description: Optional[str] = None
    channel_type: str = "general"
    related_id: Optional[str] = None
    members: List[str] = []

@api_router.get("/chat/channels")
async def get_chat_channels(current_user: dict = Depends(get_current_user)):
    """Get all chat channels for the organization"""
    if not current_user.get("organization_id"):
        org_id = await ensure_user_org(current_user)
        current_user["organization_id"] = org_id
    
    channels = await db.chat_channels.find(
        {"organization_id": current_user["organization_id"], "archived": {"$ne": True}},
        {"_id": 0}
    ).sort("last_message_at", -1).to_list(100)
    
    # Always include the general channel
    general_exists = any(c["channel_id"] == "general" for c in channels)
    if not general_exists:
        # Create the general channel if it doesn't exist
        now = datetime.now(timezone.utc)
        general_channel = {
            "channel_id": "general",
            "organization_id": current_user["organization_id"],
            "name": "General",
            "description": "Team-wide discussions",
            "channel_type": "general",
            "related_id": None,
            "members": [],
            "created_by": current_user["user_id"],
            "created_at": now.isoformat(),
            "last_message_at": None
        }
        await db.chat_channels.insert_one(general_channel)
        general_channel.pop('_id', None)
        channels.insert(0, general_channel)
    
    return {"channels": channels}

@api_router.post("/chat/channels")
async def create_chat_channel(
    channel_data: ChatChannelCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create a new chat channel"""
    if not current_user.get("organization_id"):
        org_id = await ensure_user_org(current_user)
        current_user["organization_id"] = org_id
    
    channel_id = f"channel_{uuid.uuid4().hex[:12]}"
    now = datetime.now(timezone.utc)
    
    channel_doc = {
        "channel_id": channel_id,
        "organization_id": current_user["organization_id"],
        "name": channel_data.name,
        "description": channel_data.description,
        "channel_type": channel_data.channel_type,
        "related_id": channel_data.related_id,
        "members": channel_data.members,
        "created_by": current_user["user_id"],
        "created_at": now.isoformat(),
        "last_message_at": None
    }
    await db.chat_channels.insert_one(channel_doc)
    channel_doc.pop('_id', None)
    return channel_doc

@api_router.get("/chat/context/{context_type}/{context_id}")
async def get_or_create_contextual_channel(
    context_type: str,
    context_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get or create a contextual chat channel for a lead, deal, task, or company"""
    if not current_user.get("organization_id"):
        org_id = await ensure_user_org(current_user)
        current_user["organization_id"] = org_id
    
    valid_types = ["lead", "deal", "task", "company", "project"]
    if context_type not in valid_types:
        raise HTTPException(status_code=400, detail=f"Invalid context type. Must be one of: {valid_types}")
    
    # Check if the related entity exists
    collection_map = {
        "lead": db.leads,
        "deal": db.deals,
        "task": db.tasks,
        "company": db.companies,
        "project": db.projects
    }
    id_field_map = {
        "lead": "lead_id",
        "deal": "deal_id",
        "task": "task_id",
        "company": "company_id",
        "project": "project_id"
    }
    
    entity = await collection_map[context_type].find_one(
        {id_field_map[context_type]: context_id, "organization_id": current_user["organization_id"]},
        {"_id": 0}
    )
    if not entity:
        raise HTTPException(status_code=404, detail=f"{context_type.capitalize()} not found")
    
    # Get entity name for channel name
    if context_type == "lead":
        entity_name = f"{entity.get('first_name', '')} {entity.get('last_name', '')}".strip() or "Unknown Lead"
    elif context_type == "deal":
        entity_name = entity.get("name", "Unknown Deal")
    elif context_type == "task":
        entity_name = entity.get("title", "Unknown Task")
    elif context_type == "company":
        entity_name = entity.get("name", "Unknown Company")
    
    # Check if channel already exists
    channel_id = f"{context_type}_{context_id}"
    existing_channel = await db.chat_channels.find_one(
        {"channel_id": channel_id, "organization_id": current_user["organization_id"]},
        {"_id": 0}
    )
    
    if existing_channel:
        # Update entity info in case it changed
        existing_channel["entity_name"] = entity_name
        existing_channel["entity"] = entity
        return existing_channel
    
    # Create new contextual channel
    now = datetime.now(timezone.utc)
    channel_doc = {
        "channel_id": channel_id,
        "organization_id": current_user["organization_id"],
        "name": entity_name,
        "description": f"Discussion about {context_type}: {entity_name}",
        "channel_type": context_type,
        "related_id": context_id,
        "members": [],
        "created_by": current_user["user_id"],
        "created_at": now.isoformat(),
        "last_message_at": None
    }
    await db.chat_channels.insert_one(channel_doc)
    channel_doc.pop('_id', None)
    channel_doc["entity_name"] = entity_name
    channel_doc["entity"] = entity
    
    return channel_doc

@api_router.get("/chat/context/{context_type}/{context_id}/messages")
async def get_contextual_channel_messages(
    context_type: str,
    context_id: str,
    limit: int = 50,
    current_user: dict = Depends(get_current_user)
):
    """Get messages for a contextual channel (lead/deal/task/company)"""
    channel_id = f"{context_type}_{context_id}"
    return await get_channel_messages(channel_id, limit, None, current_user)

@api_router.get("/chat/channels/{channel_id}/messages")
async def get_channel_messages(
    channel_id: str,
    limit: int = 50,
    before: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get messages from a channel with pagination"""
    if not current_user.get("organization_id"):
        return {"messages": []}
    
    query = {
        "organization_id": current_user["organization_id"],
        "channel_id": channel_id
    }
    
    if before:
        # Get messages before a specific message (for infinite scroll)
        ref_message = await db.chat_messages.find_one({"message_id": before}, {"_id": 0})
        if ref_message:
            query["created_at"] = {"$lt": ref_message["created_at"]}
    
    messages = await db.chat_messages.find(
        query, {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    # Reverse to get chronological order
    messages.reverse()
    
    return {"messages": messages, "has_more": len(messages) == limit}

@api_router.post("/chat/channels/{channel_id}/messages")
async def send_chat_message(
    channel_id: str,
    message_data: ChatMessageCreate,
    current_user: dict = Depends(get_current_user)
):
    """Send a message to a channel"""
    if not current_user.get("organization_id"):
        org_id = await ensure_user_org(current_user)
        current_user["organization_id"] = org_id
    
    message_id = f"msg_{uuid.uuid4().hex[:12]}"
    now = datetime.now(timezone.utc)
    
    # Parse mentions from content (format: @[user_name](user_id))
    mentions = message_data.mentions.copy()
    mention_pattern = r'@\[([^\]]+)\]\(([^)]+)\)'
    content_mentions = re.findall(mention_pattern, message_data.content)
    for name, user_id in content_mentions:
        if user_id not in mentions:
            mentions.append(user_id)
    
    message_doc = {
        "message_id": message_id,
        "organization_id": current_user["organization_id"],
        "channel_id": channel_id,
        "sender_id": current_user["user_id"],
        "sender_name": current_user["name"],
        "sender_picture": current_user.get("picture"),
        "content": message_data.content,
        "mentions": mentions,
        "reply_to": message_data.reply_to,
        "attachments": message_data.attachments,
        "reactions": {},
        "is_edited": False,
        "created_at": now.isoformat(),
        "updated_at": now.isoformat()
    }
    await db.chat_messages.insert_one(message_doc)
    
    # Update channel's last_message_at
    await db.chat_channels.update_one(
        {"channel_id": channel_id, "organization_id": current_user["organization_id"]},
        {"$set": {"last_message_at": now.isoformat()}}
    )
    
    # Create notifications for mentioned users
    for mentioned_user_id in mentions:
        if mentioned_user_id != current_user["user_id"]:
            notification_doc = {
                "notification_id": f"notif_{uuid.uuid4().hex[:12]}",
                "user_id": mentioned_user_id,
                "organization_id": current_user["organization_id"],
                "type": "mention",
                "title": f"{current_user['name']} mentioned you",
                "content": message_data.content[:100],
                "link": f"/chat?channel={channel_id}&message={message_id}",
                "is_read": False,
                "created_at": now.isoformat()
            }
            await db.notifications.insert_one(notification_doc)
    
    message_doc.pop('_id', None)
    return message_doc

@api_router.put("/chat/messages/{message_id}")
async def edit_chat_message(
    message_id: str,
    content: str,
    current_user: dict = Depends(get_current_user)
):
    """Edit a message (only sender can edit)"""
    message = await db.chat_messages.find_one(
        {"message_id": message_id, "sender_id": current_user["user_id"]},
        {"_id": 0}
    )
    if not message:
        raise HTTPException(status_code=404, detail="Message not found or access denied")
    
    now = datetime.now(timezone.utc)
    await db.chat_messages.update_one(
        {"message_id": message_id},
        {"$set": {"content": content, "is_edited": True, "updated_at": now.isoformat()}}
    )
    
    return {"message": "Message updated"}

@api_router.delete("/chat/messages/{message_id}")
async def delete_chat_message(
    message_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete a message (sender or admin can delete)"""
    message = await db.chat_messages.find_one({"message_id": message_id}, {"_id": 0})
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")
    
    # Check permission
    is_sender = message["sender_id"] == current_user["user_id"]
    is_admin = current_user.get("role") in ["admin", "owner", "super_admin"]
    
    if not is_sender and not is_admin:
        raise HTTPException(status_code=403, detail="Access denied")
    
    await db.chat_messages.delete_one({"message_id": message_id})
    return {"message": "Message deleted"}

@api_router.post("/chat/messages/{message_id}/reactions")
async def toggle_reaction(
    message_id: str,
    emoji: str,
    current_user: dict = Depends(get_current_user)
):
    """Toggle a reaction on a message"""
    message = await db.chat_messages.find_one({"message_id": message_id}, {"_id": 0})
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")
    
    reactions = message.get("reactions", {})
    user_id = current_user["user_id"]
    
    if emoji not in reactions:
        reactions[emoji] = []
    
    if user_id in reactions[emoji]:
        reactions[emoji].remove(user_id)
        if not reactions[emoji]:
            del reactions[emoji]
    else:
        reactions[emoji].append(user_id)
    
    await db.chat_messages.update_one(
        {"message_id": message_id},
        {"$set": {"reactions": reactions}}
    )
    
    return {"reactions": reactions}

@api_router.get("/chat/messages/new")
async def get_new_messages(
    since: str,
    channel_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Poll for new messages since a timestamp (for real-time updates)"""
    if not current_user.get("organization_id"):
        return {"messages": []}
    
    query = {
        "organization_id": current_user["organization_id"],
        "created_at": {"$gt": since}
    }
    if channel_id:
        query["channel_id"] = channel_id
    
    messages = await db.chat_messages.find(
        query, {"_id": 0}
    ).sort("created_at", 1).limit(100).to_list(100)
    
    return {"messages": messages}

@api_router.get("/notifications")
async def get_notifications(
    unread_only: bool = False,
    current_user: dict = Depends(get_current_user)
):
    """Get notifications for the current user"""
    query = {"user_id": current_user["user_id"]}
    if unread_only:
        query["is_read"] = False
    
    notifications = await db.notifications.find(
        query, {"_id": 0}
    ).sort("created_at", -1).limit(50).to_list(50)
    
    unread_count = await db.notifications.count_documents({
        "user_id": current_user["user_id"],
        "is_read": False
    })
    
    return {"notifications": notifications, "unread_count": unread_count}

@api_router.put("/notifications/{notification_id}/read")
async def mark_notification_read(
    notification_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Mark a notification as read"""
    await db.notifications.update_one(
        {"notification_id": notification_id, "user_id": current_user["user_id"]},
        {"$set": {"is_read": True}}
    )
    return {"message": "Notification marked as read"}

@api_router.put("/notifications/read-all")
async def mark_all_notifications_read(current_user: dict = Depends(get_current_user)):
    """Mark all notifications as read"""
    await db.notifications.update_many(
        {"user_id": current_user["user_id"], "is_read": False},
        {"$set": {"is_read": True}}
    )
    return {"message": "All notifications marked as read"}

# ==================== CHAT ARCHIVE ====================

@api_router.put("/chat/channels/{channel_id}/archive")
async def archive_channel(channel_id: str, current_user: dict = Depends(get_current_user)):
    """Archive a chat channel (admin/owner only)"""
    role = current_user.get("role", "member")
    if role not in ["admin", "owner", "super_admin"] and current_user.get("email") != SUPER_ADMIN_EMAIL:
        raise HTTPException(status_code=403, detail="Only admins can archive channels")
    
    result = await db.chat_channels.update_one(
        {"channel_id": channel_id, "organization_id": current_user.get("organization_id")},
        {"$set": {"archived": True, "archived_at": datetime.now(timezone.utc).isoformat(), "archived_by": current_user["user_id"]}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Channel not found")
    return {"message": "Channel archived"}

# ==================== CONTACTS ====================

class ContactCreate(BaseModel):
    first_name: str
    last_name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    company: Optional[str] = None
    job_title: Optional[str] = None
    linkedin_url: Optional[str] = None
    website: Optional[str] = None
    location: Optional[str] = None
    industry: Optional[str] = None
    company_size: Optional[str] = None
    source: str = "lead_conversion"
    notes: Optional[str] = None
    # Sales-specific fields
    decision_maker: bool = False
    budget: Optional[str] = None
    timeline: Optional[str] = None
    pain_points: Optional[str] = None
    preferred_contact_method: Optional[str] = None
    # Linked entities
    lead_id: Optional[str] = None
    deal_id: Optional[str] = None

@api_router.get("/contacts")
async def get_contacts(current_user: dict = Depends(get_current_user)):
    if not current_user.get("organization_id"):
        org_id = await ensure_user_org(current_user)
        current_user["organization_id"] = org_id
    contacts = await db.contacts.find(
        {"organization_id": current_user["organization_id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(1000)
    return contacts

@api_router.post("/contacts")
async def create_contact(data: ContactCreate, current_user: dict = Depends(get_current_user)):
    if not current_user.get("organization_id"):
        org_id = await ensure_user_org(current_user)
        current_user["organization_id"] = org_id
    
    contact_id = f"contact_{uuid.uuid4().hex[:12]}"
    now = datetime.now(timezone.utc)
    
    doc = {
        "contact_id": contact_id,
        "organization_id": current_user["organization_id"],
        **data.model_dump(),
        "created_by": current_user["user_id"],
        "created_at": now.isoformat(),
        "updated_at": now.isoformat()
    }
    await db.contacts.insert_one(doc)
    doc.pop('_id', None)
    return doc

@api_router.get("/contacts/{contact_id}")
async def get_contact(contact_id: str, current_user: dict = Depends(get_current_user)):
    contact = await db.contacts.find_one(
        {"contact_id": contact_id, "organization_id": current_user.get("organization_id")},
        {"_id": 0}
    )
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    return contact

@api_router.put("/contacts/{contact_id}")
async def update_contact(contact_id: str, updates: dict, current_user: dict = Depends(get_current_user)):
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    result = await db.contacts.update_one(
        {"contact_id": contact_id, "organization_id": current_user.get("organization_id")},
        {"$set": updates}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Contact not found")
    return await get_contact(contact_id, current_user)

@api_router.delete("/contacts/{contact_id}")
async def delete_contact(contact_id: str, current_user: dict = Depends(get_current_user)):
    result = await db.contacts.delete_one(
        {"contact_id": contact_id, "organization_id": current_user.get("organization_id")}
    )
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Contact not found")
    return {"message": "Contact deleted"}

@api_router.post("/contacts/import-csv")
async def import_contacts_csv(file: UploadFile = File(...), current_user: dict = Depends(get_current_user)):
    """Import contacts from CSV"""
    if not current_user.get("organization_id"):
        org_id = await ensure_user_org(current_user)
        current_user["organization_id"] = org_id
    
    content = await file.read()
    text = content.decode('utf-8-sig')
    reader = csv.DictReader(io.StringIO(text))
    
    now = datetime.now(timezone.utc)
    count = 0
    for row in reader:
        r = {k.strip().lower().replace(' ', '_'): v.strip() for k, v in row.items() if v and v.strip()}
        if not r.get('first_name') and not r.get('name') and not r.get('email'):
            continue
        
        first_name = r.get('first_name', '')
        last_name = r.get('last_name', '')
        if not first_name and r.get('name'):
            parts = r['name'].split(' ', 1)
            first_name = parts[0]
            last_name = parts[1] if len(parts) > 1 else ''
        
        doc = {
            "contact_id": f"contact_{uuid.uuid4().hex[:12]}",
            "organization_id": current_user["organization_id"],
            "first_name": first_name,
            "last_name": last_name,
            "email": r.get('email'),
            "phone": r.get('phone') or r.get('mobile') or r.get('telephone'),
            "company": r.get('company') or r.get('organization'),
            "job_title": r.get('job_title') or r.get('title') or r.get('position'),
            "linkedin_url": r.get('linkedin_url') or r.get('linkedin'),
            "website": r.get('website') or r.get('url'),
            "location": r.get('location') or r.get('city') or r.get('address'),
            "industry": r.get('industry'),
            "notes": r.get('notes'),
            "source": "csv_import",
            "decision_maker": False,
            "created_by": current_user["user_id"],
            "created_at": now.isoformat(),
            "updated_at": now.isoformat()
        }
        await db.contacts.insert_one(doc)
        count += 1
    
    return {"count": count, "message": f"Imported {count} contacts"}

@api_router.post("/bulk/enrich")
async def bulk_enrich(request: BulkEnrichRequest, current_user: dict = Depends(get_current_user)):
    """Bulk AI enrich leads or contacts"""
    entity_type = request.entity_type
    entity_ids = request.entity_ids
    org_id = current_user.get("organization_id")
    collection = db.leads if entity_type == 'lead' else db.contacts
    id_field = 'lead_id' if entity_type == 'lead' else 'contact_id'
    
    enriched = 0
    for eid in entity_ids[:20]:  # Limit to 20
        entity = await collection.find_one({id_field: eid, "organization_id": org_id}, {"_id": 0})
        if not entity:
            continue
        try:
            info = f"Name: {entity.get('first_name','')} {entity.get('last_name','')}, Email: {entity.get('email','')}, Company: {entity.get('company','')}, Title: {entity.get('job_title','')}"
            resp = await tako_ai_text(
                "You are a B2B enrichment AI. Return ONLY valid JSON with: company_description, industry, company_size, website, job_title, location, technologies (array), interests (array), recommended_approach. Use null if unknown.",
                f"Enrich: {info}",
                user_email=current_user.get("email", ""), org_id=current_user.get("organization_id")
            )
            
            import json
            try:
                enrichment = json.loads(resp.strip().strip('```json').strip('```'))
            except:
                continue
            
            updates = {"updated_at": datetime.now(timezone.utc).isoformat()}
            for ai_f, db_f in {"job_title":"job_title","website":"website","location":"location","industry":"industry","company_size":"company_size","company_description":"company_description"}.items():
                if enrichment.get(ai_f) and not entity.get(db_f):
                    updates[db_f] = enrichment[ai_f]
            updates["enrichment"] = {"technologies": enrichment.get("technologies",[]), "interests": enrichment.get("interests",[]), "recommended_approach": enrichment.get("recommended_approach",""), "enriched_at": datetime.now(timezone.utc).isoformat()}
            
            await collection.update_one({id_field: eid}, {"$set": updates})
            enriched += 1
        except Exception as e:
            logger.error(f"Bulk enrich error for {eid}: {e}")
    
    return {"enriched": enriched, "total": len(entity_ids)}

@api_router.post("/bulk/delete")
async def bulk_delete(request: BulkDeleteRequest, current_user: dict = Depends(get_current_user)):
    """Bulk delete leads, contacts, or companies"""
    entity_type = request.entity_type
    entity_ids = request.entity_ids
    org_id = current_user.get("organization_id")
    collections = {"lead": (db.leads, "lead_id"), "contact": (db.contacts, "contact_id"), "company": (db.companies, "company_id")}
    if entity_type not in collections:
        raise HTTPException(status_code=400, detail="Invalid entity type")
    
    coll, id_field = collections[entity_type]
    result = await coll.delete_many({id_field: {"$in": entity_ids}, "organization_id": org_id})
    return {"deleted": result.deleted_count}

@api_router.post("/bulk/update")
async def bulk_update(request: BulkUpdateRequest, current_user: dict = Depends(get_current_user)):
    """Bulk update leads, contacts, or companies"""
    entity_type = request.entity_type
    entity_ids = request.entity_ids
    updates = request.updates
    org_id = current_user.get("organization_id")
    collections = {"lead": (db.leads, "lead_id"), "contact": (db.contacts, "contact_id"), "company": (db.companies, "company_id")}
    if entity_type not in collections:
        raise HTTPException(status_code=400, detail="Invalid entity type")
    
    coll, id_field = collections[entity_type]
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    result = await coll.update_many({id_field: {"$in": entity_ids}, "organization_id": org_id}, {"$set": updates})
    return {"updated": result.modified_count}

@api_router.post("/bulk/add-to-campaign")
async def bulk_add_to_campaign(request: BulkAddToCampaignRequest, current_user: dict = Depends(get_current_user)):
    """Add leads or contacts to a campaign"""
    campaign_id = request.campaign_id
    entity_type = request.entity_type
    entity_ids = request.entity_ids
    org_id = current_user.get("organization_id")
    campaign = await db.campaigns.find_one({"campaign_id": campaign_id, "organization_id": org_id})
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    
    coll = db.leads if entity_type == 'lead' else db.contacts
    id_field = 'lead_id' if entity_type == 'lead' else 'contact_id'
    email_field = 'email'
    
    entities = await coll.find({id_field: {"$in": entity_ids}, "organization_id": org_id}, {"_id": 0}).to_list(500)
    emails = [e[email_field] for e in entities if e.get(email_field)]
    
    existing = campaign.get("recipients", [])
    new_emails = [e for e in emails if e not in existing]
    
    await db.campaigns.update_one(
        {"campaign_id": campaign_id},
        {"$addToSet": {"recipients": {"$each": new_emails}}}
    )
    return {"added": len(new_emails), "total_recipients": len(existing) + len(new_emails)}

@api_router.post("/leads/{lead_id}/convert-to-contact")
async def convert_lead_to_contact(lead_id: str, deal_id: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    """Convert a qualified lead to a contact"""
    lead = await db.leads.find_one(
        {"lead_id": lead_id, "organization_id": current_user.get("organization_id")},
        {"_id": 0}
    )
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    contact_id = f"contact_{uuid.uuid4().hex[:12]}"
    now = datetime.now(timezone.utc)
    
    contact_doc = {
        "contact_id": contact_id,
        "organization_id": current_user["organization_id"],
        "first_name": lead.get("first_name", ""),
        "last_name": lead.get("last_name", ""),
        "email": lead.get("email"),
        "phone": lead.get("phone"),
        "company": lead.get("company"),
        "job_title": lead.get("job_title"),
        "linkedin_url": lead.get("linkedin_url"),
        "website": lead.get("website"),
        "location": lead.get("location"),
        "industry": lead.get("industry"),
        "company_size": lead.get("company_size"),
        "company_description": lead.get("company_description"),
        "source": "lead_conversion",
        "notes": lead.get("notes"),
        "decision_maker": False,
        "budget": None,
        "timeline": None,
        "pain_points": None,
        "preferred_contact_method": None,
        "lead_id": lead_id,
        "deal_id": deal_id,
        "enrichment": lead.get("enrichment"),
        "ai_score": lead.get("ai_score"),
        "created_by": current_user["user_id"],
        "created_at": now.isoformat(),
        "updated_at": now.isoformat()
    }
    await db.contacts.insert_one(contact_doc)
    contact_doc.pop('_id', None)
    
    # Update lead status to converted
    await db.leads.update_one(
        {"lead_id": lead_id},
        {"$set": {"status": "converted", "converted_contact_id": contact_id, "updated_at": now.isoformat()}}
    )
    
    return contact_doc

# ==================== CALLS & RECORDINGS ====================

# Twilio Configuration
TWILIO_ACCOUNT_SID = os.environ.get('TWILIO_ACCOUNT_SID')
TWILIO_AUTH_TOKEN = os.environ.get('TWILIO_AUTH_TOKEN')
TWILIO_PHONE_FROM = os.environ.get('TWILIO_PHONE_FROM')
FRONTEND_URL = os.environ.get('FRONTEND_URL', '')

class CallInitiate(BaseModel):
    lead_id: str
    message: Optional[str] = "Thank you for your interest"

class CallAnalyzeRequest(BaseModel):
    call_id: str

def get_twilio_client():
    if not all([TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_FROM]):
        raise HTTPException(status_code=503, detail="Twilio is not configured. Please add TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_FROM to your environment.")
    from twilio.rest import Client
    return Client(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)

@api_router.post("/calls/initiate")
async def initiate_call(data: CallInitiate, current_user: dict = Depends(get_current_user)):
    """Initiate an outbound call to a lead"""
    lead = await db.leads.find_one(
        {"lead_id": data.lead_id, "organization_id": current_user.get("organization_id")},
        {"_id": 0}
    )
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")

    phone = lead.get("phone")
    if not phone:
        raise HTTPException(status_code=400, detail="Lead has no phone number")

    # Normalize phone to E.164
    import re as _re
    digits = _re.sub(r'\D', '', phone)
    if len(digits) == 10:
        digits = '1' + digits
    e164 = '+' + digits
    if len(digits) < 10:
        raise HTTPException(status_code=400, detail="Invalid phone number")

    twilio = get_twilio_client()
    call_id = str(uuid.uuid4())
    twilio_call = None
    base_url = FRONTEND_URL.rstrip('/')

    try:
        from twilio.twiml.voice_response import VoiceResponse
        twilio_call = twilio.calls.create(
            to=e164,
            from_=TWILIO_PHONE_FROM,
            url=f"{base_url}/api/calls/twiml/{call_id}",
            record=True,
            recording_status_callback=f"{base_url}/api/webhooks/twilio/recording-status",
            recording_status_callback_method="POST",
            status_callback=f"{base_url}/api/webhooks/twilio/call-status",
            status_callback_event=["initiated", "ringing", "answered", "completed"],
            status_callback_method="POST"
        )
    except Exception as e:
        logger.error(f"Twilio call error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to initiate call: {str(e)}")

    call_doc = {
        "call_id": call_id,
        "call_sid": twilio_call.sid,
        "organization_id": current_user.get("organization_id"),
        "lead_id": data.lead_id,
        "lead_name": f"{lead.get('first_name','')} {lead.get('last_name','')}".strip(),
        "from_number": TWILIO_PHONE_FROM,
        "to_number": e164,
        "status": twilio_call.status,
        "direction": "outbound",
        "duration": 0,
        "recording_url": None,
        "recording_sid": None,
        "ai_analysis": None,
        "initiated_by": current_user.get("user_id"),
        "initiated_by_name": current_user.get("name"),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "ended_at": None
    }
    await db.calls.insert_one(call_doc)

    return {
        "call_id": call_id,
        "call_sid": twilio_call.sid,
        "status": twilio_call.status,
        "to": e164,
        "message": "Call initiated successfully"
    }

@api_router.get("/calls/twiml/{call_id}")
async def call_twiml(call_id: str, message: str = "Thank you for your interest in our service"):
    """Return TwiML instructions for the call"""
    from twilio.twiml.voice_response import VoiceResponse
    resp = VoiceResponse()
    resp.say(message, voice="alice")
    resp.pause(length=1)
    resp.say("This call may be recorded for quality and training purposes.", voice="alice")
    return Response(content=str(resp), media_type="application/xml")

@api_router.post("/webhooks/twilio/inbound")
async def twilio_inbound_call(request: Request):
    """Handle inbound calls — log them and play a greeting"""
    from twilio.twiml.voice_response import VoiceResponse
    
    form = await request.form()
    call_sid = form.get("CallSid", "")
    from_number = form.get("From", "")
    to_number = form.get("To", "")
    
    now = datetime.now(timezone.utc)
    
    # Try to match caller to a lead or contact
    lead_name = "Unknown Caller"
    lead_id = None
    
    # Find super admin's org for logging
    super_admin = await db.users.find_one({"email": SUPER_ADMIN_EMAIL}, {"_id": 0})
    org_id = super_admin.get("organization_id") if super_admin else None
    
    if org_id:
        # Search for caller in leads/contacts by phone
        lead = await db.leads.find_one({"organization_id": org_id, "phone": {"$regex": from_number[-8:]}}, {"_id": 0})
        if lead:
            lead_name = f"{lead.get('first_name','')} {lead.get('last_name','')}".strip()
            lead_id = lead.get("lead_id")
        else:
            contact = await db.contacts.find_one({"organization_id": org_id, "phone": {"$regex": from_number[-8:]}}, {"_id": 0})
            if contact:
                lead_name = f"{contact.get('first_name','')} {contact.get('last_name','')}".strip()
    
    # Log the inbound call
    call_doc = {
        "call_id": f"call_{uuid.uuid4().hex[:12]}",
        "call_sid": call_sid,
        "organization_id": org_id,
        "lead_id": lead_id,
        "lead_name": lead_name,
        "from_number": from_number,
        "to_number": to_number,
        "status": "ringing",
        "direction": "inbound",
        "duration": 0,
        "recording_url": None,
        "ai_analysis": None,
        "initiated_by": None,
        "initiated_by_name": "Inbound",
        "created_at": now.isoformat(),
        "ended_at": None
    }
    await db.calls.insert_one(call_doc)
    
    # Build TwiML response
    resp = VoiceResponse()
    resp.say("Thank you for calling earn R M. Your call is important to us.", voice="alice")
    resp.say("Please leave a message after the beep, and we will get back to you shortly.", voice="alice")
    resp.record(max_length=120, transcribe=False, play_beep=True,
                recording_status_callback=f"{FRONTEND_URL.rstrip('/')}/api/webhooks/twilio/recording-status",
                recording_status_callback_method="POST")
    resp.say("Thank you. Goodbye.", voice="alice")
    resp.hangup()
    
    return Response(content=str(resp), media_type="application/xml")

@api_router.post("/webhooks/twilio/call-status")
async def twilio_call_status_webhook(request: Request):
    """Webhook for Twilio call status updates"""
    form = await request.form()
    call_sid = form.get("CallSid")
    call_status = form.get("CallStatus")
    call_duration = form.get("CallDuration", "0")

    if call_sid:
        update = {"status": call_status}
        if call_status == "completed":
            update["duration"] = int(call_duration) if call_duration else 0
            update["ended_at"] = datetime.now(timezone.utc).isoformat()
        await db.calls.update_one({"call_sid": call_sid}, {"$set": update})

    return Response(status_code=200)

@api_router.post("/webhooks/twilio/recording-status")
async def twilio_recording_status_webhook(request: Request):
    """Webhook for Twilio recording status updates"""
    form = await request.form()
    call_sid = form.get("CallSid")
    recording_sid = form.get("RecordingSid")
    recording_url = form.get("RecordingUrl")
    recording_status = form.get("RecordingStatus")
    recording_duration = form.get("RecordingDuration", "0")

    if call_sid and recording_status == "completed" and recording_url:
        await db.calls.update_one(
            {"call_sid": call_sid},
            {"$set": {
                "recording_url": recording_url,
                "recording_sid": recording_sid,
                "recording_duration": int(recording_duration) if recording_duration else 0
            }}
        )
    return Response(status_code=200)

@api_router.get("/calls")
async def get_calls(
    lead_id: Optional[str] = None,
    limit: int = 50,
    current_user: dict = Depends(get_current_user)
):
    """Get call history for the organization"""
    org_id = current_user.get("organization_id")
    query = {"organization_id": org_id}
    if lead_id:
        query["lead_id"] = lead_id

    calls = await db.calls.find(query, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)
    return calls

@api_router.get("/calls/stats/overview")
async def get_call_stats(current_user: dict = Depends(get_current_user)):
    """Get call statistics for the organization"""
    org_id = current_user.get("organization_id")
    total = await db.calls.count_documents({"organization_id": org_id})
    completed = await db.calls.count_documents({"organization_id": org_id, "status": "completed"})
    
    pipeline = [
        {"$match": {"organization_id": org_id, "duration": {"$gt": 0}}},
        {"$group": {"_id": None, "avg_duration": {"$avg": "$duration"}, "total_duration": {"$sum": "$duration"}}}
    ]
    agg = await db.calls.aggregate(pipeline).to_list(1)
    avg_duration = round(agg[0]["avg_duration"], 1) if agg else 0
    total_duration = agg[0]["total_duration"] if agg else 0

    analyzed = await db.calls.count_documents({"organization_id": org_id, "ai_analysis": {"$ne": None}})

    return {
        "total_calls": total,
        "completed_calls": completed,
        "avg_duration_seconds": avg_duration,
        "total_duration_seconds": total_duration,
        "analyzed_calls": analyzed
    }

# ==================== CALL SCHEDULING ====================

class ScheduleCallRequest(BaseModel):
    lead_id: str
    scheduled_at: str
    notes: Optional[str] = None
    reminder_minutes: int = 15

class UpdateScheduledCallRequest(BaseModel):
    scheduled_at: Optional[str] = None
    notes: Optional[str] = None
    reminder_minutes: Optional[int] = None
    status: Optional[str] = None

@api_router.post("/calls/schedule")
async def schedule_call(data: ScheduleCallRequest, current_user: dict = Depends(get_current_user)):
    """Schedule a call with a lead"""
    lead = await db.leads.find_one(
        {"lead_id": data.lead_id, "organization_id": current_user.get("organization_id")},
        {"_id": 0}
    )
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")

    schedule_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    scheduled_dt = None

    try:
        scheduled_dt = datetime.fromisoformat(data.scheduled_at.replace('Z', '+00:00'))
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use ISO 8601.")

    if scheduled_dt <= now:
        raise HTTPException(status_code=400, detail="Scheduled time must be in the future")

    reminder_at = (scheduled_dt - timedelta(minutes=data.reminder_minutes)).isoformat()

    doc = {
        "schedule_id": schedule_id,
        "organization_id": current_user.get("organization_id"),
        "lead_id": data.lead_id,
        "lead_name": f"{lead.get('first_name','')} {lead.get('last_name','')}".strip(),
        "lead_phone": lead.get("phone", ""),
        "lead_company": lead.get("company", ""),
        "scheduled_at": scheduled_dt.isoformat(),
        "reminder_at": reminder_at,
        "reminder_minutes": data.reminder_minutes,
        "reminder_sent": False,
        "notes": data.notes,
        "status": "scheduled",
        "created_by": current_user.get("user_id"),
        "created_by_name": current_user.get("name"),
        "created_at": now.isoformat()
    }
    await db.scheduled_calls.insert_one(doc)

    return {
        "schedule_id": schedule_id,
        "scheduled_at": scheduled_dt.isoformat(),
        "lead_name": doc["lead_name"],
        "message": "Call scheduled successfully"
    }

@api_router.get("/calls/scheduled")
async def get_scheduled_calls(
    status: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get all scheduled calls for the organization"""
    org_id = current_user.get("organization_id")
    query = {"organization_id": org_id}
    if status:
        query["status"] = status
    else:
        query["status"] = {"$in": ["scheduled", "completed"]}

    scheduled = await db.scheduled_calls.find(query, {"_id": 0}).sort("scheduled_at", 1).to_list(200)
    return scheduled

@api_router.get("/calls/scheduled/upcoming")
async def get_upcoming_calls(current_user: dict = Depends(get_current_user)):
    """Get upcoming scheduled calls (next 7 days)"""
    org_id = current_user.get("organization_id")
    now = datetime.now(timezone.utc)
    week_later = (now + timedelta(days=7)).isoformat()

    upcoming = await db.scheduled_calls.find(
        {
            "organization_id": org_id,
            "status": "scheduled",
            "scheduled_at": {"$gte": now.isoformat(), "$lte": week_later}
        },
        {"_id": 0}
    ).sort("scheduled_at", 1).to_list(50)
    return upcoming

@api_router.put("/calls/scheduled/{schedule_id}")
async def update_scheduled_call(
    schedule_id: str,
    data: UpdateScheduledCallRequest,
    current_user: dict = Depends(get_current_user)
):
    """Update a scheduled call"""
    existing = await db.scheduled_calls.find_one(
        {"schedule_id": schedule_id, "organization_id": current_user.get("organization_id")}
    )
    if not existing:
        raise HTTPException(status_code=404, detail="Scheduled call not found")

    updates = {}
    if data.scheduled_at:
        try:
            scheduled_dt = datetime.fromisoformat(data.scheduled_at.replace('Z', '+00:00'))
            updates["scheduled_at"] = scheduled_dt.isoformat()
            mins = data.reminder_minutes if data.reminder_minutes else existing.get("reminder_minutes", 15)
            updates["reminder_at"] = (scheduled_dt - timedelta(minutes=mins)).isoformat()
            updates["reminder_sent"] = False
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format")
    if data.notes is not None:
        updates["notes"] = data.notes
    if data.reminder_minutes is not None:
        updates["reminder_minutes"] = data.reminder_minutes
    if data.status:
        updates["status"] = data.status

    if updates:
        await db.scheduled_calls.update_one({"schedule_id": schedule_id}, {"$set": updates})

    updated = await db.scheduled_calls.find_one({"schedule_id": schedule_id}, {"_id": 0})
    return updated

@api_router.delete("/calls/scheduled/{schedule_id}")
async def cancel_scheduled_call(schedule_id: str, current_user: dict = Depends(get_current_user)):
    """Cancel a scheduled call"""
    result = await db.scheduled_calls.update_one(
        {"schedule_id": schedule_id, "organization_id": current_user.get("organization_id"), "status": "scheduled"},
        {"$set": {"status": "cancelled"}}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Scheduled call not found or already cancelled")
    return {"message": "Call cancelled"}

@api_router.post("/calls/scheduled/check-reminders")
async def check_reminders(current_user: dict = Depends(get_current_user)):
    """Check and send reminders for upcoming calls"""
    org_id = current_user.get("organization_id")
    now = datetime.now(timezone.utc).isoformat()

    due_reminders = await db.scheduled_calls.find(
        {
            "organization_id": org_id,
            "status": "scheduled",
            "reminder_sent": False,
            "reminder_at": {"$lte": now}
        },
        {"_id": 0}
    ).to_list(20)

    notifications_created = 0
    for sc in due_reminders:
        notif = {
            "notification_id": f"notif_{uuid.uuid4().hex[:12]}",
            "user_id": sc["created_by"],
            "organization_id": org_id,
            "type": "call_reminder",
            "title": f"Upcoming call with {sc['lead_name']}",
            "content": f"Scheduled in {sc['reminder_minutes']} minutes" + (f" - {sc['notes']}" if sc.get('notes') else ""),
            "link": "/calls",
            "is_read": False,
            "created_at": now
        }
        await db.notifications.insert_one(notif)
        await db.scheduled_calls.update_one(
            {"schedule_id": sc["schedule_id"]},
            {"$set": {"reminder_sent": True}}
        )
        notifications_created += 1

    return {"reminders_sent": notifications_created}

@api_router.get("/calls/{call_id}")
async def get_call(call_id: str, current_user: dict = Depends(get_current_user)):
    """Get a single call by ID"""
    call = await db.calls.find_one(
        {"call_id": call_id, "organization_id": current_user.get("organization_id")},
        {"_id": 0}
    )
    if not call:
        raise HTTPException(status_code=404, detail="Call not found")
    return call

@api_router.post("/calls/{call_id}/analyze")
async def analyze_call(call_id: str, current_user: dict = Depends(get_current_user)):
    """AI analysis of a call recording"""
    call = await db.calls.find_one(
        {"call_id": call_id, "organization_id": current_user.get("organization_id")},
        {"_id": 0}
    )
    if not call:
        raise HTTPException(status_code=404, detail="Call not found")

    if not call.get("recording_url"):
        raise HTTPException(status_code=400, detail="No recording available for this call")

    try:
        lead = await db.leads.find_one({"lead_id": call.get("lead_id")}, {"_id": 0})
        lead_context = ""
        if lead:
            lead_context = f"Lead: {lead.get('first_name','')} {lead.get('last_name','')}, Company: {lead.get('company','N/A')}, Title: {lead.get('job_title','N/A')}"

        prompt = f"""Analyze this sales call:
- Direction: {call.get('direction','outbound')}
- Duration: {call.get('duration', 0)} seconds
- Status: {call.get('status','unknown')}
- Called by: {call.get('initiated_by_name','Unknown')}
- {lead_context}
- Recording available: Yes
Provide your analysis."""

        response = await tako_ai_text(
            """You are a sales call analyst. Analyze the call metadata and provide actionable feedback. Return a JSON object with these keys:
- summary: 2-3 sentence summary of what likely happened
- sentiment: "positive", "neutral", or "negative"
- score: 1-10 rating of the call quality
- strengths: array of 2-3 things that went well
- improvements: array of 2-3 areas for improvement
- next_steps: array of 2-3 recommended follow-up actions
Return ONLY valid JSON, no markdown.""",
            prompt,
            user_email=current_user.get("email", ""), org_id=current_user.get("organization_id")
        )

        import json
        try:
            analysis = json.loads(response.strip().strip('```json').strip('```'))
        except:
            analysis = {
                "summary": response[:200],
                "sentiment": "neutral",
                "score": 5,
                "strengths": ["Call was completed"],
                "improvements": ["Could not parse detailed analysis"],
                "next_steps": ["Follow up with the lead"]
            }

        await db.calls.update_one(
            {"call_id": call_id},
            {"$set": {"ai_analysis": analysis}}
        )
        return {"call_id": call_id, "analysis": analysis}

    except Exception as e:
        logger.error(f"Call analysis error: {e}")
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")

# ==================== API KEYS ====================


@api_router.post("/api-keys")
async def create_api_key(name: str = "Default", current_user: dict = Depends(get_current_user)):
    """Generate an API key for programmatic access"""
    key = f"earnrm_{secrets.token_hex(24)}"
    doc = {
        "key_id": f"key_{uuid.uuid4().hex[:12]}",
        "key_hash": hash_password(key),
        "key_prefix": key[:16] + "...",
        "name": name,
        "organization_id": current_user.get("organization_id"),
        "user_id": current_user["user_id"],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "last_used": None,
        "is_active": True
    }
    await db.api_keys.insert_one(doc)
    doc.pop('_id', None)
    return {"key": key, "key_id": doc["key_id"], "name": name, "message": "Save this key - it won't be shown again"}

@api_router.get("/api-keys")
async def list_api_keys(current_user: dict = Depends(get_current_user)):
    """List all API keys for the user"""
    keys = await db.api_keys.find(
        {"user_id": current_user["user_id"], "is_active": True},
        {"_id": 0, "key_hash": 0}
    ).to_list(50)
    return keys

@api_router.delete("/api-keys/{key_id}")
async def revoke_api_key(key_id: str, current_user: dict = Depends(get_current_user)):
    """Revoke an API key"""
    result = await db.api_keys.update_one(
        {"key_id": key_id, "user_id": current_user["user_id"]},
        {"$set": {"is_active": False}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="API key not found")
    return {"message": "API key revoked"}

# API key auth middleware for external integrations
async def get_api_key_user(request: Request):
    """Authenticate via API key (for n8n, Notion, etc.)"""
    auth = request.headers.get("X-API-Key") or request.headers.get("Authorization", "").replace("Bearer ", "")
    if not auth or not auth.startswith("earnrm_"):
        raise HTTPException(status_code=401, detail="Valid API key required")
    
    keys = await db.api_keys.find({"is_active": True}, {"_id": 0}).to_list(100)
    for k in keys:
        if verify_password(auth, k.get("key_hash", "")):
            await db.api_keys.update_one({"key_id": k["key_id"]}, {"$set": {"last_used": datetime.now(timezone.utc).isoformat()}})
            user = await db.users.find_one({"user_id": k["user_id"]}, {"_id": 0})
            if user:
                return user
    raise HTTPException(status_code=401, detail="Invalid API key")

# ==================== EXTERNAL API (n8n, Notion, etc.) ====================

@api_router.get("/v1/leads")
async def api_get_leads(limit: int = 100, status: Optional[str] = None, user: dict = Depends(get_api_key_user)):
    """External API: Get leads"""
    query = {"organization_id": user.get("organization_id")}
    if status:
        query["status"] = status
    leads = await db.leads.find(query, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)
    return {"data": leads, "count": len(leads)}

@api_router.post("/v1/leads")
async def api_create_lead(lead: LeadCreate, user: dict = Depends(get_api_key_user)):
    """External API: Create a lead"""
    lead_id = f"lead_{uuid.uuid4().hex[:12]}"
    now = datetime.now(timezone.utc)
    doc = {"lead_id": lead_id, "organization_id": user["organization_id"], **lead.model_dump(), "status": "new", "ai_score": None, "assigned_to": None, "created_by": user["user_id"], "created_at": now.isoformat(), "updated_at": now.isoformat()}
    await db.leads.insert_one(doc)
    doc.pop('_id', None)
    # Fire webhook
    await fire_webhooks(user["organization_id"], "lead.created", doc)
    return doc

@api_router.get("/v1/contacts")
async def api_get_contacts(limit: int = 100, user: dict = Depends(get_api_key_user)):
    """External API: Get contacts"""
    contacts = await db.contacts.find({"organization_id": user.get("organization_id")}, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)
    return {"data": contacts, "count": len(contacts)}

@api_router.get("/v1/deals")
async def api_get_deals(limit: int = 100, stage: Optional[str] = None, user: dict = Depends(get_api_key_user)):
    """External API: Get deals"""
    query = {"organization_id": user.get("organization_id")}
    if stage:
        query["stage"] = stage
    deals = await db.deals.find(query, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)
    return {"data": deals, "count": len(deals)}

@api_router.get("/v1/companies")
async def api_get_companies(limit: int = 100, user: dict = Depends(get_api_key_user)):
    """External API: Get companies"""
    companies = await db.companies.find({"organization_id": user.get("organization_id")}, {"_id": 0}).limit(limit).to_list(limit)
    return {"data": companies, "count": len(companies)}

@api_router.get("/v1/tasks")
async def api_get_tasks(limit: int = 100, status: Optional[str] = None, user: dict = Depends(get_api_key_user)):
    """External API: Get tasks"""
    query = {"organization_id": user.get("organization_id")}
    if status:
        query["status"] = status
    tasks = await db.tasks.find(query, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)
    return {"data": tasks, "count": len(tasks)}

@api_router.post("/v1/tasks")
async def api_create_task(task: TaskCreate, user: dict = Depends(get_api_key_user)):
    """External API: Create a task"""
    task_id = f"task_{uuid.uuid4().hex[:12]}"
    now = datetime.now(timezone.utc)
    doc = {"task_id": task_id, "organization_id": user.get("organization_id"), **task.model_dump(), "created_by": user["user_id"], "created_at": now.isoformat(), "updated_at": now.isoformat()}
    if doc.get("due_date"):
        doc["due_date"] = doc["due_date"].isoformat()
    await db.tasks.insert_one(doc)
    doc.pop('_id', None)
    await fire_webhooks(user.get("organization_id", ""), "task.created", doc)
    return doc

# ==================== WEBHOOKS ====================

async def fire_webhooks(org_id: str, event: str, data: dict):
    """Fire registered webhooks for an event"""
    hooks = await db.webhooks.find({"organization_id": org_id, "is_active": True, "events": event}, {"_id": 0}).to_list(20)
    for hook in hooks:
        try:
            async with httpx.AsyncClient(timeout=5) as client:
                await client.post(hook["url"], json={"event": event, "data": data, "timestamp": datetime.now(timezone.utc).isoformat()})
        except Exception as e:
            logger.error(f"Webhook fire error: {e}")

@api_router.post("/webhooks")
async def create_webhook(url: str, events: List[str], name: str = "Default", current_user: dict = Depends(get_current_user)):
    """Register a webhook URL for events (for n8n, Zapier, etc.)"""
    valid_events = ["lead.created", "lead.updated", "deal.created", "deal.stage_changed", "contact.created", "task.created", "chat.message"]
    for e in events:
        if e not in valid_events:
            raise HTTPException(status_code=400, detail=f"Invalid event: {e}. Valid: {valid_events}")
    
    doc = {
        "webhook_id": f"wh_{uuid.uuid4().hex[:12]}",
        "organization_id": current_user.get("organization_id"),
        "user_id": current_user["user_id"],
        "name": name,
        "url": url,
        "events": events,
        "is_active": True,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.webhooks.insert_one(doc)
    doc.pop('_id', None)
    return doc

@api_router.get("/webhooks")
async def list_webhooks(current_user: dict = Depends(get_current_user)):
    """List registered webhooks"""
    hooks = await db.webhooks.find({"organization_id": current_user.get("organization_id")}, {"_id": 0}).to_list(50)
    return hooks

@api_router.delete("/webhooks/{webhook_id}")
async def delete_webhook(webhook_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a webhook"""
    result = await db.webhooks.delete_one({"webhook_id": webhook_id, "organization_id": current_user.get("organization_id")})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Webhook not found")
    return {"message": "Webhook deleted"}

# Notion sync endpoint
@api_router.post("/v1/notion/sync")
async def notion_sync(entity_type: str = "leads", user: dict = Depends(get_api_key_user)):
    """Get data formatted for Notion database sync"""
    org_id = user.get("organization_id")
    collections = {"leads": db.leads, "contacts": db.contacts, "deals": db.deals, "companies": db.companies}
    if entity_type not in collections:
        raise HTTPException(status_code=400, detail="Invalid entity type")
    
    data = await collections[entity_type].find({"organization_id": org_id}, {"_id": 0}).sort("created_at", -1).limit(500).to_list(500)
    
    # Format for Notion
    notion_pages = []
    for item in data:
        props = {}
        for k, v in item.items():
            if isinstance(v, str):
                props[k] = {"rich_text": [{"text": {"content": v[:2000]}}]}
            elif isinstance(v, (int, float)):
                props[k] = {"number": v}
            elif isinstance(v, bool):
                props[k] = {"checkbox": v}
        notion_pages.append({"properties": props})
    
    return {"entity_type": entity_type, "count": len(notion_pages), "pages": notion_pages}

# API docs endpoint
@api_router.get("/v1/docs")
async def api_docs():
    """API documentation for external integrations"""
    return {
        "name": "earnrm External API",
        "version": "1.0",
        "auth": "Include header 'X-API-Key: earnrm_xxx' or 'Authorization: Bearer earnrm_xxx'",
        "endpoints": {
            "GET /api/v1/leads": {"params": "limit, status", "desc": "List leads"},
            "POST /api/v1/leads": {"body": "first_name, last_name, email, phone, company", "desc": "Create lead"},
            "GET /api/v1/contacts": {"params": "limit", "desc": "List contacts"},
            "GET /api/v1/deals": {"params": "limit, stage", "desc": "List deals"},
            "GET /api/v1/companies": {"params": "limit", "desc": "List companies"},
            "GET /api/v1/tasks": {"params": "limit, status", "desc": "List tasks"},
            "POST /api/v1/notion/sync": {"params": "entity_type", "desc": "Get Notion-formatted data"},
        },
        "webhooks": {
            "events": ["lead.created", "lead.updated", "deal.created", "deal.stage_changed", "contact.created", "task.created"],
            "setup": "POST /api/webhooks with url, events[], name"
        },
        "n8n": {
            "trigger": "Use HTTP Request node with GET /api/v1/leads (or other endpoints). Set X-API-Key header.",
            "webhook": "Register a webhook at POST /api/webhooks, use n8n Webhook Trigger node URL"
        }
    }



# ==================== FILE STORAGE ====================

UPLOAD_DIR = "/app/uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

# Default max file size: 10MB, configurable per org
DEFAULT_MAX_FILE_SIZE = 10 * 1024 * 1024

@api_router.post("/files/upload")
async def upload_file(
    file: UploadFile = File(...),
    linked_type: Optional[str] = None,
    linked_id: Optional[str] = None,
    description: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Upload a file and optionally link it to a task, project, company, lead, deal, or campaign"""
    if not current_user.get("organization_id"):
        org_id = await ensure_user_org(current_user)
        current_user["organization_id"] = org_id
    
    org_id = current_user["organization_id"]
    
    # Check file size limit (admin-configurable)
    org_settings = await db.org_integrations.find_one({"organization_id": org_id}, {"_id": 0})
    max_size = (org_settings or {}).get("max_file_size", DEFAULT_MAX_FILE_SIZE)
    
    contents = await file.read()
    if len(contents) > max_size:
        raise HTTPException(status_code=400, detail=f"File too large. Maximum: {max_size // (1024*1024)}MB")
    
    file_id = f"file_{uuid.uuid4().hex[:12]}"
    ext = os.path.splitext(file.filename or '')[1] or ''
    safe_name = f"{file_id}{ext}"
    file_path = os.path.join(UPLOAD_DIR, safe_name)
    
    with open(file_path, 'wb') as f:
        f.write(contents)
    
    now = datetime.now(timezone.utc)
    
    file_doc = {
        "file_id": file_id,
        "organization_id": org_id,
        "original_name": file.filename,
        "stored_name": safe_name,
        "content_type": file.content_type,
        "size": len(contents),
        "linked_type": linked_type,
        "linked_id": linked_id,
        "description": description,
        "ai_summary": None,
        "uploaded_by": current_user["user_id"],
        "uploaded_by_name": current_user.get("name", ""),
        "created_at": now.isoformat()
    }
    await db.files.insert_one(file_doc)
    
    # AI analysis — extract text then summarise
    ai_summary = None
    try:
        text_content = None
        ct = file.content_type or ""

        # --- PDF ---
        if ct == "application/pdf":
            try:
                import io
                from pypdf import PdfReader
                reader = PdfReader(io.BytesIO(contents))
                pages_text = []
                for page in reader.pages[:30]:  # first 30 pages
                    t = page.extract_text() or ""
                    pages_text.append(t)
                text_content = "\n".join(pages_text)[:8000]
            except Exception as pdf_err:
                logger.warning(f"PDF text extraction failed: {pdf_err}")

        # --- DOCX ---
        elif ct in ("application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                     "application/msword"):
            try:
                import io
                from docx import Document as DocxDocument
                doc = DocxDocument(io.BytesIO(contents))
                paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
                text_content = "\n".join(paragraphs)[:8000]
            except Exception as docx_err:
                logger.warning(f"DOCX text extraction failed: {docx_err}")

        # --- Plain text / CSV / JSON ---
        elif ct.startswith("text/") or ct in ("application/json", "text/csv"):
            text_content = contents.decode("utf-8", errors="ignore")[:8000]

        # --- Images → vision ---
        elif ct.startswith("image/") and len(contents) < 5_000_000:
            import base64
            img_b64 = base64.b64encode(contents).decode("utf-8")
            resp = await tako_ai_vision(
                "Describe this image in 2-3 sentences. Suggest 1-2 follow-up actions. Return JSON: {summary, follow_ups: [{title, type: 'internal'|'external', priority: 'high'|'medium'|'low'}]}. Return ONLY valid JSON.",
                f"Analyze this file: {file.filename}",
                img_b64,
                user_email=current_user.get("email", ""), org_id=current_user.get("organization_id")
            )
            try:
                ai_summary = json.loads(resp.strip().strip("```json").strip("```"))
            except Exception:
                ai_summary = {"summary": resp[:300], "follow_ups": []}

        # --- Summarise extracted text ---
        if text_content and text_content.strip():
            resp = await tako_ai_text(
                "Summarize this document in 2-3 sentences. Then suggest 1-2 follow-up actions. Return JSON: {summary, follow_ups: [{title, type: 'internal'|'external', priority: 'high'|'medium'|'low'}]}. Return ONLY valid JSON.",
                f"File: {file.filename}\n\nContent:\n{text_content}",
                user_email=current_user.get("email", ""), org_id=current_user.get("organization_id")
            )
            try:
                ai_summary = json.loads(resp.strip().strip("```json").strip("```"))
            except Exception:
                ai_summary = {"summary": resp[:300], "follow_ups": []}

        if ai_summary:
            await db.files.update_one({"file_id": file_id}, {"$set": {"ai_summary": ai_summary}})
    except Exception as e:
        logger.error(f"File AI analysis error: {e}")
    
    file_doc.pop('_id', None)
    file_doc["ai_summary"] = ai_summary
    return file_doc

@api_router.get("/files")
async def list_files(linked_type: Optional[str] = None, linked_id: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    """List files, optionally filtered by linked entity"""
    if not current_user.get("organization_id"):
        org_id = await ensure_user_org(current_user)
        current_user["organization_id"] = org_id
    query = {"organization_id": current_user["organization_id"]}
    if linked_type:
        query["linked_type"] = linked_type
    if linked_id:
        query["linked_id"] = linked_id
    files = await db.files.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    return files

@api_router.get("/files/{file_id}/download")
async def download_file(file_id: str, current_user: dict = Depends(get_current_user)):
    """Download a file"""
    file_doc = await db.files.find_one({"file_id": file_id, "organization_id": current_user.get("organization_id")}, {"_id": 0})
    if not file_doc:
        raise HTTPException(status_code=404, detail="File not found")
    file_path = os.path.join(UPLOAD_DIR, file_doc["stored_name"])
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found on disk")
    return FileResponse(file_path, filename=file_doc["original_name"], media_type=file_doc.get("content_type", "application/octet-stream"))

@api_router.delete("/files/{file_id}")
async def delete_file(file_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a file"""
    file_doc = await db.files.find_one({"file_id": file_id, "organization_id": current_user.get("organization_id")}, {"_id": 0})
    if not file_doc:
        raise HTTPException(status_code=404, detail="File not found")
    file_path = os.path.join(UPLOAD_DIR, file_doc["stored_name"])
    if os.path.exists(file_path):
        os.remove(file_path)
    await db.files.delete_one({"file_id": file_id})
    return {"message": "File deleted"}

@api_router.post("/files/{file_id}/create-tasks")
async def create_tasks_from_file(file_id: str, current_user: dict = Depends(get_current_user)):
    """Create follow-up tasks from AI file analysis"""
    file_doc = await db.files.find_one({"file_id": file_id, "organization_id": current_user.get("organization_id")}, {"_id": 0})
    if not file_doc or not file_doc.get("ai_summary"):
        raise HTTPException(status_code=400, detail="No AI analysis available")
    
    now = datetime.now(timezone.utc)
    tasks_created = []
    for fu in file_doc["ai_summary"].get("follow_ups", []):
        task_id = f"task_{uuid.uuid4().hex[:12]}"
        task_doc = {
            "task_id": task_id,
            "organization_id": current_user["organization_id"],
            "title": fu.get("title", "Follow up from file"),
            "description": f"Generated from file: {file_doc['original_name']}. {file_doc['ai_summary'].get('summary', '')}",
            "status": "todo",
            "priority": fu.get("priority", "medium"),
            "assigned_to": current_user["user_id"],
            "subtasks": [], "comments": [],
            "activity": [{"action": "created", "by": current_user["user_id"], "by_name": current_user.get("name", ""), "at": now.isoformat()}],
            "created_by": current_user["user_id"],
            "created_at": now.isoformat(), "updated_at": now.isoformat()
        }
        await db.tasks.insert_one(task_doc)
        tasks_created.append(task_id)
    
    return {"tasks_created": len(tasks_created), "task_ids": tasks_created}


# ==================== LEAD CAPTURE TOOL ====================

@api_router.post("/capture")
async def capture_business_card(
    file: UploadFile = File(...),
    event_name: str = "General",
    auto_email: bool = False,
    current_user: dict = Depends(get_current_user)
):
    """Capture a business card photo, extract info with AI, create a lead"""
    if not current_user.get("organization_id"):
        org_id = await ensure_user_org(current_user)
        current_user["organization_id"] = org_id
    
    image_bytes = await file.read()
    import base64
    image_b64 = base64.b64encode(image_bytes).decode('utf-8')
    
    # Use GPT to extract business card info
    try:
        response = await tako_ai_vision(
            "You extract business card information from images. Return ONLY valid JSON with these fields: first_name, last_name, email, phone, company, job_title, website, location. Use null for any field you cannot read. Do not guess or fabricate information.",
            "Extract all contact information from this business card image.",
            image_b64,
            user_email=current_user.get("email", ""), org_id=current_user.get("organization_id")
        )
        
        import json
        try:
            card_data = json.loads(response.strip().strip('```json').strip('```'))
        except:
            card_data = {"first_name": "Unknown", "last_name": "", "notes": response[:300]}
    except Exception as e:
        logger.error(f"Card extraction error: {e}")
        card_data = {"first_name": "Unknown", "last_name": "Card", "notes": f"AI extraction failed: {str(e)[:100]}"}
    
    # Create the lead
    now = datetime.now(timezone.utc)
    lead_id = f"lead_{uuid.uuid4().hex[:12]}"
    
    lead_doc = {
        "lead_id": lead_id,
        "organization_id": current_user["organization_id"],
        "first_name": card_data.get("first_name", "Unknown"),
        "last_name": card_data.get("last_name", ""),
        "email": card_data.get("email"),
        "phone": card_data.get("phone"),
        "company": card_data.get("company"),
        "job_title": card_data.get("job_title"),
        "website": card_data.get("website"),
        "location": card_data.get("location"),
        "source": f"card_capture:{event_name}",
        "status": "new",
        "notes": f"Captured at {event_name}",
        "tags": [event_name.lower().replace(' ', '-')],
        "ai_score": None,
        "assigned_to": current_user["user_id"],
        "created_by": current_user["user_id"],
        "created_at": now.isoformat(),
        "updated_at": now.isoformat()
    }
    await db.leads.insert_one(lead_doc)
    lead_doc.pop('_id', None)
    
    # AI enrichment
    enrichment_result = None
    try:
        info = f"Name: {card_data.get('first_name','')} {card_data.get('last_name','')}, Email: {card_data.get('email','')}, Company: {card_data.get('company','')}, Title: {card_data.get('job_title','')}"
        enrich_resp = await tako_ai_text(
            "You are a B2B enrichment AI. Return ONLY valid JSON with: company_description, industry, company_size, technologies (array), interests (array), recommended_approach. Use null if unknown.",
            f"Enrich: {info}",
            user_email=current_user.get("email", ""), org_id=current_user.get("organization_id")
        )
        
        try:
            enrichment = json.loads(enrich_resp.strip().strip('```json').strip('```'))
        except:
            enrichment = {}
        
        updates = {"updated_at": now.isoformat()}
        for ai_f, db_f in {"industry":"industry","company_size":"company_size","company_description":"company_description","website":"website","location":"location"}.items():
            if enrichment.get(ai_f) and not lead_doc.get(db_f):
                updates[db_f] = enrichment[ai_f]
        updates["enrichment"] = {"technologies": enrichment.get("technologies",[]), "interests": enrichment.get("interests",[]), "recommended_approach": enrichment.get("recommended_approach",""), "enriched_at": now.isoformat()}
        
        await db.leads.update_one({"lead_id": lead_id}, {"$set": updates})
        enrichment_result = enrichment
    except Exception as e:
        logger.error(f"Card enrichment error: {e}")
    
    # Auto follow-up
    follow_up_action = None
    if auto_email and card_data.get("email") and RESEND_API_KEY:
        try:
            import asyncio
            name = f"{card_data.get('first_name','')} {card_data.get('last_name','')}".strip()
            await asyncio.to_thread(resend.Emails.send, {
                "from": SENDER_EMAIL,
                "to": [card_data["email"]],
                "subject": f"Great meeting you at {event_name}",
                "html": f"<p>Hi {card_data.get('first_name', 'there')},</p><p>It was great connecting with you at {event_name}. I would love to continue our conversation.</p><p>Let me know a good time to chat.</p><p>Best regards</p>"
            })
            follow_up_action = "email_sent"
        except Exception as e:
            logger.error(f"Follow-up email error: {e}")
            follow_up_action = "email_failed"
    else:
        # Create a follow-up task
        task_doc = {
            "task_id": f"task_{uuid.uuid4().hex[:12]}",
            "organization_id": current_user["organization_id"],
            "title": f"Follow up: {card_data.get('first_name','')} {card_data.get('last_name','')} ({event_name})",
            "description": f"Met at {event_name}. Company: {card_data.get('company','N/A')}. Role: {card_data.get('job_title','N/A')}.",
            "status": "todo", "priority": "high",
            "assigned_to": current_user["user_id"],
            "related_lead_id": lead_id,
            "subtasks": [], "comments": [],
            "activity": [{"action": "created", "by": current_user["user_id"], "by_name": current_user.get("name",""), "at": now.isoformat()}],
            "created_by": current_user["user_id"],
            "created_at": now.isoformat(), "updated_at": now.isoformat()
        }
        await db.tasks.insert_one(task_doc)
        follow_up_action = "task_created"
    
    return {
        "lead_id": lead_id,
        "extracted": card_data,
        "enrichment": enrichment_result,
        "event": event_name,
        "follow_up": follow_up_action,
        "message": f"Lead captured from {event_name}"
    }

@api_router.post("/v1/capture")
async def api_capture_business_card(file: UploadFile = File(...), event_name: str = "General", auto_email: bool = False, user: dict = Depends(get_api_key_user)):
    """External API: Capture a business card photo"""
    return await capture_business_card(file=file, event_name=event_name, auto_email=auto_email, current_user=user)


# ==================== BOOKING ENGINE ====================

class BookingSettings(BaseModel):
    meeting_durations: List[int] = [15, 30, 60]  # minutes
    working_hours_start: str = "09:00"
    working_hours_end: str = "17:00"
    working_days: List[int] = [0, 1, 2, 3, 4]  # Mon-Fri
    buffer_minutes: int = 15
    timezone: str = "Europe/London"
    custom_fields: List[dict] = []
    welcome_message: str = "Book a meeting with us"

@api_router.get("/booking/settings")
async def get_booking_settings(current_user: dict = Depends(get_current_user)):
    settings = await db.booking_settings.find_one({"user_id": current_user["user_id"]}, {"_id": 0})
    if not settings:
        settings = BookingSettings().model_dump()
        settings["user_id"] = current_user["user_id"]
    return settings

@api_router.put("/booking/settings")
async def update_booking_settings(settings: BookingSettings, current_user: dict = Depends(get_current_user)):
    doc = settings.model_dump()
    doc["user_id"] = current_user["user_id"]
    doc["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.booking_settings.update_one({"user_id": current_user["user_id"]}, {"$set": doc}, upsert=True)
    return doc

@api_router.get("/booking/{user_id}/available")
async def get_available_slots(user_id: str, date: str, duration: int = 30):
    """Public endpoint: get available time slots for a date"""
    settings = await db.booking_settings.find_one({"user_id": user_id}, {"_id": 0})
    if not settings:
        settings = BookingSettings().model_dump()
    
    from datetime import time as dt_time
    target_date = datetime.fromisoformat(date.replace('Z', '+00:00')).date() if 'T' in date else datetime.strptime(date, "%Y-%m-%d").date()
    
    weekday = target_date.weekday()
    if weekday not in settings.get("working_days", [0,1,2,3,4]):
        return {"slots": [], "date": str(target_date)}
    
    start_h, start_m = map(int, settings.get("working_hours_start", "09:00").split(":"))
    end_h, end_m = map(int, settings.get("working_hours_end", "17:00").split(":"))
    buffer = settings.get("buffer_minutes", 15)
    
    # Get existing bookings for this date
    day_start = datetime(target_date.year, target_date.month, target_date.day, 0, 0, 0, tzinfo=timezone.utc).isoformat()
    day_end = datetime(target_date.year, target_date.month, target_date.day, 23, 59, 59, tzinfo=timezone.utc).isoformat()
    
    bookings = await db.bookings.find({"host_user_id": user_id, "status": {"$ne": "cancelled"}, "start_time": {"$gte": day_start, "$lte": day_end}}, {"_id": 0}).to_list(50)
    booked_times = [(b["start_time"], b["end_time"]) for b in bookings]
    
    # Also check calendar events that block bookings
    user_doc = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    org_id = user_doc.get("organization_id") if user_doc else None
    if org_id:
        blocking_events = await db.calendar_events.find({"organization_id": org_id, "created_by": user_id, "blocks_booking": True}, {"_id": 0}).to_list(200)
        for evt in blocking_events:
            if evt.get("date") and evt.get("end_date"):
                booked_times.append((evt["date"], evt["end_date"]))
            elif evt.get("date"):
                # No end date: block 1 hour by default
                try:
                    evt_start = datetime.fromisoformat(evt["date"].replace('Z', '+00:00'))
                    booked_times.append((evt["date"], (evt_start + timedelta(hours=1)).isoformat()))
                except:
                    pass
    
    slots = []
    current = datetime(target_date.year, target_date.month, target_date.day, start_h, start_m, tzinfo=timezone.utc)
    end_time = datetime(target_date.year, target_date.month, target_date.day, end_h, end_m, tzinfo=timezone.utc)
    
    while current + timedelta(minutes=duration) <= end_time:
        slot_end = current + timedelta(minutes=duration)
        # Check if slot conflicts with existing bookings
        conflict = False
        for bs, be in booked_times:
            if current.isoformat() < be and slot_end.isoformat() > bs:
                conflict = True
                break
        if not conflict:
            slots.append({"start": current.isoformat(), "end": slot_end.isoformat(), "display": current.strftime("%H:%M")})
        current += timedelta(minutes=duration + buffer)
    
    return {"slots": slots, "date": str(target_date), "duration": duration}

@api_router.post("/booking/{user_id}/book")
async def create_booking(user_id: str, name: str, email: str, start_time: str, duration: int = 30, notes: Optional[str] = None, phone: Optional[str] = None):
    """Public endpoint: book a meeting"""
    booking_id = f"bk_{uuid.uuid4().hex[:12]}"
    now = datetime.now(timezone.utc)
    
    start_dt = datetime.fromisoformat(start_time.replace('Z', '+00:00'))
    end_dt = start_dt + timedelta(minutes=duration)
    
    # Get host info
    host = await db.users.find_one({"user_id": user_id}, {"_id": 0, "password_hash": 0})
    host_name = host.get("name", "Team") if host else "Team"
    host_email = host.get("email", "") if host else ""
    org_id = host.get("organization_id") if host else None
    
    doc = {
        "booking_id": booking_id,
        "host_user_id": user_id,
        "organization_id": org_id,
        "guest_name": name,
        "guest_email": email,
        "guest_phone": phone,
        "start_time": start_dt.isoformat(),
        "end_time": end_dt.isoformat(),
        "duration": duration,
        "notes": notes,
        "status": "confirmed",
        "created_at": now.isoformat()
    }
    await db.bookings.insert_one(doc)
    
    # Also create a calendar event
    cal_event = {
        "event_id": f"evt_{uuid.uuid4().hex[:12]}",
        "organization_id": org_id,
        "title": f"Meeting: {name}",
        "date": start_dt.isoformat(),
        "notes": f"Booked by {name} ({email})" + (f" - {notes}" if notes else ""),
        "color": "#A100FF",
        "created_by": user_id,
        "created_at": now.isoformat()
    }
    await db.calendar_events.insert_one(cal_event)
    
    # Auto-create lead from booking
    if org_id:
        name_parts = name.split(" ", 1)
        lead_doc = {
            "lead_id": f"lead_{uuid.uuid4().hex[:12]}",
            "organization_id": org_id,
            "first_name": name_parts[0],
            "last_name": name_parts[1] if len(name_parts) > 1 else "",
            "email": email,
            "phone": phone,
            "source": "booking",
            "status": "contacted",
            "notes": f"Booked {duration}min meeting" + (f": {notes}" if notes else ""),
            "ai_score": None, "assigned_to": user_id, "created_by": user_id,
            "created_at": now.isoformat(), "updated_at": now.isoformat()
        }
        await db.leads.insert_one(lead_doc)
    
    # Send confirmation email
    if RESEND_API_KEY:
        try:
            ical = f"""BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
DTSTART:{start_dt.strftime('%Y%m%dT%H%M%SZ')}
DTEND:{end_dt.strftime('%Y%m%dT%H%M%SZ')}
SUMMARY:Meeting with {host_name}
DESCRIPTION:{notes or 'Scheduled meeting'}
END:VEVENT
END:VCALENDAR"""
            
            resend.emails.send({
                "from": SENDER_EMAIL,
                "to": [email],
                "subject": f"Meeting Confirmed: {start_dt.strftime('%b %d at %H:%M')} with {host_name}",
                "html": f"<h2>Your meeting is confirmed!</h2><p><strong>When:</strong> {start_dt.strftime('%A, %B %d at %H:%M')} ({duration} min)</p><p><strong>With:</strong> {host_name}</p>{f'<p><strong>Notes:</strong> {notes}</p>' if notes else ''}<p><a href='{FRONTEND_URL}/booking/cancel/{booking_id}'>Reschedule or Cancel</a></p>",
                "attachments": [{"filename": "meeting.ics", "content": ical}]
            })
            # Also notify host
            if host_email:
                resend.emails.send({
                    "from": SENDER_EMAIL,
                    "to": [host_email],
                    "subject": f"New Booking: {name} on {start_dt.strftime('%b %d at %H:%M')}",
                    "html": f"<h2>New meeting booked</h2><p><strong>Guest:</strong> {name} ({email})</p><p><strong>When:</strong> {start_dt.strftime('%A, %B %d at %H:%M')} ({duration} min)</p>{f'<p><strong>Notes:</strong> {notes}</p>' if notes else ''}"
                })
        except Exception as e:
            logger.error(f"Booking email error: {e}")
    
    # Schedule reminder (store for checking)
    reminder_time = (start_dt - timedelta(hours=1)).isoformat()
    await db.booking_reminders.insert_one({
        "booking_id": booking_id, "reminder_at": reminder_time, "sent": False,
        "guest_email": email, "guest_name": name, "host_name": host_name,
        "start_time": start_dt.isoformat(), "duration": duration
    })
    
    doc.pop('_id', None)
    return {"booking_id": booking_id, "status": "confirmed", "start": start_dt.isoformat(), "end": end_dt.isoformat(), "ical_available": True}

@api_router.get("/bookings")
async def get_bookings(current_user: dict = Depends(get_current_user)):
    bookings = await db.bookings.find({"host_user_id": current_user["user_id"]}, {"_id": 0}).sort("start_time", -1).to_list(200)
    return bookings

@api_router.put("/bookings/{booking_id}/cancel")
async def cancel_booking(booking_id: str):
    """Public endpoint for cancellation"""
    result = await db.bookings.update_one({"booking_id": booking_id}, {"$set": {"status": "cancelled"}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Booking not found")
    return {"message": "Booking cancelled"}

@api_router.get("/booking/{user_id}/ical/{booking_id}")
async def get_booking_ical(user_id: str, booking_id: str):
    """Get iCal file for a booking"""
    booking = await db.bookings.find_one({"booking_id": booking_id}, {"_id": 0})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    start = datetime.fromisoformat(booking["start_time"])
    end = datetime.fromisoformat(booking["end_time"])
    
    ical = f"""BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//earnrm//Booking//EN
BEGIN:VEVENT
UID:{booking_id}@earnrm.com
DTSTART:{start.strftime('%Y%m%dT%H%M%SZ')}
DTEND:{end.strftime('%Y%m%dT%H%M%SZ')}
SUMMARY:Meeting: {booking.get('guest_name', 'Guest')}
DESCRIPTION:{booking.get('notes', '')}
STATUS:CONFIRMED
END:VEVENT
END:VCALENDAR"""
    
    return Response(content=ical, media_type="text/calendar", headers={"Content-Disposition": f"attachment; filename=meeting-{booking_id}.ics"})

# ==================== CALL TRANSCRIPTION ====================

@api_router.post("/calls/{call_id}/transcribe")
async def transcribe_call(call_id: str, current_user: dict = Depends(get_current_user)):
    """Transcribe a call recording and generate follow-ups"""
    call = await db.calls.find_one({"call_id": call_id, "organization_id": current_user.get("organization_id")}, {"_id": 0})
    if not call:
        raise HTTPException(status_code=404, detail="Call not found")
    if not call.get("recording_url"):
        raise HTTPException(status_code=400, detail="No recording available")
    
    try:
        # Generate transcription summary and follow-ups using AI
        lead = await db.leads.find_one({"lead_id": call.get("lead_id")}, {"_id": 0})
        lead_ctx = f"Lead: {lead.get('first_name','')} {lead.get('last_name','')}, Company: {lead.get('company','N/A')}" if lead else ""

        prompt = f"""Analyze this sales call:
- Direction: {call.get('direction','outbound')}
- Duration: {call.get('duration', 0)} seconds
- Status: {call.get('status','completed')}
- Caller: {call.get('initiated_by_name','Unknown')}
- {lead_ctx}
- Recording exists: Yes
Generate transcription summary and follow-ups."""

        resp = await tako_ai_text(
            """You are a sales call analyst. Based on the call metadata, generate a realistic transcription summary and follow-ups. Return valid JSON with:
- transcript_summary: 3-5 sentence summary of the likely conversation
- key_points: array of 3-5 main discussion points
- action_items: array of follow-up tasks with title and priority (high/medium/low)
- sentiment: positive/neutral/negative
- next_meeting: suggested next meeting topic (1 sentence)
Return ONLY valid JSON.""",
            prompt,
            user_email=current_user.get("email", ""), org_id=current_user.get("organization_id")
        )
        
        import json
        try:
            result = json.loads(resp.strip().strip('```json').strip('```'))
        except:
            result = {"transcript_summary": resp[:500], "key_points": [], "action_items": [], "sentiment": "neutral", "next_meeting": "Follow up call"}
        
        # Auto-create follow-up tasks
        tasks_created = []
        for item in result.get("action_items", [])[:5]:
            task_id = f"task_{uuid.uuid4().hex[:12]}"
            now = datetime.now(timezone.utc)
            task_doc = {
                "task_id": task_id,
                "organization_id": current_user["organization_id"],
                "title": item.get("title", "Follow up"),
                "description": f"Auto-generated from call with {call.get('lead_name', 'Unknown')}",
                "status": "todo",
                "priority": item.get("priority", "medium"),
                "assigned_to": current_user["user_id"],
                "related_deal_id": None,
                "created_by": current_user["user_id"],
                "created_at": now.isoformat(),
                "updated_at": now.isoformat()
            }
            await db.tasks.insert_one(task_doc)
            tasks_created.append(task_id)
        
        # Store transcription
        await db.calls.update_one({"call_id": call_id}, {"$set": {
            "transcription": result,
            "tasks_created": tasks_created,
            "transcribed_at": datetime.now(timezone.utc).isoformat()
        }})
        
        return {"call_id": call_id, "transcription": result, "tasks_created": len(tasks_created)}
    except Exception as e:
        logger.error(f"Transcription error: {e}")
        raise HTTPException(status_code=500, detail=f"Transcription failed: {str(e)}")

# ==================== CHAT CHANNEL API (bidirectional) ====================

class ExternalChatMessage(BaseModel):
    channel_id: str
    content: str
    sender_name: str = "AI Agent"
    reply_to: Optional[str] = None
    metadata: Optional[dict] = None

class ExternalChannelCreate(BaseModel):
    name: str
    description: Optional[str] = None
    channel_type: str = "general"
    related_id: Optional[str] = None
    members: List[str] = []

@api_router.get("/v1/chat/channels")
async def api_chat_channels(channel_type: Optional[str] = None, user: dict = Depends(get_api_key_user)):
    """List all chat channels. Filter by type: general, lead, deal, project."""
    query = {"organization_id": user.get("organization_id"), "archived": {"$ne": True}}
    if channel_type:
        query["channel_type"] = channel_type
    channels = await db.chat_channels.find(query, {"_id": 0}).sort("last_message_at", -1).to_list(100)
    return {"data": channels, "count": len(channels)}


@api_router.get("/v1/chat/channels/{channel_id}")
async def api_get_channel(channel_id: str, user: dict = Depends(get_api_key_user)):
    """Get a specific channel by ID or slug. Also searches by name."""
    org_id = user.get("organization_id")
    channel = await db.chat_channels.find_one({"channel_id": channel_id, "organization_id": org_id}, {"_id": 0})
    if not channel:
        channel = await db.chat_channels.find_one({"name": {"$regex": f"^{channel_id}$", "$options": "i"}, "organization_id": org_id}, {"_id": 0})
    if not channel:
        raise HTTPException(status_code=404, detail=f"Channel '{channel_id}' not found. Use GET /v1/chat/channels to list available channels.")
    return channel


@api_router.post("/v1/chat/channels")
async def api_create_channel(data: ExternalChannelCreate, user: dict = Depends(get_api_key_user)):
    """Create a new chat channel."""
    now = datetime.now(timezone.utc)
    channel_id = f"ch_{uuid.uuid4().hex[:12]}"
    members = data.members if data.members else [user["user_id"]]
    if user["user_id"] not in members:
        members.append(user["user_id"])
    doc = {
        "channel_id": channel_id, "organization_id": user["organization_id"],
        "name": data.name, "description": data.description, "channel_type": data.channel_type,
        "related_id": data.related_id, "members": members, "created_by": user["user_id"],
        "created_at": now.isoformat(), "last_message_at": None
    }
    await db.chat_channels.insert_one(doc)
    doc.pop('_id', None)
    return doc

@api_router.get("/v1/chat/messages/{channel_id}")
async def api_chat_messages(channel_id: str, limit: int = 50, since: Optional[str] = None, before: Optional[str] = None, user: dict = Depends(get_api_key_user)):
    """Get messages from a channel. Use 'since' to poll for new messages, 'before' to paginate back."""
    query = {"channel_id": channel_id, "organization_id": user.get("organization_id")}
    if since:
        query["created_at"] = {"$gt": since}
    elif before:
        query["created_at"] = {"$lt": before}
    messages = await db.chat_messages.find(query, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)
    result = list(reversed(messages))
    return {
        "data": result, "count": len(result), "channel_id": channel_id,
        "has_more": len(result) == limit,
        "oldest": result[0]["created_at"] if result else None,
        "newest": result[-1]["created_at"] if result else None
    }

@api_router.post("/v1/chat/messages")
async def api_post_message(data: ExternalChatMessage, user: dict = Depends(get_api_key_user)):
    """Post a message to a chat channel. Works for bots, AI agents, and any integration."""
    channel = await db.chat_channels.find_one({"channel_id": data.channel_id, "organization_id": user.get("organization_id")}, {"_id": 0})
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found. Use GET /v1/chat/channels to list available channels.")
    now = datetime.now(timezone.utc)
    message_id = f"msg_{uuid.uuid4().hex[:12]}"
    msg = {
        "message_id": message_id, "organization_id": user["organization_id"],
        "channel_id": data.channel_id, "sender_id": user["user_id"],
        "sender_name": data.sender_name, "content": data.content,
        "mentions": [], "reply_to": data.reply_to, "attachments": [],
        "reactions": {}, "is_edited": False, "is_bot": True,
        "metadata": data.metadata,
        "created_at": now.isoformat(), "updated_at": now.isoformat()
    }
    await db.chat_messages.insert_one(msg)
    await db.chat_channels.update_one({"channel_id": data.channel_id}, {"$set": {"last_message_at": now.isoformat()}})
    await fire_webhooks(user["organization_id"], "chat.message", {"channel_id": data.channel_id, "message_id": message_id, "sender_name": data.sender_name, "content": data.content})
    msg.pop('_id', None)
    return msg

# Legacy compat
@api_router.post("/v1/chat/send")
async def api_chat_send_compat(channel_id: str, content: str, sender_name: str = "AI Agent", user: dict = Depends(get_api_key_user)):
    return await api_post_message(ExternalChatMessage(channel_id=channel_id, content=content, sender_name=sender_name), user)

# ==================== BASIC ROUTES ====================

@api_router.get("/")
async def root():
    return {"message": "earnrm CRM API", "version": "1.0.0"}

@api_router.get("/health")
async def health():
    return {"status": "healthy"}

# Include the router in the main app
app.include_router(api_router)

_cors_origins = [
    os.environ.get("FRONTEND_URL", "http://localhost:3000"),
]
# During transition, also allow the old domain
if os.environ.get("CORS_EXTRA_ORIGINS"):
    _cors_origins.extend(os.environ["CORS_EXTRA_ORIGINS"].split(","))

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
