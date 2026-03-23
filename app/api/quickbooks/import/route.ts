export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, requireOwner, AuthError, ForbiddenError } from '@/lib/auth'
import { sql } from '@/lib/db'

type ImportType = 'customers' | 'products' | 'invoices' | 'expenses'

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim())
  if (lines.length < 2) return []
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, '').toLowerCase())
  return lines.slice(1).map(line => {
    // Handle quoted fields with commas inside
    const values: string[] = []
    let cur = ''
    let inQuote = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') { inQuote = !inQuote }
      else if (ch === ',' && !inQuote) { values.push(cur.trim()); cur = '' }
      else { cur += ch }
    }
    values.push(cur.trim())
    const row: Record<string, string> = {}
    headers.forEach((h, i) => { row[h] = (values[i] ?? '').replace(/^"|"$/g, '') })
    return row
  })
}

function genId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

async function importCustomers(rows: Record<string, string>[]) {
  let imported = 0, skipped = 0
  const errors: string[] = []
  for (const row of rows) {
    const name = row['name'] || row['customer'] || row['full name'] || row['customer name'] || ''
    if (!name) { skipped++; continue }
    try {
      await sql`
        INSERT INTO customers (id, name, email, phone, address, city, state, zip_code, notes)
        VALUES (
          ${genId()}, ${name},
          ${row['email'] || row['e-mail'] || ''},
          ${row['phone'] || row['telephone'] || row['mobile'] || ''},
          ${row['billing address'] || row['address'] || row['street'] || ''},
          ${row['city'] || row['billing city'] || ''},
          ${row['state'] || row['billing state'] || ''},
          ${row['zip'] || row['zip code'] || row['postal code'] || row['billing zip'] || ''},
          ${row['notes'] || ''}
        )
        ON CONFLICT DO NOTHING
      `
      imported++
    } catch (e) {
      errors.push(`Customer "${name}": ${e}`)
      skipped++
    }
  }
  return { imported, skipped, errors }
}

async function importProducts(rows: Record<string, string>[]) {
  let imported = 0, skipped = 0
  const errors: string[] = []
  for (const row of rows) {
    const name = row['name'] || row['item name'] || row['product'] || row['description'] || ''
    if (!name) { skipped++; continue }
    const costPrice = parseFloat(row['cost'] || row['cost price'] || row['purchase cost'] || '0') || 0
    const sellPrice = parseFloat(row['price'] || row['selling price'] || row['sales price'] || row['rate'] || '0') || 0
    const sku = row['sku'] || row['item number'] || row['code'] || `QB-${genId().slice(0, 8).toUpperCase()}`
    try {
      await sql`
        INSERT INTO products (id, name, sku, category, cost_price, selling_price, sqft_per_box, stock_boxes, description, supplier)
        VALUES (
          ${genId()}, ${name}, ${sku},
          ${row['type'] || row['category'] || 'Imported'},
          ${costPrice}, ${sellPrice},
          1, 0,
          ${row['description'] || row['sales description'] || ''},
          ${row['vendor'] || row['preferred vendor'] || ''}
        )
        ON CONFLICT DO NOTHING
      `
      imported++
    } catch (e) {
      errors.push(`Product "${name}": ${e}`)
      skipped++
    }
  }
  return { imported, skipped, errors }
}

