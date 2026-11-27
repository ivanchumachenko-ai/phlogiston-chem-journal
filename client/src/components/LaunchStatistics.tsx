import { useEffect, useState } from "react";
import { isPublishedApp, loadTotals, readCachedTotals } from "@/lib/launchStatistics";

const copy = {
  ru: {
    title: "Статистика Phlogiston",
    labels: ["Всего запусков", "Уникальных браузеров и установок", "Запусков с главного экрана"],
    loading: "Загружаем статистику…",
    unavailable: "Статистика пока недоступна.",
    since: "Подсчёт с",
    updated: "Последнее обновление",
  },
  en: {
    title: "Phlogiston statistics",
    labels: ["Total launches", "Unique browsers and installations", "Home screen launches"],
    loading: "Loading statistics…",
    unavailable: "Statistics are currently unavailable.",
    since: "Counting since",
    updated: "Last updated",
  },
};

export function LaunchStatistics({ lang, network, offline = false }: {
  lang: keyof typeof copy;
  network: typeof fetch;
  offline?: boolean;
}) {
  const [totals, setTotals] = useState(readCachedTotals);
  const [pending, setPending] = useState(!offline);

  useEffect(() => {
    if (!isPublishedApp || offline) return;
    let controller: AbortController;
    function refresh() {
      controller?.abort();
      const current = new AbortController();
      controller = current;
      setPending(true);
      void loadTotals(network, current.signal).then(setTotals).catch(() => {}).finally(() => {
        if (!current.signal.aborted) setPending(false);
      });
    }
    refresh();
    const interval = window.setInterval(refresh, 60_000);
    window.addEventListener("online", refresh);
    return () => {
      controller.abort();
      window.clearInterval(interval);
      window.removeEventListener("online", refresh);
    };
  }, [network, offline]);

  if (!isPublishedApp) return null;
  const text = copy[lang];
  const format = new Intl.NumberFormat(lang);
  const date = new Intl.DateTimeFormat(lang, { dateStyle: "medium", timeStyle: "short" });
  return (
    <section className="space-y-3 rounded-lg border p-4" aria-label={text.title}>
      <h3 className="text-base font-semibold">{text.title}</h3>
      {totals ? (
        <>
          <dl className="grid gap-3 sm:grid-cols-3">
            {[totals.launches, totals.browsers, totals.standalone].map((value, index) => (
              <div key={text.labels[index]} className="min-w-0 space-y-1">
                <dt className="text-sm text-muted-foreground">{text.labels[index]}</dt>
                <dd className="text-2xl font-semibold tabular-nums">{format.format(value)}</dd>
              </div>
            ))}
          </dl>
          <p className="text-sm text-muted-foreground">
            {totals.since && <>{text.since} {date.format(new Date(totals.since))} · </>}
            {text.updated} {date.format(new Date(totals.updatedAt))}
          </p>
        </>
      ) : <p role="status" className="text-sm text-muted-foreground">
        {pending && !offline ? text.loading : text.unavailable}
      </p>}
    </section>
  );
}
