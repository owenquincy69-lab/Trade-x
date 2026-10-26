create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  phone text,
  referral_code text not null unique,
  referred_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
grant select, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "own profile read" on public.profiles for select to authenticated using (auth.uid() = id or referred_by = auth.uid());
create policy "own profile update" on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

create or replace function public.protect_profile_fields() returns trigger language plpgsql set search_path = public as $$
begin
  if current_user = 'authenticated' then
    new.referral_code := old.referral_code;
    new.referred_by := old.referred_by;
  end if;
  return new;
end $$;
create trigger protect_profile before update on public.profiles for each row execute function public.protect_profile_fields();

create type public.app_role as enum ('admin','user');
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;
create policy "own roles" on public.user_roles for select to authenticated using (auth.uid() = user_id);
create or replace function public.has_role(_user_id uuid, _role app_role) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role) $$;

create table public.wallets (
  user_id uuid primary key,
  balance numeric(12,2) not null default 0 check (balance >= 0),
  updated_at timestamptz not null default now()
);
grant select on public.wallets to authenticated;
grant all on public.wallets to service_role;
alter table public.wallets enable row level security;
create policy "own wallet" on public.wallets for select to authenticated using (auth.uid() = user_id);

create table public.wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  amount numeric(12,2) not null,
  kind text not null,
  note text,
  created_at timestamptz not null default now()
);
grant select on public.wallet_transactions to authenticated;
grant all on public.wallet_transactions to service_role;
alter table public.wallet_transactions enable row level security;
create policy "own tx" on public.wallet_transactions for select to authenticated using (auth.uid() = user_id);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid,
  title text not null,
  description text not null default '',
  price numeric(12,2) not null check (price > 0),
  image_url text,
  category text not null default 'General',
  stock integer not null default 1 check (stock >= 0),
  created_at timestamptz not null default now()
);
grant select on public.products to anon;
grant select, insert, update, delete on public.products to authenticated;
grant all on public.products to service_role;
alter table public.products enable row level security;
create policy "public products" on public.products for select to anon, authenticated using (true);
create policy "seller insert" on public.products for insert to authenticated with check (auth.uid() = seller_id);
create policy "seller update" on public.products for update to authenticated using (auth.uid() = seller_id) with check (auth.uid() = seller_id);
create policy "seller delete" on public.products for delete to authenticated using (auth.uid() = seller_id);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null,
  seller_id uuid,
  product_id uuid references public.products(id) on delete set null,
  product_title text not null,
  quantity integer not null,
  total numeric(12,2) not null,
  status text not null default 'paid',
  created_at timestamptz not null default now()
);
grant select on public.orders to authenticated;
grant all on public.orders to service_role;
alter table public.orders enable row level security;
create policy "buyer or seller orders" on public.orders for select to authenticated using (auth.uid() = buyer_id or auth.uid() = seller_id);

create table public.deposits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  amount numeric(12,2) not null check (amount >= 1),
  phone text not null,
  status text not null default 'pending',
  checkout_request_id text unique,
  mpesa_receipt text,
  result_desc text,
  created_at timestamptz not null default now()
);
grant select on public.deposits to authenticated;
grant all on public.deposits to service_role;
alter table public.deposits enable row level security;
create policy "own deposits" on public.deposits for select to authenticated using (auth.uid() = user_id);

create table public.referral_commissions (
  referred_id uuid primary key,
  referrer_id uuid not null,
  qualifying_amount numeric(12,2) not null default 0,
  commission numeric(12,2) not null default 0,
  paid_out numeric(12,2) not null default 0,
  updated_at timestamptz not null default now()
);
grant select on public.referral_commissions to authenticated;
grant all on public.referral_commissions to service_role;
alter table public.referral_commissions enable row level security;
create policy "referrer sees" on public.referral_commissions for select to authenticated using (auth.uid() = referrer_id);

create or replace function public.commission_for(_amount numeric) returns numeric language sql immutable as $$
  select case
    when _amount >= 10000 then 4000
    when _amount >= 5000 then 2000
    when _amount >= 2500 then 1000
    when _amount >= 1000 then 400
    when _amount >= 250 then 100
    else 0 end::numeric $$;

create or replace function public.credit_wallet(_user uuid, _amount numeric, _kind text, _note text) returns void language plpgsql security definer set search_path = public as $$
begin
  insert into wallets(user_id, balance) values (_user, 0) on conflict do nothing;
  update wallets set balance = balance + _amount, updated_at = now() where user_id = _user;
  insert into wallet_transactions(user_id, amount, kind, note) values (_user, _amount, _kind, _note);
end $$;
revoke execute on function public.credit_wallet(uuid, numeric, text, text) from public, anon, authenticated;

