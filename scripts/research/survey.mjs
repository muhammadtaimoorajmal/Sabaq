/**
 * Survey analysis for docs/research/survey.md: parses the exported responses, validates them
 * against the questionnaire, summarizes every question and applies the pre-registered
 * hypothesis thresholds exactly as written in the survey's analysis plan.
 */

/** @typedef {'single' | 'multiple' | 'likert' | 'text' | 'meta'} QuestionType */
/** @typedef {{ id: string, label: string, type: QuestionType, options?: string[], audience?: 'students' | 'senders' }} Question */
/** @typedef {Record<string, string>} Row */

const CHANNELS = [
  'Learning management system (LMS)',
  'Chat groups (WhatsApp, Telegram …)',
  'Email',
  'Said in class',
  'Notice board',
  'Through a class representative',
  'Other',
];

/** @type {Question[]} */
export const QUESTIONS = [
  { id: 'response_id', label: 'Response', type: 'meta' },
  { id: 'submitted_at', label: 'Submitted', type: 'meta' },
  {
    id: 'q1_role',
    label: 'Q1 · Role',
    type: 'single',
    options: ['Student', 'Class representative', 'Instructor or teaching staff', 'Other'],
  },
  {
    id: 'q2_year',
    label: 'Q2 · Year of study',
    type: 'single',
    options: ['1st', '2nd', '3rd', '4th', '5th or later', 'Not a student'],
  },
  {
    id: 'q3_institution',
    label: 'Q3 · Institution type',
    type: 'single',
    options: ['University', 'College', 'School', 'Academy or training center', 'Other'],
  },
  {
    id: 'q4_courses',
    label: 'Q4 · Courses this term',
    type: 'single',
    options: ['1–3', '4–5', '6–7', '8 or more'],
  },
  {
    id: 'q5_device',
    label: 'Q5 · Main device',
    type: 'single',
    options: [
      'Android phone',
      'iPhone',
      'Laptop or desktop',
      'Tablet',
      'A shared or borrowed device',
    ],
  },
  {
    id: 'q6_channels',
    label: 'Q6 · Where announcements arrive',
    type: 'multiple',
    options: CHANNELS,
  },
  { id: 'q7_trusted_source', label: 'Q7 · Most trusted source', type: 'single', options: CHANNELS },
  {
    id: 'q8_late_awareness',
    label: 'Q8 · Learned of a deadline late (this term)',
    type: 'single',
    options: ['Never', 'Once', '2–3 times', '4 or more times'],
    audience: 'students',
  },
  {
    id: 'q9_missed_deadline',
    label: 'Q9 · Missed a deadline for not knowing',
    type: 'single',
    options: ['No', 'Once', 'More than once'],
    audience: 'students',
  },
  {
    id: 'q10_know_next_7_days',
    label: 'Q10 · "I know what is due in the next 7 days"',
    type: 'likert',
    audience: 'students',
  },
  {
    id: 'q11_marks_lost_for',
    label: 'Q11 · Lost marks for',
    type: 'multiple',
    options: [
      'Wrong file name',
      'Wrong file format',
      'Submitted in the wrong place (for example, email instead of the LMS)',
      'Late by only a few minutes',
      'Missing a required item (cover page, ID, declaration)',
      'None of these',
    ],
    audience: 'students',
  },
  {
    id: 'q12_how_check_instructions',
    label: 'Q12 · How instructions are checked',
    type: 'multiple',
    options: [
      'Re-read the handout or instructions',
      'Ask a classmate',
      'Ask the class representative',
      'Search the chat group',
      'From memory',
      'I usually do not check',
    ],
    audience: 'students',
  },
  {
    id: 'q13_confident_follow_instructions',
    label: 'Q13 · "My submissions follow every instruction"',
    type: 'likert',
    audience: 'students',
  },
  {
    id: 'q14_deadline_clusters',
    label: 'Q14 · Three or more deadlines within two days',
    type: 'single',
    options: ['Never', 'Rarely', 'Sometimes', 'Often', 'Almost every week'],
    audience: 'students',
  },
  {
    id: 'q15_notice_lead_time',
    label: 'Q15 · Usual notice before a deadline',
    type: 'single',
    options: ['Less than a day', '1–2 days', '3–6 days', '1–2 weeks', 'More than 2 weeks'],
    audience: 'students',
  },
  {
    id: 'q16_see_busy_weeks',
    label: 'Q16 · "I see busy weeks coming"',
    type: 'likert',
    audience: 'students',
  },
  {
    id: 'q17_know_who_saw',
    label: 'Q17 · How senders know who saw an announcement',
    type: 'multiple',
    options: [
      "I don't know",
      'Chat read receipts',
      'LMS statistics',
      'Students reply or react',
      'I ask in class',
      'Other',
    ],
    audience: 'senders',
  },
  {
    id: 'q18_repeat_questions_per_week',
    label: 'Q18 · Weekly questions about announced things',
    type: 'single',
    options: ['None', '1–5', '6–15', '16 or more'],
    audience: 'senders',
  },
  {
    id: 'q19_confident_reach',
    label: 'Q19 · "My announcements reach every student"',
    type: 'likert',
    audience: 'senders',
  },
  {
    id: 'q20_tracking_tools',
    label: 'Q20 · Tools used to track deadlines',
    type: 'multiple',
    options: [
      'Memory',
      'Paper or diary',
      'Phone notes',
      'Screenshots',
      'Phone calendar',
      'LMS calendar',
      'To-do or planner app',
      'A friend reminds me',
      'Other',
    ],
  },
  {
    id: 'q21_why_stopped',
    label: 'Q21 · Why a planner or calendar was abandoned',
    type: 'multiple',
    options: [
      'Too much manual entry',
      'I forgot to keep it updated',
      'Information changed and it became wrong',
      'Too complicated',
      'No useful reminders',
      'I still use one',
      'I never tried one',
      'Other',
    ],
  },
  {
    id: 'q22_connectivity',
    label: 'Q22 · Internet connection',
    type: 'single',
    options: ['Good', 'Sometimes slow or patchy', 'Often poor'],
  },
  {
    id: 'q23_settings_used',
    label: 'Q23 · Accessibility and display settings used',
    type: 'multiple',
    options: [
      'Larger text',
      'Dark mode',
      'Screen reader',
      'Magnifier or zoom',
      'A language other than English',
      'None',
      'Prefer not to say',
    ],
  },
  {
    id: 'q24_language',
    label: 'Q24 · Preferred language',
    type: 'single',
    options: ['English', 'Urdu', 'Other'],
  },
  { id: 'q25_biggest_frustration', label: 'Q25 · Biggest frustration', type: 'text' },
  { id: 'q26_one_change', label: 'Q26 · One change', type: 'text' },
];

