const fs = require('fs');
let content = fs.readFileSync('client/src/pages/PrintSynthesis.tsx', 'utf8');

// The screenshot shows text cut off on the right edge, likely due to padding or width issues.
// Let's remove horizontal padding from the main container and let the table take full width.
content = content.replace('className="print-shell relative mx-auto w-[1200px] min-h-[1600px] bg-white px-[80px] py-[100px] font-sans text-slate-900"', 'className="print-shell relative mx-auto w-[1200px] min-h-[1600px] bg-white px-[40px] py-[80px] font-sans text-black"');

// Fix table layout to prevent clipping. 
// Change min-w-full to w-full and add table-layout: fixed
content = content.replace('<table className="min-w-full border-collapse text-left text-sm">', '<table className="w-full table-fixed border-collapse text-left text-sm" style={{ wordBreak: "break-word" }}>');

// Give specific widths to table columns to prevent them from squishing the name column
// Name/Formula, Role, MW, Eq, Moles, Mass, Vol, Density, Loc (9 columns)
const tableHeadStr = `<thead className="bg-stone-50 text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">{copy.compound}</th>
                    <th className="px-4 py-3 font-medium">{copy.role}</th>
                    <th className="px-4 py-3 font-medium">{copy.mw}</th>
                    <th className="px-4 py-3 font-medium">{copy.eq}</th>
                    <th className="px-4 py-3 font-medium">{copy.moles}</th>
                    <th className="px-4 py-3 font-medium">{copy.mass}</th>
                    <th className="px-4 py-3 font-medium">{copy.volume}</th>
                    <th className="px-4 py-3 font-medium">{copy.density}</th>
                    <th className="px-4 py-3 font-medium">{copy.location}</th>
                  </tr>
                </thead>`;

const newTableHeadStr = `<thead className="bg-stone-50 text-slate-500">
                  <tr>
                    <th className="px-3 py-3 font-medium w-[22%]">{copy.compound}</th>
                    <th className="px-3 py-3 font-medium w-[10%]">{copy.role}</th>
                    <th className="px-3 py-3 font-medium w-[9%]">{copy.mw}</th>
                    <th className="px-3 py-3 font-medium w-[8%]">{copy.eq}</th>
                    <th className="px-3 py-3 font-medium w-[10%]">{copy.moles}</th>
                    <th className="px-3 py-3 font-medium w-[11%]">{copy.mass}</th>
                    <th className="px-3 py-3 font-medium w-[11%]">{copy.volume}</th>
                    <th className="px-3 py-3 font-medium w-[9%]">{copy.density}</th>
                    <th className="px-3 py-3 font-medium w-[10%]">{copy.location}</th>
                  </tr>
                </thead>`;

content = content.replace(tableHeadStr, newTableHeadStr);

// Also change td padding to match
content = content.replace(/className="px-4 py-3/g, 'className="px-3 py-3');

// Fix gray boxes instead of text by ensuring proper color classes
// Replace text-slate-XXX with text-black to be safe, or just let the global CSS override handle it.
// The global CSS override added in export.tsx will force color: black and background: transparent.

fs.writeFileSync('client/src/pages/PrintSynthesis.tsx', content);
console.log("Success updating PrintSynthesis layout");
