import React from 'react'
import { Document, Page, Text, View, StyleSheet, Image, renderToBuffer } from '@react-pdf/renderer'
import type { Invoice, Settings } from '@/types'

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: 'Helvetica', color: '#1a1a1a' },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 30 },
  logo: { width: 80, height: 40, objectFit: 'contain' },
  companyName: { fontSize: 20, fontFamily: 'Helvetica-Bold', marginBottom: 4 },
  companyInfo: { fontSize: 9, color: '#666', lineHeight: 1.4 },
  invoiceTitle: { fontSize: 24, fontFamily: 'Helvetica-Bold', color: '#333', textAlign: 'right' },
  invoiceNumber: { fontSize: 12, color: '#666', textAlign: 'right', marginTop: 4 },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 11, fontFamily: 'Helvetica-Bold', marginBottom: 8, borderBottomWidth: 1, borderBottomColor: '#e5e7eb', paddingBottom: 4 },
  row: { flexDirection: 'row', marginBottom: 4 },
  label: { width: 100, color: '#666' },
  value: { flex: 1 },
  table: { marginTop: 10 },
  tableHeader: { flexDirection: 'row', backgroundColor: '#f3f4f6', padding: '6 8', fontFamily: 'Helvetica-Bold' },
  tableRow: { flexDirection: 'row', padding: '5 8', borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  col1: { flex: 3 },
  col2: { flex: 1, textAlign: 'right' },
  col3: { flex: 1, textAlign: 'right' },
  col4: { flex: 1, textAlign: 'right' },
  col5: { flex: 1, textAlign: 'right' },
  totals: { marginTop: 16, alignItems: 'flex-end' },
  totalRow: { flexDirection: 'row', marginBottom: 4, width: 200 },
  totalLabel: { flex: 1, color: '#666' },
  totalValue: { width: 80, textAlign: 'right' },
  grandTotal: { flexDirection: 'row', marginTop: 8, paddingTop: 8, borderTopWidth: 2, borderTopColor: '#333', width: 200 },
  grandTotalLabel: { flex: 1, fontFamily: 'Helvetica-Bold', fontSize: 12 },
  grandTotalValue: { width: 80, textAlign: 'right', fontFamily: 'Helvetica-Bold', fontSize: 12 },
  notes: { marginTop: 20, padding: 12, backgroundColor: '#f9fafb', borderRadius: 4 },
  footer: { position: 'absolute', bottom: 30, left: 40, right: 40, textAlign: 'center', color: '#999', fontSize: 8 },
})

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value)
}

function InvoicePDF({ invoice, settings }: { invoice: Invoice; settings: Settings }) {
  return React.createElement(Document, null,
    React.createElement(Page, { size: 'A4', style: styles.page },
      // Header
      React.createElement(View, { style: styles.header },
        React.createElement(View, null,
          settings.logo_url
            ? React.createElement(Image, { src: settings.logo_url, style: styles.logo })
            : React.createElement(Text, { style: styles.companyName }, settings.company_name || 'FloorHub'),
          settings.logo_url && React.createElement(Text, { style: { ...styles.companyName, marginTop: 4 } }, settings.company_name || 'FloorHub'),
          React.createElement(Text, { style: styles.companyInfo }, settings.company_address || ''),
          React.createElement(Text, { style: styles.companyInfo }, settings.company_phone || ''),
          React.createElement(Text, { style: styles.companyInfo }, settings.company_email || ''),
        ),
        React.createElement(View, null,
          React.createElement(Text, { style: styles.invoiceTitle }, invoice.is_estimate ? 'ESTIMATE' : 'INVOICE'),
          React.createElement(Text, { style: styles.invoiceNumber }, invoice.invoice_number),
          React.createElement(Text, { style: { ...styles.invoiceNumber, marginTop: 4 } },
            new Date(invoice.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
          ),
        ),
      ),
      // Customer
      React.createElement(View, { style: styles.section },
        React.createElement(Text, { style: styles.sectionTitle }, 'Bill To'),
        React.createElement(Text, { style: { fontFamily: 'Helvetica-Bold', marginBottom: 2 } }, invoice.customer_name),
        invoice.customer_email && React.createElement(Text, { style: styles.companyInfo }, invoice.customer_email),
        invoice.customer_phone && React.createElement(Text, { style: styles.companyInfo }, invoice.customer_phone),
        invoice.customer_address && React.createElement(Text, { style: styles.companyInfo }, invoice.customer_address),
      ),
      // Items table
      React.createElement(View, { style: styles.table },
        React.createElement(Text, { style: styles.sectionTitle }, 'Items'),
        React.createElement(View, { style: styles.tableHeader },
          React.createElement(Text, { style: styles.col1 }, 'Product'),
          React.createElement(Text, { style: styles.col2 }, 'Sq Ft'),
          React.createElement(Text, { style: styles.col3 }, 'Boxes'),
          React.createElement(Text, { style: styles.col4 }, 'Unit Price'),
          React.createElement(Text, { style: styles.col5 }, 'Total'),
        ),
        ...invoice.items.map((item, i) =>
          React.createElement(View, { key: i, style: styles.tableRow },
            React.createElement(Text, { style: styles.col1 }, item.product_name),
            React.createElement(Text, { style: styles.col2 }, item.sqft_needed.toFixed(2)),
            React.createElement(Text, { style: styles.col3 }, String(item.boxes_needed)),
            React.createElement(Text, { style: styles.col4 }, formatCurrency(item.unit_price)),
            React.createElement(Text, { style: styles.col5 }, formatCurrency(item.total_price)),
          )
        ),
      ),
      // Totals
      React.createElement(View, { style: styles.totals },
        React.createElement(View, { style: styles.totalRow },
          React.createElement(Text, { style: styles.totalLabel }, 'Subtotal'),
          React.createElement(Text, { style: styles.totalValue }, formatCurrency(invoice.subtotal)),
        ),
        React.createElement(View, { style: styles.totalRow },
          React.createElement(Text, { style: styles.totalLabel }, `Tax (${invoice.tax_rate}%)`),
          React.createElement(Text, { style: styles.totalValue }, formatCurrency(invoice.tax_amount)),
        ),
        invoice.discount > 0 && React.createElement(View, { style: styles.totalRow },
          React.createElement(Text, { style: styles.totalLabel }, 'Discount'),
          React.createElement(Text, { style: { ...styles.totalValue, color: '#16a34a' } }, `-${formatCurrency(invoice.discount)}`),
        ),
        React.createElement(View, { style: styles.grandTotal },
          React.createElement(Text, { style: styles.grandTotalLabel }, 'Total'),
          React.createElement(Text, { style: styles.grandTotalValue }, formatCurrency(invoice.total)),
        ),
      ),
      // Notes
      invoice.notes && React.createElement(View, { style: styles.notes },
        React.createElement(Text, { style: { fontFamily: 'Helvetica-Bold', marginBottom: 4 } }, 'Notes'),
        React.createElement(Text, { style: { color: '#666', lineHeight: 1.5 } }, invoice.notes),
      ),
      // Footer
      React.createElement(Text, { style: styles.footer }, `Generated by FloorHub • ${invoice.invoice_number}`),
    )
  )
}

export async function generateInvoicePDF(invoice: Invoice, settings: Settings): Promise<ArrayBuffer> {
  const element = React.createElement(InvoicePDF, { invoice, settings })
  const buffer = await renderToBuffer(element)
  // Copy into a standalone ArrayBuffer (Node Buffer shares a pooled ArrayBufferLike)
  const ab = new ArrayBuffer(buffer.length)
  new Uint8Array(ab).set(buffer)
  return ab
}
