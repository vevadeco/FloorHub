'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react'
import { cn } from '@/lib/utils'

type JobType = 'installation' | 'delivery' | 'pickup'

interface CalendarEvent {
  id: string
  invoice_number: string
  customer_name: string
  job_type: JobType
  scheduled_date: string
}

const JOB_COLORS: Record<JobType, string> = {
  installation: 'bg-blue-100 text-blue-800 border-blue-200',
  delivery: 'bg-green-100 text-green-800 border-green-200',
  pickup: 'bg-amber-100 text-amber-800 border-amber-200',
}

const JOB_LABELS: Record<JobType, string> = {
  installation: 'Installation',
  delivery: 'Delivery',
  pickup: 'Pickup',
}

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December']
const DAY_NAMES = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

export default function CalendarPage() {
  const router = useRouter()
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1) // 1-indexed
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/calendar?year=${year}&month=${month}`)
      .then(r => r.json())
      .then(d => setEvents(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false))
  }, [year, month])

  const prevMonth = () => {
    if (month === 1) { setYear(y => y - 1); setMonth(12) }
    else setMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (month === 12) { setYear(y => y + 1); setMonth(1) }
    else setMonth(m => m + 1)
  }

  // Build calendar grid
  const firstDay = new Date(year, month - 1, 1).getDay() // 0=Sun
  const daysInMonth = new Date(year, month, 0).getDate()
  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  // Pad to complete last row
  while (cells.length % 7 !== 0) cells.push(null)

  const eventsByDay = events.reduce<Record<number, CalendarEvent[]>>((acc, e) => {
    const day = parseInt(e.scheduled_date.split('-')[2])
    if (!acc[day]) acc[day] = []
    acc[day].push(e)
    return acc
  }, {})

  const todayDay = now.getFullYear() === year && now.getMonth() + 1 === month ? now.getDate() : null

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight">Calendar</h1>
          <p className="text-muted-foreground mt-1">Scheduled installations, deliveries, and pickups</p>
        </div>
        {/* Legend */}
        <div className="flex items-center gap-3 flex-wrap">
          {(Object.keys(JOB_COLORS) as JobType[]).map(type => (
            <span key={type} className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border', JOB_COLORS[type])}>
              <span className="w-2 h-2 rounded-full bg-current opacity-70" />
              {JOB_LABELS[type]}
            </span>
          ))}
        </div>
      </div>

      {/* Month navigation */}
      <div className="flex items-center justify-between">
        <Button variant="outline" size="icon" onClick={prevMonth}><ChevronLeft className="h-4 w-4" /></Button>
        <h2 className="font-heading text-xl font-semibold">{MONTH_NAMES[month - 1]} {year}</h2>
        <Button variant="outline" size="icon" onClick={nextMonth}><ChevronRight className="h-4 w-4" /></Button>
      </div>

      {/* Calendar grid */}
      <div className="border rounded-lg overflow-hidden bg-card">
        {/* Day headers */}
        <div className="grid grid-cols-7 border-b">
          {DAY_NAMES.map(d => (
            <div key={d} className="py-2 text-center text-xs font-medium text-muted-foreground bg-muted/40">{d}</div>
          ))}
        </div>

        {/* Cells */}
        {loading ? (
          <div className="p-12 text-center text-muted-foreground">Loading...</div>
        ) : (
          <div className="grid grid-cols-7">
            {cells.map((day, idx) => {
              const dayEvents = day ? (eventsByDay[day] ?? []) : []
              const isToday = day === todayDay
              const visible = dayEvents.slice(0, 3)
              const overflow = dayEvents.length - visible.length

              return (
                <div
                  key={idx}
                  className={cn(
                    'min-h-[100px] p-1.5 border-b border-r last:border-r-0 [&:nth-child(7n)]:border-r-0',
                    !day && 'bg-muted/20',
                  )}
                >
                  {day && (
                    <>
                      <span className={cn(
                        'inline-flex items-center justify-center w-6 h-6 text-xs font-medium rounded-full mb-1',
                        isToday ? 'bg-accent text-accent-foreground' : 'text-foreground'
                      )}>
                        {day}
                      </span>
                      <div className="space-y-0.5">
                        {visible.map(e => (
                          <button
                            key={e.id}
                            onClick={() => router.push(`/invoices/${e.id}`)}
                            className={cn(
                              'w-full text-left text-[11px] px-1.5 py-0.5 rounded border truncate leading-tight hover:opacity-80 transition-opacity',
                              JOB_COLORS[e.job_type]
                            )}
                            title={`${e.customer_name} — ${JOB_LABELS[e.job_type]}`}
                          >
                            {e.customer_name}
                          </button>
                        ))}
                        {overflow > 0 && (
                          <p className="text-[10px] text-muted-foreground pl-1">+{overflow} more</p>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {events.length === 0 && !loading && (
        <div className="text-center py-8 text-muted-foreground">
          <CalendarDays className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p>No scheduled jobs this month.</p>
          <p className="text-sm mt-1">Set a job type and date when creating an invoice to see it here.</p>
        </div>
      )}
    </div>
  )
}
