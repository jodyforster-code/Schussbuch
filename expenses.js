const CATEGORIES=['Kaufpreis Waffe','Zubehör','Umbau / Bearbeitung','Reparatur','Wartung','Sonstiges'];
const status=g=>g.ownership_status||'owned';
const statusName=g=>({owned:'Im Bestand',sold:'Verkauft',borrowed:'Leihwaffe'}[status(g)]||'Im Bestand');
const TYPES={pdf:'application/pdf',jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',webp:'image/webp',heic:'image/heic',heif:'image/heif'};
const money=v=>Number(v||0).toLocaleString('de-AT',{style:'currency',currency:'EUR'});
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function parseExpenseAmount(value){const s=String(value).trim();if(!/^\d{1,10}([.,]\d{1,2})?$/.test(s))throw Error('Bitte einen Betrag ab 0 mit höchstens zwei Nachkommastellen eingeben.');const n=Number(s.replace(',','.'));if(n>9999999999.99)throw Error('Der Betrag ist zu groß.');return Math.round(n*100)/100}
export function receiptType(file){const ext=file.name.split('.').pop().toLowerCase();if(!TYPES[ext]||file.type&&!Object.values(TYPES).includes(file.type))throw Error('Belege bitte als PDF, JPG, PNG, WebP, HEIC oder HEIF auswählen.');if(!file.size||file.size>10485760)throw Error('Jeder Beleg muss zwischen 1 Byte und 10 MB groß sein.');return TYPES[ext]}
export function summarizeCosts(guns,expenses,sessions){
 const byGun=new Map(guns.map(g=>[String(g.id),{id:String(g.id),name:g.name,ownership_status:status(g),purchase:0,extras:0,ammo:0,fees:0,hasPurchase:false}]));
 function item(id,name){const key=id==null?'unassigned':String(id);if(!byGun.has(key))byGun.set(key,{id:key,name:key==='unassigned'?'Ohne aktuelle Waffen-Zuordnung':name||'Waffe',purchase:0,extras:0,ammo:0,fees:0,hasPurchase:false});return byGun.get(key)}
 expenses.forEach(e=>{const g=item(e.firearm_id);if(e.category==='Kaufpreis Waffe'){g.purchase+=Number(e.amount)||0;g.hasPurchase=true}else g.extras+=Number(e.amount)||0});
 sessions.forEach(s=>{const g=item(s.firearm_id,s.firearm_name);g.ammo+=(Number(s.rounds)||0)*(Number(s.cost_per_round)||0);if(s.session_type==='Wettkampf')g.fees+=Number(s.entry_fee)||0});
 const rows=[...byGun.values()].map(g=>({...g,bookValue:status(g)==='owned'&&g.id!=='unassigned'?g.purchase+g.extras:0,total:g.purchase+g.extras+g.ammo+g.fees}));
 return {rows,total:rows.reduce((t,g)=>t+g.total,0),missingPurchases:guns.filter(g=>status(g)==='owned'&&!byGun.get(String(g.id)).hasPurchase).length,missingFees:sessions.filter(s=>s.session_type==='Wettkampf'&&(s.entry_fee==null||s.entry_fee==='')).length};
}
export function initExpenses({sb,getUserId}){
 const $=id=>document.getElementById(id),bucket=()=>sb.storage.from('firearm-receipts');
 let photos=new Map(),guns=[],expenses=[],sessions=[],ready=false,busy=false,revision=0,draftId=crypto.randomUUID(),editing=false,blobUrl=null;
 const today=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
 function check(uid){if(!uid||uid!==getUserId())throw Error('Die Anmeldung hat sich geändert. Bitte erneut öffnen.');}
 function message(text,ok=false){$('expenseMsg').textContent=text;$('expenseMsg').className='msg'+(ok?' ok':'');}
 function clearDownload(){if(blobUrl)URL.revokeObjectURL(blobUrl);blobUrl=null;$('expenseDownload').classList.add('hidden');$('expenseDownload').removeAttribute('href')}
 function newEntry(){editing=false;draftId=crypto.randomUUID();$('expenseForm').reset();$('expenseDate').value=today();$('expenseSave').textContent='Eintrag speichern';$('expenseCancel').classList.add('hidden');$('expenseGun').disabled=!ready;$('expenseFormTitle').textContent='Kauf oder Maßnahme erfassen';}
 function reset(){revision++;guns=[];expenses=[];sessions=[];photos.clear();ready=false;clearDownload();$('expenseRows').innerHTML='';$('expenseTotals').innerHTML='';$('expenseByGun').innerHTML='';$('expenseGunCards').innerHTML='';$('expenseCompleteness').textContent='';$('expenseGun').innerHTML='';$('expenseFilter').innerHTML='<option value="">Alle Waffen</option>';newEntry();message('');}
 async function all(table,uid,fields='*') {let rows=[];for(let offset=0;;offset+=500){const r=await sb.from(table).select(fields).eq('user_id',uid).order('id').range(offset,offset+499);if(r.error)throw r.error;check(uid);rows.push(...r.data);if(r.data.length<500)return rows}}
 async function refresh(){if(busy)return;const rev=++revision,uid=getUserId();try{check(uid);message('Kostenübersicht wird geladen…');const data=await Promise.all([all('firearms',uid),all('firearm_expenses',uid),all('sessions',uid,'id,firearm_id,firearm_name,rounds,cost_per_round,session_type,entry_fee')]);if(rev!==revision)return;check(uid);[guns,expenses,sessions]=data;photos.clear();
 const signed=await Promise.all(guns.filter(g=>status(g)==='owned'&&g.photo_path).map(async g=>{const r=await sb.storage.from('firearm-photos').createSignedUrl(g.photo_path,3600);return [String(g.id),r.data?.signedUrl||'']}));
 if(rev!==revision)return;check(uid);photos=new Map(signed);ready=true;const selected=$('expenseGun').value,filter=$('expenseFilter').value;const options=guns.filter(g=>status(g)==='owned').map(g=>`<option value="${esc(g.id)}">${esc(g.name)}</option>`).join('');$('expenseGun').innerHTML='<option value="">Waffe wählen</option>'+options;$('expenseFilter').innerHTML='<option value="">Alle Waffen</option>'+options;$('expenseGun').value=selected;$('expenseFilter').value=filter;$('expenseGun').disabled=false;render();message(guns.length?'':'Bitte zuerst im Bereich Waffen eine Waffe anlegen.',true)}catch(e){if(rev===revision){ready=false;message('Übersicht konnte nicht vollständig geladen werden: '+e.message)}}}
 function overviewPhoto(g){
  if(g.historical||!guns.some(gun=>String(gun.id)===g.id))return '';
  const photo=photos.get(g.id),gun=guns.find(gun=>String(gun.id)===g.id);
  return `<div class="expenseOverviewPhoto">${photo?`<img src="${esc(photo)}" alt="Foto von ${esc(g.name)}" width="112" height="84" loading="lazy"><span class="small hidden">Foto nicht verfügbar</span>`:`<span class="small">${gun.photo_path?'Foto nicht verfügbar':'Noch kein Foto'}</span>`}</div>`;
 }
 $('expenseByGun').addEventListener('error',e=>{
  const img=e.target;
  if(img.tagName==='IMG'&&img.closest('.expenseOverviewPhoto')){img.classList.add('hidden');img.nextElementSibling.classList.remove('hidden');}
 },true);
 function render(){
  const summary=summarizeCosts(guns,expenses,sessions),sum=key=>summary.rows.reduce((t,g)=>t+g[key],0);
  $('expenseTotals').innerHTML=[['Waffenkäufe',sum('purchase')],['Zubehör & Arbeiten',sum('extras')],['Buchwert im Bestand',sum('bookValue')],['Munition',sum('ammo')],['Startgelder',sum('fees')],['Hobby gesamt',summary.total]].map(([label,amount])=>`<div class="kpi"><b>${money(amount)}</b><span>${label}</span></div>`).join('');
  $('expenseCompleteness').textContent='Alle Jahre · Aktuelle Waffen einzeln; historische Kosten nur als Gesamtsumme.'+(summary.missingPurchases?` Bei ${summary.missingPurchases} Waffe(n) fehlt noch der Kaufpreis.`:'')+(summary.missingFees?` ${summary.missingFees} Wettkampfeintrag/Einträge ohne Startgeld.`:'');
  const shown=summary.rows.filter(g=>status(g)==='owned');
  const historical=summary.rows.filter(g=>status(g)!=='owned');
  if(historical.some(g=>g.total!==0))shown.push({name:'Historische Kosten (zusammengefasst)',historical:true,hasPurchase:true,...Object.fromEntries(['purchase','extras','bookValue','ammo','fees','total'].map(key=>[key,historical.reduce((a,g)=>a+g[key],0)]))});
  $('expenseByGun').innerHTML=shown.length?'<table><thead><tr><th>Waffe</th><th>Kaufpreis</th><th>Zubehör & Arbeiten</th><th>Buchwert</th><th>Munition</th><th>Startgelder</th><th>Hobbykosten</th></tr></thead><tbody>'+shown.map(g=>`<tr><td>${overviewPhoto(g)}${esc(g.name)}<div class="small">${g.historical?'Frühere Bestände und Leihwaffen':statusName(g)}</div></td><td>${g.hasPurchase?money(g.purchase):'Nicht erfasst'}</td><td>${money(g.extras)}</td><td><b>${money(g.bookValue)}</b></td><td>${money(g.ammo)}</td><td>${money(g.fees)}</td><td><b>${money(g.total)}</b></td></tr>`).join('')+`</tbody><tfoot><tr><th>Gesamt</th><th>${money(sum('purchase'))}</th><th>${money(sum('extras'))}</th><th>${money(sum('bookValue'))}</th><th>${money(sum('ammo'))}</th><th>${money(sum('fees'))}</th><th>${money(summary.total)}</th></tr></tfoot></table>`:'<p class="small">Noch keine Waffen oder Kosten erfasst.</p>';
  renderGunCards(summary);
  const filter=$('expenseFilter').value,list=expenses.filter(e=>guns.some(g=>String(g.id)===String(e.firearm_id)&&status(g)==='owned')&&(!filter||String(e.firearm_id)===filter)).sort((a,b)=>b.expense_date.localeCompare(a.expense_date)||b.created_at.localeCompare(a.created_at));
  $('expenseRows').innerHTML=list.length?list.map(e=>`<article class="expenseItem"><div class="expenseItemHead"><div><b>${esc(e.title)}</b><div class="small">${esc(e.expense_date.split('-').reverse().join('.'))} · ${esc(guns.find(g=>String(g.id)===String(e.firearm_id))?.name||'Waffe')} · ${esc(e.category)}</div></div><b>${money(e.amount)}</b></div>${e.notes?`<p class="expenseNotes">${esc(e.notes)}</p>`:''}<div class="actions"><button class="ghost" type="button" data-expense-action="edit" data-id="${e.id}">Bearbeiten</button><button class="ghost" type="button" data-expense-action="receipts" data-id="${e.id}">Belege anzeigen</button><button class="danger" type="button" data-expense-action="delete" data-id="${e.id}">Löschen</button></div><div id="receipts-${e.id}" class="expenseReceipts"></div></article>`).join(''):'<p class="small">Noch keine Käufe oder Maßnahmen für diese Auswahl erfasst.</p>';
 }
 function renderGunCards(summary){
  $('expenseGunCards').innerHTML=guns.filter(g=>status(g)==='owned').map(g=>{const total=summary.rows.find(x=>x.id===String(g.id)),photo=photos.get(String(g.id)),shots=Number(g.starting_rounds||0)+sessions.filter(s=>String(s.firearm_id)===String(g.id)).reduce((a,s)=>a+Number(s.rounds||0),0);
   return `<article class="expenseGunCard"><div class="expensePhoto">${photo?`<img src="${esc(photo)}" alt="Foto von ${esc(g.name)}" loading="lazy">`:`<span class="small">${g.photo_path?'Foto nicht verfügbar – bitte aktualisieren':'Noch kein Foto'}</span>`}</div><div class="expenseGunInfo"><h3>${esc(g.name)}</h3><div class="small">${statusName(g)}</div><dl><dt>Kaliber</dt><dd>${esc(g.caliber||'–')}</dd><dt>Seriennummer</dt><dd>${esc(g.serial_number||'–')}</dd><dt>Division</dt><dd>${esc(g.division||'–')}</dd><dt>Schuss gesamt</dt><dd>${shots.toLocaleString('de-AT')}</dd><dt>Kaufpreis</dt><dd>${total.hasPurchase?money(total.purchase):'Nicht erfasst'}</dd><dt>Zubehör & Arbeiten</dt><dd>${money(total.extras)}</dd><dt>Buchwert</dt><dd><b>${money(total.bookValue)}</b></dd><dt>Hobbykosten gesamt</dt><dd>${money(total.total)}</dd></dl>${g.notes?`<p class="expenseNotes small">${esc(g.notes)}</p>`:''}<label for="gunPhoto-${g.id}">${g.photo_path?'Foto ersetzen':'Waffenfoto hochladen'}</label><input id="gunPhoto-${g.id}" data-photo-gun="${g.id}" type="file" accept=".jpg,.jpeg,.png,.webp"><p class="small">JPG, PNG oder WebP, maximal 10 MB.</p><div class="actions"><button type="button" class="ghost" data-gun-action="history" data-id="${g.id}">Historie & Belege</button><button type="button" class="ghost" data-gun-action="add" data-id="${g.id}">Kosten hinzufügen</button>${g.photo_path?`<button type="button" class="danger" data-gun-action="removePhoto" data-id="${g.id}">Foto entfernen</button>`:''}</div></div></article>`;
  }).join('')||'<p class="small">Lege im Bereich Waffen deine erste Waffe an.</p>';
 }
 async function changePhoto(uid,gun,file){
  const old=gun.photo_path||null;let path=null;
  if(file){const type=receiptType(file);if(!['image/jpeg','image/png','image/webp'].includes(type))throw Error('Für Waffenfotos bitte JPG, PNG oder WebP verwenden.');path=`${uid}/${gun.id}/${crypto.randomUUID()}.${file.name.split('.').pop().toLowerCase()}`;const r=await sb.storage.from('firearm-photos').upload(path,file,{contentType:type,upsert:false});if(r.error)throw r.error;check(uid)}
  let query=sb.from('firearms').update({photo_path:path}).eq('user_id',uid).eq('id',gun.id);query=old?query.eq('photo_path',old):query.is('photo_path',null);
  const r=await query.select('id');
  if(r.error||!r.data?.length){if(path)await sb.storage.from('firearm-photos').remove([path]);throw Error(r.error?.message||'Das Waffenfoto wurde zwischenzeitlich geändert. Bitte aktualisieren.')}
  check(uid);gun.photo_path=path;photos.delete(String(gun.id));
  let cleanupError=false;
  if(old&&old.startsWith(`${uid}/${gun.id}/`)){const removed=await sb.storage.from('firearm-photos').remove([old]);cleanupError=!!removed.error}
  if(path){const signed=await sb.storage.from('firearm-photos').createSignedUrl(path,3600);check(uid);if(signed.data?.signedUrl)photos.set(String(gun.id),signed.data.signedUrl)}
  render();message((path?'Waffenfoto gespeichert.':'Waffenfoto entfernt.')+(cleanupError?' Die alte Fotodatei konnte noch nicht aus dem Speicher gelöscht werden.':''),!cleanupError);
 }
 $('expenseGunCards').onchange=e=>{const input=e.target,gun=guns.find(g=>String(g.id)===input.dataset.photoGun),file=input.files?.[0];if(!gun||!file||busy)return;void action(async uid=>{message('Waffenfoto wird gespeichert…');await changePhoto(uid,gun,file)});};
 $('expenseGunCards').onclick=e=>{const button=e.target.closest('button[data-gun-action]');if(!button||busy)return;const gun=guns.find(g=>String(g.id)===button.dataset.id);if(!gun)return;
  if(button.dataset.gunAction==='history'){$('expenseFilter').value=String(gun.id);render();$('expenseFilter').scrollIntoView({behavior:'smooth'})}
  if(button.dataset.gunAction==='add'){newEntry();$('expenseGun').value=String(gun.id);$('expenseFormTitle').scrollIntoView({behavior:'smooth'})}
  if(button.dataset.gunAction==='removePhoto'&&confirm('Dieses Waffenfoto wirklich entfernen?'))void action(uid=>changePhoto(uid,gun,null));
 };
 async function action(fn){if(busy)return;revision++;busy=true;const uid=getUserId();$('expenseForm').querySelectorAll('input,select,textarea,button').forEach(el=>el.disabled=true);$('expenseNew').disabled=true;try{check(uid);if(!navigator.onLine)throw Error('Für Kosten und Belege bitte online verbinden.');await fn(uid)}catch(e){if(uid===getUserId())message(e.code==='23505'?'Für diese Waffe ist bereits ein Kaufpreis erfasst. Bitte den vorhandenen Eintrag bearbeiten.':e.message||'Vorgang fehlgeschlagen.')}finally{busy=false;$('expenseForm').querySelectorAll('input,select,textarea,button').forEach(el=>el.disabled=false);$('expenseGun').disabled=!ready;$('expenseNew').disabled=false}}
 async function filesFor(uid,id){let files=[];for(let offset=0;;offset+=100){const r=await bucket().list(`${uid}/${id}`,{limit:100,offset,sortBy:{column:'name',order:'asc'}});if(r.error)throw r.error;check(uid);files.push(...r.data);if(r.data.length<100)return files}}
 const displayName=name=>name.includes('__')?name.slice(name.indexOf('__')+2):name;
 async function showReceipts(uid,id){const target=$('receipts-'+id);if(!target)return;target.textContent='Belege werden geladen…';const files=await filesFor(uid,id);if(!target.isConnected)return;target.innerHTML=files.length?files.map(f=>`<div class="expenseReceipt"><span>${esc(displayName(f.name))}</span><div class="actions"><button type="button" class="ghost" data-expense-action="download" data-id="${id}" data-file="${esc(f.name)}">Herunterladen</button><button type="button" class="danger" data-expense-action="removeFile" data-id="${id}" data-file="${esc(f.name)}">Beleg löschen</button></div></div>`).join(''):'<p class="small">Noch keine Belege. Über Bearbeiten kannst du Dateien hinzufügen.</p>';}
 $('expenseCategory').innerHTML=CATEGORIES.map(c=>`<option>${c}</option>`).join('');newEntry();
 $('expenseFilter').onchange=render;
 $('expenseRefresh').onclick=()=>{if(!busy)void refresh()};
 $('expenseNew').onclick=()=>{if(!busy){newEntry();message('');$('expenseFormTitle').scrollIntoView({behavior:'smooth'})}};
 $('expenseCancel').onclick=()=>{if(!busy){newEntry();message('')}};
 $('expenseForm').onsubmit=e=>{e.preventDefault();void action(async uid=>{
  if(!ready)throw Error('Bitte zuerst die Kostenübersicht aktualisieren.');
  const gun=guns.find(g=>String(g.id)===$('expenseGun').value);if(!gun||status(gun)!=='owned')throw Error('Bitte eine Waffe im aktuellen Bestand auswählen.');
  const date=$('expenseDate').value,title=$('expenseTitle').value.trim(),notes=$('expenseNotes').value.trim(),category=$('expenseCategory').value,amount=parseExpenseAmount($('expenseAmount').value);
  if(!date||!/^\d{4}-\d{2}-\d{2}$/.test(date)||!title||title.length>200||notes.length>10000||!CATEGORIES.includes(category))throw Error('Bitte Datum, Kategorie und Titel vollständig ausfüllen.');
  const files=Array.from($('expenseFiles').files);files.forEach(receiptType);
  if(category==='Kaufpreis Waffe'&&expenses.some(e=>e.id!==draftId&&e.category===category&&String(e.firearm_id)===String(gun.id)))throw Error('Der Kaufpreis dieser Waffe ist bereits erfasst. Bitte den vorhandenen Eintrag bearbeiten.');
  const id=draftId,row={id,user_id:uid,firearm_id:gun.id,expense_date:date,title,notes,category,amount,updated_at:new Date().toISOString()};
  message('Eintrag wird gespeichert…');const r=await sb.from('firearm_expenses').upsert(row,{onConflict:'id'}).select().single();if(r.error)throw r.error;check(uid);editing=true;expenses=[r.data,...expenses.filter(e=>e.id!==id)];
  const failed=[];let uploaded=0;
  for(const f of files){check(uid);const name=f.name.replace(/[\\/\u0000-\u001f]/g,'_').slice(-160),path=`${uid}/${id}/${crypto.randomUUID()}__${name}`;message(`Beleg ${uploaded+failed.length+1} von ${files.length} wird gespeichert…`);try{const upload=await bucket().upload(path,f,{contentType:receiptType(f),upsert:false});if(upload.error)throw upload.error;uploaded++}catch(error){failed.push(f.name+' ('+(error.message||'Upload fehlgeschlagen')+')')}}
  check(uid);$('expenseFiles').value='';render();
  if(failed.length){$('expenseSave').textContent='Änderungen speichern';$('expenseCancel').classList.remove('hidden');message(`Eintrag gespeichert; ${uploaded} Beleg(e) hochgeladen. Nicht hochgeladen: ${failed.join(', ')}. Bitte diese Dateien erneut auswählen und speichern.`)}else{newEntry();message(`Eintrag gespeichert${uploaded?' · '+uploaded+' Beleg(e) hinzugefügt':''}.`,true)}
 })};
 $('expenseRows').onclick=e=>{const button=e.target.closest('button[data-expense-action]');if(!button||busy)return;const id=button.dataset.id,row=expenses.find(e=>e.id===id);if(!row)return;const kind=button.dataset.expenseAction;
  if(kind==='edit'){draftId=id;editing=true;$('expenseGun').value=String(row.firearm_id);$('expenseDate').value=row.expense_date;$('expenseCategory').value=row.category;$('expenseTitle').value=row.title;$('expenseAmount').value=Number(row.amount).toFixed(2).replace('.',',');$('expenseNotes').value=row.notes||'';$('expenseFiles').value='';$('expenseSave').textContent='Änderungen speichern';$('expenseCancel').classList.remove('hidden');$('expenseFormTitle').textContent='Eintrag bearbeiten';$('expenseFormTitle').scrollIntoView({behavior:'smooth'});message('Weitere Belege kannst du beim Speichern hinzufügen.');return}
  void action(async uid=>{
   if(kind==='receipts'){await showReceipts(uid,id);return}
   if(kind==='download'){const f=button.dataset.file;if(f.includes('/'))throw Error('Ungültiger Dateiname.');message('Beleg wird geladen…');const r=await bucket().download(`${uid}/${id}/${f}`);if(r.error)throw r.error;check(uid);clearDownload();blobUrl=URL.createObjectURL(r.data);const a=$('expenseDownload');a.href=blobUrl;a.download=displayName(f);a.textContent=displayName(f)+' herunterladen';a.classList.remove('hidden');a.click();a.scrollIntoView({behavior:'smooth',block:'center'});message('Beleg bereit. Falls nötig, den Downloadlink antippen.',true);return}
   if(kind==='removeFile'){const f=button.dataset.file;if(f.includes('/'))throw Error('Ungültiger Dateiname.');if(!confirm('Diesen Beleg wirklich löschen?'))return;const r=await bucket().remove([`${uid}/${id}/${f}`]);if(r.error)throw r.error;check(uid);clearDownload();await showReceipts(uid,id);message('Beleg gelöscht.',true);return}
   if(kind==='delete'){if(!confirm('Diesen Kosteneintrag einschließlich aller Belege wirklich löschen?'))return;const files=await filesFor(uid,id);for(let i=0;i<files.length;i+=100){check(uid);const r=await bucket().remove(files.slice(i,i+100).map(f=>`${uid}/${id}/${f.name}`));if(r.error)throw r.error}check(uid);const r=await sb.from('firearm_expenses').delete().eq('id',id).eq('user_id',uid).select('id');if(r.error)throw r.error;check(uid);if(!r.data?.length)throw Error('Eintrag konnte nicht gelöscht werden. Bitte aktualisieren.');expenses=expenses.filter(e=>e.id!==id);if(draftId===id)newEntry();clearDownload();render();message('Eintrag und Belege gelöscht.',true)}
  });
 };
 return {refresh,reset};
}
