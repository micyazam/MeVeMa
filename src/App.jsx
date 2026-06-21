import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { supabase, isConfigured } from "./supabaseClient";

/* ============================================================
   מי ומה — לוח פיקסלים פרסומי · ₪1 לפיקסל · 1,000,000 לעמוד
   ============================================================ */

const GRID = 1000, SNAP = 10, PRICE = 1, BUCKET = "ad-images";

/* >>> ערכי את פרטי הקשר שלך כאן <<< */
const CONTACT = { email: "info@example.com", phone: "050-0000000", company: "מי ומה" };

const CATEGORIES = [
  { id: "realestate", name: 'נדל"ן',           icon: "🏠", color: "#7C3AED", example: "דירות חדשות בחיפה" },
  { id: "auto",       name: "רכב",             icon: "🚗", color: "#4F46E5", example: "טויוטה קורולה 2023" },
  { id: "food",       name: "מזון",            icon: "🍔", color: "#DB2777", example: "מסעדה חדשה נפתחה" },
  { id: "pharm",      name: "פארם & ביוטי",    icon: "💄", color: "#EC4899", example: "מוצרי טיפוח וקוסמטיקה" },
  { id: "cellular",   name: "סלולרי",          icon: "📱", color: "#0D9488", example: "אייפון במבצע השקה" },
  { id: "vacation",   name: "חופשה",           icon: "✈️", color: "#0EA5E9", example: "חבילת נופש ביוון" },
  { id: "fashion",    name: "אופנה",           icon: "👗", color: "#A21CAF", example: "קולקציית קיץ חדשה" },
  { id: "jobs",       name: "דרושים",          icon: "💼", color: "#6366F1", example: "דרוש/ה איש/ת מכירות" },
  { id: "courses",    name: "קורסים ולימודים", icon: "🎓", color: "#14B8A6", example: "קורס דיגיטל למתחילים" },
  { id: "celebs",     name: "מפורסמים",        icon: "⭐", color: "#C026D3", example: "עקבו אחריי באינסטגרם" },
  { id: "finance",    name: "פיננסים וביטוח",  icon: "📊", color: "#7E22CE", example: "ביטוח רכב משתלם" },
  { id: "websites",   name: "אתרים ו-AI",      icon: "🌐", color: "#6D28D9", example: "בניית אתרים בעזרת AI" },
];
const catById = (id) => CATEGORIES.find((c) => c.id === id);

const PACKAGES = [
  { pixels: 100, w: 10, h: 10 }, { pixels: 200, w: 20, h: 10 }, { pixels: 500, w: 50, h: 10 },
  { pixels: 1000, w: 50, h: 20 }, { pixels: 2500, w: 50, h: 50 }, { pixels: 5000, w: 100, h: 50 },
  { pixels: 10000, w: 100, h: 100 },
];

const nis = (n) => "₪" + Number(n || 0).toLocaleString("he-IL");
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString("he-IL") : "—");
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const addYears = (d, n) => { const x = new Date(d); x.setFullYear(x.getFullYear() + n); return x; };

/* בטיחות קישור */
const SHORTENERS = ["bit.ly", "tinyurl.com", "t.co", "goo.gl", "ow.ly", "is.gd", "cutt.ly", "rb.gy", "shorturl.at"];
const RISKY_TLD = [".zip", ".mov", ".xyz", ".top", ".click", ".country", ".gq", ".tk", ".ml"];
const BAD_WORDS = ["porn", "sex", "casino", "xxx", "viagra", "הימור", "פורנו"];
function checkLink(raw) {
  let url; try { url = new URL(raw); } catch { return { ok: false, flags: ["כתובת לא תקינה"] }; }
  if (!["http:", "https:"].includes(url.protocol)) return { ok: false, flags: ["פרוטוקול אסור"] };
  const flags = [], host = url.hostname.toLowerCase();
  if (raw.includes("@")) flags.push("סימן @ בכתובת");
  if (host.startsWith("xn--")) flags.push("punycode");
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) flags.push("כתובת IP");
  if (SHORTENERS.includes(host)) flags.push("מקצר כתובות");
  if (RISKY_TLD.some((t) => host.endsWith(t))) flags.push("סיומת בסיכון");
  if (raw.length > 180) flags.push("כתובת ארוכה");
  if (BAD_WORDS.some((w) => raw.toLowerCase().includes(w))) flags.push("מילה חסומה");
  return { ok: true, flags };
}
const checkText = (t = "") => BAD_WORDS.filter((w) => t.toLowerCase().includes(w));

function waNumber(phone) {
  let d = (phone || "").replace(/\D/g, "");
  if (d.startsWith("972")) return d;
  if (d.startsWith("0")) return "972" + d.slice(1);
  return d;
}
const phoneEmail = (phone) => `${waNumber(phone)}@mevema.co.il`;
const validPhone = (phone) => waNumber(phone).length >= 11 && waNumber(phone).length <= 13;
function genPassword() {
  const c = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let p = "";
  for (let i = 0; i < 8; i++) p += c[Math.floor(Math.random() * c.length)];
  return p;
}

