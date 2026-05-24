import type { LucideIcon } from 'lucide-react'

export function StatCard({
  title,
  value,
  icon: Icon,
  tone = 'blue',
}: {
  title: string
  value: string | number
  icon: LucideIcon
  tone?: 'blue' | 'emerald' | 'amber' | 'red' | 'slate'
}) {
  const tones = {
    blue: 'bg-blue-50 text-blue-700 ring-blue-100',
    emerald: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
    amber: 'bg-amber-50 text-amber-700 ring-amber-100',
    red: 'bg-red-50 text-red-700 ring-red-100',
    slate: 'bg-slate-100 text-slate-700 ring-slate-200',
  }

  return (
    <article className="app-card rounded-[1.35rem] p-5 transition duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-slate-200/80">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-bold text-slate-500">{title}</p>
          <p className="mt-2 text-3xl font-black tracking-tight text-slate-950">{value}</p>
        </div>
        <div className={`rounded-2xl p-3 ring-1 ${tones[tone]}`}>
          <Icon size={21} strokeWidth={2.35} />
        </div>
      </div>
    </article>
  )
}
