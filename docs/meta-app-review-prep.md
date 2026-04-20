# Meta App Review — Submission Prep

**Status**: Prep doc — not yet submitted
**Owner**: Florian Krueger
**Last updated**: 2026-04-14
**Related spec**: `docs/facebook-listener-spec.md`

## Why this doc

Meta's app-review process is the critical-path blocker on shipping the Facebook Listener (see spec §6 "Security & compliance"). Typical turnaround for **Page Public Content Access (PPCA)** and **Pages Read Engagement** is 4–6 weeks, with 1–2 rework cycles realistic. The code can be complete and sitting dark until review lands.

This doc contains:
1. The exact permissions/products to request.
2. Draft answers to every review question Meta asks.
3. A screencast script.
4. Privacy policy language to add to tako.software/privacy.
5. Submission checklist (what the user must do outside this repo).

## 1. Meta app setup

### 1.1 App type

**Business** app (not Consumer). Tako is a B2B CRM — Business gives access to Pages/Groups products without Instagram Basic Display overhead.

### 1.2 Business verification

**Required before submission.** Tako needs to complete **Business Verification** in Meta Business Manager.

What's needed (user task, outside this repo):
- Legal entity docs (GmbH registration extract, or equivalent).
- Business domain verification (DNS TXT record on tako.software).
- Business address, phone, tax ID.

Lead time: 1–3 business days once documents are uploaded.

### 1.3 Products to add to the app

| Product | Why | Permission scope |
|---|---|---|
| **Facebook Login for Business** | OAuth entry for org admins to grant Page access | — |
| **Pages API** | Read posts from Pages the org has access to or has been granted PPCA for | `pages_read_engagement`, `pages_show_list` |
| **Page Public Content Access** | Read public posts/comments from Pages the org does *not* administer (competitor monitoring, industry pages) | PPCA (product-level, not a scope) |

**NOT requested** (intentionally, per spec §2 non-goals):
- `pages_manage_posts` — we do not post on behalf of the user.
- `pages_messaging` — we do not send messages.
- `publish_to_groups` or any groups-write scope.
- `instagram_*` scopes — Instagram is a separate review in Phase 4.

#### Note on `public_profile` and `email`

As of PR #1, `backend/oauth/meta.py` also includes `public_profile` and `email` in the requested scope list. Neither is used by any Tako code path — there is no `/me` call, no email stored, no identity propagated into the user record. They are vestigial defaults from Facebook Login templates.

Recommendation: **drop both from the scope list before submitting to Meta**. Every extra scope the review surfaces is one more thing the reviewer may ask for justification on, and "we don't use it" is an awkward answer. One-line change in `backend/oauth/meta.py`:

```python
# Before
scopes: list[str] = ["public_profile", "email", "pages_show_list", "pages_read_engagement"]
# After
scopes: list[str] = ["pages_show_list", "pages_read_engagement"]
```

