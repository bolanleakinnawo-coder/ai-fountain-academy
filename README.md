# AI Fountain Academy

A premium video-course platform for practical AI skills. It's built with plain HTML, CSS and JavaScript, uses Firebase for the backend, and takes payments through Paystack.

- **Public site:** landing page with a "See it in action" preview that expands to full screen, course catalogue, and a page for each course.
- **Accounts:** signup, login (email and password, plus optional Google sign-in), and password reset.
- **Learner dashboard:** hot course banner, Continue Learning, enrolled courses with search, Explore courses and a categories carousel.
- **Learning page:** video player, lesson list, Previous and Next buttons, auto-resume, Mark as complete, and progress tracking.
- **Payments:** Paystack checkout. The server verifies every payment before it unlocks a course.
- **Protected video:** lesson videos live in private storage. Each lesson plays only through a short-lived link issued after an ownership check.
- **Admin:** overview with real stats, courses (create, edit, publish, delete), lessons (upload, reorder, publish), users (grant or revoke access with an audit trail), purchases, and site settings.

---

## 0. See it right now (no setup)

**Don't double-click the HTML files.** Browsers block a site's scripts when a page is opened from disk, so it looks broken. Run it through a local server instead. The quickest way is VS Code with the **Live Server** extension: right-click `public/index.html`, then choose **Open with Live Server**. Other options are in `HOW-TO-PREVIEW.txt`, including double-click scripts for Windows and Mac.

Until you paste your Firebase config into `public/assets/js/config.js`, the site runs in **preview mode** on sample data. You can sign up with any email, see the dashboard, open courses and play the sample lesson. Nothing is saved, and payments and admin stay off. Preview mode switches itself off once the real config is in place.

All links and file paths are relative, so the site works at a domain root, in a subfolder and on Firebase Hosting.

## 1. Folder structure

```
ai-fountain-academy/
├── public/                     Everything the browser loads (Firebase Hosting)
│   ├── index.html              Landing page
│   ├── courses.html            All courses
│   ├── course.html             Course details (course.html?slug=<slug>)
│   ├── signup.html, login.html, reset-password.html
│   ├── dashboard.html          Learner dashboard
│   ├── learn.html              Video learning page (learn.html?slug=<slug>)
│   ├── account.html            Profile, password, purchase history
│   ├── checkout-callback.html  Paystack return page
│   ├── contact.html, privacy.html, terms.html, 404.html
│   ├── admin/                  index, courses, course, lessons, users, purchases, settings
│   └── assets/
│       ├── css/                core (design system), landing, pages, auth, app, learn, admin
│       ├── js/
│       │   ├── config.js       ← put your Firebase web config here
│       │   ├── firebase.js     SDK setup
│       │   ├── auth.js         sessions, login/register, route guards
│       │   ├── data.js         Firestore reads/writes for learners
│       │   ├── api.js          calls to Cloud Functions
│       │   ├── ui.js           loader, toasts, dialogs, nav/footer, text + scroll animations
│       │   ├── components.js   course cards (one source for every page)
│       │   ├── app-shell.js, admin-shell.js, forms.js
│       │   └── pages/          one script per page
│       ├── img/thumbs/         the 6 course thumbnails (1280×720 PNG)
│       └── video/              hot-course preview clip (mp4 + webm)
├── functions/                  Cloud Functions (Node 20): payments, video, admin
│   ├── src/paystack.js         Paystack client + payment checks (unit tested)
│   ├── src/payments.js         startCheckout, verifyPayment, paystackWebhook
│   ├── src/video.js            getPlaybackUrl (signed URLs after entitlement check)
│   ├── src/admin.js            grant/revoke access, delete course/lesson
│   └── test/                   node --test
├── scripts/                    seed.js (6 courses), make-admin.js, courses.seed.json
├── tools/                      thumbs.html + promo.html used to render thumbnails and the preview clip
├── firestore.rules, storage.rules, firestore.indexes.json, firebase.json
```

## 2. How security works

The browser only asks; the server decides.

| What | Who can do it | Enforced by |
|---|---|---|
| Read published courses and lesson titles | Everyone | Firestore rules |
| Create, edit or delete courses and lessons, upload videos | Admins only | Firestore and Storage rules check the `admin` custom claim |
| Become an admin | Only someone running `scripts/make-admin.js` with a service-account key | Auth custom claims can't be set from the browser |
| Write entitlements (course access) or payments | Nobody in the browser | Rules deny it; only Cloud Functions write these |
| Watch a lesson video | Signed-in users with an active entitlement, plus admins | `getPlaybackUrl` checks login, that the course and lesson exist and are published, and that the user has an entitlement, then returns a 2-hour signed URL. The video files themselves are unreadable in Storage rules. |
| Unlock a course after payment | Paystack-verified payments only | Webhook HMAC-SHA512 signature check, then Paystack's Verify API, then a check that amount, currency, user and course match. A Firestore transaction makes processing idempotent. |

Page redirects, such as sending a logged-out user to /login, exist only for convenience. Typing a URL or editing local storage can't unlock anything, because the data and videos are protected on the server.

No platform can stop someone screen-recording a video they're allowed to watch. Signed links stop people sharing links, not recording.

## 3. Setup (about 30 minutes)

