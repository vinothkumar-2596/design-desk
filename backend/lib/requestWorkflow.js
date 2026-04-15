const normalize = (value) => String(value || "").trim().toLowerCase();

const hasAssignedDesigner = (task) =>
  Boolean(
    String(task?.assignedToId || task?.assignedToName || task?.assignedTo || "").trim()
  );

const hasFinalUploads = (task) =>
  Array.isArray(task?.finalDeliverableVersions) && task.finalDeliverableVersions.length > 0;

const resolveAdminReviewStatus = (task) => {
  const adminReviewStatus = normalize(task?.adminReviewStatus);
  if (
    adminReviewStatus === "pending" ||
    adminReviewStatus === "needs_info" ||
    adminReviewStatus === "approved" ||
    adminReviewStatus === "rejected"
  ) {
    return adminReviewStatus;
  }

  const approvalStatus = normalize(task?.approvalStatus);
  if (
    approvalStatus === "pending" ||
    approvalStatus === "approved" ||
    approvalStatus === "rejected"
  ) {
    return approvalStatus;
  }

  return "pending";
};

const resolveFinalReviewStatus = (task) => {
  const finalReviewStatus = normalize(task?.finalDeliverableReviewStatus);
  if (
    finalReviewStatus === "not_submitted" ||
    finalReviewStatus === "pending" ||
    finalReviewStatus === "approved" ||
    finalReviewStatus === "rejected"
  ) {
    return finalReviewStatus;
  }

  if (normalize(task?.status) === "completed" && hasFinalUploads(task)) {
    return "approved";
  }

  if (normalize(task?.status) === "under_review" && hasFinalUploads(task)) {
    return "pending";
  }

  return "not_submitted";
};

const createStep = (key, ownerRole, title, status, detail) => ({
  key,
  ownerRole,
  title,
  status,
  detail,
});

export const getSimpleRequestWorkflow = (task = {}) => {
  const adminReviewStatus = resolveAdminReviewStatus(task);
  const finalReviewStatus = resolveFinalReviewStatus(task);
  const designerAssigned = hasAssignedDesigner(task);
  const finalUploadsPresent = hasFinalUploads(task);

  const staffCreateStep = createStep(
    "staff_create",
    "staff",
    "Staff creates request",
    "completed",
    "Request submitted to admin for intake review."
  );

  let adminReviewStepStatus = "active";
  let adminReviewDetail = "Admin needs to review and approve the request.";

  if (adminReviewStatus === "approved") {
    adminReviewStepStatus = "completed";
    adminReviewDetail = "Admin approved the request.";
  } else if (adminReviewStatus === "needs_info") {
    adminReviewStepStatus = "changes_requested";
    adminReviewDetail = "Admin requested more information from staff.";
  } else if (adminReviewStatus === "rejected") {
    adminReviewStepStatus = "rejected";
    adminReviewDetail = "Admin rejected the request.";
  }

  let designerStepStatus = "blocked";
  let designerStepOwnerRole = "designer";
  let designerDetail = "Designer starts after admin approval.";
  if (adminReviewStatus === "approved") {
    if (!designerAssigned) {
      designerStepStatus = "pending";
      designerStepOwnerRole = "admin";
      designerDetail = "Waiting for admin to assign a designer.";
    } else if (finalReviewStatus === "rejected") {
      designerStepStatus = "changes_requested";
      designerDetail = "Admin rejected the final files and sent them back to the designer.";
    } else if (finalUploadsPresent || finalReviewStatus !== "not_submitted") {
      designerStepStatus = "completed";
      designerDetail = "Designer uploaded the final files.";
    } else {
      designerStepStatus = "active";
      designerDetail = "Designer is preparing and uploading final files.";
    }
  }

  let adminReceiveStepStatus = "blocked";
  let adminReceiveDetail = "Admin confirms final files after designer upload.";
  if (adminReviewStatus === "approved") {
    if (finalReviewStatus === "approved") {
      adminReceiveStepStatus = "completed";
      adminReceiveDetail = "Admin confirmed the final files.";
    } else if (finalReviewStatus === "rejected") {
      adminReceiveStepStatus = "rejected";
      adminReceiveDetail = "Admin reviewed the final files and requested changes.";
    } else if (finalReviewStatus === "pending") {
      adminReceiveStepStatus = "active";
      adminReceiveDetail = "Admin received the final files and confirmation is pending.";
    } else if (finalUploadsPresent) {
      adminReceiveStepStatus = "active";
      adminReceiveDetail = "Final files are uploaded and waiting for admin confirmation.";
    } else {
      adminReceiveStepStatus = "pending";
      adminReceiveDetail = "Waiting for the designer to upload final files.";
    }
  }

  let staffReceiveStepStatus = "blocked";
  let staffReceiveDetail = "Staff receives the approved files at the end.";
  if (finalReviewStatus === "approved") {
    staffReceiveStepStatus = "completed";
    staffReceiveDetail = "Staff received the approved final files from admin.";
  } else if (finalReviewStatus === "rejected") {
    staffReceiveDetail = "Waiting for the designer to resubmit and admin to approve the final files.";
  } else if (adminReviewStatus === "approved") {
    staffReceiveStepStatus = "pending";
    staffReceiveDetail = "Waiting for the final files to be approved and shared.";
  }

  const steps = [
    staffCreateStep,
    createStep(
      "admin_review",
      adminReviewStatus === "needs_info" ? "staff" : "admin",
      "Admin reviews request",
      adminReviewStepStatus,
      adminReviewDetail
    ),
    createStep(
      "designer_upload",
      designerStepOwnerRole,
      "Designer uploads final files",
      designerStepStatus,
      designerDetail
    ),
    createStep(
      "admin_receive",
      "admin",
      "Admin confirms final files",
      adminReceiveStepStatus,
      adminReceiveDetail
    ),
    createStep(
      "staff_receive",
      "staff",
      "Staff receives final files",
      staffReceiveStepStatus,
      staffReceiveDetail
    ),
  ];

  const currentStep =
    steps.find((step) => step.status === "active") ||
    steps.find((step) => step.status === "changes_requested") ||
    steps.find((step) => step.status === "rejected") ||
    steps.find((step) => step.status === "pending") ||
    steps[steps.length - 1];

  return {
    currentStepKey: currentStep.key,
    currentOwnerRole: currentStep.ownerRole,
    steps,
  };
};
