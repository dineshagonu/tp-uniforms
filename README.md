# T&P Uniforms — online uniform store

Flipkart-style mobile store for school, college, industrial and hospital uniforms.
**Next.js 14 (Vercel) + Supabase + Razorpay + Cash on Delivery.**

## What's inside
| Page | What it does |
|---|---|
| `/` Home | Pincode bar, search, category icons (For You · School · College · Industrial · Hospital), auto-scrolling slider of up to 10 school banners, **Select the school** row with logos & names |
| `/school/[slug]` | Pick class (Nursery → 10th) → pick item (Shirt, Pant, Short, Skirt, Chudidhar…) → size & qty → **Add to cart** |
| `/cart` | Cart, delivery address, **Pay online (Razorpay: UPI/cards/net banking)** or **Cash on Delivery** |
| `/order/[id]` | Order confirmation + status tracker |
| `/login`, `/account` | Login / sign-up with **Mobile OTP** or **Email + password** (switch tabs), forgot password, my orders |
| `/admin` | Add schools (logo + banner upload), add uniform items (photo upload, classes, sizes, price), manage orders & payment status |

Images are resized and converted to WebP in the browser before upload, so pages stay light on mobile data.

## 1. Supabase setup (10 min)
1. Create a project at supabase.com — choose region **Mumbai (ap-south-1)**.
2. **SQL Editor → New query** → paste all of `supabase/schema.sql` → **Run**.
   This creates tables, security rules, the `uniforms` image bucket and the 4 categories.
   **Already ran `schema.sql` earlier?** Also run `supabase/003_profile_details.sql` once (adds profile details, children, district).
3. **Authentication → Users → Add user** → your admin email + password (tick *Auto confirm*).
4. Back in SQL Editor run (with your email):
   ```sql
   update public.profiles set role = 'admin'
   where id = (select id from auth.users where email = 'sales@tandp.co.in');
   ```
5. **Authentication → URL Configuration**: Site URL = your Vercel domain; add `https://your-domain/**` to Redirect URLs.
6. **Email + password login (no email sent at login or sign-up)**: Authentication → Sign In / Providers → **Email** → keep Email enabled and turn **OFF "Confirm email"**. New customers then get logged in immediately after creating an account.
7. **Forgot password** is the only email ever sent. Supabase's built-in mailer allows ~2/hour, which is fine for occasional resets; for more, add free SMTP under Authentication → Emails → **SMTP Settings** (e.g. Zoho Mail with sales@tandp.co.in, or Gmail App Password: `smtp.gmail.com`, port `465`). Also add `https://your-domain/reset-password` to **URL Configuration → Redirect URLs**.
8. Set up mobile OTP login — see section 2.
9. Choose which login tabs show with `NEXT_PUBLIC_LOGIN_METHODS` (`email,mobile` now; `mobile,email` once SMS is live).

Admin login stays email + password (you create it manually in step 3, so no email is sent).

## 2. Mobile OTP login (parents log in with phone number)
Supabase creates and checks the OTP. Your app sends the SMS through an Indian provider, so Supabase's email limit doesn't apply.

**a) SMS provider (DLT is mandatory in India)**
- **MSG91** (recommended): sign up → get **Auth Key** → register sender ID + OTP template on DLT (MSG91 helps with this) → create an OTP template containing `##OTP##`, e.g.
  `Your T&P Uniforms login OTP is ##OTP##. Valid for 10 minutes. Do not share. - TANDP TEXTILES` → copy its **Template ID**.
- **2Factor.in** (quicker to start): sign up → API key. They offer ready DLT-approved OTP templates; set `SMS_PROVIDER=2factor`.
- Cost is roughly ₹0.15–0.25 per OTP SMS.

**b) Supabase dashboard**
1. **Authentication → Sign In / Providers → Phone** → Enable. Turn **off** "Confirm phone" only if you don't want verification (keep it on).
2. **Authentication → Hooks → Add hook → Send SMS hook** → type **HTTPS** → URL `https://your-domain/api/auth/sms-hook` → **Generate secret** → copy it into Vercel as `SEND_SMS_HOOK_SECRET` (full value, starting `v1,whsec_`).
3. **Authentication → Rate Limits** → raise **SMS messages sent per hour** (e.g. 1000) for busy school-launch days. Each number can request a new OTP once per 60 s.
4. Already ran `schema.sql` earlier? Also run `supabase/002_phone_login.sql` once.

The hook only sends to Indian mobile numbers (+91, starting 6–9), which blocks SMS-fraud traffic to foreign numbers.

## 3. Razorpay setup
1. Sign up at razorpay.com, complete KYC (needs GST/PAN + bank account of TANDP TEXTILES).
2. **Account & Settings → API Keys** → generate Test keys first.
3. **Webhooks → Add**: URL `https://your-domain/api/payment/webhook`, secret = any long random text, events: `payment.captured`, `payment.failed`, `order.paid`.
4. When testing is done, switch to Live keys in Vercel.

## 4. Deploy on Vercel
1. Push this folder to a GitHub repo (same way as your ERP).
2. Vercel → **Add New Project** → import the repo (framework auto-detected: Next.js).
3. **Environment Variables** — copy every key from `.env.example` and fill real values.
4. Deploy. Add your domain (e.g. `shop.tandp.co.in`) under Project → Domains.

Local run: `npm install` → copy `.env.example` to `.env.local` → `npm run dev`.

## 5. Daily use
1. Open `/admin` → **Schools → + Add school**: name, city, category, logo, banner, tick *Show in home slider* (max 10).
2. **Products** → choose the school → **+ Add item**: type, classes it fits, sizes (`22, 24, 26`), price, photo. Use **Duplicate** to copy an item for another class range quickly.
3. **Orders**: new orders appear here. Change status (Confirmed → In production → Shipped → Delivered). For COD, set payment to *Paid* after cash is collected.

## Built for 1000+ shoppers at once
- Home, school and category pages are cached at Vercel's edge and refreshed every 60 s (admin saves refresh instantly), so a rush of parents doesn't hit the database for each visit.
- Only checkout touches the server, and prices are always recalculated from the database — a customer can never change a price or mark an order paid.
- Row-level security in Supabase: customers only see their own orders; only admins can edit catalogue or upload images.
- Payment is confirmed two ways (browser callback + Razorpay webhook) so no paid order is missed.
- For very large school launches, Supabase Pro ($25/mo) raises connection and email limits; Vercel Hobby is fine to start, move to Pro for commercial use as per Vercel's terms.

## Delivery location & pincode
- Header and checkout have **Use my current location** (phone GPS → pincode + village via OpenStreetMap) or type a **pincode** → list of villages/towns, mandal, district and state (India Post directory). Results are cached at Vercel.
- New customers fill a **profile** once after first login: name, mobile, alternate/WhatsApp number, email, address with pincode → village, and optional children (name, boy/girl, school, class). Checkout fills from it automatically.

## Changing rules
Edit in Vercel env vars, then redeploy: `SHIPPING_FEE`, `FREE_SHIPPING_ABOVE`, `COD_ENABLED`, `COD_MAX_AMOUNT`.
