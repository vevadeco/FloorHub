import { sql, generateId } from '@/lib/db'

export async function calculateCommission(invoiceId: string): Promise<void> {
  // Fetch invoice
  const invResult = await sql`SELECT * FROM invoices WHERE id = ${invoiceId}`
  const inv = invResult.rows[0]
  if (!inv || !inv.created_by) return

  // Fetch employee
  const empResult = await sql`SELECT id, name, commission_rate FROM users WHERE id = ${inv.created_by}`
  const emp = empResult.rows[0]
  if (!emp) return

  const rate = parseFloat(emp.commission_rate)

  // Fetch invoice items with product cost prices
  const itemsResult = await sql`
    SELECT ii.unit_price, ii.boxes_needed, p.cost_price
    FROM invoice_items ii
    LEFT JOIN products p ON p.id = ii.product_id
    WHERE ii.invoice_id = ${invoiceId}
  `

  let profit = 0
  for (const item of itemsResult.rows) {
    const costPrice = item.cost_price ? parseFloat(item.cost_price) : 0
    const unitPrice = parseFloat(item.unit_price)
    const boxes = parseInt(item.boxes_needed)
    profit += (unitPrice - costPrice) * boxes
  }

  const commissionAmount = Math.max(0, profit) * rate / 100
  const commissionId = generateId()
  const invoiceDate = new Date(inv.created_at).toISOString().split('T')[0]

  await sql`
    INSERT INTO commissions (id, employee_id, employee_name, invoice_id, invoice_number, invoice_date, profit, commission_rate, commission_amount, status)
    VALUES (${commissionId}, ${emp.id}, ${emp.name}, ${invoiceId}, ${inv.invoice_number}, ${invoiceDate}, ${profit}, ${rate}, ${commissionAmount}, 'unpaid')
    ON CONFLICT (invoice_id, employee_id) DO UPDATE SET
      profit = EXCLUDED.profit,
      commission_rate = EXCLUDED.commission_rate,
      commission_amount = EXCLUDED.commission_amount,
      updated_at = NOW()
  `
}
