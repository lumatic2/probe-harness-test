// pages/dashboard.js — ① 대시보드: 위젯을 격자에 배치한다. 당일엔 쓸 위젯만 남기고 span 을 조정한다.
// render(state, data) → HTML 문자열. data = { ctx, decisions }. 위젯을 누르면 목록·상세로 드릴다운. 이름·열은 전부 domain.json 에서 온다.
import { metricRow, trendChart, barList, heatmap, alertList, progressBars, funnel, floorMap, panel, periodSeg } from '../widgets.js';
import { buildInputs, linkTo, limitLine, whereToFilters } from '../util.js';

export const meta = (ctx) => ({
  name: '대시보드',
  action: { label: ctx.d.alerts.actionLabel, href: (s) => linkTo('list', s, whereToFilters(ctx.d.alerts.where)) },
});

export function render(state, data) {
  const { ctx } = data;
  const i = buildInputs(ctx, state);
  const toList = linkTo('list', state);
  return `${metricRow({ ...i.w1, items: i.w1.items.slice(0, 4) })}
<div class="sh-grid">
<div class="sh-span-6">${panel({ no: 'W2', title: i.w2.title, html: trendChart(i.w2), href: toList, linkLabel: '목록 ›', seg: periodSeg(state.period) })}</div>
<div class="sh-span-6">${panel({ no: 'W3', title: i.w3.title, html: barList(i.w3), href: toList, linkLabel: '목록 ›' })}</div>
<div class="sh-span-6">${panel({ no: 'W5', title: i.w5.title, html: heatmap(i.w5), href: toList, linkLabel: '목록 ›' })}</div>
<div class="sh-span-6">${panel({ no: 'W9', title: i.w9.title, html: alertList(i.w9), href: linkTo('list', state, whereToFilters(ctx.d.alerts.where)), linkLabel: '전체 ›' })}</div>
<div class="sh-span-6">${panel({ no: 'W6', title: i.w6.title, html: progressBars(i.w6), href: linkTo('report', state), linkLabel: '리포트 ›' })}</div>
<div class="sh-span-6">${panel({ no: 'W7', title: i.w7.title, html: funnel(i.w7), href: toList, linkLabel: '목록 ›' })}</div>
<div class="sh-span-12">${panel({ no: 'W13', title: i.w13.title, html: floorMap(i.w13) })}</div>
</div>
${limitLine(ctx, '배치도는 현재 상태 기준이며 기간·그룹 필터는 흐림 표시에만 반영')}`;
}
