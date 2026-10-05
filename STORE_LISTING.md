# Chrome Web Store listing

The source of truth for the store listing text. The store does not read this file:
paste each block into the Chrome Web Store developer dashboard (Store listing tab)
whenever it changes here.

The listing title and short summary are not pasted either. They are `displayName`
(75 characters max) and `description` (132 characters max) in `package.json`, which
Plasmo writes into the manifest as `name` and `description`. The manifest's website link is
`homepage` in `package.json`.

## Rules for editing

- Describe only what ships on `main`. Remove a feature here in the same PR that
  removes it from the extension.
- No prices, credit amounts or daily limits: they change with the tier config and
  the listing would go stale. Link to the pricing page instead.
- Links go to `commentverdict.com` (the marketing site), never `app.`: the app
  domain sends logged-out visitors to a login page. Keep the `utm_` parameters so
  the admin Growth page can count visits that came from the store.
- Call the products by their names, "Comment Verdict" and "Mendi". Search engines
  decide brand queries largely by whether other sites use the same names.
- Mendi never posts for the user. Don't write copy that says or implies otherwise.

## Dashboard fields

| Field | Value |
|---|---|
| Official URL | `commentverdict.com` (needs the domain verified in Search Console) |
| Homepage URL | `https://commentverdict.com/?utm_source=chrome_web_store&utm_medium=listing&utm_campaign=homepage_field` |
| Support URL | `https://commentverdict.com/?utm_source=chrome_web_store&utm_medium=listing&utm_campaign=support_field` |
| Screenshots | Images 1–3: the existing verdict, side panel and report captures. Image 4: the Mendi screenshot (Reply Studio with a drafted reply and its cited comments, 1280×800). Added with the 2026-10 promo-card release; see "Mendi promo card" below. |

## Description

```text
Know whether a YouTube video is worth your time before you watch it. The same engine now drafts replies on X as Mendi: it reads real comments before it writes, shows you the sources, and never posts for you. Six months of the Voice tier free for early users: https://commentverdict.com/?utm_source=chrome_web_store&utm_medium=listing&utm_campaign=pilot1&utm_content=description_intro&promo=MENDI-PILOT

Comment Verdict reads the comment section, viewer signals and the transcript, then gives you an AI verdict on whether the video delivers what its title promises.

🛡️ SHOULD I WATCH THIS?
• Quick Verdict: a verdict such as legit, misleading or clickbait, shown as soon as you open a video. You can switch automatic analysis off in the popup.
• Verdict certainty: how confident the analysis is, based on how consistent the evidence is.
• Video and channel trust: credibility signals for the video and for the creator's track record.
• Evidence score: what viewers claim for and against the video, weighted by engagement.

📊 WHAT VIEWERS ARE SAYING
• Comment mood: whether the audience is satisfied, disappointed or mixed, not just a positive/negative split.
• Topic clusters: recurring themes grouped together, with the pain points and highlights viewers keep raising.
• Key takeaways: the main points from the comments in a few lines.

💬 GO DEEPER
• Chat with the report: ask the AI anything about the comments or the report.
• Meme generation: turn the comment section's mood into a shareable image.
• Export: download the report for research or to share with your team.

💡 FOR CREATORS AND RESEARCHERS
• Gap analysis: questions and requests from viewers that the video left unanswered.
• Relevancy analysis: what the audience says is missing compared with the transcript.

🚀 HOW IT WORKS
1. Open any YouTube video.
2. The Quick Verdict appears on its own. No account needed: choose "Continue as Visitor".
3. Sign in to open the full report in the side panel, chat with the AI, generate memes and export.

💳 PRICING
Start free. The Quick Verdict works without an account, and a free account comes with credits for the deep-dive features. You only spend credits on the features you run, and a failed analysis is refunded. Paid plans add monthly credits and let you analyse more comments per video.
See the plans: https://commentverdict.com/pricing?utm_source=chrome_web_store&utm_medium=listing&utm_campaign=description_pricing

🔒 PRIVACY
Comment Verdict analyses public YouTube data: comments, video details and transcripts. It is decision support, not a guarantee.
Privacy policy: https://commentverdict.com/privacy?utm_source=chrome_web_store&utm_medium=listing&utm_campaign=description_privacy

✨ ALSO FROM COMMENT VERDICT: MENDI
Mendi is your AI reply pilot for X, Reddit and YouTube. It reads the comments on a post, shows you what people actually think, and drafts a reply grounded in what they said. You review it and post it yourself; Mendi never posts for you.
Try Mendi: https://commentverdict.com/?utm_source=chrome_web_store&utm_medium=listing&utm_campaign=description_mendi
```

## Mendi promo card (in the popup)

Release 1.9 adds one dismissible card to the extension POPUP, shown after a verdict has
rendered (never on install, never on a blank popup, never injected into youtube.com —
a promotion on a third-party page is what draws "single purpose" complaints). It is
shown at most three times per device, at least 48 hours apart, and never again after
"Not now" or "Try Mendi". The state lives in `chrome.storage.local` under `mendiPromo`.
No permission changed, so the review should be the fast path.

Copy (also in `lib/mendi-promo.ts`, which is the source of truth):

> **The engine behind this verdict now drafts replies on X.**
> Meet Mendi. He reads real comments before he writes, shows you the sources, and never
> posts for you. Six months of the Voice tier free for early users.
> [Try Mendi] [Not now]

"Try Mendi" opens
`https://commentverdict.com/?utm_source=legacy_ext&utm_medium=extension&utm_campaign=pilot1&utm_content=popup_card&promo=MENDI-PILOT`
in a new tab; the landing page reads `promo` and shows the code applied on /pricing.

Link tagging for this campaign. Every pilot1 link carries `utm_campaign=pilot1`; the
source says which surface, the content says which spot on it:

| Link | utm_source | utm_medium | utm_content |
|---|---|---|---|
| Popup card "Try Mendi" | `legacy_ext` | `extension` | `popup_card` |
| Store description, first paragraph | `chrome_web_store` | `listing` | `description_intro` |

The other listing links keep their existing tags (`utm_campaign` = the field they sit
in), since they are not part of the campaign.

Analytics: `promo_shown`, `promo_clicked`, `promo_dismissed` go to the site's GA4
property over the Measurement Protocol (`lib/analytics.ts`). The release workflow
(`build-release.yml`) fills `PLASMO_PUBLIC_GA_MEASUREMENT_ID` and
`PLASMO_PUBLIC_GA_API_SECRET` from the repo secrets `GA_MEASUREMENT_ID` and
`GA_API_SECRET`; set both before merging or the events are silently dropped (the
build logs a warning). Nothing identifying is sent.

Ship list for this release, in one store submission:
1. Merge → the release workflow bumps the version (a `feat:` commit → minor), which is
   what triggers the review. Ship once; a review takes days.
2. Paste the updated Description above into the dashboard.
3. Upload the Mendi screenshot as the 4th image.
