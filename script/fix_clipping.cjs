const fs = require('fs');

// 1. Fix PrintSynthesis container
let printContent = fs.readFileSync('client/src/pages/PrintSynthesis.tsx', 'utf8');
printContent = printContent.replace(
  /w-\[1000px\] max-w-none/g, 
  'min-w-[1000px] w-max max-w-none'
);
fs.writeFileSync('client/src/pages/PrintSynthesis.tsx', printContent);

// 2. Fix html2canvas windowWidth to use dynamic scrollWidth so it never clips wide schemes
let exportContent = fs.readFileSync('client/src/lib/export.tsx', 'utf8');

const searchStr = `windowWidth: 1000,`;
const replaceStr = `windowWidth: Math.max(1000, printShell.scrollWidth + 100),`;

if (exportContent.includes(searchStr)) {
  exportContent = exportContent.replace(searchStr, replaceStr);
  fs.writeFileSync('client/src/lib/export.tsx', exportContent);
  console.log("Success updating PrintSynthesis and export.tsx for dynamic width");
} else {
  console.log("Could not find windowWidth: 1000 in export.tsx");
}

