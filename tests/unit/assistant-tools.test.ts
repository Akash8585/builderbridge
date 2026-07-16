import { describe, expect, it } from "vitest";
import {
  isMissingRoadblockProposalConfirmation,
  isMissingScheduleProposalConfirmation,
  isMissingTaskProposalConfirmation,
  isRoadblockActionRequest,
  isRfiActionRequest,
  isScheduleActionRequest,
  isSubmittalActionRequest,
  isTaskActionRequest,
  parseDeterministicProjectControlAction,
  parseDeterministicScheduleWhatIf,
} from "@/lib/assistant-intent";
import { rankTaskNameMatches } from "@/lib/assistant-tools";

describe("rankTaskNameMatches", () => {
  const tasks = [
    { name: "Rough electrical wiring" },
    { name: "Rough plumbing install" },
    { name: "Electrical panel inspection" },
    { name: "Site prep & excavation" },
    { name: "Drywall installation" },
  ];

  it("returns an exact task first", () => {
    const matches = rankTaskNameMatches(tasks, "Electrical panel inspection");
    expect(matches[0]).toMatchObject({ task: tasks[2], score: 1 });
  });

  it("returns useful suggestions when only part of the requested task exists", () => {
    const matches = rankTaskNameMatches(tasks, "Foundation inspection");
    expect(matches.map(({ task }) => task.name)).toEqual(["Electrical panel inspection"]);
  });

  it("does not suggest unrelated tasks", () => {
    expect(rankTaskNameMatches(tasks, "Concrete pour")).toEqual([]);
  });
});

describe("isRoadblockActionRequest", () => {
  it("detects roadblock mutation requests", () => {
    expect(isRoadblockActionRequest("Add a roadblock to Rough electrical wiring")).toBe(true);
    expect(isRoadblockActionRequest("Change the roadblock owner to Sam")).toBe(true);
  });

  it("does not force proposal tools for read-only questions", () => {
    expect(isRoadblockActionRequest("Which roadblocks are still open?")).toBe(false);
    expect(isRoadblockActionRequest("Why is this task blocked? ")).toBe(false);
  });
});

describe("isMissingRoadblockProposalConfirmation", () => {
  it("recovers an affirmative reply after a missing roadblock proposal card", () => {
    expect(
      isMissingRoadblockProposalConfirmation(
        "yes do it",
        "I prepared a proposal to flag the roadblock. Please confirm the proposal card."
      )
    ).toBe(true);
  });

  it("does not treat unrelated confirmations as roadblock actions", () => {
    expect(isMissingRoadblockProposalConfirmation("yes", "I found three open RFIs.")).toBe(false);
  });
});

describe("isTaskActionRequest", () => {
  it("detects consolidated task edits and task creation", () => {
    expect(isTaskActionRequest("Create a task called Level 2 framing from July 20 to July 24")).toBe(true);
    expect(isTaskActionRequest("Move Rough electrical wiring to July 22 and set progress to 40%"))
      .toBe(true);
  });

  it("leaves schedule questions read-only", () => {
    expect(isTaskActionRequest("Which tasks should move next week?")).toBe(false);
    expect(isTaskActionRequest("Show task progress")).toBe(false);
  });
});

describe("isMissingTaskProposalConfirmation", () => {
  it("recovers a missing task proposal", () => {
    expect(
      isMissingTaskProposalConfirmation(
        "go ahead",
        "I prepared a task proposal. Review the proposal card to update the schedule."
      )
    ).toBe(true);
  });
});

describe("isScheduleActionRequest", () => {
  it("detects dependency edits and bulk shifts", () => {
    expect(isScheduleActionRequest("Make drywall installation depend on rough electrical wiring")).toBe(true);
    expect(isScheduleActionRequest("Shift all incomplete tasks by 3 days")).toBe(true);
    expect(isScheduleActionRequest("Move Rough plumbing install and Drywall installation by 2 days")).toBe(true);
    expect(isScheduleActionRequest("What happens if electrical inspection finishes next Friday?")).toBe(true);
    expect(isScheduleActionRequest("Delay the inspection by 3 days and reflow downstream work")).toBe(true);
  });

  it("leaves dependency questions read-only", () => {
    expect(isScheduleActionRequest("Which tasks have dependencies?")).toBe(false);
  });
});

