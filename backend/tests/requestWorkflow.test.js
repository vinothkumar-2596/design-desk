import assert from "node:assert/strict";

import { getSimpleRequestWorkflow } from "../lib/requestWorkflow.js";

const STEP_KEYS = [
  "staff_create",
  "admin_review",
  "designer_upload",
  "admin_receive",
  "staff_receive",
];

const buildFinalVersions = (count) =>
  Array.from({ length: count }, (_, index) => ({
    id: `v${index + 1}`,
    version: index + 1,
  }));

const findStep = (flow, key) => flow.steps.find((step) => step.key === key);

const assertStep = (flow, key, expected) => {
  const step = findStep(flow, key);
  assert.ok(step, `Missing workflow step: ${key}`);

  for (const [field, value] of Object.entries(expected)) {
    assert.equal(
      step?.[field],
      value,
      `Expected ${key}.${field} to be ${JSON.stringify(value)} but received ${JSON.stringify(
        step?.[field]
      )}`
    );
  }
};

const assertWorkflowContract = (flow) => {
  assert.equal(flow.steps.length, STEP_KEYS.length);
  assert.deepEqual(
    flow.steps.map((step) => step.key),
    STEP_KEYS,
    "Workflow steps should stay in the expected order."
  );

  const currentStep = findStep(flow, flow.currentStepKey);
  assert.ok(currentStep, `Current step ${flow.currentStepKey} should exist in the workflow.`);
  assert.equal(
    flow.currentOwnerRole,
    currentStep.ownerRole,
    "Current owner should match the current step owner."
  );

  assertStep(flow, "staff_create", {
    ownerRole: "staff",
    status: "completed",
  });
};

const runScenario = ({ name, task, currentStepKey, currentOwnerRole, steps }) => {
  const flow = getSimpleRequestWorkflow(task);

  assertWorkflowContract(flow);
  assert.equal(flow.currentStepKey, currentStepKey, `${name}: current step mismatch.`);
  assert.equal(flow.currentOwnerRole, currentOwnerRole, `${name}: current owner mismatch.`);

  for (const [key, expected] of Object.entries(steps || {})) {
    assertStep(flow, key, expected);
  }

  console.log(`PASS ${name}`);
};

