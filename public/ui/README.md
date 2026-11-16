# Keylog UI

접기·펼치기는 일반 버튼과 구분합니다. 버튼형은 `data-ui="disclosure"`와 `k-disclosure-toggle`, native `details`는 `k-disclosure`를 사용합니다. 두 표현은 작은 화살표, 상위 제목의 서체, 최소 여백을 공유하며 기본·호버·누름 상태에 테두리나 밑줄을 만들지 않습니다. 키보드 포커스 표시는 유지합니다.

공개 사이트, Studio, 로컬 공개 미리보기, 디자인 카탈로그가 함께 사용하는 UI 원천입니다.

- `tokens.css`: 종이·잉크, 서체, 간격, 밀도, 포커스, 컨트롤 상태 토큰.
- `controls.css` / `controls.mjs`: 버튼, 필드, 선택, 달력, 메뉴, 대화상자, 검증과 툴팁. 기본 HTML 컨트롤은 동일한 진입점에서 초기화하며 동적으로 추가된 폼도 포함합니다.
- `gallery.mjs` / `gallery.css`: 공개 출력과 Studio의 카드·이미지 렌더러.
- `gallery-profiles.mjs`: 종류별 비율과 `archive`, `relation`, `media`, `timeline` 역할. `gallery-profiles.css`는 `npm run ui:tokens`로 생성합니다. 빌드 전 자동 생성, 검사 시 원천 일치를 확인합니다.

페이지 CSS는 배치만 담당합니다. 버튼·입력·선택·갤러리의 색, 상태, 모서리, 크기를 페이지 선택자로 다시 정의하지 않습니다. 새 표현이 필요하면 이 디렉터리의 의미 있는 역할이나 프로파일을 추가하고 기존 사용처를 함께 확인합니다. 공개와 편집 모드는 별도 테마가 아닙니다.

버튼은 `k-button`과 `data-variant="primary|secondary|quiet|danger"`를 사용합니다. 아이콘 전용은 `data-icon-only`, 내비게이션은 `k-nav` 또는 `k-tab`, 사진 확대는 `data-ui="media"`입니다. 비동기 동작은 `setButtonBusy`로 폭과 상태를 유지합니다. 필터·정렬 도구에도 같은 컨트롤을 사용합니다.

선택 목록과 작업 메뉴는 `k-popover` 표면과 공통 옵션 행 규격을 사용합니다. 벤더 검색과 저장된 보기 선택도 `select-controls.mjs`를 사용하며 별도 목록 버튼을 만들지 않습니다. 즉시 저장되는 선택은 `configureSelect`의 `commitOnDismiss: false`로 검색·Tab·외부 클릭에 의한 쓰기를 막습니다. 신규 항목 생성 여부는 호출자가 `createAction`으로 결정합니다.

스크롤바의 크기·막대·바탕색은 `--k-scrollbar-*` 토큰이 소유합니다. 페이지와 팝업에서 별도 스크롤바 CSS를 추가하지 않습니다. 제조사 표기는 등록된 로고 데이터와 `renderBrandMark` / `k-brand-mark`를 사용합니다.

입력값의 원천은 native `input`, `select`, `textarea`입니다. 표시용 combobox·달력은 해당 값을 투영하며 취소, 비활성, 제한값, 필드 검증을 유지합니다. 프로그램에서 값을 바꾼 뒤에는 `change` 이벤트를 전달합니다. 숨겨진 원천 필드의 포커스는 `focusControl`, 폼 검증은 `validateForm`을 사용합니다. 브라우저 confirm과 reportValidity 대신 공통 확인창과 인라인 오류를 사용합니다.

갤러리 목록에는 `kl-gallery`와 등록된 `data-gallery-role`을 지정합니다. 포함 영역은 `kl-gallery-scope`입니다. 카드 종류는 렌더러가 `data-gallery-profile`로 정합니다. 이미지의 원본·승인된 로고·가공 정책을 CSS에서 변경하지 않습니다.

확인 경로: 공개 `npm run verify`, Studio의 기존 UI·saved-view·gallery-media 테스트, 실제 폼 저장/재열기, 좁은 화면, 키보드 선택·취소. 파일 선택창과 IME 등 OS UI는 브라우저에 맡깁니다.
