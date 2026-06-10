# Kibbo Launch Checklist

## Current Launch Target

Launch a private beta first, then widen to AP Japanese students and teachers before the next school year.

Primary launch language:
- Japanese

Roadmap languages:
- Mandarin
- Spanish

## Build Readiness

- Run `npx tsc --noEmit`.
- Run `npm run validate:launch`.
- Run `npm run build:web`.
- Run a dev build for microphone and speech-recognition testing. Expo Go is not enough for the full speech stack.
- Replace placeholder assets in `assets/` with final app icon, adaptive icon, and splash artwork before App Store submission.
- Confirm `ios.bundleIdentifier` and `android.package` are final before App Store Connect / Play Console setup.

## AI Server

Local testing:

```sh
npm run grade-server:anthropic
```

Production needs a hosted API URL. Set this in the app build environment:

```sh
EXPO_PUBLIC_AP_GRADING_URL=https://your-api-domain.example
```

Keep provider keys only on the server:

```sh
AI_PROVIDER=anthropic
ANTHROPIC_API_KEY=...
ANTHROPIC_MODEL=...
```

Never ship API keys in the mobile app.

## Beta Must-Pass Checks

- Onboarding shows Japanese, with Mandarin and Spanish as coming soon only.
- Practice tab shows Listening, Speaking Drill, AP Reading, AP Conversation, and AP Text Chat.
- Listening audio can be played at most two times and stops when the user answers or leaves.
- Speaking Drill never changes prompt while recording or reviewing.
- AP Conversation and Text Chat use practice-specific grading language.
- AI review has a timeout/fallback, so the app never freezes on Reviewing.
- Library can save and replay saved items.
- Mini Mock includes Listening, Reading, Text Chat, and Conversation.
- Microphone permissions are tested in a custom dev build on a real device.

## Content Needed Before Public Launch

- 100+ vetted Japanese listening questions.
- 100+ vetted Japanese reading passage sets.
- 100+ speaking prompts across beginner, intermediate, and advanced levels.
- 50+ AP Conversation sets.
- 50+ AP Text Chat sets.
- Native-speaker review for politeness, grammar, and cultural accuracy.

## App Store Materials Needed

- Final app icon.
- 6.7-inch iPhone screenshots.
- App preview copy focused on AP Japanese score improvement.
- Privacy policy URL.
- Terms of use URL.
- Support URL.
- TestFlight beta group.

## Subscription Readiness

- Create Basic, Pro, and Elite products in App Store Connect.
- Use Apple In-App Purchase for iOS digital subscriptions.
- Add restore purchases before public release.
- Validate receipts server-side or through a billing service before trusting Pro/Elite limits.
- Keep the current local subscription selector as a preview/dev-only scaffold until billing is wired.

## Legal / Brand Readiness

- Add final Privacy Policy and Terms URLs before submission.
- Add a support email or support site.
- Review AP / College Board wording with counsel or make the disclaimer explicit everywhere public-facing: Kibbo is not affiliated with or endorsed by College Board.
- Decide age rating and student-data policy before inviting minors into beta.
