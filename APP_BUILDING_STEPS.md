# Kibbo App Building Steps

This is the working launch/build checklist for turning Kibbo into an App Store-ready language trainer. It is written so it can be reused for AP Japanese and later copied/adapted for AP Mandarin.

## 1. Product Foundation

- Confirm final app name, bundle ID, and domain.
- Keep app name centralized in `constants/brand.ts` so it is easy to rename later.
- Include the disclaimer: "Kibbo is not affiliated with or endorsed by College Board."
- Decide the first launch language and exam scope.
- Keep future language support modular: Japanese and Mandarin should share app structure, subscription logic, settings, and drill shell, but have separate local content, AI prompts, rubrics, and difficulty ladders.

## 2. Core QA Before Store Setup

- Test every main tab on desktop and mobile preview: Home, Library, Mock.
- Test every drill route: listening, reading, speaking, conversation, text chat.
- Test all drill exits through footer tabs and confirm the warning appears only during active drills.
- Test Library save/unsave, delete confirmation, mass delete, search/filter, and review flow.
- Test settings, subscription popup, privacy, terms, share app, theme switch, and restore purchases placeholder.
- Test dark mode for contrast/readability across all screens.
- Test mobile safe-area spacing, bottom footer placement, and modal sizing.
- Test animation smoothness for settings, subscription, switches, skip challenge, correct/wrong states, and review modals.

## 3. Design Polish

- Use one shared header system across main tabs.
- Use one shared footer/tab system across main tabs and drills.
- Keep mobile screens usable without unnecessary scrolling, especially during drills.
- Keep drill screens visually consistent: segmented progress bars, top action buttons, save state, XP indicator, prompt area, answer area, and footer spacing.
- Keep background kanji varied by screen, subtle, and not intrusive.
- Make all modals fit within viewport and scroll internally.
- Avoid prototype language in production UI.

## 4. Learning System

- Maintain local ready-to-use content so drills are never blank.
- Generate AI content in the background, not as the only source of a prompt.
- Make question difficulty scale with user level.
- For Japanese, ensure furigana appears only where useful, especially for non-AP or above-level kanji.
- For Mandarin later, define separate level bands around tones, pinyin/characters, AP themes, classroom survival, conversation, reading, and presentational speaking/writing.
- Avoid repeats by tracking recently served content and prompt signatures.

## 5. AI Feedback System

- Keep separate AI feedback prompts by drill type.
- Route feedback quality by subscription tier:
  - Basic: limited daily sessions, standard useful feedback.
  - Pro: 20 sessions/day, strongest AI review.
  - Elite: unlimited sessions/day, strongest AI review.
- Standard feedback should still be genuinely helpful: meaning, grammar, AP scoring, and a better model answer.
- Elite feedback should add native-like phrasing, register, nuance, and what a real speaker would expect.
- AI feedback must say it is coaching, not an official AP score.

## 6. Subscriptions

- Free app with in-app purchases.
- Basic plan: free, 3 session types/day.
- Pro plan: 20 sessions/day, strongest AI feedback.
- Elite plan: unlimited sessions/day, strongest AI feedback.
- Add billing through App Store in-app purchases later.
- Add restore purchases flow.
- Add clear plan comparison and example feedback comparison.

## 7. Legal And Store Requirements

- Privacy policy screen.
- Terms of use screen.
- AI disclosure.
- College Board disclaimer.
- App Store privacy labels.
- Subscription terms and restore purchases language.
- Confirm whether any encryption export declaration is needed.
- Confirm final bundle ID before App Store Connect setup.

## 8. Technical Validation

Run these before major reviews:

```bash
npx tsc --noEmit
npm run validate:launch
npm run build:web
```

For Expo/native release later:

```bash
npx expo-doctor
eas build --platform ios
eas submit --platform ios
```

## 9. App Store Preparation

- Enroll in Apple Developer Program.
- Create App Store Connect app record.
- Add bundle ID and capabilities.
- Configure in-app purchases.
- Add screenshots for mobile sizes.
- Write App Store description, keywords, subtitle, and support URL.
- Fill privacy nutrition labels.
- Upload build through EAS.
- Test with TestFlight.
- Submit for review.

## 10. Mandarin Adaptation Notes

- Create a Mandarin language config parallel to Japanese.
- Use Mandarin-specific drill content and AP themes.
- Add pinyin/tone support carefully; avoid cluttering every screen.
- Add listening prompts with Mandarin audio/TTS behavior.
- Add Mandarin-specific AI rubrics:
  - tones and pronunciation
  - measure words
  - word order
  - register/formality
  - native sentence rhythm
  - AP cultural topics
- Keep the same app shell, subscription system, settings, Library, Mock, and progress systems.

