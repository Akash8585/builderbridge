const ROADBLOCK_ACTION = /\b(add|assign|change|clear|create|edit|flag|mark|remove|set|update)\b/i;
const ROADBLOCK_SUBJECT = /\b(blocked|blocker|roadblock)\b/i;
const TASK_ACTION = /\b(add|assign|change|create|edit|move|rename|reschedule|set|unassign|update)\b/i;
const TASK_SUBJECT = /\b(activity|assignee|assignment|date|end|progress|schedule|start|status|task)\b/i;
const DIRECT_TASK_ACTION = /\b(assign|create|move|rename|reschedule|unassign)\b/i;
const READ_ONLY_OPENING = /^(how|is|list|show|tell|what|which|why)\b/i;
const DEPENDENCY_ACTION = /\b(add|change|create|link|make|remove|set|unlink)\b/i;
const DEPENDENCY_SUBJECT = /\b(dependency|depend|depends|logic|predecessor|successor)\b/i;
const SHIFT_ACTION = /\b(move|pull|push|shift)\b/i;
const BULK_SHIFT_SUBJECT = /\b(all|activities|days?|entire|incomplete|schedule|tasks?|weeks?)\b/i;
const WHAT_IF_SCHEDULE = /\bwhat (?:happens|would happen) if\b|\b(reflow|cascade|propagate)\b/i;
const RFI_ACTION = /\b(answer|close|create|open|raise|record|respond|update)\b/i;
const RFI_SUBJECT = /\bRFI(?:s)?\b|\brequest(?:s)? for information\b/i;
const SUBMITTAL_ACTION = /\b(approve|create|reject|revise|submit|update)\b/i;
const SUBMITTAL_SUBJECT = /\bsubmittal(?:s)?\b/i;
const AFFIRMATIVE_REPLY = /^(confirm|do it|go ahead|okay|ok|proceed|sure|yes)([,.! ]+(do it|please|proceed))?[.! ]*$/i;

export type DeterministicScheduleWhatIf = {
  operation: "REFLOW_SUCCESSORS";
  anchorTaskName: string;
  shiftDays?: number;
  newStartDate?: string;
  newEndDate?: string;
};

export type DeterministicProjectControlAction =
  | {
      toolName: "proposeRfiChange";
      input: {
        operation: "CREATE" | "ANSWER" | "CLOSE";
        question: string;
        answer?: string;
      };
    }
  | {
      toolName: "proposeSubmittalChange";
      input: {
        operation: "CREATE" | "UPDATE_STATUS";
        title: string;
        status?: "APPROVED" | "REJECTED" | "REVISE_RESUBMIT";
      };
    };

const MONTHS: Record<string, number> = {
  january: 1,
  february: 2,
  march: 3,
  april: 4,
  may: 5,
  june: 6,
  july: 7,
  august: 8,
  september: 9,
  october: 10,
  november: 11,
  december: 12,
};

function isoDate(year: number, month: number, day: number): string | null {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return date.toISOString().slice(0, 10);
}

function parseWhatIfDate(value: string, now: Date): string | null {
  const cleaned = value.trim().replace(/[?.!"\u201c\u201d]+$/g, "").trim();
  const direct = /^(\d{4})-(\d{2})-(\d{2})$/.exec(cleaned);
  if (direct) return isoDate(Number(direct[1]), Number(direct[2]), Number(direct[3]));

  const named = /^([a-z]+)\s+(\d{1,2})(?:,?\s+(\d{4}))?$/i.exec(cleaned);
  if (named) {
    const month = MONTHS[named[1].toLowerCase()];
    if (!month) return null;
    return isoDate(Number(named[3] ?? now.getUTCFullYear()), month, Number(named[2]));
  }

  const weekday = /^(?:next\s+)?(monday|tuesday|wednesday|thursday|friday|saturday|sunday)$/i.exec(
    cleaned
  );
  if (weekday) {
    const weekdays = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
    const target = weekdays.indexOf(weekday[1].toLowerCase());
    const days = ((target - now.getUTCDay() + 7) % 7) || 7;
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + days));
    return date.toISOString().slice(0, 10);
  }
  return null;
}

