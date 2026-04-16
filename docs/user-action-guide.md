# 사용자 실행 가이드 (Room-First Deskterior)

이 문서는 현재 메인 제품 경로인 **홈 시작하기 -> 공간 선택/공간 만들기 -> 룸 빌더 -> 데스크테리어 에디터 -> 발행 -> 읽기 전용 커뮤니티 뷰어** 운영 절차를 다룹니다.

## 1) 환경 변수 설정

### Web (`apps/web/.env.local`)
필수:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `RAILWAY_API_URL`
- `NEXT_PUBLIC_APP_URL` (`http://127.0.0.1:3100` 또는 배포 도메인)

권장:
- `PROJECT_MEDIA_BUCKET`
- `E2E_ROOM_FLOW_BASE_URL`
- `E2E_ROOM_FLOW_STRICT`
- `E2E_ROOM_FLOW_PROJECT_ID`
- `E2E_ROOM_FLOW_SHARED_TOKEN`

### API (`apps/api/.env`)
필수:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `CORS_ORIGINS`

### Worker (`apps/worker/.env`)
메인 제품 기준 필수 항목:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ASSET_STORAGE_BUCKET`
- `WORKER_CONCURRENCY`
- `WORKER_POLL_INTERVAL_MS`
- `ASSET_GENERATION_POLL_INTERVAL_MS`
- `ASSET_GENERATION_MAX_POLLS`

## 2) 핵심 QA/E2E 순서

아래 14단계를 기본 회귀 기준으로 사용합니다.

1. 홈(`/`)에서 `공간 선택` 카드 진입하기
2. `빈 공간` 템플릿 하나를 골라 builder로 이동하기
3. 홈(`/`)로 돌아와 `가구가 비치된 공간` 템플릿 목록으로 진입하기
4. 가구 배치 템플릿 하나를 골라 pre-seeded editor 흐름이 생성되는지 확인하기
5. 홈(`/`)로 돌아와 `공간 만들기` 카드 진입하기
6. 치수 조정하기
7. 문/창문 추가하기
8. 스타일 선택 후 에디터 진입하기
9. 에디터에서 데스크테리어 가구 추가하기
10. 가구 이동/회전하고 `월드/로컬` 좌표계를 전환해보기
11. 저장/발행하기
12. 공유 토큰 열기
13. 읽기 전용 뷰어에서 제품 클릭하기
14. 갤러리/커뮤니티에서 동일 장면 열기

실행 명령:

```bash
npm --workspace apps/web run qa:primary
E2E_ROOM_FLOW_STRICT=1 npm --workspace apps/web run primary:e2e:room-flow:strict
npm --workspace apps/web run primary:e2e:room-flow:full
```

`primary:e2e:room-flow:full`은 Supabase 환경 변수가 없는 환경에서는 실행되지 않습니다.

## 3) 배포 전 체크리스트

- 빌더/에디터/뷰어 공통 레이아웃이 유지되는지 확인
- 뷰어에 편집 affordance가 노출되지 않는지 확인
- 갤러리/커뮤니티 카드가 `/shared/[token]` 읽기 전용 뷰어로 이동하는지 확인
- 제품 클릭 시 정보 drawer가 열리고 최소 필드가 노출되는지 확인
  - 제품명
  - 카테고리
  - 브랜드
  - 가격
  - 옵션/규격
  - 실제 규격(W/D/H mm)
  - 마감 색상/재질
  - 디테일 노트
  - 원본 상품 링크

## 3-1) DB 레거시 정리 적용 체크리스트

대상 마이그레이션:
- `20260414123000_remove_legacy_floorplan_intake.sql`
- `20260414130000_remove_project_versions_floor_plan.sql`

실행 순서:
1. restore point 시각과 `SUPABASE_DB_URL`을 준비한다.
2. worker를 멈추고, 에디터 `저장/발행`을 maintenance window로 잠깐 묶는다.
3. `psql "$SUPABASE_DB_URL" -f supabase/checks/legacy_cleanup_preflight.sql`
4. 필요하면 아래 백업을 만든다.
5. `psql "$SUPABASE_DB_URL" -f supabase/migrations/20260414123000_remove_legacy_floorplan_intake.sql`
6. `psql "$SUPABASE_DB_URL" -f supabase/migrations/20260414130000_remove_project_versions_floor_plan.sql`
7. `psql "$SUPABASE_DB_URL" -f supabase/checks/legacy_cleanup_postcheck.sql`
8. project save 1회, asset-generation job 1회 smoke check 후 worker와 저장/발행을 재개한다.

빠른 영향도 확인 SQL:
```sql
do $$
declare
  v_count bigint;
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'jobs'
      and column_name = 'floorplan_id'
  ) then
    execute 'select count(*) from public.jobs where floorplan_id is not null' into v_count;
    raise notice '[impact] jobs.floorplan_id rows = %', v_count;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'project_versions'
      and column_name = 'floor_plan'
  ) then
    execute 'select count(*) from public.project_versions where floor_plan is not null and floor_plan <> ''{}''::jsonb' into v_count;
    raise notice '[impact] project_versions.floor_plan rows = %', v_count;
  end if;
