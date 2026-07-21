# Sprint Tracker

Phone-first workout tracker for the 8-week Vanity Muscle Sprint program. Single HTML file, no backend, no accounts — all state lives in `localStorage` on the device.

**Live app:** https://ssundvor.github.io/workout/

## Features

- Home screen: pick Monday / Tuesday / Thursday / Bonus, adjust the current week (1–8)
- Workout screen: exercise cards in program order, "Last time" weights inline, inputs pre-filled from your previous session, one tap (✓) to log a set
- Rest timer: sticky bottom bar with the correct rest for the set you just finished (2.5 min compounds, 60 s supersets, 75 s isolation), +30 s and Skip
- Supersets logged in alternating order on a single merged card
- Weeks 4–7 automatically add a set to the flagged exercises; week 8 is a deload (2 sets, banner with weight guidance)
- Tap a completed set to un-log it and edit the values
- History: reverse-chronological sessions, tap to expand; expanded sessions can be deleted
- Tap an exercise's "Last:" line to see its last 5 sessions
- Fully offline after first load (service worker); installable as a PWA

## Hosting

Deployed to GitHub Pages by `.github/workflows/deploy.yml` on every push. No build step — the repo root is served as-is.

## Editing the program

The program is a hardcoded constant (`PROGRAM`) at the top of the `<script>` in `index.html`. Edit it there.
