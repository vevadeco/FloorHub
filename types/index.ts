export type Role = 'owner' | 'employee'

export interface JWTPayload {
  user_id: string
  email: string
  role: Role
  name: string
  exp: number
}

export interface InvoiceItem {
  id?: string
  product_id: string
  product_name: string
  sqft_needed: number
  sqft_per_box: number
  boxes_needed: number
  unit_price: number
  total_price: number
  cost_price?: number
}

export interface Invoice {
  id: string
  invoice_number: string
  customer_id: string
  customer_name: string
  customer_email: string
  customer_phone: string
  customer_address: string
  items: InvoiceItem[]
  subtotal: number
  tax_rate: number
  tax_amount: number
  discount: number
  total: number
  notes: string
  status: 'draft' | 'sent' | 'paid' | 'cancelled'
  is_estimate: boolean
  is_install_job: boolean
  job_type: 'installation' | 'delivery' | 'pickup' | null
  scheduled_date: string | null
  created_by: string
  created_at: string
  updated_at: string
}

export interface Commission {
  id: string
  employee_id: string
  employee_name: string
  invoice_id: string
  invoice_number: string
  invoice_date: string
  profit: number
  commission_rate: number
  commission_amount: number
  status: 'unpaid' | 'paid'
  date_paid: string | null
  created_at: string
  updated_at: string
}

export interface Product {
  id: string
  name: string
  sku: string
  category: string
  cost_price: number
  selling_price: number
  sqft_per_box: number
  stock_boxes: number
  description: string
  supplier: string
  created_at: string
  updated_at: string
}

export interface Customer {
  id: string
  name: string
  email: string
  phone: string
  address: string
  city: string
  state: string
  zip_code: string
  notes: string
  store_credit_balance: number
  created_at: string
}

export interface Lead {
  id: string
  name: string
  email: string
  phone: string
  source: string
  status: string
  notes: string
  project_type: string
  estimated_sqft: number
  assigned_to: string
  assigned_to_name: string
  created_at: string
  updated_at: string
}

export interface Expense {
  id: string
  category: string
  description: string
  amount: number
  payment_method: string
  reference_number: string
  vendor_name: string
  date: string
  created_by: string
  created_at: string
}

export interface Contractor {
  id: string
  name: string
  company: string
  phone: string
  email: string
  specialty: string
  address: string
  notes: string
  rating: number
  created_at: string
  updated_at: string
}

export interface Settings {
  id: string
  company_name: string
  company_address: string
  company_phone: string
  company_email: string
  tax_rate: number
  facebook_api_token: string
  facebook_page_id: string
  logo_url: string
  google_maps_api_key: string
  geoapify_api_key: string
  min_floor_price: number
  country: string
  aws_place_index: string
  amazon_location_api_key: string
  amazon_location_region: string
  resend_api_key: string
  resend_from_email: string
  payment_gateway: 'none' | 'stripe' | 'square'
  stripe_secret_key: string
  stripe_publishable_key: string
  square_access_token: string
  square_location_id: string
  terms_and_conditions: string
  restocking_charge_percentage: number
  updated_at: string
}

export interface Message {
  id: string
  title: string
  content: string
  priority: 'low' | 'normal' | 'high' | 'urgent'
  created_by: string
  created_by_name: string
  read_by: string[]
  created_at: string
}

export interface User {
  id: string
  email: string
  name: string
  role: Role
  commission_rate: number
  created_at: string
}

export interface ManualPayment {
  id: string
  invoice_id: string
  amount: number
  payment_method: string
  reference_number: string
  notes: string
  date: string
  created_by: string
  created_at: string
}

export type DeliveryOrderStatus = 'pending' | 'scheduled' | 'in_transit' | 'delivered' | 'cancelled'

export interface DeliveryOrder {
  id: string
  invoice_id: string
  invoice_number: string
  do_number: number
  delivery_order_id: string
  customer_name: string
  customer_address: string
  delivery_date: string
  notes: string
  status: DeliveryOrderStatus
  created_at: string
  updated_at: string
}

export interface DeliveryOrderWithItems extends DeliveryOrder {
  items: InvoiceItem[]
  invoice_total: number
}

export interface DeliveryOrderListItem {
  id: string
  invoice_number: string
  customer_name: string
  customer_address: string
  status: string
  created_at: string
  job: DeliveryOrder | null
}

export type RefundMethod = 'original_payment' | 'store_credit'
export type StoreCreditTransactionType = 'credit' | 'debit'
export type StoreCreditReferenceType = 'return' | 'invoice'

export interface StoreCreditLedgerEntry {
  id: string
  customer_id: string
  transaction_type: StoreCreditTransactionType
  amount: number
  reference_type: StoreCreditReferenceType
  reference_id: string
  description: string
  created_at: string
}
