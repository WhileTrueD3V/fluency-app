# Kibbo

Kibbo is an AP Japanese practice app built with React Native, Expo 52, TypeScript, Expo Router, and local AsyncStorage progress.

The current product focus is Japanese first, with Mandarin and Spanish planned after the Japanese experience is launch-ready.

## Run Locally

```sh
npm install
npm run web
```

For AI grading in local development, start the grading server in a second terminal:

```sh
npm run grade-server:local
```

The web app auto-discovers `http://localhost:8787` during local development. Native builds need:

```sh
EXPO_PUBLIC_KIBBO_AI_URL=http://YOUR_MAC_LAN_IP:8787
```

`EXPO_PUBLIC_AP_GRADING_URL` still works as a backwards-compatible alias.

## Verify

```sh
npx tsc --noEmit
npm run build:web
npm run validate:launch
npm run audit:ai-cost
npm run audit:ai-quality
npm run ai:usage
```

## Build Native Beta

The speech stack requires a custom dev build, not Expo Go.

```sh
npx eas build --profile development --platform ios
npx eas build --profile preview --platform ios
```

Android:

```sh
npx eas build --profile development --platform android
npx eas build --profile preview --platform android
```

## Important

API keys must stay on the grading server. Do not expose `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, or `GEMINI_API_KEY` in the client bundle.
