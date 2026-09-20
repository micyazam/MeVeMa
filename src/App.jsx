import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { supabase, isConfigured } from "./supabaseClient";

/* ============================================================
   מי ומה — שטחי פרסום בפיקסלים · ₪1 לפיקסל · שטח פרסום מ-₪100
   ============================================================ */

const GRID = 1000, SNAP = 10, PRICE = 1, BUCKET = "ad-images";

/* >>> פרטי קשר <<< */
const CONTACT = { email: "Metaplim.info@gmail.com", phone: "050-9990449", whatsapp: "051-5003870", company: "מי ומה", owner: "מיכל ילוז" };
/* קישור תשלום מאובטח (Grow) */
const PAY_LINK = "https://pay.grow.link/MTM0OTA~83ec0fabecf56858a2ecaa31635c211c-Mzc1MzU5Mw";
/* תוקף מודעה */
const VALIDITY_TEXT = "תוקף המודעה: ללא הגבלת זמן · מובטח מינימום 3 שנים · ניתן לעדכן את המודעה בכל עת";
/* חלון החזר כספי (ימים) */
const REFUND_DAYS = 21;

/* הקטגוריות — שני עולמות: "מי" (האנשים) ו"מה" (הדברים). ה-id נשאר קבוע כדי לא לשבור מודעות קיימות */
const CATEGORIES = [
  // ——— עולם ה"מי" — האנשים ———
  { id: "celebs", slug: "פרסום-ליוצרים-ומשפיענים",     group: "mi", name: "הכוכבים",   icon: "⭐",  color: "#C026D3", desc: "יוצרים, משפיענים ואמנים",            example: "עקבו אחרי היוצר הבא של ישראל", seo: "פרסום ליוצרים, משפיענים ואמנים שרוצים להגדיל חשיפה ועוקבים. שטח פרסום קבוע לפרופיל, לערוץ או למותג האישי שלכם — במקום קמפיינים שנעלמים, נוכחות שנשארת." },
  { id: "publicfig", slug: "פרסום-לנבחרי-ציבור",  group: "mi", name: "המשפיעים",  icon: "🏛️", color: "#1D4ED8", desc: "נבחרי ציבור ומובילי דעה",            example: "חבר/ת מועצה — כאן בשבילכם", seo: "פרסום לנבחרי ציבור, מועמדים ומובילי דעה. שטח פרסום שמחבר את הקהל שלכם לעמוד, למצע או לערוץ הקשר — נוכחות דיגיטלית קבועה לאורך זמן." },
  { id: "founders", slug: "פרסום-לסטארטאפים-ויזמים",   group: "mi", name: "היזמים",    icon: "💡",  color: "#E11D48", desc: "סטארטאפים, מייסדים ואנשי עסקים",    example: "הסטארטאפ הבא של ישראל", seo: "פרסום לסטארטאפים, יזמים ומייסדים. שטחי פרסום להשקת מיזם, לגיוס משתמשים ראשונים או להצגת החברה — כי מי שמקדים, בולט." },
  { id: "experts", slug: "פרסום-לעורכי-דין-ויועצים",    group: "mi", name: "המומחים",   icon: "⚖️",  color: "#0F766E", desc: "עורכי דין, רואי חשבון ויועצים",     example: "המומחה שיפתור לכם את זה", seo: "פרסום לעורכי דין, רואי חשבון ויועצים. שטח פרסום מקצועי שמוביל ישירות לאתר או לוואטסאפ שלכם — דרך משתלמת לפרסום מומחים ובעלי מקצוע." },
  { id: "athletes", slug: "פרסום-לספורט-וכושר",   group: "mi", name: "הספורטאים", icon: "🏅",  color: "#16A34A", desc: "ספורט, כושר ואורח חיים בריא",       example: "המאמן שישנה לכם את הגוף", seo: "פרסום למאמני כושר, סטודיואים, חוגים ומותגי ספורט. שטחי פרסום לעולם הספורט ואורח החיים הבריא — הלקוח הבא שלכם כבר מחפש אתכם." },
  { id: "celebrating", slug: "ברכות-ואירועים",group: "mi", name: "החוגגים",   icon: "🎉",  color: "#DB2777", desc: "ברכות, הצעות ואירועים מיוחדים",     example: "מזל טוב! חוגגים כאן לכולם", seo: "ברכות, הצעות נישואין, ימי הולדת ואירועים — שטח פרסום שהוא גם מתנה. הפתעה שנשארת באוויר שנים, עם תעודת בעלות מעוצבת לשיתוף." },
  { id: "jobs", slug: "פרסום-משרות-וגיוס",       group: "mi", name: "המגייסים",  icon: "🤝",  color: "#6366F1", desc: "משרות, גיוסים ואנשים מוכשרים",       example: "המשרה הבאה שלך מחכה כאן", seo: "פרסום משרות וגיוס עובדים. שטח פרסום לחברות שמגייסות ולמעסיקים שמחפשים כישרונות — מודעת דרושים שלא נקברת בפיד אחרי יום." },
  { id: "courses", slug: "פרסום-קורסים-ולימודים",    group: "mi", name: "המלמדים",   icon: "🧠",  color: "#14B8A6", desc: "ידע, קורסים והשראה",                 example: "הקורס שישנה לכם את הקריירה", seo: "פרסום לקורסים, מרצים ובתי ספר. שטחי פרסום לעולם הידע וההכשרה — הדרך להביא תלמידים חדשים בלי תקציב פרסום חודשי." },
  // ——— עולם ה"מה" — הדברים ———
  { id: "realestate", slug: "פרסום-נדלן", group: "ma", name: "הבית",      icon: "🏠",  color: "#7C3AED", desc: "נדל\"ן ומגורים",                     example: "דירות חדשות בחיפה", seo: "פרסום נדל״ן: פרויקטים, מתווכים ודירות למכירה ולהשכרה. שטח פרסום קבוע לנכסים שלכם — חלופה משתלמת לפרסום נדל״ן יקר." },
  { id: "auto", slug: "פרסום-רכב",       group: "ma", name: "הדרך",      icon: "🚗",  color: "#4F46E5", desc: "רכב ותחבורה",                        example: "טויוטה קורולה 2023", seo: "פרסום רכב: סוכנויות, מגרשים, מוסכים ואביזרים. שטחי פרסום לעולם הרכב והתחבורה במחיר של פעם אחת — בלי עלות חודשית." },
  { id: "food", slug: "פרסום-מסעדות-ואוכל",       group: "ma", name: "הטעם",      icon: "🍔",  color: "#DB2777", desc: "אוכל, מסעדות וחוויות קולינריות",     example: "המסעדה שכולם מדברים עליה", seo: "פרסום למסעדות, בתי קפה, קייטרינג ומעדניות. שטח פרסום שמוביל ישירות לתפריט או להזמנת מקום — פרסום אוכל שעובד בשבילכם מסביב לשעון." },
  { id: "pharm", slug: "פרסום-יופי-וטיפוח",      group: "ma", name: "היופי",     icon: "✨",  color: "#EC4899", desc: "ביוטי, טיפוח ובריאות",               example: "מוצרי טיפוח וקוסמטיקה", seo: "פרסום לעולם היופי: קוסמטיקאיות, מספרות, קליניקות אסתטיקה ומותגי טיפוח. שטחי פרסום לביוטי ובריאות שמביאים לקוחות חדשים." },
  { id: "cellular", slug: "פרסום-טכנולוגיה-וגאדגטים",   group: "ma", name: "החדשנות",   icon: "📱",  color: "#0D9488", desc: "טכנולוגיה וגאדג'טים",                example: "הגאדג'ט שאסור לפספס", seo: "פרסום לטכנולוגיה וגאדג'טים: חנויות סלולר, מעבדות תיקון ומוצרי חדשנות. שטח פרסום לעסקים שחיים את הדיגיטל." },
  { id: "vacation", slug: "פרסום-תיירות-ונופש",   group: "ma", name: "החופש",     icon: "🌍",  color: "#0EA5E9", desc: "נופש, טיולים והרפתקאות",             example: "חבילת נופש ביוון", seo: "פרסום לתיירות ונופש: צימרים, מלונות, סוכני נסיעות וחוויות. שטחי פרסום שמזמינים את החופשה הבאה — נוכחות קבועה לעסק התיירותי שלכם." },
  { id: "fashion", slug: "פרסום-אופנה",    group: "ma", name: "הסטייל",    icon: "👗",  color: "#A21CAF", desc: "אופנה ועיצוב",                       example: "קולקציית קיץ חדשה", seo: "פרסום אופנה: מעצבים, בוטיקים וחנויות אונליין. שטח פרסום לקולקציה שלכם — במה קבועה במקום מודעה חולפת." },
  { id: "finance", slug: "פרסום-פיננסים-וביטוח",    group: "ma", name: "הכלכלה",    icon: "💎", color: "#7E22CE", desc: "פיננסים, ביטוח והשקעות",             example: "ביטוח רכב משתלם", seo: "פרסום לפיננסים וביטוח: סוכני ביטוח, יועצי משכנתאות והשקעות. שטחי פרסום לעולם הכלכלה שבונים אמון ונוכחות לאורך שנים." },
  { id: "websites", slug: "פרסום-דיגיטל-ואתרים",   group: "ma", name: "הדיגיטל",   icon: "🚀",  color: "#6D28D9", desc: "אתרים, AI ומיזמים",                  example: "בניית אתרים בעזרת AI", seo: "פרסום לעולם הדיגיטל: בוני אתרים, סוכנויות, מפתחי AI ומיזמים. שטח פרסום במקום שבו כולם מחפשים את הדבר הבא." },
  { id: "luxury", slug: "פרסום-מותגי-יוקרה",     group: "ma", name: "היוקרה",    icon: "💍",  color: "#9333EA", desc: "תכשיטים, שעונים ומותגי יוקרה",       example: "הטבעת שהיא חיכתה לה", seo: "פרסום למותגי יוקרה: תכשיטים, שעונים ומוצרי פרימיום. שטחי פרסום לקהל שמחפש את המיוחד — כי יוקרה מגיעה עם נוכחות." },
];
const GROUPS = [
  { id: "mi", title: "מי", sub: "האנשים — מי שמוביל, יוצר, מלמד ומשפיע" },
  { id: "ma", title: "מה", sub: "הדברים — מה שאנחנו בונים, טועמים, לובשים וחולמים" },
];
/* קטגוריה-מדומה לעמוד מותג: מודעות של מותג נשמרות בקטגוריה "brand:<id>" */
const isBrandCat = (c) => String(c || "").startsWith("brand:");
const brandCat = (b) => ({ id: "brand:" + b.id, name: b.name, icon: "🏢", color: "#53196E", desc: b.tagline || "עמוד מיליון · שטח פרסום ארגוני", slug: null, brand: b });
let BRAND_REGISTRY = [];
const catById = (id) => CATEGORIES.find((c) => c.id === id) || (isBrandCat(id) ? (() => { const b = BRAND_REGISTRY.find((x) => "brand:" + x.id === id); return b ? brandCat(b) : null; })() : undefined);

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
  // סיסמה פשוטה וידידותית: 6 ספרות (הראשונה לא 0 כדי למנוע בלבול)
  let p = String(1 + Math.floor(Math.random() * 9));
  for (let i = 0; i < 5; i++) p += Math.floor(Math.random() * 10);
  return p;
}

function compressImage(file, w, h) {
  return new Promise((res, rej) => {
    const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => {
      // שומרים על היחס המדויק של המשבצת: מקטינים את שני הצדדים באותו פקטור
      const scale = 6, cap = 960;
      let cw = Math.round(w * scale), ch = Math.round(h * scale);
      const f = Math.min(1, cap / Math.max(cw, ch));
      cw = Math.max(1, Math.round(cw * f)); ch = Math.max(1, Math.round(ch * f));
      const c = document.createElement("canvas"); c.width = cw; c.height = ch;
      const ctx = c.getContext("2d"), ar = img.width / img.height, car = cw / ch;
      let sx, sy, sw, sh;
      if (ar > car) { sh = img.height; sw = sh * car; sx = (img.width - sw) / 2; sy = 0; }
      else { sw = img.width; sh = sw / car; sx = 0; sy = (img.height - sh) / 2; }
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, cw, ch);
      URL.revokeObjectURL(url);
      c.toBlob((b) => (b ? res(b) : rej(new Error("blob"))), "image/jpeg", 0.82);
    };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error("img")); };
    img.src = url;
  });
}
/* תעודת בעלות דיגיטלית על שטח פרסום — נוצרת בדפדפן ומורדת כתמונה לשיתוף */
function downloadCertificate(a, c, rank, brand = false) {
  const W = 1200, H = 850;
  const cv = document.createElement("canvas"); cv.width = W; cv.height = H;
  const x = cv.getContext("2d");
  const PUR = "#53196E", INK = "#2D1851", SOFT = "#8470A0", FUCH = "#C026D3";
  const rr = (px, py, pw, ph, r) => { x.beginPath(); if (x.roundRect) x.roundRect(px, py, pw, ph, r); else x.rect(px, py, pw, ph); };
  // רקע
  const g = x.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, "#FBF8FE"); g.addColorStop(1, "#EEE4F8");
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  // מסגרות
  x.strokeStyle = PUR; x.lineWidth = 10; x.strokeRect(28, 28, W - 56, H - 56);
  x.strokeStyle = FUCH; x.lineWidth = 1.5; x.strokeRect(46, 46, W - 92, H - 92);
  x.strokeStyle = PUR; x.lineWidth = 2; x.strokeRect(54, 54, W - 108, H - 108);
  // פסי פאזל — ריבועי פיקסלים צבעוניים למעלה ולמטה
  const sq = 16, gap = 6, count = Math.floor((W - 200) / (sq + gap));
  const seed = hashStr(a.title + a.x); const rngC = mulberry32(seed);
  for (let i = 0; i < count; i++) {
    const px = 100 + i * (sq + gap);
    x.fillStyle = PASTELS[Math.floor(rngC() * PASTELS.length)];
    rr(px, 74, sq, sq, 4); x.fill();
    x.fillStyle = PASTELS[Math.floor(rngC() * PASTELS.length)];
    rr(px, H - 90, sq, sq, 4); x.fill();
  }
  // לוגו מי ומה
  const L = 86, lx = W / 2 - L / 2, ly = 116;
  x.fillStyle = PUR; rr(lx, ly, L, L, 20); x.fill();
  x.fillStyle = "#fff"; x.textAlign = "center"; x.direction = "rtl";
  x.font = "800 26px Rubik, sans-serif";
  x.fillText("מי", W / 2, ly + 36);
  x.fillText("ומה", W / 2, ly + 68);
  // כותרות
  x.fillStyle = PUR;
  x.font = "800 24px Rubik, sans-serif";
  x.fillText("מי ומה · משחק המיליון", W / 2, 236);
  x.font = "900 62px Rubik, sans-serif";
  x.fillText("תעודת בעלות", W / 2, 302);
  x.font = "700 27px Rubik, sans-serif";
  x.fillText(brand ? `על עמוד מיליון שלם ב"מי ומה" — שטח פרסום ארגוני` : `על שטח פרסום ב"מי ומה" — שטחי הפרסום של ישראל`, W / 2, 342);
  // קו מפריד עדין
  x.strokeStyle = FUCH; x.lineWidth = 2;
  x.beginPath(); x.moveTo(W / 2 - 90, 362); x.lineTo(W / 2 + 90, 362); x.stroke();
  // שם בעל השטח
  x.fillStyle = INK; x.font = "900 48px Rubik, sans-serif";
  x.fillText(a.title, W / 2, 424);
  // צ'יפ פרטי השטח
  const chipTxt = brand ? `🏢 עמוד מותג · 1,000,000 פיקסלים` : `${c?.icon || "🧩"} קטגוריית ${c?.name || ""} · שטח פרסום מס' ${a.x}`;
  x.font = "700 26px Rubik, sans-serif";
  const tw = x.measureText(chipTxt).width + 56;
  x.fillStyle = "#EFE7F9"; rr(W / 2 - tw / 2, 448, tw, 46, 23); x.fill();
  x.fillStyle = PUR; x.fillText(chipTxt, W / 2, 481);
  // פרטים
  x.font = "600 27px Rubik, sans-serif";
  x.fillText(brand ? `עמוד שלם על שם ${a.title} · כתובת: mevema.co.il/מותג/${a.slug || ""}` : `${a.pixels.toLocaleString("he-IL")} פיקסלים (${a.w}×${a.h}) · השקעה של ${nis(a.pixels * PRICE)}`, W / 2, 542);
  x.fillText(`נרשם ב"מי ומה" בתאריך ${fmtDate(a.published_at || a.created_at)}`, W / 2, 586);
  x.font = "800 26px Rubik, sans-serif";
  x.fillText("בתוקף ללא הגבלת זמן · מובטח מינימום 3 שנים", W / 2, 646);
  // חותם עגול (שמאל)
  const cx = 205, cy = 712, R = 52;
  x.beginPath(); x.arc(cx, cy, R, 0, Math.PI * 2); x.fillStyle = "#F3EBFB"; x.fill();
  x.lineWidth = 3; x.strokeStyle = PUR; x.stroke();
  x.beginPath(); x.arc(cx, cy, R - 8, 0, Math.PI * 2); x.lineWidth = 1.5; x.strokeStyle = FUCH; x.stroke();
  x.fillStyle = PUR;
  x.font = "800 20px Rubik, sans-serif"; x.fillText("מי ומה", cx, cy - 4);
  x.font = "700 15px Rubik, sans-serif"; x.fillText("₪1 לפיקסל", cx, cy + 20);
  // חתימה (ימין)
  const sx2 = W - 205;
  x.strokeStyle = INK; x.lineWidth = 1.5;
  x.beginPath(); x.moveTo(sx2 - 110, 716); x.lineTo(sx2 + 110, 716); x.stroke();
  x.fillStyle = INK; x.font = "italic 700 26px Rubik, sans-serif";
  x.fillText("מיכל ילוז", sx2, 706);
  x.fillStyle = SOFT; x.font = "600 18px Rubik, sans-serif";
  x.fillText("מייסדת מי ומה", sx2, 742);
  // שורת סיום
  x.fillStyle = SOFT; x.font = "600 20px Rubik, sans-serif";
  x.fillText("כל פיקסל עובד פעמיים 💜 · מי ומה — כולם כאן", W / 2, 742);
  // תג מייסד/ת — לעשרים הראשונים
  if (rank) {
    x.save(); x.translate(180, 165); x.rotate(-0.18);
    const bt = `🏆 מייסד/ת ${rank}/${FOUNDERS_COUNT}`;
    x.font = "800 24px Rubik, sans-serif";
    const bw = x.measureText(bt).width + 44;
    x.fillStyle = FUCH; rr(-bw / 2, -25, bw, 50, 25); x.fill();
    x.fillStyle = "#fff"; x.textAlign = "center"; x.direction = "rtl";
    x.fillText(bt, 0, 8);
    x.restore();
  }
  cv.toBlob((b) => {
    if (!b) return;
    const u = URL.createObjectURL(b), l = document.createElement("a");
    l.href = u; l.download = brand ? "תעודת-עמוד-מותג-מי-ומה.png" : "תעודת-בעלות-מי-ומה.png"; l.click();
    setTimeout(() => URL.revokeObjectURL(u), 3000);
  }, "image/png");
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

