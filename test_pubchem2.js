const query = "C/C=C\\Br";
fetch(`https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/smiles/property/MolecularFormula,MolecularWeight,IUPACName/JSON`, {
    method: 'POST',
    headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: `smiles=${encodeURIComponent(query)}`
}).then(r => r.text()).then(console.log).catch(console.error);
