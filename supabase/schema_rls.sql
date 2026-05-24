-- Schéma indicatif pour migrer vers Supabase.
-- Le backend FastAPI fourni utilise SQLAlchemy, mais ces règles montrent la logique RLS attendue.

-- 1. Exemple : table profiles liée à auth.users
-- create table public.profiles (
--   id uuid primary key references auth.users(id) on delete cascade,
--   school_id uuid references public.schools(id),
--   full_name text not null,
--   role text not null check (role in ('SUPER_ADMIN','ADMIN_ECOLE','PREFET','DIRECTEUR','ENSEIGNANT','COMPTABLE','PARENT','ELEVE')),
--   is_active boolean not null default true,
--   created_at timestamptz not null default now()
-- );

-- 2. Activer RLS sur les tables sensibles
-- alter table public.students enable row level security;
-- alter table public.grades enable row level security;
-- alter table public.report_cards enable row level security;
-- alter table public.payments enable row level security;
-- alter table public.audit_logs enable row level security;

-- 3. Fonction utilitaire : rôle courant
-- create or replace function public.current_role()
-- returns text language sql stable as $$
--   select role from public.profiles where id = auth.uid()
-- $$;

-- 4. Fonction utilitaire : école courante
-- create or replace function public.current_school_id()
-- returns uuid language sql stable as $$
--   select school_id from public.profiles where id = auth.uid()
-- $$;

-- 5. Exemple policy multi-école pour students
-- create policy "school users can read own school students"
-- on public.students for select
-- using (
--   public.current_role() = 'SUPER_ADMIN'
--   or school_id = public.current_school_id()
-- );

-- 6. Exemple policy parent : le parent ne voit que ses enfants
-- create policy "parents can read own children report cards"
-- on public.report_cards for select
-- using (
--   public.current_role() in ('SUPER_ADMIN','ADMIN_ECOLE','PREFET','DIRECTEUR')
--   or exists (
--     select 1
--     from public.parents p
--     join public.parent_students ps on ps.parent_id = p.id
--     where p.profile_id = auth.uid()
--       and ps.student_id = report_cards.student_id
--   )
-- );

-- 7. Storage recommandé
-- Buckets privés : report-cards, imports, exports, letters.
-- Aucun document scolaire sensible ne doit être public.
-- Les téléchargements doivent passer par une fonction serveur qui vérifie le rôle, l’école,
-- l’enfant lié au parent, puis génère une signed URL à expiration courte.

-- v22 : RLS complémentaire pour les nouveaux modules.
-- À exécuter dans Supabase après création des tables équivalentes.
-- Principe : chaque profil ne voit que les lignes de son école ; parent/élève sont limités à leurs propres données.

alter table if exists enrollments enable row level security;
alter table if exists attendance_records enable row level security;
alter table if exists schedule_slots enable row level security;
alter table if exists administrative_documents enable row level security;
alter table if exists backup_snapshots enable row level security;
alter table if exists library_books enable row level security;
alter table if exists library_loans enable row level security;
alter table if exists password_reset_tokens enable row level security;

create policy if not exists enrollments_same_school_select on enrollments
for select using (
  school_id in (select school_id from profiles where id = auth.uid())
  or exists (select 1 from profiles where id = auth.uid() and role = 'SUPER_ADMIN')
);

create policy if not exists attendance_same_school_select on attendance_records
for select using (
  school_id in (select school_id from profiles where id = auth.uid())
  or student_id in (select s.id from students s where s.profile_id = auth.uid())
  or exists (select 1 from parent_students ps join parents p on p.id = ps.parent_id where p.profile_id = auth.uid() and ps.student_id = attendance_records.student_id)
  or exists (select 1 from profiles where id = auth.uid() and role = 'SUPER_ADMIN')
);

create policy if not exists schedule_same_school_select on schedule_slots
for select using (
  school_id in (select school_id from profiles where id = auth.uid())
  or exists (select 1 from profiles where id = auth.uid() and role = 'SUPER_ADMIN')
);

create policy if not exists documents_same_school_select on administrative_documents
for select using (
  school_id in (select school_id from profiles where id = auth.uid())
  or student_id in (select s.id from students s where s.profile_id = auth.uid())
  or exists (select 1 from parent_students ps join parents p on p.id = ps.parent_id where p.profile_id = auth.uid() and ps.student_id = administrative_documents.student_id)
  or exists (select 1 from profiles where id = auth.uid() and role = 'SUPER_ADMIN')
);

create policy if not exists backups_direction_only on backup_snapshots
for all using (
  exists (select 1 from profiles where id = auth.uid() and role in ('SUPER_ADMIN','PREFET','DIRECTEUR') and (profiles.school_id = backup_snapshots.school_id or profiles.role = 'SUPER_ADMIN'))
) with check (
  exists (select 1 from profiles where id = auth.uid() and role in ('SUPER_ADMIN','PREFET','DIRECTEUR') and (profiles.school_id = backup_snapshots.school_id or profiles.role = 'SUPER_ADMIN'))
);

create policy if not exists library_books_same_school_select on library_books
for select using (
  school_id in (select school_id from profiles where id = auth.uid())
  or exists (select 1 from profiles where id = auth.uid() and role = 'SUPER_ADMIN')
);

create policy if not exists library_loans_same_school_select on library_loans
for select using (
  school_id in (select school_id from profiles where id = auth.uid())
  or student_id in (select s.id from students s where s.profile_id = auth.uid())
  or exists (select 1 from parent_students ps join parents p on p.id = ps.parent_id where p.profile_id = auth.uid() and ps.student_id = library_loans.student_id)
  or exists (select 1 from profiles where id = auth.uid() and role = 'SUPER_ADMIN')
);

-- Les jetons de réinitialisation ne doivent jamais être lisibles côté client.
create policy if not exists password_reset_tokens_no_select on password_reset_tokens
for select using (false);
