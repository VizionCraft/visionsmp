VISION SMP WEBSITE v2
======================

A static HTML/CSS/JS website designed for Cloudflare Pages, GitHub Pages, Netlify, or similar static hosting.

MAIN EDIT FILE
--------------
Most public-facing server information is centralized in:
    js/content.js

Important values already set:
    Website: visionsmp.com
    Server IP: play.visionsmp.com
    Minecraft: 1.21.11
    Discord: https://discord.gg/4Zwd2kRR6

BEFORE LAUNCH
-------------
1. Buy visionsmp.com.
2. Point visionsmp.com to your web host.
3. Configure play.visionsmp.com to reach the Velocity proxy.
4. Replace brand.tebexStore = "#" in js/content.js with your real Tebex/store URL.
5. Confirm supportEmail in js/content.js.
6. Review Terms, Privacy and Refund pages against your final business/payment setup.
7. If using Cloudflare Pages, upload this folder or connect its GitHub repository.

PAGES
-----
index.html          Home
competitive.html    Competitive SMP
chill.html          Chill SMP
store.html          Store
leaderboards.html   Leaderboards placeholder
rules.html          Rules
support.html        Support
terms.html          Terms
privacy.html        Privacy
refunds.html        Refund policy

NOTES
-----
- No framework or build step is required.
- The website is mobile responsive.
- The Copy Server IP button copies play.visionsmp.com.
- Store pricing intentionally says COMING SOON.
- Live leaderboard/server APIs are not hard-coded yet so the site does not depend on a third-party API.
