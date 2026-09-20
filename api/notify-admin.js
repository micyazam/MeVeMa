// התראות וואטסאפ למנהלת: נרשם חדש / שטח פרסום חדש / בקשת עדכון / פנייה של חברה לעמוד מותג.
// רץ בצד השרת בלבד. משתני סביבה (אותם שמות כמו במטפלים קומפאס — אפשר להעתיק משם):
//   GREEN_API_INSTANCE_ID, GREEN_API_TOKEN, ADMIN_PHONE (ברירת מחדל: 050-8274421)

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "method" });

  const GA_INSTANCE = process.env.GREEN_API_INSTANCE_ID || process.env.GREEN_API_INSTANCE;
  const GA_TOKEN = process.env.GREEN_API_TOKEN;
  const admin = (process.env.ADMIN_PHONE || process.env.ADMIN_WHATSAPP || "0508274421").replace(/\D/g, "").replace(/^0/, "972");
  if (!GA_INSTANCE || !GA_TOKEN) return res.status(500).json({ error: "not_configured" });

  const clean = (v, max = 80) => String(v || "").replace(/[\r\n]+/g, " ").slice(0, max);
  const b = req.body || {};
  const site = "https://www.mevema.co.il";

  let msg = null;
  if (b.type === "signup") {
    msg = `🆕 נרשם/ה חדש/ה ב"מי ומה"!\n👤 שם: ${clean(b.name) || "—"}\n📱 טלפון: ${clean(b.phone, 20) || "—"}`;
  } else if (b.type === "new_ad") {
    msg = `📥 שטח פרסום חדש ממתין לאישור ב"מי ומה"!\n🏷 כותרת: ${clean(b.title)}\n🗂 קטגוריה: ${clean(b.category, 40)}\n🔢 ${clean(b.pixels, 20)} פיקסלים (${clean(b.price, 20)})\n📱 טלפון: ${clean(b.phone, 20)}\n🖼 תמונה: ${b.image ? "הועלתה" : "ללא"}\n\nלאישור: ${site}/admin`;
  } else if (b.type === "edit_request") {
    msg = `✏️ בקשת עדכון למודעה ב"מי ומה"\n🏷 מודעה: ${clean(b.title)}\n📱 טלפון: ${clean(b.phone, 20) || "—"}\n${b.image ? "🖼 תמונה חדשה הועלתה\n" : ""}\nלאישור בלשונית "עדכונים": ${site}/admin`;
  } else if (b.type === "brand_inquiry") {
    msg = `🏢 פנייה לעמוד מותג (עמוד מיליון שלם)!\n🏷 חברה: ${clean(b.company)}\n👤 איש קשר: ${clean(b.name)}\n📱 טלפון: ${clean(b.phone, 20)}\n💬 ${clean(b.note, 300) || "—"}`;
  }
  if (!msg) return res.status(400).json({ error: "bad_type" });

  try {
    const ga = await fetch(`https://api.green-api.com/waInstance${GA_INSTANCE}/sendMessage/${GA_TOKEN}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chatId: `${admin}@c.us`, message: msg }),
    });
    if (!ga.ok) return res.status(502).json({ error: "send_failed" });
    return res.status(200).json({ ok: true });
  } catch {
    return res.status(500).json({ error: "server" });
  }
}
