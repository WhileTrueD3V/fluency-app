# Kibbo Launch Status

## Current Rule

Work one launch job at a time. Do not move to the next job until the current one is finished.

## Current Job: 2. Make Japanese practice reliable end-to-end

Goal: decide exactly what the first public version includes, so we stop expanding randomly and can finish.

### First Public Launch Scope

- AP Japanese only.
- Mandarin and Spanish may appear as coming soon, but they are not part of launch quality yet.
- Core tabs: Practice, Library, Mock.
- Practice modes:
  - AP Listening
  - Speaking Drill
  - AP Reading
  - AP Conversation
  - AP Text Chat
- AI feedback:
  - Speaking Drill review
  - AP Conversation review
  - AP Text Chat review
- Local progress:
  - XP
  - level
  - accuracy
  - sessions
  - saved library items

### Not In First Public Launch

- Full Mandarin course.
- Full Spanish course.
- Accounts.
- Teacher dashboard.
- Leaderboards.
- Payments.
- Full-length AP exam mode.

## Launch Jobs

1. Lock the launch scope.
2. Make Japanese practice reliable end-to-end.
3. Make AI grading reliable and safe from freezes.
4. Build enough Japanese content for beta.
5. Polish mobile layouts against the designer references.
6. Prepare hosted backend for AI grading.
7. Prepare TestFlight/dev build.
8. Run private beta with students/teachers.
9. Fix beta issues.
10. Prepare App Store listing, privacy policy, screenshots, and public launch.

## Current Status

Job 1 is locked for the first public version.

Repo-side launch setup completed:
- App config supports automatic light/dark appearance.
- iOS and Android microphone/speech permissions are declared.
- iOS build number and Android version code are present.
- Settings includes in-app Privacy, Terms, and AI disclosure surfaces.
- `npm run validate:launch` checks launch config and scans source for accidentally shipped AI keys.
- AI cost controls are documented and validated with `npm run audit:ai-cost`.
- AI usage reporting is available with `npm run ai:usage`.
- First-completion feedback can be submitted to the configured server and summarized with `npm run feedback:report`.
- Production AI deployment checklist exists in `PRODUCTION_AI_DEPLOYMENT.md`.
- Native iPhone QA checklist exists in `NATIVE_QA_CHECKLIST.md`.

Known launch blockers outside code:
- Apple Developer account and App Store Connect setup.
- Final bundle identifier confirmation.
- Final legal Privacy Policy and Terms URLs.
- Apple In-App Purchase products and receipt validation.
- Hosted AI grading server URL and production secrets.
- Real-device iPhone QA for microphone, speech recognition, recording playback, generated drill flow, and footer/layout safety.