const branchScenarios = [
  {
    name: "direct branch: request starts with admin intake review",
    task: {
      status: "pending",
      adminReviewStatus: "pending",
      finalDeliverableReviewStatus: "not_submitted",
    },
    currentStepKey: "admin_review",
    currentOwnerRole: "admin",
    steps: {
      admin_review: { ownerRole: "admin", status: "active" },
      designer_upload: { ownerRole: "designer", status: "blocked" },
      admin_receive: { ownerRole: "admin", status: "blocked" },
      staff_receive: { ownerRole: "staff", status: "blocked" },
    },
  },
  {
    name: "direct branch: admin asks staff for more information",
    task: {
      status: "pending",
      adminReviewStatus: "needs_info",
    },
    currentStepKey: "admin_review",
    currentOwnerRole: "staff",
    steps: {
      admin_review: {
        ownerRole: "staff",
        status: "changes_requested",
        detail: "Admin requested more information from staff.",
      },
      designer_upload: { status: "blocked" },
      admin_receive: { status: "blocked" },
      staff_receive: { status: "blocked" },
    },
  },
  {
    name: "direct branch: admin rejects the request during intake",
    task: {
      status: "pending",
      adminReviewStatus: "rejected",
    },
    currentStepKey: "admin_review",
    currentOwnerRole: "admin",
    steps: {
      admin_review: {
        ownerRole: "admin",
        status: "rejected",
        detail: "Admin rejected the request.",
      },
      designer_upload: { status: "blocked" },
      admin_receive: { status: "blocked" },
      staff_receive: { status: "blocked" },
    },
  },
  {
    name: "direct branch: approved request waits with admin until assignment",
    task: {
      status: "pending",
      adminReviewStatus: "approved",
      finalDeliverableReviewStatus: "not_submitted",
    },
    currentStepKey: "designer_upload",
    currentOwnerRole: "admin",
    steps: {
      admin_review: { status: "completed" },
      designer_upload: {
        ownerRole: "admin",
        status: "pending",
        detail: "Waiting for admin to assign a designer.",
      },
      admin_receive: { status: "pending" },
      staff_receive: { status: "pending" },
    },
  },
  {
    name: "direct branch: assigned designer is actively preparing final files",
    task: {
      status: "assigned",
      adminReviewStatus: "approved",
      assignedToId: "designer-1",
      assignedToName: "Designer One",
      finalDeliverableReviewStatus: "not_submitted",
    },
    currentStepKey: "designer_upload",
    currentOwnerRole: "designer",
    steps: {
      admin_review: { status: "completed" },
      designer_upload: {
        ownerRole: "designer",
        status: "active",
        detail: "Designer is preparing and uploading final files.",
      },
      admin_receive: {
        status: "pending",
        detail: "Waiting for the designer to upload final files.",
      },
      staff_receive: { status: "pending" },
    },
  },
  {
    name: "direct branch: designer upload moves workflow to admin final review",
    task: {
      status: "under_review",
      adminReviewStatus: "approved",
      assignedToId: "designer-1",
      finalDeliverableReviewStatus: "pending",
      finalDeliverableVersions: buildFinalVersions(1),
    },
    currentStepKey: "admin_receive",
    currentOwnerRole: "admin",
    steps: {
      designer_upload: {
        ownerRole: "designer",
        status: "completed",
        detail: "Designer uploaded the final files.",
      },
      admin_receive: {
        ownerRole: "admin",
        status: "active",
        detail: "Admin received the final files and confirmation is pending.",
      },
      staff_receive: {
        ownerRole: "staff",
        status: "pending",
      },
    },
  },
  {
    name: "direct branch: uploaded files without explicit review status still wait for admin",
    task: {
      status: "in_progress",
      adminReviewStatus: "approved",
      assignedToId: "designer-1",
      finalDeliverableVersions: buildFinalVersions(1),
    },
    currentStepKey: "admin_receive",
    currentOwnerRole: "admin",
    steps: {
      designer_upload: {
        status: "completed",
        detail: "Designer uploaded the final files.",
      },
      admin_receive: {
        status: "active",
        detail: "Final files are uploaded and waiting for admin confirmation.",
      },
      staff_receive: { status: "pending" },
    },
  },
  {
    name: "direct branch: rejected final files return to the designer",
    task: {
      status: "in_progress",
      adminReviewStatus: "approved",
      assignedToId: "designer-1",
      finalDeliverableReviewStatus: "rejected",
      finalDeliverableVersions: buildFinalVersions(1),
    },
    currentStepKey: "designer_upload",
    currentOwnerRole: "designer",
    steps: {
      designer_upload: {
        ownerRole: "designer",
        status: "changes_requested",
        detail: "Admin rejected the final files and sent them back to the designer.",
      },
      admin_receive: {
        ownerRole: "admin",
        status: "rejected",
        detail: "Admin reviewed the final files and requested changes.",
      },
      staff_receive: {
        ownerRole: "staff",
        status: "blocked",
        detail: "Waiting for the designer to resubmit and admin to approve the final files.",
      },
    },
  },
  {
    name: "direct branch: approved final files are delivered to staff",
    task: {
      status: "completed",
      adminReviewStatus: "approved",
      assignedToId: "designer-1",
      finalDeliverableReviewStatus: "approved",
      finalDeliverableVersions: buildFinalVersions(1),
    },
    currentStepKey: "staff_receive",
    currentOwnerRole: "staff",
    steps: {
      designer_upload: { status: "completed" },
      admin_receive: {
        status: "completed",
        detail: "Admin confirmed the final files.",
      },
      staff_receive: {
        status: "completed",
        detail: "Staff received the approved final files from admin.",
      },
    },
  },
];

const fallbackScenarios = [
  {
    name: "fallback: legacy approvalStatus pending maps to admin review pending",
    task: {
      status: "pending",
      approvalStatus: "pending",
    },
    currentStepKey: "admin_review",
    currentOwnerRole: "admin",
    steps: {
      admin_review: { status: "active" },
      designer_upload: { status: "blocked" },
    },
  },
  {
    name: "fallback: legacy approvalStatus approved keeps assigned designer active",
    task: {
      status: "assigned",
      approvalStatus: "approved",
      assignedToId: "designer-legacy",
    },
    currentStepKey: "designer_upload",
    currentOwnerRole: "designer",
    steps: {
      admin_review: { status: "completed" },
      designer_upload: { status: "active" },
      admin_receive: { status: "pending" },
    },
  },
  {
    name: "fallback: legacy approvalStatus rejected maps to intake rejection",
    task: {
      status: "pending",
      approvalStatus: "rejected",
    },
    currentStepKey: "admin_review",
    currentOwnerRole: "admin",
    steps: {
      admin_review: { status: "rejected" },
      designer_upload: { status: "blocked" },
    },
  },
  {
    name: "fallback: under_review status with uploaded files infers final review pending",
    task: {
      status: "under_review",
      adminReviewStatus: "approved",
      assignedToId: "designer-1",
      finalDeliverableVersions: buildFinalVersions(1),
    },
    currentStepKey: "admin_receive",
    currentOwnerRole: "admin",
    steps: {
      designer_upload: { status: "completed" },
      admin_receive: {
        status: "active",
        detail: "Admin received the final files and confirmation is pending.",
      },
      staff_receive: { status: "pending" },
    },
  },
  {
    name: "fallback: completed status with uploaded files infers final review approved",
    task: {
      status: "completed",
      adminReviewStatus: "approved",
      assignedToId: "designer-1",
      finalDeliverableVersions: buildFinalVersions(1),
    },
    currentStepKey: "staff_receive",
    currentOwnerRole: "staff",
    steps: {
      designer_upload: { status: "completed" },
      admin_receive: { status: "completed" },
      staff_receive: { status: "completed" },
    },
  },
  {
    name: "fallback: explicit rejected final review is preserved over completed task status",
    task: {
      status: "completed",
      adminReviewStatus: "approved",
      assignedToId: "designer-1",
      finalDeliverableReviewStatus: "rejected",
      finalDeliverableVersions: buildFinalVersions(2),
    },
    currentStepKey: "designer_upload",
    currentOwnerRole: "designer",
    steps: {
      designer_upload: { status: "changes_requested" },
      admin_receive: { status: "rejected" },
      staff_receive: { status: "blocked" },
    },
  },
  {
    name: "fallback: assignment is detected from assignedTo when id is missing",
    task: {
      status: "assigned",
      adminReviewStatus: "approved",
      assignedTo: "designer@example.com",
    },
    currentStepKey: "designer_upload",
    currentOwnerRole: "designer",
    steps: {
      designer_upload: { status: "active" },
      admin_receive: { status: "pending" },
    },
  },
  {
    name: "fallback: invalid stored values default back to intake review",
    task: {
      status: "pending",
      adminReviewStatus: "unexpected",
      approvalStatus: "unknown",
      finalDeliverableReviewStatus: "mystery",
    },
    currentStepKey: "admin_review",
    currentOwnerRole: "admin",
    steps: {
      admin_review: { status: "active" },
      designer_upload: { status: "blocked" },
      admin_receive: { status: "blocked" },
      staff_receive: { status: "blocked" },
    },
  },
];

