import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { saveFiles } from "@/lib/export";
import { getSavedSyntheses, importSavedSyntheses } from "@/lib/storage";
import { isIsolatedJournal, isolatedJournalUrl } from "@/lib/isolatedJournal";

const labels = {
  ru: {
    title: "Личный журнал",
    description: "Перенесите сохранённые записи файлом. В личной копии браузер хранит журнал отдельно от основного сайта.",
    export: "Скачать журнал",
    import: "Загрузить журнал",
    open: "Открыть личную копию",
    imported: "Журнал загружен",
    error: "Не удалось перенести журнал. Проверьте файл и свободное место в браузере.",
  },
  en: {
    title: "Personal journal",
    description: "Transfer saved entries with a file. Your browser keeps the personal journal separate from the main site.",
    export: "Download journal",
    import: "Import journal",
    open: "Open personal copy",
    imported: "Journal imported",
    error: "Could not transfer the journal. Check the file and available browser storage.",
  },
};

export function JournalTransfer({ lang, onImport }: {
  lang: keyof typeof labels;
  onImport: () => void;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const text = labels[lang];
  const showError = () => toast({ description: text.error, variant: "destructive" });

  async function download() {
    try {
      const contents = JSON.stringify({ version: 1, journal: getSavedSyntheses() });
      await saveFiles([new File([contents], "phlogiston-journal.json", { type: "application/json" })]);
    } catch {
      showError();
    }
  }

  async function load(file: File) {
    try {
      if (file.size > 6 * 1024 * 1024) throw new Error("File exceeds local journal capacity");
      importSavedSyntheses(JSON.parse(await file.text()));
      onImport();
      toast({ description: text.imported });
    } catch {
      showError();
    }
  }

  return (
    <section className="space-y-2 rounded-lg border p-4">
      <h3 className="text-base font-semibold">{text.title}</h3>
      <p className="text-sm text-muted-foreground">{text.description}</p>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => void download()}>{text.export}</Button>
        {isIsolatedJournal ? (
          <>
            <input type="file" ref={fileInput} accept="application/json,.json" hidden
              onChange={(event) => {
                const file = event.currentTarget.files?.[0];
                event.currentTarget.value = "";
                if (file) void load(file);
              }} />
            <Button onClick={() => fileInput.current?.click()}>{text.import}</Button>
          </>
        ) : (
          <Button asChild><a href={isolatedJournalUrl} target="_blank" rel="noopener noreferrer">{text.open}</a></Button>
        )}
      </div>
    </section>
  );
}
