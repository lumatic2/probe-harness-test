// 실행: node --test starter/shell/*.test.mjs  (디렉터리 통째 지정 금지 — serve.mjs 까지 테스트로 돈다)
// 이 파일 자체가 테스트 골격 예시다 — 과제 로직 테스트도 이 형태(node:test + assert)로 추가한다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCsv } from './csv.mjs';

test('기본: 헤더→객체 배열', () => {
  const rows = parseCsv('a,b\n1,2\n3,4');
  assert.deepEqual(rows, [{ a: '1', b: '2' }, { a: '3', b: '4' }]);
});

test('따옴표 필드: 콤마·줄바꿈·"" 이스케이프', () => {
  const rows = parseCsv('id,memo\n1,"안녕, ""줄바꿈""\n포함"');
  assert.equal(rows[0].memo, '안녕, "줄바꿈"\n포함');
});

test('CRLF·BOM·빈 줄·빈 셀', () => {
  const rows = parseCsv('﻿a,b\r\n1,\r\n\r\n2,x\r\n');
  assert.deepEqual(rows, [{ a: '1', b: '' }, { a: '2', b: 'x' }]);
});