end
$$;
```

선택 백업:
```sql
create table if not exists public.backup_project_versions_floor_plan_20260414 as
select id, project_id, version, floor_plan, now() as backed_up_at
from public.project_versions
where floor_plan is not null and floor_plan <> '{}'::jsonb;
```

실패 대응:
- step 3 이전에 문제면 중단하고 창을 다시 잡는다.
- step 5가 부분 적용되면 traffic은 열지 말고, 같은 migration file 재실행 또는 PITR 둘 중 하나만 선택한다.
- step 6이 부분 적용되면 save/publish를 계속 막은 채 migration 재실행 후 smoke check를 다시 한다.
- drop된 테이블/컬럼의 일반적인 롤백 수단은 PITR이며, optional backup table은 `floor_plan` 데이터 확인용 보조 수단이다.
- PITR 복구 시 Web/API/Worker 배포 버전도 같은 시점으로 맞춘다.

## 4) 데스크테리어 자산 운영 (Blender + 오픈소스)

1. Blender에서 `.blend` 소스를 수정/제작한다.
2. 먼저 preflight로 source/runtime 상태를 확인한다.

```bash
npm --workspace apps/web run assets:export:deskterior -- --report
```

3. Blender headless export를 실행한다.

```bash
npm --workspace apps/web run assets:export:deskterior
```

`blender` 실행 파일이 PATH에 없으면 아래처럼 명시한다.

```bash
BLENDER_BIN="/Applications/Blender.app/Contents/MacOS/Blender" \
  npm --workspace apps/web run assets:export:deskterior