/* ---- יוצר ZIP (שיטת STORE, בלי ספריות חיצוניות) — לגיבוי מלא כולל תמונות ---- */
const CRC_TABLE = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(u8) { let c = 0xFFFFFFFF; for (let i = 0; i < u8.length; i++) c = CRC_TABLE[(c ^ u8[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
function makeZip(files) {
  const enc = new TextEncoder(), d = new Date();
  const t = ((d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1)) & 0xFFFF;
  const dt = (((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()) & 0xFFFF;
  const u16 = (v) => [v & 0xFF, (v >>> 8) & 0xFF];
  const u32 = (v) => [v & 0xFF, (v >>> 8) & 0xFF, (v >>> 16) & 0xFF, (v >>> 24) & 0xFF];
  const parts = [], central = []; let offset = 0;
  for (const f of files) {
    const name = enc.encode(f.name), data = f.data, crc = crc32(data);
    const local = new Uint8Array([...u32(0x04034b50), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(t), ...u16(dt),
      ...u32(crc), ...u32(data.length), ...u32(data.length), ...u16(name.length), ...u16(0), ...name]);
    parts.push(local, data);
    central.push(new Uint8Array([...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(t), ...u16(dt),
      ...u32(crc), ...u32(data.length), ...u32(data.length), ...u16(name.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0),
      ...u32(0), ...u32(offset), ...name]));
    offset += local.length + data.length;
  }
  const cdSize = central.reduce((acc, c) => acc + c.length, 0);
  const end = new Uint8Array([...u32(0x06054b50), ...u16(0), ...u16(0), ...u16(files.length), ...u16(files.length), ...u32(cdSize), ...u32(offset), ...u16(0)]);
  return new Blob([...parts, ...central, end], { type: "application/zip" });
}
function saveBlob(blob, filename) {
  const u = URL.createObjectURL(blob), l = document.createElement("a");
  l.href = u; l.download = filename; l.click();
  setTimeout(() => URL.revokeObjectURL(u), 5000);
}

/* הקטנת תמונה בלי חיתוך (ללוגו/תמונת מותג) — שומרת שקיפות ב-PNG */
function resizeImage(file, maxPx) {
  return new Promise((res, rej) => {
    const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => {
      const f = Math.min(1, maxPx / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.max(1, Math.round(img.width * f)); c.height = Math.max(1, Math.round(img.height * f));
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      const png = file.type === "image/png" || file.type === "image/svg+xml";
      c.toBlob((b) => (b ? res({ blob: b, ext: png ? "png" : "jpg", type: png ? "image/png" : "image/jpeg" }) : rej(new Error("blob"))),
        png ? "image/png" : "image/jpeg", 0.88);
    };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error("img")); };
    img.src = url;
  });
}
async function uploadFile({ blob, ext, type }, prefix = "brand") {
  const name = `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const up = await supabase.storage.from(BUCKET).upload(name, blob, { contentType: type });
  if (up.error) throw up.error;
  return supabase.storage.from(BUCKET).getPublicUrl(name).data.publicUrl;
}

/* עמודי מותג — "עמוד מיליון שלם" לחברות */
async function fetchBrands() {
  const { data, error } = await supabase.from("brand_pages").select("*").order("sort_order", { ascending: true }).order("created_at", { ascending: true });
  if (error) { console.error(error); return []; }
  return data || [];
}
const BRAND_PRICE = 1_000_000; // ₪1 לפיקסל × 1,000,000 — כמו כולם
const DEMO_BRAND = {
  id: "demo", slug: "דוגמה", status: "live", demo: true, owner_id: null,
  name: "המותג שלכם",
  tagline: "ככה נראה עמוד מיליון שלם — עמוד שכולו של מותג אחד",
  description: "עמוד מותג הוא עמוד רגיל של \"מי ומה\" — 1,000,000 פיקסלים באותן משבצות — רק שכל המשבצות שייכות למותג אחד. מנהל/ת המותג מעלה תמונות וקישורים לכל משבצת שרוצה, מתי שרוצה, בלי תשלום על כל משבצת: העמוד כולו שולם מראש. המחיר הוא אותו מחיר של כולם: ₪1 לפיקסל — ₪1,000,000 לעמוד, בתשלום אחד מראש בהעברה בנקאית.",
  logo_url: "/demo-brand-logo.png", hero_url: "/demo-brand-hero.jpg", link: null, published_at: null,
};
const brandPath = (b) => "/מותג/" + (b?.slug || "");
const slugify = (name) => String(name || "").trim().toLowerCase().replace(/["'״׳]/g, "").replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-+|-+$/g, "");

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
    .select("id,category,x,y,w,h,pixels,title,link,image_url,status,published_at");
  if (error) { console.error(error); return []; }
  return data || [];
}
const hasUpdate = (a) => a.pending_title != null || a.pending_link != null || a.pending_image_url != null;

/* ============================================================ */
/* --- ניתוב: כתובת עברית אמיתית לכל תצוגה (SEO) --- */
const VIEW_PATHS = { home: "/", about: "/אודות", accessibility: "/הצהרת-נגישות", terms: "/terms", privacy: "/privacy", contact: "/contact", account: "/account", admin: "/admin", auth: "/auth", reset: "/reset" };
// עמודים שלא נסרקים על ידי גוגל
const NOINDEX_VIEWS = ["terms", "privacy", "accessibility", "contact", "account", "admin", "auth", "reset"];
function pathFor(view, cat, brand) {
  if (view === "board" && cat) return "/" + encodeURIComponent(cat.slug);
  if (view === "brand" && brand) return "/" + encodeURIComponent("מותג") + "/" + encodeURIComponent(brand.slug || brand);
  return VIEW_PATHS[view] || "/";
}
function parsePath(pathname) {
  let decoded = pathname;
  try { decoded = decodeURIComponent(pathname); } catch { /* כתובת פגומה */ }
  // כתובת עברית: /פרסום-נדלן
  const slug = decoded.replace(/^\//, "").replace(/\/$/, "");
  const bySlug = CATEGORIES.find((c) => c.slug === slug);
  if (bySlug) return { view: "board", cat: bySlug };
  // עמוד מותג: /מותג/<שם>
  const bm = decoded.match(/^\/מותג\/(.+?)\/?$/);
  if (bm) return { view: "brand", cat: null, brandSlug: bm[1] };
  // תאימות לאחור: /c/realestate
  const m = decoded.match(/^\/c\/([a-z]+)/i);
  if (m) { const c = catById(m[1].toLowerCase()); if (c) return { view: "board", cat: c }; }
  const v = Object.keys(VIEW_PATHS).find((k) => VIEW_PATHS[k] === decoded);
  return { view: v || "home", cat: null };
}

export default function App() {
  const initialRoute = parsePath(window.location.pathname);
  const [view, setView] = useState(initialRoute.view);
  const [cat, setCat] = useState(initialRoute.cat);
  const [brandSlug, setBrandSlug] = useState(initialRoute.brandSlug || null);
  const [brands, setBrands] = useState([]);
  const [myAdIds, setMyAdIds] = useState(() => new Set());
  const [boardAds, setBoardAds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);

  const reload = useCallback(async () => {
    if (!isConfigured) { setLoading(false); return; }
    const [a, b] = await Promise.all([fetchBoardAds(), fetchBrands()]);
    BRAND_REGISTRY = [...b, DEMO_BRAND];
    setBoardAds(a); setBrands(b);
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
  // אילו מודעות שייכות למשתמש המחובר (כדי לאפשר עריכה מהלוח)
  useEffect(() => {
    if (!session) { setMyAdIds(new Set()); return; }
    supabase.from("ads").select("id").eq("owner_id", session.user.id)
      .then(({ data }) => setMyAdIds(new Set((data || []).map((r) => r.id))));
  }, [session, boardAds]);

  // ניווט: מעדכן תצוגה + כתובת בדפדפן
  const go = useCallback((v, c = null, brand = null) => {
    setView(v); setCat(c); setBrandSlug(brand ? (brand.slug || brand) : null);
    const p = pathFor(v, c, brand);
    if (window.location.pathname !== p) window.history.pushState({}, "", p);
    window.scrollTo({ top: 0, behavior: "auto" });
  }, []);

  // כפתור "אחורה" בדפדפן מחזיר לתצוגה הקודמת
  useEffect(() => {
    const onPop = () => { const r = parsePath(window.location.pathname); setView(r.view); setCat(r.cat); setBrandSlug(r.brandSlug || null); };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  // כותרת, תיאור וקנוני ייחודיים לכל עמוד (SEO)
  useEffect(() => {
    const desc = document.querySelector('meta[name="description"]');
    const canon = document.querySelector('link[rel="canonical"]');
    if (view === "board" && cat) {
      document.title = `${cat.name} — שטחי פרסום ב"מי ומה" · ₪1 לפיקסל`;
      desc?.setAttribute("content", `שטח פרסום בקטגוריית ${cat.name} (${cat.desc}): ${cat.seo || ""} החל מ-₪100, ₪1 לפיקסל, מיליון פיקסלים בקטגוריה — כל הקודם זוכה.`);
    } else if (view === "brand") {
      const b = brands.find((x) => x.slug === brandSlug) || (brandSlug === DEMO_BRAND.slug ? DEMO_BRAND : null);
      document.title = b ? `${b.name} — עמוד מיליון ב"מי ומה" · שטח פרסום ארגוני` : "עמוד מותג — מי ומה";
      desc?.setAttribute("content", b ? `${b.name} תפסו עמוד מיליון שלם ב"מי ומה": ${b.tagline || "1,000,000 פיקסלים של שטח פרסום ארגוני"}.` : "עמודי מותג ב\"מי ומה\" — עמוד מיליון שלם לחברות.");
    } else if (view === "terms") { document.title = "תנאי שימוש — מי ומה · שטחי פרסום"; }
    else if (view === "privacy") { document.title = "מדיניות פרטיות — מי ומה · שטחי פרסום"; }
    else if (view === "contact") { document.title = "צור קשר — מי ומה · שטחי פרסום"; }
    else if (view === "about") {
      document.title = "אודות מי ומה — שטחי פרסום בפיקסלים · איך זה עובד ושאלות נפוצות";
      desc?.setAttribute("content", "כל מה שרציתם לדעת על מי ומה: איך קונים שטח פרסום בפיקסלים, כמה זה עולה, לכמה זמן, ומי עומדת מאחורי המיזם. שאלות ותשובות.");
    }
    else if (view === "accessibility") { document.title = "הצהרת נגישות — מי ומה"; }
    else {
      document.title = "מי ומה — שטחי פרסום · ₪1 לפיקסל · כולם כאן";
      desc?.setAttribute("content", "תפסו את שטח הפרסום שלכם ב'מי ומה' — שטחי פרסום בפיקסלים לפי קטגוריות. ₪1 לפיקסל, שטח פרסום מ-₪100, מיליון פיקסלים בכל קטגוריה. כל הקודם זוכה.");
    }
    canon?.setAttribute("href", "https://www.mevema.co.il" + pathFor(view, cat, brandSlug));
    // noindex לעמודים משפטיים ופרטיים
    let robots = document.querySelector('meta[name="robots"]');
    if (!robots) { robots = document.createElement("meta"); robots.setAttribute("name", "robots"); document.head.appendChild(robots); }
    robots.setAttribute("content", NOINDEX_VIEWS.includes(view) ? "noindex, follow" : "index, follow");
  }, [view, cat, brandSlug, brands]);

  if (!isConfigured) return <Shell><SetupNeeded /></Shell>;

  const nav = {
    onHome: () => go("home"),
    onAbout: () => go("about"),
    onA11y: () => go("accessibility"),
    onTerms: () => go("terms"),
    onPrivacy: () => go("privacy"),
    onContact: () => go("contact"),
    onAccount: () => go(session ? "account" : "auth"),
    onAdmin: () => go("admin"),
    onAuth: () => go("auth"),
    onLogout: () => supabase.auth.signOut().then(() => go("home")),
    onPickCat: (c) => go("board", c),
    onBrand: (b) => go("brand", null, b),
  };

  return (
    <Shell nav={nav} session={session} isAdmin={isAdmin} activeCat={view === "board" ? cat : null}>
      {loading ? <div className="center pad"><div className="spin" /></div>
        : view === "reset" ? <ResetPassword onDone={() => setView("home")} />
        : view === "auth" ? <AuthPage onAuthed={() => setView("account")} />
        : view === "about" ? <About onPickCat={nav.onPickCat} />
        : view === "accessibility" ? <Accessibility />
        : view === "terms" ? <Terms />
        : view === "privacy" ? <Privacy />
        : view === "contact" ? <Contact />
        : view === "account" ? (session ? <Account session={session} onChange={reload} allAds={boardAds} /> : <AuthPage onAuthed={() => setView("account")} />)
        : view === "admin" ? <Admin session={session} isAdmin={isAdmin} onAuth={() => setView("auth")} brands={brands} onChange={reload} onBrand={nav.onBrand} />
        : view === "brand" ? (() => {
            const b = brands.find((x) => x.slug === brandSlug) || (brandSlug === DEMO_BRAND.slug ? DEMO_BRAND : null);
            if (!b) return <BrandNotFound onHome={nav.onHome} />;
            return <Board key={b.id} cat={brandCat(b)} ads={b.demo ? [...boardAds, ...demoAds()] : boardAds} session={session} isAdmin={isAdmin} myAdIds={myAdIds}
              onChange={reload} onPickCat={nav.onPickCat} onBrand={nav.onBrand} onHome={nav.onHome} brands={brands} />;
          })()
        : view === "home" ? <Home ads={boardAds} brands={brands} onPick={nav.onPickCat} onBrand={nav.onBrand} />
        : <Board cat={cat} ads={boardAds} session={session} myAdIds={myAdIds} onChange={reload} onPickCat={nav.onPickCat} />}
    </Shell>
  );
}

/* תפריט נגישות — מופיע בכל עמודי האתר (חובה לפי תקנות הנגישות) */
function AccessibilityMenu() {
  const [open, setOpen] = useState(false);
  const [prefs, setPrefs] = useState(() => {
    try { return JSON.parse(localStorage.getItem("a11y") || "{}"); } catch { return {}; }
  });
  useEffect(() => {
    const c = document.documentElement.classList;
    c.toggle("a11y-contrast", !!prefs.contrast);
    c.toggle("a11y-gray", !!prefs.gray);
    c.toggle("a11y-links", !!prefs.links);
    c.toggle("a11y-readable", !!prefs.readable);
    c.toggle("a11y-noanim", !!prefs.noanim);
    document.documentElement.style.fontSize = prefs.font && prefs.font !== 100 ? prefs.font + "%" : "";
    try { localStorage.setItem("a11y", JSON.stringify(prefs)); } catch { /* פרטי */ }
  }, [prefs]);
  const t = (k) => setPrefs((p) => ({ ...p, [k]: !p[k] }));
  const font = (d) => setPrefs((p) => ({ ...p, font: Math.min(140, Math.max(85, (p.font || 100) + d)) }));
  const reset = () => setPrefs({});
  return (
    <div className="a11y">
      <button className="a11y-btn" aria-label="תפריט נגישות" aria-expanded={open} title="תפריט נגישות" onClick={() => setOpen(!open)}>♿</button>
      {open && (
        <div className="a11y-panel" role="dialog" aria-label="הגדרות נגישות">
          <b>הגדרות נגישות</b>
          <div className="a11y-row">
            <button onClick={() => font(10)}>א+ הגדלת טקסט</button>
            <button onClick={() => font(-10)}>א- הקטנת טקסט</button>
          </div>
          <button className={prefs.contrast ? "on" : ""} onClick={() => t("contrast")}>ניגודיות גבוהה</button>
          <button className={prefs.gray ? "on" : ""} onClick={() => t("gray")}>גווני אפור</button>
          <button className={prefs.links ? "on" : ""} onClick={() => t("links")}>הדגשת קישורים</button>
          <button className={prefs.readable ? "on" : ""} onClick={() => t("readable")}>גופן קריא</button>
          <button className={prefs.noanim ? "on" : ""} onClick={() => t("noanim")}>עצירת אנימציות</button>
          <button className="a11y-reset" onClick={reset}>איפוס הגדרות</button>
          <p className="tiny muted">אתר "מי ומה" פועל להנגשת השירות לכלל האוכלוסייה. נתקלתם בקושי? נשמח לעזור: <span dir="ltr">{CONTACT.phone}</span> · <span dir="ltr">{CONTACT.email}</span></p>
        </div>
      )}
    </div>
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
            <a key={c.id} href={"/" + encodeURIComponent(c.slug)} className={"catchip" + (activeCat?.id === c.id ? " on" : "")}
              onClick={(e) => { e.preventDefault(); nav.onPickCat(c); }} style={activeCat?.id === c.id ? { borderColor: c.color, color: c.color } : undefined}>
              <span>{c.icon}</span> {c.name}
            </a>
          ))}
        </div>
      </div>
      {children}
      <footer className="ft">
        <div className="ft-links">
          <button onClick={nav.onAbout}>אודות ושאלות נפוצות</button><span>·</span>
          <button onClick={nav.onA11y}>הצהרת נגישות</button><span>·</span>
          <button onClick={nav.onTerms}>תנאי שימוש</button><span>·</span>
          <button onClick={nav.onPrivacy}>מדיניות פרטיות</button><span>·</span>
          <button onClick={nav.onContact}>צור קשר</button>
        </div>
        <p><strong>מי ומה</strong> · ₪1 לפיקסל · תוקף המודעות ללא הגבלת זמן — מינימום 3 שנים · ניתן לעדכן את המודעה · כל מודעה וכל עדכון עוברים אישור.</p>
        <p className="tiny">מספר הפיקסלים מוגבל ל-1,000,000 פיקסלים בכל קטגוריה · אין התחייבות לחשיפה או לפניות — החשיפה נובעת מעצם היות הפרויקט ייחודי.</p>
      </footer>
      <AccessibilityMenu />
      <a className="support-btn" target="_blank" rel="noopener noreferrer"
        href={`https://wa.me/${waNumber(CONTACT.whatsapp)}?text=${encodeURIComponent("היי, אני צריך/ה עזרה באתר מי ומה 🧩")}`}
        title="תמיכה בוואטסאפ" aria-label="תמיכה בוואטסאפ">💬 תמיכה</a>
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
    if (!validPhone(phone)) return setErr("מספר טלפון לא תקין (לדוגמה 0501234567).");
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
        fetch("/api/notify-admin", { method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "signup", name: name.trim(), phone: phone.trim() }) }).catch(() => {});
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
        {mode === "login" ? "מתחברים עם הטלפון והסיסמה שקיבלת בוואטסאפ." : "נרשמים עם מספר טלפון בלבד — סיסמה פשוטה בת 6 ספרות תיווצר עבורך אוטומטית ותוצג כאן ובוואטסאפ."}
      </p>
      {mode === "signup" && (
        <label className="fl">שם<input value={name} onChange={(e) => setName(e.target.value)} placeholder="שם מלא / שם העסק" /></label>
      )}
      <label className="fl">טלפון<input value={phone} onChange={(e) => setPhone(e.target.value.replace(/[^\d-]/g, ""))} placeholder="0501234567" dir="ltr" inputMode="tel"
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
      {mode === "login" && <ForgotPassword phone={phone} />}
    </div>
  );
}


/* שחזור סיסמה אוטומטי — סיסמה חדשה נשלחת לוואטסאפ של המשתמש בלי מגע יד אדם */
function ForgotPassword({ phone: initialPhone }) {
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState(initialPhone || "");
  const [state, setState] = useState("idle"); // idle | busy | sent | error | rate
  const send = async () => {
    if (!validPhone(phone)) return setState("error");
    setState("busy");
    try {
      const r = await fetch("/api/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phone.replace(/\D/g, "") }),
      });
      if (r.status === 429) return setState("rate");
      if (!r.ok) throw new Error();
      setState("sent");
    } catch {
      // אם השירות האוטומטי לא זמין — נפילה רכה לשחזור ידני בוואטסאפ
      const msg = `היי, שכחתי את הסיסמה שלי לאתר מי ומה 🔑\nמספר הטלפון שלי: ${phone}\nאשמח לסיסמה חדשה. תודה!`;
      window.open(`https://wa.me/${waNumber(CONTACT.whatsapp)}?text=${encodeURIComponent(msg)}`, "_blank");
      setState("idle");
    }
  };
  if (!open) return <button className="forgot" onClick={() => setOpen(true)}>שכחת סיסמה? 🔑</button>;
  return (
    <div className="forgot-box">
      {state === "sent" ? (
        <div className="warn ok-box">✅ סיסמה חדשה נשלחה לוואטסאפ של המספר שהוזן. בדקו את ההודעות והתחברו איתה.</div>
      ) : (
        <>
          <label className="fl">מה מספר הטלפון שנרשמתם איתו?
            <input value={phone} onChange={(e) => setPhone(e.target.value.replace(/[^\d-]/g, ""))} placeholder="0501234567" dir="ltr" inputMode="tel" /></label>
          {state === "error" && <div className="warn err">מספר טלפון לא תקין.</div>}
          {state === "rate" && <div className="warn err">כבר נשלחה סיסמה בדקות האחרונות — בדקו בוואטסאפ, או נסו שוב בעוד רבע שעה.</div>}
          <button className="cta dark" disabled={state === "busy"} onClick={send}>
            {state === "busy" ? "שולח..." : "שלחו לי סיסמה חדשה לוואטסאפ 🔑"}
          </button>
        </>
      )}
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

/* ----------------------- עמוד אודות ----------------------- */
function About({ onPickCat }) {
  return (
    <main>
      <section className="about">
        <h2>אודות "מי ומה" — שטחי פרסום בפיקסלים</h2>
        <p>"מי ומה" (mevema.co.il) הוא מיזם ישראלי ייחודי למכירת שטחי פרסום בפיקסלים: לוקחים את הרעיון המפורסם של דף מיליון הפיקסלים מ-2005, ומביאים אותו לישראל בגרסה מודרנית — {CATEGORIES.length} קטגוריות בשני עולמות ("מי" — האנשים, ו"מה" — הדברים), מיליון פיקסלים בדיוק בכל קטגוריה, ומחיר אחד פשוט: ₪1 לפיקסל. עסקים, יוצרים, מומחים ויזמים תופסים שטח פרסום החל מ-₪100, מעלים תמונה וקישור, ונשארים בתמונה לשנים.</p>

        <h3>איך זה עובד — ב-4 צעדים</h3>
        <ol className="about-steps">
          <li><b>בוחרים קטגוריה</b> — מהכוכבים והמשפיעים ועד הבית, הטעם והיוקרה.</li>
          <li><b>תופסים שטח פרסום פנוי</b> — מ-100 פיקסלים (₪100) ועד 10,000 פיקסלים (₪10,000).</li>
          <li><b>מעלים תמונה, כותרת וקישור</b> — וממתינים לאישור קצר.</li>
          <li><b>משלמים בתשלום מאובטח (Grow)</b> — והשטח שלכם עולה לאוויר, עם תעודת בעלות דיגיטלית להורדה.</li>
        </ol>

        <h3>שאלות נפוצות</h3>
        <details><summary>כמה עולה שטח פרסום ב"מי ומה"?</summary>
          <p>המחיר הוא ₪1 לפיקסל, סופי וכולל מע"מ ככל שחל. שטח הפרסום הקטן ביותר הוא 100 פיקסלים (₪100) והגדול ביותר 10,000 פיקסלים (₪10,000). אין מנויים, אין תשלומים חודשיים — משלמים פעם אחת.</p>
        </details>
        <details><summary>לכמה זמן שטח הפרסום שלי בתוקף?</summary>
          <p>תוקף המודעה ללא הגבלת זמן, ומובטח מינימום 3 שנים ממועד הפרסום. אפשר לעדכן את המודעה בכל עת (כל עדכון עובר אישור).</p>
        </details>
        <details><summary>מי יכול לפרסם באתר?</summary>
          <p>כל עסק, יוצר, מומחה או אדם פרטי: מתווכים ואנשי נדל"ן, מסעדות, מאמנים, עורכי דין, רואי חשבון, סטארטאפים, חנויות אופנה ויוקרה, מרצים, ספורטאים — לכל אחד יש קטגוריה בעולמות ה"מי" וה"מה". כל מודעה עוברת אישור תוכן לפני פרסום.</p>
        </details>
        <details><summary>מה זה "משחק המיליון"?</summary>
          <p>בכל קטגוריה יש בדיוק 1,000,000 פיקסלים — לא אחד יותר. כשקטגוריה מתמלאת, היא נסגרת. המקדימים תופסים את המקומות הטובים ביותר, וכל הקודם זוכה. 20 שטחי הפרסום הראשונים שעולים לאוויר נרשמים לתמיד בקיר המייסדים.</p>
        </details>
        <details><summary>מה מקבלים אחרי הרכישה?</summary>
          <p>שטח פרסום עם התמונה והקישור שלכם, תעודת בעלות דיגיטלית מעוצבת להורדה ולשיתוף, ואזור אישי שבו אפשר לעקוב, לערוך ולעדכן את המודעה.</p>
        </details>
        <details><summary>אפשר לבטל ולקבל החזר?</summary>
          <p>כן — ניתן לבטל ולקבל החזר כספי עד 21 יום ממועד ההזמנה, בכפוף לחוק הגנת הצרכן. לאחר 21 יום לא יינתנו החזרים. שימו לב שאין התחייבות לחשיפה או לפניות — החשיפה נובעת מעצם ייחודיות הפרויקט.</p>
        </details>
        <details><summary>אנחנו חברה גדולה — אפשר לקנות עמוד שלם?</summary>
          <p>כן. חברות ומותגים יכולים לפתוח "עמוד מיליון" משלהם — עמוד ייעודי של 1,000,000 פיקסלים בעיצוב שלהם, בכתובת משלו, עם הלוגו בשורת המותגים בעמוד הבית — במחיר של ₪1 לפיקסל — ₪1,000,000 לעמוד, בתשלום אחד מראש בהעברה בנקאית. פונים דרך "דף מיליון למותגים" בעמוד הבית.</p>
        </details>
        <details><summary>מי עומדת מאחורי המיזם?</summary>
          <p>מיכל ילוז — יזמית עם 21 שנות ניסיון, שהתחילה את דרכה בחדשות בטלוויזיה והקימה מיזמים דיגיטליים בהם פורטל אנימל ושירות מטפלים אינפו. "מי ומה" הוא הפרויקט שבו כולם נכנסים לתמונה — פיקסל אחרי פיקסל.</p>
        </details>
      </section>
      <section className="about about-links-sec">
        <h3>שטחי פרסום לפי תחום</h3>
        <div className="cat-links">
          {CATEGORIES.map((c) => (
            <a key={c.id} href={"/" + encodeURIComponent(c.slug)} className="cat-link"
              onClick={(e) => { e.preventDefault(); onPickCat?.(c); }}>{c.icon} פרסום ב{c.name}</a>
          ))}
        </div>
      </section>
    </main>
  );
}

/* ----------------------- הצהרת נגישות ----------------------- */
function Accessibility() {
  return (
    <main className="doc">
      <h1>הצהרת נגישות</h1>
      <p className="muted tiny">עודכן לאחרונה: אוגוסט 2026</p>
      <p>אתר "מי ומה" (mevema.co.il) רואה חשיבות רבה במתן שירות שוויוני ונגיש לכלל הגולשים, לרבות אנשים עם מוגבלות, ופועל להנגשת האתר בהתאם לתקנות שוויון זכויות לאנשים עם מוגבלות (התאמות נגישות לשירות), התשע"ג-2013, ולתקן הישראלי ת"י 5568 המבוסס על הנחיות WCAG 2.0 ברמה AA.</p>
      <h3>התאמות הנגישות באתר</h3>
      <p>באתר פועל תפריט נגישות (הכפתור העגול בפינת המסך) המאפשר: הגדלה והקטנה של הטקסט, ניגודיות גבוהה, גווני אפור, הדגשת קישורים, מעבר לגופן קריא ועצירת אנימציות. ההעדפות נשמרות בין ביקורים. בנוסף, האתר תומך בניווט מקלדת, כולל טקסט חלופי לתמונות, ומוצג בכיוון וכתב עברי תקינים.</p>
      <h3>חריגות ומגבלות</h3>
      <p>אנו פועלים להנגשה מיטבית ומתמשכת של האתר. ייתכן שחלקים מסוימים טרם הונגשו במלואם — ובהם תכני מודעות (תמונות) שמועלים על ידי מפרסמים. נשמח לקבל כל פנייה בנושא ולתקן בהקדם.</p>
      <h3>יצירת קשר בנושא נגישות</h3>
      <p>נתקלתם בקושי או בבעיה בגלישה? רכזת הנגישות של האתר היא {CONTACT.owner}, וניתן לפנות אליה בטלפון <span dir="ltr">{CONTACT.phone}</span> או בדוא"ל <a href={`mailto:${CONTACT.email}`} dir="ltr">{CONTACT.email}</a>. אנא ציינו את מהות הקושי ואת הדף שבו נתקלתם בו, ואנו נטפל בפנייה בהקדם האפשרי.</p>
    </main>
  );
}

/* טופס פנייה לעמוד מותג — שולח התראה למנהלת ופותח וואטסאפ */
function BrandInquiry() {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ company: "", name: "", phone: "", note: "" });
  const [sent, setSent] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const send = () => {
    if (!f.company.trim() || !validPhone(f.phone)) return alert("נא למלא שם חברה וטלפון תקין.");
    fetch("/api/notify-admin", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "brand_inquiry", ...f }) }).catch(() => {});
    const msg = `היי, אני מ-${f.company.trim()} ומתעניין/ת בעמוד מיליון שלם ב"מי ומה" 🏢\nשם: ${f.name.trim()}\nטלפון: ${f.phone.trim()}${f.note.trim() ? "\n" + f.note.trim() : ""}`;
    window.open(`https://wa.me/${waNumber(CONTACT.whatsapp)}?text=${encodeURIComponent(msg)}`, "_blank");
    setSent(true);
  };
  if (sent) return <div className="warn ok-box ent-ok">✅ הפנייה נשלחה! נחזור אליכם בהקדם עם פרטים ותמחור לעסקים.</div>;
  if (!open) return <button className="cta go ent-cta" onClick={() => setOpen(true)}>שליחת פנייה — דף מיליון למותג שלנו 🏢</button>;
  return (
    <div className="ent-form">
      <label className="fl">שם החברה<input value={f.company} onChange={set("company")} placeholder="לדוגמה: אסם" /></label>
      <div className="row2">
        <label className="fl">איש/אשת קשר<input value={f.name} onChange={set("name")} placeholder="שם מלא" /></label>
        <label className="fl">טלפון<input value={f.phone} onChange={set("phone")} placeholder="0501234567" dir="ltr" inputMode="tel" /></label>
      </div>
      <label className="fl">כמה מילים (לא חובה)<input value={f.note} onChange={set("note")} placeholder="מה מעניין אתכם?" /></label>
      <button className="cta go" onClick={send}>שליחת פנייה בוואטסאפ ←</button>
    </div>
  );
}

