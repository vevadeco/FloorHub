'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { Plus, MessageSquare, CheckCircle } from 'lucide-react'

const PRIORITIES = ['low', 'normal', 'high', 'urgent']
const priorityColor: Record<string, string> = { low: 'bg-stone-100 text-stone-700', normal: 'bg-blue-100 text-blue-700', high: 'bg-orange-100 text-orange-700', urgent: 'bg-red-100 text-red-700' }

export default function MessagesPage() {
  const [messages, setMessages] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState({ title: '', content: '', priority: 'normal' })
  const [currentUserId, setCurrentUserId] = useState('')

  const load = () => fetch('/api/messages').then(r => r.json()).then(setMessages).finally(() => setLoading(false))
  useEffect(() => {
    load()
    fetch('/api/auth/me').then(r => r.json()).then(d => setCurrentUserId(d.user_id ?? d.id ?? ''))
  }, [])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    const res = await fetch('/api/messages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    if (res.ok) { toast.success('Message posted'); setDialogOpen(false); setForm({ title: '', content: '', priority: 'normal' }); load() }
    else { const d = await res.json(); toast.error(d.error ?? 'Failed') }
  }

  const markRead = async (id: string) => {
    await fetch(`/api/messages/${id}/mark-read`, { method: 'POST' })
    load()
  }

  const isRead = (msg: any) => Array.isArray(msg.read_by) && msg.read_by.includes(currentUserId)

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div><h1 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight">Messages</h1><p className="text-muted-foreground mt-1">Internal team announcements</p></div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild><Button className="bg-accent hover:bg-accent/90"><Plus className="h-4 w-4 mr-2" />New Message</Button></DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle className="font-heading">Post Message</DialogTitle></DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4 mt-4">
              <div className="space-y-2"><Label>Title *</Label><Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required /></div>
              <div className="space-y-2"><Label>Priority</Label><Select value={form.priority} onValueChange={v => setForm({ ...form, priority: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{PRIORITIES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-2"><Label>Content *</Label><Textarea value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} rows={4} required /></div>
              <div className="flex justify-end gap-2 pt-2"><Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button><Button type="submit" className="bg-accent hover:bg-accent/90">Post</Button></div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      <div className="space-y-4">
        {loading ? <div className="p-8 text-center text-muted-foreground">Loading...</div>
          : messages.length === 0 ? <div className="p-12 text-center"><MessageSquare className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" /><h3 className="font-medium text-lg mb-1">No messages</h3></div>
          : messages.map(msg => (
            <Card key={msg.id} className={isRead(msg) ? 'opacity-70' : ''}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium">{msg.title}</h3>
                      <Badge variant="outline" className={`text-xs ${priorityColor[msg.priority] ?? ''}`}>{msg.priority}</Badge>
                      {!isRead(msg) && <span className="h-2 w-2 rounded-full bg-accent" />}
                    </div>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{msg.content}</p>
                    <p className="text-xs text-muted-foreground mt-2">By {msg.created_by_name} · {new Date(msg.created_at).toLocaleDateString()}</p>
                  </div>
                  {!isRead(msg) && <Button variant="ghost" size="sm" onClick={() => markRead(msg.id)}><CheckCircle className="h-4 w-4 mr-1" />Mark Read</Button>}
                </div>
              </CardContent>
            </Card>
          ))}
      </div>
    </div>
  )
}
