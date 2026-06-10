# Kibbo App Store Owner Tasks

These are the launch tasks that require real accounts, legal decisions, production services, or business ownership. The repo can scaffold them, but it cannot complete them truthfully without you.

## Apple / App Store Connect

- Enroll in the Apple Developer Program.
- Confirm the final bundle identifier. Current preview value: `com.kibbo.language`.
- Create the app record in App Store Connect.
- Add final app name, subtitle, category, age rating, keywords, support URL, marketing URL, privacy policy URL, and screenshots.
- Create a TestFlight group for private beta testers.
- Upload an EAS production build and submit it for TestFlight review.

## Legal / Brand

- Finalize Privacy Policy and Terms of Use with real company/contact details.
- Publish Privacy Policy and Terms pages on a public website before App Store submission.
- Decide whether the app name/listing can use "AP" and "AP Japanese" language. Unless formal permission exists, public copy should clearly say Kibbo is not affiliated with or endorsed by College Board.
- Decide age rating and student-data policy before inviting minors.

## Subscriptions / Billing

- Create Basic, Pro, and Elite products in App Store Connect.
- Use Apple In-App Purchase for iOS subscription purchase flows.
- Implement restore purchases.
- Validate receipts server-side or through a billing service before trusting Pro/Elite access.
- Keep the current local subscription picker as preview-only until real billing is wired.

## Production AI Backend

- Host the grading server on a production domain.
- Store provider keys only on the server.
- Set `EXPO_PUBLIC_AP_GRADING_URL` in EAS build environment to the production API URL.
- Add request authentication or app attestation before scaling.
- Add rate limits per subscription tier.
- Monitor AI cost per user, especially for Elite unlimited sessions.

## Beta Content / QA

- Test a native dev build on real iPhones for microphone, speech recognition, TTS, Library review, dark mode, and session limits.
- Recruit AP Japanese students/teachers for TestFlight.
- Collect confusing prompts, bad AI feedback, layout failures, and retention data.
- Replace placeholder app icon/splash/screenshots with final launch assets.
