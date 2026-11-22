# Research data

Anonymized fieldwork data. Read [consent-and-privacy.md](../consent-and-privacy.md) before adding anything.

| Folder | Contents | Template |
| --- | --- | --- |
| `interviews/` | One file per participant: `P1.md`, `S1.md` … | [interview-notes.md](../templates/interview-notes.md) |
| `observations/` | One file per session: `O1.md` … | [observation-log.md](../templates/observation-log.md) |
| `survey/` | `responses.csv` exported from the form tool, with identifying columns removed | [survey-responses.csv](../templates/survey-responses.csv) |
| `artifacts/` | Redacted images `A01.png` … and `artifact-log.md` | [artifact-log.md](../templates/artifact-log.md) |
| `participant-register.md` | Anonymous participant profiles | [participant-register.md](../templates/participant-register.md) |

## Survey export conventions

- Save the export as `survey/responses.csv` with exactly the columns of the [template](../templates/survey-responses.csv); delete any column that could identify someone (names, e-mail addresses, IP addresses).
- Answers use the option labels from the [survey](../survey.md). Case, spacing and dash styles do not matter (`2-3 times` equals `2–3 times`).
- Multiple-choice answers may be separated by commas or semicolons, as form tools export them.
- Likert answers are whole numbers from 1 to 5; unanswered questions are left empty.
- `response_id` is a running number; it becomes the citation for open answers (`R12-Q25`).

Run `npm run research:survey` after every change. It lists any row that does not match the survey and writes the report to [`../findings/`](../findings/README.md).

**Status:** fieldwork in progress; no data committed yet.
