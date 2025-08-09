// =============================================
// BACKEND (Node.js / Express) — server.js
// =============================================
// Now with MongoDB persistence for users + config
// Endpoints:
//  GET  /api/me                        -> premium status
//  GET  /api/status                   -> config/status report (safe subset)
//  POST /api/create-checkout-session   -> Stripe Checkout (tier + period)
//  POST /api/stripe/webhook            -> Stripe webhook (raw body)
//  POST /api/support                   -> simple AI helper routes
//  POST /api/admin/config              -> update config (requires ADMIN_TOKEN)

import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import Stripe from "stripe";
import mongoose from "mongoose";

const stripe = new Stripe(process.env.STRIPE_SECRET || "");
const app = express();
app.use(cors());
app.use(express.json());

// ---- MongoDB ----
const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.warn("[WARN] MONGODB_URI not set — using in-memory fallback");
}

let UserModel, ConfigModel;
const userSchema = new mongoose.Schema({
  userId: { type: String, unique: true, index: true },
  premium: { type: Boolean, default: false },
  vip: { type: Boolean, default: false },
  dark: { type: Boolean, default: false },
  tier: { type: String, default: null },
}, { timestamps: true });

const configSchema = new mongoose.Schema({
  singleton: { type: String, default: "cfg", unique: true },
  adsenseClientId: { type: String, default: null },
  prices: {
    premium: { M1: String, M3: String, M6: String, M12: String },
    ultra:   { M1: String, M3: String, M6: String, M12: String },
  },
}, { timestamps: true });

async function initDb() {
  if (!MONGODB_URI) return;
  await mongoose.connect(MONGODB_URI, { dbName: process.env.MONGODB_DB || "flirtychat" });
  UserModel = mongoose.model("User", userSchema);
  ConfigModel = mongoose.model("Config", configSchema);
}

// In-memory fallbacks if DB not set
const memUsers = new Map();
let memConfig = {
  adsenseClientId: null,
  prices: { premium: { M1: null, M3: null, M6: null, M12: null }, ultra: { M1: null, M3: null, M6: null, M12: null } },
};

async function getConfig() {
  if (ConfigModel) {
    let doc = await ConfigModel.findOne({ singleton: "cfg" });
    if (!doc) { doc = await ConfigModel.create({ singleton: "cfg", prices: { premium: {}, ultra: {} } }); }
    return doc;
  }
  return memConfig;
}
async function saveConfig(partial) {
  if (ConfigModel) {
    const doc = await getConfig();
    if (partial.adsenseClientId !== undefined) doc.adsenseClientId = partial.adsenseClientId;
    if (partial.prices) {
      doc.prices = { ...doc.prices, ...partial.prices };
    }
    await doc.save();
    return;
  }
  memConfig = { ...memConfig, ...partial, prices: { ...memConfig.prices, ...(partial.prices||{}) } };
}

async function getOrCreateUser(userId) {
  if (UserModel) {
    let u = await UserModel.findOne({ userId });
    if (!u) u = await UserModel.create({ userId });
    return u;
  }
  if (!memUsers.has(userId)) memUsers.set(userId, { userId, premium: false, vip: false, dark: false, tier: null });
  return memUsers.get(userId);
}
async function updateUser(userId, patch) {
  if (UserModel) {
    await UserModel.updateOne({ userId }, { $set: patch }, { upsert: true });
    return;
  }
  const u = await getOrCreateUser(userId);
  memUsers.set(userId, { ...u, ...patch });
}

function getPriceIdFromEnv(tier, months) {
  if (tier === 'premium') {
    if (months === 1) return process.env.PRICE_PREMIUM_M1;
    if (months === 3) return process.env.PRICE_PREMIUM_M3;
    if (months === 6) return process.env.PRICE_PREMIUM_M6;
    if (months === 12) return process.env.PRICE_PREMIUM_M12;
  }
  if (tier === 'ultra') {
    if (months === 1) return process.env.PRICE_ULTRA_M1;
    if (months === 3) return process.env.PRICE_ULTRA_M3;
    if (months === 6) return process.env.PRICE_ULTRA_M6;
    if (months === 12) return process.env.PRICE_ULTRA_M12;
  }
  return null;
}

