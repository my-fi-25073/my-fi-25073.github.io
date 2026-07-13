# KEYLOG Public

`../private`의 공개 allowlist 투영 결과로 만드는 Astro 정적 갤러리입니다.
이 저장소에는 공개 승인된 JSON과 웹용 이미지, 사이트 코드만 둡니다. 원본 사진,
SQLite DB, Notion snapshot, 가격, 거래 상대, 개인 메모는 넣지 않습니다.

## 로컬 실행

Node.js 24 이상이 필요합니다. lockfile과 정확히 같은 의존성을 설치한 뒤 개발 서버를
실행합니다.

```sh
npm ci
npm run dev
```

브라우저에서 Astro가 출력한 로컬 주소를 엽니다. 모바일 폭은 Safari의 반응형 디자인
모드나 실제 iPhone에서 확인합니다.

현재 Mac의 전역 npm cache 권한 때문에 `npm ci`가 `EPERM`으로 실패하면 전역 권한을
바꾸지 않고 임시 cache를 지정할 수 있습니다.

```sh
npm ci --cache /private/tmp/keylog-npm-cache
```

## 공개 전 검증

```sh
npm run test
npm run check
npm run build
npm run check:size
```

한 번에 위 자동 검증을 실행하려면 다음 명령을 사용합니다.

```sh
npm run verify
```

빌드 결과를 브라우저로 육안 확인하는 `npm run preview`는 종료되지 않는 서버이므로
자동 `verify`와 별도로 실행합니다.

`check:size`는 공개 소스 작업 트리, 로컬 Git 저장 공간, 실제 게시물인 `dist/`를
각각 측정합니다. 800,000,000바이트부터 외부 이미지 저장소 분리를 준비하라는 경고를
출력하고, 게시 사이트인 `dist/`가 1,000,000,000바이트 이상이면 배포 검증을
실패시킵니다. 소스와 Git 저장 공간은 GitHub의 1GB 권장치에 대한 경고로만 사용합니다.
GitHub 공식 문서는 소스 저장소에 1GB 권장 한도, 게시된 Pages 사이트에 1GB 최대
한도를 둡니다.

## 비공개 데이터 최초 준비

`../private`의 DB, snapshot, 이미지 inbox, stage는 로컬 전용이며 Git에서 제외됩니다.
새 환경에서는 먼저 private 의존성을 설치하고, 지정 경로에 snapshot과 원본 이미지를
준비한 뒤 DB로 가져옵니다. 현재 Serika snapshot 기본 경로는
`snapshots/notion/new-keycap-db/serika.json`입니다.

```sh
cd ../private
npm ci --cache /private/tmp/keylog-private-npm-cache
npm run snapshot:import
```

이미지 입력 경로와 공개 설명은 `publication/serika.images.json`에서 확인합니다.
snapshot이나 inbox가 없으면 발행 명령을 실행하지 않습니다.

## 새 데이터와 이미지 반복 발행

원본 선택과 공개 필드 결정은 비공개 저장소에서 수행합니다. 예를 들어 Serika 묶음을
다시 처리하고 발행하려면 `../private`에서 다음 순서로 실행합니다.

```sh
npm run images:publication -- serika
npm run publish:stage -- Serika
npm run publish:check
npm run publish:apply
```

`images:publication` 인수는 publication 정의 파일의 slug이고, `publish:stage` 인수는
DB의 시리즈 이름 또는 ID입니다. 따라서 `serika`와 `Serika`의 의미가 서로 다릅니다.

마지막 명령까지 성공해야 `public/media/`, `src/content/gallery/`,
`.keylog-manifest.json`이 교체됩니다. 이후 이 저장소에서 `npm run verify`로 공개
결과를 다시 검증합니다. 이 과정은 commit이나 push를 자동으로 하지 않습니다.

`publish:apply`는 증분 복사가 아니라 현재 `stage/public/`을 한 릴리스로 보고
`public/media/`와 `src/content/gallery/` 생성 영역을 교체합니다. 갤러리가 여러 개가 된
뒤에는 적용 전에 stage에 공개하려는 모든 갤러리와 이미지가 들어 있는지 반드시
`publish:check` 결과와 함께 확인합니다.

## 갤러리에 표시할 속성 선택

`src/config/gallery-display.json` 배열을 편집합니다. 키를 제거하면 숨기고, 다시 넣으면
보이며, 배열 순서가 화면 순서입니다.

- `homeCard`: 시리즈 속성 최대 3개
- `seriesDetail`: 시리즈 속성 최대 10개
- `kitCard`: 킷 속성 최대 2개

시리즈에서 사용할 수 있는 키:

`manufacturer`, `profile`, `materials`, `manufacturingProcess`,
`compatibility`, `colors`, `createdAt`, `sleeveStatus`, `kitCount`, `kitNames`

킷에서 사용할 수 있는 키:

`kittingTypes`, `sleeveStatus`

알 수 없는 키, 중복 키, 최대 개수를 넘긴 설정은 Astro 빌드를 중단합니다. 이 설정은
화면 표시만 제어하며 개인정보 필터가 아닙니다. 공개 범위는 계속 `../private`의
allowlist 투영기가 결정합니다.

## GitHub Pages 자동 배포

`.github/workflows/deploy.yml`은 `main` push 또는 수동 실행 시 다음을 수행합니다.

1. 전체 Git 이력을 checkout해 장기 저장소 크기도 측정할 수 있게 합니다.
2. Node 24 환경에서 의존성을 설치합니다.
3. `npm run verify`로 테스트, Astro 검사, 빌드, 용량 검사를 실행합니다.
4. 성공한 `dist/`만 Pages artifact로 올립니다.
5. `github-pages` 환경에 배포합니다.

최초 한 번은 GitHub 저장소의 **Settings → Pages → Build and deployment → Source**에서
**GitHub Actions**를 선택해야 합니다. 저장소명이 `my-fi-25073.github.io`인 사용자
사이트이므로 `astro.config.mjs`의 `site`만 사용하고 `base`는 설정하지 않습니다.

현재 로컬 준비 단계에서는 workflow만 만들며 commit, push, Pages 활성화는 자동으로
수행하지 않습니다.
