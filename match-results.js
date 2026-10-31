export const RESULT_BUCKET='match-results';
const MAX_FILE=10*1024*1024,MAX_TOTAL=75*1024*1024;
export function resultName(name){return name.replace(/^[a-f0-9-]{36}--/i,'')}
export async function validateResult(file){
 if(!file||file.size===0||file.size>MAX_FILE)throw Error('Jedes Ergebnis-PDF muss zwischen 1 Byte und 10 MB groß sein.');
 const bytes=await file.arrayBuffer();let pdf;
 try{pdf=await globalThis.PDFLib.PDFDocument.load(bytes)}catch{throw Error('Bitte eine gültige PDF ohne Passwort auswählen: '+file.name)}
 if(!pdf.getPageCount())throw Error('Die PDF enthält keine Seiten: '+file.name);
 return bytes;
}
export async function listResults(sb,uid,id){
 if(!uid||!id||String(id).startsWith('local-'))throw Error('Bitte den Wettkampf zuerst online speichern.');
 const folder=`${uid}/${id}`,files=[];
 for(let offset=0;;offset+=100){
  const r=await sb.storage.from(RESULT_BUCKET).list(folder,{limit:100,offset,sortBy:{column:'name',order:'asc'}});
  if(r.error)throw Error('Ergebnis-PDFs konnten nicht geladen werden: '+r.error.message);
  files.push(...(r.data||[]).filter(f=>f.id&&/\.pdf$/i.test(f.name)).map(f=>({...f,path:folder+'/'+f.name})));
  if((r.data||[]).length<100)break;
 }
 return files;
}
export async function collectYearResults({sb,uid,rows,year,checkUser=()=>{},progress=()=>{}}){
 const matches=rows.filter(r=>r.session_type==='Wettkampf'&&String(r.session_date).slice(0,4)===String(year))
 .sort((a,b)=>String(b.session_date).localeCompare(String(a.session_date))||String(a.id).localeCompare(String(b.id)));
 const attachments=[];let total=0,pages=0;
 for(const row of matches){
  checkUser(uid);
  const files=await listResults(sb,uid,row.id);checkUser(uid);
  for(const file of files){
   progress(`Ergebnis-PDF wird geladen: ${row.title||row.session_date} · ${resultName(file.name)}`);
   if(total+Number(file.metadata?.size||0)>MAX_TOTAL)throw Error('Die Jahresanhänge sind größer als 75 MB. Bitte die PDFs verkleinern.');
   const r=await sb.storage.from(RESULT_BUCKET).download(file.path);checkUser(uid);
   if(r.error)throw Error('Anhang nicht verfügbar: '+resultName(file.name)+'. Bitte Verbindung prüfen und erneut versuchen.');
   total+=r.data.size;if(total>MAX_TOTAL)throw Error('Die Jahresanhänge sind größer als 75 MB. Bitte die PDFs verkleinern.');
   const bytes=await r.data.arrayBuffer();let pdf;
   try{pdf=await globalThis.PDFLib.PDFDocument.load(bytes)}catch{throw Error('Anhang ist beschädigt oder passwortgeschützt: '+resultName(file.name))}
   if(!pdf.getPageCount())throw Error('Anhang ohne Seiten: '+resultName(file.name));
   pages+=pdf.getPageCount();if(pages>300)throw Error('Die Jahresanhänge enthalten mehr als 300 Seiten. Bitte die Ergebnis-PDFs kürzen.');
   attachments.push({name:resultName(file.name),date:row.session_date,title:row.title||row.location||'Wettkampf',sessionId:row.id,bytes});
  }
 }
 return attachments;
}
export function initMatchResults({sb,getUserId,getSessionId,isMatch,isSessionBusy}){
 const $=id=>document.getElementById(id);let pending=[],pendingUid=null,busy=false,revision=0,downloadUrl=null;
 function check(uid){if(!uid||uid!==getUserId())throw Error('Die Anmeldung hat sich geändert. Bitte erneut anmelden.');}
 function clearDownload(){if(downloadUrl)URL.revokeObjectURL(downloadUrl);downloadUrl=null;$('resultDownload').removeAttribute('href');$('resultDownload').classList.add('hidden')}
 function status(text,ok=false){$('resultMsg').textContent=text;$('resultMsg').className='msg'+(ok?' ok':'')}
 function show(){const visible=isMatch();$('resultBox').classList.toggle('hidden',!visible);$('resultUpload').disabled=!getSessionId()||busy||isSessionBusy();$('resultHint').textContent=getSessionId()?'Weitere PDFs auswählen und hochladen. Bereits gespeicherte Anhänge bleiben erhalten.':'Die ausgewählten PDFs werden zusammen mit dem neuen Wettkampfeintrag gespeichert.';}
 function reset(){revision++;pending=[];pendingUid=null;$('resultFiles').value='';$('resultList').replaceChildren();clearDownload();status('');show()}
 $('resultFiles').onchange=()=>{pending=Array.from($('resultFiles').files||[]);pendingUid=getUserId();status(pending.length?pending.length+' PDF(s) zum Hochladen ausgewählt.':'');};
 async function validatePending(){if(!pending.length||!isMatch())return;check(pendingUid);if(!navigator.onLine)throw Error('PDF-Anhänge benötigen eine Internetverbindung. Bitte online speichern oder die Dateiauswahl entfernen.');for(const f of pending)await validateResult(f);}
 async function uploadPending(uid,id){
  check(uid);if(!isMatch())return 0;if(pending.length)check(pendingUid);let count=0;
  while(pending.length){const file=pending[0],bytes=await validateResult(file);check(uid);
   const safe=file.name.normalize('NFKD').replace(/[^a-zA-Z0-9._-]/g,'_').slice(0,100).replace(/\.pdf$/i,'')||'Ergebnis';
   const path=`${uid}/${id}/${crypto.randomUUID()}--${safe}.pdf`;
   const r=await sb.storage.from(RESULT_BUCKET).upload(path,bytes,{contentType:'application/pdf',upsert:false,cacheControl:'0'});
   if(r.error)throw Error('PDF-Upload fehlgeschlagen: '+r.error.message);
   check(uid);pending.shift();count++;
  }
  $('resultFiles').value='';return count;
 }
 async function refresh(){
  show();const uid=getUserId(),id=getSessionId(),rev=++revision;$('resultList').replaceChildren();clearDownload();
  if(!uid||!id||!isMatch())return;
  status('Anhänge werden geladen…');
  try{const files=await listResults(sb,uid,id);check(uid);if(rev!==revision||String(id)!==String(getSessionId()))return;
   for(const f of files){
    const item=document.createElement('div');item.className='resultItem';
    const name=document.createElement('span');name.textContent=resultName(f.name);
    const actions=document.createElement('div');actions.className='actions';
    const open=document.createElement('button');open.type='button';open.className='ghost';open.textContent='PDF öffnen';
    open.onclick=()=>action(async()=>{check(uid);const r=await sb.storage.from(RESULT_BUCKET).download(f.path);if(r.error)throw r.error;check(uid);if(rev!==revision)return;clearDownload();downloadUrl=URL.createObjectURL(r.data);const a=$('resultDownload');a.href=downloadUrl;a.download=resultName(f.name);a.textContent='PDF herunterladen: '+resultName(f.name);a.classList.remove('hidden');a.click();status('PDF bereit.',true)});
    const remove=document.createElement('button');remove.type='button';remove.className='danger';remove.textContent='Entfernen';
    remove.onclick=()=>action(async()=>{if(!confirm('Ergebnis-PDF „'+resultName(f.name)+'“ löschen?'))return;check(uid);const r=await sb.storage.from(RESULT_BUCKET).remove([f.path]);if(r.error)throw r.error;check(uid);await refresh()});
    actions.append(open,remove);item.append(name,actions);$('resultList').append(item);
   }status(files.length?files.length+' Ergebnis-PDF(s) gespeichert.':'Noch keine Ergebnis-PDFs hinterlegt.',true);
  }catch(e){if(rev===revision)status(e.message)}
 }
 async function action(fn){if(busy||isSessionBusy())return;busy=true;lock(true);try{await fn()}catch(e){status(e.message)}finally{busy=false;lock(false);show()}}
 function lock(value){$('resultFiles').disabled=value;$('sType').disabled=value;for(const b of $('resultBox').querySelectorAll('button'))b.disabled=value;}
 $('resultUpload').onclick=()=>action(async()=>{const uid=getUserId(),id=getSessionId();if(!id)throw Error('Bitte zuerst den Wettkampf speichern.');if(!pending.length)throw Error('Bitte zuerst eine PDF auswählen.');await validatePending();await uploadPending(uid,id);await refresh()});
 async function removeAll(id){const uid=getUserId();check(uid);const files=await listResults(sb,uid,id);check(uid);for(let i=0;i<files.length;i+=100){const r=await sb.storage.from(RESULT_BUCKET).remove(files.slice(i,i+100).map(f=>f.path));if(r.error)throw r.error;check(uid)}}
 return {show,reset,refresh,validatePending,uploadPending,removeAll,lock,isBusy:()=>busy,hasPending:()=>pending.length>0};
}
