import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeRankingBooking } from './home-ranking.js';
import { buildRanking } from './home-ranking-core.js';
const now = Date.UTC(2026, 9, 23);
const catalog = [{id:'limpieza:Limpieza por horas',categoryId:'limpieza',label:'Limpieza por horas'}];
const booking = { clientId:'c', professionalId:'p', category:'limpieza', notes:'Limpieza por horas. Dirección privada', acceptedAt:{toMillis:()=>now-1000},status:'confirmada',demo:false };
test('matches only exact catalog prefix and does not expose notes',()=>{
 const e=normalizeRankingBooking('id',booking,{},catalog);
 assert.equal(e.serviceId,catalog[0].id);
 assert.ok(!JSON.stringify(e).includes('Dirección'));
 assert.equal(normalizeRankingBooking('id',{...booking,notes:'Otro. Limpieza por horas'},{},catalog).serviceId,'');
 assert.equal(normalizeRankingBooking('id',{...booking,notes:'Limpieza por horas extra'},{},catalog).serviceId,'');
});
test('uses acceptedAt, excludes demo, tester, missing provider, pending and cancellations',()=>{
 assert.equal(normalizeRankingBooking('id',{...booking,createdAt:{toMillis:()=>now},acceptedAt:undefined},{},catalog).firstConfirmedAtMs.toString(),'NaN');
 assert.equal(normalizeRankingBooking('id',{...booking,demo:true},{},catalog).isTest,true);
 assert.equal(normalizeRankingBooking('id',booking,{tester:true},catalog).isTest,true);
 assert.equal(normalizeRankingBooking('id',{...booking,notes:'[PRUEBA]. Limpieza por horas'},{},catalog).isTest,true);
 assert.equal(normalizeRankingBooking('id',booking,null,catalog).eligible,false);
 assert.equal(normalizeRankingBooking('id',{...booking,status:'pendiente'},{},catalog).eligible,false);
 assert.equal(normalizeRankingBooking('id',{...booking,status:'cancelada'},{},catalog).cancelled,true);
});
test('valid week ranks; repeated clients, cancelled, tests, stale dates do not create popularity',()=>{
 const events=Array.from({length:20},(_,i)=>normalizeRankingBooking(String(i),{...booking,clientId:'c'+i},{},catalog));
 const run=es=>buildRanking(es,catalog,[catalog[0].id],now);
 assert.equal(run(events).mode,'popular');
 assert.equal(run([]).mode,'featured');
 assert.equal(run([...events,...events]).items.length,1);
 for(const change of [{clientId:'same'},{cancelled:true},{isTest:true},{eligible:false},{serviceId:'invalid'},{firstConfirmedAtMs:now-8*86400000},{firstConfirmedAtMs:now+1},{firstConfirmedAtMs:NaN}])
  assert.equal(run(events.map(e=>({...e,...change}))).mode,'featured');
 assert.equal(run(events).items[0].label,catalog[0].label);
 assert.ok(!JSON.stringify(run(events)).includes('clientId'));
 assert.deepEqual(run([...events].reverse()),run(events));
});
