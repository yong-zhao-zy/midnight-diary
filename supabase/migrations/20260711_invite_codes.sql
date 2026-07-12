-- 内测码系统 + 管理员角色
-- 执行方式：在 Supabase SQL Editor 手动执行

-- 1. invite_codes 表
create table if not exists invite_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  created_by uuid references auth.users(id) on delete set null,
  used_by uuid references auth.users(id) on delete set null,
  used_at timestamptz,
  created_at timestamptz default now(),
  note text default ''
);

-- 索引
create index if not exists idx_invite_codes_code on invite_codes(code);
create index if not exists idx_invite_codes_used_by on invite_codes(used_by);

-- RLS
alter table invite_codes enable row level security;

-- 2. profiles 表加列（role + invite_code_id）
alter table profiles add column if not exists role text default 'user' check (role in ('user','admin'));
alter table profiles add column if not exists invite_code_id uuid references invite_codes(id) on delete set null;

-- 3. RLS 策略 — invite_codes
-- 管理员全权限
create policy "admin_full_access" on invite_codes
  for all to authenticated
  using ( exists ( select 1 from profiles where id = auth.uid() and role = 'admin' ) );

-- 普通用户只能查看自己消耗的那一条
create policy "user_view_own" on invite_codes
  for select to authenticated
  using ( used_by = auth.uid() );
 
-- 4. 初始管理员设定（手动执行，替换 YOUR_USER_ID）
-- update profiles set role = 'admin' where id = 'YOUR_USER_ID';
-- select * from diaries
update profiles set role = 'admin' where id ='e78d3105-4d0f-4751-94d2-f089061e8e04';


