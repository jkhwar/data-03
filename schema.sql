-- ============================================
-- 한강러너 마라톤 동호회 사이트 DB 스키마
-- Supabase (PostgreSQL) 용
-- 테이블 접두어: mc_ (Marathon Club)
-- ============================================

-- ----------------------------------------------------
-- 1. 지역 (지역별 러닝 코스)
-- ----------------------------------------------------
create table if not exists mc_regions (
  id uuid primary key default gen_random_uuid(),
  name text not null,              -- 예: '반포 한강공원'
  city text not null default '서울',
  description text,
  created_at timestamptz default now()
);

-- ----------------------------------------------------
-- 2. 회원 프로필 (auth.users와 1:1)
-- ----------------------------------------------------
create table if not exists mc_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nickname text not null,
  region_id uuid references mc_regions(id),
  pace_level text check (pace_level in ('입문', '초급', '중급', '고급', '서브3')),
  bio text,
  avatar_url text,
  created_at timestamptz default now()
);

-- ----------------------------------------------------
-- 3. 모임 (정기모임/소모임 통합)
-- ----------------------------------------------------
create table if not exists mc_meetups (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  type text not null check (type in ('정기모임', '소모임')),
  region_id uuid references mc_regions(id),
  host_id uuid references mc_profiles(id),
  meetup_date timestamptz not null,
  location_name text not null,
  distance_km numeric(4,1),
  pace_target text,
  max_participants int default 20,
  description text,
  created_at timestamptz default now()
);

-- ----------------------------------------------------
-- 4. 모임 참가 신청
-- ----------------------------------------------------
create table if not exists mc_registrations (
  id uuid primary key default gen_random_uuid(),
  meetup_id uuid references mc_meetups(id) on delete cascade,
  profile_id uuid references mc_profiles(id) on delete cascade,
  status text default '신청완료' check (status in ('신청완료', '취소')),
  created_at timestamptz default now(),
  unique (meetup_id, profile_id)
);

-- ----------------------------------------------------
-- 5. 게시판 글 (공지사항 / 자유게시판 / 인증샷 통합)
-- ----------------------------------------------------
create table if not exists mc_posts (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('공지사항', '자유게시판', '인증샷')),
  title text not null,
  content text not null,
  image_url text,                 -- 인증샷 등에 사용, 선택 입력
  author_id uuid references mc_profiles(id) on delete cascade,
  view_count int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ----------------------------------------------------
-- 6. 게시글 댓글
-- ----------------------------------------------------
create table if not exists mc_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references mc_posts(id) on delete cascade,
  author_id uuid references mc_profiles(id) on delete cascade,
  content text not null,
  created_at timestamptz default now()
);

-- ----------------------------------------------------
-- 조회수 증가용 함수 (RLS 우회, 누구나 호출 가능)
-- ----------------------------------------------------
create or replace function mc_increment_view_count(p_post_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update mc_posts set view_count = view_count + 1 where id = p_post_id;
end;
$$;

grant execute on function mc_increment_view_count(uuid) to anon, authenticated;

-- ============================================
-- RLS (Row Level Security)
-- ============================================
alter table mc_regions enable row level security;
alter table mc_profiles enable row level security;
alter table mc_meetups enable row level security;
alter table mc_registrations enable row level security;
alter table mc_posts enable row level security;
alter table mc_comments enable row level security;

-- 지역 / 모임: 전체 공개 조회
create policy "지역 전체 공개" on mc_regions for select using (true);
create policy "모임 전체 공개" on mc_meetups for select using (true);
create policy "로그인 사용자 모임 생성" on mc_meetups for insert with check (auth.uid() = host_id);

-- 프로필: 조회 공개, 본인만 생성/수정
create policy "프로필 전체 공개" on mc_profiles for select using (true);
create policy "본인 프로필 생성" on mc_profiles for insert with check (auth.uid() = id);
create policy "본인 프로필 수정" on mc_profiles for update using (auth.uid() = id);

-- 참가 신청: 본인 것만 조회/생성/취소
create policy "본인 신청 조회" on mc_registrations for select using (auth.uid() = profile_id);
create policy "본인 신청 생성" on mc_registrations for insert with check (auth.uid() = profile_id);
create policy "본인 신청 취소" on mc_registrations for update using (auth.uid() = profile_id);

-- 게시글: 목록/상세는 누구나, 작성은 로그인, 수정/삭제는 작성자 본인만
create policy "게시글 전체 공개" on mc_posts for select using (true);
create policy "로그인 사용자 게시글 작성" on mc_posts for insert with check (auth.uid() = author_id);
create policy "작성자 본인 게시글 수정" on mc_posts for update using (auth.uid() = author_id);
create policy "작성자 본인 게시글 삭제" on mc_posts for delete using (auth.uid() = author_id);

-- 댓글: 조회는 누구나, 작성은 로그인, 삭제는 작성자 본인만
create policy "댓글 전체 공개" on mc_comments for select using (true);
create policy "로그인 사용자 댓글 작성" on mc_comments for insert with check (auth.uid() = author_id);
create policy "작성자 본인 댓글 삭제" on mc_comments for delete using (auth.uid() = author_id);

-- ============================================
-- 샘플 데이터
-- ============================================
insert into mc_regions (name, city, description) values
  ('반포 한강공원', '서울', '세빛섬을 지나는 대표 러닝 코스, 강바람이 시원한 야간 러닝 명소'),
  ('올림픽공원', '서울', '평화의 문 출발, 5km 순환 코스로 초보자도 부담 없는 코스'),
  ('서울숲', '서울', '숲길과 강변길이 이어지는 완만한 코스, 가족 단위 러너도 많음'),
  ('여의도 한강공원', '서울', '벚꽃길로 유명, 야경이 아름다운 직선 코스')
on conflict do nothing;
