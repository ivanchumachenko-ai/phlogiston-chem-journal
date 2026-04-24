const fs = require('fs');

let content = fs.readFileSync('client/src/lib/export.tsx', 'utf8');

const oldStr = `  await new Promise<void>((resolve) => {
    iframe.onload = () => {
      let attempts = 0;
      
      const checkReady = () => {
        const doc = iframe.contentDocument || iframe.contentWindow?.document;
        const printShell = doc?.querySelector('.print-shell') as HTMLElement;
        
        if (!printShell) {
          attempts++;
          if (attempts > 20) { // 10 seconds timeout
            console.error("Print shell timeout");
            alert(lang === "ru" ? "Ошибка: не удалось загрузить данные для PDF." : "Error: Failed to load PDF data.");
            if (document.body.contains(iframe)) document.body.removeChild(iframe);
            resolve();
            return;
          }
          setTimeout(checkReady, 500);
          return;
        }

        // Give it a little time to render Ketcher svgs after shell appears
        setTimeout(async () => {
          try {
            // Expand it to fit content
            printShell.style.maxHeight = 'none';
            printShell.style.overflow = 'visible';

            // Ensure all SVG elements have explicit dimensions for html2canvas
            const svgs = printShell.querySelectorAll('svg');
            svgs.forEach(svg => {
              const width = svg.getAttribute('width') || svg.getBoundingClientRect().width;
              const height = svg.getAttribute('height') || svg.getBoundingClientRect().height;
              if (width && height) {
                svg.style.width = typeof width === 'number' ? \`\${width}px\` : width;
                svg.style.height = typeof height === 'number' ? \`\${height}px\` : height;
                svg.setAttribute('width', String(width));
                svg.setAttribute('height', String(height));
              }
            });

            const canvas = await html2canvas(printShell, {
              scale: 2,
              useCORS: true,
              logging: false,
              windowWidth: 1200,
              onclone: (clonedDoc) => {
                 const controls = clonedDoc.querySelector('.print-controls');
                 if (controls) controls.remove();
                 
                 // Fix reaction scheme overflow
                 const schemeWrap = clonedDoc.querySelector('.overflow-x-auto');
                 if (schemeWrap) {
                   (schemeWrap as HTMLElement).style.overflow = 'visible';
                 }
              }
            });

            const imgData = canvas.toDataURL("image/jpeg", 0.95);
            const pdf = new jsPDF({
              orientation: canvas.width > canvas.height ? "landscape" : "portrait",
              unit: "mm",
              format: "a4"
            });

            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
            
            let heightLeft = pdfHeight;
            let position = 0;
            const pageHeight = pdf.internal.pageSize.getHeight();

            pdf.addImage(imgData, "JPEG", 0, position, pdfWidth, pdfHeight);
            heightLeft -= pageHeight;

            while (heightLeft > 0) {
              position = heightLeft - pdfHeight;
              pdf.addPage();
              pdf.addImage(imgData, "JPEG", 0, position, pdfWidth, pdfHeight);
              heightLeft -= pageHeight;
            }

            const filename = \`\${details.title || details.productName || "Synthesis"}_Report.pdf\`.replace(/[<>:"/\\\\|?*\\x00-\\x1F]/g, '_');
            
            try {
              // Try robust download using Blob first
              const blob = pdf.output("blob");
              downloadBlob(blob, filename);
            } catch (e) {
              // Fallback to jsPDF's built-in save
              pdf.save(filename);
            }
            
          } catch (error) {
            console.error("PDF generation failed:", error);
            alert(lang === "ru" ? "Ошибка создания PDF. Попробуйте еще раз." : "Failed to generate PDF. Try again.");
          } finally {
            if (document.body.contains(iframe)) {
              document.body.removeChild(iframe);
            }
            resolve();
          }
        }, 1000); // 1s wait for svg rendering
      };
      
      checkReady();
    };
    
    // In case the iframe completely fails to load
    iframe.onerror = () => {
       console.error("Iframe failed to load");
       alert(lang === "ru" ? "Ошибка загрузки данных PDF." : "Error loading PDF data.");
       if (document.body.contains(iframe)) document.body.removeChild(iframe);
       resolve();
    };
  });`;

