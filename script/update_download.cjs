const fs = require('fs');

let content = fs.readFileSync('client/src/lib/export.tsx', 'utf8');

const oldStr = `function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.style.display = "none";
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Delay revocation to ensure large files have time to start downloading, especially on mobile
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}`;

const newStr = `async function downloadBlob(blob: Blob, filename: string) {
  // On mobile (iOS Safari), Web Share API is often more reliable for PDFs
  if (navigator.share && navigator.canShare) {
    try {
      const file = new File([blob], filename, { type: 'application/pdf' });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: filename,
        });
        return; // Success
      }
    } catch (e) {
      console.warn("Share API failed or was aborted, falling back to download link", e);
    }
  }

  try {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.style.display = "none";
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  } catch (e: any) {
    throw new Error("Download link failed: " + e.message);
  }
}`;

if (content.includes(oldStr)) {
  // Replace the old downloadBlob
  content = content.replace(oldStr, newStr);
  // Also fix the call site if it's not awaited, although we don't strictly need to await it, 
  // but it's better to catch errors from it.
  content = content.replace('downloadBlob(blob, filename);', 'await downloadBlob(blob, filename);');
  
  fs.writeFileSync('client/src/lib/export.tsx', content);
  console.log("Success");
} else {
  console.log("Could not find oldStr");
}

