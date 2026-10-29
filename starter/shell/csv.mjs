// csv.mjs — 의존성 0 CSV 파서 (브라우저·Node 공용). 구현은 ../domains/csv.mjs (CSV 올리기와 같은 파서를 쓴다).
// 처리: 따옴표 필드 · 필드 안 콤마/줄바꿈 · "" 이스케이프 · CRLF · BOM
// 한계: 구분자 콤마 고정. 다른 구분자(탭 등)면 두 번째 인자로 바꾼다.
export { parseCsv } from '../domains/csv.mjs';
