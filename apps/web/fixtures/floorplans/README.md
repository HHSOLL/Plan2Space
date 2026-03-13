# Floorplan Fixtures

이 디렉터리는 상용화 정확도 벤치마크용 fixture만 저장합니다.

## 허용 source policy
- `partner_licensed`
- `user_opt_in`
- `manual_private`

금지:
- 외부 서비스 도면 이미지를 서비스가 자동 수집/스크래핑한 파일
- 출처와 사용 권한이 확인되지 않은 파일

## 권장 입력 채널 태그
- `pdf_export`
- `naver_land_gallery_capture`
- `real_estate_app_screenshot`
- `messenger_compressed`
- `phone_capture`
- `cropped_or_rotated`
- `annotated_user_image`

## manifest 규칙
- 같은 디렉터리에 `manifest.json`을 둡니다.
- 각 fixture는 반드시 `channel`, `sourcePolicy`를 기록합니다.
- 파일명은 정규화된 영문/숫자/하이픈 기준으로 유지합니다.

예시는 `manifest.example.json`을 참고합니다.