describe("project-controls action intent", () => {
  it("detects RFI and submittal mutations", () => {
    expect(isRfiActionRequest("Raise an RFI for the waterproofing detail")).toBe(true);
    expect(isRfiActionRequest("Answer RFI 17 with the revised elevation")).toBe(true);
    expect(isSubmittalActionRequest("Approve the storefront submittal")).toBe(true);
    expect(isSubmittalActionRequest("Create a submittal for product data")).toBe(true);
  });

  it("leaves project-controls questions read-only", () => {
    expect(isRfiActionRequest("Which RFIs are still open?")).toBe(false);
    expect(isSubmittalActionRequest("Show pending submittals")).toBe(false);
  });
});

describe("parseDeterministicProjectControlAction", () => {
  it("parses common RFI commands without an AI provider", () => {
    expect(parseDeterministicProjectControlAction("Raise an RFI asking Which waterproofing detail applies?"))
      .toEqual({
        toolName: "proposeRfiChange",
        input: { operation: "CREATE", question: "Which waterproofing detail applies" },
      });
    expect(parseDeterministicProjectControlAction("Answer RFI slab edge elevation with Use SK-14"))
      .toEqual({
        toolName: "proposeRfiChange",
        input: { operation: "ANSWER", question: "slab edge elevation", answer: "Use SK-14" },
      });
    expect(parseDeterministicProjectControlAction("Close the RFI concrete mix question"))
      .toMatchObject({ input: { operation: "CLOSE" } });
  });

  it("parses common submittal commands without an AI provider", () => {
    expect(parseDeterministicProjectControlAction("Create a submittal for storefront product data"))
      .toEqual({
        toolName: "proposeSubmittalChange",
        input: { operation: "CREATE", title: "storefront product data" },
      });
    expect(parseDeterministicProjectControlAction("Approve the submittal storefront product data"))
      .toMatchObject({ input: { operation: "UPDATE_STATUS", status: "APPROVED" } });
  });
});

describe("isMissingScheduleProposalConfirmation", () => {
  it("recovers a missing schedule proposal", () => {
    expect(
      isMissingScheduleProposalConfirmation(
        "confirm",
        "I prepared a schedule shift proposal with dependency impact warnings."
      )
    ).toBe(true);
  });
});

describe("parseDeterministicScheduleWhatIf", () => {
  const now = new Date("2026-07-16T12:00:00.000Z");

  it("parses the human finish-date prompt without an AI provider", () => {
    expect(
      parseDeterministicScheduleWhatIf(
        "\u201cWhat happens if Rough plumbing install finishes on August 5, 2026\u201d",
        now
      )
    ).toEqual({
      operation: "REFLOW_SUCCESSORS",
      anchorTaskName: "Rough plumbing install",
      newEndDate: "2026-08-05",
    });
  });

  it("parses relative delays, earlier moves, and weekdays", () => {
    expect(parseDeterministicScheduleWhatIf("Inspection is delayed by 3 days", now)).toMatchObject({
      anchorTaskName: "Inspection",
      shiftDays: 3,
    });
    expect(parseDeterministicScheduleWhatIf("Move drywall 2 days earlier", now)).toMatchObject({
      anchorTaskName: "drywall",
      shiftDays: -2,
    });
    expect(
      parseDeterministicScheduleWhatIf("What happens if inspection finishes next Friday?", now)
    ).toMatchObject({ newEndDate: "2026-07-17" });
    expect(
      parseDeterministicScheduleWhatIf(
        "What happens if inspection finishes on August 5, 2026 and reflow downstream work?",
        now
      )
    ).toMatchObject({ anchorTaskName: "inspection", newEndDate: "2026-08-05" });
  });
});
