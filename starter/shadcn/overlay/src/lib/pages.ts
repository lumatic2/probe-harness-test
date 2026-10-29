// pages.ts — 페이지 메타(메뉴 이름·상단 주 행동 버튼)와 사이드바 그룹. 새 페이지는 여기에 한 줄 + pages/ 에 파일. 라벨은 도메인 설정에서 온다.
import { CalendarRangeIcon, ClipboardCheckIcon, FileChartColumnIcon, FileSearchIcon, LayoutDashboardIcon, LayoutGridIcon, ListIcon, MessagesSquareIcon, SlidersHorizontalIcon, UploadIcon, type LucideIcon } from 'lucide-react'
import { ctx, linkTo, whereToFilters, type Route } from '@/lib/derive'

export type PageMeta = { name: string; action: { label: string; href: (r: Route) => string } }
export const PAGE_META: Record<string, PageMeta> = {
  dashboard: { name: '대시보드', action: { label: ctx.d.alerts.actionLabel, href: (r) => linkTo('list', r, whereToFilters(ctx.d.alerts.where)) } },
  list: { name: '목록', action: { label: ctx.d.form.action, href: (r) => linkTo('form', r) } },
  item: { name: '상세', action: { label: `이 건 ${ctx.d.form.action}`, href: (r) => linkTo('form', r, {}, r.id) } },
  form: { name: '입력·판정', action: { label: '목록으로', href: (r) => linkTo('list', r) } },
  report: { name: '리포트', action: { label: '목록에서 건 고르기', href: (r) => linkTo('list', r) } },
  widgets: { name: '위젯 모음', action: { label: '대시보드로', href: () => '#/dashboard' } },
  schedule: { name: ctx.d.schedule?.title ?? '일정 격자', action: { label: '목록으로', href: (r) => linkTo('list', r) } },
  review: { name: ctx.d.review?.title ?? '문서 검토', action: { label: '목록으로', href: (r) => linkTo('list', r) } },
  assist: { name: ctx.d.assist?.title ?? 'AI 연습', action: { label: '목록으로', href: (r) => linkTo('list', r) } },
  import: { name: ctx.d.import?.title ?? 'CSV 올리기', action: { label: '목록으로', href: (r) => linkTo('list', r) } },
  settings: { name: '기준값 설정', action: { label: '대시보드로', href: () => '#/dashboard' } },
}

// 도메인 설정에 해당 키가 있을 때만 켜지는 페이지 (schedule · review · assist · import · settings=params)
const OPTIONAL: Record<string, boolean> = { schedule: !!ctx.d.schedule, review: !!ctx.d.review, assist: !!ctx.d.assist, import: !!ctx.d.import, settings: (ctx.d.params?.length ?? 0) > 0 }
export const isEnabled = (key: string) => !(key in OPTIONAL) || OPTIONAL[key]

export const NAV: { title: string; pages: { key: string; icon: LucideIcon }[] }[] = [
  { title: '현황', pages: [{ key: 'dashboard', icon: LayoutDashboardIcon }, { key: 'list', icon: ListIcon }] },
  { title: '작업', pages: [{ key: 'form', icon: ClipboardCheckIcon }, { key: 'report', icon: FileChartColumnIcon }, { key: 'schedule', icon: CalendarRangeIcon }, { key: 'review', icon: FileSearchIcon }, { key: 'assist', icon: MessagesSquareIcon }, { key: 'import', icon: UploadIcon }, { key: 'settings', icon: SlidersHorizontalIcon }].filter((p) => isEnabled(p.key)) },
  { title: '참고', pages: [{ key: 'widgets', icon: LayoutGridIcon }] },
]