function compressImage(file, w, h) {
  return new Promise((res, rej) => {
    const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = 6, cw = Math.min(Math.round(w * scale), 480), ch = Math.min(Math.round(h * scale), 480);
      const c = document.createElement("canvas"); c.width = cw; c.height = ch;
      const ctx = c.getContext("2d"), ar = img.width / img.height, car = cw / ch;
      let sx, sy, sw, sh;
      if (ar > car) { sh = img.height; sw = sh * car; sx = (img.width - sw) / 2; sy = 0; }
      else { sw = img.width; sh = sw / car; sx = 0; sy = (img.height - sh) / 2; }
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, cw, ch);
      URL.revokeObjectURL(url);
      c.toBlob((b) => (b ? res(b) : rej(new Error("blob"))), "image/jpeg", 0.72);
    };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error("img")); };
    img.src = url;
  });
}
async function uploadImage(blob) {
  const name = `${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
  const up = await supabase.storage.from(BUCKET).upload(name, blob, { contentType: "image/jpeg" });
  if (up.error) throw up.error;
  return supabase.storage.from(BUCKET).getPublicUrl(name).data.publicUrl;
}
async function deleteImageByUrl(url) {
  if (!url) return;
  const path = url.split(`/${BUCKET}/`)[1];
  if (path) await supabase.storage.from(BUCKET).remove([path]);
}

const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
function fits(cand, ads) {
  if (cand.x < 0 || cand.y < 0 || cand.x + cand.w > GRID || cand.y + cand.h > GRID) return false;
  return !ads.some((a) => overlap(cand, a));
}
function findFreeSlot(w, h, ads) {
  for (let y = 0; y <= GRID - h; y += SNAP)
    for (let x = 0; x <= GRID - w; x += SNAP)
      if (fits({ x, y, w, h }, ads)) return { x, y };
  return null;
}

async function fetchBoardAds() {
  const { data, error } = await supabase.from("public_ads")
    .select("id,category,x,y,w,h,pixels,title,link,image_url,status");
  if (error) { console.error(error); return []; }
  return data || [];
}
const hasUpdate = (a) => a.pending_title != null || a.pending_link != null || a.pending_image_url != null;

/* ============================================================ */
export default function App() {
  const [view, setView] = useState("home");
  const [cat, setCat] = useState(null);
  const [boardAds, setBoardAds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);

  const reload = useCallback(async () => {
    if (!isConfigured) { setLoading(false); return; }
    setBoardAds(await fetchBoardAds());
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!isConfigured) { setLoading(false); return; }
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (event === "PASSWORD_RECOVERY") setView("reset");
    });
    reload();
    return () => sub.subscription.unsubscribe();
  }, [reload]);

  useEffect(() => {
    if (!session) { setIsAdmin(false); return; }
    supabase.rpc("is_admin").then(({ data }) => setIsAdmin(Boolean(data)));
  }, [session]);

  if (!isConfigured) return <Shell><SetupNeeded /></Shell>;

  const nav = {
    onHome: () => setView("home"),
    onTerms: () => setView("terms"),
    onPrivacy: () => setView("privacy"),
    onContact: () => setView("contact"),
    onAccount: () => setView(session ? "account" : "auth"),
    onAdmin: () => setView("admin"),
    onAuth: () => setView("auth"),
    onLogout: () => supabase.auth.signOut().then(() => setView("home")),
    onPickCat: (c) => { setCat(c); setView("board"); },
  };

  return (
    <Shell nav={nav} session={session} isAdmin={isAdmin} activeCat={view === "board" ? cat : null}>
      {loading ? <div className="center pad"><div className="spin" /></div>
        : view === "reset" ? <ResetPassword onDone={() => setView("home")} />
        : view === "auth" ? <AuthPage onAuthed={() => setView("account")} />
        : view === "terms" ? <Terms />
        : view === "privacy" ? <Privacy />
        : view === "contact" ? <Contact />
        : view === "account" ? (session ? <Account session={session} onChange={reload} /> : <AuthPage onAuthed={() => setView("account")} />)
        : view === "admin" ? <Admin session={session} isAdmin={isAdmin} onAuth={() => setView("auth")} />
        : view === "home" ? <Home ads={boardAds} onPick={(c) => { setCat(c); setView("board"); }} />
        : <Board cat={cat} ads={boardAds} session={session} onChange={reload} />}
    </Shell>
  );
}

function Shell({ children, nav = {}, session, isAdmin, activeCat }) {
  return (
    <div className="wm">
      <div className="topbar">
        <header className="hd">
          <button className="brand" onClick={nav.onHome}>
            <span className="logo-sq">מי<br />ומה</span>
          </button>
          <nav>
            <button className="ghost" onClick={nav.onHome}>בית</button>
            {isAdmin && <button className="ghost" onClick={nav.onAdmin}>ניהול</button>}
            {session ? <>
              <button className="ghost" onClick={nav.onAccount}>האזור שלי</button>
              <button className="ghost" onClick={nav.onLogout}>יציאה</button>
            </> : <button className="ghost solid" onClick={nav.onAuth}>התחברות</button>}
          </nav>
        </header>
        <div className="catbar">
          {CATEGORIES.map((c) => (
            <button key={c.id} className={"catchip" + (activeCat?.id === c.id ? " on" : "")}
              onClick={() => nav.onPickCat(c)} style={activeCat?.id === c.id ? { borderColor: c.color, color: c.color } : undefined}>
              <span>{c.icon}</span> {c.name}
            </button>
          ))}
        </div>
      </div>
      {children}
      <footer className="ft">
        <div className="ft-links">
          <button onClick={nav.onTerms}>תנאי שימוש</button><span>·</span>
          <button onClick={nav.onPrivacy}>מדיניות פרטיות</button><span>·</span>
          <button onClick={nav.onContact}>צור קשר</button>
        </div>
        <p><strong>מי ומה</strong> · ₪1 לפיקסל · תוקף מודעה: שנה לפחות · כל מודעה וכל עדכון עוברים אישור.</p>
      </footer>
    </div>
  );
}

function SetupNeeded() {
  return (
    <div className="center pad"><div className="card narrow">
      <h3>צריך לחבר את Supabase</h3>
      <pre className="code-block">VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...</pre>
      <p className="tiny muted">פרטים מלאים ב-README.md.</p>
    </div></div>
  );
}

/* ----------------------- אימות ----------------------- */
function AuthForm({ onAuthed, compact }) {
  const [mode, setMode] = useState("login"); // login | signup
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [pass, setPass] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [creds, setCreds] = useState(null); // {phone, pw}

  const sendWhatsApp = (ph, pw) => {
    const msg = `שלום! נפתח עבורך חשבון ב"מי ומה" 🎉\n\nפרטי הכניסה שלך:\n📱 טלפון: ${ph}\n🔑 סיסמה: ${pw}\n\nשמור/י הודעה זו. תוכל/י להתחבר באתר עם הפרטים האלה.`;
    window.open(`https://wa.me/${waNumber(ph)}?text=${encodeURIComponent(msg)}`, "_blank");
  };

  const go = async () => {
    setErr("");
    if (!validPhone(phone)) return setErr("מספר טלפון לא תקין (לדוגמה 050-1234567).");
    setBusy(true);
    try {
      if (mode === "login") {
        if (!pass) { setBusy(false); return setErr("יש להזין סיסמה."); }
        const { error } = await supabase.auth.signInWithPassword({ email: phoneEmail(phone), password: pass });
        if (error) throw error;
        onAuthed?.();
      } else {
        const pw = genPassword();
        const { data, error } = await supabase.auth.signUp({
          email: phoneEmail(phone), password: pw,
          options: { data: { phone: phone.trim(), name: name.trim() } },
        });
        if (error) throw error;
        if (!data.user || (data.user.identities && data.user.identities.length === 0)) throw new Error("exists");
        sendWhatsApp(phone, pw);     // שולח את הפרטים לוואטסאפ אוטומטית
        setCreds({ phone, pw });     // ומציג אותם גם על המסך
      }
    } catch (e) {
      const m = e.message || "";
      if (m.includes("Invalid login")) setErr("טלפון או סיסמה שגויים.");
      else if (m === "exists" || m.includes("already") || m.includes("registered")) setErr("המספר כבר רשום — נסה/י להתחבר.");
      else setErr(m || "שגיאה, נסה/י שוב.");
    } finally { setBusy(false); }
  };

  if (creds) {
    return (
      <div className={compact ? "" : "card narrow"}>
        <h3>החשבון נפתח! 🎉</h3>
        <p className="tiny muted">שלחנו את הפרטים לוואטסאפ שלך. שמור/י אותם:</p>
        <div className="creds">
          <div><span>טלפון</span><b dir="ltr">{creds.phone}</b></div>
          <div><span>סיסמה</span><b dir="ltr">{creds.pw}</b></div>
        </div>
        <button className="btn-line" onClick={() => sendWhatsApp(creds.phone, creds.pw)}>שליחה שוב לוואטסאפ</button>
        <button className="cta dark" onClick={() => onAuthed?.()}>המשך</button>
      </div>
    );
  }

  return (
    <div className={compact ? "" : "card narrow"}>
      <h3>{mode === "login" ? "התחברות" : "פתיחת חשבון"}</h3>
      <p className="tiny muted">
        {mode === "login" ? "מתחברים עם הטלפון והסיסמה שקיבלת בוואטסאפ." : "נרשמים עם מספר טלפון — סיסמה תיווצר ותישלח אליך לוואטסאפ אוטומטית."}
      </p>
      {mode === "signup" && (
        <label className="fl">שם<input value={name} onChange={(e) => setName(e.target.value)} placeholder="שם מלא / שם העסק" /></label>
      )}
      <label className="fl">טלפון<input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="050-1234567" dir="ltr" inputMode="tel"
        onKeyDown={(e) => e.key === "Enter" && go()} /></label>
      {mode === "login" && (
        <label className="fl">סיסמה<input value={pass} onChange={(e) => setPass(e.target.value)} dir="ltr" type="password"
          onKeyDown={(e) => e.key === "Enter" && go()} /></label>
      )}
      {err && <div className="warn err">{err}</div>}
      <button className="cta dark" disabled={busy} onClick={go}>
        {busy ? "..." : mode === "login" ? "כניסה" : "פתיחת חשבון ושליחה לוואטסאפ"}
      </button>
      <div className="auth-links">
        {mode === "login"
          ? <button onClick={() => { setMode("signup"); setErr(""); }}>אין לך חשבון? פתיחת חשבון</button>
          : <button onClick={() => { setMode("login"); setErr(""); }}>יש לך חשבון? התחברות</button>}
      </div>
      {mode === "login" && <p className="tiny muted" style={{ marginTop: 8, textAlign: "center" }}>שכחת סיסמה? פנה/י אלינו בעמוד ״צור קשר״.</p>}
    </div>
  );
}

