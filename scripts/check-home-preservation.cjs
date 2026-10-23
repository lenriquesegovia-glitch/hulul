const fs=require('fs'),cp=require('child_process'),ts=require('typescript'),assert=require('node:assert/strict');
const files=['functions/index.js','packages/shared/src/firebase.ts'];
const baseline='7f02a20';
for(const file of files){
 const before=cp.execFileSync('git',['show',baseline+':'+file],{encoding:'utf8'}),after=fs.readFileSync(file,'utf8');
 const parse=source=>{const sf=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,file.endsWith('.js')?ts.ScriptKind.JS:ts.ScriptKind.TS);const map=new Map();for(const n of sf.statements){if(ts.isImportDeclaration(n))continue;let key=n.name?.getText(sf);if(ts.isVariableStatement(n))key=n.declarationList.declarations.map(d=>d.name.getText(sf)).join(',');if(key)map.set(key,n.getText(sf).replace(/\r\n/g,'\n'));}return map;};
 const old=parse(before),fresh=parse(after);for(const [name,body]of old)assert.equal(fresh.get(name),body,`${file}: existing declaration changed: ${name}`);
 console.log(`${file}: ${old.size} existing declarations unchanged`);
}
const oldRole=cp.execFileSync('git',['show',baseline+':apps/web/components/RoleChooser.tsx'],{encoding:'utf8'}).replace(/\r\n/g,'\n');
const newRole=fs.readFileSync('apps/web/components/RoleChooser.tsx','utf8').replace(/\r\n/g,'\n');
const logic=s=>s.slice(s.indexOf('  const user'),s.indexOf('  if (!open)'));
assert.equal(logic(oldRole),logic(newRole),'Role choice logic changed');
console.log('Role selection persistence and navigation unchanged');
