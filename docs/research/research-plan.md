# Research Plan

## 1. Purpose

Sabaq starts from a set of assumptions about how students, class representatives and instructors handle course information (see the [vision](../vision.md)). Assumptions are not evidence. This research exists to **confirm, reject or reshape** them before any interface is designed, and to discover needs nobody has assumed yet.

## 2. Research questions

| ID | Question |
| --- | --- |
| **RQ1** | How do students currently find out what is due, when, and how to submit it? Which channels do they use and trust? |
| **RQ2** | When and why do students miss deadlines or lose marks to avoidable submission mistakes? |
| **RQ3** | How do students perceive and manage workload across several courses? |
| **RQ4** | How do class representatives and instructors distribute information, and what feedback do they get that it arrived? |
| **RQ5** | What tools and workarounds do people already use, and why do they keep or abandon them? |
| **RQ6** | Which devices, connectivity, language and accessibility conditions shape how people use digital tools for their studies? |

## 3. Hypotheses

Each hypothesis is phrased so that it can be **rejected**. A rejected hypothesis is a useful result: it removes or changes a feature.

| ID | Hypothesis | Evidence that would reject it |
| --- | --- | --- |
| **H1** | Students regularly learn about deadlines late because announcements are buried in chat groups. | Most students report rarely or never learning about a deadline late. |
| **H2** | Students lose marks to avoidable submission mistakes (file name, format, channel, timing). | Few students report such losses, or they consider them trivial. |
| **H3** | Students cannot anticipate weeks where several deadlines cluster. | Most students report seeing busy weeks coming and planning for them. |
| **H4** | Senders do not know whether announcements reached everyone, and class representatives spend significant effort answering repeated questions. | Senders report reliable feedback, or repeated questions are rare. |
| **H5** | Existing tracking tools (LMS calendar, to-do apps, notes) are abandoned mainly because of manual effort. | Students use such tools consistently, or abandon them for unrelated reasons. |

RQ6 is exploratory: it has no hypothesis, but it constrains every design decision (for example, supporting low-end phones and slow connections).

## 4. Methods

| Method | What it reveals | Target |
| --- | --- | --- |
| **Contextual inquiry** ([guide](contextual-inquiry-guide.md)) | What people *actually do*, in context, including workarounds they would not think to mention | 2–3 sessions |
| **Semi-structured interviews**: [students](interview-guide-students.md), [instructors and class representatives](interview-guide-staff.md) | Reasons, stories, emotions, mental models | 5–7 students, 2–3 staff |
| **Survey** ([questionnaire](survey.md)) | How widespread the patterns found in interviews are | 30 or more responses |
| **Artifact collection** | Real announcements and submission instructions (anonymized) that show how information is actually phrased; they also form the test corpus for the paste-to-structure parser | 20 or more examples |

### Coverage: every question is answered by at least two methods

| | Contextual inquiry | Interviews | Survey | Artifacts |
| --- | :---: | :---: | :---: | :---: |
| RQ1 Channels and trust | ● | ● | ● | ● |
| RQ2 Missed deadlines and mistakes | ● | ● | ● | ● |
| RQ3 Workload | ● | ● | ● | |
| RQ4 Sender perspective | | ● | ● | ● |
| RQ5 Tools and workarounds | ● | ● | ● | |
| RQ6 Context and accessibility | ● | ● | ● | |

### Coverage: every hypothesis is tested by at least two methods

| | Interviews | Survey | Contextual inquiry | Artifacts |
| --- | :---: | :---: | :---: | :---: |
| H1 | S3, S4 | Q8–Q10 | ● | ● |
| H2 | S4 | Q11–Q13 | ● | ● |
| H3 | S5 | Q14–Q16 | ● | |
| H4 | Staff guide | Q17–Q19 | | ● |
| H5 | S6 | Q20–Q21 | ● | |

(S = section of the student interview guide; Q = survey question.)

## 5. Participants

Aim for **variety**, not just convenience. Recruiting only close friends from one class produces a narrow picture.

| Group | Target | Look for variety in |
| --- | --- | --- |
| Students (interviews) | 5–7 | Year of study, program, living situation (hostel, home, commuting), device (budget or high-end phone, laptop), at least one class representative, and at least one person who uses assistive settings (large text, screen reader, dark mode for eye strain) if they are willing |
| Instructors (interviews) | 1–2 | Different departments; one who uses the LMS heavily, one who relies on chat groups |
| Class representatives (interviews) | 1–2 | Can overlap with the student group |
| Survey respondents | 30+ | As many programs and years as possible |
| Contextual inquiry | 2–3 sessions | Different places: library, cafeteria or common room, the hour before a submission deadline |

Stop interviewing once two consecutive interviews produce no new themes (saturation), provided the minimum of five students is reached.

## 6. Schedule

| Days | Activity |
| --- | --- |
| 1 | Pilot the interview guide with one person; adjust wording. Publish the survey. |
| 2–6 | Interviews and contextual-inquiry sessions. Write up notes within 24 hours of each session. |
| 2–8 | Collect survey responses and artifacts. Share the survey link in several class groups. |
| 9–10 | Close the survey. Anonymize everything. Hand over to synthesis (Milestone 08). |

## 7. Ethics and data handling

Every participant gives informed consent and can withdraw at any time. Full rules are in [consent-and-privacy.md](consent-and-privacy.md). In short:

- participants are identified only by codes (P1, P2 …; staff S1, S2 …);
- the key linking codes to real people is kept **offline** and is never committed;
- audio recordings happen only with explicit permission and are deleted once notes are written;
- screenshots are redacted of names, phone numbers, profile pictures and student IDs before they are stored.

## 8. Outputs

| Output | Location | Produced in |
| --- | --- | --- |
| Anonymized interview notes and observation logs | `data/interviews/`, `data/observations/` | Fieldwork |
| Survey export (CSV, no identifying columns) | `data/survey/` | Fieldwork |
| Redacted artifacts | `data/artifacts/` | Fieldwork |
| Affinity map, hypothesis verdicts, insights | `synthesis.md` | Milestone 08 |
| Personas, problem statements, usability targets | `../design/` | Milestone 09 |
