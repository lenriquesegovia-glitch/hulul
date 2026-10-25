const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const assert = require('node:assert/strict');
function load(name) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(`packages/shared/src/${name}.ts`, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  vm.runInNewContext(code, { exports, Date, console });
  return exports;
}
const booking = load('booking'), schedule = load('schedule');
const now = new Date(2026, 9, 23, 14, 1);
const pro = {name:'Pedro',from:'08:00',to:'17:00',workDays:[0,1,2,3,4,5,6],offHours:[18,19],surcharges:{nocturno:30}};
for (const slot of ['15:00','16:00']) {
  assert.equal(booking.timeAvailable(0,slot,now),true);
  assert.equal(schedule.checkSlot({category:'mascotas',date:'2026-10-23',slot,hours:1,pro}).ok,true);
}
assert.equal(booking.timeAvailable(0,'14:00',now),false);
assert.equal(schedule.checkSlot({category:'mascotas',date:'2026-10-23',slot:'17:00',hours:1,pro}).ok,true);
assert.equal(schedule.surchargeFor('2026-10-23','16:00',pro).amount,0);
assert.equal(schedule.surchargeFor('2026-10-23','18:00',pro).amount,30);
assert.equal(schedule.leadMinutes('mascotas'),0);
assert.equal(schedule.leadMinutes('cerrajeria'),0);
assert.equal(booking.timeAvailable(0,'15:00',new Date(2026,9,23,14,59)),true);
for(const hours of [1,2,3]) assert.equal(schedule.checkSlot({category:'mascotas',date:'2026-10-23',slot:'16:30',hours,pro}).ok,true);
assert.equal(booking.SLOTS.includes('16:30'),true);
assert.equal(schedule.checkSlot({category:'mascotas',date:'2026-10-23',slot:'17:30',hours:1,pro}).ok,false);
assert.equal(schedule.checkSlot({category:'mascotas',date:'2026-10-23',slot:'07:30',hours:1,pro}).ok,false);
assert.equal(booking.timeAvailable(0,'16:30',new Date(2026,9,23,16,31)),false);
console.log('PASS: future requests allowed immediately, past hours blocked, arrival window enforced without end-of-visit restriction; special tariffs preserved.');
