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

## Description

```text
Know whether a YouTube video is worth your time before you watch it.

Comment Verdict reads the comment section, viewer signals and the transcript, then gives you an AI verdict on whether the video delivers what its title promises. From Comment Verdict, the makers of Mendi: https://commentverdict.com/?utm_source=chrome_web_store&utm_medium=listing&utm_campaign=description_intro

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
