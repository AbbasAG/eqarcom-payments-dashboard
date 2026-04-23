# EQARCOM Dashboard — Security Runbook

Operational procedures for the EQARCOM Usage Dashboards platform, aligned with
ADSIC (Abu Dhabi Information Security Standards) and UAE PDPL
(Federal Decree-Law 45/2021).

---

## 1. Data architecture

Sensitive extracts NEVER live in the website repository or on GitHub Pages.
They live exclusively in **Firebase Cloud Storage** under the `/private/`
prefix, and are served to the browser only after Firebase Authentication
plus a permission check evaluated by Storage Security Rules.

| Extract             | Storage path               | Accessible to                                        |
|---------------------|----------------------------|------------------------------------------------------|
| Payments / bookings | `private/data.json`        | Users with `payments` OR `serviceBookings` (or admin)|
| Maintenance tickets | `private/tickets.json`     | Users with `serviceBookings` (or admin)              |
| Units / leases      | `private/eqarat_data.js`   | Users with `managementDashboard` (or admin)          |

Rules: see [`storage.rules`](storage.rules) and [`firestore.rules`](firestore.rules).

---

## 2. Uploading a fresh extract (standard workflow)

1. Sign in at <https://eqdashboards.com/> as an admin account.
2. Navigate to **User Management** (admin icon in the header).
3. Under **Upload Data Extracts**, click **Choose & Upload** next to the
   file you want to replace.
4. Pick the local `.json` (or `.js` for `eqarat_data`). The page will:
   - validate file size (≤ 50 MB) and JSON structure client-side
   - upload via the Firebase Storage SDK over HTTPS
   - show the new "Last updated" timestamp on success
5. Refresh any open dashboard tabs; they will pick up the new data on next load.

That is the entire workflow. **Do not** place the files in the repo, do not
commit them, do not paste them into chat / tickets / email.

---

## 3. First-time Firebase configuration (one-time, already done ⇒ skip)

```bash
# From the repo root
firebase login
firebase use eqarcom-dashboard

# Deploy Storage + Firestore rules
firebase deploy --only storage,firestore:rules
```

Enable Cloud Storage for the project via
<https://console.firebase.google.com/project/eqarcom-dashboard/storage> if
it is not already enabled. The default bucket
(`eqarcom-dashboard.firebasestorage.app`) is what the app points to.

### API key restriction (recommended, not yet applied)

In Google Cloud Console → APIs & Services → Credentials, edit the Browser
API key used by the Firebase web app and set **Application restrictions =
HTTP referrers**, allowing only `https://eqdashboards.com/*`.

---

## 4. Breach containment checklist (one-time remediation after VAPT)

The files `data.json`, `tickets.json`, and `eqarat_data.js` were previously
served publicly and committed to a **public** GitHub repository
(`AbbasAG/eqarcom-payments-dashboard`). The data must be treated as
already compromised. Do the following, in order:

1. **Make the GitHub repo private** immediately.
   <https://github.com/AbbasAG/eqarcom-payments-dashboard/settings>
2. **Remove the files from git history** using `git filter-repo`:
   ```bash
   # Install first if needed: brew install git-filter-repo
   git filter-repo --invert-paths \
     --path data.json \
     --path tickets.json \
     --path eqarat_data.js
   git push --force-with-lease origin main
   ```
3. **Ask GitHub to purge cached blobs.** Filter-repo rewrites history, but
   GitHub's content-addressable store keeps unreachable blobs around until
   they are GC'd. Open a request at
   <https://support.github.com/contact/privacy> referencing the specific
   commit SHAs that contained the files.
4. **Confirm the live site no longer serves the old paths.** Expect 404:
   ```bash
   curl -I https://eqdashboards.com/data.json      # → 404
   curl -I https://eqdashboards.com/tickets.json   # → 404
   curl -I https://eqdashboards.com/eqarat_data.js # → 404
   ```
5. **Revoke any existing Firebase sessions** so that the new rules take
   effect immediately:
   ```bash
   # Forces all users to re-authenticate
   firebase auth:export users.json
   # Then, in the console, disable + re-enable or reset passwords for
   # accounts you want to force off.
   ```
6. **Breach notification.** Under UAE PDPL Art. 9, a personal-data breach
   that is likely to harm data subjects must be notified to the UAE Data
   Office and affected individuals. Engage legal counsel; the public
   exposure of tenant names, emails, mobile numbers, unit addresses, and
   financial records will likely cross the notification threshold.
7. **Credential reset guidance to tenants.** Recommend tenants monitor for
   phishing and SMS scams using the leaked data.

---

## 5. Hardening backlog (tracked separately)

These are not blocking Item 1 but should be scheduled:

- [ ] Deploy `storage.rules` and the updated `firestore.rules`
      (`firebase deploy --only storage,firestore:rules`).
- [ ] Enforce the API-key HTTP-referrer restriction.
- [ ] Move off GitHub Pages to Firebase Hosting (gives you control over
      security headers: CSP, HSTS, XCTO, Referrer-Policy, Permissions-Policy).
- [ ] Raise password minimum to 12 characters; enable Firebase MFA for
      admins (requires Identity Platform upgrade).
- [ ] Publish `/.well-known/security.txt` with a vulnerability-disclosure
      contact.
- [ ] Turn on Firebase App Check (reCAPTCHA Enterprise) to block
      non-browser clients from hitting Firestore / Storage with the public
      API key.
- [ ] Re-run the VAPT after changes.

---

## 6. Emergency contacts

- **Product owner / admin:** `abbas.hayat@al-ghurair.com`
- **Security issue disclosure:** create `/.well-known/security.txt`
  before publishing externally.
- **Firebase console:** <https://console.firebase.google.com/project/eqarcom-dashboard>