function AuthPage({ onAuthed }) {
  return <main className="center pad"><AuthForm onAuthed={onAuthed} /></main>;
}

function ResetPassword({ onDone }) {
  const [pass, setPass] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState(false);
  const save = async () => {
    if (pass.length < 6) return setErr("סיסמה של 6 תווים לפחות.");
    setBusy(true); setErr("");
    const { error } = await supabase.auth.updateUser({ password: pass });
    setBusy(false);
    if (error) setErr(error.message); else setOk(true);
  };
  return (
    <main className="center pad"><div className="card narrow">
      <h3>בחירת סיסמה חדשה</h3>
      {ok ? <>
        <div className="warn ok-box">הסיסמה עודכנה ✅</div>
        <button className="cta dark" onClick={onDone}>המשך</button>
      </> : <>
        <label className="fl">סיסמה חדשה<input value={pass} onChange={(e) => setPass(e.target.value)} dir="ltr" type="password" /></label>
        {err && <div className="warn err">{err}</div>}
        <button className="cta dark" disabled={busy} onClick={save}>{busy ? "..." : "שמירה"}</button>
      </>}
    </div></main>
  );
}

/* ----------------------- בית ----------------------- */
function Home({ ads, onPick }) {
  const live = ads.filter((a) => a.status === "live");
  const totalSold = live.reduce((s, a) => s + a.pixels, 0);
  return (
    <main>
      <section className="hero">
        <p className="eyebrow">מי ומה — כולם כאן</p>
        <h1>תפסו את <span className="hl">המקום שלכם</span></h1>
        <p className="sub">בוחרים קטגוריה, תופסים פיקסלים, מעלים תמונה וקישור — ומופיעים לכולם. ₪1 לכל פיקסל.</p>
        <div className="stats">
          <div><b>{nis(totalSold)}</b><span>פיקסלים נמכרו</span></div>
          <div><b>{CATEGORIES.length}</b><span>קטגוריות</span></div>
          <div><b>1,000,000</b><span>פיקסלים לעמוד</span></div>
        </div>
      </section>
      <section className="cats">
        {CATEGORIES.map((c) => {
          const sold = live.filter((a) => a.category === c.id).reduce((s, a) => s + a.pixels, 0);
          const pct = Math.min(100, (sold / 1_000_000) * 100);
          return (
            <button key={c.id} className="cat" onClick={() => onPick(c)}>
              <span className="cat-ic" style={{ background: c.color + "1A", color: c.color }}>{c.icon}</span>
              <span className="cat-name">{c.name}</span>
              <span className="bar"><i style={{ width: pct + "%", background: c.color }} /></span>
              <span className="cat-meta">{pct.toFixed(pct < 1 ? 2 : 1)}% מלא · {nis(sold)}</span>
            </button>
          );
        })}
      </section>
    </main>
  );
}

/* ----------------------- פסיפס מקומות פנויים ----------------------- */
const PASTELS = ["#FBD5D5", "#FCE8C9", "#FAF3C5", "#D9F2D6", "#CCEFE7", "#CFE2FB", "#E2D8FB", "#F7D8EC", "#FBDCC6", "#D6EEF8"];
const CELLS = 100; // 100x100 תאים (תא = 100 פיקסל)

const SLOT_SIZES = [
  { w: 10, h: 10, pixels: 10000, wt: 1 },
  { w: 10, h: 5, pixels: 5000, wt: 2 }, { w: 5, h: 10, pixels: 5000, wt: 2 },
  { w: 5, h: 5, pixels: 2500, wt: 7 },
  { w: 5, h: 2, pixels: 1000, wt: 6 }, { w: 2, h: 5, pixels: 1000, wt: 3 },
  { w: 5, h: 1, pixels: 500, wt: 3 }, { w: 1, h: 5, pixels: 500, wt: 2 },
  { w: 2, h: 1, pixels: 200, wt: 3 }, { w: 1, h: 2, pixels: 200, wt: 2 },
  { w: 1, h: 1, pixels: 100, wt: 2 },
];

function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

