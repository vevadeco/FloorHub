import { sql } from '@/lib/db'

export async function initSchema(): Promise<void> {
  // users
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'employee',
      password TEXT NOT NULL,
      commission_rate NUMERIC(5,2) NOT NULL DEFAULT 0.0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `

  // products
  await sql`
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      sku TEXT NOT NULL,
      category TEXT NOT NULL,
      cost_price NUMERIC(10,2) NOT NULL,
      selling_price NUMERIC(10,2) NOT NULL,
      sqft_per_box NUMERIC(10,4) NOT NULL,
      stock_boxes INTEGER NOT NULL DEFAULT 0,
      description TEXT DEFAULT '',
      supplier TEXT DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `

  // customers
  await sql`
    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT DEFAULT '',
      phone TEXT DEFAULT '',
      address TEXT DEFAULT '',
      city TEXT DEFAULT '',
      state TEXT DEFAULT '',
      zip_code TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `

  // invoices
  await sql`
    CREATE TABLE IF NOT EXISTS invoices (
      id TEXT PRIMARY KEY,
      invoice_number TEXT NOT NULL,
      customer_id TEXT NOT NULL,
      customer_name TEXT NOT NULL,
      customer_email TEXT DEFAULT '',
      customer_phone TEXT DEFAULT '',
      customer_address TEXT DEFAULT '',
      subtotal NUMERIC(10,2) NOT NULL,
      tax_rate NUMERIC(5,2) NOT NULL DEFAULT 0.0,
      tax_amount NUMERIC(10,2) NOT NULL DEFAULT 0.0,
      discount NUMERIC(10,2) NOT NULL DEFAULT 0.0,
      total NUMERIC(10,2) NOT NULL,
      notes TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'draft',
      is_estimate BOOLEAN NOT NULL DEFAULT FALSE,
      created_by TEXT DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `

  // invoice_items
  await sql`
    CREATE TABLE IF NOT EXISTS invoice_items (
      id TEXT PRIMARY KEY,
      invoice_id TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
      product_id TEXT NOT NULL,
      product_name TEXT NOT NULL,
      sqft_needed NUMERIC(10,4) NOT NULL,
      sqft_per_box NUMERIC(10,4) NOT NULL,
      boxes_needed INTEGER NOT NULL,
      unit_price NUMERIC(10,2) NOT NULL,
      total_price NUMERIC(10,2) NOT NULL
    )
  `

  // leads
  await sql`
    CREATE TABLE IF NOT EXISTS leads (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT DEFAULT '',
      phone TEXT DEFAULT '',
      source TEXT NOT NULL DEFAULT 'manual',
      status TEXT NOT NULL DEFAULT 'new',
      notes TEXT DEFAULT '',
      project_type TEXT DEFAULT '',
      estimated_sqft NUMERIC(10,4) DEFAULT 0.0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `

  // expenses
  await sql`
    CREATE TABLE IF NOT EXISTS expenses (
      id TEXT PRIMARY KEY,
      category TEXT NOT NULL,
      description TEXT NOT NULL,
      amount NUMERIC(10,2) NOT NULL,
      payment_method TEXT DEFAULT 'cash',
      reference_number TEXT DEFAULT '',
      vendor_name TEXT DEFAULT '',
      date TEXT NOT NULL,
      created_by TEXT DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `

  // contractors
  await sql`
    CREATE TABLE IF NOT EXISTS contractors (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      company TEXT DEFAULT '',
      phone TEXT NOT NULL,
      email TEXT DEFAULT '',
      specialty TEXT DEFAULT '',
      address TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      rating INTEGER DEFAULT 5,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `

  // settings (single row)
  await sql`
    CREATE TABLE IF NOT EXISTS settings (
      id TEXT PRIMARY KEY DEFAULT 'company_settings',
      company_name TEXT DEFAULT '',
      company_address TEXT DEFAULT '',
      company_phone TEXT DEFAULT '',
      company_email TEXT DEFAULT '',
      tax_rate NUMERIC(5,2) DEFAULT 0.0,
      facebook_api_token TEXT DEFAULT '',
      facebook_page_id TEXT DEFAULT '',
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `

  // payment_transactions
  await sql`
    CREATE TABLE IF NOT EXISTS payment_transactions (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      amount NUMERIC(10,2) NOT NULL,
      currency TEXT NOT NULL DEFAULT 'usd',
      status TEXT NOT NULL DEFAULT 'pending',
      payment_status TEXT NOT NULL DEFAULT 'initiated',
      invoice_id TEXT,
      customer_email TEXT DEFAULT '',
      metadata JSONB DEFAULT '{}',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `

  // manual_payments
  await sql`
    CREATE TABLE IF NOT EXISTS manual_payments (
      id TEXT PRIMARY KEY,
      invoice_id TEXT NOT NULL,
      amount NUMERIC(10,2) NOT NULL,
      payment_method TEXT NOT NULL DEFAULT 'cash',
      reference_number TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      date TEXT NOT NULL,
      created_by TEXT DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `

  // messages
  await sql`
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      priority TEXT NOT NULL DEFAULT 'normal',
      created_by TEXT DEFAULT '',
      created_by_name TEXT DEFAULT '',
      read_by TEXT[] DEFAULT '{}',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `

  // commissions
  await sql`
    CREATE TABLE IF NOT EXISTS commissions (
      id TEXT PRIMARY KEY,
      employee_id TEXT NOT NULL,
      employee_name TEXT NOT NULL,
      invoice_id TEXT NOT NULL,
      invoice_number TEXT NOT NULL,
      invoice_date TEXT NOT NULL,
      profit NUMERIC(10,2) NOT NULL DEFAULT 0.0,
      commission_rate NUMERIC(5,2) NOT NULL DEFAULT 0.0,
      commission_amount NUMERIC(10,2) NOT NULL DEFAULT 0.0,
      status TEXT NOT NULL DEFAULT 'unpaid',
      date_paid TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (invoice_id, employee_id)
    )
  `

  // Migration: add logo_url to settings
  await sql`ALTER TABLE settings ADD COLUMN IF NOT EXISTS logo_url TEXT DEFAULT ''`

  // Migration: add google_maps_api_key to settings
  await sql`ALTER TABLE settings ADD COLUMN IF NOT EXISTS google_maps_api_key TEXT DEFAULT ''`

  // Migration: add is_install_job to invoices
  await sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS is_install_job BOOLEAN NOT NULL DEFAULT FALSE`

  // Migration: add min_selling_price to products
  await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS min_selling_price NUMERIC(10,2) NOT NULL DEFAULT 0.0`

  // Migration: add completed_at to invoices
  await sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ`

  // installation_jobs
  await sql`
    CREATE TABLE IF NOT EXISTS installation_jobs (
      id TEXT PRIMARY KEY,
      invoice_id TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
      invoice_number TEXT NOT NULL,
      customer_name TEXT NOT NULL,
      contractor_id TEXT,
      contractor_name TEXT DEFAULT '',
      contractor_email TEXT DEFAULT '',
      install_date TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(invoice_id)
    )
  `

  // returns
  await sql`
    CREATE TABLE IF NOT EXISTS returns (
      id TEXT PRIMARY KEY,
      invoice_id TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
      invoice_number TEXT NOT NULL,
      customer_name TEXT NOT NULL,
      reason TEXT NOT NULL DEFAULT '',
      notes TEXT DEFAULT '',
      refund_amount NUMERIC(10,2) NOT NULL DEFAULT 0.0,
      restocking_fee NUMERIC(10,2) NOT NULL DEFAULT 0.0,
      net_refund NUMERIC(10,2) NOT NULL DEFAULT 0.0,
      transaction_reference TEXT DEFAULT '',
      items JSONB DEFAULT '[]',
      status TEXT NOT NULL DEFAULT 'pending',
      created_by TEXT DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `

  // Migration: add new returns columns
  await sql`ALTER TABLE returns ADD COLUMN IF NOT EXISTS restocking_fee NUMERIC(10,2) NOT NULL DEFAULT 0.0`
  await sql`ALTER TABLE returns ADD COLUMN IF NOT EXISTS net_refund NUMERIC(10,2) NOT NULL DEFAULT 0.0`
  await sql`ALTER TABLE returns ADD COLUMN IF NOT EXISTS transaction_reference TEXT DEFAULT ''`
  await sql`ALTER TABLE returns ADD COLUMN IF NOT EXISTS items JSONB DEFAULT '[]'`

  // Migration: add min_floor_price to settings
  await sql`ALTER TABLE settings ADD COLUMN IF NOT EXISTS min_floor_price NUMERIC(10,2) NOT NULL DEFAULT 0.0`

  // Migration: add assigned_to to leads
  await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS assigned_to TEXT DEFAULT ''`
  await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS assigned_to_name TEXT DEFAULT ''`

  // Migration: add geoapify_api_key to settings
  await sql`ALTER TABLE settings ADD COLUMN IF NOT EXISTS geoapify_api_key TEXT DEFAULT ''`

  // Migration: add country and aws_place_index to settings
  await sql`ALTER TABLE settings ADD COLUMN IF NOT EXISTS country TEXT DEFAULT 'US'`
  await sql`ALTER TABLE settings ADD COLUMN IF NOT EXISTS aws_place_index TEXT DEFAULT ''`

  // Migration: add amazon_location_api_key and amazon_location_region to settings
  await sql`ALTER TABLE settings ADD COLUMN IF NOT EXISTS amazon_location_api_key TEXT DEFAULT ''`
  await sql`ALTER TABLE settings ADD COLUMN IF NOT EXISTS amazon_location_region TEXT DEFAULT 'us-east-2'`

  // Migration: add resend_api_key to settings
  await sql`ALTER TABLE settings ADD COLUMN IF NOT EXISTS resend_api_key TEXT DEFAULT ''`

  // Migration: add resend_from_email to settings
  await sql`ALTER TABLE settings ADD COLUMN IF NOT EXISTS resend_from_email TEXT DEFAULT ''`

  // Migration: add payment gateway fields to settings
  await sql`ALTER TABLE settings ADD COLUMN IF NOT EXISTS payment_gateway TEXT DEFAULT 'none'`
  await sql`ALTER TABLE settings ADD COLUMN IF NOT EXISTS stripe_secret_key TEXT DEFAULT ''`
  await sql`ALTER TABLE settings ADD COLUMN IF NOT EXISTS stripe_publishable_key TEXT DEFAULT ''`
  await sql`ALTER TABLE settings ADD COLUMN IF NOT EXISTS square_access_token TEXT DEFAULT ''`
  await sql`ALTER TABLE settings ADD COLUMN IF NOT EXISTS square_location_id TEXT DEFAULT ''`

  // Migration: add employee_id to expenses
  await sql`ALTER TABLE expenses ADD COLUMN IF NOT EXISTS employee_id TEXT DEFAULT ''`

  // Migration: add terms_and_conditions to settings
  await sql`ALTER TABLE settings ADD COLUMN IF NOT EXISTS terms_and_conditions TEXT DEFAULT ''`

  // Migration: add job_type and scheduled_date to invoices
  await sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS job_type TEXT`
  await sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS scheduled_date DATE`

  // Migration: add 2FA support (see lib/migrations/add-2fa-schema.sql)
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_enabled BOOLEAN NOT NULL DEFAULT FALSE`

  await sql`
    CREATE TABLE IF NOT EXISTS user_totp (
      user_id     TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      secret      TEXT NOT NULL,
      enabled     BOOLEAN NOT NULL DEFAULT FALSE,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `

  await sql`
    CREATE TABLE IF NOT EXISTS user_backup_codes (
      id          TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      code_hash   TEXT NOT NULL,
      used        BOOLEAN NOT NULL DEFAULT FALSE,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `

  await sql`CREATE INDEX IF NOT EXISTS user_backup_codes_user_id_idx ON user_backup_codes(user_id)`

  // Migration: add require_2fa enforcement to settings
  await sql`ALTER TABLE settings ADD COLUMN IF NOT EXISTS require_2fa BOOLEAN NOT NULL DEFAULT FALSE`
}
