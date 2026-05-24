export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    PUBLISHED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    VALIDATED: 'bg-blue-50 text-blue-700 border-blue-200',
    BLOCKED: 'bg-red-50 text-red-700 border-red-200',
    DRAFT: 'bg-slate-50 text-slate-700 border-slate-200',
    CORRECTED: 'bg-amber-50 text-amber-700 border-amber-200',
    actif: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  }
  return <span className={`rounded-full border px-2 py-1 text-xs font-semibold ${map[status] ?? 'bg-slate-50 text-slate-700 border-slate-200'}`}>{status}</span>
}