/* עמוד מותג שלא נמצא */
function BrandNotFound({ onHome }) {
  return <main className="center pad"><div className="card narrow center">
    <h3>עמוד המותג לא נמצא</h3><p className="muted">ייתכן שהכתובת שגויה או שהעמוד עדיין לא פורסם.</p>
    <button className="cta dark" onClick={onHome}>לעמוד הבית</button></div></main>;
}
/* מודעות-דוגמה לעמוד המותג לדוגמה (לא נשמרות במסד הנתונים) */
function demoAds() {
  const cat = "brand:" + DEMO_BRAND.id, slots = generateSlots(cat);
  const big = slots.find((sl) => sl.pixels === 10000), mid = slots.find((sl) => sl.pixels === 5000 && sl.w > sl.h), sq = slots.find((sl) => sl.pixels === 2500);
  const mk = (sl, image_url, title) => sl ? [{ id: "demo-" + sl.id, category: cat, x: sl.x, y: sl.y, w: sl.w, h: sl.h, pixels: sl.pixels, title, link: "/", image_url, status: "live", published_at: null }] : [];
  return [...mk(big, "/demo-brand-hero.jpg", "המותג שלכם"), ...mk(mid, "/demo-brand-logo.png", "הלוגו שלכם"), ...mk(sq, null, "מבצע החודש")];
}