export const QUESTION_BY_ID = new Map(QUESTIONS.map((question) => [question.id, question]));

/** Respondents below these numbers make a hypothesis verdict meaningless. */
export const MIN_RESPONDENTS = { students: 10, senders: 3 };
/** The research plan's target; smaller samples are reported as provisional. */
export const TARGET_RESPONDENTS = 30;

/**
 * Parses RFC 4180 CSV: quoted fields, doubled quotes, and line breaks inside quotes.
 * @param {string} text
 * @returns {string[][]}
 */
export function parseCsv(text) {
  /** @type {string[][]} */
  const rows = [];
  /** @type {string[]} */
  let row = [];
  let field = '';
  let quoted = false;
  const source = text.replace(/^\uFEFF/, '');
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (quoted) {
      if (character === '"' && source[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        field += character;
      }
    } else if (character === '"') {
      quoted = true;
    } else if (character === ',') {
      row.push(field);
      field = '';
    } else if (character === '\n' || character === '\r') {
      if (character === '\r' && source[index + 1] === '\n') index += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += character;
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((cells) => cells.some((cell) => cell.trim() !== ''));
}

/**
 * Comparable form of an answer: case, spacing, dash and quote styles do not matter.
 * @param {string} value
 */
export function normalize(value) {
  return value
    .toLowerCase()
    .replace(/[‐-―]/g, '-')
    .replace(/[‘’]/g, "'")
    .replace(/\.\.\.|…/g, '…')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Matches a single-choice answer to its option label.
 * @param {string} value
 * @param {string[]} options
 * @returns {string | null}
 */
export function matchSingle(value, options) {
  const wanted = normalize(value);
  return options.find((option) => normalize(option) === wanted) ?? null;
}

/**
 * Finds the selected options in a multiple-choice cell. Form tools join choices with commas
 * or semicolons, and some labels contain commas, so known labels are matched first
 * (longest first) and anything left over is reported as unrecognized.
 * @param {string} value
 * @param {string[]} options
 * @returns {{ selected: string[], unknown: string[] }}
 */
export function matchMultiple(value, options) {
  let rest = normalize(value);
  /** @type {string[]} */
  const selected = [];
  for (const option of [...options].sort((a, b) => b.length - a.length)) {
    const label = normalize(option);
    const position = rest.indexOf(label);
    if (position !== -1) {
      selected.push(option);
      rest = `${rest.slice(0, position)};${rest.slice(position + label.length)}`;
    }
  }
  const unknown = rest
    .split(/[;,]/)
    .map((part) => part.trim())
    .filter(Boolean);
  return { selected: options.filter((option) => selected.includes(option)), unknown };
}

/**
 * @typedef {{ row: number, column: string, message: string }} Problem
 * @typedef {{ answers: Map<string, string | string[] | number | null>, row: number }} Response
 */

/**
 * Turns parsed CSV rows into validated responses and a list of problems.
 * @param {string[][]} table
 * @returns {{ responses: Response[], problems: Problem[] }}
 */
export function readResponses(table) {
  const [header = [], ...rows] = table;
  const columns = header.map((name) => name.trim());
  /** @type {Problem[]} */
  const problems = [];
  for (const question of QUESTIONS) {
    if (!columns.includes(question.id)) {
      problems.push({ row: 1, column: question.id, message: 'column is missing' });
    }
  }
  for (const column of columns) {
    if (!QUESTION_BY_ID.has(column)) {
      problems.push({
        row: 1,
        column,
        message: 'unknown column (remove identifying columns before committing)',
      });
    }
  }

  const responses = rows.map((cells, index) => {
    const rowNumber = index + 2;
    /** @type {Response['answers']} */
    const answers = new Map();
    columns.forEach((column, position) => {
      const question = QUESTION_BY_ID.get(column);
      const raw = (cells[position] ?? '').trim();
      if (!question) return;
      if (raw === '') {
        answers.set(column, null);
        return;
      }
      if (question.type === 'single') {
        const match = matchSingle(raw, question.options ?? []);
        if (!match) problems.push({ row: rowNumber, column, message: `"${raw}" is not an option` });
        answers.set(column, match);
      } else if (question.type === 'multiple') {
        const { selected, unknown } = matchMultiple(raw, question.options ?? []);
        for (const part of unknown) {
          problems.push({ row: rowNumber, column, message: `"${part}" is not an option` });
        }
        answers.set(column, selected);
      } else if (question.type === 'likert') {
        const number = Number(raw);
        if (!Number.isInteger(number) || number < 1 || number > 5) {
          problems.push({
            row: rowNumber,
            column,
            message: `"${raw}" is not a whole number from 1 to 5`,
          });
          answers.set(column, null);
        } else {
          answers.set(column, number);
        }
      } else {
        answers.set(column, raw);
      }
    });
    if ((answers.get('q1_role') ?? null) === null) {
      problems.push({ row: rowNumber, column: 'q1_role', message: 'role is required' });
    }
    return { answers, row: rowNumber };
  });
  return { responses, problems };
}

/** @param {Response} response */
const roleOf = (response) => response.answers.get('q1_role');

/**
 * Students answer sections C–E; senders answer section F. Class representatives are both.
 * @param {Response[]} responses
 */
export function groups(responses) {
  return {
    all: responses,
    students: responses.filter(
      (r) => roleOf(r) === 'Student' || roleOf(r) === 'Class representative',
    ),
    senders: responses.filter(
      (r) => roleOf(r) === 'Class representative' || roleOf(r) === 'Instructor or teaching staff',
    ),
  };
}

/**
 * Median of Likert answers, or null when there are none.
 * @param {number[]} values
 */
export function median(values) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? (sorted[middle] ?? null)
    : ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
}

/**
 * Answer counts for one question among the respondents who answered it.
 * @param {Response[]} responses
 * @param {Question} question
 * @returns {{ answered: number, counts: [string, number][], median: number | null }}
 */
export function summarize(responses, question) {
  const values = responses
    .map((response) => response.answers.get(question.id))
    .filter(
      (value) =>
        value !== null && value !== undefined && !(Array.isArray(value) && value.length === 0),
    );
  if (question.type === 'likert') {
    const numbers = /** @type {number[]} */ (values);
    const counts = /** @type {[string, number][]} */ (
      [1, 2, 3, 4, 5].map((point) => [
        String(point),
        numbers.filter((value) => value === point).length,
      ])
    );
    return { answered: numbers.length, counts, median: median(numbers) };
  }
  const options = question.options ?? [];
  const counts = /** @type {[string, number][]} */ (
    options.map((option) => [
      option,
      values.filter((value) => (Array.isArray(value) ? value.includes(option) : value === option))
        .length,
    ])
  );
  return { answered: values.length, counts, median: null };
}

/**
 * @typedef {{ description: string, observed: string, met: boolean | null }} Criterion
 * @typedef {{ id: string, statement: string, population: 'students' | 'senders' | 'everyone', respondents: number, criteria: Criterion[], verdict: 'supported' | 'not supported' | 'insufficient data' }} HypothesisResult
 */

/** @param {number} part @param {number} whole */
const share = (part, whole) => (whole === 0 ? 0 : part / whole);
/** @param {number} value */
const percent = (value) => `${Math.round(value * 100)}%`;

/**
 * Share of respondents (who answered) whose answer is in `values`.
 * @param {Response[]} responses @param {string} questionId @param {string[]} values
 */
function shareChoosing(responses, questionId, values) {
  const answered = responses.filter((r) => {
    const value = r.answers.get(questionId);
    return value !== null && value !== undefined && !(Array.isArray(value) && value.length === 0);
  });
  const matching = answered.filter((r) => {
    const value = r.answers.get(questionId);
    return Array.isArray(value)
      ? value.some((item) => values.includes(item))
      : values.includes(String(value));
  });
  return { value: share(matching.length, answered.length), answered: answered.length };
}

/** @param {Response[]} responses @param {string} questionId */
function likertMedian(responses, questionId) {
  return median(
    /** @type {number[]} */ (
      responses.map((r) => r.answers.get(questionId)).filter((value) => typeof value === 'number')
    ),
  );
}

/**
 * @param {string} description
 * @param {number | null} observed
 * @param {(value: number) => boolean} test
 * @param {(value: number) => string} format
 * @returns {Criterion}
 */
function criterion(description, observed, test, format) {
  return observed === null
    ? { description, observed: 'no answers', met: null }
    : { description, observed: format(observed), met: test(observed) };
}

/**
 * Combines "(A or B) and C" style rules: unknown parts make the result unknown only if
 * they could change it.
 * @param {(boolean | null)[]} parts
 */
const any = (parts) => (parts.includes(true) ? true : parts.includes(null) ? null : false);
/** @param {(boolean | null)[]} parts */
const all = (parts) => (parts.includes(false) ? false : parts.includes(null) ? null : true);

/**
 * Applies the pre-registered thresholds from the survey's analysis plan.
 * @param {Response[]} responses
 * @returns {HypothesisResult[]}
 */
export function evaluateHypotheses(responses) {
  const { all: everyone, students, senders } = groups(responses);
  /** @type {HypothesisResult[]} */
  const results = [];

  /**
   * @param {string} id @param {string} statement @param {'students' | 'senders' | 'everyone'} population
   * @param {Response[]} people @param {number} minimum @param {Criterion[]} criteria @param {boolean | null} supported
   */
  const add = (id, statement, population, people, minimum, criteria, supported) => {
    const verdict =
      people.length < minimum || supported === null
        ? 'insufficient data'
        : supported
          ? 'supported'
          : 'not supported';
    results.push({ id, statement, population, respondents: people.length, criteria, verdict });
  };

  {
    const late = shareChoosing(students, 'q8_late_awareness', ['2–3 times', '4 or more times']);
    const missed = shareChoosing(students, 'q9_missed_deadline', ['Once', 'More than once']);
    const knows = likertMedian(students, 'q10_know_next_7_days');
    const criteria = [
      criterion(
        'Q8 "2–3 times" or more ≥ 50%',
        late.answered ? late.value : null,
        (v) => v >= 0.5,
        percent,
      ),
      criterion(
        'Q9 "Once" or more ≥ 25%',
        missed.answered ? missed.value : null,
        (v) => v >= 0.25,
        percent,
      ),
      criterion('Q10 median ≤ 3', knows, (v) => v <= 3, String),
    ];
    const [a, b, c] = criteria.map((item) => item.met);
    add(
      'H1',
      'Students learn about deadlines late because announcements are buried.',
      'students',
      students,
      MIN_RESPONDENTS.students,
      criteria,
      all([any([a ?? null, b ?? null]), c ?? null]),
    );
  }
  {
    const lost = shareChoosing(
      students,
      'q11_marks_lost_for',
      (QUESTION_BY_ID.get('q11_marks_lost_for')?.options ?? []).filter(
        (o) => o !== 'None of these',
      ),
    );
    const confident = likertMedian(students, 'q13_confident_follow_instructions');
    const criteria = [
      criterion(
        'Q11 any loss other than "None of these" ≥ 30%',
        lost.answered ? lost.value : null,
        (v) => v >= 0.3,
        percent,
      ),
      criterion('Q13 median ≤ 3', confident, (v) => v <= 3, String),
    ];
    add(
      'H2',
      'Students lose marks to avoidable submission mistakes.',
      'students',
      students,
      MIN_RESPONDENTS.students,
      criteria,
      all(criteria.map((item) => item.met)),
    );
  }
  {
    const clusters = shareChoosing(students, 'q14_deadline_clusters', [
      'Often',
      'Almost every week',
    ]);
    const foresee = likertMedian(students, 'q16_see_busy_weeks');
    const criteria = [
      criterion(
        'Q14 "Often" or "Almost every week" ≥ 40%',
        clusters.answered ? clusters.value : null,
        (v) => v >= 0.4,
        percent,
      ),
      criterion('Q16 median ≤ 3', foresee, (v) => v <= 3, String),
    ];
    add(
      'H3',
      'Students cannot anticipate weeks where deadlines cluster.',
      'students',
      students,
      MIN_RESPONDENTS.students,
      criteria,
      all(criteria.map((item) => item.met)),
    );
  }
  {
    const unknown = shareChoosing(senders, 'q17_know_who_saw', ["I don't know"]);
    const repeated = shareChoosing(senders, 'q18_repeat_questions_per_week', [
      '6–15',
      '16 or more',
    ]);
    const confident = likertMedian(senders, 'q19_confident_reach');
    const criteria = [
      criterion(
        'Q17 "I don\'t know" ≥ 50%',
        unknown.answered ? unknown.value : null,
        (v) => v >= 0.5,
        percent,
      ),
      criterion(
        'Q18 "6–15" or more ≥ 50%',
        repeated.answered ? repeated.value : null,
        (v) => v >= 0.5,
        percent,
      ),
      criterion('Q19 median ≤ 3', confident, (v) => v <= 3, String),
    ];
    const [a, b, c] = criteria.map((item) => item.met);
    add(
      'H4',
      'Senders cannot tell whether announcements reached everyone, and answer repeated questions.',
      'senders',
      senders,
      MIN_RESPONDENTS.senders,
      criteria,
      all([any([a ?? null, b ?? null]), c ?? null]),
    );
  }
  {
    const notReasons = ['I still use one', 'I never tried one'];
    const stopped = everyone.filter((r) => {
      const value = r.answers.get('q21_why_stopped');
      return Array.isArray(value) && value.some((reason) => !notReasons.includes(reason));
    });
    const reasons = summarize(
      stopped,
      /** @type {Question} */ (QUESTION_BY_ID.get('q21_why_stopped')),
    ).counts.filter(([reason, count]) => !notReasons.includes(reason) && count > 0);
    const ranked = [...reasons].sort((a, b) => b[1] - a[1]);
    const secondCount = ranked[1]?.[1] ?? ranked[0]?.[1] ?? 0;
    // Ties for second place all count as "among the two most selected".
    const topTwo = ranked.filter(([, count]) => count >= secondCount).map(([reason]) => reason);
    const named = ['Too much manual entry', 'Information changed and it became wrong'];
    const met = stopped.length === 0 ? null : topTwo.some((reason) => named.includes(reason));
    const criteria = [
      {
        description:
          '"Too much manual entry" or "Information changed" among the two most selected Q21 reasons',
        observed: stopped.length === 0 ? 'no answers' : `top reasons: ${topTwo.join('; ')}`,
        met,
      },
    ];
    add(
      'H5',
      'Tracking tools are abandoned mainly because of manual effort.',
      'everyone',
      stopped,
      MIN_RESPONDENTS.students,
      criteria,
      met,
    );
  }
  return results;
}

/**
 * A Mermaid bar chart, rendered by GitHub.
 * @param {string} title
 * @param {[string, number][]} counts
 */
export function barChart(title, counts) {
  const labels = counts.map(([label]) =>
    JSON.stringify(label.length > 28 ? `${label.slice(0, 27)}…` : label),
  );
  const max = Math.max(1, ...counts.map(([, count]) => count));
  return [
    '```mermaid',
    'xychart-beta',
    `    title ${JSON.stringify(title)}`,
    `    x-axis [${labels.join(', ')}]`,
    `    y-axis "Respondents" 0 --> ${max}`,
    `    bar [${counts.map(([, count]) => count).join(', ')}]`,
    '```',
  ].join('\n');
}

/**
 * The Markdown report written to docs/research/findings/survey-analysis.md.
 * @param {Response[]} responses
 * @param {Problem[]} problems
 */
export function renderReport(responses, problems) {
  const { all: everyone, students, senders } = groups(responses);
  const hypotheses = evaluateHypotheses(responses);
  const provisional = everyone.length < TARGET_RESPONDENTS;
  const lines = [
    '# Survey analysis',
    '',
    '<!-- Generated by `npm run research:survey` from data/survey/responses.csv. Do not edit by hand. -->',
    '',
    `**Respondents:** ${everyone.length} (students and class representatives: ${students.length}; senders: ${senders.length}).`,
    '',
  ];
  if (provisional) {
    lines.push(
      `> [!WARNING]`,
      `> Fewer than the planned ${TARGET_RESPONDENTS} responses. Treat every result as provisional.`,
      '',
    );
  }
  lines.push(
    '## Hypotheses',
    '',
    'Verdicts apply the thresholds pre-registered in the [survey analysis plan](../survey.md#analysis-plan-milestone-08). Interview and observation evidence is weighed in the [synthesis](../synthesis/README.md).',
    '',
    '| Hypothesis | Respondents | Verdict |',
    '| --- | --- | --- |',
    ...hypotheses.map((h) => `| **${h.id}** ${h.statement} | ${h.respondents} | ${h.verdict} |`),
    '',
  );
  for (const h of hypotheses) {
    lines.push(`### ${h.id}`, '', '| Criterion | Observed | Met |', '| --- | --- | --- |');
    for (const c of h.criteria) {
      lines.push(
        `| ${c.description} | ${c.observed} | ${c.met === null ? '–' : c.met ? 'yes' : 'no'} |`,
      );
    }
    lines.push('');
  }

  lines.push('## Answers by question', '');
  for (const question of QUESTIONS) {
    if (question.type === 'meta' || question.type === 'text') continue;
    const people =
      question.audience === 'students'
        ? students
        : question.audience === 'senders'
          ? senders
          : everyone;
    const summary = summarize(people, question);
    lines.push(`### ${question.label}`, '');
    if (summary.answered === 0) {
      lines.push('No answers yet.', '');
      continue;
    }
    lines.push(
      `${summary.answered} answered${question.type === 'multiple' ? ' (several choices allowed, so shares can exceed 100%)' : ''}${summary.median === null ? '' : `; median ${summary.median}`}.`,
      '',
      barChart(question.label, summary.counts),
      '',
      '| Answer | Count | Share |',
      '| --- | --- | --- |',
      ...summary.counts.map(
        ([label, count]) =>
          `| ${question.type === 'likert' ? `${label} of 5` : label} | ${count} | ${percent(share(count, summary.answered))} |`,
      ),
      '',
    );
  }

  lines.push(
    '## Open answers',
    '',
    'Coded into the [affinity map](../synthesis/affinity-map.md) with the interview notes. Each answer keeps its response number for citation, for example `R7-Q25`.',
    '',
  );
  for (const id of ['q25_biggest_frustration', 'q26_one_change']) {
    const question = /** @type {Question} */ (QUESTION_BY_ID.get(id));
    const answers = everyone.filter((r) => typeof r.answers.get(id) === 'string');
    lines.push(`### ${question.label}`, '');
    if (answers.length === 0) lines.push('No answers yet.');
    for (const r of answers) {
      lines.push(
        `- **R${String(r.answers.get('response_id') ?? r.row - 1)}-${id.slice(0, 3).toUpperCase()}** ${String(r.answers.get(id)).replace(/\s+/g, ' ')}`,
      );
    }
    lines.push('');
  }

  if (problems.length > 0) {
    lines.push(
      '## Data problems',
      '',
      '| Row | Column | Problem |',
      '| --- | --- | --- |',
      ...problems.map((p) => `| ${p.row} | ${p.column} | ${p.message.replace(/\|/g, '\\|')} |`),
      '',
    );
  }
  return `${lines
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trimEnd()}\n`;
}
