from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Header
from fastapi.responses import Response
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
import jwt
import bcrypt
import asyncio
import resend
from io import BytesIO
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from reportlab.lib.units import inch

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Secret
JWT_SECRET = os.environ.get('JWT_SECRET', 'flooring-store-secret-key-2024')
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24

# Resend config
RESEND_API_KEY = os.environ.get('RESEND_API_KEY', '')
SENDER_EMAIL = os.environ.get('SENDER_EMAIL', 'onboarding@resend.dev')
if RESEND_API_KEY:
    resend.api_key = RESEND_API_KEY

# Stripe config
STRIPE_API_KEY = os.environ.get('STRIPE_API_KEY', '')

# Create the main app
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ===================== MODELS =====================

class UserBase(BaseModel):
    email: EmailStr
    name: str
    role: str = "employee"  # owner or employee

class UserCreate(UserBase):
    password: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class User(UserBase):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class UserResponse(BaseModel):
    id: str
    email: str
    name: str
    role: str

class TokenResponse(BaseModel):
    token: str
    user: UserResponse

class ProductBase(BaseModel):
    name: str
    sku: str
    category: str
    cost_price: float
    selling_price: float
    sqft_per_box: float
    stock_boxes: int = 0
    description: Optional[str] = ""
    supplier: Optional[str] = ""

class Product(ProductBase):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class CustomerBase(BaseModel):
    name: str
    email: Optional[str] = ""
    phone: Optional[str] = ""
    address: Optional[str] = ""
    city: Optional[str] = ""
    state: Optional[str] = ""
    zip_code: Optional[str] = ""
    notes: Optional[str] = ""

class Customer(CustomerBase):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class InvoiceItem(BaseModel):
    product_id: str
    product_name: str
    sqft_needed: float
    sqft_per_box: float
    boxes_needed: int
    unit_price: float
    total_price: float

class InvoiceBase(BaseModel):
    customer_id: str
    customer_name: str
    customer_email: Optional[str] = ""
    customer_phone: Optional[str] = ""
    customer_address: Optional[str] = ""
    items: List[InvoiceItem]
    subtotal: float
    tax_rate: float = 0.0
    tax_amount: float = 0.0
    discount: float = 0.0
    total: float
    notes: Optional[str] = ""
    status: str = "draft"  # draft, sent, paid, cancelled
    is_estimate: bool = False

class Invoice(InvoiceBase):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    invoice_number: str = ""
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: str = ""

class LeadBase(BaseModel):
    name: str
    email: Optional[str] = ""
    phone: Optional[str] = ""
    source: str = "manual"  # manual, facebook, website
    status: str = "new"  # new, contacted, qualified, proposal, won, lost
    notes: Optional[str] = ""
    project_type: Optional[str] = ""
    estimated_sqft: Optional[float] = 0.0

class Lead(LeadBase):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ExpenseBase(BaseModel):
    category: str  # supplier, employee, contractor, utilities, rent, other
    description: str
    amount: float
    payment_method: Optional[str] = "cash"
    reference_number: Optional[str] = ""
    vendor_name: Optional[str] = ""
    date: str  # ISO date string

class Expense(ExpenseBase):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: str = ""

class ContractorBase(BaseModel):
    name: str
    company: Optional[str] = ""
    phone: str
    email: Optional[str] = ""
    specialty: Optional[str] = ""
    address: Optional[str] = ""
    notes: Optional[str] = ""
    rating: Optional[int] = 5