function Home({ ads, brands = [], onPick, onBrand }) {
  const live = ads.filter((a) => a.status === "live" && !isBrandCat(a.category));
  const liveBrands = brands.filter((b) => b.status === "live");
  const totalSold = live.reduce((s, a) => s + a.pixels, 0);
  const SITE_PIXELS = CATEGORIES.length * CATEGORY_PIXELS;
  const sitePct = (totalSold / SITE_PIXELS) * 100;
  // הקטגוריה המובילה במשחק
  const leader = CATEGORIES.map((c) => ({ c, sold: live.filter((a) => a.category === c.id).reduce((s, a) => s + a.pixels, 0) }))
    .sort((a, b) => b.sold - a.sold)[0];
  // החשבון השקוף — מחושב משטחי הפרסום עצמם
  const math = useMemo(() => slotBreakdown(CATEGORIES[0].id), []);

  const CatCard = ({ c }) => {
    const sold = live.filter((a) => a.category === c.id).reduce((s, a) => s + a.pixels, 0);
    const pct = Math.min(100, (sold / CATEGORY_PIXELS) * 100);
    return (
      <a key={c.id} className="cat" href={"/" + encodeURIComponent(c.slug)} onClick={(e) => { e.preventDefault(); onPick(c); }}>
        <span className="cat-ic" style={{ background: c.color + "1A", color: c.color }}>{c.icon}</span>
        <span className="cat-name">{c.name}</span>
        <span className="cat-desc tiny muted">{c.desc}</span>
        <span className="bar"><i style={{ width: pct + "%", background: c.color }} /></span>
        <span className="cat-meta">{sold.toLocaleString("he-IL")} / 1,000,000 · {pct.toFixed(pct < 1 ? 2 : 1)}% בדרך למיליון</span>
      </a>
    );
  };

  return (
    <main>
      <section className="hero">
        <p className="eyebrow">🧩 מי ומה — כולם כאן · תופסים שטח פרסום · משלמים רק ₪1 לפיקסל</p>
        <h1>תפסו את <span className="hl">שטח הפרסום</span> שלכם</h1>
        <p className="sub">מי שתופס מקום — מופיע ב"מי ומה" ונשאר בו לשנים. המקדימים תופסים את המקומות הטובים ביותר, השאר תופסים את מה שנשאר. שטח פרסום החל מ-₪100 (100 פיקסלים).</p>
        <p className="sub join">הצטרפו למשחק — מספר המקומות מוגבל, כל הקודם זוכה. 🏆</p>
        <button className="ent-hero-btn" onClick={() => document.getElementById("enterprise")?.scrollIntoView({ behavior: "smooth" })}>
          🏢 דף מיליון למותגים ← עמוד שלם על שם החברה שלכם
        </button>
        <button className="story-teaser" onClick={() => document.getElementById("story")?.scrollIntoView({ behavior: "smooth" })}>
          💜 ב-2005 סטודנט מכר מיליון פיקסלים ונכנס להיסטוריה. עכשיו תורנו — אני מיכל, וזה הסיפור שלי ← לסיפור המלא
        </button>
        <div className="stats">
          <button onClick={() => document.querySelector(".cats-group")?.scrollIntoView({ behavior: "smooth" })}>
            <b>{totalSold.toLocaleString("he-IL")}</b><span>פיקסלים כבר נתפסו ← לשטחי הפרסום</span>
          </button>
          <button onClick={() => document.querySelector(".math")?.scrollIntoView({ behavior: "smooth" })}>
            <b>{SITE_PIXELS.toLocaleString("he-IL")}</b><span>פיקסלים ב"מי ומה" ← לחשבון המלא</span>
          </button>
          <button onClick={() => document.querySelector(".cats-group")?.scrollIntoView({ behavior: "smooth" })}>
            <b>מ-₪100</b><span>מחיר כניסה לתמונה ← תפסו שטח</span>
          </button>
        </div>
        {leader?.sold > 0 && (
          <p className="tiny race-note">🏆 מובילה כרגע במשחק: <b>{leader.c.icon} {leader.c.name}</b> עם {leader.sold.toLocaleString("he-IL")} פיקסלים · {sitePct.toFixed(3)}% מכלל שטחי הפרסום כבר תפוס</p>
        )}
      </section>

      <section className="brands-strip" aria-label="מותגים עם עמוד מיליון">
          <p className="tiny muted">🏢 מותגים שתפסו עמוד מיליון שלם</p>
          <div className="brands-row">
            {liveBrands.length === 0 && (
              <a className="brand-chip brand-empty" href={brandPath(DEMO_BRAND)} onClick={(e) => { e.preventDefault(); onBrand?.(DEMO_BRAND); }}>
                <span>המקום הזה שמור למותג הראשון · לצפייה בדוגמה ←</span>
              </a>
            )}
            {liveBrands.map((b) => (
              <a key={b.id} className="brand-chip" href={brandPath(b)} title={b.name} onClick={(e) => { e.preventDefault(); onBrand?.(b); }}>
                {b.logo_url ? <img src={b.logo_url} alt={b.name} /> : <span>{b.name}</span>}
              </a>
            ))}
          </div>
        </section>

      {GROUPS.map((g) => (
        <section className="cats-group" key={g.id}>
          <div className="group-head">
            <h2><span className="hl">{g.title}</span></h2>
            <p className="muted">{g.sub}</p>
          </div>
          <div className="cats">
            {CATEGORIES.filter((c) => c.group === g.id).map((c) => <CatCard key={c.id} c={c} />)}
          </div>
        </section>
      ))}

      <section className="enterprise" id="enterprise">
        <p className="eyebrow">🏢 לחברות ולמותגים גדולים</p>
        <h2>עמוד מיליון שלם — משלכם</h2>
        <p className="ent-sub">חברה גדולה לא תופסת משבצת — היא פותחת עמוד מיליון משלה: 1,000,000 פיקסלים של שטח פרסום ארגוני, בעיצוב שלכם, עם הלוגו בשורת המותגים בעמוד הבית של "מי ומה" — לשנים.</p>
        <div className="ent-price"><b>₪1,000,000</b><span>לעמוד שלם · ₪1 לפיקסל — אותו מחיר כמו כולם · תשלום אחד מראש בהעברה בנקאית</span></div>
        <ul className="ent-list">
          <li>🧩 עמוד שלם על שם המותג, בכתובת משלו ב-mevema.co.il</li>
          <li>🏠 הלוגו בשורת המותגים בראש עמוד הבית</li>
          <li>📜 תעודת בעלות ארגונית על עמוד מיליון</li>
          <li>♾️ בתוקף ללא הגבלת זמן, מובטח מינימום 3 שנים</li>
        </ul>
        <a className="ent-demo-link" href={brandPath(DEMO_BRAND)} onClick={(e) => { e.preventDefault(); onBrand?.(DEMO_BRAND); }}>👁 לצפייה בדף מיליון לדוגמה</a>
        <BrandInquiry />
      </section>

      <section className="founders">
        <h2>🏆 קיר המייסדים</h2>
        <p className="muted">{FOUNDERS_COUNT} שטחי הפרסום הראשונים שעולים לאוויר נרשמים כאן לתמיד, ומקבלים תג מייסד/ת על תעודת הבעלות.</p>
        {foundersList(ads).length > 0 && (
          <div className="founders-list">
            {foundersList(ads).map((f, i) => {
              const fc = catById(f.category);
              return (
                <a key={i} className="f-chip" href={fc ? "/" + encodeURIComponent(fc.slug) : "/"} title={`לצפייה בשטחי הפרסום של ${fc?.name}`}
                  onClick={(e) => { e.preventDefault(); onPick(fc); }}>
                  🏆 {f.title} · {fc?.icon} {fc?.name}
                </a>
              );
            })}
          </div>
        )}
        <p className="accent f-left"><b>נותרו {FOUNDERS_COUNT - foundersList(ads).length} מקומות מייסדים בלבד</b></p>
      </section>

      <section className="story" id="story">
        <h2>📖 הסיפור מאחורי הפיקסלים</h2>
        <p>ב-2005, סטודנט בן 21 בשם אלכס טיו פתח דף אינטרנט עם מיליון פיקסלים ומכר כל פיקסל בדולר, כדי לממן את הלימודים שלו. תוך חמישה חודשים הדף התמלא כולו — והפך לאגדת אינטרנט. הדף חי עד היום, וכל מי שקנה בו פיקסל אז — עדיין שם.</p>
        <p>עשרים שנה אחרי, כאן בישראל, אני מרימה את הגרסה שלנו — עם טוויסט: לא דף אחד, אלא פאזל שלם של <b>"מי"</b> ו<b>"מה"</b> — האנשים שלנו והדברים שאנחנו יוצרים. אני מיכל, אמא ויזמית, וזה החלום שאני בונה בשביל הילדים שלי — פיקסל אחרי פיקסל.</p>
        <p><b>מי אני?</b> יזמית כבר 21 שנה. התחלתי את הדרך בשבע שנים בחדשות בטלוויזיה, ומאז הקמתי מיזמים דיגיטליים — בהם פורטל אנימל, שירות מטפלים אינפו ועוד. למדתי לזהות רעיון נכון בזמן הנכון, וללכת איתו עד הסוף. "מי ומה" הוא בדיוק רעיון כזה.</p>
        <p><b>ולאן הולכים הפיקסלים?</b> קודם כל לביטחון שלי ושל המשפחה שלי — כי בשביל זה יזמית בונה. וכיזמית, חלק מהכסף יופנה לקידום המיזמים הבאים שלי. המודל פשוט והוגן: אתם תופסים שטח פרסום ב"מי ומה" ומקבלים חשיפה לשנים — ואני ממשיכה לבנות ולהצמיח. <b>כל פיקסל עובד פעמיים. 💜</b></p>
        <p>מי שתופס כאן שטח פרסום לא סתם מפרסם — הוא תופס עמדה בתמונה שכולם יסתכלו עליה. כאן אין קטנים וגדולים: כל מי שבפנים הוא כוכב, וכל שטח הוא במה. וכל מי שעולה לאוויר מקבל <b>תעודת בעלות דיגיטלית</b> על השטח שלו — קצת כמו תעודה על מגרש בירח 🌙, רק שהשטח הזה נמצא כאן, באתר חי. וכשקטגוריה מגיעה למיליון — היא מלאה ונסגרת. מי שבפנים, בפנים. מי שמחכה — ימצא את המקום תפוס.</p>
        <p className="story-cta"><b>אשמח שתהיו חלק מהסיפור שלי ותעזרו לי להשלים את הפאזל — תפסו את המקום שלכם לפני שמישהו אחר יתפוס אותו. 🧩</b></p>
      </section>

      <section className="math">
        <h2>🧮 החשבון — שקוף עד הפיקסל האחרון</h2>
        <p className="muted">אין כאן אותיות קטנות. ככה בנויה כל קטגוריה:</p>
        <div className="math-table">
          {math.sizes.map(([px, count]) => (
            <div className="math-row" key={px}>
              <span>משבצות של {px.toLocaleString("he-IL")} פיקסלים ({nis(px)})</span>
              <b>{count} משבצות = {(px * count).toLocaleString("he-IL")} פיקסלים</b>
            </div>
          ))}
          <div className="math-row total">
            <span>סה"כ בקטגוריה</span>
            <b>{math.count} משבצות = {math.total.toLocaleString("he-IL")} פיקסלים בדיוק</b>
          </div>
          <div className="math-row total">
            <span>ובכל "מי ומה"</span>
            <b>{CATEGORIES.length} קטגוריות × 1,000,000 = {SITE_PIXELS.toLocaleString("he-IL")} פיקסלים</b>
          </div>
        </div>
        <p className="tiny muted">* הפירוט לפי קטגוריית "הבית"; ההרכב משתנה מעט בין קטגוריות, אבל הסכום תמיד בדיוק 1,000,000. כל משבצת בנויה מריבועים של 10×10 פיקסלים — הקטנה ביותר 100 פיקסלים (₪100), הגדולה ביותר 10,000 (₪10,000).</p>
      </section>

    </main>
  );
}

/* ----------------------- פאזל שטחי הפרסום ----------------------- */
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

// כל קטגוריה מכילה בדיוק מיליון פיקסלים. המשבצות נוצרות באותו סדר דטרמיניסטי
// (אותו seed לפי הקטגוריה) — כך מודעות קיימות נשארות בדיוק במקומן.
const CATEGORY_PIXELS = 1_000_000;
function generateSlots(catId) {
  const rng = mulberry32(hashStr(catId));
  const slots = [];
  let remaining = CATEGORY_PIXELS, i = 0;
  while (remaining > 0) {
    const avail = SLOT_SIZES.filter((s) => s.pixels <= remaining);
    const totW = avail.reduce((t, s) => t + s.wt, 0);
    let r = rng() * totW, pick = avail[0];
    for (const s of avail) { r -= s.wt; if (r <= 0) { pick = s; break; } }
    slots.push({ id: "s" + i, x: i, y: 0, w: pick.w * 10, h: pick.h * 10, pixels: pick.pixels });
    remaining -= pick.pixels; i++;
  }
  return slots;
}
// סיכום שקוף: כמה משבצות מכל גודל יש בקטגוריה
function slotBreakdown(catId) {
  const bySize = new Map();
  let count = 0, total = 0;
  for (const s of generateSlots(catId)) {
    count++; total += s.pixels;
    bySize.set(s.pixels, (bySize.get(s.pixels) || 0) + 1);
  }
  return { count, total, sizes: [...bySize.entries()].sort((a, b) => b[0] - a[0]) };
}
/* מייסדים — 20 שטחי הפרסום הראשונים שעולים לאוויר */
const FOUNDERS_COUNT = 20;
function foundersList(allAds) {
  return (allAds || [])
    .filter((a) => a.status === "live" && !isBrandCat(a.category))
    .sort((a, b) => new Date(a.published_at || 0) - new Date(b.published_at || 0))
    .slice(0, FOUNDERS_COUNT);
}
function founderRank(ad, allAds) {
  const idx = foundersList(allAds).findIndex((f) => f.category === ad.category && f.x === ad.x);
  return idx > -1 ? idx + 1 : null;
}

