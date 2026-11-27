import { useRef } from "react";
import { ShieldCheck } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { saveFiles } from "@/lib/export";
import { getSavedSyntheses, importSavedSyntheses } from "@/lib/storage";
import { isIsolatedJournal, isolatedJournalUrl } from "@/lib/isolatedJournal";
import { isPublishedApp } from "@/lib/launchStatistics";

const labels = {
  ru: {
    title: "Личный журнал",
    description: "Скачайте сохранённые записи файлом, затем откройте личную копию и загрузите его там. Браузер хранит журналы двух сайтов отдельно. Исходные записи можно удалить в обычной версии после проверки переноса.",
    localDescription: "Импортируйте файл журнала или начните с пустого. Записи хранятся в браузере на этом адресе.",
    export: "Скачать журнал",
    import: "Загрузить журнал",
    open: "Открыть личную копию",
    imported: "Журнал загружен",
    error: "Не удалось перенести журнал. Проверьте файл и свободное место в браузере.",
  },
  en: {
    title: "Personal journal",
    description: "Download your saved entries, open the personal copy, and import the file there. Your browser stores the two journals separately. You can remove the originals from the main app after checking the transfer.",
    localDescription: "Import a journal file or start with an empty journal. Entries are stored in your browser at this address.",
    export: "Download journal",
    import: "Import journal",
    open: "Open personal copy",
    imported: "Journal imported",
    error: "Could not transfer the journal. Check the file and available browser storage.",
  },
};

export function JournalTransfer({ lang, className, onImport }: {
  lang: keyof typeof labels;
  className: string;
  onImport: () => void;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const text = labels[lang];
  if (!isIsolatedJournal && !isPublishedApp) return null;
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
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon" className={className} title={text.title}
          aria-label={text.title} data-testid="button-personal-journal">
          <ShieldCheck />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{text.title}</DialogTitle>
          <DialogDescription>{isIsolatedJournal ? text.localDescription : text.description}</DialogDescription>
        </DialogHeader>
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
      </DialogContent>
    </Dialog>
  );
}