class Contractor(ContractorBase):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class PaymentTransaction(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    session_id: str
    amount: float
    currency: str = "usd"
    status: str = "pending"  # pending, paid, failed, expired
    payment_status: str = "initiated"
    invoice_id: Optional[str] = None
    customer_email: Optional[str] = None
    metadata: Optional[Dict[str, str]] = {}
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class SettingsBase(BaseModel):
    company_name: str = ""
    company_address: str = ""
    company_phone: str = ""
    company_email: str = ""
    tax_rate: float = 0.0
    facebook_api_token: Optional[str] = ""
    facebook_page_id: Optional[str] = ""

class Settings(SettingsBase):
    id: str = "company_settings"
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# New Models for additional features

class ManualPaymentBase(BaseModel):
    invoice_id: str
    amount: float
    payment_method: str = "cash"  # cash, check, bank_transfer, card, other
    reference_number: Optional[str] = ""
    notes: Optional[str] = ""
    date: str  # ISO date string

class ManualPayment(ManualPaymentBase):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: str = ""

class MessageBase(BaseModel):
    title: str
    content: str
    priority: str = "normal"  # low, normal, high, urgent

class Message(MessageBase):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: str = ""
    created_by_name: str = ""
    read_by: List[str] = []

class PasswordChangeRequest(BaseModel):
    current_password: str
    new_password: str

class CreateEmployeeRequest(BaseModel):
    name: str
    email: EmailStr
    password: str

# ===================== AUTH HELPERS =====================

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def create_token(user_id: str, email: str, role: str) -> str:
    payload = {
        "user_id": user_id,
        "email": email,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION_HOURS)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(authorization: str = Header(None)) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid authorization header")
    
    token = authorization.replace("Bearer ", "")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

def require_owner(current_user: dict = Depends(get_current_user)):
    if current_user.get("role") != "owner":
        raise HTTPException(status_code=403, detail="Owner access required")
    return current_user

# ===================== AUTH ROUTES =====================

@api_router.post("/auth/register", response_model=TokenResponse)
async def register(user_data: UserCreate):
    existing = await db.users.find_one({"email": user_data.email}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # First user becomes owner
    user_count = await db.users.count_documents({})
    role = "owner" if user_count == 0 else user_data.role
    
    user = User(
        email=user_data.email,
        name=user_data.name,
        role=role
    )
    
    user_dict = user.model_dump()
    user_dict['password'] = hash_password(user_data.password)
    user_dict['created_at'] = user_dict['created_at'].isoformat()
    
    await db.users.insert_one(user_dict)
    
    token = create_token(user.id, user.email, user.role)
    
    return TokenResponse(
        token=token,
        user=UserResponse(id=user.id, email=user.email, name=user.name, role=user.role)
    )

@api_router.post("/auth/login", response_model=TokenResponse)
async def login(credentials: UserLogin):
    user = await db.users.find_one({"email": credentials.email}, {"_id": 0})
    if not user or not verify_password(credentials.password, user['password']):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    token = create_token(user['id'], user['email'], user['role'])
    
    return TokenResponse(
        token=token,
        user=UserResponse(id=user['id'], email=user['email'], name=user['name'], role=user['role'])
    )

@api_router.get("/auth/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    user = await db.users.find_one({"id": current_user['user_id']}, {"_id": 0, "password": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return UserResponse(**user)

# ===================== PRODUCT ROUTES =====================

@api_router.post("/products", response_model=Product)
async def create_product(product_data: ProductBase, current_user: dict = Depends(get_current_user)):
    product = Product(**product_data.model_dump())
    product_dict = product.model_dump()
    product_dict['created_at'] = product_dict['created_at'].isoformat()
    product_dict['updated_at'] = product_dict['updated_at'].isoformat()
    
    await db.products.insert_one(product_dict)
    return product

@api_router.get("/products", response_model=List[Product])
async def get_products(current_user: dict = Depends(get_current_user)):
    products = await db.products.find({}, {"_id": 0}).to_list(1000)
    return products

@api_router.get("/products/{product_id}", response_model=Product)
async def get_product(product_id: str, current_user: dict = Depends(get_current_user)):
    product = await db.products.find_one({"id": product_id}, {"_id": 0})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return product

@api_router.put("/products/{product_id}", response_model=Product)
async def update_product(product_id: str, product_data: ProductBase, current_user: dict = Depends(get_current_user)):
    update_dict = product_data.model_dump()
    update_dict['updated_at'] = datetime.now(timezone.utc).isoformat()
    
    result = await db.products.update_one(
        {"id": product_id},
        {"$set": update_dict}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Product not found")
    
    product = await db.products.find_one({"id": product_id}, {"_id": 0})
    return product

@api_router.delete("/products/{product_id}")
async def delete_product(product_id: str, current_user: dict = Depends(require_owner)):
    result = await db.products.delete_one({"id": product_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Product not found")
    return {"message": "Product deleted"}

# ===================== CUSTOMER ROUTES =====================

@api_router.post("/customers", response_model=Customer)
async def create_customer(customer_data: CustomerBase, current_user: dict = Depends(get_current_user)):
    customer = Customer(**customer_data.model_dump())
    customer_dict = customer.model_dump()
    customer_dict['created_at'] = customer_dict['created_at'].isoformat()
    
    await db.customers.insert_one(customer_dict)
    return customer

@api_router.get("/customers", response_model=List[Customer])
async def get_customers(current_user: dict = Depends(get_current_user)):
    customers = await db.customers.find({}, {"_id": 0}).to_list(1000)
    return customers

@api_router.get("/customers/{customer_id}", response_model=Customer)
async def get_customer(customer_id: str, current_user: dict = Depends(get_current_user)):
    customer = await db.customers.find_one({"id": customer_id}, {"_id": 0})
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    return customer

@api_router.put("/customers/{customer_id}", response_model=Customer)
async def update_customer(customer_id: str, customer_data: CustomerBase, current_user: dict = Depends(get_current_user)):
    update_dict = customer_data.model_dump()
    
    result = await db.customers.update_one(
        {"id": customer_id},
        {"$set": update_dict}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Customer not found")
    
    customer = await db.customers.find_one({"id": customer_id}, {"_id": 0})
    return customer

@api_router.delete("/customers/{customer_id}")
async def delete_customer(customer_id: str, current_user: dict = Depends(require_owner)):
    result = await db.customers.delete_one({"id": customer_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Customer not found")
    return {"message": "Customer deleted"}

# ===================== INVOICE ROUTES =====================

async def generate_invoice_number(is_estimate: bool = False) -> str:
    prefix = "EST" if is_estimate else "INV"
    today = datetime.now(timezone.utc)
    year_month = today.strftime("%Y%m")
    
    count = await db.invoices.count_documents({
        "invoice_number": {"$regex": f"^{prefix}-{year_month}"}
    })
    
    return f"{prefix}-{year_month}-{str(count + 1).zfill(4)}"

@api_router.post("/invoices", response_model=Invoice)
async def create_invoice(invoice_data: InvoiceBase, current_user: dict = Depends(get_current_user)):
    invoice = Invoice(**invoice_data.model_dump())
    invoice.invoice_number = await generate_invoice_number(invoice_data.is_estimate)
    invoice.created_by = current_user['user_id']
    
    invoice_dict = invoice.model_dump()
    invoice_dict['created_at'] = invoice_dict['created_at'].isoformat()
    invoice_dict['updated_at'] = invoice_dict['updated_at'].isoformat()
    
    await db.invoices.insert_one(invoice_dict)
    
    # Save/update customer
    existing_customer = await db.customers.find_one({"id": invoice_data.customer_id}, {"_id": 0})
    if not existing_customer:
        customer = Customer(
            id=invoice_data.customer_id,
            name=invoice_data.customer_name,
            email=invoice_data.customer_email or "",
            phone=invoice_data.customer_phone or "",
            address=invoice_data.customer_address or ""
        )
        customer_dict = customer.model_dump()
        customer_dict['created_at'] = customer_dict['created_at'].isoformat()
        await db.customers.insert_one(customer_dict)
    
    return invoice

@api_router.get("/invoices", response_model=List[Invoice])
async def get_invoices(is_estimate: Optional[bool] = None, current_user: dict = Depends(get_current_user)):
    query = {}
    if is_estimate is not None:
        query["is_estimate"] = is_estimate
    
    invoices = await db.invoices.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return invoices

@api_router.get("/invoices/{invoice_id}", response_model=Invoice)
async def get_invoice(invoice_id: str, current_user: dict = Depends(get_current_user)):
    invoice = await db.invoices.find_one({"id": invoice_id}, {"_id": 0})
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return invoice

@api_router.put("/invoices/{invoice_id}", response_model=Invoice)
async def update_invoice(invoice_id: str, invoice_data: InvoiceBase, current_user: dict = Depends(get_current_user)):
    update_dict = invoice_data.model_dump()
    update_dict['updated_at'] = datetime.now(timezone.utc).isoformat()
    
    result = await db.invoices.update_one(
        {"id": invoice_id},
        {"$set": update_dict}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Invoice not found")
    
    invoice = await db.invoices.find_one({"id": invoice_id}, {"_id": 0})
    return invoice

@api_router.delete("/invoices/{invoice_id}")
async def delete_invoice(invoice_id: str, current_user: dict = Depends(require_owner)):
    result = await db.invoices.delete_one({"id": invoice_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return {"message": "Invoice deleted"}

@api_router.post("/invoices/{invoice_id}/convert-to-invoice", response_model=Invoice)
async def convert_estimate_to_invoice(invoice_id: str, current_user: dict = Depends(get_current_user)):
    estimate = await db.invoices.find_one({"id": invoice_id, "is_estimate": True}, {"_id": 0})
    if not estimate:
        raise HTTPException(status_code=404, detail="Estimate not found")
    
    # Create new invoice from estimate
    new_invoice = Invoice(**{k: v for k, v in estimate.items() if k not in ['id', 'invoice_number', 'created_at', 'updated_at']})
    new_invoice.is_estimate = False
    new_invoice.invoice_number = await generate_invoice_number(False)
    new_invoice.created_by = current_user['user_id']
    
    invoice_dict = new_invoice.model_dump()
    invoice_dict['created_at'] = datetime.now(timezone.utc).isoformat()
    invoice_dict['updated_at'] = datetime.now(timezone.utc).isoformat()
    
    await db.invoices.insert_one(invoice_dict)
    
    return new_invoice

# ===================== PDF GENERATION =====================

def generate_invoice_pdf(invoice: dict, company_settings: dict) -> bytes:
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter, rightMargin=72, leftMargin=72, topMargin=72, bottomMargin=72)
    
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle('Title', parent=styles['Heading1'], fontSize=24, spaceAfter=30)
    heading_style = ParagraphStyle('Heading', parent=styles['Heading2'], fontSize=14, spaceBefore=20, spaceAfter=10)
    normal_style = styles['Normal']
    
    elements = []
    
    # Header
    doc_type = "ESTIMATE" if invoice.get('is_estimate') else "INVOICE"
    elements.append(Paragraph(f"<b>{doc_type}</b>", title_style))
    elements.append(Paragraph(f"<b>{invoice.get('invoice_number', '')}</b>", normal_style))
    elements.append(Spacer(1, 12))
    
    # Company Info
    if company_settings:
        elements.append(Paragraph(f"<b>{company_settings.get('company_name', 'Your Company')}</b>", normal_style))
        elements.append(Paragraph(company_settings.get('company_address', ''), normal_style))
        elements.append(Paragraph(company_settings.get('company_phone', ''), normal_style))
        elements.append(Paragraph(company_settings.get('company_email', ''), normal_style))
    
    elements.append(Spacer(1, 20))
    
    # Customer Info
    elements.append(Paragraph("<b>Bill To:</b>", heading_style))
    elements.append(Paragraph(invoice.get('customer_name', ''), normal_style))
    if invoice.get('customer_address'):
        elements.append(Paragraph(invoice.get('customer_address', ''), normal_style))
    if invoice.get('customer_phone'):
        elements.append(Paragraph(f"Phone: {invoice.get('customer_phone', '')}", normal_style))
    if invoice.get('customer_email'):
        elements.append(Paragraph(f"Email: {invoice.get('customer_email', '')}", normal_style))
    
    elements.append(Spacer(1, 20))
    
    # Items Table
    table_data = [['Product', 'Sq Ft', 'Boxes', 'Unit Price', 'Total']]
    for item in invoice.get('items', []):
        table_data.append([
            item.get('product_name', ''),
            f"{item.get('sqft_needed', 0):.2f}",
            str(item.get('boxes_needed', 0)),
            f"${item.get('unit_price', 0):.2f}",
            f"${item.get('total_price', 0):.2f}"
        ])
    
    table = Table(table_data, colWidths=[2.5*inch, 1*inch, 0.8*inch, 1*inch, 1*inch])
    table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1e293b')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 10),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
        ('BACKGROUND', (0, 1), (-1, -1), colors.HexColor('#fafaf9')),
        ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#e7e5e4')),
        ('FONTSIZE', (0, 1), (-1, -1), 9),
        ('TOPPADDING', (0, 1), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 1), (-1, -1), 8),
    ]))
    elements.append(table)
    
    elements.append(Spacer(1, 20))
    
    # Totals
    totals_data = [
        ['Subtotal:', f"${invoice.get('subtotal', 0):.2f}"],
        [f"Tax ({invoice.get('tax_rate', 0)}%):", f"${invoice.get('tax_amount', 0):.2f}"],
        ['Discount:', f"-${invoice.get('discount', 0):.2f}"],
        ['Total:', f"${invoice.get('total', 0):.2f}"]
    ]
    
    totals_table = Table(totals_data, colWidths=[5*inch, 1.3*inch])
    totals_table.setStyle(TableStyle([
        ('ALIGN', (0, 0), (0, -1), 'RIGHT'),
        ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
        ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
    ]))
    elements.append(totals_table)
    
    # Notes
    if invoice.get('notes'):
        elements.append(Spacer(1, 30))
        elements.append(Paragraph("<b>Notes:</b>", heading_style))
        elements.append(Paragraph(invoice.get('notes', ''), normal_style))
    
    doc.build(elements)
    buffer.seek(0)
    return buffer.read()

@api_router.get("/invoices/{invoice_id}/pdf")
async def get_invoice_pdf(invoice_id: str, current_user: dict = Depends(get_current_user)):
    invoice = await db.invoices.find_one({"id": invoice_id}, {"_id": 0})
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    
    settings = await db.settings.find_one({"id": "company_settings"}, {"_id": 0})
    
    pdf_bytes = generate_invoice_pdf(invoice, settings or {})
    
    filename = f"{invoice.get('invoice_number', 'invoice')}.pdf"
    
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

# ===================== EMAIL INVOICE =====================

@api_router.post("/invoices/{invoice_id}/send-email")
async def send_invoice_email(invoice_id: str, current_user: dict = Depends(get_current_user)):
    if not RESEND_API_KEY:
        raise HTTPException(status_code=500, detail="Email service not configured")
    
    invoice = await db.invoices.find_one({"id": invoice_id}, {"_id": 0})
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    
    if not invoice.get('customer_email'):
        raise HTTPException(status_code=400, detail="Customer email not available")
    
    settings = await db.settings.find_one({"id": "company_settings"}, {"_id": 0})
    company_name = settings.get('company_name', 'Your Flooring Store') if settings else 'Your Flooring Store'
    
    pdf_bytes = generate_invoice_pdf(invoice, settings or {})
    
    import base64
    pdf_base64 = base64.b64encode(pdf_bytes).decode('utf-8')
    
    doc_type = "Estimate" if invoice.get('is_estimate') else "Invoice"
    
    html_content = f"""
    <html>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #1c1917;">
        <h2 style="color: #1e293b;">Your {doc_type} from {company_name}</h2>
        <p>Dear {invoice.get('customer_name', 'Valued Customer')},</p>
        <p>Please find attached your {doc_type.lower()} <strong>{invoice.get('invoice_number', '')}</strong>.</p>
        <p><strong>Total Amount: ${invoice.get('total', 0):.2f}</strong></p>
        <p>Thank you for your business!</p>
        <p>Best regards,<br>{company_name}</p>
    </body>
    </html>
    """
    
    params = {
        "from": SENDER_EMAIL,
        "to": [invoice.get('customer_email')],
        "subject": f"{doc_type} {invoice.get('invoice_number', '')} from {company_name}",
        "html": html_content,
        "attachments": [{
            "filename": f"{invoice.get('invoice_number', 'document')}.pdf",
            "content": pdf_base64
        }]
    }
    
    try:
        email = await asyncio.to_thread(resend.Emails.send, params)
        
        # Update invoice status if it's an invoice (not estimate)
        if not invoice.get('is_estimate'):
            await db.invoices.update_one(
                {"id": invoice_id},
                {"$set": {"status": "sent", "updated_at": datetime.now(timezone.utc).isoformat()}}
            )
        
        return {"message": "Email sent successfully", "email_id": email.get("id")}
    except Exception as e:
        logger.error(f"Failed to send email: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to send email: {str(e)}")

# ===================== LEAD ROUTES =====================

@api_router.post("/leads", response_model=Lead)
async def create_lead(lead_data: LeadBase, current_user: dict = Depends(get_current_user)):
    lead = Lead(**lead_data.model_dump())
    lead_dict = lead.model_dump()
    lead_dict['created_at'] = lead_dict['created_at'].isoformat()
    lead_dict['updated_at'] = lead_dict['updated_at'].isoformat()
    
    await db.leads.insert_one(lead_dict)
    return lead

@api_router.get("/leads", response_model=List[Lead])
async def get_leads(status: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    query = {}
    if status:
        query["status"] = status
    
    leads = await db.leads.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return leads

@api_router.get("/leads/{lead_id}", response_model=Lead)
async def get_lead(lead_id: str, current_user: dict = Depends(get_current_user)):
    lead = await db.leads.find_one({"id": lead_id}, {"_id": 0})
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    return lead

@api_router.put("/leads/{lead_id}", response_model=Lead)
async def update_lead(lead_id: str, lead_data: LeadBase, current_user: dict = Depends(get_current_user)):
    update_dict = lead_data.model_dump()
    update_dict['updated_at'] = datetime.now(timezone.utc).isoformat()
    
    result = await db.leads.update_one(
        {"id": lead_id},
        {"$set": update_dict}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    lead = await db.leads.find_one({"id": lead_id}, {"_id": 0})
    return lead

@api_router.delete("/leads/{lead_id}")
async def delete_lead(lead_id: str, current_user: dict = Depends(require_owner)):
    result = await db.leads.delete_one({"id": lead_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Lead not found")
    return {"message": "Lead deleted"}

# Facebook Leads Webhook (for future API integration)
@api_router.post("/leads/facebook-webhook")
async def facebook_leads_webhook(request: Request):
    settings = await db.settings.find_one({"id": "company_settings"}, {"_id": 0})
    if not settings or not settings.get('facebook_api_token'):
        raise HTTPException(status_code=400, detail="Facebook API not configured")
    
    body = await request.json()
    
    # Process Facebook lead data
    for entry in body.get('entry', []):
        for change in entry.get('changes', []):
            if change.get('field') == 'leadgen':
                lead_data = change.get('value', {})
                
                lead = Lead(
                    name=lead_data.get('full_name', 'Facebook Lead'),
                    email=lead_data.get('email', ''),
                    phone=lead_data.get('phone_number', ''),
                    source='facebook',
                    status='new',
                    notes=f"Lead ID: {lead_data.get('leadgen_id', '')}"
                )
                
                lead_dict = lead.model_dump()
                lead_dict['created_at'] = lead_dict['created_at'].isoformat()
                lead_dict['updated_at'] = lead_dict['updated_at'].isoformat()
                
                await db.leads.insert_one(lead_dict)
    
    return {"message": "Webhook received"}

# ===================== EXPENSE ROUTES =====================

@api_router.post("/expenses", response_model=Expense)
async def create_expense(expense_data: ExpenseBase, current_user: dict = Depends(get_current_user)):
    expense = Expense(**expense_data.model_dump())
    expense.created_by = current_user['user_id']
    
    expense_dict = expense.model_dump()
    expense_dict['created_at'] = expense_dict['created_at'].isoformat()
    
    await db.expenses.insert_one(expense_dict)
    return expense

@api_router.get("/expenses", response_model=List[Expense])
async def get_expenses(category: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    query = {}
    if category:
        query["category"] = category
    
    expenses = await db.expenses.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return expenses

@api_router.get("/expenses/{expense_id}", response_model=Expense)
async def get_expense(expense_id: str, current_user: dict = Depends(get_current_user)):
    expense = await db.expenses.find_one({"id": expense_id}, {"_id": 0})
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")
    return expense

@api_router.put("/expenses/{expense_id}", response_model=Expense)
async def update_expense(expense_id: str, expense_data: ExpenseBase, current_user: dict = Depends(get_current_user)):
    update_dict = expense_data.model_dump()
    
    result = await db.expenses.update_one(
        {"id": expense_id},
        {"$set": update_dict}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Expense not found")
    
    expense = await db.expenses.find_one({"id": expense_id}, {"_id": 0})
    return expense

@api_router.delete("/expenses/{expense_id}")
async def delete_expense(expense_id: str, current_user: dict = Depends(require_owner)):
    result = await db.expenses.delete_one({"id": expense_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Expense not found")
    return {"message": "Expense deleted"}

# ===================== CONTRACTOR ROUTES =====================

@api_router.post("/contractors", response_model=Contractor)
async def create_contractor(contractor_data: ContractorBase, current_user: dict = Depends(require_owner)):
    contractor = Contractor(**contractor_data.model_dump())
    contractor_dict = contractor.model_dump()
    contractor_dict['created_at'] = contractor_dict['created_at'].isoformat()
    contractor_dict['updated_at'] = contractor_dict['updated_at'].isoformat()
    
    await db.contractors.insert_one(contractor_dict)
    return contractor

@api_router.get("/contractors", response_model=List[Contractor])
async def get_contractors(current_user: dict = Depends(get_current_user)):
    contractors = await db.contractors.find({}, {"_id": 0}).to_list(1000)
    return contractors

@api_router.get("/contractors/{contractor_id}", response_model=Contractor)
async def get_contractor(contractor_id: str, current_user: dict = Depends(get_current_user)):
    contractor = await db.contractors.find_one({"id": contractor_id}, {"_id": 0})
    if not contractor:
        raise HTTPException(status_code=404, detail="Contractor not found")
    return contractor

@api_router.put("/contractors/{contractor_id}", response_model=Contractor)
async def update_contractor(contractor_id: str, contractor_data: ContractorBase, current_user: dict = Depends(require_owner)):
    update_dict = contractor_data.model_dump()
    update_dict['updated_at'] = datetime.now(timezone.utc).isoformat()
    
    result = await db.contractors.update_one(
        {"id": contractor_id},
        {"$set": update_dict}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Contractor not found")
    
    contractor = await db.contractors.find_one({"id": contractor_id}, {"_id": 0})
    return contractor

@api_router.delete("/contractors/{contractor_id}")
async def delete_contractor(contractor_id: str, current_user: dict = Depends(require_owner)):
    result = await db.contractors.delete_one({"id": contractor_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Contractor not found")
    return {"message": "Contractor deleted"}

# ===================== SETTINGS ROUTES =====================

@api_router.get("/settings", response_model=Settings)
async def get_settings(current_user: dict = Depends(get_current_user)):
    settings = await db.settings.find_one({"id": "company_settings"}, {"_id": 0})
    if not settings:
        return Settings()
    return settings

@api_router.put("/settings", response_model=Settings)
async def update_settings(settings_data: SettingsBase, current_user: dict = Depends(require_owner)):
    settings = Settings(**settings_data.model_dump())
    settings_dict = settings.model_dump()
    settings_dict['updated_at'] = datetime.now(timezone.utc).isoformat()
    
    await db.settings.update_one(
        {"id": "company_settings"},
        {"$set": settings_dict},
        upsert=True
    )
    
    return settings

# ===================== STRIPE PAYMENT ROUTES =====================

@api_router.post("/payments/checkout")
async def create_checkout_session(request: Request, invoice_id: str, current_user: dict = Depends(get_current_user)):
    if not STRIPE_API_KEY:
        raise HTTPException(status_code=500, detail="Stripe not configured")
    
    from emergentintegrations.payments.stripe.checkout import StripeCheckout, CheckoutSessionRequest
    
    invoice = await db.invoices.find_one({"id": invoice_id}, {"_id": 0})
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    
    host_url = str(request.base_url).rstrip('/')
    webhook_url = f"{host_url}/api/webhook/stripe"
    
    stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
    
    # Get frontend URL from request origin
    origin = request.headers.get("origin", host_url)
    success_url = f"{origin}/invoices/{invoice_id}?session_id={{CHECKOUT_SESSION_ID}}&payment=success"
    cancel_url = f"{origin}/invoices/{invoice_id}?payment=cancelled"
    
    checkout_request = CheckoutSessionRequest(
        amount=float(invoice.get('total', 0)),
        currency="usd",
        success_url=success_url,
        cancel_url=cancel_url,
        metadata={
            "invoice_id": invoice_id,
            "invoice_number": invoice.get('invoice_number', ''),
            "customer_email": invoice.get('customer_email', '')
        }
    )
    
    session = await stripe_checkout.create_checkout_session(checkout_request)
    
    # Create payment transaction record
    payment_transaction = PaymentTransaction(
        session_id=session.session_id,
        amount=float(invoice.get('total', 0)),
        currency="usd",
        status="pending",
        payment_status="initiated",
        invoice_id=invoice_id,
        customer_email=invoice.get('customer_email', ''),
        metadata=checkout_request.metadata
    )
    
    transaction_dict = payment_transaction.model_dump()
    transaction_dict['created_at'] = transaction_dict['created_at'].isoformat()
    
    await db.payment_transactions.insert_one(transaction_dict)
    
    return {"url": session.url, "session_id": session.session_id}

@api_router.get("/payments/status/{session_id}")
async def get_payment_status(session_id: str, current_user: dict = Depends(get_current_user)):
    if not STRIPE_API_KEY:
        raise HTTPException(status_code=500, detail="Stripe not configured")
    
    from emergentintegrations.payments.stripe.checkout import StripeCheckout
    
    stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url="")
    
    checkout_status = await stripe_checkout.get_checkout_status(session_id)
    
    # Update payment transaction
    existing = await db.payment_transactions.find_one({"session_id": session_id}, {"_id": 0})
    
    if existing and existing.get('payment_status') != 'paid':
        new_status = "paid" if checkout_status.payment_status == "paid" else checkout_status.status
        
        await db.payment_transactions.update_one(
            {"session_id": session_id},
            {"$set": {
                "status": checkout_status.status,
                "payment_status": checkout_status.payment_status
            }}
        )
        
        # Update invoice status if paid
        if checkout_status.payment_status == "paid" and existing.get('invoice_id'):
            await db.invoices.update_one(
                {"id": existing['invoice_id']},
                {"$set": {"status": "paid", "updated_at": datetime.now(timezone.utc).isoformat()}}
            )
    
    return {
        "status": checkout_status.status,
        "payment_status": checkout_status.payment_status,
        "amount_total": checkout_status.amount_total,
        "currency": checkout_status.currency
    }

@api_router.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    if not STRIPE_API_KEY:
        return {"message": "Webhook received"}
    
    from emergentintegrations.payments.stripe.checkout import StripeCheckout
    
    body = await request.body()
    signature = request.headers.get("Stripe-Signature", "")
    
    host_url = str(request.base_url).rstrip('/')
    webhook_url = f"{host_url}/api/webhook/stripe"
    
    stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
    
    try:
        webhook_response = await stripe_checkout.handle_webhook(body, signature)
        
        if webhook_response.payment_status == "paid":
            # Update payment transaction
            await db.payment_transactions.update_one(
                {"session_id": webhook_response.session_id},
                {"$set": {
                    "status": "complete",
                    "payment_status": "paid"
                }}
            )
            
            # Update invoice if linked
            transaction = await db.payment_transactions.find_one(
                {"session_id": webhook_response.session_id},
                {"_id": 0}
            )
            
            if transaction and transaction.get('invoice_id'):
                await db.invoices.update_one(
                    {"id": transaction['invoice_id']},
                    {"$set": {"status": "paid", "updated_at": datetime.now(timezone.utc).isoformat()}}
                )
        
        return {"message": "Webhook processed"}
    except Exception as e:
        logger.error(f"Webhook error: {str(e)}")
        return {"message": "Webhook received"}

@api_router.get("/payments/transactions", response_model=List[PaymentTransaction])
async def get_payment_transactions(current_user: dict = Depends(get_current_user)):
    transactions = await db.payment_transactions.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return transactions

# ===================== DASHBOARD STATS =====================

@api_router.get("/dashboard/stats")
async def get_dashboard_stats(current_user: dict = Depends(get_current_user)):
    # Get counts
    products_count = await db.products.count_documents({})
    customers_count = await db.customers.count_documents({})
    leads_count = await db.leads.count_documents({})
    new_leads_count = await db.leads.count_documents({"status": "new"})
    
    # Get invoices stats
    invoices = await db.invoices.find({"is_estimate": False}, {"_id": 0}).to_list(1000)
    total_revenue = sum(inv.get('total', 0) for inv in invoices if inv.get('status') == 'paid')
    pending_invoices = sum(1 for inv in invoices if inv.get('status') in ['draft', 'sent'])
    
    # Get expenses stats
    expenses = await db.expenses.find({}, {"_id": 0}).to_list(1000)
    total_expenses = sum(exp.get('amount', 0) for exp in expenses)
    
    # Recent activity
    recent_invoices = await db.invoices.find({}, {"_id": 0}).sort("created_at", -1).limit(5).to_list(5)
    recent_leads = await db.leads.find({}, {"_id": 0}).sort("created_at", -1).limit(5).to_list(5)
    
    return {
        "products_count": products_count,
        "customers_count": customers_count,
        "leads_count": leads_count,
        "new_leads_count": new_leads_count,
        "total_revenue": total_revenue,
        "pending_invoices": pending_invoices,
        "total_expenses": total_expenses,
        "net_income": total_revenue - total_expenses,
        "recent_invoices": recent_invoices,
        "recent_leads": recent_leads
    }

# ===================== USERS MANAGEMENT (Owner only) =====================

@api_router.get("/users", response_model=List[UserResponse])
async def get_users(current_user: dict = Depends(require_owner)):
    users = await db.users.find({}, {"_id": 0, "password": 0}).to_list(100)
    return [UserResponse(**u) for u in users]

@api_router.delete("/users/{user_id}")
async def delete_user(user_id: str, current_user: dict = Depends(require_owner)):
    if user_id == current_user['user_id']:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")
    
    result = await db.users.delete_one({"id": user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    return {"message": "User deleted"}

# ===================== CREATE EMPLOYEE (Owner only) =====================

@api_router.post("/users/create-employee", response_model=UserResponse)
async def create_employee(employee_data: CreateEmployeeRequest, current_user: dict = Depends(require_owner)):
    existing = await db.users.find_one({"email": employee_data.email}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user = User(
        email=employee_data.email,
        name=employee_data.name,
        role="employee"
    )
    
    user_dict = user.model_dump()
    user_dict['password'] = hash_password(employee_data.password)
    user_dict['created_at'] = user_dict['created_at'].isoformat()
    
    await db.users.insert_one(user_dict)
    
    return UserResponse(id=user.id, email=user.email, name=user.name, role=user.role)

# ===================== CHANGE PASSWORD =====================

@api_router.post("/auth/change-password")
async def change_password(request: PasswordChangeRequest, current_user: dict = Depends(get_current_user)):
    user = await db.users.find_one({"id": current_user['user_id']}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if not verify_password(request.current_password, user['password']):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    
    new_hashed = hash_password(request.new_password)
    await db.users.update_one(
        {"id": current_user['user_id']},
        {"$set": {"password": new_hashed}}
    )
    
    return {"message": "Password changed successfully"}

# ===================== MANUAL PAYMENTS =====================

@api_router.post("/payments/manual", response_model=ManualPayment)
async def create_manual_payment(payment_data: ManualPaymentBase, current_user: dict = Depends(get_current_user)):
    # Verify invoice exists
    invoice = await db.invoices.find_one({"id": payment_data.invoice_id}, {"_id": 0})
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    
    payment = ManualPayment(**payment_data.model_dump())
    payment.created_by = current_user['user_id']
    
    payment_dict = payment.model_dump()
    payment_dict['created_at'] = payment_dict['created_at'].isoformat()
    
    await db.manual_payments.insert_one(payment_dict)
    
    # Calculate total paid for this invoice
    all_payments = await db.manual_payments.find({"invoice_id": payment_data.invoice_id}, {"_id": 0}).to_list(100)
    total_paid = sum(p.get('amount', 0) for p in all_payments)
    
    # Update invoice status if fully paid
    if total_paid >= invoice.get('total', 0):
        await db.invoices.update_one(
            {"id": payment_data.invoice_id},
            {"$set": {"status": "paid", "updated_at": datetime.now(timezone.utc).isoformat()}}
        )
    elif total_paid > 0:
        await db.invoices.update_one(
            {"id": payment_data.invoice_id},
            {"$set": {"status": "partial", "updated_at": datetime.now(timezone.utc).isoformat()}}
        )
    
    return payment

@api_router.get("/payments/manual/invoice/{invoice_id}", response_model=List[ManualPayment])
async def get_invoice_manual_payments(invoice_id: str, current_user: dict = Depends(get_current_user)):
    payments = await db.manual_payments.find({"invoice_id": invoice_id}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return payments

@api_router.get("/payments/manual", response_model=List[ManualPayment])
async def get_all_manual_payments(current_user: dict = Depends(get_current_user)):
    payments = await db.manual_payments.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return payments

@api_router.delete("/payments/manual/{payment_id}")
async def delete_manual_payment(payment_id: str, current_user: dict = Depends(require_owner)):
    payment = await db.manual_payments.find_one({"id": payment_id}, {"_id": 0})
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    
    result = await db.manual_payments.delete_one({"id": payment_id})
    
    # Recalculate invoice status
    invoice_id = payment.get('invoice_id')
    if invoice_id:
        invoice = await db.invoices.find_one({"id": invoice_id}, {"_id": 0})
        if invoice:
            all_payments = await db.manual_payments.find({"invoice_id": invoice_id}, {"_id": 0}).to_list(100)
            total_paid = sum(p.get('amount', 0) for p in all_payments)
            
            if total_paid >= invoice.get('total', 0):
                new_status = "paid"
            elif total_paid > 0:
                new_status = "partial"
            else:
                new_status = "sent" if invoice.get('status') != 'draft' else "draft"
            
            await db.invoices.update_one(
                {"id": invoice_id},
                {"$set": {"status": new_status, "updated_at": datetime.now(timezone.utc).isoformat()}}
            )
    
    return {"message": "Payment deleted"}

# ===================== MESSAGES SYSTEM =====================

@api_router.post("/messages", response_model=Message)
async def create_message(message_data: MessageBase, current_user: dict = Depends(require_owner)):
    user = await db.users.find_one({"id": current_user['user_id']}, {"_id": 0})
    
    message = Message(**message_data.model_dump())
    message.created_by = current_user['user_id']
    message.created_by_name = user.get('name', 'Owner') if user else 'Owner'
    
    message_dict = message.model_dump()
    message_dict['created_at'] = message_dict['created_at'].isoformat()
    
    await db.messages.insert_one(message_dict)
    return message

@api_router.get("/messages", response_model=List[Message])
async def get_messages(current_user: dict = Depends(get_current_user)):
    messages = await db.messages.find({}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return messages

@api_router.post("/messages/{message_id}/read")
async def mark_message_read(message_id: str, current_user: dict = Depends(get_current_user)):
    result = await db.messages.update_one(
        {"id": message_id},
        {"$addToSet": {"read_by": current_user['user_id']}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Message not found")
    return {"message": "Marked as read"}

@api_router.delete("/messages/{message_id}")
async def delete_message(message_id: str, current_user: dict = Depends(require_owner)):
    result = await db.messages.delete_one({"id": message_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Message not found")
    return {"message": "Message deleted"}

@api_router.get("/messages/unread-count")
async def get_unread_count(current_user: dict = Depends(get_current_user)):
    count = await db.messages.count_documents({"read_by": {"$ne": current_user['user_id']}})
    return {"unread_count": count}

# ===================== ANALYTICS & REPORTS =====================

@api_router.get("/reports/financial")
async def get_financial_report(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    # Get all invoices and expenses
    invoice_query = {"is_estimate": False}
    expense_query = {}
    
    if start_date and end_date:
        invoice_query["created_at"] = {"$gte": start_date, "$lte": end_date}
        expense_query["date"] = {"$gte": start_date, "$lte": end_date}
    
    invoices = await db.invoices.find(invoice_query, {"_id": 0}).to_list(10000)
    expenses = await db.expenses.find(expense_query, {"_id": 0}).to_list(10000)
    manual_payments = await db.manual_payments.find({}, {"_id": 0}).to_list(10000)
    
    # Calculate revenue (from paid invoices)
    total_revenue = sum(inv.get('total', 0) for inv in invoices if inv.get('status') == 'paid')
    total_pending = sum(inv.get('total', 0) for inv in invoices if inv.get('status') in ['draft', 'sent', 'partial'])
    
    # Calculate expenses by category
    expense_by_category = {}
    for exp in expenses:
        cat = exp.get('category', 'other')
        expense_by_category[cat] = expense_by_category.get(cat, 0) + exp.get('amount', 0)
    
    total_expenses = sum(exp.get('amount', 0) for exp in expenses)
    
    # Gross profit
    gross_profit = total_revenue - total_expenses
    
    # Payment method breakdown
    payment_methods = {}
    for p in manual_payments:
        method = p.get('payment_method', 'other')
        payment_methods[method] = payment_methods.get(method, 0) + p.get('amount', 0)
    
    return {
        "total_revenue": total_revenue,
        "total_pending": total_pending,
        "total_expenses": total_expenses,
        "gross_profit": gross_profit,
        "profit_margin": (gross_profit / total_revenue * 100) if total_revenue > 0 else 0,
        "expense_by_category": expense_by_category,
        "payment_methods": payment_methods,
        "invoice_count": len(invoices),
        "paid_invoice_count": sum(1 for inv in invoices if inv.get('status') == 'paid'),
        "expense_count": len(expenses)
    }

@api_router.get("/reports/transactions")
async def get_transaction_report(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    # Get all payment transactions
    query = {}
    manual_query = {}
    
    if start_date and end_date:
        query["created_at"] = {"$gte": start_date, "$lte": end_date}
        manual_query["date"] = {"$gte": start_date, "$lte": end_date}
    
    stripe_transactions = await db.payment_transactions.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    manual_payments = await db.manual_payments.find(manual_query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    
    # Combine and format transactions
    transactions = []
    
    for t in stripe_transactions:
        invoice = await db.invoices.find_one({"id": t.get('invoice_id', '')}, {"_id": 0})
        transactions.append({
            "id": t.get('id'),
            "type": "stripe",
            "amount": t.get('amount', 0),
            "status": t.get('payment_status', 'unknown'),
            "invoice_number": invoice.get('invoice_number', '') if invoice else '',
            "customer_name": invoice.get('customer_name', '') if invoice else '',
            "date": t.get('created_at', ''),
            "reference": t.get('session_id', '')
        })
    
    for p in manual_payments:
        invoice = await db.invoices.find_one({"id": p.get('invoice_id', '')}, {"_id": 0})
        transactions.append({
            "id": p.get('id'),
            "type": "manual",
            "amount": p.get('amount', 0),
            "status": "completed",
            "invoice_number": invoice.get('invoice_number', '') if invoice else '',
            "customer_name": invoice.get('customer_name', '') if invoice else '',
            "date": p.get('date', p.get('created_at', '')),
            "reference": p.get('reference_number', ''),
            "payment_method": p.get('payment_method', '')
        })
    
    # Sort by date
    transactions.sort(key=lambda x: x.get('date', ''), reverse=True)
    
    return {"transactions": transactions}

@api_router.get("/reports/analytics")
async def get_analytics(current_user: dict = Depends(get_current_user)):
    from datetime import datetime, timedelta
    
    now = datetime.now(timezone.utc)
    
    # Monthly data for the last 12 months
    monthly_data = []
    for i in range(11, -1, -1):
        month_start = (now.replace(day=1) - timedelta(days=i*30)).replace(day=1)
        month_end = (month_start + timedelta(days=32)).replace(day=1) - timedelta(days=1)
        
        month_str = month_start.strftime("%Y-%m")
        month_label = month_start.strftime("%b %Y")
        
        # Get invoices for this month
        invoices = await db.invoices.find({
            "is_estimate": False,
            "created_at": {"$regex": f"^{month_str}"}
        }, {"_id": 0}).to_list(1000)
        
        revenue = sum(inv.get('total', 0) for inv in invoices if inv.get('status') == 'paid')
        invoice_count = len(invoices)
        
        # Get expenses for this month
        expenses = await db.expenses.find({
            "date": {"$regex": f"^{month_str}"}
        }, {"_id": 0}).to_list(1000)
        
        expense_total = sum(exp.get('amount', 0) for exp in expenses)
        
        # Get leads for this month
        leads = await db.leads.find({
            "created_at": {"$regex": f"^{month_str}"}
        }, {"_id": 0}).to_list(1000)
        
        lead_count = len(leads)
        converted_leads = sum(1 for l in leads if l.get('status') == 'won')
        
        monthly_data.append({
            "month": month_label,
            "revenue": revenue,
            "expenses": expense_total,
            "profit": revenue - expense_total,
            "invoices": invoice_count,
            "leads": lead_count,
            "converted_leads": converted_leads
        })
    
    # Current month stats
    current_month = now.strftime("%Y-%m")
    
    current_invoices = await db.invoices.find({
        "is_estimate": False,
        "created_at": {"$regex": f"^{current_month}"}
    }, {"_id": 0}).to_list(1000)
    
    current_expenses = await db.expenses.find({
        "date": {"$regex": f"^{current_month}"}
    }, {"_id": 0}).to_list(1000)
    
    current_leads = await db.leads.find({
        "created_at": {"$regex": f"^{current_month}"}
    }, {"_id": 0}).to_list(1000)
    
    # Lead status breakdown
    all_leads = await db.leads.find({}, {"_id": 0}).to_list(10000)
    lead_by_status = {}
    for lead in all_leads:
        status = lead.get('status', 'unknown')
        lead_by_status[status] = lead_by_status.get(status, 0) + 1
    
    # Invoice status breakdown
    all_invoices = await db.invoices.find({"is_estimate": False}, {"_id": 0}).to_list(10000)
    invoice_by_status = {}
    for inv in all_invoices:
        status = inv.get('status', 'unknown')
        invoice_by_status[status] = invoice_by_status.get(status, 0) + 1
    
    return {
        "monthly_data": monthly_data,
        "current_month": {
            "revenue": sum(inv.get('total', 0) for inv in current_invoices if inv.get('status') == 'paid'),
            "expenses": sum(exp.get('amount', 0) for exp in current_expenses),
            "invoices": len(current_invoices),
            "leads": len(current_leads)
        },
        "lead_by_status": lead_by_status,
        "invoice_by_status": invoice_by_status
    }

# ===================== ADDRESS SUGGESTIONS =====================

# US States for address autocomplete
US_STATES = [
    {"code": "AL", "name": "Alabama"}, {"code": "AK", "name": "Alaska"},
    {"code": "AZ", "name": "Arizona"}, {"code": "AR", "name": "Arkansas"},
    {"code": "CA", "name": "California"}, {"code": "CO", "name": "Colorado"},
    {"code": "CT", "name": "Connecticut"}, {"code": "DE", "name": "Delaware"},
    {"code": "FL", "name": "Florida"}, {"code": "GA", "name": "Georgia"},
    {"code": "HI", "name": "Hawaii"}, {"code": "ID", "name": "Idaho"},
    {"code": "IL", "name": "Illinois"}, {"code": "IN", "name": "Indiana"},
    {"code": "IA", "name": "Iowa"}, {"code": "KS", "name": "Kansas"},
    {"code": "KY", "name": "Kentucky"}, {"code": "LA", "name": "Louisiana"},
    {"code": "ME", "name": "Maine"}, {"code": "MD", "name": "Maryland"},
    {"code": "MA", "name": "Massachusetts"}, {"code": "MI", "name": "Michigan"},
    {"code": "MN", "name": "Minnesota"}, {"code": "MS", "name": "Mississippi"},
    {"code": "MO", "name": "Missouri"}, {"code": "MT", "name": "Montana"},
    {"code": "NE", "name": "Nebraska"}, {"code": "NV", "name": "Nevada"},
    {"code": "NH", "name": "New Hampshire"}, {"code": "NJ", "name": "New Jersey"},
    {"code": "NM", "name": "New Mexico"}, {"code": "NY", "name": "New York"},
    {"code": "NC", "name": "North Carolina"}, {"code": "ND", "name": "North Dakota"},
    {"code": "OH", "name": "Ohio"}, {"code": "OK", "name": "Oklahoma"},
    {"code": "OR", "name": "Oregon"}, {"code": "PA", "name": "Pennsylvania"},
    {"code": "RI", "name": "Rhode Island"}, {"code": "SC", "name": "South Carolina"},
    {"code": "SD", "name": "South Dakota"}, {"code": "TN", "name": "Tennessee"},
    {"code": "TX", "name": "Texas"}, {"code": "UT", "name": "Utah"},
    {"code": "VT", "name": "Vermont"}, {"code": "VA", "name": "Virginia"},
    {"code": "WA", "name": "Washington"}, {"code": "WV", "name": "West Virginia"},
    {"code": "WI", "name": "Wisconsin"}, {"code": "WY", "name": "Wyoming"}
]

@api_router.get("/address/states")
async def get_states():
    return US_STATES

@api_router.get("/address/suggestions")
async def get_address_suggestions(query: str, current_user: dict = Depends(get_current_user)):
    # Get past customer addresses for suggestions
    if len(query) < 2:
        return []
    
    customers = await db.customers.find(
        {"address": {"$regex": query, "$options": "i"}},
        {"_id": 0, "address": 1, "city": 1, "state": 1, "zip_code": 1}
    ).limit(10).to_list(10)
    
    suggestions = []
    for c in customers:
        if c.get('address'):
            full_address = c.get('address', '')
            if c.get('city'):
                full_address += f", {c.get('city')}"
            if c.get('state'):
                full_address += f", {c.get('state')}"
            if c.get('zip_code'):
                full_address += f" {c.get('zip_code')}"
            suggestions.append({
                "address": c.get('address', ''),
                "city": c.get('city', ''),
                "state": c.get('state', ''),
                "zip_code": c.get('zip_code', ''),
                "full_address": full_address
            })
    
    return suggestions

# ===================== ROOT =====================

@api_router.get("/")
async def root():
    return {"message": "Flooring Store API", "version": "1.0.0"}

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
