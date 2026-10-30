import { useEffect, useState } from 'react'
import './print.css'
import { AppSidebar } from '@/components/app-sidebar'
import { FilterBar } from '@/components/page-parts'
import { SiteHeader } from '@/components/site-header'
import { DataState } from '@/components/data-state'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AppProvider, useApp } from '@/lib/app-context'
import { isEnabled, PAGE_META } from '@/lib/pages'
import { applySettings, ctx, SETTINGS_API } from '@/lib/derive'
import Dashboard from '@/pages/dashboard'
import Assist from '@/pages/assist'
import Form from '@/pages/form'
import ImportPage from '@/pages/import'
import Item from '@/pages/item'
import List from '@/pages/list'
import Report from '@/pages/report'
import Review from '@/pages/review'
import Schedule from '@/pages/schedule'
import Settings from '@/pages/settings'
import Widgets from '@/pages/widgets'

const PAGES: Record<string, () => React.ReactElement> = { dashboard: Dashboard, list: List, item: Item, form: Form, report: Report, widgets: Widgets, schedule: Schedule, review: Review, assist: Assist, import: ImportPage, settings: Settings }

// 저장된 기준값(domain.json 에 params 가 있을 때만)을 불러와 ctx 에 적용한 뒤에야 화면을 그린다 — 저장한 값이 모든 화면 계산에 들어가게
function useSettingsReady() {
  const on = (ctx.d.params?.length ?? 0) > 0
  const [ready, setReady] = useState(!on)
  useEffect(() => {
    if (!on) return
    fetch(`/api/${SETTINGS_API}`).then((r) => (r.ok ? r.json() : null)).then((s) => { if (s?.values) applySettings(s.values) }).catch(() => {}).finally(() => setReady(true))
  }, [on])
  return ready
}

function Shell() {
  const { route } = useApp()
  const ready = useSettingsReady()
  const Page = isEnabled(route.page) ? PAGES[route.page] : undefined
  useEffect(() => { document.title = ctx.d.app.title }, [])
  useEffect(() => { if (!Page) location.replace('#/dashboard') }, [Page])
  useEffect(() => { window.scrollTo(0, 0) }, [route.page, route.id])
  if (!Page || !ready) return <main className="px-4 py-16"><DataState kind="loading" /></main>
  const showFilter = !['item', 'form', 'schedule', 'review', 'assist', 'import', 'settings'].includes(route.page)
  return (
    <SidebarProvider style={{ '--sidebar-width': '16rem', '--header-height': '3.25rem' } as React.CSSProperties}>
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader />
        <div className="@container/main flex flex-1 flex-col gap-4 py-4 md:gap-6 md:py-6" data-page={route.page} data-title={PAGE_META[route.page]?.name}>
          {showFilter ? <FilterBar /> : null}
          {ctx.d.dataSource ? <div className="flex items-center gap-3 px-4 text-sm text-muted-foreground lg:px-6"><span>{ctx.d.dataSource.label || '연결 데이터'} · {ctx.rows.length}건</span><button className="underline" onClick={() => location.reload()}>새로고침</button></div> : null}
          {!ctx.rows.length && ['dashboard', 'list', 'report'].includes(route.page) ? <div className="px-4 lg:px-6"><DataState kind="empty" retry={() => location.reload()} /></div> : <Page />}
        </div>
      </SidebarInset>
      <Toaster position="bottom-right" />
    </SidebarProvider>
  )
}

export default function App() {
  return (
    <TooltipProvider>
      <AppProvider><Shell /></AppProvider>
    </TooltipProvider>
  )
}
