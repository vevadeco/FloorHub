'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { toast } from 'sonner'
import { Plus, Trash2, Pencil, Search, Package } from 'lucide-react'

const emptyForm = { name: '', sku: '', category: '', cost_price: '', selling_price: '', sqft_per_box: '', stock_boxes: '0', description: '', supplier: '' }

export default function InventoryPage() {
  const [products, setProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [form, setForm] = useState(emptyForm)

  const load = () => fetch('/api/products').then(r => r.json()).then(setProducts).finally(() => setLoading(false))
  useEffect(() => { load() }, [])

  const openCreate = () => { setEditing(null); setForm(emptyForm); setDialogOpen(true) }
  const openEdit = (p: any) => { setEditing(p); setForm({ name: p.name, sku: p.sku, category: p.category, cost_price: p.cost_price, selling_price: p.selling_price, sqft_per_box: p.sqft_per_box, stock_boxes: p.stock_boxes, description: p.description, supplier: p.supplier }); setDialogOpen(true) }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const body = { ...form, cost_price: Number(form.cost_price), selling_price: Number(form.selling_price), sqft_per_box: Number(form.sqft_per_box), stock_boxes: Number(form.stock_boxes) }
    const res = editing
      ? await fetch(`/api/products/${editing.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      : await fetch('/api/products', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    if (res.ok) { toast.success(editing ? 'Product updated' : 'Product created'); setDialogOpen(false); load() }
    else { const d = await res.json(); toast.error(d.error ?? 'Failed') }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this product?')) return
    const res = await fetch(`/api/products/${id}`, { method: 'DELETE' })
    if (res.ok) { toast.success('Product deleted'); load() }
    else { const d = await res.json(); toast.error(d.error ?? 'Failed') }
  }

  const filtered = products.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div><h1 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight">Inventory</h1><p className="text-muted-foreground mt-1">Manage your flooring products</p></div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild><Button className="bg-accent hover:bg-accent/90" onClick={openCreate}><Plus className="h-4 w-4 mr-2" />Add Product</Button></DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle className="font-heading">{editing ? 'Edit Product' : 'Add Product'}</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
              {[['name','Name *'], ['sku','SKU *'], ['category','Category *'], ['supplier','Supplier']].map(([k, l]) => (
                <div key={k} className="space-y-2"><Label>{l}</Label><Input value={(form as any)[k]} onChange={e => setForm({ ...form, [k]: e.target.value })} required={l.includes('*')} /></div>
              ))}
              <div className="grid grid-cols-2 gap-4">
                {[['cost_price','Cost Price *'], ['selling_price','Selling Price *'], ['sqft_per_box','Sq Ft/Box *'], ['stock_boxes','Stock (boxes)']].map(([k, l]) => (
                  <div key={k} className="space-y-2"><Label>{l}</Label><Input type="number" step="0.01" value={(form as any)[k]} onChange={e => setForm({ ...form, [k]: e.target.value })} required={l.includes('*')} /></div>
                ))}
              </div>
              <div className="space-y-2"><Label>Description</Label><Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
              <div className="flex justify-end gap-2 pt-2"><Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button><Button type="submit" className="bg-accent hover:bg-accent/90">{editing ? 'Update' : 'Create'}</Button></div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      <Card><CardContent className="p-4"><div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Search products..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" /></div></CardContent></Card>
      <Card><CardContent className="p-0">
        {loading ? <div className="p-8 text-center text-muted-foreground">Loading...</div>
          : filtered.length === 0 ? <div className="p-12 text-center"><Package className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" /><h3 className="font-medium text-lg mb-1">No products found</h3></div>
          : <div className="overflow-x-auto"><Table>
            <TableHeader><TableRow className="bg-muted/50"><TableHead>Name</TableHead><TableHead>SKU</TableHead><TableHead>Category</TableHead><TableHead className="text-right">Cost</TableHead><TableHead className="text-right">Price</TableHead><TableHead className="text-right">Sq Ft/Box</TableHead><TableHead className="text-right">Stock</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
            <TableBody>{filtered.map(p => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">{p.name}</TableCell>
                <TableCell className="font-mono text-sm">{p.sku}</TableCell>
                <TableCell>{p.category}</TableCell>
                <TableCell className="text-right tabular-nums">${Number(p.cost_price).toFixed(2)}</TableCell>
                <TableCell className="text-right tabular-nums">${Number(p.selling_price).toFixed(2)}</TableCell>
                <TableCell className="text-right tabular-nums">{Number(p.sqft_per_box).toFixed(2)}</TableCell>
                <TableCell className="text-right tabular-nums">{p.stock_boxes}</TableCell>
                <TableCell className="text-right"><div className="flex justify-end gap-1">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(p)}><Pencil className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete(p.id)}><Trash2 className="h-4 w-4" /></Button>
                </div></TableCell>
              </TableRow>
            ))}</TableBody>
          </Table></div>}
      </CardContent></Card>
    </div>
  )
}
