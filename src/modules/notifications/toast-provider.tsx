"use client";

import { createContext, useContext, useState, useCallback, useEffect, useRef, Suspense, type ReactNode } from "react";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { actionFeedback, redirectFeedback, type Feedback } from "./feedback";

const ToastContext = createContext<(feedback: Feedback) => void>(() => {});
export function useToast() { return useContext(ToastContext); }

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<(Feedback & { id: string })[]>([]);
  const notify = useCallback((feedback: Feedback) => {
    setItems(previous => [...previous.slice(-3), { ...feedback, id: crypto.randomUUID() }]);
  }, []);
  const dismiss = useCallback((id: string) => setItems(previous => previous.filter(item => item.id !== id)), []);
  return <ToastContext.Provider value={notify}>
    {children}
    <Suspense><RedirectToast /></Suspense>
    {items.length > 0 && createPortal(<section aria-label="Уведомления" className="crm-toasts">
      {items.map(item => <ToastItem key={item.id} item={item} dismiss={dismiss} />)}
    </section>, document.body)}
  </ToastContext.Provider>;
}

function ToastItem({ item, dismiss }: { item: Feedback & { id: string }; dismiss: (id: string) => void }) {
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (paused || item.kind !== "success") return;
    const timer = window.setTimeout(() => dismiss(item.id), 4000);
    return () => window.clearTimeout(timer);
  }, [item.id, item.kind, dismiss, paused]);
  return <div className={`crm-toast crm-toast-${item.kind}`} onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}
    onFocus={() => setPaused(true)} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false); }}>
    <span aria-hidden="true" className="crm-toast-icon">{item.kind === "success" ? "✓" : "!"}</span>
    <p role={item.kind === "error" ? "alert" : "status"} aria-atomic="true">{item.message}</p>
    <button type="button" aria-label="Закрыть уведомление" onClick={() => dismiss(item.id)}>×</button>
  </div>;
}

function RedirectToast() {
  const path = usePathname(), search = useSearchParams(), notify = useToast();
  const router = useRouter();
  const seen = useRef<string | null>(null);
  useEffect(() => {
    const key = `${path}?${search.toString()}`;
    if (seen.current === key) return;
    seen.current = key;
    const feedback = redirectFeedback(path, new URLSearchParams(search.toString()));
    if (!feedback) return;
    notify(feedback);
    // Consume transient feedback while retaining filters, hash and Next's history state.
    const url = new URL(window.location.href);
    for (const name of ["_notice", "_noticeId", "error", "bulk", "updated", "conflicts"]) url.searchParams.delete(name);
    const destination = `${url.pathname}${url.search}${url.hash}`;
    // A successful server action must also see the cleaned router tree, otherwise
    // its refresh can resurrect the original success query. Keep server-rendered
    // conflict explanations visible until the user's next navigation.
    if (search.has("_notice") || search.has("bulk")) router.replace(destination, { scroll: false });
    else window.history.replaceState(window.history.state, "", destination);
  }, [path, search, notify, router]);
  return null;
}

export function notifyActionResult(notify: (feedback: Feedback) => void, result: unknown) {
  const feedback = actionFeedback(result);
  if (feedback) notify(feedback);
}

export function isNavigationError(error: unknown) {
  const digest = (error as { digest?: unknown } | null)?.digest;
  return typeof digest === "string" && (digest.startsWith("NEXT_REDIRECT") || digest.startsWith("NEXT_HTTP_ERROR_FALLBACK"));
}

export async function runWithToast<T>(notify: (feedback: Feedback) => void, action: () => Promise<T>): Promise<T> {
  try { return await action(); }
  catch (error) {
    if (!isNavigationError(error)) notify({ kind: "error", message: "Не удалось выполнить действие. Проверьте соединение и повторите попытку." });
    throw error;
  }
}