async function importInvoices(rows: Record<string, string>[]) {
  let imported = 0, skipped = 0
  const errors: string[] = []
  // Group rows by invoice number (QB exports one row per line item)
  const grouped: Record<string, Record<string, string>[]> = {}
  for (const row of rows) {
    const num = row['num'] || row['invoice no'] || row['invoice number'] || row['transaction id'] || ''
    if (!num) { skipped++; continue }
    if (!grouped[num]) grouped[num] = []
    grouped[num].push(row)
  }
  for (const [invoiceNum, invoiceRows] of Object.entries(grouped)) {
    const first = invoiceRows[0]
    const customerName = first['name'] || first['customer'] || first['bill to'] || 'Unknown'
    const total = parseFloat(first['amount'] || first['total'] || first['balance'] || '0') || 0
    const date = first['date'] || first['invoice date'] || new Date().toISOString().split('T')[0]
    const status = (first['status'] || '').toLowerCase().includes('paid') ? 'paid' : 'sent'
    const invoiceId = genId()
    try {
      // Ensure customer exists
      const { rows: existing } = await sql`SELECT id FROM customers WHERE name = ${customerName} LIMIT 1`
      let customerId: string
      if (existing.length > 0) {
        customerId = existing[0].id
      } else {
        customerId = genId()
        await sql`INSERT INTO customers (id, name) VALUES (${customerId}, ${customerName}) ON CONFLICT DO NOTHING`
      }
      const { rows: invRows } = await sql`
        INSERT INTO invoices (id, invoice_number, customer_id, customer_name, subtotal, tax_rate, tax_amount, discount, total, status, created_at, updated_at)
        VALUES (
          ${invoiceId}, ${invoiceNum}, ${customerId}, ${customerName},
          ${total}, 0, 0, 0, ${total}, ${status},
          ${date}::date, ${date}::date
        )
        ON CONFLICT DO NOTHING
        RETURNING id
      `
      // Only create payment record if invoice was actually inserted (not a duplicate re-import)
      if (status === 'paid' && total > 0 && invRows.length > 0) {
        await sql`
          INSERT INTO manual_payments (id, invoice_id, amount, payment_method, reference_number, notes, date, created_by, created_at)
          VALUES (
            ${genId()}, ${invoiceId}, ${total}, 'other', '', 'Imported from QuickBooks', ${date}, 'quickbooks-import', NOW()
          )
        `
      }
      // Insert line items
      for (const row of invoiceRows) {
        const itemName = row['item'] || row['product/service'] || row['description'] || 'Item'
        const qty = parseFloat(row['qty'] || row['quantity'] || '1') || 1
        const rate = parseFloat(row['rate'] || row['unit price'] || '0') || 0
        const lineTotal = parseFloat(row['amount'] || row['line total'] || String(qty * rate)) || qty * rate
        await sql`
          INSERT INTO invoice_items (id, invoice_id, product_id, product_name, sqft_needed, sqft_per_box, boxes_needed, unit_price, total_price)
          VALUES (${genId()}, ${invoiceId}, '', ${itemName}, ${qty}, 1, ${Math.ceil(qty)}, ${rate}, ${lineTotal})
          ON CONFLICT DO NOTHING
        `
      }
      imported++
    } catch (e) {
      errors.push(`Invoice "${invoiceNum}": ${e}`)
      skipped++
    }
  }
  return { imported, skipped, errors }
}

async function importExpenses(rows: Record<string, string>[]) {
  let imported = 0, skipped = 0
  const errors: string[] = []
  for (const row of rows) {
    const amount = parseFloat(row['amount'] || row['total'] || '0') || 0
    if (!amount) { skipped++; continue }
    const date = row['date'] || new Date().toISOString().split('T')[0]
    const description = row['memo'] || row['description'] || row['name'] || row['account'] || 'Imported expense'
    try {
      await sql`
        INSERT INTO expenses (id, category, description, amount, payment_method, vendor_name, date, created_by)
        VALUES (
          ${genId()},
          ${row['account'] || row['category'] || row['expense account'] || 'General'},
          ${description},
          ${amount},
          ${row['payment method'] || row['payment type'] || 'other'},
          ${row['name'] || row['vendor'] || row['payee'] || ''},
          ${date},
          'quickbooks-import'
        )
      `
      imported++
    } catch (e) {
      errors.push(`Expense row: ${e}`)
      skipped++
    }
  }
  return { imported, skipped, errors }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    requireOwner(user)

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const type = formData.get('type') as ImportType | null

    if (!file || !type) {
      return NextResponse.json({ error: 'Missing file or type' }, { status: 400 })
    }
    if (!['customers', 'products', 'invoices', 'expenses'].includes(type)) {
      return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
    }

    const text = await file.text()
    const rows = parseCSV(text)
    if (rows.length === 0) {
      return NextResponse.json({ error: 'No data rows found in CSV' }, { status: 400 })
    }

    let result: { imported: number; skipped: number; errors: string[] }
    if (type === 'customers') result = await importCustomers(rows)
    else if (type === 'products') result = await importProducts(rows)
    else if (type === 'invoices') result = await importInvoices(rows)
    else result = await importExpenses(rows)

    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: 401 })
    if (error instanceof ForbiddenError) return NextResponse.json({ error: error.message }, { status: 403 })
    console.error('[quickbooks/import]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
