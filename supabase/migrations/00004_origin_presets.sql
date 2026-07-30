-- ============================================
-- 00004: origin_presets (read-only reference data)
-- Security: authenticated read-only, no write
-- from client. Seeded via migration only.
-- ============================================

create table public.origin_presets (
  id serial primary key,
  country text not null check (char_length(country) <= 100),
  region text not null check (char_length(region) <= 100),
  lat numeric check (lat between -90 and 90),
  lng numeric check (lng between -180 and 180),
  altitude_range text check (char_length(altitude_range) <= 50),
  signature text check (char_length(signature) <= 300),
  key_varietals text[] default '{}',
  name_ko text check (char_length(name_ko) <= 100),
  name_en text check (char_length(name_en) <= 100)
);

comment on table public.origin_presets is 'Read-only coffee origin reference data';

create index idx_presets_country on public.origin_presets(country);

-- RLS: authenticated users can read, nobody can write via API
alter table public.origin_presets enable row level security;

create policy "presets_select_authenticated"
  on public.origin_presets for select
  to authenticated
  using (true);

-- No insert/update/delete policies = no client writes
-- Data is seeded via this migration only

-- Seed data: 20 countries × representative regions
insert into public.origin_presets (country, region, lat, lng, altitude_range, signature, key_varietals, name_ko, name_en) values
('Ethiopia', 'Yirgacheffe', 6.16, 38.2, '1700-2200m', '화사한 꽃향, 시트러스, 베리, 차 같은 바디', ARRAY['Heirloom','Kurume','Dega'], '에티오피아', 'Ethiopia'),
('Ethiopia', 'Guji', 5.8, 39.1, '1800-2200m', '블루베리, 자스민, 열대과일', ARRAY['Heirloom','Kurume'], '에티오피아', 'Ethiopia'),
('Ethiopia', 'Sidama', 6.65, 38.47, '1700-2100m', '꽃향, 레몬, 홍차, 부드러운 바디', ARRAY['Heirloom','Dega'], '에티오피아', 'Ethiopia'),
('Colombia', 'Huila', 2.53, -75.52, '1200-2000m', '캐러멜, 붉은 사과, 균형 잡힌 산미', ARRAY['Caturra','Castillo','Pink Bourbon'], '콜롬비아', 'Colombia'),
('Colombia', 'Nariño', 1.29, -77.36, '1500-2100m', '감귤, 꿀, 크리미한 바디', ARRAY['Caturra','Colombia','Geisha'], '콜롬비아', 'Colombia'),
('Kenya', 'Nyeri', -0.42, 36.95, '1500-2100m', '블랙커런트, 토마토, 밝은 산미, 풀바디', ARRAY['SL28','SL34','Ruiru 11'], '케냐', 'Kenya'),
('Kenya', 'Kirinyaga', -0.5, 37.28, '1500-2000m', '베리, 자몽, 복합적 산미', ARRAY['SL28','SL34','Batian'], '케냐', 'Kenya'),
('Panama', 'Boquete', 8.78, -82.43, '1200-1800m', '자스민, 베르가못, 열대과일, 실키한 바디', ARRAY['Geisha','Caturra','Catuai'], '파나마', 'Panama'),
('Guatemala', 'Antigua', 14.56, -90.73, '1300-2000m', '초콜릿, 스파이스, 오렌지, 풀바디', ARRAY['Bourbon','Caturra','Catuai'], '과테말라', 'Guatemala'),
('Guatemala', 'Huehuetenango', 15.31, -91.48, '1500-2000m', '사과, 캐러멜, 밝은 산미', ARRAY['Bourbon','Caturra','Pache'], '과테말라', 'Guatemala'),
('Brazil', 'Cerrado', -18.5, -47.5, '800-1400m', '견과, 초콜릿, 낮은 산미, 무거운 바디', ARRAY['Mundo Novo','Catuai','Yellow Bourbon'], '브라질', 'Brazil'),
('Brazil', 'Sul de Minas', -21.5, -45.5, '900-1400m', '견과, 캐러멜, 부드러운 바디', ARRAY['Catuai','Mundo Novo','Bourbon'], '브라질', 'Brazil'),
('Costa Rica', 'Tarrazú', 9.65, -84.0, '1200-1900m', '꿀, 시트러스, 클린, 밝은 산미', ARRAY['Caturra','Catuai','Villa Sarchi'], '코스타리카', 'Costa Rica'),
('Indonesia', 'Sumatra', 0.5, 99.0, '1000-1600m', '얼씨, 허브, 담배, 무거운 바디', ARRAY['Typica','Catimor','Ateng'], '인도네시아', 'Indonesia'),
('Rwanda', 'Nyamasheke', -2.35, 29.1, '1500-2000m', '오렌지, 꽃향, 차, 실키한 바디', ARRAY['Red Bourbon','Jackson'], '르완다', 'Rwanda'),
('Peru', 'Cajamarca', -7.16, -78.51, '1200-2000m', '견과, 초콜릿, 부드러운 산미', ARRAY['Typica','Caturra','Bourbon'], '페루', 'Peru'),
('Honduras', 'Marcala', 14.15, -88.03, '1100-1700m', '캐러멜, 열대과일, 균형', ARRAY['Catuai','Caturra','Parainema'], '온두라스', 'Honduras'),
('Yemen', 'Haraaz', 15.1, 43.7, '1500-2400m', '건과일, 와인, 스파이스, 복합적', ARRAY['Udaini','Tuffahi'], '예멘', 'Yemen'),
('Burundi', 'Kayanza', -2.92, 29.63, '1500-2000m', '붉은 과일, 시트러스, 꽃향, 클린', ARRAY['Red Bourbon','Jackson'], '부룬디', 'Burundi'),
('Tanzania', 'Kilimanjaro', -3.07, 37.35, '1400-2000m', '블랙커런트, 와인, 밝은 산미', ARRAY['Bourbon','Kent','N39'], '탄자니아', 'Tanzania'),
('El Salvador', 'Santa Ana', 13.99, -89.56, '1200-1800m', '꿀, 아몬드, 붉은 사과, 크리미', ARRAY['Bourbon','Pacas','Pacamara'], '엘살바도르', 'El Salvador'),
('Nicaragua', 'Jinotega', 13.09, -86.0, '1100-1700m', '초콜릿, 시트러스, 균형', ARRAY['Caturra','Bourbon','Maracaturra'], '니카라과', 'Nicaragua'),
('Mexico', 'Chiapas', 16.75, -93.12, '1000-1700m', '초콜릿, 견과, 부드러운 산미', ARRAY['Typica','Bourbon','Caturra'], '멕시코', 'Mexico'),
('Papua New Guinea', 'Eastern Highlands', -6.1, 145.5, '1300-1800m', '열대과일, 버터리, 복합적', ARRAY['Typica','Bourbon','Arusha'], '파푸아뉴기니', 'Papua New Guinea'),
('India', 'Karnataka', 13.0, 75.5, '1000-1500m', '스파이스, 초콜릿, 풀바디', ARRAY['S795','SL9','Selection 9'], '인도', 'India'),
('Vietnam', 'Da Lat', 11.94, 108.44, '800-1500m', '초콜릿, 견과, 진한, 무거운 바디', ARRAY['Catimor','Typica'], '베트남', 'Vietnam');
