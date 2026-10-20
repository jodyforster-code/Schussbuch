const BUCKET='sports-certificates';

// Match the Schussbuch: newest entries first, with a stable order on each date.
export function yearRows(rows,year){
 return rows.filter(r=>String(r.session_date).slice(0,4)===String(year))
  .sort((a,b)=>String(b.session_date).localeCompare(String(a.session_date))||String(a.id).localeCompare(String(b.id)));
}

export async function buildAuthorityPdf({proof,year,rows,profile,fontBytes}){
 const {PDFDocument,rgb}=globalThis.PDFLib;
 const source=await PDFDocument.load(proof);
 if(!source.getPageCount())throw Error('Der Nachweis enthält keine Seiten.');
 const doc=await PDFDocument.create();
 doc.registerFontkit(globalThis.fontkit);
 const font=await doc.embedFont(fontBytes,{subset:true});
 const list=yearRows(rows,year),generatedPages=[];
 const W=595.28,H=841.89,margin=36,width=W-2*margin;
 const ink=rgb(.08,.08,.08),muted=rgb(.48,.48,.48),rule=rgb(.75,.75,.75);
 const trainings=list.filter(r=>r.session_type==='Training').length;
 const matches=list.filter(r=>r.session_type==='Wettkampf').length;
 const rounds=list.reduce((sum,r)=>sum+Number(r.rounds||0),0);
 const created=new Date().toLocaleDateString('de-AT');
 let page,y;

 function lines(value,size,max){
  const output=[];
  for(const para of String(value??'').replace(/\t/g,' ').split(/\r?\n/)){
   let line='';
   for(const c of para){
    if(line&&font.widthOfTextAtSize(line+c,size)>max){
     const split=line.lastIndexOf(' ');
     if(split>0){output.push(line.slice(0,split));line=line.slice(split+1)+c}
     else{output.push(line);line=c}
    }else line+=c;
   }
   output.push(line);
  }
  return output;
 }
 function draw(value,x,baseline,size=10.5,color=ink){
  if(value!=='')page.drawText(String(value),{x,y:baseline,size,font,color});
 }
 function line(baseline,x=margin,w=width,color=rule){
  page.drawLine({start:{x,y:baseline},end:{x:x+w,y:baseline},thickness:.7,color});
 }
 function addPage(){page=doc.addPage([W,H]);generatedPages.push(page)}
 function wrapped(value,size=10.5,gap=15){
  for(const text of lines(value,size,width)){draw(text,margin,y,size);y-=gap}
 }
 function fitSize(value,preferred,maxLines,maxWidth){
  let size=preferred;
  while(size>10&&lines(value,size,maxWidth).length>maxLines)size-=.5;
  return size;
 }

 // Page 1: personal cover. Values always come from the signed-in profile.
 addPage();
 draw('BEHÖRDENDOKUMENT',margin,768,11,muted);
 line(746);
 draw('Trainings- und',margin,678,30);
 draw('Wettkampfnachweis',margin,635,30);
 draw(String(year),margin,548,48);
 draw(`Zeitraum: 01.01.${year} bis 31.12.${year}`,margin,514,12,muted);
 line(466);
 draw('NAME',margin,434,10,muted);
 const nameSize=fitSize(profile.full_name,24,3,width);
 y=401;wrapped(profile.full_name,nameSize,nameSize+7);
 y-=24;draw('WBK-NUMMER',margin,y,10,muted);y-=29;
 const wbkSize=fitSize(profile.wbk_number,17,2,width);
 wrapped(profile.wbk_number||'Nicht hinterlegt',wbkSize,wbkSize+6);
 const summaryY=Math.min(230,y-30);
 line(summaryY+24);
 draw(`${trainings} Trainingseinträge  |  ${matches} Wettkampfeinträge  |  ${rounds.toLocaleString('de-AT')} Schuss`,margin,summaryY,10.5);
 draw('Anlagen',margin,summaryY-34,10.5,muted);
 draw('Sportschützennachweis und Schussbuch des gewählten Jahres',margin,summaryY-53,10.5);
 draw('Erstellt am '+created,margin,80,10,muted);

 // Keep every uploaded certificate page intact, immediately after the cover.
 for(const original of await doc.copyPages(source,source.getPageIndices()))doc.addPage(original);

 // Same seven columns and field selection as the ordinary Schussbuch PDF.
 const padding=6,tableInset=12,tableLeft=margin+tableInset,tableWidth=width-2*tableInset;
 const columns=[['Datum',51],['Typ',72],['Waffe',88],['Kaliber',52],['Schuss',46],['Ort / Match',126],['Ergebnis',tableWidth-435]];
 const textSize=10,lineHeight=14,bottom=55;
 let tableTop,tableBottom;
 function frameTable(){
  page.drawRectangle({x:margin,y:tableBottom,width,height:tableTop-tableBottom,borderColor:rule,borderWidth:.7});
 }
 function tablePage(first=false){
  addPage();
  draw('Schussbuch',margin,H-51,21);
  draw('Trainings- und Wettkampfnachweis '+year,margin,H-76,12);
  line(H-92,margin,width,ink);
  y=H-115;
  if(first){
   wrapped(profile.full_name,12,17);
   if(profile.address)wrapped(profile.address);
   if(profile.email)wrapped('E-Mail: '+profile.email);
   wrapped('WBK-Nr.: '+(profile.wbk_number||'Nicht hinterlegt'));
  }else{
   // Compact running identification leaves room for the continued table.
   wrapped(profile.full_name+' | WBK-Nr.: '+(profile.wbk_number||'Nicht hinterlegt'),9,13);
  }
  tableTop=y-10;
  let x=tableLeft;
  for(const [label,w] of columns){draw(label,x+padding,tableTop-25,9,muted);x+=w}
  line(tableTop-36,tableLeft,tableWidth);
  y=tableTop-36;tableBottom=y;
 }
 tablePage(true);
 if(!list.length){
  draw('Für dieses Jahr sind keine Trainings oder Wettkämpfe erfasst.',tableLeft+padding,y-25,10);
  tableBottom=y-44;
 }
 for(const r of list){
  const date=String(r.session_date||'');
  const displayDate=/^\d{4}-\d{2}-\d{2}$/.test(date)?date.slice(0,5)+'\n'+date.slice(5):date;
  const result=[r.placement?'Pl. '+r.placement:'',r.result_percent!=null?r.result_percent+' %':''].filter(Boolean).join('\n');
  const values=[displayDate,r.session_type,r.firearm_name,r.caliber,r.rounds??0,r.title||r.location||'',result];
  const cells=values.map((value,i)=>lines(value,textSize,columns[i][1]-2*padding));
  const count=Math.max(2,...cells.map(cell=>cell.length));
  const rowHeight=count*lineHeight+16;
  if(y-rowHeight<bottom&&tableBottom< tableTop-36){frameTable();tablePage()}
  // Very long entries continue safely across pages without losing cell text.
  let offset=0;
  while(offset<count){
   let capacity=Math.floor((y-bottom-16)/lineHeight);
   if(capacity<2){frameTable();tablePage();capacity=Math.floor((y-bottom-16)/lineHeight)}
   const take=Math.min(count-offset,capacity),height=take*lineHeight+16;
   let x=tableLeft;
   cells.forEach((cell,i)=>{
    const chunk=cell.slice(offset,offset+take);
    const top=y-8-(count>take?0:(take-Math.max(1,chunk.length))*lineHeight/2);
    chunk.forEach((value,j)=>draw(value,x+padding,top-textSize-j*lineHeight,textSize));
    x+=columns[i][1];
   });
   y-=height;line(y,tableLeft,tableWidth);tableBottom=y;offset+=take;
   if(offset<count){frameTable();tablePage()}
  }
 }
 frameTable();
 const pages=doc.getPages(),count=pages.length;
 for(const generated of generatedPages){
  page=generated;
  draw('Schussbuch '+year,margin,27,8,muted);
  const footer=`Seite ${pages.indexOf(page)+1} von ${count}`;
  draw(footer,W-margin-font.widthOfTextAtSize(footer,8),27,8,muted);
 }
 doc.setTitle('Trainings- und Wettkampfnachweis '+year);
 doc.setAuthor(profile.full_name||'Schussbuch');
 doc.setSubject('Behördendokument mit Deckblatt, Sportschützennachweis und Schussbuch');
 return doc.save();
}