```

4. 카탈로그를 동기화한다.

```bash
npm --workspace apps/web run assets:sync:deskterior
```

5. 파이프라인 정합성(source/runtime/manifest)을 검증한다.

```bash
npm --workspace apps/web run assets:verify:deskterior
```

6. 에디터에서 자산 배치 후 저장/발행하고 shared viewer에서 제품 정보를 검증한다.
  - 실측 고정(`scaleLocked=true`) 제품은 Inspector의 `크기 비율` 입력이 비활성화되는지 확인
  - shared viewer 제품 카드에서 W/D/H, 마감 색상/재질, 디테일 노트가 보이는지 확인
  - 데스크/선반 계열 support 배치 시 실측 기반으로 상면(top) 클램핑이 자연스럽게 유지되는지 확인
  - floor/surface 배치 시 벽 관통 없이 wall clearance가 적용되고, 인접 자산과 과도한 중첩이 완화되는지 확인
  - 상단뷰 하단 툴바와 속성 패널에서 `월드/로컬` 토글이 동일하게 동작하는지 확인
  - gizmo 드래그 중 방 외곽으로 나가려 하면 live clamp가 걸리고, mouse-up 후 위치가 다시 튀지 않는지 확인
  - finishColor/finishMaterial이 있는 제품은 GLB 표면 톤/질감이 기존 대비 반영되는지 확인
  - `DeskWood`/`DeskMetal`/`StandWood`/`StandPad`/`LampBody`/`LampAccent`/`LampBulb` 슬롯이 의도한 재질 특성으로 분리 반영되는지 확인
7. 조명 제품은 뷰어에서 실제 광원 효과가 보이는지 확인한다.

실패 대응:
- `assets:export:deskterior` 실패 시 `--report`로 누락/stale 원인을 먼저 확인한다.
- `assets:verify:deskterior`가 실패하면 manifest의 `assetId`/필수 메타(`brand`, `externalUrl`, `description`, `category`, `options`)를 우선 수정한다.
- 규격 불일치가 발견되면 `.blend` 실측 값을 기준으로 `dimensionsMm`/`supportProfile`/`options`를 함께 갱신한다.
- `p2s_desk_lamp_glow`의 `options`에는 반드시 `light-emitter` 힌트를 유지한다.

오픈소스 자산 체크:
- 라이선스(CC0 우선) 확인
- 출처 URL 기록 (`externalUrl`)
- 브랜드/옵션/설명 메타 입력

## 2026-04-14 변경 동기화 (Legacy Runtime Cleanup)
Added:
- room-first deskterior 운영 절차와 asset-generation 전용 worker 변수.

Updated:
- QA 시나리오를 공유/커뮤니티 중심으로 재정렬.

Removed/Deprecated:
- floorplan/intake/legacy pipeline 운영 절차 및 관련 환경 변수.

## 2026-04-16 변경 동기화 (Reference Start Flow + Template Browser)
Added:
- 홈 시작하기, 공간 선택 브라우저, 가구 배치 템플릿 진입을 운영 회귀 순서에 추가.

Updated:
- QA 기본 경로를 `builder 직행`에서 `홈 -> 선택/생성 -> builder -> editor -> viewer/community`로 갱신.

Removed/Deprecated:
- 새 방 만들기만으로 전체 회귀를 대표하던 단일 시작 시나리오.

## 2026-04-16 변경 동기화 (Reference 4-Step Builder Shell)
Added:
- builder QA 시 4단계 shell에서 step 2 치수 오버레이, step 3 개구부 선택/삭제, step 4 마감 선택 preview를 확인하는 기준을 추가.

Updated:
- 홈 -> builder 회귀에서 `/studio/builder`가 상단 툴바 없는 split shell로 노출되는 것을 기본 기대값으로 갱신.

Removed/Deprecated:
- builder preview summary 카드와 step chip 존재를 전제로 한 기존 확인 포인트.

## 2026-04-16 변경 동기화 (Editor Precision Controls)
Added:
- 에디터 QA에 `월드/로컬` 좌표계 토글과 live placement clamp 검증 항목을 추가.

Updated:
- top-view 편집 검증을 “이동/회전 가능”에서 “이동/회전 + 좌표계 전환 + 실시간 경계 보정”까지 확장.

Removed/Deprecated:
- 드래그 중에는 room bounds 보정이 없어도 괜찮다는 운영 가정.

## 2026-04-14 변경 동기화 (Physical Fidelity Operations)
Added:
- 배포 전 체크리스트에 실측 규격/마감/디테일 노출 검증 항목 추가.
- 실측 고정 제품의 스케일 입력 차단 검증 항목 추가.

Updated:
- deskterior 운영 절차에 Blender 실측 기준의 메타데이터 동기화 지침을 포함.

Removed/Deprecated:
- 옵션 문자열만으로 규격 검증을 대체하던 점검 방식.

## 2026-04-14 변경 동기화 (Physical Fidelity Stage-2)
Added:
- 실측 기반 support surface 배치 검증 항목 추가.
- finish 메타데이터의 실제 렌더 반영 검증 항목 추가.

Updated:
- 데스크테리어 검증 절차를 “정보 표시” 중심에서 “배치 정합성 + 렌더 반영” 중심으로 확장.

Removed/Deprecated:
- 마감 정보를 텍스트 확인만으로 완료 처리하던 운영 점검.

## 2026-04-14 변경 동기화 (Physical Fidelity Stage-3)
Added:
- wall clearance 및 자산 간 중첩 완화 동작을 운영 검증 항목으로 추가.
- Blender 알려진 슬롯 기준의 slot-aware finish 반영 검증 항목 추가.

Updated:
- 데스크테리어 검증 절차를 “support top + 기본 finish”에서 “물리 충돌 완화 + 슬롯별 재질 디테일”까지 확장.

Removed/Deprecated:
- 신규 배치 초기 위치는 fallback 규격 기준 검증만으로 충분하다는 운영 가정.

## 2026-04-14 변경 동기화 (Physical Fidelity Stage-4)
Added:
- 홈 레퍼런스 사진 대비 검증 항목 추가: 밝은 우드톤 재질의 디테일 보존, 웜/쿨 조명 균형, 접지 그림자 선명도.
- 환경광 검증 항목 추가: HDRI 선택 우선순위가 적용되어 씬 톤이 일관적으로 재현되는지 확인.

Updated:
- 운영 점검을 "물리 배치 정합성"에서 "물리 + 시각 레퍼런스 정합성"으로 확장.

Removed/Deprecated:
- 장면 품질 판정을 제품 정보/배치 결과만으로 완료 처리하던 점검 방식.