create or replace function public.recalc_referral(_referred uuid) returns void language plpgsql security definer set search_path = public as $$
declare _referrer uuid; _total numeric; _qualified int; _owed numeric;
begin
  select referred_by into _referrer from profiles where id = _referred;
  if _referrer is null then return; end if;
  select coalesce((select sum(amount) from deposits where user_id = _referred and status = 'completed'),0)
       + coalesce((select sum(total) from orders where buyer_id = _referred),0) into _total;
  insert into referral_commissions(referred_id, referrer_id, qualifying_amount, commission)
    values (_referred, _referrer, _total, commission_for(_total))
    on conflict (referred_id) do update set qualifying_amount = excluded.qualifying_amount,
      commission = greatest(referral_commissions.commission, excluded.commission), updated_at = now();
  select count(*) into _qualified from referral_commissions where referrer_id = _referrer and commission > 0;
  if _qualified >= 3 then
    select coalesce(sum(commission - paid_out),0) into _owed from referral_commissions where referrer_id = _referrer;
    if _owed > 0 then
      update referral_commissions set paid_out = commission where referrer_id = _referrer;
      perform credit_wallet(_referrer, _owed, 'commission', 'Referral commission');
    end if;
  end if;
end $$;
revoke execute on function public.recalc_referral(uuid) from public, anon, authenticated;

create or replace function public.complete_deposit(_checkout text, _receipt text, _ok boolean, _desc text) returns void language plpgsql security definer set search_path = public as $$
declare d deposits;
begin
  select * into d from deposits where checkout_request_id = _checkout for update;
  if d.id is null or d.status <> 'pending' then return; end if;
  if _ok then
    update deposits set status = 'completed', mpesa_receipt = _receipt, result_desc = _desc where id = d.id;
    perform credit_wallet(d.user_id, d.amount, 'deposit', 'M-Pesa ' || coalesce(_receipt,''));
    perform recalc_referral(d.user_id);
  else
    update deposits set status = 'failed', result_desc = _desc where id = d.id;
  end if;
end $$;
revoke execute on function public.complete_deposit(text, text, boolean, text) from public, anon, authenticated;
grant execute on function public.complete_deposit(text, text, boolean, text) to service_role;

create or replace function public.purchase_product(_product uuid, _qty int) returns uuid language plpgsql security definer set search_path = public as $$
declare p products; _total numeric; _bal numeric; _order uuid; _buyer uuid := auth.uid();
begin
  if _buyer is null then raise exception 'Please sign in'; end if;
  if _qty < 1 then raise exception 'Invalid quantity'; end if;
  select * into p from products where id = _product for update;
  if p.id is null then raise exception 'Product not found'; end if;
  if p.seller_id = _buyer then raise exception 'You cannot buy your own product'; end if;
  if p.stock < _qty then raise exception 'Not enough stock'; end if;
  _total := p.price * _qty;
  select balance into _bal from wallets where user_id = _buyer for update;
  if coalesce(_bal,0) < _total then raise exception 'Insufficient wallet balance. Please deposit first.'; end if;
  update wallets set balance = balance - _total, updated_at = now() where user_id = _buyer;
  insert into wallet_transactions(user_id, amount, kind, note) values (_buyer, -_total, 'purchase', p.title);
  update products set stock = stock - _qty where id = p.id;
  insert into orders(buyer_id, seller_id, product_id, product_title, quantity, total)
    values (_buyer, p.seller_id, p.id, p.title, _qty, _total) returning id into _order;
  if p.seller_id is not null then perform credit_wallet(p.seller_id, _total, 'sale', p.title); end if;
  perform recalc_referral(_buyer);
  return _order;
end $$;
revoke execute on function public.purchase_product(uuid, int) from public, anon;
grant execute on function public.purchase_product(uuid, int) to authenticated;

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
declare _ref uuid; _code text;
begin
  _code := upper(substr(replace(gen_random_uuid()::text,'-',''),1,8));
  if new.raw_user_meta_data ? 'ref' then
    select id into _ref from profiles where referral_code = upper(new.raw_user_meta_data->>'ref');
  end if;
  insert into profiles(id, display_name, referral_code, referred_by)
    values (new.id, coalesce(new.raw_user_meta_data->>'display_name', new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)), _code, _ref);
  insert into wallets(user_id) values (new.id);
  insert into user_roles(user_id, role) values (new.id, 'user');
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

insert into public.products (title, description, price, image_url, category, stock) values
('Wireless Earbuds Pro', 'Noise-cancelling earbuds with 30-hour battery and charging case.', 2499, '/images/earbuds.jpg', 'Electronics', 50),
('Smart Watch X1', 'Fitness tracking, heart rate, notifications and 7-day battery.', 3999, '/images/watch.jpg', 'Electronics', 30),
('Street Sneakers', 'Lightweight everyday sneakers, breathable mesh, sizes 38-45.', 1850, '/images/sneakers.jpg', 'Fashion', 40),
('Canvas Backpack', 'Water-resistant backpack with laptop sleeve, fits 15.6 inch.', 1299, '/images/backpack.jpg', 'Fashion', 60);
