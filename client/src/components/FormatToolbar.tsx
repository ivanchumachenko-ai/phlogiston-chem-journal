import { Button } from "@/components/ui/button";
import { toSubscript, toSuperscript, toNormalText } from "@/lib/format";

interface FormatToolbarProps {
  elementId: string;
  value: string;
  onChange: (val: string) => void;
  className?: string;
}

export function FormatToolbar({ elementId, value, onChange, className = "" }: FormatToolbarProps) {
  const handleFormat = (type: 'sub' | 'sup' | 'normal') => {
    const el = document.getElementById(elementId) as HTMLTextAreaElement | null;
    if (!el) return;

    const start = el.selectionStart;
    const end = el.selectionEnd;
    if (start === end) return;

    const selected = value.substring(start, end);
    let formatted = selected;

    if (type === 'sub') formatted = toSubscript(selected);
    else if (type === 'sup') formatted = toSuperscript(selected);
    else formatted = toNormalText(selected);

    const newValue = value.substring(0, start) + formatted + value.substring(end);
    onChange(newValue);

    // Restore selection after a short delay so the react state updates
    setTimeout(() => {
      const updatedEl = document.getElementById(elementId) as HTMLTextAreaElement | null;
      if (updatedEl) {
        updatedEl.focus();
        updatedEl.setSelectionRange(start, start + formatted.length);
      }
    }, 0);
  };

  return (
    <div className={`flex items-center gap-1 bg-white p-1 rounded-md border border-stone-200 shadow-sm ${className}`}>
      <Button 
        variant="ghost" 
        size="sm" 
        className="h-6 w-6 p-0 text-xs font-serif italic text-slate-600 hover:text-slate-900 focus-visible:ring-0" 
        onMouseDown={(e) => { e.preventDefault(); handleFormat('sub'); }}
        title="Subscript (₂)"
      >
        x₂
      </Button>
      <Button 
        variant="ghost" 
        size="sm" 
        className="h-6 w-6 p-0 text-xs font-serif italic text-slate-600 hover:text-slate-900 focus-visible:ring-0" 
        onMouseDown={(e) => { e.preventDefault(); handleFormat('sup'); }}
        title="Superscript (²)"
      >
        x²
      </Button>
      <Button 
        variant="ghost" 
        size="sm" 
        className="h-6 w-6 p-0 text-xs font-serif italic text-slate-600 hover:text-slate-900 focus-visible:ring-0" 
        onMouseDown={(e) => { e.preventDefault(); handleFormat('normal'); }}
        title="Normal text"
      >
        x
      </Button>
    </div>
  );
}
