# Deployment (Vercel)

## 권장 설정 (Monorepo)

### 옵션 A: Root Directory = `apps/web`
- Build Command: `npm run build`
- Output Directory: `.next`
- Install Command: `npm install`

### 옵션 B: Root Directory = Repo Root
- Build Command: `npm --workspace apps/web run build`
- Output Directory: `apps/web/.next`
- Install Command: `npm install`

## 필수 환경 변수

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

## 권장 환경 변수

```
SUPABASE_SERVICE_ROLE_KEY=
FLOORPLAN_PROVIDER_ORDER=snaptrude,anthropic,openai
FLOORPLAN_CACHE_BUCKET=floorplan-cache
FLOORPLAN_PREPROCESS_THRESHOLD=200
FLOORPLAN_PREPROCESS_MEDIAN=3
FLOORPLAN_PREPROCESS_BLUR=0.3
FLOORPLAN_PREPROCESS_BG_BLUR=12
FLOORPLAN_PREPROCESS_CONTRAST=1.25
FLOORPLAN_PREPROCESS_BRIGHTNESS=-15
FLOORPLAN_SNAP_TOLERANCE=4
FLOORPLAN_MERGE_GAP_TOLERANCE=6
FLOORPLAN_MERGE_ALIGN_TOLERANCE=2
FLOORPLAN_OPENING_ATTACH_DISTANCE=20

SNAPTRUDE_API_URL=
SNAPTRUDE_API_KEY=
ANTHROPIC_API_KEY=
ANTHROPIC_MODEL=
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini
ASSET_STORAGE_BUCKET=assets-glb
TRIPOSR_API_URL=
TRIPOSR_API_KEY=
TRIPOSR_STATUS_URL=
NEXT_PUBLIC_DRACO_DECODER_PATH=
```

## 배포 후 체크리스트

- `/auth/callback` 리다이렉트 동작 확인
- Google/Kakao 로그인 성공 및 세션 유지 확인
- 도면 업로드 → 분석 → 3D 생성 정상 동작 확인
