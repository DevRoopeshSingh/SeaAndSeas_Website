'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {spawnSync} = require('node:child_process');
const {DOMParser} = require('@xmldom/xmldom');
const Validation = require('../js/application-validation');
const schema = require('../js/application-schema.json');
const root = path.resolve(__dirname, '..');
let passes = 0;
function check(name, run) { run(); passes++; console.log('PASS '+name); }

// A DOM fixture uses the real HTML and application controller. Only browser
// adapters (selectors, controls, storage and events) are supplied by this test.
function browser() {
  const document = new DOMParser({onError:()=>{}}).parseFromString(fs.readFileSync(path.join(root, 'apply.html'), 'utf8'), 'text/html');
  const nativeCreate = document.createElement.bind(document);
  const events = new WeakMap();
  function descendants(node) {
    return Array.from(node.childNodes || []).flatMap(child => child.nodeType === 1 ? [child, ...descendants(child)] : []);
  }
  function matches(node, selector) {
    if (node.nodeType !== 1) return false;
    const name = /^([\w-]+)/.exec(selector)?.[1];
    if (name && node.tagName.toLowerCase() !== name) return false;
    for (const [,id] of selector.matchAll(/#([\w-]+)/g)) if (node.getAttribute('id') !== id) return false;
    for (const [,cls] of selector.matchAll(/\.([\w-]+)/g)) if (!node.className.split(/\s+/).includes(cls)) return false;
    for (const [,attr,op,value] of selector.matchAll(/\[([\w-]+)(?:(\^?=)"([^"]*)")?\]/g)) {
      if (!node.hasAttribute(attr)) return false;
      if (op === '=' && node.getAttribute(attr) !== value) return false;
      if (op === '^=' && !node.getAttribute(attr).startsWith(value)) return false;
    }
    return !selector.includes(':checked') || node.checked;
  }
  function query(node, selector) {
    const output = [];
    for (const alternative of selector.split(',')) {
      const parts = alternative.trim().split(/\s+(?=[^\]]*(?:\[|$))/);
      let parents = [node];
      for (const part of parts) parents = parents.flatMap(parent => descendants(parent).filter(child => matches(child, part)));
      for (const match of parents) if (!output.includes(match)) output.push(match);
    }
    return output;
  }
  function decorate(node) {
    if (node._browserFixture) return node;
    node._browserFixture = true;
    node.style = Object.fromEntries((node.getAttribute?.('style') || '').split(';').filter(Boolean).map(rule => { const at=rule.indexOf(':'); return [rule.slice(0,at).trim(),rule.slice(at+1).trim()]; }));
    node.addEventListener = (type, listener) => { const handlers = events.get(node) || {}; (handlers[type] ||= []).push(listener); events.set(node, handlers); };
    node.removeEventListener = () => {};
    node.querySelectorAll = selector => query(node, selector);
    node.querySelector = selector => query(node, selector)[0] || null;
    node.closest = selector => { for (let at=node; at?.nodeType===1; at=at.parentNode) if(selector.split(',').some(part=>matches(at,part.trim())))return at;return null; };
    node.scrollIntoView = () => {};
    node.focus = () => { document.focused = node; };
    node.classList = {
      add: (...classes) => { node.className = [...new Set([...node.className.split(/\s+/).filter(Boolean),...classes])].join(' '); },
      remove: (...classes) => { node.className = node.className.split(/\s+/).filter(value=>!classes.includes(value)).join(' '); }
    };
    Object.defineProperties(node, {
      children: {get:()=>Array.from(node.childNodes).filter(child=>child.nodeType===1)},
      parentElement: {get:()=>node.parentNode?.nodeType===1?node.parentNode:null},
      className: {get:()=>node.getAttribute('class') || '',set:value=>node.setAttribute('class',value)},
      name: {get:()=>node.getAttribute('name') || '',set:value=>node.setAttribute('name',value)},
      type: {get:()=>node.getAttribute('type') || 'text',set:value=>node.setAttribute('type',value)},
      required: {get:()=>node.hasAttribute('required'),set:value=>value?node.setAttribute('required',''):node.removeAttribute('required')},
      disabled: {get:()=>node.hasAttribute('disabled'),set:value=>value?node.setAttribute('disabled',''):node.removeAttribute('disabled')},
      dataset: {get:()=>new Proxy({}, {get:(_,key)=>node.getAttribute('data-'+key.replace(/[A-Z]/g,letter=>'-'+letter.toLowerCase()))})},
      innerHTML: {set:html=>{
        while(node.firstChild)node.removeChild(node.firstChild);
        const fragment = new DOMParser({onError:()=>{}}).parseFromString('<div>'+html+'</div>','text/html').documentElement;
        for(const child of Array.from(fragment.childNodes)){const copy=document.importNode(child,true);node.appendChild(copy);if(copy.nodeType===1){decorate(copy);descendants(copy).forEach(decorate);}}
      }}
    });
    let value = node.getAttribute('value') || '';
    const selected = () => Array.from(node.getElementsByTagName('option')).find(option=>option.hasAttribute('selected')) || node.getElementsByTagName('option')[0];
    if (node.tagName?.toLowerCase()==='select') value = selected()?.getAttribute('value') || '';
    Object.defineProperty(node,'value',{get:()=>value,set:next=>{
      next=String(next);
      value=node.tagName?.toLowerCase()==='select'&&!Array.from(node.getElementsByTagName('option')).some(option=>option.getAttribute('value')===next)?'':next;
    }});
    node.checked = node.hasAttribute?.('checked') || false;
    node.files = [];
    node.checkValidity = () => !node.required || (node.type==='checkbox'?node.checked:!!node.value.trim());
    node.before = other => node.parentNode.insertBefore(other,node);
    node.after = other => node.parentNode.insertBefore(other,node.nextSibling);
    node.prepend = other => node.insertBefore(other,node.firstChild);
    node.append = (...others) => others.forEach(other=>node.appendChild(other));
    node.remove = () => node.parentNode?.removeChild(node);
    node.insertCell = () => {const cell=document.createElement('td');node.appendChild(cell);return cell;};
    return node;
  }
  document.createElement = tag => decorate(nativeCreate(tag));
  document.addEventListener = (type,listener) => {const handlers=events.get(document)||{};(handlers[type]||=[]).push(listener);events.set(document,handlers);};
  document.querySelector = selector => query(document,selector)[0] || null;
  document.querySelectorAll = selector => query(document,selector);
  descendants(document).forEach(decorate);
  const stored = new Map();
  let saves = 0;
  const sessionStorage = {getItem:key=>stored.get(key)||null,setItem:(key,value)=>{stored.set(key,value);saves++;},removeItem:key=>stored.delete(key)};
  let timers = 0;
  class FormData {
    constructor(form) {
      this.entries = form.querySelectorAll('input, select, textarea').filter(input=>input.name&&!input.disabled&&!input.closest('fieldset[disabled]')&&(!['checkbox','radio'].includes(input.type)||input.checked)).map(input=>[input.name,input.value]);
    }
    [Symbol.iterator]() {return this.entries[Symbol.iterator]();}
  }
  const window = {scrollTo:()=>{},print:()=>{}};
  const context = vm.createContext({document,window,ApplicationValidation:Validation,sessionStorage,localStorage:{removeItem:()=>{}},crypto:{randomUUID:()=> 'test-submission-key-12345678901234567890'},FormData,Date,console,confirm:()=>true,setTimeout:()=>++timers,clearTimeout:()=>{}});
  const source = fs.readFileSync(path.join(root,'js/apply.js'),'utf8').replace(/\n\}\)\(\);\s*$/, '\nwindow.testApplication = {restoreDraft, collectData, validateStep, addFamilyRow, reindexTable, calculateSeaTimeForRow, renderSuccessView, scheduleAutosave, saveDraft, setSchema: value => {schema=value;}};\n})();');
  vm.runInContext(source,context,{filename:'js/apply.js'});
  window.testApplication.setSchema(schema);
  return {document,app:window.testApplication,stored,sessionStorage,events,get saves(){return saves;},get timers(){return timers;}};
}

check('Conditional medical details use normalized Yes answers',()=>{
  const errors=Validation.validate({medical_signoff:' Yes ',medical_unfit_disease:' Yes ',med_description:'   '},schema,2);
  for(const key of['med_vessel_name','med_occurrence_date','med_description','medical_unfit_disease_details'])assert.ok(errors[key],key);
  const dateErrors=Validation.validate({passport_doi:' 2030-01-01 ',passport_doe:' 2029-01-01 '},schema,3);
  assert.match(dateErrors.passport_doe,/after/);
});

check('Sea durations match PHP month-end and leap-year calendar differences',()=>{
  const pairs=[['2025-01-31','2025-03-01'],['2024-01-31','2024-03-01'],['2024-02-29','2025-02-28'],['2024-02-29','2025-03-01'],['2025-01-31','2025-02-28'],['2025-05-31','2025-07-01'],['2024-12-31','2025-03-01'],['2025-01-01','2025-01-01']];
  for(let i=0;i<96;i++){const start=new Date(Date.UTC(2018+i%8,i%12,28+i%4));const end=new Date(start.getTime()+(37+i*11)*86400000);pairs.push([start.toISOString().slice(0,10),end.toISOString().slice(0,10)]);}
  const php=spawnSync('php',['-r','$pairs=json_decode(stream_get_contents(STDIN),true);echo json_encode(array_map(function($p){$d=(new DateTimeImmutable($p[0]))->diff(new DateTimeImmutable($p[1]));return ($d->y*12+$d->m)."M ".$d->d."D";},$pairs));'],{input:JSON.stringify(pairs),encoding:'utf8'});
  assert.equal(php.status,0,php.stderr);
  const expected=JSON.parse(php.stdout);
  pairs.forEach(([from,to],index)=>assert.equal(Validation.seaDuration(from,to),expected[index],from+' → '+to));
  assert.equal(Validation.seaDuration('2025-03-01','2025-01-31'),'');
  assert.equal(Validation.seaDuration('2025-02-30','2025-03-01'),'');
});

check('The live sea-time calculator uses calendar durations',()=>{
  const page=browser();const from=page.document.querySelector('[name="sea_from_1"]');
  from.value='2025-01-31';page.document.querySelector('[name="sea_to_1"]').value='2025-03-01';
  page.app.calculateSeaTimeForRow({target:from});
  assert.equal(page.document.querySelector('[name="sea_total_1"]').value,'0M 29D');
});

check('Father and Mother relationships survive row removal, autosave and reload',()=>{
  for(const relation of['Father','Mother']){
    const page=browser();const body=page.document.getElementById('familyTableBody');page.app.addFamilyRow();
    const original=body.children[0];const parent=body.children[1];
    parent.querySelector('[name="fam_rel_2"]').value=relation;parent.querySelector('[name="fam_name_2"]').value='Test Parent';
    original.remove();page.app.reindexTable(body);page.app.saveDraft();
    const refreshed=browser();refreshed.stored.set('seaandseas_rps01a_draft',page.stored.get('seaandseas_rps01a_draft'));refreshed.app.restoreDraft();
    assert.equal(refreshed.document.querySelector('[name="fam_rel_1"]').value,relation);
    assert.equal(refreshed.app.collectData().family_json[0].fam_rel,relation);
  }
});

check('Blank sea history passes navigation, while populated incomplete records fail',()=>{
  const page=browser();assert.equal(page.app.validateStep(5),true);
  page.document.querySelector('[name="sea_vessel_1"]').value='Test Vessel';
  assert.equal(page.app.validateStep(5),false);
  for(const[key,value]of Object.entries({sea_owner_1:'Test Owner',sea_rank_1:'Deck Cadet',sea_from_1:'2025-01-31',sea_to_1:'2025-03-01'}))page.document.querySelector('[name="'+key+'"]').value=value;
  assert.equal(page.app.validateStep(5),true);
});

check('Success keeps filled bio-data for print and blocks further saving or submitting',()=>{
  const page=browser();const name=page.document.querySelector('[name="full_name"]');name.value='Test Seafarer';
  const card=page.document.querySelector('.apply-card');const file=page.document.getElementById('cvFile');file.value='C:\\fakepath\\TestCV.pdf';
  page.app.renderSuccessView('SS-APP-2026-ABCDEF123456','/download_application.php?token='+'a'.repeat(64));
  assert.equal(page.document.querySelector('.application-print-copy .apply-card'),card);
  assert.equal(name.value,'Test Seafarer');assert.ok(name.closest('fieldset[disabled]'));
  assert.equal(file.value,'');assert.ok(file.closest('.application-upload'));
  assert.ok(page.document.querySelector('.application-success-view'));
  assert.match(page.document.querySelector('.submission-print-reference').textContent,/ABCDEF123456/);
  const saves=page.saves,timers=page.timers;page.app.scheduleAutosave();page.app.saveDraft();
  assert.equal(page.saves,saves);assert.equal(page.timers,timers);
  let prevented=false;
  const form=page.document.getElementById('rpsApplicationForm');
  const handlers=page.events.get(form).submit;
  handlers[0]({preventDefault:()=>{prevented=true;}});assert.equal(prevented,true);
  const css=fs.readFileSync(path.join(root,'css/apply.css'),'utf8');
  assert.match(css,/\.application-print-copy\s*\{\s*display:\s*none/);
  assert.match(css,/@media print[\s\S]*\.application-success-view\s*\{\s*display:\s*none !important/);
  assert.match(css,/@media print[\s\S]*\.application-print-copy\s*\{\s*display:\s*block !important/);
});

console.log('\n'+passes+' frontend regression checks passed.');
