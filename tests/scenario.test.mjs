import test from 'node:test';
import assert from 'node:assert/strict';
import {defaults,calculate,prepareScenario,numericLabels} from '../lib/scenario.ts';

const property={price:180000};
function complete(){return {...defaults(property),sale:275000,commission:5,transfer:0,registry:10000,renovation:20000,debts:5000,legal:0,monthly:1000,months:5,broker:0,tax:0,reserve:0};}

test('campos iniciais desconhecidos não produzem lucro ou ROI',()=>{
 const s=defaults(property);
 for(const key of Object.keys(numericLabels))if(key!=='buy')assert.equal(s[key],null);
 const result=calculate(s);assert.equal(result.valid,false);assert.equal(result.profit,null);assert.equal(result.roi,null);assert.equal(result.purchase,null);
});
test('cada campo ausente impede resultado financeiro',()=>{
 for(const key of Object.keys(numericLabels)){
  const result=calculate({...complete(),[key]:null});
  assert.equal(result.valid,false,key);assert(result.missing.includes(numericLabels[key]));assert.equal(result.roi,null);
 }
});
test('zero explícito é válido para despesas; cálculo inclui todos os custos',()=>{
 const result=calculate(complete());assert.equal(result.valid,true);assert.equal(result.purchase,229000);assert.equal(result.profit,46000);assert.equal(result.roi,46000/229000*100);
 const loss=calculate({...complete(),sale:100000});assert.equal(loss.valid,true);assert(loss.profit<0);
});
test('zeros antigos precisam de revisão sem apagar dados antigos',()=>{
 const original=complete();delete original.schemaVersion;
 assert.equal(calculate(original).valid,false);
 const migrated=prepareScenario(original,property);
 assert.equal(migrated.schemaVersion,2);assert.equal(migrated.transfer,null);assert.equal(migrated.months,null);assert.equal(migrated.renovation,20000);assert.equal(original.transfer,0);assert.equal(original.months,5);assert.equal(calculate(migrated).valid,false);
});
test('análises v2 preservam os zeros confirmados',()=>{
 const saved=complete();const reopened=prepareScenario(saved,property);
 assert.equal(reopened.transfer,0);assert.equal(reopened.months,5);assert.equal(calculate(reopened).valid,true);
});
test('rejeita valores fora dos limites',()=>{
 for(const bad of [{buy:0},{sale:0},{commission:101},{transfer:-1},{months:1.5},{months:601},{tax:Infinity},{renovation:NaN}])assert.equal(calculate({...complete(),...bad}).valid,false);
});