export function initAuthority({sb,getUserId,getQueue}){
 const $=id=>document.getElementById(id),bucket=()=>sb.storage.from(BUCKET);let busy=false,revision=0,downloadUrl=null;
 const selectedYear=()=>{const n=Number($('authorityYear').value);if(!Number.isInteger(n)||n<1900||n>2100)throw Error('Bitte ein Jahr zwischen 1900 und 2100 wählen.');return n};
 const message=(t,ok=false)=>{$('authorityMsg').className='msg'+(ok?' ok':'');$('authorityMsg').textContent=t};
 function clearDownload(){if(downloadUrl)URL.revokeObjectURL(downloadUrl);downloadUrl=null;$('authorityDownload').classList.add('hidden');$('authorityDownload').removeAttribute('href')}
 function reset(){revision++;clearDownload();$('proofFile').value='';$('proofStatus').textContent='';message('');}
 function checkUser(uid){if(!uid||uid!==getUserId())throw Error('Die Anmeldung hat sich geändert. Bitte erneut versuchen.');}
 async function listProof(uid,year){const r=await bucket().list(uid,{search:year+'.pdf',limit:100});if(r.error)throw r.error;return (r.data||[]).find(f=>f.name===year+'.pdf')}
 async function refresh(){const rev=++revision,uid=getUserId();clearDownload();$('proofStatus').textContent='Nachweis wird geprüft…';try{const year=selectedYear(),f=await listProof(uid,year);if(rev!==revision||uid!==getUserId())return;$('proofStatus').textContent=f?`Nachweis ${year} vorhanden · gespeichert am ${new Date(f.updated_at||f.created_at).toLocaleDateString('de-AT')}`:`Für ${year} ist noch kein Nachweis hinterlegt.`}catch(e){if(rev===revision)$('proofStatus').textContent='Nachweis konnte nicht geladen werden: '+e.message}}
 async function action(fn){if(busy)return;busy=true;for(const id of ['uploadProof','viewProof','deleteProof','authorityCreate','authorityYear','proofFile'])$(id).disabled=true;clearDownload();try{await fn()}catch(e){message(e.message||'Vorgang fehlgeschlagen.')}finally{busy=false;for(const id of ['uploadProof','viewProof','deleteProof','authorityCreate','authorityYear','proofFile'])$(id).disabled=false}}
 function offer(blob,name){clearDownload();downloadUrl=URL.createObjectURL(blob);const a=$('authorityDownload');a.href=downloadUrl;a.download=name;a.textContent=name+' herunterladen';a.classList.remove('hidden');a.click()}
 $('authorityYear').value=new Date().getFullYear();$('authorityYear').onchange=()=>{message('');void refresh()};
 $('uploadProof').onclick=()=>action(async()=>{const uid=getUserId(),year=selectedYear(),f=$('proofFile').files[0];checkUser(uid);if(!f)throw Error('Bitte zuerst eine PDF-Datei auswählen.');if(f.size>10485760)throw Error('Die PDF darf höchstens 10 MB groß sein.');message('PDF wird geprüft…');let bytes=await f.arrayBuffer(),doc;try{doc=await globalThis.PDFLib.PDFDocument.load(bytes)}catch{throw Error('Bitte eine gültige, nicht passwortgeschützte PDF hochladen.')}if(!doc.getPageCount())throw Error('Die PDF enthält keine Seiten.');const existing=await listProof(uid,year);checkUser(uid);if(existing&&!confirm(`Den vorhandenen Nachweis für ${year} durch „${f.name}“ ersetzen?`))return;checkUser(uid);message('Nachweis wird gespeichert…');const r=await bucket().upload(`${uid}/${year}.pdf`,bytes,{contentType:'application/pdf',upsert:true,cacheControl:'0'});if(r.error)throw r.error;checkUser(uid);$('proofFile').value='';await refresh();message(`Nachweis für ${year} gespeichert (${doc.getPageCount()} Seite(n)).`,true)});
 async function getProof(uid,year){const r=await bucket().download(`${uid}/${year}.pdf`);if(r.error)throw Error(`Nachweis für ${year} nicht verfügbar. Bitte zuerst hochladen oder die Verbindung prüfen.`);return r.data}
 $('viewProof').onclick=()=>action(async()=>{const uid=getUserId(),year=selectedYear();const blob=await getProof(uid,year);checkUser(uid);offer(blob,`Sportschuetzennachweis-${year}.pdf`);message('Nachweis bereit.',true)});
 $('deleteProof').onclick=()=>action(async()=>{const uid=getUserId(),year=selectedYear();if(!confirm(`Nachweis für ${year} wirklich löschen?`))return;checkUser(uid);const r=await bucket().remove([`${uid}/${year}.pdf`]);if(r.error)throw r.error;checkUser(uid);await refresh();message('Nachweis gelöscht.',true)});
 $('authorityCreate').onclick=()=>action(async()=>{const uid=getUserId(),year=selectedYear();checkUser(uid);if(!navigator.onLine)throw Error('Für ein vollständiges Behördendokument bitte online verbinden.');if(getQueue().some(x=>String(x.row?.session_date).slice(0,4)===String(year)))throw Error('Es gibt noch nicht synchronisierte Einträge für dieses Jahr. Bitte unter Daten & Sync zuerst synchronisieren.');message('Nachweis und sämtliche Jahreseinträge werden geladen…');const proof=await getProof(uid,year);checkUser(uid);const p=await sb.from('profiles').select('*').eq('user_id',uid).maybeSingle();if(p.error)throw p.error;if(!p.data?.full_name?.trim())throw Error('Bitte zuerst deinen Namen im Profil speichern.');if(!p.data.wbk_number?.trim())throw Error('Bitte zuerst deine WBK-Nummer im Profil speichern.');let rows=[],offset=0;for(;;){const r=await sb.from('sessions').select('*').eq('user_id',uid).gte('session_date',`${year}-01-01`).lt('session_date',`${year+1}-01-01`).order('session_date').order('id').range(offset,offset+499);if(r.error)throw r.error;checkUser(uid);rows.push(...r.data);if(r.data.length<500)break;offset+=500;}if(!rows.length&&!confirm(`Für ${year} sind keine Einträge vorhanden. Trotzdem ein Dokument mit Leerhinweis erstellen?`))return;const f=await fetch('vendor/DejaVuSans.ttf');if(!f.ok)throw Error('Die PDF-Schrift konnte nicht geladen werden.');const bytes=await buildAuthorityPdf({proof:await proof.arrayBuffer(),year,rows,profile:p.data,fontBytes:await f.arrayBuffer()});checkUser(uid);offer(new Blob([bytes],{type:'application/pdf'}),`Behoerdendokument-${year}.pdf`);message(`Behördendokument ${year} mit ${rows.length} Einträgen erstellt. Falls der Download nicht startet, den Link darunter antippen.`,true)});
 return {refresh,reset};
}