// ציוני דרך במשחק המיליון
const MILESTONES = [
  { at: 10_000,    name: "הניצוץ הראשון ✨" },
  { at: 50_000,    name: "חמישים אלף 🔥" },
  { at: 100_000,   name: "עשירית מהדרך 🎯" },
  { at: 250_000,   name: "רבע מיליון 🚀" },
  { at: 500_000,   name: "חצי מיליון 🏆" },
  { at: 750_000,   name: "שלושת רבעי הדרך 💜" },
  { at: 1_000_000, name: "מיליון. היסטוריה. 👑" },
];
/* ----------------------- שטחי פרסום בקטגוריה ----------------------- */
function Board({ cat, ads, session, onChange, onPickCat, onBrand, onHome, isAdmin, brands = [], myAdIds = new Set() }) {
  const [editingAd, setEditingAd] = useState(null); // מודעה של המשתמש שנבחרה לעריכה מהלוח
  const brand = cat.brand || null;
  const canEdit = !!brand && !brand.demo && (isAdmin || (!!session && !!brand.owner_id && session.user.id === brand.owner_id));
  const catAds = ads.filter((a) => a.category === cat.id);
  const slots = useMemo(() => generateSlots(cat.id), [cat.id]);
  const live = catAds.filter((a) => a.status === "live");
  const sold = live.reduce((s, a) => s + a.pixels, 0);
  const pct = (sold / CATEGORY_PIXELS) * 100;
  const [buying, setBuying] = useState(null);
  const nextMilestone = MILESTONES.find((m) => m.at > sold);
  const breakdown = useMemo(() => slotBreakdown(cat.id), [cat.id]);

  const adAt = (slot) => catAds.find((a) => a.x === slot.x && a.y === slot.y);

  return (
    <main className="board-wrap full">
      {brand ? (
        <div className="board-head brand-head">
          <div>
            {brand.logo_url && <img className="brand-logo" src={brand.logo_url} alt={brand.name} />}
            <p className="eyebrow">🏢 עמוד מיליון · שטח פרסום ארגוני ב"מי ומה"</p>
            <h2>{brand.name}</h2>
            {brand.tagline && <p className="muted">{brand.tagline}</p>}
            {brand.link && <a className="cta go brand-cta" href={brand.link} target="_blank" rel="noopener noreferrer">לאתר {brand.name} ←</a>}
            {canEdit && <div className="warn ok-box brand-owner-note">✏️ את/ה מנהל/ת העמוד הזה — לחיצה על משבצת פנויה מעלה תמונה וקישור מיד, בלי תשלום (העמוד שולם מראש).</div>}
          </div>
        </div>
      ) : (
      <div className="board-head">
        <div>
          <h2><span className="ic" style={{ color: cat.color }}>{cat.icon}</span> {cat.name} <span className="tiny muted">· {cat.desc}</span></h2>
          <p className="muted">שטחי פרסום החל מ-₪100 (₪1 לפיקסל) · תפסו את שטח הפרסום שלכם ב"מי ומה"</p>
        </div>
      </div>
      )}

      <div className="race">
        <div className="race-top">
          <span>{brand ? `🧩 עמוד המיליון של ${brand.name}` : "🧩 משחק המיליון"}</span>
          <b>{sold.toLocaleString("he-IL")} / 1,000,000 פיקסלים · {pct.toFixed(2)}%</b>
        </div>
        <div className="race-bar"><i style={{ width: Math.max(pct, 0.4) + "%", background: cat.color }} /></div>
        {nextMilestone && (
          <span className="tiny muted">עוד {(nextMilestone.at - sold).toLocaleString("he-IL")} פיקסלים לציון הדרך הבא: <b>{nextMilestone.name}</b></span>
        )}
      </div>

      <div className="board-tip-row">
        <p className="board-tip tiny muted">{brand
          ? (canEdit ? "לוחצים על משבצת פנויה כדי להעלות תמונה וקישור, ועל משבצת מלאה (✏️) כדי להחליף או למחוק. הכול כלול — בלי תשלום." : `כל 1,000,000 הפיקסלים בעמוד הזה שייכים ל-${brand.name}. רק מנהל/ת המותג מעלה לכאן תוכן.`)
          : (session ? "לוחצים על שטח פרסום פנוי כדי לפרסם בו. שטח שלכם מסומן ב-✏️ — לחיצה עליו פותחת עריכה של התמונה והקישור." : "לוחצים על שטח פרסום פנוי כדי לפרסם בו. השטחים הגדולים = יותר פיקסלים. גוללים למטה לעוד שטחים פנויים.")}</p>
      </div>

      <div className="flow-board">
        {slots.map((slot, i) => {
          const ad = adAt(slot);
          const cols = slot.w / 10, rows = slot.h / 10;
          if (ad) {
            // מודעה שעדיין לא אושרה — לא מציגים את תוכנה, רק "תפוס · ממתין לאישור"
            if (ad.status === "pending") {
              const bigT = slot.pixels >= 1000;
              return (
                <div key={slot.id} className="tile slot taken"
                  title="המקום תפוס · ממתין לאישור"
                  style={{ gridColumn: `span ${cols}`, gridRow: `span ${rows}`, background: "#ECE7F3", cursor: "default" }}>
                  {bigT
                    ? <span className="slot-lbl"><b>🔒 תפוס</b><span>ממתין לאישור</span></span>
                    : <span className="slot-lbl xs">🔒 תפוס</span>}
                </div>
              );
            }
            // מודעה של המשתמש המחובר (או של מנהל/ת המותג בעמוד המותג) — לחיצה פותחת עריכה
            const mine = !String(ad.id).startsWith("demo-") && (myAdIds.has(ad.id) || (brand && canEdit));
            if (mine) {
              return (
                <button key={slot.id} className="tile ad mine" title={`${ad.title} · לחצו לעריכה`}
                  onClick={() => setEditingAd(ad)}
                  style={{ gridColumn: `span ${cols}`, gridRow: `span ${rows}`, background: ad.image_url ? undefined : cat.color }}>
                  {ad.image_url ? <img src={ad.image_url} alt={ad.title} /> : <span className="ad-lbl">{ad.title}</span>}
                  <span className="edit-badge">✏️</span>
                </button>
              );
            }
            // מודעה מאושרת (ממתינה לתשלום או באוויר) מוצגת בצבע מלא ועם קישור פעיל
            return (
              <a key={slot.id} className="tile ad"
                href={ad.link}
                target="_blank" rel="noopener noreferrer nofollow"
                title={ad.title}
                style={{ gridColumn: `span ${cols}`, gridRow: `span ${rows}`,
                  background: ad.image_url ? undefined : cat.color }}>
                {ad.image_url ? <img src={ad.image_url} alt={ad.title} /> : <span className="ad-lbl">{ad.title}</span>}
              </a>
            );
          }
          const big = slot.pixels >= 2500, mid = slot.pixels >= 1000, sm = slot.pixels >= 300;
          if (brand) {
            return (
              <button key={slot.id} className={"tile slot" + (canEdit ? "" : " locked")}
                onClick={() => canEdit ? setBuying(slot) : alert(`המשבצת הזו שייכת לעמוד המיליון של ${brand.name}. רק מנהל/ת המותג מעלה לכאן תוכן.`)}
                title={`${slot.pixels.toLocaleString("he-IL")} פיקסלים · ${canEdit ? "לחצו להעלאה" : "שייך ל-" + brand.name}`}
                style={{ gridColumn: `span ${cols}`, gridRow: `span ${rows}`, background: PASTELS[i % PASTELS.length] }}>
                {big ? <span className="slot-lbl"><b>{canEdit ? "העלאת תמונה כאן" : brand.name}</b><span>{slot.pixels.toLocaleString("he-IL")} פיקסלים</span></span>
                  : mid ? <span className="slot-lbl sm"><b>{slot.pixels.toLocaleString("he-IL")} פיקסלים</b></span>
                  : sm ? <span className="slot-lbl xs">{canEdit ? "+" : "🏢"}</span> : null}
              </button>
            );
          }
          return (
            <button key={slot.id} className="tile slot" onClick={() => setBuying(slot)}
              title={`${slot.pixels.toLocaleString("he-IL")} פיקסלים · ${nis(slot.pixels)}`}
              style={{ gridColumn: `span ${cols}`, gridRow: `span ${rows}`, background: PASTELS[i % PASTELS.length] }}>
              {big ? (
                <span className="slot-lbl">
                  <b>אבחר שטח פרסום כאן</b>
                  <span>{slot.pixels.toLocaleString("he-IL")} פיקסלים</span>
                  <em>{nis(slot.pixels)}</em>
                </span>
              ) : mid ? (
                <span className="slot-lbl sm"><b>{slot.pixels.toLocaleString("he-IL")} פיקסלים</b><em>{nis(slot.pixels)}</em></span>
              ) : sm ? (
                <span className="slot-lbl xs">{nis(slot.pixels)}</span>
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="board-math tiny muted">
        {brand
          ? <>🧮 בעמוד המותג: <b>{breakdown.count} משבצות</b> שמסתכמות ב-<b>{breakdown.total.toLocaleString("he-IL")} פיקסלים בדיוק</b> — כולן שייכות ל-{brand.name} · מולאו {sold.toLocaleString("he-IL")}, פנויות למילוי {(CATEGORY_PIXELS - sold).toLocaleString("he-IL")}.</>
          : <>🧮 בקטגוריה זו: <b>{breakdown.count} משבצות</b> שמסתכמות ב-<b>{breakdown.total.toLocaleString("he-IL")} פיקסלים בדיוק</b> · הקטנה ביותר 100 פיקסלים (₪100) · הגדולה ביותר 10,000 פיקסלים (₪10,000) · נתפסו {sold.toLocaleString("he-IL")}, נשארו {(CATEGORY_PIXELS - sold).toLocaleString("he-IL")}.</>}
      </div>

      {brand ? (
        <section className="cat-seo">
          {brand.description && <p>{brand.description}</p>}
          <p className="tiny muted">עמוד זה שייך במלואו ל-{brand.name} — 1,000,000 פיקסלים של שטח פרסום ארגוני ב"מי ומה"{brand.published_at ? ` · מאז ${fmtDate(brand.published_at)}` : ""}.</p>
          {brand.demo && <div className="enterprise demo-ent">
            <h2>רוצים שהעמוד הזה יהיה שלכם?</h2>
            <p className="ent-sub">₪1,000,000 לעמוד · ₪1 לפיקסל · תשלום בהעברה בנקאית</p>
            <BrandInquiry />
          </div>}
          <div className="cat-links" style={{ marginTop: 12 }}>
            {brands.filter((b) => b.status === "live" && b.id !== brand.id).map((b) => (
              <a key={b.id} href={brandPath(b)} className="cat-link" onClick={(e) => { e.preventDefault(); onBrand?.(b); }}>🏢 {b.name}</a>
            ))}
            <a href="/" className="cat-link home-link" onClick={(e) => { e.preventDefault(); onHome?.(); }}>🧩 לכל שטחי הפרסום</a>
            {!brand.demo && <a href="/#enterprise" className="cat-link" onClick={(e) => { e.preventDefault(); onHome?.(); setTimeout(() => document.getElementById("enterprise")?.scrollIntoView({ behavior: "smooth" }), 200); }}>🏢 גם לחברה שלכם מגיע עמוד מיליון</a>}
          </div>
        </section>
      ) : (
      <section className="cat-seo">
        <h3>שטח פרסום בקטגוריית {cat.name} — {cat.desc}</h3>
        <p>{cat.seo}</p>
        <p>איך זה עובד? בוחרים שטח פרסום פנוי בגודל שמתאים לתקציב — מ-100 פיקסלים ב-₪100 ועד 10,000 פיקסלים — מעלים תמונה וקישור, והמודעה שלכם עולה לאוויר לתקופה של 3 שנים לפחות, ללא הגבלת זמן וללא תשלום חודשי. בקטגוריה בדיוק 1,000,000 פיקסלים, וכשהיא מתמלאת — היא נסגרת.</p>
        <div className="cat-related">
          <span className="tiny muted">שטחי פרסום בקטגוריות נוספות:</span>
          <div className="cat-links">
            {CATEGORIES.filter((c) => c.id !== cat.id)
              .sort((a, b) => (a.group === cat.group ? -1 : 0) - (b.group === cat.group ? -1 : 0))
              .slice(0, 6)
              .map((c) => (
                <a key={c.id} href={"/" + encodeURIComponent(c.slug)} className="cat-link"
                  onClick={(e) => { e.preventDefault(); onPickCat?.(c); }}>
                  {c.icon} פרסום ב{c.name}
                </a>
              ))}
            <a href="/" className="cat-link home-link">🧩 לכל שטחי הפרסום</a>
          </div>
        </div>
      </section>
      )}

      {buying && brand && (
        <BrandSlotModal slot={buying} brand={brand} cat={cat}
          onClose={() => setBuying(null)} onDone={() => { setBuying(null); onChange(); }} />
      )}
      {editingAd && brand && (
        <BrandSlotModal slot={editingAd} existing={editingAd} brand={brand} cat={cat}
          onClose={() => setEditingAd(null)} onDone={() => { setEditingAd(null); onChange(); }} />
      )}
      {editingAd && !brand && (
        <div className="modal-bg" onClick={() => setEditingAd(null)}>
          <div className="modal edit-modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-x" onClick={() => setEditingAd(null)} aria-label="סגירה">×</button>
            <EditAd ad={editingAd} inline onDone={() => { setEditingAd(null); onChange(); }} />
          </div>
        </div>
      )}
      {buying && !brand && (
        <SlotBuyModal slot={buying} cat={cat} session={session} ads={catAds}
          onClose={() => setBuying(null)} onDone={() => { setBuying(null); onChange(); }} />
      )}
    </main>
  );
}

/* ----------------------- העלאת תוכן למשבצת בעמוד מותג (בלי תשלום) ----------------------- */
function BrandSlotModal({ slot, brand, cat, onClose, onDone, existing = null }) {
  const [title, setTitle] = useState(existing?.title || brand.name);
  const [link, setLink] = useState(existing?.link || brand.link || "https://");
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const linkCheck = link.length > 9 ? checkLink(link) : null;
  const onFile = (e) => {
    const f = e.target.files?.[0]; if (!f) return; setErr("");
    if (!f.type.startsWith("image/")) return setErr("צריך קובץ תמונה.");
    if (f.size > 10 * 1024 * 1024) return setErr("עד 10MB.");
    setFile(f); setPreview(URL.createObjectURL(f));
  };
  const remove = async () => {
    if (!confirm("למחוק את התוכן מהמשבצת? המשבצת תחזור להיות פנויה.")) return;
    setBusy(true);
    const { error } = await supabase.rpc("delete_brand_ad", { p_ad: existing.id });
    setBusy(false);
    if (error) return setErr("שגיאה: " + error.message);
    await deleteImageByUrl(existing.image_url);
    onDone();
  };
  const submit = async () => {
    if (!existing && !file) return setErr("צריך להעלות תמונה.");
    if (!linkCheck?.ok) return setErr("הקישור אינו תקין.");
    setBusy(true); setErr("");
    try {
      const image_url = file ? await uploadImage(await compressImage(file, slot.w, slot.h)) : null;
      if (existing) {
        const { error } = await supabase.rpc("update_brand_ad", { p_ad: existing.id, p_title: title.trim() || brand.name, p_link: link, p_image_url: image_url });
        if (error) throw error;
        if (image_url && existing.image_url) await deleteImageByUrl(existing.image_url);
        return onDone();
      }
      const { error } = await supabase.rpc("add_brand_ad", {
        p_brand: brand.id, p_x: slot.x, p_y: slot.y, p_w: slot.w, p_h: slot.h, p_pixels: slot.pixels,
        p_title: title.trim() || brand.name, p_link: link, p_image_url: image_url,
      });
      if (error) throw error;
      onDone();
    } catch (e) {
      setErr(e.message?.includes("taken") ? "המשבצת נתפסה בינתיים — בחרו אחרת." : e.message?.includes("authorized") ? "אין הרשאה לעמוד הזה." : "שגיאה: " + (e.message || "נסו שוב"));
    } finally { setBusy(false); }
  };
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>{existing ? "✏️ עריכת משבצת" : "🏢 העלאת תוכן למשבצת"} · {slot.pixels.toLocaleString("he-IL")} פיקסלים</h3>
        <p className="tiny muted">משבצת {slot.w}×{slot.h} בעמוד המיליון של {brand.name}. {existing ? "השינוי נכנס לתוקף מיד." : "עולה לאוויר מיד — בלי תשלום."}</p>
        {existing?.image_url && !preview && <div className="preview"><span className="tiny muted">התמונה הנוכחית:</span><img className="crop-preview" src={existing.image_url} alt="" style={{ aspectRatio: slot.w / slot.h }} /></div>}
        <label className="fl">כותרת<input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={60} /></label>
        <label className="fl">קישור<input value={link} onChange={(e) => setLink(e.target.value)} dir="ltr" /></label>
        {linkCheck && !linkCheck.ok && <div className="warn err">{linkCheck.flags?.join(" · ")}</div>}
        <label className="fl">{existing ? "תמונה חדשה (לא חובה — להחלפה)" : "תמונה"} (יחס {slot.w}:{slot.h})<input type="file" accept="image/*" onChange={onFile} /></label>
        {preview && <div className="preview"><img className="crop-preview" src={preview} alt="" style={{ aspectRatio: slot.w / slot.h }} /></div>}
        {err && <div className="warn err">{err}</div>}
        <div className="row2">
          <button className="btn-line ghost2" onClick={onClose} disabled={busy}>ביטול</button>
          <button className="cta go" onClick={submit} disabled={busy}>{busy ? "שומר..." : existing ? "שמירת שינויים ✓" : "העלאה לאוויר ✓"}</button>
        </div>
        {existing && <button className="btn-line danger" onClick={remove} disabled={busy}>🗑 מחיקת התוכן מהמשבצת</button>}
      </div>
    </div>
  );
}

/* ----------------------- קניית משבצת ----------------------- */
function SlotBuyModal({ slot, cat, session, ads, onClose, onDone }) {
  const [title, setTitle] = useState("");
  const [link, setLink] = useState("https://");
  const [phone, setPhone] = useState(session?.user?.user_metadata?.phone || "");
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [imgDims, setImgDims] = useState(null); // מידות התמונה שהועלתה — לאזהרת יחס
  const [fileKey, setFileKey] = useState(0);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const linkCheck = link.length > 9 ? checkLink(link) : null;
  const price = slot.pixels * PRICE;
  const taken = ads.some((a) => a.x === slot.x && a.y === slot.y);
  const slotAR = slot.w / slot.h;
  const ratioWarn = imgDims && (Math.max(imgDims.w / imgDims.h / slotAR, slotAR / (imgDims.w / imgDims.h)) > 1.3);

  const onFile = (e) => {
    const f = e.target.files?.[0]; if (!f) return; setErr("");
    if (!f.type.startsWith("image/")) return setErr("צריך קובץ תמונה.");
    if (f.size > 10 * 1024 * 1024) return setErr("עד 10MB.");
    const url = URL.createObjectURL(f);
    const im = new Image();
    im.onload = () => setImgDims({ w: im.width, h: im.height });
    im.src = url;
    setFile(f); setPreview(url);
  };
  const removeFile = () => { if (preview) URL.revokeObjectURL(preview); setFile(null); setPreview(null); setImgDims(null); setFileKey((k) => k + 1); };

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
      fetch("/api/notify-admin", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "new_ad", title: title.trim() || cat.name, category: cat.name,
          pixels: slot.pixels.toLocaleString("he-IL"), price: nis(slot.pixels * PRICE), phone, image: !!file }) }).catch(() => {});
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
            <p className="muted">אפשר לשלם עכשיו בקישור המאובטח (Grow) — המודעה תעלה לאוויר מיד לאחר אישור התוכן והתשלום. אישור יישלח אליך בוואטסאפ.</p>
            <a className="cta dark" style={{ display: "block", textAlign: "center", textDecoration: "none", marginBottom: 10 }}
              href={PAY_LINK} target="_blank" rel="noopener noreferrer">💳 מעבר לתשלום מאובטח · {nis(price)}</a>
            <div className="warn ok-box">✨ {VALIDITY_TEXT}.<br />לאחר הפרסום תוכלו להוריד <b>תעודת בעלות דיגיטלית 📜</b> על שטח הפרסום שלכם — מושלמת לשיתוף ברשתות.<br />אפשר לעקוב, לערוך או לבטל בלשונית ״האזור שלי״.</div>
            <button className="cta dark" onClick={onDone}>סיום</button>
          </div>
        ) : (<>
          <h3 style={{ color: cat.color }}>{cat.icon} {cat.name}</h3>
          <div className="slot-summary">
            <b>{slot.pixels.toLocaleString("he-IL")} פיקסלים</b>
            <span className="tiny muted">{slot.w}×{slot.h} · ₪1 לפיקסל</span>
            <em>{nis(price)}</em>
          </div>
          <div className="warn ok-box tiny">✨ {VALIDITY_TEXT} (כל עדכון באישור)</div>

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
          <label className="fl">תמונה (המשבצת ביחס {slot.w}:{slot.h} — מומלץ להעלות תמונה ביחס דומה)
            <input key={fileKey} type="file" accept="image/*" onChange={onFile} /></label>
          {err && <div className="warn err">{err}</div>}
          {preview && <div className="preview">
            {ratioWarn && <div className="warn">✂️ שימו לב: התמונה שלכם ({imgDims.w}×{imgDims.h}) ביחס שונה מהמשבצת ({slot.w}×{slot.h}) — החלקים החורגים ייחתכו אוטומטית למרכז. כך זה ייראה בשטח הפרסום:</div>}
            {!ratioWarn && <span className="tiny muted">כך התמונה תיראה בשטח הפרסום:</span>}
            <img className="crop-preview" src={preview} alt="תצוגה" style={{ aspectRatio: slot.w / slot.h }} />
            <button type="button" className="img-remove" onClick={removeFile}>הסר ובחר תמונה אחרת</button>
          </div>}

          <div className="row2">
            <button className="btn-line ghost2" onClick={onClose}>ביטול</button>
            <button className="cta go" disabled={busy || !session || !file || !linkCheck?.ok} onClick={submit}>
              {busy ? "שולח..." : "תשלום ושליחה לאישור · " + nis(price)}
            </button>
          </div>
        </>)}
      </div>
    </div>
  );
}
/* ----------------------- האזור שלי (מפרסם) ----------------------- */
function Account({ session, onChange, allAds }) {
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
    if (!confirm(`להסיר את המודעה "${a.title}"? המקום יתפנה ולא ניתן לשחזר.\n(החזר כספי אפשרי רק עד 21 יום מההזמנה. ויתור על המקום הוא סופי — לא ניתן לקבלו בחזרה.)`)) return;
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
              const validUntil = a.published_at ? addYears(a.published_at, 3) : null;
              const refundUntil = addDays(a.created_at, REFUND_DAYS);
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
                    {a.status === "live" && <span className="tiny muted">בתוקף ללא הגבלת זמן · מובטח לפחות עד {fmtDate(validUntil)} · ניתן לעדכן בכל עת</span>}
                    {a.status === "awaiting_payment" && (
                      <a className="tiny accent" href={PAY_LINK} target="_blank" rel="noopener noreferrer">💳 לתשלום מאובטח ({nis(a.pixels * PRICE)}) — לחצו כאן</a>
                    )}
                    {a.status !== "removed" && (
                      <span className={"tiny " + (refundable ? "ok-text" : "muted")}>
                        {refundable ? `ניתן לביטול בהחזר עד ${fmtDate(refundUntil)}` : "חלון הביטול (21 יום) הסתיים"}
                      </span>
                    )}
                    {hasUpdate(a) && <span className="tiny accent">יש עדכון שממתין לאישור</span>}
                  </div>
                  {a.status !== "removed" && (
                    <div className="my-act">
                      {a.status === "live" && <button className="cert" onClick={() => downloadCertificate(a, catById(a.category), founderRank(a, allAds))}>📜 תעודת בעלות</button>}
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
function EditAd({ ad, onDone, inline = false }) {
  const c = catById(ad.category);
  const [title, setTitle] = useState(ad.title || "");
  const [link, setLink] = useState(ad.link || "");
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [imgDims, setImgDims] = useState(null);
  const [fileKey, setFileKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState(false);
  const [removeImg, setRemoveImg] = useState(false); // בקשה למחוק את התמונה הקיימת

  const linkCheck = link.length > 9 ? checkLink(link) : null;
  const titleChanged = title.trim() && title.trim() !== (ad.title || "");
  const linkChanged = link && link !== (ad.link || "");
  const anyChange = titleChanged || linkChanged || file || removeImg;
  const adAR = ad.w / ad.h;
  const ratioWarn = imgDims && (Math.max(imgDims.w / imgDims.h / adAR, adAR / (imgDims.w / imgDims.h)) > 1.3);

  const onFile = (e) => {
    const f = e.target.files?.[0]; if (!f) return; setErr("");
    if (!f.type.startsWith("image/")) return setErr("צריך קובץ תמונה.");
    if (f.size > 10 * 1024 * 1024) return setErr("עד 10MB.");
    const url = URL.createObjectURL(f);
    const im = new Image();
    im.onload = () => setImgDims({ w: im.width, h: im.height });
    im.src = url;
    setFile(f); setPreview(url);
  };
  const removeFile = () => {
    if (preview) URL.revokeObjectURL(preview);
    setFile(null); setPreview(null); setImgDims(null); setFileKey((k) => k + 1);
  };
  const submit = async () => {
    if (!anyChange) return alert("לא בוצע שינוי.");
    if (linkChanged && !linkCheck?.ok) return alert("הקישור אינו תקין.");
    setBusy(true);
    try {
      let image_url = null;
      if (file) image_url = await uploadImage(await compressImage(file, ad.w, ad.h));
      else if (removeImg) image_url = ""; // מחרוזת ריקה = בקשה למחוק את התמונה
      fetch("/api/notify-admin", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "edit_request", title: ad.title, phone: ad.phone, image: !!file }) }).catch(() => {});
      const { error } = await supabase.rpc("submit_ad_update", {
        p_ad_id: ad.id, p_title: titleChanged ? title.trim() : null,
        p_link: linkChanged ? link : null, p_image_url: image_url,
      });
      if (error) throw error; setDone(true);
    } catch (e) { console.error(e); alert("שגיאה: " + (e.message || "נסה שוב")); }
    finally { setBusy(false); }
  };

  if (done) return (
    <main className={inline ? "inline-edit" : "center pad"}><div className={inline ? "center" : "card narrow center"}>
      <h3>השינוי נשלח לאישור ✅</h3>
      <p className="muted">המודעה הנוכחית נשארת באתר עד שהשינוי יאושר.</p>
      <button className="cta dark" onClick={onDone}>חזרה</button>
    </div></main>
  );

  return (
    <main className={inline ? "inline-edit" : "board-wrap"}><div className={inline ? "" : "card narrow"}>
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
      {ad.image_url && !file && (
        <button type="button" className={"btn-line " + (removeImg ? "no" : "")} onClick={() => setRemoveImg(!removeImg)}>
          {removeImg ? "✓ התמונה תימחק (המודעה תוצג עם הכותרת) — לחצו לביטול" : "🗑 מחיקת התמונה הנוכחית"}
        </button>
      )}
      {err && <div className="warn err">{err}</div>}
      {preview && <div className="preview">
        {ratioWarn && <div className="warn">✂️ התמונה ({imgDims.w}×{imgDims.h}) ביחס שונה מהמשבצת ({ad.w}×{ad.h}) — היא תיחתך אוטומטית למרכז. כך זה ייראה:</div>}
        {!ratioWarn && <span className="tiny muted">כך התמונה תיראה בשטח הפרסום:</span>}
        <img className="crop-preview" src={preview} alt="" style={{ aspectRatio: ad.w / ad.h }} />
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
      <p className="muted tiny">עודכן לאחרונה: יולי 2026</p>

      <h3>1. כללי</h3>
      <p>אתר "מי ומה" (להלן: "האתר"), המופעל על ידי {CONTACT.owner} (טלפון: {CONTACT.phone}, דוא"ל: {CONTACT.email}), הוא פלטפורמה לרכישת שטחי פרסום (פיקסלים) והצגת תמונה וקישור בהם. השימוש באתר מהווה הסכמה לתנאים אלה.</p>

      <h3>2. אופי השירות</h3>
      <p>האתר משמש כמתווך בלבד להצגת מודעות, ואינו צד לכל עסקה בין מפרסם לצד שלישי. האתר אינו אחראי לתוכן, לאמינות, למוצרים או לשירותים המופיעים במודעות. מחיר שטח פרסום הוא ₪1 לפיקסל, והמחירים המוצגים באתר הם סופיים וכוללים מע"מ ככל שחל.</p>

      <h3>3. אחריות המפרסם</h3>
      <p>המפרסם אחראי באופן בלעדי לתוכן המודעה, ומצהיר כי הוא חוקי, אינו מפר זכויות יוצרים, סימני מסחר או כל זכות של צד שלישי, ואינו מטעה. המפרסם נושא באחריות מלאה לכל נזק שייגרם כתוצאה מהמודעה.</p>

      <h3>4. תכנים אסורים</h3>
      <p>אסור להעלות תוכן פוגעני, מיני, אלים, מפלה, בלתי חוקי, מטעה, או קישורים זדוניים. מפעילת האתר רשאית לסרב, להסיר או לערוך כל מודעה לפי שיקול דעתה הבלעדי וללא צורך בנימוק.</p>

      <h3>5. אישור, תשלום ועדכונים</h3>
      <p>כל מודעה וכל עדכון למודעה קיימת כפופים לאישור מראש. מודעה תפורסם רק לאחר אישור התוכן והשלמת התשלום במלואו באמצעות קישור תשלום מאובטח (Grow). לאחר התשלום יישלח למפרסם אישור בוואטסאפ. שינוי במודעה קיימת לא ייכנס לתוקף עד לאישורו, והמודעה הקודמת תמשיך להופיע עד אז.</p>

      <h3>6. תוקף המודעה וויתור על מקום</h3>
      <p>תוקף מודעה שפורסמה הוא <b>ללא הגבלת זמן, ומובטח לתקופה של שלוש (3) שנים לפחות</b> ממועד פרסומה. המפרסם רשאי לעדכן את המודעה בכל עת (בכפוף לאישור), או להסירה מרצונו ולוותר על המקום.</p>
      <p><b>ויתור על מקום הוא סופי:</b> מפרסם המוותר מרצונו על מקומו — המקום משוחרר לאלתר, לא ניתן לקבלו בחזרה, ומפעילת האתר רשאית למכור את המקום למפרסם אחר לפי שיקול דעתה הבלעדי. כמו כן, מקום שאושר ולא שולם בתוך 72 שעות ממועד אישור התוכן — מפעילת האתר רשאית לשחררו ולהציעו לאחרים.</p>

      <h3>7. ביטול והחזר כספי</h3>
      <p>ניתן לבטל את ההזמנה ולקבל החזר כספי <b>עד 21 יום ממועד ההזמנה</b>. <b>לאחר 21 יום לא יינתנו החזרים כספיים כלל.</b> ביטול והחזר בכפוף לחוק הגנת הצרכן, התשמ"א-1981.</p>

      <h3>8. אין התחייבות לחשיפה או לתוצאות</h3>
      <p>מפעילת האתר אינה מתחייבת לכמות חשיפה, כניסות, הקלקות או פניות כלשהי הנובעת מהמודעה. החשיפה נובעת מעצם היותו של האתר פרויקט ייחודי, והיא עשויה להשתנות מעת לעת. רכישת שטח פרסום אינה מהווה הבטחה לתוצאה עסקית כלשהי.</p>

      <h3>9. עמודי מותג (שטח פרסום ארגוני)</h3>
      <p>האתר מציע לחברות ולמותגים "עמוד מיליון" — עמוד ייעודי בהיקף 1,000,000 פיקסלים במחיר של ₪1 לפיקסל (₪1,000,000 לעמוד, כולל מע"מ ככל שחל), הנמכר בהסכם נפרד ובתשלום אחד מראש בהעברה בנקאית, ולא דרך רכישת משבצות. עמוד מותג כולל הצגת לוגו בשורת המותגים בעמוד הבית, בסדר שנקבע על ידי מפעילת האתר לפי שיקול דעתה הבלעדי וללא התחייבות למיקום מסוים. כל הוראות תנאים אלה — ובכלל זה סעיף 8 בדבר היעדר התחייבות לחשיפה או לתוצאות — חלות על עמודי מותג במלואן. תוקף עמוד מותג: ללא הגבלת זמן, מובטח מינימום 3 שנים ממועד הפרסום.</p>

      <h3>10. הגבלת אחריות</h3>
      <p>השירות ניתן כפי שהוא ("AS IS"). מפעילת האתר לא תישא באחריות לכל נזק ישיר או עקיף שייגרם משימוש באתר או מהסתמכות על מודעות המופיעות בו.</p>

      <h3>11. שיפוט</h3>
      <p>על תנאים אלה יחולו דיני מדינת ישראל, וסמכות השיפוט הבלעדית נתונה לבתי המשפט המוסמכים בישראל.</p>

      <h3>12. יצירת קשר</h3>
      <p>בכל שאלה ניתן לפנות אל {CONTACT.owner}: <a href={`mailto:${CONTACT.email}`} dir="ltr">{CONTACT.email}</a> · <span dir="ltr">{CONTACT.phone}</span>.</p>

    </main>
  );
}

/* ----------------------- מדיניות פרטיות ----------------------- */
function Privacy() {
  return (
    <main className="doc">
      <h1>מדיניות פרטיות</h1>
      <p className="muted tiny">עודכן לאחרונה: יולי 2026</p>

      <h3>1. כללי</h3>
      <p>מדיניות זו מסבירה כיצד אתר "מי ומה", המופעל על ידי {CONTACT.owner} (להלן: "אנחנו"), אוסף ומשתמש במידע אישי. אנו פועלים בהתאם לחוק הגנת הפרטיות, התשמ"א-1981. השימוש באתר מהווה הסכמה למדיניות זו.</p>

      <h3>2. איזה מידע נאסף</h3>
      <p>בעת פתיחת חשבון ופרסום מודעה נאספים: כתובת אימייל, מספר טלפון, ותוכן המודעה (תמונה, כותרת וקישור). כמו כן נאסף מידע טכני בסיסי הנדרש לתפעול האתר (כגון כתובת IP ונתוני התחברות).</p>

      <h3>3. למה משתמשים במידע</h3>
      <p>המידע משמש לניהול החשבון, להצגת המודעות באתר, ליצירת קשר לצורך אישור ותיאום תשלום (כולל בוואטסאפ), ולמתן תמיכה. לא נעשה שימוש במידע למטרות שלא פורטו כאן ללא הסכמתך.</p>

      <h3>4. שיתוף עם צדדים שלישיים</h3>
      <p>איננו מוכרים מידע אישי. המידע מאוחסן ומעובד אצל ספקי שירות הדרושים לתפעול האתר, ובהם Supabase (מסד נתונים ואחסון), ספק האירוח של האתר, ו-Grow (משולם) לסליקת תשלומים. ספקים אלה כפופים להתחייבויות אבטחה ופרטיות. מידע עשוי להימסר אם נידרש לכך על פי דין.</p>

      <h3>5. עוגיות ומידע טכני</h3>
      <p>האתר עושה שימוש באמצעי אחסון בדפדפן הנדרשים לשמירת ההתחברות שלך ולתפעול תקין. אין שימוש בעוגיות פרסום או מעקב של צד שלישי.</p>

      <h3>6. אבטחת מידע</h3>
      <p>אנו נוקטים אמצעים סבירים להגנה על המידע, לרבות הצפנה ובקרת הרשאות. עם זאת, אין באפשרותנו להבטיח הגנה מוחלטת מפני כל סיכון.</p>

      <h3>7. זכויותיך</h3>
      <p>הנך זכאי לעיין במידע אודותיך, לתקנו או לבקש את מחיקתו. ניתן לערוך ולהסיר מודעות ישירות ב"האזור שלי", או לפנות אלינו בכל בקשה הנוגעת למידע האישי שלך.</p>

      <h3>8. שמירת מידע</h3>
      <p>אנו שומרים את המידע כל עוד החשבון פעיל וכנדרש לצרכים חוקיים, חשבונאיים ותפעוליים. לאחר מכן המידע יימחק או יעבור אנונימיזציה (הסרת כל הפרטים המזהים, כך שלא ניתן יהיה לקשרו לאדם מסוים).</p>

      <h3>9. יצירת קשר</h3>
      <p>בכל שאלה בנושא פרטיות ניתן לפנות אל {CONTACT.owner}: <a href={`mailto:${CONTACT.email}`} dir="ltr">{CONTACT.email}</a> או בטלפון <span dir="ltr">{CONTACT.phone}</span>.</p>

      <h3>10. שינויים</h3>
      <p>אנו רשאים לעדכן מדיניות זו מעת לעת. הגרסה העדכנית תפורסם בעמוד זה.</p>

    </main>
  );
}

/* ----------------------- צור קשר ----------------------- */
function Contact() {
  const wa = waNumber(CONTACT.whatsapp);
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
function Admin({ session, isAdmin, onAuth, brands = [], onChange, onBrand }) {
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
  return <AdminQueue brands={brands} onChange={onChange} onBrand={onBrand} />;
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

/* כלי תמונה למנהלת — החלפה ומחיקה ישירות מהניהול */
function AdminImgTools({ a, onDone }) {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const replace = async (e) => {
    const f = e.target.files?.[0]; if (!f) return;
    if (!f.type.startsWith("image/")) return alert("צריך קובץ תמונה.");
    setBusy(true);
    try {
      const url = await uploadImage(await compressImage(f, a.w, a.h));
      await supabase.from("ads").update({ image_url: url }).eq("id", a.id);
      if (a.image_url) await deleteImageByUrl(a.image_url);
      onDone();
    } catch (err) { alert("שגיאה: " + (err.message || "נסי שוב")); }
    finally { setBusy(false); if (inputRef.current) inputRef.current.value = ""; }
  };
  const del = async () => {
    if (!a.image_url) return alert("למודעה זו אין תמונה.");
    if (!confirm("למחוק את התמונה? המודעה תוצג עם הכותרת בלבד.")) return;
    setBusy(true);
    await deleteImageByUrl(a.image_url);
    await supabase.from("ads").update({ image_url: null }).eq("id", a.id);
    setBusy(false); onDone();
  };
  return (<>
    <input ref={inputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={replace} />
    <button className="ok" disabled={busy} onClick={() => inputRef.current?.click()}>{busy ? "..." : "🖼 החלף תמונה"}</button>
    <button className="no" disabled={busy} onClick={del}>🗑 מחק תמונה</button>
  </>);
}

/* כלי העברה למנהלת — העברת שטח פרסום למיקום פנוי באותו גודל, גם בין קטגוריות */
function AdminMove({ a, allAds, onDone }) {
  const [open, setOpen] = useState(false);
  const [catSel, setCatSel] = useState(a.category);
  const freeSlots = useMemo(() => {
    if (!open) return [];
    return generateSlots(catSel).filter((s) =>
      s.w === a.w && s.h === a.h &&
      !(catSel === a.category && s.x === a.x) &&
      !allAds.some((o) => o.id !== a.id && o.category === catSel && o.x === s.x && o.status !== "removed")
    );
  }, [open, catSel, allAds, a]);
  const move = async (slot) => {
    const c = catById(catSel);
    if (!confirm(`להעביר את "${a.title}" לשטח מס' ${slot.x} בקטגוריית ${c?.name}?`)) return;
    const { error } = await supabase.from("ads").update({ category: catSel, x: slot.x, y: slot.y }).eq("id", a.id);
    if (error) return alert("שגיאה: " + error.message);
    setOpen(false); onDone();
  };
  return (
    <div className="move-wrap">
      <button className="ok" onClick={() => setOpen(!open)}>📍 העבר מיקום</button>
      {open && (
        <div className="move-panel">
          <label className="tiny">לאיזו קטגוריה?
            <select value={catSel} onChange={(e) => setCatSel(e.target.value)}>
              {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.icon} {c.name}{c.id === a.category ? " (נוכחית)" : ""}</option>)}
            </select>
          </label>
          <span className="tiny muted">שטחים פנויים בגודל {a.w}×{a.h} ({a.pixels.toLocaleString("he-IL")} פיקסלים): {freeSlots.length}</span>
          <div className="move-slots">
            {freeSlots.slice(0, 24).map((s) => (
              <button key={s.id} className="move-slot" onClick={() => move(s)}>שטח {s.x}</button>
            ))}
            {freeSlots.length === 0 && <span className="tiny muted">אין שטח פנוי בגודל הזה בקטגוריה שנבחרה.</span>}
          </div>
        </div>
      )}
    </div>
  );
}

/* ניהול עמודי מותג — הוספה, עריכה, סדר תצוגה, פרסום */
function AdminBrands({ brands = [], onChange, onBrand }) {
  const [editing, setEditing] = useState(null); // null | {} (חדש) | מותג קיים
  const [busy, setBusy] = useState(false);
  const list = [...brands].filter((b) => b.status !== "removed").sort((a, b) => a.sort_order - b.sort_order);

  const persistOrder = async (arr) => {
    for (let i = 0; i < arr.length; i++) {
      if (arr[i].sort_order !== (i + 1) * 10) await supabase.from("brand_pages").update({ sort_order: (i + 1) * 10 }).eq("id", arr[i].id);
    }
    onChange?.();
  };
  const move = (b, dir) => {
    const i = list.findIndex((x) => x.id === b.id), j = i + dir;
    if (j < 0 || j >= list.length) return;
    const arr = [...list]; [arr[i], arr[j]] = [arr[j], arr[i]];
    persistOrder(arr);
  };
  const setStatus = async (b, status) => {
    const extra = status === "live" && !b.published_at ? { published_at: new Date().toISOString() } : {};
    const { error } = await supabase.from("brand_pages").update({ status, ...extra }).eq("id", b.id);
    if (error) return alert("שגיאה: " + error.message);
    onChange?.();
  };
  const del = async (b) => {
    if (!confirm(`למחוק לצמיתות את עמוד המותג "${b.name}"?`)) return;
    await deleteImageByUrl(b.logo_url); await deleteImageByUrl(b.hero_url);
    await supabase.from("brand_pages").delete().eq("id", b.id);
    onChange?.();
  };
  const cert = (b) => downloadCertificate({ title: b.name, slug: b.slug, x: 0, published_at: b.published_at, created_at: b.created_at, pixels: 1_000_000, w: 1000, h: 1000 }, null, null, true);

  if (editing) return <BrandForm brand={editing} busy={busy} setBusy={setBusy} onDone={() => { setEditing(null); onChange?.(); }} onCancel={() => setEditing(null)} />;
  return (
    <div className="brands-admin">
      <div className="card">
        <h3>🏢 עמודי מותג — עמוד מיליון שלם לחברות</h3>
        <p className="tiny muted">כל מותג מקבל עמוד משלו בכתובת mevema.co.il/מותג/&lt;שם&gt; והלוגו שלו בשורת המותגים בעמוד הבית. הסדר כאן = הסדר בעמוד הבית (▲▼). רק מותגים במצב "באוויר" מוצגים לגולשים.</p>
        <button className="cta go" onClick={() => setEditing({})}>+ הוספת עמוד מותג</button>
      </div>
      {list.length === 0 && <div className="card narrow center"><p className="muted">עדיין אין עמודי מותג.</p></div>}
      <div className="queue">
        {list.map((b, i) => (
          <div className="qcard brand-card" key={b.id}>
            <div className="qimg brand-thumb">{b.logo_url ? <img src={b.logo_url} alt="" /> : <span className="ad-lbl">{b.name}</span>}</div>
            <div className="qbody">
              <b>{i + 1}. {b.name} <span className={"tiny " + (b.status === "live" ? "ok-text" : "muted")}>· {b.status === "live" ? "באוויר" : "טיוטה"}</span></b>
              <span className="tiny muted" dir="ltr">/מותג/{b.slug}</span>
              <span className="tiny">{b.owner_id ? `👤 מנהל/ת המותג: ${b.owner_phone || "מוגדר"}` : "⚠️ עדיין לא הוגדר/ה מנהל/ת מותג — רק את יכולה להעלות תוכן"}</span>
              {b.tagline && <span className="tiny">{b.tagline}</span>}
              {b.link && <a className="qlink" href={b.link} target="_blank" rel="noopener noreferrer nofollow" dir="ltr">{b.link}</a>}
              <span className="tiny muted">נוצר: {fmtDate(b.created_at)}{b.published_at ? ` · פורסם: ${fmtDate(b.published_at)}` : ""} · {b.hero_url ? "יש תמונת עמוד" : "אין תמונת עמוד"}</span>
            </div>
            <div className="qact">
              <button className="ok" onClick={() => move(b, -1)} disabled={i === 0} title="להזיז למעלה">▲</button>
              <button className="ok" onClick={() => move(b, 1)} disabled={i === list.length - 1} title="להזיז למטה">▼</button>
              <button className="ok" onClick={() => setEditing(b)}>✏️ עריכה</button>
              {b.status === "live"
                ? <button className="no" onClick={() => setStatus(b, "draft")}>הסתר</button>
                : <button className="ok" onClick={() => setStatus(b, "live")}>🚀 פרסם</button>}
              <button className="ok" onClick={() => onBrand?.(b)}>👁 פתח עמוד</button>
              <button className="ok" onClick={() => cert(b)}>📜 תעודה</button>
              <button className="no" onClick={() => del(b)}>🗑 מחק</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function BrandForm({ brand, busy, setBusy, onDone, onCancel }) {
  const isNew = !brand.id;
  const [f, setF] = useState({ name: brand.name || "", slug: brand.slug || "", tagline: brand.tagline || "", description: brand.description || "", link: brand.link || "", owner_phone: brand.owner_phone || "" });
  const [logo, setLogo] = useState(null);
  const [hero, setHero] = useState(null);
  const [err, setErr] = useState("");
  const set = (k) => (e) => {
    const v = e.target.value;
    setF((p) => (k === "name" && isNew && (!p.slug || p.slug === slugify(p.name)) ? { ...p, name: v, slug: slugify(v) } : { ...p, [k]: v }));
  };
  const save = async () => {
    setErr("");
    if (!f.name.trim()) return setErr("צריך שם מותג.");
    const slug = slugify(f.slug || f.name);
    if (!slug) return setErr("כתובת לא תקינה.");
    if (f.link && !checkLink(f.link).ok) return setErr("הקישור אינו תקין.");
    setBusy(true);
    try {
      const row = { name: f.name.trim(), slug, tagline: f.tagline.trim() || null, description: f.description.trim() || null, link: f.link.trim() || null };
      const op = f.owner_phone.trim();
      if (op) {
        if (!validPhone(op)) throw new Error("טלפון מנהל/ת המותג לא תקין.");
        const { data: uid, error: ue } = await supabase.rpc("user_id_by_email", { target_email: phoneEmail(op) });
        if (ue) throw ue;
        if (!uid) throw new Error("מנהל/ת המותג צריך/ה קודם להירשם באתר (התחברות → פתיחת חשבון) עם הטלפון " + op);
        row.owner_id = uid; row.owner_phone = op;
      } else { row.owner_id = null; row.owner_phone = null; }
      if (logo) row.logo_url = await uploadFile(await resizeImage(logo, 600), "logo");
      if (hero) row.hero_url = await uploadFile(await resizeImage(hero, 1600), "hero");
      const q = isNew ? supabase.from("brand_pages").insert(row) : supabase.from("brand_pages").update(row).eq("id", brand.id);
      const { error } = await q;
      if (error) throw error;
      if (!isNew && logo && brand.logo_url) await deleteImageByUrl(brand.logo_url);
      if (!isNew && hero && brand.hero_url) await deleteImageByUrl(brand.hero_url);
      onDone();
    } catch (e) {
      setErr(e.message?.includes("duplicate") ? "כבר קיים מותג עם הכתובת הזו — שנו את הכתובת." : "שגיאה: " + (e.message || "נסו שוב"));
    } finally { setBusy(false); }
  };
  return (
    <div className="card">
      <h3>{isNew ? "🏢 עמוד מותג חדש" : `✏️ עריכת ${brand.name}`}</h3>
      <label className="fl">שם המותג<input value={f.name} onChange={set("name")} placeholder="לדוגמה: אסם" /></label>
      <label className="fl">כתובת העמוד (אחרי /מותג/)<input value={f.slug} onChange={set("slug")} placeholder="אסם" dir="ltr" /></label>
      <label className="fl">שורת תיאור קצרה<input value={f.tagline} onChange={set("tagline")} placeholder="לדוגמה: הטעם של הבית מאז 1942" /></label>
      <label className="fl">טקסט לעמוד (לא חובה)<textarea rows={4} value={f.description} onChange={set("description")} placeholder="כמה משפטים על המותג — יופיעו מתחת לתמונה" /></label>
      <label className="fl">קישור לאתר המותג<input value={f.link} onChange={set("link")} placeholder="https://" dir="ltr" /></label>
      <label className="fl">טלפון מנהל/ת המותג (מי שמעלה תוכן לעמוד)<input value={f.owner_phone} onChange={set("owner_phone")} placeholder="0501234567" dir="ltr" inputMode="tel" /></label>
      <p className="tiny muted">מנהל/ת המותג נרשם/ת באתר כמו כל משתמש (טלפון + סיסמה), ואז בעמוד המותג יוכל/תוכל להעלות תמונות למשבצות — בלי תשלום.</p>
      <div className="row2">
        <label className="fl">לוגו (PNG שקוף מומלץ){brand.logo_url && !logo && <img className="mini-prev" src={brand.logo_url} alt="" />}
          <input type="file" accept="image/*" onChange={(e) => setLogo(e.target.files?.[0] || null)} /></label>
        <label className="fl">תמונת העמוד (רוחבית, עד 1600px){brand.hero_url && !hero && <img className="mini-prev" src={brand.hero_url} alt="" />}
          <input type="file" accept="image/*" onChange={(e) => setHero(e.target.files?.[0] || null)} /></label>
      </div>
      {err && <div className="warn err">{err}</div>}
      <div className="row2">
        <button className="btn-line ghost2" onClick={onCancel} disabled={busy}>ביטול</button>
        <button className="cta go" onClick={save} disabled={busy}>{busy ? "שומר..." : isNew ? "יצירת העמוד (כטיוטה)" : "שמירת שינויים"}</button>
      </div>
      {isNew && <p className="tiny muted">אחרי היצירה: "👁 פתח עמוד" כדי לראות איך זה נראה, ואז "🚀 פרסם" כדי להעלות לאוויר.</p>}
    </div>
  );
}

/* גיבוי ושחזור — ZIP מלא כולל תמונות, צילומי מצב יומיים, ושחזור מקובץ */
function AdminBackup({ ads, brands = [], onRestored, downloadJson }) {
  const [prog, setProg] = useState(null);
  const [snaps, setSnaps] = useState(null);
  const [msg, setMsg] = useState(null);
  const fileRef = useRef(null);

  useEffect(() => {
    supabase.from("ad_backups").select("id,created_at,ads_count").order("created_at", { ascending: false }).limit(30)
      .then(({ data }) => setSnaps(data || []));
  }, []);

  const fullZip = async () => {
    const enc = new TextEncoder();
    const names = new Map();
    for (const a of ads) for (const u of [a.image_url, a.pending_image_url]) { const p = u && u.split(`/${BUCKET}/`)[1]; if (p) names.set(p, u); }
    for (const b of brands) for (const u of [b.logo_url, b.hero_url]) { const p = u && u.split(`/${BUCKET}/`)[1]; if (p) names.set(p, u); }
    const files = [{ name: "backup.json", data: enc.encode(JSON.stringify({ exported_at: new Date().toISOString(), site: "mevema.co.il", ads, brands }, null, 2)) }];
    files.push({ name: "README.txt", data: enc.encode("גיבוי מלא של מי ומה.\nbackup.json — כל המודעות ועמודי המותג.\nimages/ — כל התמונות בשמות המקוריים שלהן.\nשחזור: בניהול → גיבוי → ♻️ שחזור מקובץ (backup.json). אם חסרות תמונות באחסון — להעלות את תיקיית images לדלי ad-images ב-Supabase באותם שמות.\n") });
    let i = 0, failed = 0;
    for (const [p, u] of names) {
      i++; setProg(`מוריד תמונה ${i} מתוך ${names.size}...`);
      try { const r = await fetch(u); if (!r.ok) throw new Error(); files.push({ name: "images/" + p, data: new Uint8Array(await r.arrayBuffer()) }); }
      catch { failed++; }
    }
    setProg("אורז קובץ ZIP...");
    saveBlob(makeZip(files), `mevema-full-backup-${new Date().toISOString().slice(0, 10)}.zip`);
    setProg(null);
    setMsg({ ok: `הגיבוי ירד: ${ads.length} מודעות, ${brands.length} מותגים, ${names.size - failed} תמונות${failed ? ` (${failed} תמונות לא נמצאו)` : ""}.` });
  };

  const restoreRows = async (rows, brandRows) => {
    let ok = 0, bad = 0;
    for (let i = 0; i < rows.length; i += 50) {
      const chunk = rows.slice(i, i + 50);
      const { error } = await supabase.from("ads").upsert(chunk, { onConflict: "id" });
      if (error) { for (const r of chunk) { const { error: e2 } = await supabase.from("ads").upsert(r, { onConflict: "id" }); if (e2) bad++; else ok++; } }
      else ok += chunk.length;
    }
    let bok = 0;
    if (brandRows?.length) { const { error } = await supabase.from("brand_pages").upsert(brandRows, { onConflict: "id" }); if (!error) bok = brandRows.length; }
    setMsg({ ok: `שוחזרו ${ok} מודעות${bok ? ` ו-${bok} מותגים` : ""}${bad ? `, ${bad} נכשלו` : ""}.` });
    onRestored?.();
  };
  const restoreFile = async (e) => {
    const f = e.target.files?.[0]; if (!f) return;
    try {
      const j = JSON.parse(await f.text());
      const rows = j.ads || j.data || [];
      if (!Array.isArray(rows) || !rows.length) return setMsg({ err: "הקובץ לא מכיל מודעות." });
      if (!confirm(`לשחזר ${rows.length} מודעות מהקובץ? רשומות קיימות עם אותו מזהה יעודכנו, רשומות חסרות ייווצרו מחדש.`)) return;
      await restoreRows(rows, j.brands);
    } catch { setMsg({ err: "קובץ לא תקין." }); }
    if (fileRef.current) fileRef.current.value = "";
  };
  const restoreSnap = async (sn) => {
    if (!confirm(`לשחזר את צילום המצב מ-${fmtDate(sn.created_at)} (${sn.ads_count} מודעות)?`)) return;
    const { data, error } = await supabase.from("ad_backups").select("data").eq("id", sn.id).single();
    if (error || !data) return setMsg({ err: "לא ניתן לטעון את צילום המצב." });
    await restoreRows(data.data || []);
  };

  return (
    <div className="backup-panel">
      <div className="card">
        <h3>📦 גיבוי</h3>
        <p className="tiny muted">מומלץ: גיבוי מלא פעם בשבוע ושמירה בדרייב/במחשב. ה-ZIP כולל את כל הנתונים וכל התמונות בשמות המקוריים.</p>
        <div className="row2">
          <button className="cta go" onClick={fullZip} disabled={!!prog}>{prog || "🗜 גיבוי מלא כולל תמונות (ZIP)"}</button>
          <button className="btn-line" onClick={downloadJson}>📄 גיבוי נתונים בלבד (JSON)</button>
        </div>
      </div>
      <div className="card">
        <h3>♻️ שחזור</h3>
        <p className="tiny muted">משחזרים מקובץ backup.json (מתוך ה-ZIP או מהגיבוי המהיר). המערכת מעדכנת רשומות קיימות ומחזירה רשומות שנמחקו. תמונות שנמחקו מהאחסון מוחזרות ידנית מתיקיית images שב-ZIP.</p>
        <input ref={fileRef} type="file" accept="application/json,.json" onChange={restoreFile} />
      </div>
      <div className="card">
        <h3>🕒 צילומי מצב אוטומטיים (כל לילה ב-03:00)</h3>
        <p className="tiny muted">השרת שומר כל לילה עותק של כל המודעות ומעתיק כל תמונה חדשה לדלי גיבוי נפרד. נשמרים 90 הצילומים האחרונים.</p>
        {snaps === null ? <div className="spin" /> : snaps.length === 0
          ? <div className="warn">עדיין אין צילומי מצב — הראשון ייווצר בלילה הקרוב (בתנאי שהוגדר SUPABASE_SERVICE_KEY ב-Vercel והורץ ה-SQL).</div>
          : <div className="snap-list">{snaps.map((sn) => (
            <div className="snap-row" key={sn.id}>
              <span>{new Date(sn.created_at).toLocaleString("he-IL")} · {sn.ads_count} מודעות</span>
              <button className="btn-line" onClick={() => restoreSnap(sn)}>שחזר</button>
            </div>))}</div>}
      </div>
      {msg?.ok && <div className="warn ok-box">{msg.ok}</div>}
      {msg?.err && <div className="warn err">{msg.err}</div>}
    </div>
  );
}

function AdminQueue({ brands = [], onChange, onBrand }) {
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
  // אישור תוכן — שומר גם את מועד האישור (לספירת 24/48/72 שעות לתשלום)
  const approveContent = (a) => setStatus(a, "awaiting_payment", { approved_at: new Date().toISOString() });
  const hoursSinceApproval = (a) => Math.floor((Date.now() - new Date(a.approved_at || a.created_at).getTime()) / 36e5);

  // תזכורת תשלום בוואטסאפ (24/48 שעות)
  const remindPayment = (a, final) => {
    const msg = final
      ? `שלום! ⏰ תזכורת אחרונה מ"מי ומה": המודעה שלך "${a.title}" אושרה לפני יותר מ-48 שעות וממתינה לתשלום של ${nis(a.pixels * PRICE)}.\nקישור לתשלום מאובטח (Grow):\n${PAY_LINK}\n\nשימי/שים לב: אם התשלום לא יתקבל תוך 72 שעות מהאישור — המקום ישוחרר ויוצע למפרסמים אחרים.`
      : `שלום! 👋 תזכורת ידידותית מ"מי ומה": המודעה שלך "${a.title}" אושרה וממתינה לתשלום של ${nis(a.pixels * PRICE)}.\nקישור לתשלום מאובטח (Grow):\n${PAY_LINK}\n\nלאחר התשלום המודעה תעלה מיד לאוויר. תודה!`;
    window.open(`https://wa.me/${waNumber(a.phone)}?text=${encodeURIComponent(msg)}`, "_blank");
  };
  // שחרור מקום — לא שולם תוך 72 שעות
  const releaseSlot = async (a) => {
    if (!confirm(`לשחרר את המקום של "${a.title}"? המודעה תוסר והמקום יתפנה למפרסמים אחרים.`)) return;
    await setStatus(a, "removed");
    const msg = `שלום, המודעה שלך "${a.title}" ב"מי ומה" לא שולמה תוך 72 שעות מהאישור, ולכן המקום שוחרר.\nנשמח לראותך שוב — אפשר תמיד לבחור מקום חדש באתר. 💜`;
    window.open(`https://wa.me/${waNumber(a.phone)}?text=${encodeURIComponent(msg)}`, "_blank");
  };
  // גיבוי מלא: מוריד קובץ עם כל המודעות (כולל קישורי תמונות) — לשמירה בטוחה
  const downloadBackup = () => {
    const backup = { exported_at: new Date().toISOString(), site: "mevema.co.il", ads_count: ads.length, ads, brands };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const u = URL.createObjectURL(blob), l = document.createElement("a");
    const d = new Date().toISOString().slice(0, 10);
    l.href = u; l.download = `mevema-backup-${d}.json`; l.click();
    setTimeout(() => URL.revokeObjectURL(u), 3000);
  };

  // "שולם · העלה" — מפרסם את המודעה וגם שולח אישור תשלום בוואטסאפ ללקוח
  const publish = async (a) => {
    await setStatus(a, "live", a.published_at ? {} : { published_at: new Date().toISOString() });
    const c = catById(a.category);
    const msg = `שלום! 🎉 התשלום על סך ${nis(a.pixels * PRICE)} התקבל בהצלחה, והמודעה שלך "${a.title}" (${c?.name}) עלתה לאוויר ב"מי ומה"!\n\n✨ ${VALIDITY_TEXT}.\nאפשר לצפות, לערוך ולעקוב אחרי המודעה בלשונית "האזור שלי" באתר.\n\nתודה שפרסמת אצלנו! 💜\nמי ומה · ${CONTACT.phone}`;
    window.open(`https://wa.me/${waNumber(a.phone)}?text=${encodeURIComponent(msg)}`, "_blank");
  };

  const remove = async (a) => {
    if (!confirm(`למחוק לצמיתות את "${a.title}"?`)) return;
    await deleteImageByUrl(a.image_url); await deleteImageByUrl(a.pending_image_url);
    await supabase.from("ads").delete().eq("id", a.id); load();
  };
  const approveUpdate = async (a) => {
    const apply = { pending_title: null, pending_link: null, pending_image_url: null };
    if (a.pending_title != null) apply.title = a.pending_title;
    if (a.pending_link != null) apply.link = a.pending_link;
    if (a.pending_image_url != null) apply.image_url = a.pending_image_url === "" ? null : a.pending_image_url;
    await supabase.from("ads").update(apply).eq("id", a.id);
    // מחיקת התמונה הישנה מהאחסון (גם כשהוחלפה וגם כשנמחקה)
    if (a.pending_image_url != null && a.image_url && a.pending_image_url !== a.image_url) await deleteImageByUrl(a.image_url);
    load();
  };
  const rejectUpdate = async (a) => {
    await deleteImageByUrl(a.pending_image_url);
    await supabase.from("ads").update({ pending_title: null, pending_link: null, pending_image_url: null }).eq("id", a.id);
    load();
  };
  const whatsapp = (a) => {
    const c = catById(a.category);
    const msg = `שלום! המודעה שלך ב"מי ומה" (${c?.name}) אושרה 🎉\nלתשלום מאובטח של ${nis(a.pixels * PRICE)} עבור ${a.pixels.toLocaleString("he-IL")} פיקסלים — הנה קישור התשלום (Grow):\n${PAY_LINK}\n\n✨ ${VALIDITY_TEXT}.\nלאחר התשלום תקבל/י אישור בוואטסאפ והמודעה תעלה לאוויר. תודה!`;
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
  counts.brands = brands.filter((b) => b.status !== "removed").length;
  const TABS = [["pending", "לבדיקה"], ["awaiting_payment", "ממתין לתשלום"], ["updates", "עדכונים"], ["live", "באוויר"], ["removed", "הוסרו"], ["brands", "🏢 מותגים"], ["backup", "📦 גיבוי"]];

  return (
    <main className="admin">
      <div className="board-head">
        <h2>אזור ניהול</h2>
        <button className="backup-btn" onClick={() => setTab("backup")} title="גיבוי ושחזור">📦 גיבוי ושחזור</button>
      </div>
      <AdminPwReset />
      <div className="seg wide scroll">
        {TABS.map(([k, label]) => (
          <button key={k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>{label} <i className="cnt">{counts[k]}</i></button>
        ))}
      </div>

      {tab === "brands" ? <AdminBrands brands={brands} onChange={onChange} onBrand={onBrand} />
        : tab === "backup" ? <AdminBackup ads={ads} brands={brands} onRestored={() => { load(); onChange?.(); }} downloadJson={downloadBackup} />
        : loading ? <div className="center pad"><div className="spin" /></div>
        : list.length === 0 ? <div className="card narrow center"><p className="muted">אין מודעות כאן 🎉</p></div>
        : tab === "updates" ? (
          <div className="queue">{list.map((a) => {
            const c = catById(a.category);
            const imgDeleted = a.pending_image_url === "";
            const pendImg = imgDeleted ? null : (a.pending_image_url ?? a.image_url);
            return (
              <div className="qcard" key={a.id}>
                <div className="diff">
                  <div className="diff-col"><span className="tiny muted">נוכחי</span>
                    <div className="qimg sm" style={{ aspectRatio: a.w / a.h }}>
                      {a.image_url ? <img src={a.image_url} alt="" /> : <span className="ad-lbl">{a.title}</span>}</div></div>
                  <div className="diff-arrow">←</div>
                  <div className="diff-col"><span className="tiny accent">מבוקש</span>
                    <div className="qimg sm" style={{ aspectRatio: a.w / a.h }}>
                      {pendImg ? <img src={pendImg} alt="" />
                        : <span className="ad-lbl">{a.pending_title || a.title}</span>}</div></div>
                </div>
                <div className="qbody">
                  <span className="tiny muted">{c?.icon} {c?.name}</span>
                  {a.pending_title != null && <span className="tiny">כותרת: <b>{a.pending_title}</b></span>}
                  {a.pending_link != null && <a className="qlink" href={a.pending_link} target="_blank" rel="noopener noreferrer nofollow" dir="ltr">{a.pending_link}</a>}
                  {a.pending_image_url != null && <span className="tiny">{imgDeleted ? "🗑 בקשה למחוק את התמונה" : "התמונה הוחלפה"}</span>}
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
            const refundUntil = addDays(a.created_at, REFUND_DAYS);
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
                  {a.status === "awaiting_payment" && (
                    <span className={"tiny " + (hoursSinceApproval(a) >= 72 ? "err-text" : "muted")}>⏱ עברו {hoursSinceApproval(a)} שעות מאישור התוכן</span>
                  )}
                  {a.flags?.length > 0 && <div className="warn">⚠️ {a.flags.join(" · ")}</div>}
                  {isUpd(a) && <div className="warn ok-box">יש עדכון בלשונית "עדכונים"</div>}
                </div>
                <div className="qact">
                  {a.status === "pending" && <>
                    <button className="ok" onClick={() => approveContent(a)}>אישור תוכן</button>
                    <button className="no" onClick={() => remove(a)}>דחייה</button></>}
                  {a.status === "awaiting_payment" && <>
                    <button className="wa" onClick={() => whatsapp(a)}>שלח לתשלום</button>
                    {hoursSinceApproval(a) >= 24 && hoursSinceApproval(a) < 48 &&
                      <button className="wa" onClick={() => remindPayment(a, false)}>⏰ תזכורת (24 ש׳)</button>}
                    {hoursSinceApproval(a) >= 48 &&
                      <button className="wa" onClick={() => remindPayment(a, true)}>⏰ תזכורת אחרונה (48 ש׳)</button>}
                    {hoursSinceApproval(a) >= 72 &&
                      <button className="no" onClick={() => releaseSlot(a)}>🔓 שחרור המקום (72 ש׳)</button>}
                    <button className="ok" onClick={() => publish(a)}>שולם · העלה</button>
                    <button className="no" onClick={() => remove(a)}>בטל</button></>}
                  {a.status === "live" && <>
                    <button className="wa" onClick={() => whatsapp(a)}>וואטסאפ</button>
                    <AdminImgTools a={a} onDone={load} />
                    <button className="no" onClick={() => setStatus(a, "removed")}>הסר מהאתר</button>
                    <button className="no" onClick={() => remove(a)}>🗑 מחק לצמיתות</button></>}
                  {a.status !== "live" && a.status !== "removed" && <AdminImgTools a={a} onDone={load} />}
                  {a.status !== "removed" && <AdminMove a={a} allAds={ads} onDone={load} />}
                  {a.status === "removed" && <button className="no" onClick={() => remove(a)}>🗑 מחק לצמיתות</button>}
                </div>
              </div>
            );
          })}</div>
        )}
    </main>
  );
}
