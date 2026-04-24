const fs = require('fs');
let content = fs.readFileSync('client/src/lib/export.tsx', 'utf8');

const searchStr = `          const pdf = new jsPDF({`;
const endStr = `const filename = \`\${details.title || details.productName || "Synthesis"}_Report.pdf\`.replace(/[<>:"/\\\\|?*\\x00-\\x1F]/g, '_');`;

const startIdx = content.indexOf(searchStr);
const endIdx = content.indexOf(endStr);

if (startIdx !== -1 && endIdx !== -1) {
  const prefix = content.substring(0, startIdx);
  const suffix = content.substring(endIdx);
  
  const newLogic = `          const pdf = new jsPDF({
            orientation: "portrait",
            unit: "mm",
            format: "a4"
          });

          const pageWidth = pdf.internal.pageSize.getWidth();
          const pageHeight = pdf.internal.pageSize.getHeight();
          
          let pdfWidth = pageWidth;
          let pdfHeight = (canvas.height * pdfWidth) / canvas.width;
          let xOffset = 0;
          let yOffset = 0;
          
          // Force it to fit on one portrait page by scaling down if necessary
          if (pdfHeight > pageHeight) {
            // Document is taller than A4, scale by height
            pdfHeight = pageHeight;
            pdfWidth = (canvas.width * pdfHeight) / canvas.height;
            xOffset = (pageWidth - pdfWidth) / 2; // Center horizontally
          } else if (pdfWidth > pageWidth) {
            // Document is wider than A4, scale by width (though we start with pdfWidth = pageWidth)
            pdfWidth = pageWidth;
            pdfHeight = (canvas.height * pdfWidth) / canvas.width;
          }

          pdf.addImage(imgData, "JPEG", xOffset, yOffset, pdfWidth, pdfHeight);

          `;
          
  fs.writeFileSync('client/src/lib/export.tsx', prefix + newLogic + suffix);
  console.log("Success making PDF one page portrait");
} else {
  console.log("Could not find boundaries for replacement");
}
