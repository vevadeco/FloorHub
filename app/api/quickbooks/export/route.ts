export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, requireOwner, AuthError, ForbiddenError } from '@/lib/auth'
import { sql } from '@/lib/db'

type ExportType = 'customers' | 'products' | 'invoices' | 'expenses'

function escapeCSV(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

function toCSV(headers: string[], rows: string[][]): string {
  const headerLine = headers.map(escapeCSV).join(',')
  const dataLines = rows.map(row => row.map(escapeCSV).join(','))
  return [headerLine, ...dataLines].join('\n')
}

async function exportCustomers(): Promise<{ csv: string; filename: string }> {
  const result = await sql`SELECT name, email, phone, address, city, state, zip_code, notes FROM customers ORDER BY name`
  const headers = ['Customer', 'Email', 'Phone', 'Address', 'City', 'State', 'Zip', 'Notes']
  const rows = result.rows.map((r: any) => [
    r.name || '', r.email || '', r.phone || '', r.address || '',
    r.city || '', r.state || '', r.zip_code || '', r.notes || '',
  ])
  return { csv: toCSV(headers, rows), filename: 'floorhub-customers-export.csv' }
}

async function exportProducts(): Promise<{ csv: string; filename: string }> {
  const result = await sql`SELECT name, sku, category, cost_price, selling_price, sqft_per_box, stock_boxes, supplier, description FROM products ORDER BY name`
  const headers = ['Item Name', 'SKU', 'Type', 'Cost', 'Sales Price', 'Sq Ft Per Box', 'Quantity On Hand', 'Vendor', 'Description']
  const rows = result.rows.map((r: any) => [
    r.name || '', r.sku || '', r.category || '',
    String(r.cost_price ?? 0), String(r.selling_price ?? 0),
    String(r.sqft_per_box ?? 0), String(r.stock_boxes ?? 0),
    r.supplier || '', r.description || '',
  ])
  return { csv: toCSV(headers, rows), filename: 'floorhub-products-export.csv' }
}

async function exportInvoices(): Promise<{ csv: string; filename: string }> {
  const invoices = await sql`
    SELECT i.invoice_number, i.customer_name, i.customer_email, i.status, i.total, i.tax_amount, i.discount, i.notes, i.created_at
    FROM invoices i
    WHERE i.is_estimate = false
    ORDER BY i.created_at DESC
  `
  const headers = ['Invoice No', 'Customer', 'Email', 'Status', 'Total', 'Tax', 'Discount', 'Notes', 'Date']
  const rows = invoices.rows.map((r: any) => [
    r.invoice_number || '', r.customer_name || '', r.customer_email || '',
    r.status || '', String(r.total ?? 0), String(r.tax_amount ?? 0),
    String(r.discount ?? 0), r.notes || '',
    r.created_at ? new Date(r.created_at).toISOString().split('T')[0] : '',
  ])
  return { csv: toCSV(headers, rows), filename: 'floorhub-invoices-export.csv' }
}

async function exportExpenses(): Promise<{ csv: string; filename: string }> {
  const result = await sql`SELECT category, description, amount, payment_method, vendor_name, date, reference_number FROM expenses ORDER BY date DESC`
  const headers = ['Account', 'Description', 'Amount', 'Payment Method', 'Vendor', 'Date', 'Reference']
  const rows = result.rows.map((r: any) => [
    r.category || '', r.description || '', String(r.amount ?? 0),
    r.payment_method || '', r.vendor_name || '',
    r.date || '', r.reference_number || '',
  ])
  return { csv: toCSV(headers, rows), filename: 'floorhub-expenses-export.csv' }
}

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    requireOwner(user)

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') as ExportType | null

    if (!type || !['customers', 'products', 'invoices', 'expenses'].includes(type)) {
      return NextResponse.json({ error: 'type must be one of: customers, products, invoices, expenses' }, { status: 400 })
    }

    let result: { csv: string; filename: string }
    if (type === 'customers') result = await exportCustomers()
    else if (type === 'products') result = await exportProducts()
    else if (type === 'invoices') result = await exportInvoices()
    else result = await exportExpenses()

    return new Response(result.csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${result.filename}"`,
      },
    })
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: 401 })
    if (error instanceof ForbiddenError) return NextResponse.json({ error: error.message }, { status: 403 })
    console.error('[quickbooks/export]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