### 3.1 Install tools
- [Node.js 20+](https://nodejs.org)
- Firebase CLI: `npm install -g firebase-tools`, then `firebase login`

### 3.2 Create the Firebase project
1. Go to https://console.firebase.google.com and create a project, for example `ai-fountain-academy`.
2. **Upgrade to the Blaze (pay-as-you-go) plan.** Cloud Functions require it, and small sites usually stay inside the free allowance. Set a **budget alert** under Google Cloud Billing → Budgets.
3. **Authentication:** turn on the Email/Password provider. Turn on Google too if you want "Continue with Google".
4. **Firestore Database:** create it in production mode. Pick a region close to your users, such as `europe-west1`.
5. **Storage:** create the default bucket.
6. **Project settings → Your apps → Web app:** register an app, then copy the config into `public/assets/js/config.js`.

### 3.3 Link this folder
```bash
cp .firebaserc.example .firebaserc      # then put your project id inside
cd functions && npm install && cd ..
cd scripts && npm install && cd ..
```

### 3.4 Secrets and environment

| Name | Where | What |
|---|---|---|
| `PAYSTACK_SECRET_KEY` | Secret Manager: `firebase functions:secrets:set PAYSTACK_SECRET_KEY` | Your Paystack secret key (`sk_test_…` while testing, `sk_live_…` for real payments) |
| `APP_BASE_URL` | `functions/.env` (copy from `.env.example`) | Your site URL, such as `https://your-project.web.app`. Paystack sends buyers back to `<APP_BASE_URL>/checkout-callback.html`. |
| `PLAYBACK_URL_MINUTES` | `functions/.env` | How long signed video links last (default 120) |
| Firebase web config | `public/assets/js/config.js` | Public by design |

The Paystack public key isn't needed because checkout uses Paystack's hosted page. Never put the secret key in any file under `public/`.

### 3.5 Allow signed video URLs (one-time)
`getPlaybackUrl` signs URLs with the Functions service account, which needs permission to sign:

Google Cloud Console → IAM → find the **default compute service account** (`<project-number>-compute@developer.gserviceaccount.com`) → add the role **Service Account Token Creator**.

### 3.6 Deploy
```bash
firebase deploy --only firestore:rules,firestore:indexes,storage,functions,hosting
```
Indexes take a few minutes to build. Queries may fail with "index required" until they finish.

### 3.7 Seed the six courses and make yourself admin
1. Firebase console → Project settings → Service accounts → **Generate new private key**. Save it as `scripts/service-account.json`, which is git-ignored. Never share it.
2. Run:
```bash
cd scripts
GOOGLE_APPLICATION_CREDENTIALS=./service-account.json node seed.js
```
3. Sign up on your live site with your own email, then:
```bash
GOOGLE_APPLICATION_CREDENTIALS=./service-account.json node make-admin.js you@example.com
```
4. Log out and back in. You'll land on the admin dashboard (`admin/index.html`).

### 3.8 Paystack webhook
In the Paystack dashboard → Settings → API Keys & Webhooks, set the **Webhook URL** to:
```
https://<your-domain>/api/paystack/webhook
```
`firebase.json` routes this to the `paystackWebhook` function. If you use the direct function URL instead, it's printed after deploy.

## 4. Adding content
1. **Admin → Courses & lessons → Lessons:** add a lesson, give it a title and description, upload the video file (MP4 works best) and set it to *Published*. Lesson lengths are read from the file automatically.
2. Reorder lessons by dragging, or with the arrows.
3. **Admin → Site settings:** upload your real "See it in action" clip. Until you do, the landing page uses the built-in 20-second motion preview in `public/assets/video/`.
4. **Admin → Courses → Edit:** change prices, text, thumbnails, the hot course and the display order. **The seeded prices are placeholders** (₦25,000 for the flagship and ₦15,000 for the others), so set your real prices before launch.

Each course page shows its **lesson list** once published lessons exist. Until then, it shows the topic list from the course's "Course content topics" field.

## 5. Testing payments
1. Use `sk_test_…` keys and Paystack's test cards: https://paystack.com/docs/payments/test-payments
2. Test a successful payment: the callback shows "Payment confirmed", the course appears on the dashboard and lessons play.
3. Test a declined or cancelled payment: the callback shows "unsuccessful" or "not completed", and the course stays locked.
4. Test a duplicate webhook: resend the event from the Paystack dashboard. Nothing changes, because processing is idempotent.
5. Test bypass attempts while logged out or as a non-owner: open `learn.html?slug=<slug>` and you'll see a locked screen. Calling `getPlaybackUrl` returns `permission-denied`. Opening a `lesson-videos/...` storage path returns 403.

Unit tests for the payment checks:
```bash
cd functions && npm test
```

## 6. Local development (optional)
```bash
firebase emulators:start
```
On `localhost`, `config.js` points the site at the emulators automatically. Open http://localhost:5000.

## 7. Before launch checklist
- [ ] Real prices set in Admin
- [ ] Real lesson videos uploaded and published
- [ ] Real preview clip uploaded (Admin → Site settings)
- [ ] Support email updated in `config.js`, `contact.html`, `privacy.html` and `terms.html`
- [ ] Privacy Policy and Terms reviewed. They're templates, and the refund line in Terms is a placeholder.
- [ ] Paystack live keys set, the business verified, and the webhook URL saved
- [ ] Custom domain connected (Hosting → Add custom domain), with `APP_BASE_URL` updated and functions redeployed
- [ ] Budget alert set in Google Cloud

## 8. Regenerating thumbnails or the preview clip
`tools/thumbs.html` and `tools/promo.html` are plain HTML designs. To regenerate them, open them in Chrome and screenshot or record them, or render them with Playwright:
```bash
npx playwright install chromium
node tools/render-thumbs.js
node tools/render-promo.js   # then convert the .webm with ffmpeg if you need mp4
```
