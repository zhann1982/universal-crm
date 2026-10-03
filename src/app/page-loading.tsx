export function PageLoading() {
  return <div role="status" aria-live="polite" className="flex min-h-64 items-center justify-center gap-3 p-8 text-sm text-slate-600">
    <span aria-hidden="true" className="h-7 w-7 animate-spin rounded-full border-2 border-slate-200 border-t-cyan-600 motion-reduce:animate-none" />
    <span>Загрузка страницы…</span>
  </div>;
}