// רשימת מקומות פנויים מגוונים לפריסה זורמת (יציבה לכל קטגוריה)
const SLOT_COUNT = 150;
function generateSlots(catId) {
  const rng = mulberry32(hashStr(catId));
  const totW = SLOT_SIZES.reduce((t, s) => t + s.wt, 0);
  const slots = [];
  for (let i = 0; i < SLOT_COUNT; i++) {
    let r = rng() * totW, pick = SLOT_SIZES[0];
    for (const s of SLOT_SIZES) { r -= s.wt; if (r <= 0) { pick = s; break; } }
    slots.push({ id: "s" + i, x: i, y: 0, w: pick.w * 10, h: pick.h * 10, pixels: pick.pixels });
  }
  return slots;
}
/* ----------------------- לוח קטגוריה ----------------------- */
function Board({ cat, ads, session, onChange }) {
  const catAds = ads.filter((a) => a.category === cat.id);
  const slots = useMemo(() => generateSlots(cat.id), [cat.id]);
  const live = catAds.filter((a) => a.status === "live");
  const sold = live.reduce((s, a) => s + a.pixels, 0);
  const pct = (sold / 1_000_000) * 100;
  const [buying, setBuying] = useState(null);

  const adAt = (slot) => catAds.find((a) => a.x === slot.x && a.y === slot.y);

  return (
    <main className="board-wrap full">
      <div className="board-head">
        <div>
          <h2><span className="ic" style={{ color: cat.color }}>{cat.icon}</span> {cat.name}</h2>
          <p className="muted">{nis(sold)} מתוך {nis(1_000_000)} פיקסלים · {pct.toFixed(2)}% מלא · בחר/י משבצת פנויה</p>
        </div>
      </div>

      <div className="board-tip-row">
        <p className="board-tip tiny muted">לוחצים על בלוק פנוי כדי לפרסם בו. הבלוקים הגדולים = יותר פיקסלים. גוללים למטה לעוד מקומות.</p>
      </div>

      <div className="flow-board">
        {slots.map((slot, i) => {
          const ad = adAt(slot);
          const cols = slot.w / 10, rows = slot.h / 10;
          if (ad) {
            return (
              <a key={slot.id} className={"tile ad " + (ad.status !== "live" ? "pend" : "")}
                href={ad.status === "live" ? ad.link : undefined}
                target="_blank" rel="noopener noreferrer nofollow"
                onClick={(e) => { if (ad.status !== "live") e.preventDefault(); }}
                title={ad.title}
                style={{ gridColumn: `span ${cols}`, gridRow: `span ${rows}`,
                  background: ad.image_url ? undefined : cat.color }}>
                {ad.image_url ? <img src={ad.image_url} alt={ad.title} /> : <span className="ad-lbl">{ad.title}</span>}
              </a>
            );
          }
          const big = slot.pixels >= 2500, mid = slot.pixels >= 1000, sm = slot.pixels >= 300;
          return (
            <button key={slot.id} className="tile slot" onClick={() => setBuying(slot)}
              title={`${slot.pixels.toLocaleString("he-IL")} פיקסלים · ${nis(slot.pixels)}`}
              style={{ gridColumn: `span ${cols}`, gridRow: `span ${rows}`, background: PASTELS[i % PASTELS.length] }}>
              {big ? (
                <span className="slot-lbl">
                  <b>אבחר מקום כאן</b>
                  <span>{slot.pixels.toLocaleString("he-IL")} פיקסלים</span>
                  <em>{nis(slot.pixels)}</em>
                </span>
              ) : mid ? (
                <span className="slot-lbl sm"><b>{slot.pixels.toLocaleString("he-IL")} פיקס׳</b><em>{nis(slot.pixels)}</em></span>
              ) : sm ? (
                <span className="slot-lbl xs">{nis(slot.pixels)}</span>
              ) : null}
            </button>
          );
        })}
      </div>

      {buying && (
        <SlotBuyModal slot={buying} cat={cat} session={session} ads={catAds}
          onClose={() => setBuying(null)} onDone={() => { setBuying(null); onChange(); }} />
      )}
    </main>
  );
}