function cleanAnchorName(value: string) {
  return value
    .trim()
    .replace(/^the\s+(?:task|activity)\s+/i, "")
    .replace(/^["\u201c]|["\u201d]$/g, "")
    .trim();
}

export function parseDeterministicScheduleWhatIf(
  message: string,
  now = new Date()
): DeterministicScheduleWhatIf | null {
  const cleaned = message
    .trim()
    .replace(/^["\u201c]|["\u201d]$/g, "")
    .replace(/\s+(?:and\s+)?(?:reflow|cascade|propagate)\b.*$/i, "")
    .trim();
  const finish = /^(?:what happens if\s+)?(.+?)\s+(?:finishes|finish|ends|end)\s+(?:on\s+)?(.+?)\??$/i.exec(
    cleaned
  );
  if (finish) {
    const newEndDate = parseWhatIfDate(finish[2], now);
    const anchorTaskName = cleanAnchorName(finish[1]);
    if (newEndDate && anchorTaskName) {
      return { operation: "REFLOW_SUCCESSORS", anchorTaskName, newEndDate };
    }
  }

  const start = /^(?:what happens if\s+)?(.+?)\s+(?:starts|start|begins|begin)\s+(?:on\s+)?(.+?)\??$/i.exec(
    cleaned
  );
  if (start) {
    const newStartDate = parseWhatIfDate(start[2], now);
    const anchorTaskName = cleanAnchorName(start[1]);
    if (newStartDate && anchorTaskName) {
      return { operation: "REFLOW_SUCCESSORS", anchorTaskName, newStartDate };
    }
  }

  const delayed = /^(?:what happens if\s+)?(.+?)\s+(?:is\s+)?(?:delayed|pushed)\s+by\s+(\d+)\s+days?/i.exec(
    cleaned
  );
  if (delayed) {
    return {
      operation: "REFLOW_SUCCESSORS",
      anchorTaskName: cleanAnchorName(delayed[1]),
      shiftDays: Number(delayed[2]),
    };
  }

  const delay = /^delay\s+(.+?)\s+by\s+(\d+)\s+days?/i.exec(cleaned);
  if (delay) {
    return {
      operation: "REFLOW_SUCCESSORS",
      anchorTaskName: cleanAnchorName(delay[1]),
      shiftDays: Number(delay[2]),
    };
  }

  const move = /^move\s+(.+?)\s+(\d+)\s+days?\s+(earlier|later)/i.exec(cleaned);
  if (move) {
    const days = Number(move[2]);
    return {
      operation: "REFLOW_SUCCESSORS",
      anchorTaskName: cleanAnchorName(move[1]),
      shiftDays: move[3].toLowerCase() === "earlier" ? -days : days,
    };
  }
  return null;
}

function cleanControlText(value: string) {
  return value
    .trim()
    .replace(/^[:\s"\u201c]+|[?.!\s"\u201d]+$/g, "")
    .trim();
}

