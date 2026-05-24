import { Building2, CheckCircle2, GraduationCap, Landmark, ShieldCheck } from 'lucide-react'

const schoolPhotoStyle = {
  backgroundImage:
    'linear-gradient(180deg, rgba(2, 6, 23, 0.20) 0%, rgba(2, 6, 23, 0.62) 100%), url("/1.jpg")',
}

export function SchoolLogoMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`relative flex shrink-0 items-center justify-center rounded-2xl bg-[#0b2a5b] text-white ring-1 ring-white/25 ${compact ? 'h-11 w-11 shadow-md' : 'h-16 w-16 shadow-xl shadow-blue-950/25'}`}>
      <Building2 size={compact ? 21 : 31} strokeWidth={2.35} />
      <div className="absolute -bottom-1 -right-1 rounded-full border-2 border-white bg-emerald-500 p-1 shadow-sm">
        <ShieldCheck size={compact ? 10 : 13} strokeWidth={3} />
      </div>
    </div>
  )
}

export function SchoolMiniature() {
  return (
    <div className="relative min-h-[220px] overflow-hidden rounded-[1.7rem] border border-slate-200 bg-slate-900 bg-cover bg-center shadow-lg" style={schoolPhotoStyle}>
      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/88 via-slate-950/28 to-transparent" />
      <div className="relative flex h-full min-h-[220px] flex-col justify-between p-5 text-white">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/20 bg-white/15 backdrop-blur">
              <GraduationCap size={25} />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-blue-100">LTP Matonge</p>
              <p className="text-sm font-black">Portail scolaire sécurisé</p>
            </div>
          </div>
          <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-black text-blue-50 backdrop-blur">2025-2026</span>
        </div>

        <div>
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-bold text-blue-50 backdrop-blur">
            <CheckCircle2 size={13} /> Plateforme officielle
          </div>
          <h3 className="text-2xl font-black tracking-tight">Une école mieux organisée.</h3>
          <p className="mt-2 max-w-sm text-xs leading-5 text-slate-100/85">Bulletins, accès par rôle, paiements et audit dans un espace sécurisé.</p>
        </div>
      </div>
    </div>
  )
}

export function SchoolPhotoPanel() {
  return (
    <div className="relative min-h-[620px] overflow-hidden rounded-[2rem] bg-slate-950 bg-cover bg-center shadow-2xl shadow-slate-900/25" style={schoolPhotoStyle}>
      <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/52 to-slate-950/12" />
      <div className="relative flex min-h-[620px] flex-col justify-between p-8 text-white">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <SchoolLogoMark />
            <div>
              <p className="text-xs font-black uppercase tracking-[0.32em] text-blue-100">LTP Matonge</p>
              <p className="text-xl font-black">Portail scolaire sécurisé</p>
            </div>
          </div>
          <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-bold text-blue-50 backdrop-blur">2025-2026</span>
        </div>

        <div className="max-w-2xl">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-bold text-blue-50 backdrop-blur">
            <CheckCircle2 size={14} /> Plateforme officielle de gestion scolaire
          </div>
          <h1 className="text-4xl font-black leading-[1.02] tracking-tight md:text-5xl">Une école mieux organisée, des bulletins mieux protégés.</h1>
          <p className="mt-5 max-w-xl text-sm leading-7 text-slate-100/90">Gestion des élèves, parents, professeurs, points, paiements, sanctions et bulletins avec accès par rôle et vérification par QR code.</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <Metric label="Bulletins" value="Vérifiables" />
          <Metric label="Accès" value="Par rôle" />
          <Metric label="Audit" value="Traçable" />
        </div>
      </div>
    </div>
  )
}

export function PhotoStrip() {
  return (
    <div className="overflow-hidden rounded-[1.8rem] border border-slate-200 bg-white shadow-sm">
      <div className="h-44 bg-slate-900 bg-cover bg-center" style={schoolPhotoStyle} />
      <div className="p-4">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-700">Établissement</p>
        <p className="mt-1 font-black text-slate-950">Lycée Technique & Professionnel de Matonge</p>
      </div>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur">
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-blue-100"><Landmark size={13} /> {label}</div>
      <p className="mt-2 text-lg font-black text-white">{value}</p>
    </div>
  )
}
