/* Note Slayer – popup logic (Manifest V3) */
const $ = (sel, ctx=document) => ctx.querySelector(sel);
const $$ = (sel, ctx=document) => Array.from(ctx.querySelectorAll(sel));

const COLORS = ["#071019","#0b1220","#0f1a2a","#13232d","#2b2f36","#1b2833","#10232b","#1a191f","#2a2022","#1a1a1d"];
const EMOJIS = ["⚔️","🔥","💀","🛡️","🗡️","🪓","🏴","⚡","🚀","🧭","🔒","📌","🪄"];

const defaultNote = () => ({
  id: crypto.randomUUID(),
  title: "",
  content: "",
  tags: [],
  pinned: false,
  color: COLORS[0],
  created: Date.now(),
  updated: Date.now(),
  url: ""
});

async function getNotes() {
  const { notes = [] } = await chrome.storage.local.get(["notes"]);
  return notes;
}

async function setNotes(notes) {
  await chrome.storage.local.set({ notes });
}

function parseTags(str) {
  return Array.from(new Set((str.match(/#[\p{L}\d_]+/gu) || []).map(t=>t.toLowerCase())));
}

function formatDate(ts){
  const d = new Date(ts);
  return d.toLocaleString([], {hour12:false});
}

function counts(text){
  const words = (text.trim().match(/\S+/g) || []).length;
  const chars = text.length;
  const boxes = (text.match(/\[ \]|\[x\]/gi) || []).length;
  const done = (text.match(/\[x\]/gi) || []).length;
  return `كلمات: ${words} | أحرف: ${chars} | مهام: ${done}/${boxes}`;
}

function applyFormatting(area, type){
  const start = area.selectionStart, end = area.selectionEnd;
  const val = area.value;
  let before = val.slice(0, start), sel = val.slice(start, end), after = val.slice(end);
  if(type==="bold"){ sel = `**${sel||"نص"}**`; }
  if(type==="italic"){ sel = `*${sel||"نص"}*`; }
  if(type==="list"){ sel = sel ? sel.split("\n").map(l=> l?`- ${l}`:"").join("\n") : "- عنصر"; }
  if(type==="checkbox"){ sel = sel ? sel.split("\n").map(l=> l?`- [ ] ${l}`:"- [ ] ").join("\n") : "- [ ] مهمة"; }
  area.value = before + sel + after;
  area.dispatchEvent(new Event("input"));
  area.focus();
  area.selectionStart = start; area.selectionEnd = start + sel.length;
}

function buildColorPalette(btn, note, onPick){
  const pal = document.createElement("div");
  pal.className = "color-palette";
  COLORS.forEach(c=>{
    const s = document.createElement("div");
    s.className="color-swatch"; s.style.background=c;
    s.addEventListener("click", ()=>{ onPick(c); pal.remove(); });
    pal.appendChild(s);
  });
  const rect = btn.getBoundingClientRect();
  pal.style.left = rect.left+"px"; pal.style.top = (rect.bottom+4)+"px";
  document.body.appendChild(pal);
  function closer(e){ if(!pal.contains(e.target) && e.target!==btn) { pal.remove(); document.removeEventListener("click", closer);}}
  setTimeout(()=> document.addEventListener("click", closer), 0);
}

function noteCard(note){
  const tmpl = $("#noteCardTmpl");
  const node = tmpl.content.firstElementChild.cloneNode(true);
  const title = $(".title", node);
  const content = $(".content", node);
  const pin = $(".pin", node);
  const del = $(".delete", node);
  const colorBtn = $(".color", node);
  const tagsInput = $(".tags", node);
  const dates = $(".dates", node);
  const cnt = $(".counts", node);

  node.style.background = note.color;
  node.dataset.id = note.id;
  title.value = note.title;
  content.value = note.content;
  tagsInput.value = note.tags.join(" ");
  dates.textContent = `أُنشئت: ${formatDate(note.created)} • حدثت: ${formatDate(note.updated)}`;
  cnt.textContent = counts(note.content);
  if(note.pinned) node.classList.add("pinned");

  title.addEventListener("input", async ()=>{
    const notes = await getNotes();
    const n = notes.find(n=>n.id===note.id);
    n.title = title.value; n.updated = Date.now();
    await setNotes(notes);
  });

  content.addEventListener("input", async ()=>{
    const notes = await getNotes();
    const n = notes.find(n=>n.id===note.id);
    n.content = content.value; n.tags = Array.from(new Set([...n.tags, ...parseTags(n.content)]));
    n.updated = Date.now();
    cnt.textContent = counts(n.content);
    await setNotes(notes);
    renderTagFilter();
  });

  tagsInput.addEventListener("change", async ()=>{
    const notes = await getNotes();
    const n = notes.find(n=>n.id===note.id);
    n.tags = Array.from(new Set(tagsInput.value.split(/\s+/).filter(Boolean).map(t=>t.startsWith("#")?t:"#"+t.toLowerCase())));
    n.updated = Date.now();
    await setNotes(notes);
    renderTagFilter();
  });

  pin.addEventListener("click", async ()=>{
    const notes = await getNotes();
    const n = notes.find(n=>n.id===note.id);
    n.pinned = !n.pinned; n.updated = Date.now();
    await setNotes(notes);
    renderNotes();
  });

  del.addEventListener("click", async ()=>{
    if(!confirm("حذف هذه الملاحظة؟")) return;
    let notes = await getNotes();
    notes = notes.filter(n=>n.id!==note.id);
    await setNotes(notes);
    renderNotes();
  });

  colorBtn.addEventListener("click", ()=>{
    buildColorPalette(colorBtn, note, async (c)=>{
      const notes = await getNotes();
      const n = notes.find(n=>n.id===note.id);
      n.color = c; n.updated = Date.now();
      await setNotes(notes);
      node.style.background = c;
    });
  });

  $(".bold", node).addEventListener("click", ()=> applyFormatting(content, "bold"));
  $(".italic", node).addEventListener("click", ()=> applyFormatting(content, "italic"));
  $(".list", node).addEventListener("click", ()=> applyFormatting(content, "list"));
  $(".checkbox", node).addEventListener("click", ()=> applyFormatting(content, "checkbox"));
  $(".emoji", node).addEventListener("click", ()=>{
    const e = EMOJIS[Math.floor(Math.random()*EMOJIS.length)];
    const pos = content.selectionStart||content.value.length;
    content.setRangeText(e, pos, pos, "end");
    content.dispatchEvent(new Event("input"));
  });

  return node;
}

async function renderTagFilter(){
  const notes = await getNotes();
  const allTags = Array.from(new Set(notes.flatMap(n=>n.tags))).sort();
  const sel = $("#tagFilter");
  const current = sel.value;
  sel.innerHTML = `<option value="">الكل</option>` + allTags.map(t=>`<option ${t===current?"selected":""} value="${t}">${t}</option>`).join("");
}

async function renderNotes(){
  const list = $("#notesList");
  list.innerHTML = "";
  const notes = await getNotes();
  const query = $("#search").value.trim().toLowerCase();
  const tag = $("#tagFilter").value;
  const filtered = notes
    .filter(n => (!tag || n.tags.includes(tag)) &&
                 (!query || (n.title+n.content+n.tags.join(" ")).toLowerCase().includes(query)))
    .sort((a,b)=> (b.pinned - a.pinned) || (b.updated - a.updated));
  filtered.forEach(n=> list.appendChild(noteCard(n)));
}

async function addNote(seed={}){
  const notes = await getNotes();
  const n = Object.assign(defaultNote(), seed);
  notes.push(n);
  await setNotes(notes);
  await renderTagFilter();
  await renderNotes();
}

async function exportNotes(){
  const notes = await getNotes();
  const blob = new Blob([JSON.stringify({exportedAt: Date.now(), notes}, null, 2)], {type:"application/json"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "note-slayer-backup.json";
  a.click();
  URL.revokeObjectURL(url);
}

async function importNotes(file){
  const txt = await file.text();
  const data = JSON.parse(txt);
  if(!data.notes) throw new Error("ملف غير صالح");
  await setNotes(data.notes);
  await renderTagFilter();
  await renderNotes();
}

document.addEventListener("DOMContentLoaded", async ()=>{
  $("#newNote").addEventListener("click", ()=> addNote());
  $("#exportNotes").addEventListener("click", exportNotes);
  $("#importFile").addEventListener("change", e=> importNotes(e.target.files[0]).catch(err=>alert(err.message)));
  $("#search").addEventListener("input", renderNotes);
  $("#tagFilter").addEventListener("change", renderNotes);
  await renderTagFilter();
  await renderNotes();
});
