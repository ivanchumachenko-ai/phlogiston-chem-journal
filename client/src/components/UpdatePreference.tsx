import { useId, useState } from "react";
import { Switch } from "@/components/ui/switch";
import {
  isPinnedApp,
  isPublishedApp,
  launchedFromHomeScreen,
  setUpdatesPaused,
  updatesPaused,
} from "@/lib/launchStatistics";

const copy = {
  ru: {
    title: "Не загружать обновления автоматически",
    detail: "Настройка действует со следующего запуска с главного экрана.",
    incognito: "Для изменения настройки выйдите из режима инкогнито.",
    error: "Не удалось сохранить версию. Проверьте подключение к интернету.",
  },
  en: {
    title: "Pause automatic updates",
    detail: "Takes effect the next time you launch from the home screen.",
    incognito: "Exit incognito mode to change this setting.",
    error: "Could not save the version. Check your internet connection.",
  },
};

export function UpdatePreference({ lang, incognito = false }: {
  lang: keyof typeof copy;
  incognito?: boolean;
}) {
  const label = useId();
  const description = useId();
  const [paused, setPaused] = useState(updatesPaused);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  if (!isPublishedApp || (!isPinnedApp && !launchedFromHomeScreen())) return null;
  const text = copy[lang];

  async function save(next: boolean) {
    setSaving(true);
    setFailed(false);
    try {
      await setUpdatesPaused(next);
      setPaused(next);
    } catch {
      setFailed(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="flex items-start justify-between gap-4 rounded-lg border p-4">
      <div className="space-y-1">
        <label htmlFor={label} className="text-base font-semibold">{text.title}</label>
        <p id={description} className="text-sm text-muted-foreground">
          {incognito ? text.incognito : text.detail}
        </p>
        {failed && <p role="alert" className="text-sm text-destructive">{text.error}</p>}
      </div>
      <Switch id={label} aria-describedby={description} checked={paused}
        disabled={incognito || saving} onCheckedChange={(next) => void save(next)} />
    </section>
  );
}