async function getPriceId(tier, months) {
  const cfg = await getConfig();
  const key = `M${months}`;
  const fromCfg = cfg?.prices?.[tier]?.[key];
  return fromCfg || getPriceIdFromEnv(tier, months);
}

// --- Middleware ---
function withUser(req, res, next) {
  const uid = req.header("X-User-Id");
  if (!uid) return res.status(400).json({ error: "Missing X-User-Id" });
  req.userId = uid;
  next();
}

// --- Routes ---
app.get("/api/me", withUser, async (req, res) => {
  const u = await getOrCreateUser(req.userId);
  res.json({ premium: u.premium, vip: u.vip, dark: u.dark, tier: u.tier });
});

app.get("/api/status", async (req, res) => {
  const cfg = await getConfig();
  const have = (v) => !!v && typeof v === 'string';
  const status = {
    adsenseClientId: have(cfg.adsenseClientId),
    prices: {
      premium: { M1: have(await getPriceId('premium',1)), M3: have(await getPriceId('premium',3)), M6: have(await getPriceId('premium',6)), M12: have(await getPriceId('premium',12)) },
      ultra:   { M1: have(await getPriceId('ultra',1)),   M3: have(await getPriceId('ultra',3)),   M6: have(await getPriceId('ultra',6)),   M12: have(await getPriceId('ultra',12)) },
    }
  };
  res.json({ status });
});

app.post("/api/support", withUser, async (req, res) => {
  const { prompt } = req.body || {};
  if (prompt === "1") { await updateUser(req.userId, { premium: true }); return res.json({ message: "Premium refreshed. Reload the page.", refresh: true }); }
  if (prompt === "2") { return res.json({ message: "Limit resets in 30 minutes or on reload.", refresh: false }); }
  if (prompt === "3") { await updateUser(req.userId, { dark: true }); return res.json({ message: "Dark mode enabled.", refresh: true }); }
  return res.json({ message: "Logged your issue. We'll follow up if needed." });
});

app.post('/api/admin/config', async (req, res) => {
  const token = req.header('X-Admin-Token');
  if (!process.env.ADMIN_TOKEN) return res.status(400).json({ error: 'Server missing ADMIN_TOKEN' });
  if (token !== process.env.ADMIN_TOKEN) return res.status(403).json({ error: 'Invalid admin token' });
  const { adsenseClientId, prices } = req.body || {};
  const patch = {};
  if (adsenseClientId !== undefined) patch.adsenseClientId = adsenseClientId || null;
  if (prices && typeof prices === 'object') patch.prices = prices;
  await saveConfig(patch);
  return res.json({ ok: true });
});

app.post("/api/create-checkout-session", withUser, async (req, res) => {
  try {
    const { tier = "premium", periodMonths = 1 } = req.body || {};
    const price = await getPriceId(tier, periodMonths);
    if (!price) return res.status(400).json({ error: "Invalid plan selection (price id missing)" });

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price, quantity: 1 }],
      success_url: `${req.headers.origin || "http://localhost:5173"}/?success=true`,
      cancel_url: `${req.headers.origin || "http://localhost:5173"}/?canceled=true`,
      metadata: { userId: req.userId, tier, periodMonths: String(periodMonths) },
      allow_promotion_codes: true,
      billing_address_collection: "auto",
      subscription_data: { trial_period_days: 0 },
      automatic_tax: { enabled: true },
      customer_creation: "if_required",
    });

    res.json({ url: session.url });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Stripe error" });
  }
});

// IMPORTANT: raw body ONLY for webhook
app.post("/api/stripe/webhook", bodyParser.raw({ type: "application/json" }), async (req, res) => {
  const sig = req.headers["stripe-signature"]; 
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.WEBHOOK_SECRET);
  } catch (err) {
    console.error("Webhook signature verification failed.", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const { userId, tier } = session.metadata || {};
    if (userId) {
      await getOrCreateUser(userId);
      await updateUser(userId, { premium: true, vip: tier === "ultra", tier });
      console.log("User upgraded:", userId, tier);
    }
  }

  res.json({ received: true });
});

const PORT = process.env.PORT || 5174;
initDb().then(()=>{
  app.listen(PORT, () => console.log(`API running on :${PORT}`));
});
