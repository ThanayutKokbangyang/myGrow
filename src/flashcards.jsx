import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  loadFlashcards,
  writeFlashcards,
  hasOwnerToken,
  clearOwnerToken,
} from "./api";
import {
  normalizeCard,
  cleanGuess,
  dueCards,
  cardDay,
  dayKey,
  groupByDay,
  clozeSentence,
  meaningChoices,
} from "./flashcard-model";
import { dayKey as currentDayKey } from "./day";
import "./flashcards.css";
const REVIEW_MODES = [
  ["classic", "คำศัพท์ → ความหมาย"],
  ["reverse", "ความหมาย → พิมพ์คำศัพท์"],
  ["cloze", "เติมคำในประโยค"],
  ["choice", "เลือกความหมาย"],
  ["image", "ภาพ → พิมพ์คำศัพท์"],
];
const waitLabel = (ms) => {
  if (!Number.isFinite(ms)) return "ยังไม่มีรอบถัดไป";
  if (ms <= 0) return "พร้อมทบทวนแล้ว";
  const minutes = Math.ceil(ms / 60000);
  if (minutes < 60) return `อีก ${minutes} นาที`;
  const hours = Math.ceil(minutes / 60);
  if (hours < 24) return `อีก ${hours} ชั่วโมง`;
  return `อีก ${Math.ceil(hours / 24)} วัน`;
};
const CACHE = "mygrow-vocabulary-v1",
  FRESH_MS = 60000;
