// שחזור סיסמה אוטומטי: מייצר סיסמה חדשה ושולח אותה לוואטסאפ של המשתמש דרך Green API.
// רץ בצד השרת בלבד (Vercel Serverless) — המפתחות הסודיים לא נחשפים לדפדפן.
// משתני סביבה נדרשים ב-Vercel: SUPABASE_SERVICE_KEY, GREEN_API_INSTANCE, GREEN_API_TOKEN
// (וגם VITE_SUPABASE_URL שכבר קיים)

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "method" });

  const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
  const GA_INSTANCE = process.env.GREEN_API_INSTANCE_ID || process.env.GREEN_API_INSTANCE;
  const GA_TOKEN = process.env.GREEN_API_TOKEN;
  if (!SUPABASE_URL || !SERVICE_KEY || !GA_INSTANCE || !GA_TOKEN)
    return res.status(500).json({ error: "not_configured" });

  // נירמול טלפון ישראלי
  const raw = String(req.body?.phone || "").replace(/\D/g, "");
  if (!/^05\d{8}$/.test(raw)) return res.status(400).json({ error: "bad_phone" });
  const intl = "972" + raw.slice(1);
  const email = `${intl}@mevema.co.il`;

  const sb = (path, opts = {}) =>
    fetch(`${SUPABASE_URL}${path}`, {
      ...opts,
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
        ...(opts.headers || {}),
      },
    });

  try {
    // הגבלת קצב: שחזור אחד לכל טלפון בכל 15 דקות (מונע הצפה והטרדה)
    const since = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const rl = await sb(`/rest/v1/password_resets?phone=eq.${raw}&created_at=gt.${since}&select=phone`);
    const recent = await rl.json();
    if (Array.isArray(recent) && recent.length > 0)
      return res.status(429).json({ error: "rate_limit" });

    // סיסמה חדשה: 6 ספרות
    let pw = String(1 + Math.floor(Math.random() * 9));
    for (let i = 0; i < 5; i++) pw += Math.floor(Math.random() * 10);

    // איפוס הסיסמה (הפונקציה מחזירה false אם המשתמש לא קיים — לא חושפים זאת לפונה)
    const rpc = await sb(`/rest/v1/rpc/system_reset_password`, {
      method: "POST",
      body: JSON.stringify({ target_email: email, new_password: pw }),
    });
    const found = await rpc.json();

    // רישום הניסיון להגבלת הקצב
    await sb(`/rest/v1/password_resets`, { method: "POST", body: JSON.stringify({ phone: raw }) });

    // שליחת הוואטסאפ — רק אם המשתמש באמת קיים
    if (found === true) {
      const msg = `היי! 🧩 זו הסיסמה החדשה שלך לאתר "מי ומה":\n\n🔑 ${pw}\n\nמתחברים עם הטלפון ${raw} והסיסמה הזו בכתובת https://www.mevema.co.il\nאם לא ביקשת שחזור — אפשר להתעלם מההודעה.`;
      const ga = await fetch(`https://api.green-api.com/waInstance${GA_INSTANCE}/sendMessage/${GA_TOKEN}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatId: `${intl}@c.us`, message: msg }),
      });
      if (!ga.ok) return res.status(502).json({ error: "send_failed" });
    }

    // תשובה אחידה — לא מסגירים אם המספר רשום או לא (פרטיות)
    return res.status(200).json({ ok: true });
  } catch {
    return res.status(500).json({ error: "server" });
  }
}