const realTimeJourney = [
  {
    name: "journey stage 1: staff submits request",
    task: {
      status: "pending",
      adminReviewStatus: "pending",
    },
    currentStepKey: "admin_review",
    currentOwnerRole: "admin",
  },
  {
    name: "journey stage 2: admin requests more information",
    task: {
      status: "pending",
      adminReviewStatus: "needs_info",
    },
    currentStepKey: "admin_review",
    currentOwnerRole: "staff",
  },
  {
    name: "journey stage 3: staff resubmits for admin review",
    task: {
      status: "pending",
      adminReviewStatus: "pending",
      adminReviewResponseStatus: "submitted",
    },
    currentStepKey: "admin_review",
    currentOwnerRole: "admin",
  },
  {
    name: "journey stage 4: admin approves and assignment is pending",
    task: {
      status: "pending",
      adminReviewStatus: "approved",
    },
    currentStepKey: "designer_upload",
    currentOwnerRole: "admin",
  },
  {
    name: "journey stage 5: designer is assigned and starts work",
    task: {
      status: "in_progress",
      adminReviewStatus: "approved",
      assignedToId: "designer-1",
      assignedToName: "Designer One",
    },
    currentStepKey: "designer_upload",
    currentOwnerRole: "designer",
  },
  {
    name: "journey stage 6: designer uploads final files for admin review",
    task: {
      status: "under_review",
      adminReviewStatus: "approved",
      assignedToId: "designer-1",
      finalDeliverableVersions: buildFinalVersions(1),
    },
    currentStepKey: "admin_receive",
    currentOwnerRole: "admin",
  },
  {
    name: "journey stage 7: admin rejects the submitted final files",
    task: {
      status: "in_progress",
      adminReviewStatus: "approved",
      assignedToId: "designer-1",
      finalDeliverableReviewStatus: "rejected",
      finalDeliverableVersions: buildFinalVersions(1),
    },
    currentStepKey: "designer_upload",
    currentOwnerRole: "designer",
  },
  {
    name: "journey stage 8: designer resubmits updated final files",
    task: {
      status: "under_review",
      adminReviewStatus: "approved",
      assignedToId: "designer-1",
      finalDeliverableReviewStatus: "pending",
      finalDeliverableVersions: buildFinalVersions(2),
    },
    currentStepKey: "admin_receive",
    currentOwnerRole: "admin",
  },
  {
    name: "journey stage 9: admin approves and staff receives delivery",
    task: {
      status: "completed",
      adminReviewStatus: "approved",
      assignedToId: "designer-1",
      finalDeliverableReviewStatus: "approved",
      finalDeliverableVersions: buildFinalVersions(2),
    },
    currentStepKey: "staff_receive",
    currentOwnerRole: "staff",
  },
];

let passed = 0;

for (const scenario of [...branchScenarios, ...fallbackScenarios]) {
  runScenario(scenario);
  passed += 1;
}

for (const stage of realTimeJourney) {
  runScenario({
    ...stage,
    steps: {
      [stage.currentStepKey]: { ownerRole: stage.currentOwnerRole },
    },
  });
  passed += 1;
}

console.log(`\n${passed} workflow scenarios passed.`);
