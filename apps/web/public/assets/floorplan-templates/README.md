# Floorplan Template Manifest

`manifest.json`은 배열 형태로 템플릿 항목을 저장합니다.

최소 예시:

```json
[
  {
    "id": "apt-oo-84a-v1",
    "apartmentName": "OO아파트",
    "typeName": "84A",
    "region": "서울",
    "licenseStatus": "user_opt_in",
    "version": "1.0.0",
    "topologyPath": "/assets/floorplan-templates/topologies/apt-oo-84a-v1.json",
    "imageSha256": "optional-sha256-for-image-match"
  }
]
```

`licenseStatus`:
- `user_opt_in`
- `partner_licensed`
- `blocked` (조회 제외)
