-- 00006에서 누락된 권한 부여 (00005 security_hardening 패턴 따름)
-- RLS가 행 단위 접근을 통제하므로 롤에는 테이블 단위 CRUD만 부여
grant select, insert, update, delete on public.blend_components to authenticated;