const newStr = `  await new Promise<void>((resolve) => {
    const messageListener = async (event: MessageEvent) => {
      if (event.source !== iframe.contentWindow) return;
      if (event.data?.type === 'PRINT_READY') {
        window.removeEventListener('message', messageListener);
        
        try {
          const doc = iframe.contentDocument || iframe.contentWindow?.document;
          if (!doc) throw new Error("Cannot access iframe document");
          
          const printShell = doc.querySelector('.print-shell') as HTMLElement;
          if (!printShell) throw new Error("Cannot find print-shell in iframe");

          // Expand it to fit content
          printShell.style.maxHeight = 'none';
          printShell.style.overflow = 'visible';

          // Ensure all SVG elements have explicit dimensions for html2canvas
          const svgs = printShell.querySelectorAll('svg');
          svgs.forEach(svg => {
            const width = svg.getAttribute('width') || svg.getBoundingClientRect().width;
            const height = svg.getAttribute('height') || svg.getBoundingClientRect().height;
            if (width && height) {
              svg.style.width = typeof width === 'number' ? \`\${width}px\` : width;
              svg.style.height = typeof height === 'number' ? \`\${height}px\` : height;
              svg.setAttribute('width', String(width));
              svg.setAttribute('height', String(height));
            }
          });

          const canvas = await html2canvas(printShell, {
            scale: 2,
            useCORS: true,
            logging: false,
            windowWidth: 1200,
            onclone: (clonedDoc) => {
               const controls = clonedDoc.querySelector('.print-controls');
               if (controls) controls.remove();
               
               // Fix reaction scheme overflow
               const schemeWrap = clonedDoc.querySelector('.overflow-x-auto');
               if (schemeWrap) {
                 (schemeWrap as HTMLElement).style.overflow = 'visible';
               }
            }
          });

          const imgData = canvas.toDataURL("image/jpeg", 0.95);
          const pdf = new jsPDF({
            orientation: canvas.width > canvas.height ? "landscape" : "portrait",
            unit: "mm",
            format: "a4"
          });

          const pdfWidth = pdf.internal.pageSize.getWidth();
          const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
          
          let heightLeft = pdfHeight;
          let position = 0;
          const pageHeight = pdf.internal.pageSize.getHeight();

          pdf.addImage(imgData, "JPEG", 0, position, pdfWidth, pdfHeight);
          heightLeft -= pageHeight;

          while (heightLeft > 0) {
            position = heightLeft - pdfHeight;
            pdf.addPage();
            pdf.addImage(imgData, "JPEG", 0, position, pdfWidth, pdfHeight);
            heightLeft -= pageHeight;
          }

          const filename = \`\${details.title || details.productName || "Synthesis"}_Report.pdf\`.replace(/[<>:"/\\\\|?*\\x00-\\x1F]/g, '_');
          
          try {
            // Try robust download using Blob first
            const blob = pdf.output("blob");
            downloadBlob(blob, filename);
          } catch (e) {
            // Fallback to jsPDF's built-in save
            pdf.save(filename);
          }
          
        } catch (error) {
          console.error("PDF generation failed:", error);
          alert(lang === "ru" ? "Ошибка создания PDF. Попробуйте еще раз." : "Failed to generate PDF. Try again.");
        } finally {
          if (document.body.contains(iframe)) {
            document.body.removeChild(iframe);
          }
          resolve();
        }
      }
    };
    
    window.addEventListener('message', messageListener);

    // Fallback polling in case message doesn't work
    iframe.onload = () => {
      let attempts = 0;
      const checkReady = () => {
        try {
          const doc = iframe.contentDocument || iframe.contentWindow?.document;
          const printShell = doc?.querySelector('.print-shell') as HTMLElement;
          if (printShell) {
            window.postMessage({ type: 'PRINT_READY' }, '*');
            return;
          }
        } catch(e) {
          // ignore
        }
        
        attempts++;
        if (attempts > 30) { // 15 seconds timeout
          window.removeEventListener('message', messageListener);
          console.error("Print shell timeout");
          alert(lang === "ru" ? "Ошибка: не удалось загрузить данные для PDF." : "Error: Failed to load PDF data.");
          if (document.body.contains(iframe)) document.body.removeChild(iframe);
          resolve();
          return;
        }
        setTimeout(checkReady, 500);
      };
      checkReady();
    };
    
    iframe.onerror = () => {
       console.error("Iframe failed to load");
       alert(lang === "ru" ? "Ошибка загрузки данных PDF." : "Error loading PDF data.");
       if (document.body.contains(iframe)) document.body.removeChild(iframe);
       resolve();
    };
  });`;

if (content.includes(oldStr)) {
  content = content.replace(oldStr, newStr);
  fs.writeFileSync('client/src/lib/export.tsx', content);
  console.log("Success");
} else {
  console.log("Failed to match old string");
  
  // Try to find the start index
  const startIdx = content.indexOf('await new Promise<void>((resolve) => {');
  if (startIdx !== -1) {
      console.log('Found start block');
      const functionDef = content.substring(startIdx, content.indexOf('function downloadBlob', startIdx));
      content = content.replace(functionDef, newStr + "\n}\n\n");
      fs.writeFileSync('client/src/lib/export.tsx', content);
      console.log("Success with fallback");
  } else {
      console.log('Cannot find start index');
  }
}

