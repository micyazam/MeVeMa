// גיבוי אוטומטי יומי (Vercel Cron):
//   1. צילום מצב של כל טבלת המודעות → נשמר בטבלת ad_backups (ניתן לשחזור)
//   2. העתקת כל תמונה שעדיין לא גובתה → דלי אחסון נפרד ad-images-backup
// משתני סביבה: VITE_SUPABASE_URL, SUPABASE_SERVICE_KEY, ואופציונלי CRON_SECRET (Vercel שולח אותו אוטומטית)
const BUCKET = "ad-images", BACKUP_BUCKET = "ad-images-backup", KEEP_SNAPSHOTS = 90;

export default async function handler(req, res) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.authorization !== `Bearer ${secret}`) return res.status(401).json({ error: "unauthorized" });

  const URL_ = process.env.VITE_SUPABASE_URL, KEY = process.env.SUPABASE_SERVICE_KEY;
  if (!URL_ || !KEY) return res.status(500).json({ error: "not_configured" });
  const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };

  try {
    // 1) צילום מצב של המודעות
    const r = await fetch(`${URL_}/rest/v1/ads?select=*`, { headers: H });
    if (!r.ok) throw new Error("ads " + r.status);
    const ads = await r.json();
    const snap = await fetch(`${URL_}/rest/v1/ad_backups`, {
      method: "POST", headers: { ...H, Prefer: "return=minimal" },
      body: JSON.stringify({ ads_count: ads.length, data: ads }),
    });
    if (!snap.ok) throw new Error("snapshot " + snap.status);

    // מוחקים צילומים ישנים מעבר למכסה
    const old = await fetch(`${URL_}/rest/v1/ad_backups?select=id&order=created_at.desc&offset=${KEEP_SNAPSHOTS}`, { headers: H });
    const oldRows = old.ok ? await old.json() : [];
    if (oldRows.length) {
      await fetch(`${URL_}/rest/v1/ad_backups?id=in.(${oldRows.map((o) => o.id).join(",")})`, { method: "DELETE", headers: H });
    }

    // 2) העתקת תמונות לדלי הגיבוי (רק מה שעדיין לא שם)
    const listed = await fetch(`${URL_}/storage/v1/object/list/${BACKUP_BUCKET}`, {
      method: "POST", headers: H, body: JSON.stringify({ prefix: "", limit: 10000 }),
    });
    const existing = new Set(listed.ok ? (await listed.json()).map((o) => o.name) : []);
    const names = new Set();
    for (const a of ads) for (const u of [a.image_url, a.pending_image_url]) {
      const p = u && u.split(`/${BUCKET}/`)[1]; if (p) names.add(p);
    }
    let copied = 0, failed = 0;
    for (const name of names) {
      if (existing.has(name)) continue;
      const c = await fetch(`${URL_}/storage/v1/object/copy`, {
        method: "POST", headers: H,
        body: JSON.stringify({ bucketId: BUCKET, sourceKey: name, destinationBucket: BACKUP_BUCKET, destinationKey: name }),
      });
      if (c.ok) copied++; else failed++;
    }

    return res.status(200).json({ ok: true, ads: ads.length, images_total: names.size, images_copied: copied, images_failed: failed });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
}