export function parseDeterministicProjectControlAction(
  message: string
): DeterministicProjectControlAction | null {
  const cleaned = message.trim().replace(/^['"\u201c]|['"\u201d]$/g, "").trim();
  const answer = /^(?:answer|respond to)\s+(?:the\s+)?rfi\s+(.+?)\s+(?:with|answer(?:ed)?\s*:)\s+(.+)$/i.exec(cleaned);
  if (answer) {
    const question = cleanControlText(answer[1]);
    const response = cleanControlText(answer[2]);
    if (question && response) {
      return { toolName: "proposeRfiChange", input: { operation: "ANSWER", question, answer: response } };
    }
  }

  const close = /^close\s+(?:the\s+)?rfi\s+(.+)$/i.exec(cleaned);
  if (close) {
    const question = cleanControlText(close[1]);
    if (question) return { toolName: "proposeRfiChange", input: { operation: "CLOSE", question } };
  }

  const createRfi = /^(?:create|open|raise|record)\s+(?:an?\s+)?rfi(?:\s+(?:asking|for|about))?\s*[:\-]?\s*(.+)$/i.exec(cleaned);
  if (createRfi) {
    const question = cleanControlText(createRfi[1]);
    if (question) return { toolName: "proposeRfiChange", input: { operation: "CREATE", question } };
  }

  const decision = /^(approve|reject|revise)\s+(?:the\s+)?submittal\s+(.+)$/i.exec(cleaned);
  if (decision) {
    const title = cleanControlText(decision[2]);
    const status = decision[1].toLowerCase() === "approve"
      ? "APPROVED"
      : decision[1].toLowerCase() === "reject"
        ? "REJECTED"
        : "REVISE_RESUBMIT";
    if (title) {
      return { toolName: "proposeSubmittalChange", input: { operation: "UPDATE_STATUS", title, status } };
    }
  }

  const createSubmittal = /^(?:create|submit)\s+(?:an?\s+)?submittal(?:\s+(?:called|named|for))?\s*[:\-]?\s*(.+)$/i.exec(cleaned);
  if (createSubmittal) {
    const title = cleanControlText(createSubmittal[1]);
    if (title) return { toolName: "proposeSubmittalChange", input: { operation: "CREATE", title } };
  }
  return null;
}

export function isRoadblockActionRequest(message: string) {
  return ROADBLOCK_ACTION.test(message) && ROADBLOCK_SUBJECT.test(message);
}

export function isTaskActionRequest(message: string) {
  const trimmed = message.trim();
  if (READ_ONLY_OPENING.test(trimmed) || ROADBLOCK_SUBJECT.test(trimmed)) return false;
  return TASK_ACTION.test(trimmed) && (TASK_SUBJECT.test(trimmed) || DIRECT_TASK_ACTION.test(trimmed));
}

export function isScheduleActionRequest(message: string) {
  const trimmed = message.trim();
  if (WHAT_IF_SCHEDULE.test(trimmed)) return true;
  if (READ_ONLY_OPENING.test(trimmed)) return false;
  return (
    (DEPENDENCY_ACTION.test(trimmed) && DEPENDENCY_SUBJECT.test(trimmed)) ||
    (SHIFT_ACTION.test(trimmed) && BULK_SHIFT_SUBJECT.test(trimmed))
  );
}

export function isRfiActionRequest(message: string) {
  const trimmed = message.trim();
  if (READ_ONLY_OPENING.test(trimmed)) return false;
  return RFI_ACTION.test(trimmed) && RFI_SUBJECT.test(trimmed);
}

export function isSubmittalActionRequest(message: string) {
  const trimmed = message.trim();
  if (READ_ONLY_OPENING.test(trimmed)) return false;
  return SUBMITTAL_ACTION.test(trimmed) && SUBMITTAL_SUBJECT.test(trimmed);
}

export function isMissingRoadblockProposalConfirmation(message: string, previousAssistantText: string) {
  return (
    AFFIRMATIVE_REPLY.test(message.trim()) &&
    /\bproposal\b/i.test(previousAssistantText) &&
    /\broadblock\b/i.test(previousAssistantText)
  );
}

export function isMissingTaskProposalConfirmation(message: string, previousAssistantText: string) {
  return (
    AFFIRMATIVE_REPLY.test(message.trim()) &&
    /\bproposal\b/i.test(previousAssistantText) &&
    /\b(task|activity|schedule)\b/i.test(previousAssistantText)
  );
}

export function isMissingScheduleProposalConfirmation(message: string, previousAssistantText: string) {
  return (
    AFFIRMATIVE_REPLY.test(message.trim()) &&
    /\bproposal\b/i.test(previousAssistantText) &&
    /\b(dependency|schedule|shift|reflow|what-if)\b/i.test(previousAssistantText)
  );
}

export function isMissingProjectControlProposalConfirmation(message: string, previousAssistantText: string) {
  return (
    AFFIRMATIVE_REPLY.test(message.trim()) &&
    /\bproposal\b/i.test(previousAssistantText) &&
    /\b(RFI|submittal)\b/i.test(previousAssistantText)
  );
}