const readCache = () => {
  try {
    return JSON.parse(localStorage.getItem(CACHE) || "[]").map(normalizeCard);
  } catch {
    return [];
  }
};
// Module scope, so it outlives the component. Flashcards unmounts every time
// the user leaves the tab; without this the sheet was fetched again (and the
// page fell back to "กำลังโหลดคำศัพท์…") on every single visit.
const store = { items: null, meta:null, page:1, pages:1, total:0, at: 0, inflight: null, inflightKey:'', key:'' };
const remember = (items,meta=null) => {
  store.items = items;
  if(meta)store.meta=meta;
  store.at = Date.now();
};
function fetchCards(force,options={mode:'study',pageSize:200}) {
  const key=JSON.stringify(options);
  if (store.inflight&&store.inflightKey===key) return store.inflight;
  if (!force && store.items && store.key===key && Date.now() - store.at < FRESH_MS)
    return Promise.resolve({cards:store.items,meta:store.meta,page:store.page,pages:store.pages,total:store.total});
  store.inflightKey=key;store.inflight = loadFlashcards(options)
    .then((result) => {
      const items = (result.cards||[]).map(normalizeCard);
      store.key=key;store.page=result.page||1;store.pages=result.pages||1;store.total=result.total||items.length;
      remember(items,result.meta||{});
      return {...result,cards:items};
    })
    .finally(() => {
      if(store.inflightKey===key){store.inflight = null;store.inflightKey=''}
    });
  return store.inflight;
}
function Icon({ name }) {
  return <img className="fcIcon" src={`/ui/pixel/${name}.png`} alt="" />;
}
export default function Flashcards({ onRequireOwner, onSuccess, ownerOpen }) {
  const stored = store.items; // from an earlier visit, maybe stale
  const [cards, setCards] = useState(() => stored || readCache()),
    [tab, setTab] = useState("study"),
    [ready, setReady] = useState(!!stored),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState(stored ? "" : "กำลังโหลดคำศัพท์…");
  const [meta,setMeta]=useState(()=>store.meta||{total:0,attempts:0,accuracy:0,mastered:0,dueTotal:0,nextDue:0,levels:[0,0,0,0,0,0],tags:{},days:{}}),[libraryPage,setLibraryPage]=useState(store.page||1),[pageCount,setPageCount]=useState(store.pages||1);
  const [flipped, setFlipped] = useState(false),
    [index, setIndex] = useState(0),
    [query, setQuery] = useState(""),
    [tag, setTag] = useState("all"),
    [day, setDay] = useState("all"),
    [all, setAll] = useState(false),
    [mode, setMode] = useState("classic"),
    [now, setNow] = useState(Date.now),
    [streak, setStreak] = useState(0),
    [sessionReviewed, setSessionReviewed] = useState(0);
  const [editor, setEditor] = useState(null),
    [removing, setRemoving] = useState(null),
    [guess, setGuess] = useState(""),
    [guessResult, setGuessResult] = useState("");
  const lock = useRef(false),
    mounted = useRef(true),
    loadRun = useRef(0),
    studyDay = useRef(currentDayKey());
  function accept(next) {
    const normalized = next.map(normalizeCard);
    remember(normalized);
    setCards(normalized);
    try {
      localStorage.setItem(CACHE, JSON.stringify(normalized));
    } catch {}
    return normalized;
  }
  // force: the "โหลดใหม์" button, which always hits the sheet and announces it.
  // Otherwise this is a quiet revalidation that leaves the visible cards alone.
  async function refresh(force = true) {
    if (lock.current) return;
    const run = ++loadRun.current;
    if (force) {
      setReady(false);
      setNotice("กำลังโหลดคำศัพท์…");
    }
    try {
      const options=tab==='study'&&!all?{mode:'study',pageSize:200}:{mode:'library',page:libraryPage,pageSize:50,query:query.trim(),tag,day};
      const result = await fetchCards(force,options),items=result.cards;
      if (!mounted.current || run !== loadRun.current) return;
      accept(items);
      setMeta(result.meta||{});setLibraryPage(result.page||1);setPageCount(result.pages||1);
      setReady(true);
      setNotice("");
      if (force) {
        setIndex(0);
        setFlipped(false);
      }
    } catch (e) {
      if (mounted.current && run === loadRun.current) setNotice(e.message);
    }
  }
  useEffect(() => {
    mounted.current = true;
    // Fresh data from an earlier visit: render it and stay quiet.
    if (!(stored && store.key===JSON.stringify({mode:'study',pageSize:200}) && Date.now() - store.at < FRESH_MS)) refresh(!stored);
    const tick = () => {
      setNow(Date.now());
      const nextDay = currentDayKey();
      if (studyDay.current !== nextDay) {
        studyDay.current = nextDay;
        setAll(false);
        setIndex(0);
        setFlipped(false);
        setGuess("");
        setGuessResult("");
        setStreak(0);
        setSessionReviewed(0);
        setNotice("เริ่มวันใหม่แล้ว · รอบประจำวันรีเซ็ตเวลา 05:00");
      }
    };
    const timer = setInterval(tick, 30000);
    window.addEventListener("focus", tick);
    return () => {
      mounted.current = false;
      loadRun.current++;
      clearInterval(timer);
      window.removeEventListener("focus", tick);
      window.speechSynthesis?.cancel();
    };
  }, []);
  useEffect(()=>{if(!(tab==='words'||tab==='study'&&all))return;const timer=setTimeout(()=>refresh(true),query?300:0);return()=>clearTimeout(timer)},[tab,all,libraryPage,query,tag,day]);
  useEffect(()=>setLibraryPage(1),[query,tag,day]);
  async function mutate(action, payload) {
    if (lock.current) return null;
    if (!ready) {
      setNotice("โหลดคำศัพท์จาก Sheet ให้สำเร็จก่อนบันทึก");
      return null;
    }
    if (!hasOwnerToken()) {
      onRequireOwner();
      setNotice("ยืนยันว่าเป็นเท่ แล้วกดรายการเดิมอีกครั้ง");
      return null;
    }
    lock.current = true;
    setBusy(true);
    try {
      const result = await writeFlashcards(action, payload);
      if (!mounted.current) return null;
      return result;
    } catch (e) {
      if (e.status === 401) {
        clearOwnerToken();
        onRequireOwner();
      }
      setNotice(e.message);
      return null;
    } finally {
      lock.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  const tags = useMemo(()=>Object.keys(meta.tags||{}).sort(),[meta.tags]);
  const days = useMemo(
    () => Object.entries(meta.days||{}).sort((a,b)=>b[0].localeCompare(a[0])),
    [meta.days],
  );
  const dayLabel = (key) =>
    key === "unknown"
      ? "ไม่ทราบวันที่"
      : new Date(key + "T00:00:00").toLocaleDateString("th-TH", {
          day: "numeric",
          month: "long",
          year: "numeric",
        });
  const filtered = useMemo(
    () =>
      cards.filter(
        (c) =>
          (tag === "all" || c.tag === tag) &&
          (day === "all" || dayKey(cardDay(c)) === day) &&
          `${c.word} ${c.meaning} ${c.tag}`
            .toLowerCase()
            .includes(query.toLowerCase()),
      ),
    [cards, tag, day, query],
  );
  const due = useMemo(() => dueCards(filtered, now), [filtered, now]);
  const queue = all ? filtered : due,
    current = queue[index % Math.max(queue.length, 1)];
  useEffect(()=>{if(tab==='study'&&!all&&tag==='all'&&ready&&!busy&&!due.length&&(meta.dueTotal||0)>0)refresh(true)},[tab,all,tag,ready,busy,due.length,meta.dueTotal]);
  const stats = {attempts:meta.attempts||0,accuracy:meta.accuracy||0,mastered:meta.mastered||0};
  const clozePrompt = useMemo(
    () => (current ? clozeSentence(current.example, current.word) : ""),
    [current?.id, current?.example, current?.word],
  );
  const choices = useMemo(
    () => meaningChoices(filtered, current),
    [filtered, current?.id],
  );
  const effectiveMode =
    mode === "cloze" && !clozePrompt
      ? "reverse"
      : mode === "choice" && choices.length < 2
        ? "classic"
        : mode === "image" && !current?.imageUrl
          ? "reverse"
          : mode;
  const nextDue = Math.min(
    ...filtered.map((card) => Number(card.due)).filter((dueAt) => dueAt > now),
  );
  const sessionTotal = sessionReviewed + queue.length;
  const sessionPercent = all
    ? queue.length
      ? (Math.min(sessionReviewed, queue.length) / queue.length) * 100
      : 0
    : sessionTotal
      ? (sessionReviewed / sessionTotal) * 100
      : 100;
  useEffect(() => {
    setFlipped(false);
    setGuess("");
    setGuessResult("");
  }, [current?.id, all, tag, day, mode]);
  useEffect(() => {
    setSessionReviewed(0);
    setIndex(0);
  }, [all, tag, mode]);
  function speak() {
    if (!current) return;
    if (!window.speechSynthesis) {
      setNotice("เบราว์เซอร์นี้ยังไม่รองรับเสียงอ่าน");
      return;
    }
    speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(current.word);
    utterance.lang = "en-US";
    utterance.rate = 0.82;
    speechSynthesis.speak(utterance);
  }
  function checkTypedAnswer(event) {
    event.preventDefault();
    setGuessResult(
      cleanGuess(guess) === cleanGuess(current.word)
        ? "ถูกต้อง!"
        : "ยังไม่ถูก ดูคำตอบแล้วลองจำอีกครั้ง",
    );
    setFlipped(true);
  }
  function chooseMeaning(meaning) {
    setGuessResult(
      cleanGuess(meaning) === cleanGuess(current.meaning)
        ? "ถูกต้อง!"
        : "ยังไม่ถูก ดูคำตอบแล้วลองจำอีกครั้ง",
    );
    setFlipped(true);
  }
  async function answer(remembered) {
    if (!current || !flipped || busy || editor || ownerOpen) return;
    if (remembered && guessResult && guessResult !== "ถูกต้อง!") return;
    if (all) {
      setSessionReviewed((value) => value + 1);
      setStreak((value) => (remembered ? value + 1 : 0));
      setNotice(
        remembered
          ? "ฝึกผ่านแล้ว · Free Practice ไม่เปลี่ยนระดับหรือรอบทบทวน"
          : "ข้ามไว้ฝึกต่อได้ · Free Practice ไม่เปลี่ยนรอบทบทวน",
      );
      if (remembered) onSuccess?.();
      setIndex((value) => (value + 1) % Math.max(queue.length, 1));
      setFlipped(false);
      setGuess("");
      setGuessResult("");
      return;
    }
    const result = await mutate("review", {
      id: current.id,
      remembered,
      reviewId: crypto.randomUUID(),
    });
    if (!result) return;
    const updated = normalizeCard(result.card);
    accept(cards.map((c) => (c.id === updated.id ? updated : c)));
    setMeta(value=>({...value,attempts:(value.attempts||0)+1,correct:(value.correct||0)+(remembered?1:0),dueTotal:Math.max(0,(value.dueTotal||0)-1),levels:(value.levels||[0,0,0,0,0,0]).map((count,level)=>count+(level===updated.level?1:0)-(level===current.level?1:0))}));
    setNow(Date.now());
    setSessionReviewed((value) => value + 1);
    setStreak((v) => (remembered ? v + 1 : 0));
    setNotice(
      remembered
        ? "จำได้แล้ว! บันทึกรอบทบทวนถัดไปแล้ว"
        : "ไม่เป็นไร กลับมาทบทวนคำนี้ได้อีกใน 10 นาที",
    );
    if (remembered) onSuccess?.();
    setIndex((i) =>
      all
        ? (i + 1) % Math.max(queue.length, 1)
        : i % Math.max(queue.length - 1, 1),
    );
    setFlipped(false);
    setGuess("");
    setGuessResult("");
  }
  useEffect(() => {
    const key = (e) => {
      if (
        tab !== "study" ||
        editor ||
        ownerOpen ||
        busy ||
        e.repeat ||
        e.target.isContentEditable ||
        ["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName)
      )
        return;
      if (e.code === "Space") {
        if (e.target.tagName === "BUTTON") return;
        e.preventDefault();
        setFlipped((v) => !v);
      }
      if (e.key === "1") answer(false);
      if (e.key === "2") answer(true);
      if (e.key.toLowerCase() === "s") speak();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });
  function beginEdit(c = {}) {
    setEditor({
      id: c.id || crypto.randomUUID(),
      word: c.word || "",
      meaning: c.meaning || "",
      phonetic: c.phonetic || "",
      example: c.example || "",
      translation: c.translation || "",
      tag: c.tag || "General",
      imageUrl: c.imageUrl || "",
      imageFileId: c.imageFileId || "",
      createdAt: c.createdAt || "",
      updatedAt: c.updatedAt || "",
    });
  }
  async function saveCard(card, image) {
    let data = { ...card };
    if (image) {
      const uploaded = await mutate("uploadImage", { image });
      if (!uploaded) return false;
      data = {
        ...data,
        imageUrl: uploaded.imageUrl,
        imageFileId: uploaded.imageFileId,
      };
      setEditor(data);
    }
    const result = await mutate("upsert", { card: data });
    if (!result) return false;
    const saved = normalizeCard(result.card);
    accept([saved, ...cards.filter((c) => c.id !== saved.id)]);
    setEditor(null);
    setNotice("บันทึกคำศัพท์แล้ว");
    return true;
  }
  return (
    <section className="fcPage">
      <header className="fcHeader">
        <div className="fcEmblem">
          <Icon name="book" />
        </div>
        <div>
          <p>ENGLISH QUEST · TOEIC 750+</p>
          <h1>Daily Flashcards</h1>
          <span>จำทีละคำ เติบโตทีละวัน</span>
        </div>
        <button
          className="fcPrimary"
          onClick={() => beginEdit()}
          disabled={busy || !ready}
        >
          <Icon name="plus" />
          เพิ่มคำศัพท์
        </button>
      </header>
      <div className="fcNav" role="tablist" aria-label="หน้าแฟลชการ์ด">
        {[
          ["study", "book", "ทบทวน"],
          ["words", "search", "คลังคำศัพท์"],
          ["progress", "trend", "ความคืบหน้า"],
        ].map(([id, icon, label]) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
          >
            <Icon name={icon} />
            {label}
          </button>
        ))}
      </div>
      <div className="fcConnection">
        <span className={ready ? "connected" : ""}>
          {ready ? "● Vocabulary · เชื่อมต่อแล้ว" : "○ ยังไม่เชื่อมต่อ"}
        </span>
        <button disabled={busy} onClick={() => refresh(true)}>
          โหลดใหม่
        </button>
      </div>
      {notice && (
        <p className="fcNotice" role="status">
          {notice}
        </p>
      )}
      {tab !== "progress" && (
        <div className="fcFilters">
          <label>
            หมวดคำศัพท์
            <select
              value={tag}
              onChange={(e) => {
                setTag(e.target.value);
                setIndex(0);
              }}
            >
              <option value="all">ทุกหมวด</option>
              {tags.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </label>
          {tab === "study" && (
            <label>
              รูปแบบการทบทวน
              <select value={mode} onChange={(e) => setMode(e.target.value)}>
                {REVIEW_MODES.map(([id, label]) => (
                  <option key={id} value={id}>{label}</option>
                ))}
              </select>
            </label>
          )}
          {tab === "words" && (
            <label>
              วันที่บันทึก
              <select value={day} onChange={(e) => setDay(e.target.value)}>
                <option value="all">ทุกวัน</option>
                {days.map(([key, n]) => (
                  <option key={key} value={key}>
                    {dayLabel(key)} · {n} คำ
                  </option>
                ))}
              </select>
            </label>
          )}
          {tab === "words" && (
            <label>
              ค้นหา
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="คำศัพท์ หรือคำแปล"
              />
            </label>
          )}
          {tab === "study" && (
            <button
              aria-pressed={all}
              onClick={() => {
                setAll((v) => !v);
                setIndex(0);
                setQuery("");
              }}
            >
              {all ? "กลับสู่รอบจริง" : "เข้า Free Practice"}
            </button>
          )}
        </div>
      )}
      {tab === "study" && (
        <div className="fcStudy">
          <div className="fcStudyHeading">
            <div>
              <p className="fcEyebrow">
                {all ? "FREE PRACTICE" : "TODAY’S REVIEW"}
              </p>
              <h2>พร้อมจำคำใหม่หรือยัง?</h2>
            </div>
            <span className="fcStreak">
              <Icon name="flame" />
              {streak} คำต่อเนื่อง
            </span>
          </div>
          {current ? (
            <>
              <div className="fcCounter">
                <span>
                  {all
                    ? `คำที่ ${(index % queue.length) + 1} จาก ${queue.length}`
                    : `ทำแล้ว ${sessionReviewed} · เหลือ ${queue.length} คำ`}
                </span>
                <span>ระดับ {current.level}/5</span>
              </div>
              <div className="fcSessionProgress" aria-label={`ความคืบหน้า ${Math.round(sessionPercent)}%`}>
                <i style={{ width: `${sessionPercent}%` }} />
              </div>
              {effectiveMode !== mode && (
                <p className="fcModeFallback">
                  การ์ดนี้ไม่มีข้อมูลสำหรับโหมดที่เลือก จึงสลับรูปแบบให้อัตโนมัติ
                </p>
              )}
              <div
                className={`fcCard ${flipped ? "fcFlipped" : ""}`}
                key={current.id}
              >
                <div className="fcCardInner">
                  <div
                    className="fcFace fcFront"
                    aria-hidden={flipped}
                    inert={flipped ? true : undefined}
                  >
                    <span className="fcTag">{current.tag}</span>
                    {effectiveMode === "choice" ? (
                      <div className="fcRecallPrompt">
                        <small>เลือกความหมายที่ถูกต้อง</small>
                        <strong>{current.word}</strong>
                        <div className="fcChoices">
                          {choices.map((meaning) => (
                            <button type="button" key={meaning} onClick={() => chooseMeaning(meaning)}>
                              {meaning}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : effectiveMode === "reverse" || effectiveMode === "cloze" || effectiveMode === "image" ? (
                      <>
                        {effectiveMode === "image" && (
                          <img
                            className="fcRecallImage"
                            src={current.imageUrl}
                            alt="ภาพคำใบ้"
                            referrerPolicy="no-referrer"
                          />
                        )}
                        {effectiveMode === "reverse" && (
                          <div className="fcRecallPrompt"><small>พิมพ์คำศัพท์ภาษาอังกฤษ</small><strong>{current.meaning}</strong></div>
                        )}
                        {effectiveMode === "cloze" && (
                          <div className="fcRecallPrompt"><small>เติมคำในช่องว่าง</small><strong className="fcCloze">{clozePrompt}</strong></div>
                        )}
                        <form onSubmit={checkTypedAnswer}>
                          <label>
                            {effectiveMode === "image" ? "ภาพนี้คือคำว่าอะไร?" : "คำตอบของเรา"}
                            <input
                              value={guess}
                              onChange={(e) => setGuess(e.target.value)}
                              autoComplete="off"
                              placeholder="พิมพ์คำศัพท์ภาษาอังกฤษ"
                              required
                            />
                          </label>
                          <button disabled={busy || !guess.trim()}>
                            ตรวจคำตอบ
                          </button>
                        </form>
                      </>
                    ) : (
                      <button
                        className="fcFlipSurface"
                        onClick={() => setFlipped(true)}
                        aria-label="พลิกดูคำแปล"
                      >
                        <strong>{current.word}</strong>
                        <span>{current.phonetic || "แตะเพื่อดูคำแปล"}</span>
                        <small>คลิกการ์ด หรือกด Space เพื่อพลิก</small>
                      </button>
                    )}
                  </div>
                  <div
                    className="fcFace fcBack"
                    aria-hidden={!flipped}
                    inert={!flipped ? true : undefined}
                  >
                    <span className="fcTag">{current.tag}</span>
                    <button
                      className="fcFlipSurface"
                      onClick={() => setFlipped(false)}
                      aria-label="กลับด้านคำศัพท์"
                    >
                      <small>{current.word}</small>
                      <strong>{current.meaning}</strong>
                      {current.example && <em>{current.example}</em>}
                      {current.translation && (
                        <span>{current.translation}</span>
                      )}
                      {guessResult && <span className={guessResult === "ถูกต้อง!" ? "fcCorrect" : "fcWrong"}>{guessResult}</span>}
                    </button>
                  </div>
                </div>
              </div>
              <div className="fcReviewActions">
                <button onClick={speak}>
                  <Icon name="play" />
                  ฟังเสียง <kbd>S</kbd>
                </button>
                {effectiveMode !== "classic" && !flipped && (
                  <button onClick={() => setFlipped(true)}>ดูเฉลย</button>
                )}
                <button
                  className="fcAgain"
                  disabled={!flipped || busy || !ready}
                  onClick={() => answer(false)}
                >
                  <Icon name="reset" />
                  ยังจำไม่ได้ <kbd>1</kbd>
                </button>
                <button
                  className="fcRemember"
                  disabled={!flipped || busy || !ready || Boolean(guessResult && guessResult !== "ถูกต้อง!")}
                  onClick={() => answer(true)}
                >
                  <Icon name="check" />
                  จำได้แล้ว <kbd>2</kbd>
                </button>
              </div>
              <p className="fcTip">
                พลิกดูก่อนตอบ · รอบทบทวน 1, 3, 7, 14 และ 30 วัน
              </p>
            </>
          ) : (
            <div className="fcEmpty">
              <Icon name="check" />
              <h2>
                {meta.total
                  ? "ทบทวนครบแล้ว เก่งมาก!"
                  : "เริ่มสะสมคำศัพท์คำแรก"}
              </h2>
              <p>
                {meta.total
                  ? `${waitLabel(nextDue - now)} · พักได้เลย หรือเข้า Free Practice เพื่อฝึกต่อ`
                  : "เพิ่มคำศัพท์ใหม่ หรือรอเชื่อมต่อ Vocabulary ให้สำเร็จ"}
              </p>
            </div>
          )}
        </div>
      )}
      {tab === "words" && (
        <section className="fcCollection">
          <h2>
            คลังคำศัพท์ <small>{filtered.length} คำ</small>
          </h2>
          <div className="fcWordList">
            {groupByDay(filtered).map(([key, list]) => (
              <section className="fcDayGroup" key={key}>
                <header>
                  <h3>{dayLabel(key)}</h3>
                  <span>{list.length} คำ</span>
                </header>
                {list.map((c) => (
                  <article key={c.id}>
                    <div>
                      <b>{c.word}</b>
                      <span>{c.phonetic}</span>
                      <small>
                        {c.tag} · ระดับ {c.level}
                      </small>
                    </div>
                    <p>{c.meaning}</p>
                    <div className="fcWordActions">
                      <button disabled={busy} onClick={() => beginEdit(c)}>
                        แก้ไข
                      </button>
                      {removing === c.id ? (
                        <>
                          <button
                            disabled={busy}
                            onClick={async () => {
                              if (await mutate("delete", { id: c.id })) {
                                accept(cards.filter((w) => w.id !== c.id));
                                setRemoving(null);
                                setNotice("ลบคำศัพท์แล้ว");
                              }
                            }}
                          >
                            ยืนยันลบ
                          </button>
                          <button onClick={() => setRemoving(null)}>
                            ยกเลิก
                          </button>
                        </>
                      ) : (
                        <button
                          disabled={busy}
                          onClick={() => setRemoving(c.id)}
                        >
                          ลบ
                        </button>
                      )}
                    </div>
                  </article>
                ))}
              </section>
            ))}
            {!filtered.length && <p>ไม่พบคำศัพท์</p>}
          </div>
          {pageCount>1&&<nav className="fcPagination" aria-label="หน้าคลังคำศัพท์"><button disabled={libraryPage<=1} onClick={()=>setLibraryPage(page=>page-1)}>‹ ก่อนหน้า</button><span>หน้า <b>{libraryPage}</b> / {pageCount}<small>พบ {store.total} คำ</small></span><button disabled={libraryPage>=pageCount} onClick={()=>setLibraryPage(page=>page+1)}>ถัดไป ›</button></nav>}
          <div className="fcBackup">
            <button
              onClick={() => {
                const url = URL.createObjectURL(
                  new Blob([JSON.stringify(cards, null, 2)], {
                    type: "application/json",
                  }),
                );
                const a = document.createElement("a");
                a.href = url;
                a.download = "mygrow-vocabulary.json";
                a.click();
                setTimeout(() => URL.revokeObjectURL(url), 1000);
              }}
            >
              ส่งออกคำศัพท์หน้านี้
            </button>
            <label className="fcFileBtn">
              <Icon name="plus" />
              <span>นำเข้า JSON</span>
              <input
                type="file"
                accept=".json,application/json"
                disabled={busy || !ready}
                onChange={async (e) => {
                  const file = e.target.files[0];
                  e.target.value = "";
                  if (!file) return;
                  try {
                    if (file.size > 5e6) throw Error("ไฟล์ใหญ่เกิน 5 MB");
                    const raw = JSON.parse(await file.text()),
                      list = Array.isArray(raw) ? raw : raw.cards;
                    if (!Array.isArray(list) || list.length > 500)
                      throw Error("นำเข้าได้ครั้งละไม่เกิน 500 คำ");
                    const imported = list.map(normalizeCard);
                    const result = await mutate("import", { cards: imported });
                    if (result) {
                      await refresh(true);
                      setNotice("นำเข้าคำศัพท์แล้ว โดยเก็บคำที่มี ID เดิมไว้");
                    }
                  } catch (e) {
                    setNotice(e.message);
                  }
                }}
              />
            </label>
          </div>
        </section>
      )}
      {tab === "progress" && (
        <section className="fcProgress">
          <h2>ทุกคำที่จำได้ คืออีกก้าวหนึ่ง</h2>
          <div className="fcStats">
            {[
              ["คำศัพท์ทั้งหมด", meta.total||0],
              ["ตอบไปแล้ว", stats.attempts],
              ["ความแม่นยำ", `${stats.accuracy}%`],
              ["จำระยะยาว", stats.mastered],
              ["ถึงรอบตอนนี้", meta.dueTotal||0],
              ["รอบถัดไป", meta.nextDue?waitLabel(Number(meta.nextDue) - now):"ยังไม่มีรอบถัดไป"],
            ].map(([label, n]) => (
              <div key={label}>
                <span>{label}</span>
                <strong>{n}</strong>
              </div>
            ))}
          </div>
          <h3>ระดับการจดจำ</h3>
          {[0, 1, 2, 3, 4, 5].map((level) => (
            <div className="fcLevel" key={level}>
              <span>ระดับ {level}</span>
              <div>
                <i
                  style={{
                    width: `${meta.total ? ((meta.levels?.[level]||0) / meta.total) * 100 : 0}%`,
                  }}
                />
              </div>
              <b>{meta.levels?.[level]||0}</b>
            </div>
          ))}
        </section>
      )}
      {editor && (
        <CardEditor
          key={editor.id}
          initial={editor}
          tags={tags}
          onClose={() => setEditor(null)}
          onSave={saveCard}
          busy={busy}
        />
      )}
    </section>
  );
}
async function prepareImage(file) {
  if (file.size > 8e6) throw Error("เลือกรูปไม่เกิน 8 MB");
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const ratio = Math.min(1, 1000 / Math.max(img.width, img.height)),
      canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * ratio);
    canvas.height = Math.round(img.height * ratio);
    canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
    return {
      data: canvas.toDataURL("image/jpeg", 0.78).split(",")[1],
      mimeType: "image/jpeg",
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}
function CardEditor({ initial, tags = [], onClose, onSave, busy }) {
  const [draft, setDraft] = useState(initial),
    [file, setFile] = useState(null),
    [saving, setSaving] = useState(false),
    [error, setError] = useState("");
  const [newTag, setNewTag] = useState(false);
  const first = useRef(null),
    dialog = useRef(null);
  useEffect(() => {
    const previous = document.activeElement;
    first.current?.focus();
    return () => previous?.focus();
  }, []);
  const disabled = busy || saving;
  // Categories are picked from the ones already in use; typing a fresh one is
  // still possible, it just has to be asked for.
  const tagOptions = [
    ...new Set([...tags, "General", draft.tag].filter(Boolean)),
  ].sort();
  const tagField = newTag ? (
    <span className="fcTagNew">
      <input
        value={draft.tag}
        maxLength={100}
        required
        placeholder="ชื่อหมวดใหม่"
        autoFocus
        onChange={(e) => setDraft({ ...draft, tag: e.target.value })}
      />
      <button
        type="button"
        onClick={() => {
          setNewTag(false);
          setDraft({ ...draft, tag: tagOptions[0] || "General" });
        }}
      >
        เลือกจากรายการ
      </button>
    </span>
  ) : (
    <select
      value={draft.tag}
      onChange={(e) => {
        if (e.target.value === "__new__") {
          setNewTag(true);
          setDraft({ ...draft, tag: "" });
        } else setDraft({ ...draft, tag: e.target.value });
      }}
    >
      {tagOptions.map((t) => (
        <option key={t}>{t}</option>
      ))}
      <option value="__new__">+ เพิ่มหมวดใหม่…</option>
    </select>
  );
  return (
    <div
      className="fcModalBackdrop"
      onKeyDown={(e) => {
        if (e.key === "Escape" && !disabled) onClose();
        if (e.key === "Tab") {
          const nodes = [
            ...dialog.current.querySelectorAll(
              "button:not(:disabled),input:not(:disabled),textarea:not(:disabled)",
            ),
          ];
          if (e.shiftKey && document.activeElement === nodes[0]) {
            e.preventDefault();
            nodes.at(-1)?.focus();
          } else if (!e.shiftKey && document.activeElement === nodes.at(-1)) {
            e.preventDefault();
            nodes[0]?.focus();
          }
        }
      }}
    >
      <form
        ref={dialog}
        className="fcModal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="fc-editor-title"
        onSubmit={async (e) => {
          e.preventDefault();
          if (disabled) return;
          setSaving(true);
          setError("");
          try {
            const image = file ? await prepareImage(file) : null;
            await onSave(draft, image);
          } catch (err) {
            setError(err.message);
          } finally {
            setSaving(false);
          }
        }}
      >
        <header>
        <h2 id="fc-editor-title">บันทึกคำศัพท์</h2>
        <button
            type="button"
            aria-label="ปิด"
            disabled={disabled}
            onClick={onClose}
        >
            <Icon name="close" />
        </button>
        </header>
        <fieldset disabled={disabled}>
          {[
            ["word", "คำศัพท์ *"],
            ["meaning", "คำแปล *"],
            ["phonetic", "คำอ่าน"],
            ["tag", "หมวด"],
            ["example", "ประโยคตัวอย่าง", "wide"],
            ["translation", "คำแปลประโยค", "wide"],
            ["imageUrl", "ลิงก์รูปช่วยจำ (ไม่บังคับ)", "wide"],
          ].map(([key, label, wide]) => (
            <label className={wide ? "fcWide" : undefined} key={key}>
              {label}
              {key === "tag" ? (
                tagField
              ) : (
                <input
                  ref={key === "word" ? first : undefined}
                  value={draft[key]}
                  onChange={(e) =>
                    setDraft({ ...draft, [key]: e.target.value })
                  }
                  required={["word", "meaning"].includes(key)}
                  maxLength={
                    key === "example" || key === "translation" ? 2000 : 1000
                  }
                  type={key === "imageUrl" ? "url" : "text"}
                />
              )}
            </label>
          ))}
          <label className="fcWide">
            หรืออัปโหลดภาพช่วยจำ
            <span className="fcFileBtn">
              <span>{file ? file.name : "เลือกรูปจากเครื่อง"}</span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(e) => setFile(e.target.files[0] || null)}
              />
            </span>
            <small>รูปที่เลือกจะเก็บใน Google Drive และใช้เป็นภาพคำใบ้</small>
          </label>
          {error && (
            <p className="fcWide" role="alert">
              {error}
            </p>
          )}
          <button className="fcPrimary fcWide" disabled={disabled}>
            {disabled ? "กำลังบันทึก…" : "บันทึกคำศัพท์"}
          </button>
        </fieldset>
      </form>
    </div>
  );
}
