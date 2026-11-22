# DR-001 · Build Sabaq as a responsive web app installable as a PWA

| Field | Value |
| --- | --- |
| Status | Accepted (provisional, to be validated by research findings) |
| Date | 2026-11-22 |
| Related | [Vision](../vision.md) · [Research plan](../research/research-plan.md) (RQ6) |

## Question

Which platform should Sabaq be built on?

## Context

Sabaq must reach students, class representatives and instructors on whatever device they already own, which in many regions means a budget Android phone with an unreliable connection, while instructors often work on laptops. It needs rich interactions (timeline, heatmap, drag-and-drop planning, in-browser file checks), strong accessibility, and must not depend on any single institution's systems. It is open source and maintained by a small team, so cost and speed of delivery matter.

## Options

| ID | Option | Summary |
| --- | --- | --- |
| O1 | Native mobile apps | Separate Android and iOS apps, distributed through app stores |
| O2 | Responsive web app + PWA | One web app that adapts from phone to desktop and can be installed to the home screen |
| O3 | Chatbot | A bot inside existing chat apps that answers questions and sends reminders |
| O4 | LMS plugin | An extension for one learning management system (for example Moodle) |

## Criteria

| ID | Criterion | Why it matters |
| --- | --- | --- |
| C1 | **Reach without friction**: usable on any device with no store install, quick to open from a shared link | Adoption depends on whole classes joining quickly; app-store installs lose users at every step |
| C2 | **Accessibility support** | Must work with screen readers, text scaling, high contrast and right-to-left languages |
| C3 | **Rich interaction**: timelines, heatmaps, drag and drop, file inspection | Core features depend on them |
| C4 | **Independence**: not tied to one LMS, chat platform or vendor | Institutions use many different systems |
| C5 | **Cost and delivery speed** for a small team | One codebase is far cheaper to build, test and maintain |
| C6 | **Works on weak connections**, with offline access to essentials | Many students study with patchy internet |
| C7 | **Timely reminders** (notifications) | Deadline awareness is the central problem |

## Assessment

| Criterion | O1 Native | O2 Web + PWA | O3 Chatbot | O4 LMS plugin |
| --- | :---: | :---: | :---: | :---: |
| C1 Reach without friction | − | ++ | ++ | − |
| C2 Accessibility | ++ | + | − | 0 |
| C3 Rich interaction | ++ | ++ | −− | + |
| C4 Independence | + | ++ | − | −− |
| C5 Cost and speed | −− | ++ | + | 0 |
| C6 Weak connections, offline | ++ | + | + | − |
| C7 Timely reminders | ++ | + | ++ | 0 |

**Notes on the assessment**

- **O3 Chatbot** reaches people where they already are (C1, C7), but a chat transcript cannot show a timeline, heatmap or planner (C3), offers poor structure for screen-reader users (C2), and depends on platform access rules that can change (C4).
- **O4 LMS plugin** only helps institutions on that one LMS, which contradicts C4, and cannot include information that never enters the LMS, which is the core problem.
- **O1 Native apps** score well on capability, but doubling the codebase (C5) and requiring store installs (C1) are serious costs for a small open-source team.
- **O2 Web + PWA** is the only option without a strongly negative score. Its weaknesses are notifications on some platforms (C7) and slightly less mature offline support (C6).

## Decision

Build Sabaq as **one responsive web application installable as a Progressive Web App**. It maximizes reach and independence at the lowest cost, supports every core interaction, and benefits from mature browser accessibility.

## Consequences

- Push notifications on iPhones work only after the PWA is installed to the home screen (iOS 16.4 or later). **Mitigation:** a gentle, well-timed install prompt; email digests as a fallback channel; the Today screen as the reliable source of truth.
- Offline support covers reading the timeline and announcements; creating content needs a connection, and the interface says so clearly.
- Native apps remain possible later by wrapping the PWA, if research shows a strong need.

## Revisit if

- Research (RQ6) shows a large share of users cannot or will not use a browser-based app.
- Research shows reminders inside chat apps are essential to adoption; in that case, **add** a chat-based notification channel alongside the web app rather than replacing it.
