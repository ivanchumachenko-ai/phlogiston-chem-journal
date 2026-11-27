import { useState } from "react";
import { CirclePause, Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
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

export function UpdatePreference({ lang, incognito, className }: {
  lang: keyof typeof copy;
  incognito: boolean;
  className: string;
}) {
  const [paused, setPaused] = useState(updatesPaused);
  const [saving, setSaving] = useState(false);

  if (!isPublishedApp || (!isPinnedApp && !launchedFromHomeScreen())) return null;
  const text = copy[lang];

  async function toggle() {
    setSaving(true);
    const next = !paused;
    try {
      await setUpdatesPaused(next);
      setPaused(next);
      toast({ description: text.detail });
    } catch {
      toast({ description: text.error, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      className={`${className} shrink-0 aria-disabled:opacity-50 aria-pressed:bg-accent aria-pressed:text-accent-foreground aria-pressed:[--button-outline:hsl(var(--primary))]`}
      aria-label={text.title}
      aria-pressed={paused}
      aria-busy={saving}
      aria-disabled={incognito || saving}
      title={incognito ? text.incognito : text.title}
      onClick={() => {
        if (!incognito && !saving) void toggle();
      }}
      data-testid="button-pause-updates"
    >
      {saving ? <Loader2 className="animate-spin" /> : paused ? <CirclePause /> : <Download />}
    </Button>
  );
}
