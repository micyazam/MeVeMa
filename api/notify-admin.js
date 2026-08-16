// התראות וואטסאפ למנהלת: נרשם חדש / שטח פרסום חדש שממתין לאישור.
// רץ בצד השרת בלבד. משתני סביבה: GREEN_API_INSTANCE, GREEN_API_TOKEN, ADMIN_WHATSAPP (ברירת מחדל 972515003870)

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "method" });

  const GA_INSTANCE = process.env.GREEN_API_INSTANCE;
  const GA_TOKEN = process.env.GREEN_API_TOKEN;
  const ADMIN = (process.env.ADMIN_WHATSAPP || "972515003870").replace(/\D/g, "");
  if (!GA_INSTANCE || !GA_TOKEN) return res.status(500).json({ error: "not_configured" });

  const clean = (v, max = 80) => String(v || "").replace(/[\r\n]+/g, " ").slice(0, max);
  const { type } = req.body || {};

  let msg = null;
  if (type === "signup") {
    msg = `🆕 נרשם/ה חדש/ה ב"מי ומה"!\n👤 שם: ${clean(req.body.name) || "—"}\n📱 טלפון: ${clean(req.body.phone, 20) || "—"}`;
  } else if (type === "new_ad") {
    msg = `📥 שטח פרסום חדש ממתין לאישור ב"מי ומה"!\n🏷 כותרת: ${clean(req.body.title)}\n🗂 קטגוריה: ${clean(req.body.category, 40)}\n🔢 ${clean(req.body.pixels, 20)} פיקסלים (${clean(req.body.price, 20)})\n📱 טלפון: ${clean(req.body.phone, 20)}\n\nלאישור: https://www.mevema.co.il/admin`;
  }
  if (!msg) return res.status(400).json({ error: "bad_type" });

  try {
    const ga = await fetch(`https://api.green-api.com/waInstance${GA_INSTANCE}/sendMessage/${GA_TOKEN}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chatId: `${ADMIN}@c.us`, message: msg }),
    });
    if (!ga.ok) return res.status(502).json({ error: "send_failed" });
    return res.status(200).json({ ok: true });
  } catch {
    return res.status(500).json({ error: "server" });
  }
}