If for any reason you want to keep them (e.g., to reuse the access token for a future login flow that isn't on the Listener roadmap), add this paragraph to §2.1 as a preemptive answer to reviewer pushback:

> Tako requests `public_profile` and `email` as part of its standard Facebook Login for Business flow, used only to distinguish the authorizing admin in audit logs. These fields are never transmitted to third parties, never surfaced in any report, and are purged alongside all other Meta data when the user disconnects or requests deletion (see §4).

The code-trim path is cleaner. Left as a product decision.

### 1.4 App settings (to configure in Meta Developer console)

- **App Domains**: `tako.software`
- **Privacy Policy URL**: `https://tako.software/privacy` (must include the Listener section from §4 below)
- **Terms of Service URL**: `https://tako.software/terms`
- **Data Deletion URL**: `https://tako.software/data-deletion` (must respond to Meta's deletion callback — see §5)
- **Valid OAuth Redirect URIs**: `https://app.tako.software/api/oauth/meta/callback`
- **App Icon**: 1024×1024, Tako brandmark
- **Category**: Business and Pages

## 2. Review question answers (drafts)

Meta asks a standard battery of questions per permission. Answer every one as if reviewers have never used Tako. Be concrete about the user flow.

### 2.1 `pages_read_engagement`

> **How will your app use this permission?**

Tako is a B2B sales CRM. Campaign managers using Tako's Listener feature monitor public engagement on Facebook Pages relevant to their outreach campaigns (for example, industry news Pages, competitor Pages, or Pages the user's own organization runs).

Tako uses `pages_read_engagement` to:
1. Read the list of Pages the user has administrative access to, so they can select which Pages to include in a Listener.
2. Read posts and public comments on those selected Pages, on a scheduled poll (every 15–60 minutes per the user's configuration).
3. Surface matching posts — based on keywords and AI classification — to the campaign manager in the Tako web app as a task or digest entry.

Tako does not publish, react, or comment on behalf of the user. All engagement actions (replies, DMs, joining groups) are performed by the user manually inside Facebook's own interface.

> **What would a reviewer see after signing in?**

A Tako account with at least one test Meta Page connected. In Settings → Integrations → Meta, the reviewer clicks "Connect Meta" and authorizes. They are redirected back to Tako and shown a list of Pages they administer. They can then go to Campaigns → [test campaign] → Configure Listener and select Pages from this list. Within 60 seconds of a new post on a selected Page, the reviewer will see a hit appear in the Listener's hits feed.

### 2.2 `pages_show_list`

> **How will your app use this permission?**

Tako uses `pages_show_list` to display the list of Pages the authenticated user administers, so they can choose which Pages to monitor with a Listener. Without this permission, the user would have to paste Page IDs manually, which is error-prone and a poor UX.

The Page list is shown only to the user who authorized the connection and only within their own Tako organization. It is not shared, sold, or made visible to other Tako customers.

### 2.3 Page Public Content Access (product-level)

> **Use case**

Tako's Listener feature includes a competitor-monitoring and industry-listening workflow. B2B sales teams need to know when relevant conversations happen on public Pages they do not own — e.g., a competitor Page where a prospect is complaining, or an industry-news Page where prospects are asking for recommendations.

PPCA enables Tako to read public posts and public top-level comments on Pages the user specifies by URL or name. The user adds these Pages to a Listener's source list. Tako polls them on the same schedule as user-administered Pages.

> **Why we cannot use a different product**

The alternative — requiring users to manually check competitor Pages — defeats the purpose of an automated listener. Public posts on public Pages are the target; PPCA is the only compliant way to read them programmatically.

> **How we protect user privacy**

- We only read content that is already public (visible to any logged-out Facebook user).
- We do not read, store, or process content from private profiles, groups, or DMs.
- We display matching posts to the Tako customer only; we do not republish or share them externally.
- We respect deletion: if a post is removed on Facebook, it's removed from our system within 24 hours via our rescore job.

### 2.4 Data handling and retention

> **What data do you store, for how long, and why?**

| Data | Retention | Reason |
|---|---|---|
| Meta OAuth access token + refresh token | Until user disconnects or token revoked | Required to poll Pages on schedule |
| Page metadata (ID, name, url) | Until user removes Page from Listener | UI display and scheduled polling |
| Post content (text, author name, URL, timestamp) | 90 days default, configurable per org | Historical context for campaign manager; classifier re-run on borderline confidence |
| Author profile URL | 90 days | Deep-linking so the manager can act manually in FB |
| Classifier output (category, confidence, sentiment) | Same as post | Shown in hits feed and digest |

Deletion: responding to Meta's data-deletion callback deletes all of the above for the specified user within 24 hours.

## 3. Screencast script

Meta requires a screencast for every permission demonstrating the actual user flow. Record at 1280×720 minimum, ~3–5 minutes total. Single take preferred; narrate as you go.

**Prerequisites (set up before recording):**
- A Tako test account with at least one team member.
- A Meta account that administers at least one Page with recent public posts.
- A second Meta Page (not administered) used for PPCA demo — e.g., a public industry Page.
- Frontend listener UI live (`ListenersPage.jsx` per spec §5) and the Phase 1 backend deployed.

**Script:**

1. **(0:00–0:20)** Open Tako at `app.tako.software`. Log in. Show the dashboard. Say: "This is Tako, a B2B sales CRM. I'm going to demonstrate how our Listener feature uses Meta permissions."

2. **(0:20–0:50)** Navigate to Settings → Integrations → Meta. Click "Connect Meta." Complete the Meta OAuth flow, granting `pages_show_list` and `pages_read_engagement`. Back in Tako, show the confirmation screen listing the Pages the test account administers. Say: "`pages_show_list` gives the user their own Page list so they can choose which to monitor. No other user in Tako can see this list."

3. **(0:50–1:30)** Go to Campaigns → New → select Facebook channel → save. Open the new Listener. Click "Add source." Select a user-administered Page from the dropdown. Save. Say: "`pages_read_engagement` will now read posts from this Page on a schedule."

4. **(1:30–2:15)** Click "Add source" again. This time paste the URL of a public industry Page the user does not administer. Save. Say: "For Pages the user doesn't own, Tako uses Page Public Content Access to read only public posts and public top-level comments — never private content."

5. **(2:15–3:00)** Open a new tab, go to Facebook, post a new public post on the user-administered Page with a keyword that matches the Listener's config (e.g., "looking for a CRM"). Wait 60s (fast-forward). Return to Tako, refresh the Listener's hits feed. Show the new hit with classification = "buying_signal," confidence, and a deep link back to Facebook. Say: "The matching post appears in the campaign manager's inbox as a task. Tako does not reply automatically — the manager clicks the link and responds on Facebook manually."

6. **(3:00–3:30)** Go to Settings → Integrations → Meta → click "Disconnect." Return to the Listener — show the hits feed is no longer updating. Go to `https://tako.software/data-deletion` and demonstrate the deletion request form. Say: "The user controls their data end to end. Disconnecting stops all polling; requesting deletion removes stored post content within 24 hours."

## 4. Privacy policy addendum

Add a new section to `tako.software/privacy` (required by Meta reviewers):

> ### Meta (Facebook) data
>
> When you connect your Meta account to Tako, we access and store only the data necessary to power the Listener feature:
>
> - **What we access**: (1) the list of Facebook Pages you administer, (2) posts and public top-level comments on Pages you select to monitor.
> - **What we do not access**: private messages, your friend list, your personal profile data, content from groups or private accounts, or Pages you did not select.
> - **How long we keep it**: post content is retained for 90 days by default (your organization administrator can shorten this). Your Meta access token is kept until you disconnect.
> - **How to remove it**: disconnect from Settings → Integrations → Meta at any time to stop collection. Submit a deletion request at [tako.software/data-deletion](https://tako.software/data-deletion) or email privacy@tako.software to erase previously collected data.
> - **Who sees it**: only members of your Tako organization. We do not sell, share, or use this data for advertising.
> - **Automation boundary**: Tako's Listener is read-only. Tako never posts, comments, messages, reacts, or joins groups on your behalf. You perform all Facebook engagement actions manually.

## 5. Data Deletion Callback

Meta requires a callback endpoint that receives a signed request when a user removes the Tako app from their Meta account. Add this endpoint to the backend as part of Meta OAuth wrap-up:

```
POST /api/webhooks/meta/data-deletion
```

Body: `signed_request` (Meta-signed, contains `user_id`).

Response must be JSON: `{"url": "...status page...", "confirmation_code": "..."}`.

Implementation:
1. Verify the signed request using `META_APP_SECRET`.
2. Extract Meta `user_id` → look up Tako user via `org_integrations.oauth_tokens.meta.user_id`.
3. Enqueue a background job that deletes: OAuth token, all `listener_hits` authored by posts this user's Pages produced (the user's Pages content), the org-level source subscription only if this was the sole admin.
4. Return a status URL like `https://app.tako.software/account/data-deletion/{confirmation_code}` and a unique `confirmation_code`.
5. Persist the request in a `data_deletion_requests` collection for audit.

**Note on scope**: per Meta's spec, this deletes *this user's* data, not their org's. If the user is the only Meta admin in the org, the Listener is paused and the org is notified to reconnect.

## 6. Submission checklist

User tasks (can't be done from this repo):

- [ ] Create new Meta app "Tako CRM" in Meta Developer console (Business type).
- [ ] Complete Business Verification (upload legal docs, verify domain).
- [ ] Set all app settings from §1.4.
- [ ] Publish privacy policy update from §4 to `tako.software/privacy`.
- [ ] Publish data-deletion landing page at `tako.software/data-deletion`.
- [ ] Add environment vars to production: `META_APP_ID`, `META_APP_SECRET`, `META_GRAPH_API_VERSION` (pin to `v19.0` or whatever is current).
- [ ] Deploy Phase 1 backend (PR #1) and frontend (pending PR) to staging.
- [ ] Record screencast per §3. Upload as unlisted YouTube or direct file.
- [ ] In Meta Developer console → App Review → Permissions and Features, request the three items from §1.3. Paste §2 answers. Attach screencast. Submit.
- [ ] After initial review, respond to any rework requests within 72 hours to keep the review warm.

Engineering tasks:

- [x] Implement `/api/webhooks/meta/data-deletion` endpoint. — PR #4 (`backend/listeners/data_deletion.py`)
- [x] Implement confirmation lookup page + status endpoint. — PR #4 (`/data-deletion/:code` on the app; status at `GET /api/account/data-deletion/{code}`)
- [x] Add `META_APP_ID` / `META_APP_SECRET` to `backend/oauth/meta.py` config. — PR #1
- [x] Decide on `public_profile` + `email` scopes (see §1.3 note). — PR #5 (trim to pages-only scopes after product sign-off)
- [ ] Add admin-facing audit log entry when a Listener auto-pauses due to token revocation — follow-up, not on the Meta-review critical path.
- [ ] Optional marketing-site `tako.software/data-deletion` that deep-links to the app endpoint above (a plain redirect is fine — the in-app page is already the functional one).

## 7. Timeline (target)

| Week | Milestone |
|---|---|
| 0 (now) | Business verification submitted; privacy/deletion pages drafted |
| 1 | Phase 1 backend merged (PR #1); frontend in progress |
| 2 | Frontend Listener UI complete on staging |
| 3 | Screencast recorded; app review submitted |
| 5–7 | Meta review rounds; address feedback |
| 8 | Approved; ship to GA |

Slippage is normal — budget an extra 2 weeks on top.

## 8. Risks

- **Business verification rejection**: usually due to document mismatch. Have a backup legal entity ready if the primary one has any discrepancy.
- **Screencast rejection**: the most common cause. Reviewers want to see the *exact* permission being exercised and a clear user flow. Re-record if anything is ambiguous.
- **PPCA scope skepticism**: Meta has been tightening PPCA grants since 2023. If denied, fall back plan is user-admin Pages only for v1 and adding public-page monitoring later via a vetted partner.
- **Token expiry**: long-lived Page tokens still expire. Ensure the poller handles `OAuthException` gracefully and creates a Tako task ("Reconnect Meta for Listener X") rather than silently failing.
