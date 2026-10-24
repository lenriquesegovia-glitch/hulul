const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),assert=require('node:assert/strict');
const cache={};function load(name){if(cache[name])return cache[name];const exports={};cache[name]=exports;const code=ts.transpileModule(fs.readFileSync(`packages/shared/src/${name}.ts`,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;vm.runInNewContext(code,{exports,Date,console,require:p=>load(p.replace('./',''))});return exports;}
(async()=>{
 const {quoteVisit}=load('pricing'),{surchargeFor}=load('schedule'),cities=load('locations');
 const {priceOf,ledgerEntriesFor}=await import('../functions/money.js');
 const {canReadClientSummary,clientSummary}=await import('../functions/client-summary.js');
 const p={name:'Prueba',surcharges:{nocturno:30,feriado:45}};
 for(const [date,slot,expected] of [['2026-10-24','10:00',15],['2026-10-24','20:00',30],['2026-12-25','10:00',45],['2026-12-25','20:00',45]]){
  for(const regime of ['general','rimpe_popular','rimpe_emprendedor']){
   const q=quoteVisit(15,surchargeFor(date,slot,p).amount,regime);assert.equal(q.subtotal,expected);assert.equal(q.surcharge,0);assert.equal(q.visit,expected);assert.equal(q.total,priceOf(q.visit,0,regime).total);
  }
 }
 assert.equal(quoteVisit(15,0).subtotal,15);
 // Historical additive bookings remain unchanged in accounting.
 const old={status:'completada',visit:15,surcharge:30,paymentMethod:'tarjeta',taxRegime:'general'};
 assert.equal(ledgerEntriesFor(old).find(e=>e.kind==='visita').base,45);
 assert.equal(ledgerEntriesFor({...old,visit:30,surcharge:0,pricingVersion:2}).find(e=>e.kind==='visita').base,30);
 assert.equal(canReadClientSummary('assigned',{professionalId:'assigned'}),true);
 assert.equal(canReadClientSummary('stranger',{professionalId:'assigned'}),false);
 assert.equal(canReadClientSummary(null,{professionalId:'assigned'}),false);
 assert.equal(clientSummary({contactName:'Ana'},null).rating,null);
 const summary=clientSummary({contactName:'Ana',address:'PRIVATE'},{sum:9,count:2,comment:'PRIVATE'});
 assert.equal(summary.rating,4.5);assert.equal(JSON.stringify(summary).includes('PRIVATE'),false);
 assert.equal(new Set(cities.serviceCities.map(c=>c.province)).size,24);
 assert.equal(new Set(cities.serviceCities.map(c=>c.slug)).size,cities.serviceCities.length);
 for(const slug of ['guayaquil','samborondon','daule','quito','cuenca'])assert.ok(cities.serviceCity(slug));
 assert.ok(cities.searchServiceCities('samborondon').some(c=>c.slug==='samborondon'));
 assert.ok(cities.searchServiceCities('galapagos').length>0);
 console.log('PASS: complete tariffs, overlapping dates, tax regimes, historical ledger, restricted client summary and national city catalogue.');
})();
