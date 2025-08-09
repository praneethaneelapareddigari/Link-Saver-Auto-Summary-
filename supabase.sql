create table if not exists public.bookmarks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  url text not null,
  title text,
  favicon text,
  summary text,
  created_at timestamptz not null default now()
);

alter table public.bookmarks enable row level security;

create policy "Users can read own bookmarks"
on public.bookmarks for select
using (auth.uid() = user_id);

create policy "Users can insert own bookmarks"
on public.bookmarks for insert
with check (auth.uid() = user_id);

create policy "Users can delete own bookmarks"
on public.bookmarks for delete
using (auth.uid() = user_id);