/* ----------------------- קניית משבצת ----------------------- */
function SlotBuyModal({ slot, cat, session, ads, onClose, onDone }) {
  const [title, setTitle] = useState("");
  const [link, setLink] = useState("https://");
  const [phone, setPhone] = useState(session?.user?.user_metadata?.phone || "");
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [fileKey, setFileKey] = useState(0);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const linkCheck = link.length > 9 ? checkLink(link) : null;
  const price = slot.pixels * PRICE;
  const taken = ads.some((a) => a.x === slot.x && a.y === slot.y);

  const onFile = (e) => {
    const f = e.target.files?.[0]; if (!f) return; setErr("");
    if (!f.type.startsWith("image/")) return setErr("צריך קובץ תמונה.");
    if (f.size > 10 * 1024 * 1024) return setErr("עד 10MB.");
    setFile(f); setPreview(URL.createObjectURL(f));
  };
  const removeFile = () => { if (preview) URL.revokeObjectURL(preview); setFile(null); setPreview(null); setFileKey((k) => k + 1); };

  const submit = async () => {
    if (!session) return alert("צריך להתחבר כדי לפרסם.");
    if (taken) return alert("המקום נתפס בינתיים. בחר/י משבצת אחרת.");
    if (!file) return alert("צריך להעלות תמונה.");
    if (!linkCheck?.ok) return alert("הקישור אינו תקין.");
    if (waNumber(phone).length < 11) return alert("מספר טלפון לא תקין.");
    setBusy(true);
    try {
      const image_url = await uploadImage(await compressImage(file, slot.w, slot.h));
      const flags = [...(linkCheck.flags || []), ...checkText(title).map((w) => "מילה חסומה: " + w)];
      const { error } = await supabase.from("ads").insert({
        owner_id: session.user.id, category: cat.id, x: slot.x, y: slot.y, w: slot.w, h: slot.h,
        pixels: slot.pixels, title: title.trim() || cat.name, link, phone, image_url, status: "pending", flags,
      });
      if (error) throw error;
      setSent(true);
    } catch (e) { console.error(e); alert("שגיאה: " + (e.message || "נסה שוב")); }
    finally { setBusy(false); }
  };

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-x" onClick={onClose} aria-label="סגירה">×</button>
        {sent ? (
          <div style={{ textAlign: "center" }}>
            <h3>נשלח לאישור! ✅</h3>
            <p className="muted">ניצור איתך קשר בוואטסאפ עם קישור לתשלום של {nis(price)}.</p>
            <div className="warn ok-box">אפשר לעקוב, לערוך או לבטל בלשונית ״האזור שלי״.</div>
            <button className="cta dark" onClick={onDone}>סיום</button>
          </div>
        ) : (<>
          <h3 style={{ color: cat.color }}>{cat.icon} {cat.name}</h3>
          <div className="slot-summary">
            <b>{slot.pixels.toLocaleString("he-IL")} פיקסלים</b>
            <span className="tiny muted">{slot.w}×{slot.h} · ₪1 לפיקסל</span>
            <em>{nis(price)}</em>
          </div>

          {!session && (
            <div className="gate">
              <div className="warn ok-box">כדי לפרסם צריך חשבון — התחברי או הרשמי:</div>
              <AuthForm compact onAuthed={() => {}} />
              <hr className="sep" />
            </div>
          )}

          <label className="fl">כותרת קצרה
            <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={40} placeholder={`לדוגמה: ${cat.example || cat.name}`} /></label>
          <label className="fl">קישור
            <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://..." dir="ltr" /></label>
          {linkCheck && !linkCheck.ok && <div className="warn err">⛔ {linkCheck.flags.join(" · ")}</div>}
          {linkCheck?.ok && linkCheck.flags.length > 0 && <div className="warn">⚠️ לבדיקה: {linkCheck.flags.join(" · ")}</div>}
          <label className="fl">טלפון (וואטסאפ — לתיאום תשלום)
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="050-0000000" dir="ltr" inputMode="tel" /></label>
          <label className="fl">תמונה (תיכווץ ל-{slot.w}×{slot.h})
            <input key={fileKey} type="file" accept="image/*" onChange={onFile} /></label>
          {err && <div className="warn err">{err}</div>}
          {preview && <div className="preview">
            <img src={preview} alt="תצוגה" style={{ aspectRatio: slot.w / slot.h }} />
            <button type="button" className="img-remove" onClick={removeFile}>הסר ובחר תמונה אחרת</button>
          </div>}

          <div className="row2">
            <button className="btn-line ghost2" onClick={onClose}>ביטול</button>
            <button className="cta" style={{ background: cat.color }} disabled={busy || !session || !file || !linkCheck?.ok} onClick={submit}>
              {busy ? "שולח..." : "שליחה לאישור · " + nis(price)}
            </button>
          </div>
        </>)}
      </div>
    </div>
  );
}
/* ----------------------- האזור שלי (מפרסם) ----------------------- */
function Account({ session, onChange }) {
  const [ads, setAds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);

  const load = useCallback(async () => {
    const { data } = await supabase.from("ads").select("*")
      .eq("owner_id", session.user.id).order("created_at", { ascending: false });
    setAds(data || []); setLoading(false);
  }, [session]);
  useEffect(() => { load(); }, [load]);

  const remove = async (a) => {
    if (!confirm(`להסיר את המודעה "${a.title}"? המקום יתפנה ולא ניתן לשחזר.\n(החזר כספי אפשרי רק עד 14 יום מההזמנה.)`)) return;
    await supabase.rpc("remove_own_ad", { p_ad_id: a.id });
    load(); onChange?.();
  };

  if (editing) return <EditAd ad={editing} onDone={() => { setEditing(null); load(); }} />;

  const labelOf = (a) => a.status === "live" ? "באוויר" : a.status === "pending" ? "בבדיקה"
    : a.status === "awaiting_payment" ? "ממתין לתשלום" : a.status === "removed" ? "הוסרה" : a.status;

  return (
    <main className="account">
      <div className="board-head"><h2>האזור שלי</h2>
        <span className="tiny muted" dir="ltr">{session.user.email}</span></div>

      {loading ? <div className="center pad"><div className="spin" /></div>
        : ads.length === 0 ? <div className="card narrow center"><p className="muted">עוד אין לך מודעות. בחר/י קטגוריה כדי לפרסם.</p></div>
        : (
          <div className="my-list">
            {ads.map((a) => {
              const c = catById(a.category);
              const validUntil = a.published_at ? addYears(a.published_at, 1) : null;
              const refundUntil = addDays(a.created_at, 14);
              const refundable = new Date() < refundUntil && a.status !== "removed";
              return (
                <div className="my-card" key={a.id}>
                  <div className="my-img" style={{ aspectRatio: a.w / a.h }}>
                    {a.image_url ? <img src={a.image_url} alt="" /> : <span className="ad-lbl">{a.title}</span>}
                  </div>
                  <div className="my-body">
                    <div className="my-top">
                      <b>{a.title}</b>
                      <span className={"chip " + a.status}>{labelOf(a)}</span>
                    </div>
                    <span className="tiny muted">{c?.icon} {c?.name} · {a.pixels.toLocaleString("he-IL")} פיקסל · {nis(a.pixels)}</span>
                    {a.status === "live" && <span className="tiny muted">בתוקף עד {fmtDate(validUntil)}</span>}
                    {a.status !== "removed" && (
                      <span className={"tiny " + (refundable ? "ok-text" : "muted")}>
                        {refundable ? `ניתן לביטול בהחזר עד ${fmtDate(refundUntil)}` : "חלון הביטול (14 יום) הסתיים"}
                      </span>
                    )}
                    {hasUpdate(a) && <span className="tiny accent">יש עדכון שממתין לאישור</span>}
                  </div>
                  {a.status !== "removed" && (
                    <div className="my-act">
                      <button className="ok" onClick={() => setEditing(a)}>עריכה</button>
                      <button className="no" onClick={() => remove(a)}>הסרה</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
    </main>
  );
}

/* ----------------------- עריכת מודעה (חוזר לאישור) ----------------------- */
function EditAd({ ad, onDone }) {
  const c = catById(ad.category);
  const [title, setTitle] = useState(ad.title || "");
  const [link, setLink] = useState(ad.link || "");
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [fileKey, setFileKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState(false);

  const linkCheck = link.length > 9 ? checkLink(link) : null;
  const titleChanged = title.trim() && title.trim() !== (ad.title || "");
  const linkChanged = link && link !== (ad.link || "");
  const anyChange = titleChanged || linkChanged || file;

  const onFile = (e) => {
    const f = e.target.files?.[0]; if (!f) return; setErr("");
    if (!f.type.startsWith("image/")) return setErr("צריך קובץ תמונה.");
    if (f.size > 10 * 1024 * 1024) return setErr("עד 10MB.");
    setFile(f); setPreview(URL.createObjectURL(f));
  };
  const removeFile = () => {
    if (preview) URL.revokeObjectURL(preview);
    setFile(null); setPreview(null); setFileKey((k) => k + 1);
  };
  const submit = async () => {
    if (!anyChange) return alert("לא בוצע שינוי.");
    if (linkChanged && !linkCheck?.ok) return alert("הקישור אינו תקין.");
    setBusy(true);
    try {
      let image_url = null;
      if (file) image_url = await uploadImage(await compressImage(file, ad.w, ad.h));
      const { error } = await supabase.rpc("submit_ad_update", {
        p_ad_id: ad.id, p_title: titleChanged ? title.trim() : null,
        p_link: linkChanged ? link : null, p_image_url: image_url,
      });
      if (error) throw error; setDone(true);
    } catch (e) { console.error(e); alert("שגיאה: " + (e.message || "נסה שוב")); }
    finally { setBusy(false); }
  };

  if (done) return (
    <main className="center pad"><div className="card narrow center">
      <h3>השינוי נשלח לאישור ✅</h3>
      <p className="muted">המודעה הנוכחית נשארת באתר עד שהשינוי יאושר.</p>
      <button className="cta dark" onClick={onDone}>חזרה</button>
    </div></main>
  );

  return (
    <main className="board-wrap"><div className="card narrow">
      <h3>עריכת מודעה · {c?.icon} {c?.name}</h3>
      <p className="tiny muted">כל שינוי נשלח לאישור לפני שיתעדכן באתר.</p>
      {hasUpdate(ad) && <div className="warn">כבר יש שינוי שממתין לאישור — שליחה חדשה תחליף אותו.</div>}
      <div className="cur-ad"><span className="tiny muted">המודעה הנוכחית:</span>
        <div className="cur-img" style={{ aspectRatio: ad.w / ad.h }}>
          {ad.image_url ? <img src={ad.image_url} alt="" /> : <span className="ad-lbl">{ad.title}</span>}
        </div>
      </div>
      <label className="fl">כותרת<input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={40} /></label>
      <label className="fl">קישור<input value={link} onChange={(e) => setLink(e.target.value)} dir="ltr" /></label>
      {linkCheck && !linkCheck.ok && <div className="warn err">⛔ {linkCheck.flags.join(" · ")}</div>}
      <label className="fl">החלפת תמונה (אופציונלי)<input key={fileKey} type="file" accept="image/*" onChange={onFile} /></label>
      {err && <div className="warn err">{err}</div>}
      {preview && <div className="preview">
        <img src={preview} alt="" style={{ aspectRatio: ad.w / ad.h }} />
        <button type="button" className="img-remove" onClick={removeFile}>הסר ובחר תמונה אחרת</button>
      </div>}
      <div className="row2">
        <button className="btn-line ghost2" onClick={onDone}>ביטול</button>
        <button className="cta dark" disabled={busy || !anyChange} onClick={submit}>{busy ? "שולח..." : "שליחת שינוי לאישור"}</button>
      </div>
    </div></main>
  );
}

/* ----------------------- תנאי שימוש ----------------------- */
function Terms() {
  return (
    <main className="doc">
      <h1>תנאי שימוש</h1>
      <p className="muted tiny">עודכן לאחרונה: יוני 2026 · יש להחליף את הפרטים בסוגריים המרובעים בפרטי העסק שלך.</p>

      <h3>1. כללי</h3>
      <p>אתר "מי ומה" (להלן: "האתר"), המופעל על ידי [שם העסק / ח.פ. / ע.מ.], הוא פלטפורמה לרכישת שטחי פרסום (פיקסלים) והצגת תמונה וקישור בהם. השימוש באתר מהווה הסכמה לתנאים אלה.</p>

      <h3>2. אופי השירות</h3>
      <p>האתר משמש כמתווך בלבד להצגת מודעות, ואינו צד לכל עסקה בין מפרסם לצד שלישי. האתר אינו אחראי לתוכן, לאמינות, למוצרים או לשירותים המופיעים במודעות.</p>

      <h3>3. אחריות המפרסם</h3>
      <p>המפרסם אחראי באופן בלעדי לתוכן המודעה, ומצהיר כי הוא חוקי, אינו מפר זכויות יוצרים, סימני מסחר או כל זכות של צד שלישי, ואינו מטעה. המפרסם נושא באחריות מלאה לכל נזק שייגרם כתוצאה מהמודעה.</p>

      <h3>4. תכנים אסורים</h3>
      <p>אסור להעלות תוכן פוגעני, מיני, אלים, מפלה, בלתי חוקי, מטעה, או קישורים זדוניים. [שם העסק] רשאי לסרב, להסיר או לערוך כל מודעה לפי שיקול דעתו הבלעדי וללא צורך בנימוק.</p>

      <h3>5. אישור, תשלום ועדכונים</h3>
      <p>כל מודעה וכל עדכון למודעה קיימת כפופים לאישור מראש. מודעה תפורסם רק לאחר אישור התוכן והשלמת התשלום במלואו. שינוי במודעה קיימת לא ייכנס לתוקף עד לאישורו, והמודעה הקודמת תמשיך להופיע עד אז.</p>

      <h3>6. תוקף המודעה</h3>
      <p>תוקף מודעה שפורסמה הוא <b>שנה אחת לפחות</b> ממועד פרסומה, אלא אם המפרסם בחר מרצונו להסיר את המודעה ולוותר על המקום. הסרה יזומה על ידי המפרסם משחררת את שטח הפרסום לאחרים.</p>

      <h3>7. ביטול והחזר כספי</h3>
      <p>ניתן לבטל את ההזמנה ולקבל החזר כספי <b>עד 14 יום ממועד ההזמנה</b>. לאחר 14 יום לא יינתן החזר. ביטול והחזר בכפוף לחוק הגנת הצרכן, התשמ"א-1981.</p>

      <h3>8. הגבלת אחריות</h3>
      <p>השירות ניתן כפי שהוא ("AS IS"). [שם העסק] לא יישא באחריות לכל נזק ישיר או עקיף שייגרם משימוש באתר או מהסתמכות על מודעות המופיעות בו.</p>

      <h3>9. שיפוט</h3>
      <p>על תנאים אלה יחולו דיני מדינת ישראל, וסמכות השיפוט הבלעדית נתונה לבתי המשפט המוסמכים ב[עיר].</p>

      <p className="muted tiny doc-note">⚠️ מסמך זה הוא תבנית בסיסית ואינו ייעוץ משפטי. מומלץ שעו"ד יעבור עליו ויתאים אותו לעסק שלך לפני תחילת גבייה.</p>
    </main>
  );
}

/* ----------------------- מדיניות פרטיות ----------------------- */
function Privacy() {
  return (
    <main className="doc">
      <h1>מדיניות פרטיות</h1>
      <p className="muted tiny">עודכן לאחרונה: יוני 2026 · יש להחליף את הפרטים בסוגריים המרובעים בפרטי העסק שלך.</p>

      <h3>1. כללי</h3>
      <p>מדיניות זו מסבירה כיצד אתר "מי ומה", המופעל על ידי [שם העסק / ח.פ.] (להלן: "אנחנו"), אוסף ומשתמש במידע אישי. אנו פועלים בהתאם לחוק הגנת הפרטיות, התשמ"א-1981. השימוש באתר מהווה הסכמה למדיניות זו.</p>

      <h3>2. איזה מידע נאסף</h3>
      <p>בעת פתיחת חשבון ופרסום מודעה נאספים: כתובת אימייל, מספר טלפון, ותוכן המודעה (תמונה, כותרת וקישור). כמו כן נאסף מידע טכני בסיסי הנדרש לתפעול האתר (כגון כתובת IP ונתוני התחברות).</p>

      <h3>3. למה משתמשים במידע</h3>
      <p>המידע משמש לניהול החשבון, להצגת המודעות באתר, ליצירת קשר לצורך אישור ותיאום תשלום (כולל בוואטסאפ), ולמתן תמיכה. לא נעשה שימוש במידע למטרות שלא פורטו כאן ללא הסכמתך.</p>

      <h3>4. שיתוף עם צדדים שלישיים</h3>
      <p>איננו מוכרים מידע אישי. המידע מאוחסן ומעובד אצל ספקי שירות הדרושים לתפעול האתר, ובהם [Supabase] (מסד נתונים ואחסון), [Vercel] (אירוח), ו-[Grow] (סליקת תשלומים). ספקים אלה כפופים להתחייבויות אבטחה ופרטיות. מידע עשוי להימסר אם נידרש לכך על פי דין.</p>

      <h3>5. עוגיות ומידע טכני</h3>
      <p>האתר עושה שימוש באמצעי אחסון בדפדפן הנדרשים לשמירת ההתחברות שלך ולתפעול תקין. אין שימוש בעוגיות פרסום או מעקב של צד שלישי.</p>

      <h3>6. אבטחת מידע</h3>
      <p>אנו נוקטים אמצעים סבירים להגנה על המידע, לרבות הצפנה ובקרת הרשאות. עם זאת, אין באפשרותנו להבטיח הגנה מוחלטת מפני כל סיכון.</p>

      <h3>7. זכויותיך</h3>
      <p>הנך זכאי לעיין במידע אודותיך, לתקנו או לבקש את מחיקתו. ניתן לערוך ולהסיר מודעות ישירות ב"האזור שלי", או לפנות אלינו בכל בקשה הנוגעת למידע האישי שלך.</p>

      <h3>8. שמירת מידע</h3>
      <p>אנו שומרים את המידע כל עוד החשבון פעיל וכנדרש לצרכים חוקיים, חשבונאיים ותפעוליים. לאחר מכן המידע יימחק או יונפק.</p>

      <h3>9. יצירת קשר</h3>
      <p>בכל שאלה בנושא פרטיות ניתן לפנות אל [{CONTACT.email}] או בטלפון [{CONTACT.phone}].</p>

      <h3>10. שינויים</h3>
      <p>אנו רשאים לעדכן מדיניות זו מעת לעת. הגרסה העדכנית תפורסם בעמוד זה.</p>

      <p className="muted tiny doc-note">⚠️ מסמך זה הוא תבנית בסיסית ואינו ייעוץ משפטי. מומלץ שעו"ד יעבור עליו ויתאים אותו לעסק שלך ולדרישות הדין לפני תחילת הפעילות.</p>
    </main>
  );
}

/* ----------------------- צור קשר ----------------------- */
function Contact() {
  const wa = waNumber(CONTACT.phone);
  return (
    <main className="doc">
      <h1>צור קשר</h1>
      <p>יש שאלה על פרסום, תשלום או מודעה קיימת? נשמח לעזור.</p>
      <div className="contact-card">
        <div className="ci"><span>אימייל</span><a href={`mailto:${CONTACT.email}`} dir="ltr">{CONTACT.email}</a></div>
        <div className="ci"><span>טלפון</span><a href={`tel:${CONTACT.phone}`} dir="ltr">{CONTACT.phone}</a></div>
      </div>
      <a className="cta wa-cta" href={`https://wa.me/${wa}`} target="_blank" rel="noopener noreferrer">שלח/י הודעה בוואטסאפ</a>
      <p className="tiny muted">לעריכה, ביטול ושחזור סיסמה — היכנס/י ל"האזור שלי".</p>
    </main>
  );
}

/* ----------------------- ניהול ----------------------- */
function Admin({ session, isAdmin, onAuth }) {
  if (!session) {
    return <main className="center pad"><div className="card narrow center">
      <h3>אזור ניהול</h3><p className="muted">צריך להתחבר עם חשבון המנהלת.</p>
      <button className="cta dark" onClick={onAuth}>להתחברות</button></div></main>;
  }
  if (!isAdmin) {
    return <main className="center pad"><div className="card narrow center">
      <h3>אין הרשאת ניהול</h3>
      <p className="muted">החשבון הזה אינו מוגדר כמנהל. ודאי שהאימייל קיים בטבלת admins ב-Supabase.</p></div></main>;
  }
  return <AdminQueue />;
}

function AdminPwReset() {
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const reset = async () => {
    setMsg(null);
    if (waNumber(phone).length < 11) return setMsg({ err: "מספר טלפון לא תקין." });
    setBusy(true);
    const pw = genPassword();
    const { data, error } = await supabase.rpc("admin_reset_password", { target_email: phoneEmail(phone), new_password: pw });
    setBusy(false);
    if (error) return setMsg({ err: error.message.includes("not authorized") ? "אין הרשאת ניהול." : error.message });
    if (!data) return setMsg({ err: "לא נמצא משתמש עם הטלפון הזה." });
    setMsg({ pw });
    const m = `הסיסמה שלך ב"מי ומה" אופסה 🔑\n📱 טלפון: ${phone}\n🔑 סיסמה חדשה: ${pw}\n\nאפשר להתחבר עכשיו עם הפרטים האלה.`;
    window.open(`https://wa.me/${waNumber(phone)}?text=${encodeURIComponent(m)}`, "_blank");
  };
  return (
    <div className="card pw-reset">
      <h3>🔑 שחזור סיסמה למשתמש</h3>
      <p className="tiny muted">מזינים טלפון של משתמש → נוצרת סיסמה חדשה אוטומטית ונשלחת אליו לוואטסאפ.</p>
      <div className="pw-row">
        <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="050-1234567" dir="ltr" inputMode="tel" />
        <button className="cta dark" disabled={busy} onClick={reset}>{busy ? "..." : "איפוס ושליחה"}</button>
      </div>
      {msg?.err && <div className="warn err">{msg.err}</div>}
      {msg?.pw && <div className="warn ok-box">סיסמה חדשה: <b dir="ltr">{msg.pw}</b> · נשלחה לוואטסאפ של המשתמש.</div>}
    </div>
  );
}

function AdminQueue() {
  const [ads, setAds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("pending");

  const load = useCallback(async () => {
    const { data } = await supabase.from("ads").select("*").order("created_at", { ascending: false });
    setAds(data || []); setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const setStatus = async (a, status, extra = {}) => {
    await supabase.from("ads").update({ status, ...extra }).eq("id", a.id); load();
  };
  const publish = (a) => setStatus(a, "live", a.published_at ? {} : { published_at: new Date().toISOString() });

  const remove = async (a) => {
    if (!confirm(`למחוק לצמיתות את "${a.title}"?`)) return;
    await deleteImageByUrl(a.image_url); await deleteImageByUrl(a.pending_image_url);
    await supabase.from("ads").delete().eq("id", a.id); load();
  };
  const approveUpdate = async (a) => {
    const apply = { pending_title: null, pending_link: null, pending_image_url: null };
    if (a.pending_title != null) apply.title = a.pending_title;
    if (a.pending_link != null) apply.link = a.pending_link;
    if (a.pending_image_url != null) apply.image_url = a.pending_image_url;
    await supabase.from("ads").update(apply).eq("id", a.id);
    if (a.pending_image_url && a.image_url && a.pending_image_url !== a.image_url) await deleteImageByUrl(a.image_url);
    load();
  };
  const rejectUpdate = async (a) => {
    await deleteImageByUrl(a.pending_image_url);
    await supabase.from("ads").update({ pending_title: null, pending_link: null, pending_image_url: null }).eq("id", a.id);
    load();
  };
  const whatsapp = (a) => {
    const c = catById(a.category);
    const msg = `שלום! המודעה שלך ב"מי ומה" (${c?.name}) אושרה 🎉\nלתשלום של ${nis(a.pixels * PRICE)} עבור ${a.pixels.toLocaleString("he-IL")} פיקסלים — הנה קישור התשלום:\n[הדבק/י כאן את קישור Grow]\n\nלאחר התשלום המודעה תעלה. תודה!`;
    window.open(`https://wa.me/${waNumber(a.phone)}?text=${encodeURIComponent(msg)}`, "_blank");
  };

  const isUpd = (a) => a.status === "live" && hasUpdate(a);
  const counts = {
    pending: ads.filter((a) => a.status === "pending").length,
    awaiting_payment: ads.filter((a) => a.status === "awaiting_payment").length,
    updates: ads.filter(isUpd).length,
    live: ads.filter((a) => a.status === "live").length,
    removed: ads.filter((a) => a.status === "removed").length,
  };
  const list = tab === "updates" ? ads.filter(isUpd) : ads.filter((a) => a.status === tab);
  const TABS = [["pending", "לבדיקה"], ["awaiting_payment", "ממתין לתשלום"], ["updates", "עדכונים"], ["live", "באוויר"], ["removed", "הוסרו"]];

  return (
    <main className="admin">
      <div className="board-head"><h2>אזור ניהול</h2></div>
      <AdminPwReset />
      <div className="seg wide scroll">
        {TABS.map(([k, label]) => (
          <button key={k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>{label} <i className="cnt">{counts[k]}</i></button>
        ))}
      </div>

      {loading ? <div className="center pad"><div className="spin" /></div>
        : list.length === 0 ? <div className="card narrow center"><p className="muted">אין מודעות כאן 🎉</p></div>
        : tab === "updates" ? (
          <div className="queue">{list.map((a) => {
            const c = catById(a.category);
            return (
              <div className="qcard" key={a.id}>
                <div className="diff">
                  <div className="diff-col"><span className="tiny muted">נוכחי</span>
                    <div className="qimg sm" style={{ aspectRatio: a.w / a.h }}>
                      {a.image_url ? <img src={a.image_url} alt="" /> : <span className="ad-lbl">{a.title}</span>}</div></div>
                  <div className="diff-arrow">←</div>
                  <div className="diff-col"><span className="tiny accent">מבוקש</span>
                    <div className="qimg sm" style={{ aspectRatio: a.w / a.h }}>
                      {(a.pending_image_url || a.image_url) ? <img src={a.pending_image_url || a.image_url} alt="" />
                        : <span className="ad-lbl">{a.pending_title || a.title}</span>}</div></div>
                </div>
                <div className="qbody">
                  <span className="tiny muted">{c?.icon} {c?.name}</span>
                  {a.pending_title != null && <span className="tiny">כותרת: <b>{a.pending_title}</b></span>}
                  {a.pending_link != null && <a className="qlink" href={a.pending_link} target="_blank" rel="noopener noreferrer nofollow" dir="ltr">{a.pending_link}</a>}
                  {a.pending_image_url != null && <span className="tiny">התמונה הוחלפה</span>}
                </div>
                <div className="qact">
                  <button className="ok" onClick={() => approveUpdate(a)}>אשר עדכון</button>
                  <button className="no" onClick={() => rejectUpdate(a)}>דחה</button>
                </div>
              </div>
            );
          })}</div>
        ) : (
          <div className="queue">{list.map((a) => {
            const c = catById(a.category);
            const refundUntil = addDays(a.created_at, 14);
            const refundable = new Date() < refundUntil;
            return (
              <div className="qcard" key={a.id}>
                <div className="qimg" style={{ aspectRatio: a.w / a.h }}>
                  {a.image_url ? <img src={a.image_url} alt="" /> : <span className="ad-lbl">{a.title}</span>}
                </div>
                <div className="qbody">
                  <b>{a.title}</b>
                  <span className="tiny muted">{c?.icon} {c?.name} · {a.pixels.toLocaleString("he-IL")} פיקסל · {nis(a.pixels)}</span>
                  <a className="qlink" href={a.link} target="_blank" rel="noopener noreferrer nofollow" dir="ltr">{a.link}</a>
                  <span className="tiny muted" dir="ltr">☎ {a.phone}</span>
                  <span className="tiny muted">הוזמן: {fmtDate(a.created_at)}{a.published_at ? ` · פורסם: ${fmtDate(a.published_at)}` : ""}</span>
                  {(tab === "awaiting_payment" || tab === "live") &&
                    <span className={"tiny " + (refundable ? "ok-text" : "muted")}>{refundable ? `בחלון החזר (עד ${fmtDate(refundUntil)})` : "מחוץ לחלון ההחזר"}</span>}
                  {a.flags?.length > 0 && <div className="warn">⚠️ {a.flags.join(" · ")}</div>}
                  {isUpd(a) && <div className="warn ok-box">יש עדכון בלשונית "עדכונים"</div>}
                </div>
                <div className="qact">
                  {a.status === "pending" && <>
                    <button className="ok" onClick={() => setStatus(a, "awaiting_payment")}>אישור תוכן</button>
                    <button className="no" onClick={() => remove(a)}>דחייה</button></>}
                  {a.status === "awaiting_payment" && <>
                    <button className="wa" onClick={() => whatsapp(a)}>שלח לתשלום</button>
                    <button className="ok" onClick={() => publish(a)}>שולם · העלה</button>
                    <button className="no" onClick={() => remove(a)}>בטל</button></>}
                  {a.status === "live" && <>
                    <button className="wa" onClick={() => whatsapp(a)}>וואטסאפ</button>
                    <button className="no" onClick={() => remove(a)}>הסר</button></>}
                  {a.status === "removed" && <button className="no" onClick={() => remove(a)}>מחק לצמיתות</button>}
                </div>
              </div>
            );
          })}</div>
        )}
    </main>
  );
}
