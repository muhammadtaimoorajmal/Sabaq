# Consent and Privacy

Research participants trust us with their experiences. These rules protect them and keep the published data safe to share.

## Who can take part

- Adults (18 or older) who agree to take part.
- People under 18 take part only with written consent from a parent or guardian **and** their own agreement.
- Nobody should feel obliged: avoid recruiting people who report to you or whose marks you influence.

## Consent script

Read this aloud before an interview or observation session, then ask for a clear "yes".

> "Thank you for agreeing to talk with me. I'm researching how students and teachers keep track of coursework, to design a free, open-source tool.
>
> - Taking part is voluntary. You can skip any question, take a break or stop at any time, without giving a reason.
> - I'll take notes. **May I also make an audio recording?** It is only used to check my notes and is deleted once they are written. *(Record only if the answer is yes.)*
> - Your name will not appear anywhere. In notes and reports you'll be called by a code, such as P3.
> - Anonymous quotes and findings may be published in the project's public documentation.
> - If you change your mind later, tell me and I'll remove your data.
>
> Do you have any questions? Are you happy to continue?"

Record in the notes template: date, consent given (yes/no), recording allowed (yes/no). Do not record a signature in the repository.

## Codes

| Group | Code | Example |
| --- | --- | --- |
| Students (including class representatives) | P1, P2 … | P4 (class representative) |
| Instructors and staff | S1, S2 … | S2 |
| Observation sessions | O1, O2 … | O1 (library) |
| Survey responses | R001, R002 … | assigned in the CSV |

## What may and may not be committed

| ✅ Allowed in the repository | ❌ Never in the repository |
| --- | --- |
| Participant codes | Names, nicknames, initials |
| Year of study, program area, role | Student or employee ID numbers |
| Device type, general living situation | Phone numbers, emails, social media handles |
| Paraphrased notes and short anonymous quotes | Audio or video recordings, photos of faces |
| Redacted screenshots | Unredacted screenshots, profile pictures |
| The survey export without identifying columns | The key linking codes to real people |

**The key** (code → real person) is kept offline by the researcher, for example in a notebook or a local file outside the project folder, and destroyed after the research is complete. The repository's `.gitignore` also blocks any folder named `private/` under `docs/research/`, and audio files, as a second safety net.

## Redacting artifacts

Before storing a screenshot of a chat message, an announcement or an instruction sheet:

1. Cover names, phone numbers, profile pictures and IDs with solid blocks (not blur, which can be reversed).
2. Replace institution-specific identifiers where needed, for example `Lab11_<StudentID>_<Section>`.
3. Crop to the relevant message.
4. Log it in the [artifact log](templates/artifact-log.md) with its source type and date (no sender name).

## Retention

- Audio recordings: deleted as soon as the notes are written, and within 7 days at most.
- The offline key: destroyed when the research phase ends.
- Anonymized notes and data: kept in the repository as part of the public design record.

## Withdrawal

If a participant withdraws, delete their notes and survey row, remove their quotes from any synthesis, and record the withdrawal (code only) in the participant register.
