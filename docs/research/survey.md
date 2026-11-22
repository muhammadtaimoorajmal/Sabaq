# Survey: Keeping Track of Coursework

**Purpose:** test how widespread the patterns found in interviews are (hypotheses H1–H5, exploratory RQ6).
**Length:** about 6 minutes · 26 questions, of which each respondent sees at most 24.
**Tool:** any online form tool (Google Forms, Microsoft Forms, Typeform …). Build it exactly as specified below so the exported columns match [the CSV template](templates/survey-responses.csv).

## Build rules

- **Do not collect email addresses or names.** Turn off automatic email collection.
- Keep the question wording exactly as written, so results stay comparable.
- Shuffle the options of multiple-choice questions where marked *(shuffle)*, to avoid order bias. Keep "Other", "None" and "Prefer not to say" last.
- Likert items all use the same five-point scale: **1 Strongly disagree · 2 Disagree · 3 Neutral · 4 Agree · 5 Strongly agree**.
- Branching: after Q1, **students** skip Section F; **instructors and teaching staff** skip Sections C, D and E. Class representatives answer everything.
- If you want interview volunteers, link a **separate** form at the end. Contact details must never be stored with survey responses.

---

## Introduction (shown before Q1)

> This anonymous survey is about how students and teachers keep track of coursework: announcements, deadlines and submissions. It takes about 6 minutes. There are no right or wrong answers. Results are used to design a free, open-source study tool and are published only in summary form. You can stop at any time.

**Consent** · required checkbox: *I am 18 or older and agree to take part. I understand my answers are anonymous.*

## Section A · About you

| ID | Question | Type | Options |
| --- | --- | --- | --- |
| Q1 | What is your role? | Single choice, required | Student · Class representative · Instructor or teaching staff · Other |
| Q2 | Which year of study are you in? | Single choice | 1st · 2nd · 3rd · 4th · 5th or later · Not a student |
| Q3 | What type of institution are you at? | Single choice | University · College · School · Academy or training center · Other |
| Q4 | How many courses are you taking (or teaching) this term? | Single choice | 1–3 · 4–5 · 6–7 · 8 or more |
| Q5 | Which device do you use most for coursework? | Single choice | Android phone · iPhone · Laptop or desktop · Tablet · A shared or borrowed device |

## Section B · How information reaches you · RQ1

| ID | Question | Type | Options |
| --- | --- | --- | --- |
| Q6 | Where do you receive course announcements? *Select all that apply.* | Multiple choice *(shuffle)* | Learning management system (LMS) · Chat groups (WhatsApp, Telegram …) · Email · Said in class · Notice board · Through a class representative · Other |
| Q7 | Which source do you trust **most** for deadlines? | Single choice *(shuffle)* | Same options as Q6 |

## Section C · Deadlines · H1 *(students and class representatives)*

| ID | Question | Type | Options |
| --- | --- | --- | --- |
| Q8 | This term, how many times have you learned about a deadline **later than you would have liked**? | Single choice | Never · Once · 2–3 times · 4 or more times |
| Q9 | This term, have you **missed** a deadline because you did not know about it in time? | Single choice | No · Once · More than once |
| Q10 | *"At any moment, I know exactly what is due in the next 7 days."* | Likert 1–5 | |

## Section D · Submissions · H2 *(students and class representatives)*

| ID | Question | Type | Options |
| --- | --- | --- | --- |
| Q11 | Have you ever lost marks for any of these? *Select all that apply.* | Multiple choice *(shuffle)* | Wrong file name · Wrong file format · Submitted in the wrong place (for example, email instead of the LMS) · Late by only a few minutes · Missing a required item (cover page, ID, declaration) · None of these |
| Q12 | How do you usually check the submission instructions before submitting? *Select all that apply.* | Multiple choice *(shuffle)* | Re-read the handout or instructions · Ask a classmate · Ask the class representative · Search the chat group · From memory · I usually do not check |
| Q13 | *"I am confident my submissions follow every instruction."* | Likert 1–5 | |

## Section E · Workload · H3 *(students and class representatives)*

| ID | Question | Type | Options |
| --- | --- | --- | --- |
| Q14 | How often do **three or more** deadlines fall within the same two days? | Single choice | Never · Rarely · Sometimes · Often · Almost every week |
| Q15 | Usually, how far ahead do you know about a deadline? | Single choice | Less than a day · 1–2 days · 3–6 days · 1–2 weeks · More than 2 weeks |
| Q16 | *"I can see busy weeks coming early enough to prepare."* | Likert 1–5 | |

## Section F · Sending announcements · H4 *(class representatives and instructors)*

| ID | Question | Type | Options |
| --- | --- | --- | --- |
| Q17 | After you post an announcement, how do you know who has seen it? *Select all that apply.* | Multiple choice | I don't know · Chat read receipts · LMS statistics · Students reply or react · I ask in class · Other |
| Q18 | In a typical week, how many questions do you receive about things **already announced**? | Single choice | None · 1–5 · 6–15 · 16 or more |
| Q19 | *"I am confident my announcements reach every student."* | Likert 1–5 | |

## Section G · Tools · H5 *(everyone)*

| ID | Question | Type | Options |
| --- | --- | --- | --- |
| Q20 | What do you use to keep track of deadlines? *Select all that apply.* | Multiple choice *(shuffle)* | Memory · Paper or diary · Phone notes · Screenshots · Phone calendar · LMS calendar · To-do or planner app · A friend reminds me · Other |
| Q21 | If you tried a planner, calendar or to-do app for your studies and stopped, why? *Select all that apply.* | Multiple choice *(shuffle)* | Too much manual entry · I forgot to keep it updated · Information changed and it became wrong · Too complicated · No useful reminders · I still use one · I never tried one · Other |

## Section H · Your context · RQ6 *(everyone)*

| ID | Question | Type | Options |
| --- | --- | --- | --- |
| Q22 | How is your internet connection where you usually study? | Single choice | Good · Sometimes slow or patchy · Often poor |
| Q23 | Do you use any of these settings on your phone or computer? *Optional; select all that apply.* | Multiple choice | Larger text · Dark mode · Screen reader · Magnifier or zoom · A language other than English · None · Prefer not to say |
| Q24 | Which language would you prefer for a study app? | Single choice | English · Urdu · Other (please specify) |

## Section I · In your own words *(everyone, optional)*

| ID | Question | Type |
| --- | --- | --- |
| Q25 | What is your **biggest frustration** with keeping track of coursework? | Paragraph |
| Q26 | If you could change **one thing** about how course information reaches you, what would it be? | Paragraph |

## Closing message

> Thank you! Your answers will help design a tool that makes coursework easier to keep track of.

## Analysis plan (Milestone 08)

| Hypothesis | Supported if (pre-registered thresholds) |
| --- | --- |
| H1 | ≥ 50% of students answer "2–3 times" or more to Q8, **or** ≥ 25% answer "Once" or more to Q9; median Q10 ≤ 3 |
| H2 | ≥ 30% of students select at least one option other than "None of these" in Q11; median Q13 ≤ 3 |
| H3 | ≥ 40% answer "Often" or "Almost every week" to Q14; median Q16 ≤ 3 |
| H4 | ≥ 50% of senders select "I don't know" in Q17, **or** ≥ 50% answer "6–15" or more to Q18; median Q19 ≤ 3 |
| H5 | Among those who stopped using a tool, "Too much manual entry" or "Information changed" is among the two most selected reasons in Q21 |

Thresholds are fixed **before** data is collected, so the results cannot be read selectively afterwards. Open answers (Q25, Q26) are coded during affinity mapping alongside interview data.
