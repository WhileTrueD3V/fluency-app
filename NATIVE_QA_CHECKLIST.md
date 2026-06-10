# Kibbo Native iPhone QA Checklist

Use this after a custom dev build or TestFlight build is installed on a real iPhone. Expo Go is not enough for the speech stack.

## Setup

- Build with EAS development or preview profile.
- Set `EXPO_PUBLIC_KIBBO_AI_URL` to the reachable production or LAN AI server.
- Confirm iOS microphone permission prompt appears.
- Confirm iOS speech recognition permission prompt appears.
- Confirm the app recovers gracefully if either permission is denied.

## Home, Library, Mini Mock

- Home opens without clipped header/footer content.
- Footer tabs are fully visible, no reflection/ghost footer appears.
- Home -> Library -> Mock navigation works repeatedly.
- Library Recent Work shows the latest three completions compactly.
- Recent Work detail modal opens, saves, unsaves, and closes.
- Saved tab search, select, delete, and Review tab selection still work.
- Mini Mock starts each AP section and returns to Mock after completion.

## Listening

- Generated loading screen appears only while content is being prepared.
- Audio playback works from the play button.
- Speed control works.
- Choices can be selected without layout jump.
- Answer feedback appears and the next action is reachable above the footer.
- Saving/unsaving an item does not restart playback or reset question state.

## Reading

- Passage and questions are readable without awkward clipping.
- Choices have clear pressed/selected feedback.
- Saving/unsaving does not reset the passage/question state.
- Completion records XP and Recent Work details.

## Speaking Translation

- Record starts and stops reliably.
- Speech recognition transcript appears.
- Playback of the learner recording works when a native recording URI is available.
- Model answer playback works.
- Meaning, pronunciation, and naturalness feedback display.
- Saving/unsaving does not reset the prompt or recording state.

## AP Conversation And Text Chat

- Conversation timer starts only for the active turn.
- Saving/unsaving while in a turn does not restart the 20-second timer.
- Prompt audio/text and learner answer are both saved into Library detail when saved.
- End-of-session review can be saved and appears with useful detail in Library.
- AP review avoids generic score-only summaries.

## AI And Cost Behavior

- Daily plan does not regenerate on every Home reload for the same learner state.
- One generated drill batch feels personalized to recent weak spots.
- Repeated scenario patterns are rejected or retried.
- `npm run ai:usage` shows expected call count after the test pass.

## Fail Conditions

Stop and fix before beta if any of these happen:

- Recording freezes or cannot be stopped.
- Speech recognition never returns text on a supported iPhone.
- Navigation loses in-progress drill state unexpectedly.
- Footer covers primary actions.
- AI server accepts repeated scenario content after retry.
- Any single ordinary one-credit fulfillment approaches or exceeds 1 cent in logged provider cost.
