const role = window.location.pathname.includes("client-") ? "client" : "student";
const title = document.querySelector("[data-workspace-title]");
const counterpart = document.querySelector("[data-workspace-counterpart]");
const statusBadge = document.querySelector("[data-workspace-status]");
const deadline = document.querySelector("[data-workspace-deadline]");
const actions = document.querySelector("[data-workspace-actions]");
const canvas = document.querySelector("[data-workspace-canvas]");
const tabs = [...document.querySelectorAll("[data-workspace-tab]")];

let workspace = { quests: [], quest: null, deliverables: [] };
let activeTab = "deliverables";

function escapeHtml(value) {
    const element = document.createElement("div");
    element.textContent = value ?? "";
    return element.innerHTML;
}

function formatDate(value) {
    if (!value) return "No deadline";
    return new Intl.DateTimeFormat("en-PH", {
        year: "numeric",
        month: "short",
        day: "numeric",
    }).format(new Date(`${value}T00:00:00`));
}

function formatTimestamp(value) {
    if (!value) return "Recently";
    const normalized = value.includes("T") ? value : value.replace(" ", "T");
    return new Intl.DateTimeFormat("en-PH", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
    }).format(new Date(`${normalized}Z`));
}

function labelStatus(value) {
    return {
        in_progress: "In Progress",
        submitted: "Awaiting Review",
        completed: "Completed",
        pending: "Not Submitted",
        revision_requested: "Revision Requested",
        approved: "Approved",
    }[value] || value;
}

function statusTone(value) {
    if (value === "approved" || value === "completed") return "text-status-success";
    if (value === "revision_requested") return "text-error";
    if (value === "submitted") return "text-status-info";
    return "text-status-pending";
}

function renderDeliverable(deliverable) {
    const note = deliverable.submission_note
        ? `<p class="mt-2 text-on-surface-variant"><strong>Submission note:</strong> ${escapeHtml(deliverable.submission_note)}</p>`
        : "";
    let controls = "";
    if (role === "student" && workspace.quest.status !== "completed" && deliverable.submission_status !== "approved") {
        controls = `
            <div class="mt-4 flex flex-col sm:flex-row gap-2">
                <input class="flex-1 bg-surface-bright border border-border-subtle rounded px-3 py-2 font-body-sm text-body-sm"
                    data-submission-note="${deliverable.id}" maxlength="500"
                    placeholder="Add a link or short delivery note" type="text"
                    value="${escapeHtml(deliverable.submission_note || "")}">
                <button class="px-4 py-2 bg-primary-container text-white rounded font-label-md text-label-md hover:opacity-90"
                    data-submit-deliverable="${deliverable.id}" type="button">
                    ${deliverable.submission_status === "revision_requested" ? "Resubmit" : "Submit for Review"}
                </button>
            </div>`;
    }
    if (role === "client" && deliverable.submission_status === "submitted") {
        controls = `
            <div class="mt-4 flex gap-2">
                <button class="px-4 py-2 border border-border-subtle text-on-surface-variant rounded font-label-md text-label-md"
                    data-review-deliverable="${deliverable.id}" data-decision="revision_requested" type="button">Request Revision</button>
                <button class="px-4 py-2 bg-primary-container text-white rounded font-label-md text-label-md"
                    data-review-deliverable="${deliverable.id}" data-decision="approved" type="button">Approve</button>
            </div>`;
    }

    return `
        <article class="p-4 rounded-lg border border-border-subtle bg-surface-container-lowest relative overflow-hidden">
            <div class="absolute left-0 top-0 bottom-0 w-1 ${deliverable.submission_status === "approved" ? "bg-status-success" : "bg-surface-container-high"}"></div>
            <div class="flex items-start justify-between gap-4">
                <div>
                    <h3 class="font-headline-sm text-[16px] text-on-background">${escapeHtml(deliverable.title)}</h3>
                    ${note}
                </div>
                <span class="shrink-0 font-label-sm text-label-sm ${statusTone(deliverable.submission_status)}">
                    ${escapeHtml(labelStatus(deliverable.submission_status))}
                </span>
            </div>
            ${controls}
        </article>`;
}

function renderReviewPanel() {
    if (workspace.quest.status !== "completed") return "";
    const form = workspace.currentReview
        ? `<div class="p-3 bg-surface-container-low rounded">
                <p class="font-label-md text-label-md text-on-background">Your review: ${workspace.currentReview.rating}/5</p>
                <p class="font-body-sm text-body-sm text-on-surface-variant mt-1">${escapeHtml(workspace.currentReview.comment || "No written comment.")}</p>
           </div>`
        : `<div class="grid gap-3">
                <label class="font-label-sm text-label-sm text-on-surface-variant">
                    Rating
                    <select class="mt-1 w-full border border-border-subtle rounded bg-surface px-3 py-2 text-on-background" data-review-rating>
                        <option value="5">5 - Excellent</option>
                        <option value="4">4 - Very good</option>
                        <option value="3">3 - Good</option>
                        <option value="2">2 - Needs improvement</option>
                        <option value="1">1 - Poor</option>
                    </select>
                </label>
                <textarea class="w-full border border-border-subtle rounded bg-surface px-3 py-2 font-body-sm text-body-sm"
                    data-review-comment maxlength="1000" placeholder="Share constructive feedback" rows="3"></textarea>
                <button class="px-4 py-2 bg-primary-container text-white rounded font-label-md text-label-md"
                    data-submit-review type="button">Submit Review</button>
           </div>`;
    const received = workspace.receivedReview
        ? `<div class="mt-4 pt-4 border-t border-border-subtle">
                <p class="font-label-md text-label-md text-on-background">Feedback from ${escapeHtml(workspace.receivedReview.reviewer_name)}: ${workspace.receivedReview.rating}/5</p>
                <p class="font-body-sm text-body-sm text-on-surface-variant mt-1">${escapeHtml(workspace.receivedReview.comment || "No written comment.")}</p>
           </div>`
        : '<p class="mt-4 pt-4 border-t border-border-subtle font-body-sm text-body-sm text-on-surface-variant">The other participant has not reviewed this quest yet.</p>';
    return `
        <section class="bg-surface-container-lowest border border-border-subtle rounded-xl p-stack-lg">
            <h2 class="font-headline-sm text-headline-sm text-on-background mb-3">Quest Review</h2>
            ${form}
            ${received}
        </section>`;
}

function syncTabs() {
    tabs.forEach((tab) => {
        const selected = tab.dataset.workspaceTab === activeTab;
        tab.classList.toggle("border-primary", selected);
        tab.classList.toggle("text-primary", selected);
        tab.classList.toggle("font-bold", selected);
        tab.classList.toggle("border-transparent", !selected);
        tab.classList.toggle("text-on-surface-variant", !selected);
        tab.setAttribute("aria-selected", String(selected));
    });
}

function renderOverview(approved, percent) {
    const counterpartName = role === "client" ? workspace.quest.student_name : workspace.quest.client_name;
    canvas.innerHTML = `
        <section class="lg:col-span-8 bg-surface-container-lowest border border-border-subtle rounded-xl p-stack-lg shadow-sm">
            <p class="font-label-sm text-label-sm text-primary uppercase tracking-widest">Quest Brief</p>
            <h2 class="font-headline-sm text-headline-sm text-on-background mt-2">${escapeHtml(workspace.quest.title)}</h2>
            <p class="font-body-md text-body-md text-on-surface-variant whitespace-pre-line mt-4">${escapeHtml(workspace.quest.description || "No description was provided.")}</p>
        </section>
        <aside class="lg:col-span-4 flex flex-col gap-gutter">
            <section class="bg-surface-container-lowest border border-border-subtle rounded-xl p-stack-lg">
                <h2 class="font-headline-sm text-headline-sm text-on-background">Progress</h2>
                <p class="font-headline-lg text-headline-lg text-on-background mt-3">${approved}/${workspace.deliverables.length}</p>
                <p class="font-body-sm text-body-sm text-on-surface-variant">deliverables approved</p>
                <div class="bg-surface-container-high rounded-full h-2 overflow-hidden mt-4">
                    <div class="bg-primary-container h-full rounded-full" style="width: ${percent}%"></div>
                </div>
            </section>
            <section class="bg-surface-container-lowest border border-border-subtle rounded-xl p-stack-lg">
                <dl class="grid gap-3 font-body-sm text-body-sm">
                    <div><dt class="text-on-surface-variant">${role === "client" ? "Student" : "Client"}</dt><dd class="text-on-background">${escapeHtml(counterpartName || "Not assigned")}</dd></div>
                    <div><dt class="text-on-surface-variant">Deadline</dt><dd class="text-on-background">${escapeHtml(formatDate(workspace.quest.deadline))}</dd></div>
                    <div><dt class="text-on-surface-variant">Arrangement</dt><dd class="text-on-background capitalize">${escapeHtml(workspace.quest.work_arrangement || "Not specified")}</dd></div>
                </dl>
            </section>
        </aside>`;
}

function renderFiles() {
    const submissions = workspace.deliverables.filter((item) => item.submission_note || item.submitted_at);
    canvas.innerHTML = `
        <section class="lg:col-span-12 bg-surface-container-lowest border border-border-subtle rounded-xl p-stack-lg shadow-sm">
            <p class="font-label-sm text-label-sm text-primary uppercase tracking-widest">Submissions</p>
            <h2 class="font-headline-sm text-headline-sm text-on-background mt-2">Files and submission notes</h2>
            <p class="font-body-sm text-body-sm text-on-surface-variant mt-2">File uploads are outside this MVP. Submitted links and notes appear here.</p>
            <div class="flex flex-col gap-3 mt-6">
                ${submissions.length
                    ? submissions.map((item) => `
                        <article class="p-4 rounded-lg border border-border-subtle bg-surface-container-lowest">
                            <div class="flex flex-wrap items-start justify-between gap-3">
                                <h3 class="font-headline-sm text-[16px] text-on-background">${escapeHtml(item.title)}</h3>
                                <span class="font-label-sm text-label-sm text-on-surface-variant">${formatTimestamp(item.submitted_at)}</span>
                            </div>
                            <p class="font-body-sm text-body-sm text-on-surface-variant whitespace-pre-line mt-2">${escapeHtml(item.submission_note || "Submitted without notes.")}</p>
                        </article>`).join("")
                    : '<p class="p-8 rounded-lg bg-surface-container-low text-center text-on-surface-variant">No submissions have been added yet.</p>'}
            </div>
        </section>`;
}

function renderMessages() {
    canvas.innerHTML = `
        <section class="lg:col-span-12 bg-surface-container-lowest border border-border-subtle rounded-xl p-stack-lg text-center shadow-sm">
            <span class="material-symbols-outlined text-primary text-[48px]">forum</span>
            <h2 class="font-headline-sm text-headline-sm text-on-background mt-3">Quest messages</h2>
            <p class="font-body-md text-body-md text-on-surface-variant mt-2">Keep project decisions and updates together in the dedicated conversation.</p>
            ${role === "student"
                ? `<a class="inline-flex items-center gap-2 px-5 py-3 bg-primary-container text-white rounded font-label-md text-label-md mt-6 hover:opacity-90"
                        href="/pages/student-messages.html?questId=${encodeURIComponent(workspace.quest.id)}">
                        Open conversation <span class="material-symbols-outlined text-[18px]">arrow_forward</span>
                   </a>`
                : '<p class="font-body-sm text-body-sm text-on-surface-variant mt-5">Client messaging is not available from this screen yet.</p>'}
        </section>`;
}

function renderActivity() {
    const events = workspace.deliverables.flatMap((item) => {
        const entries = [];
        if (item.submitted_at) {
            entries.push({
                label: `${item.title} submitted`,
                detail: item.submission_note || "Submitted for review.",
                date: item.submitted_at,
            });
        }
        if (item.completed_at) {
            entries.push({
                label: `${item.title} approved`,
                detail: "The deliverable was reviewed and approved.",
                date: item.completed_at,
            });
        }
        return entries;
    }).sort((first, second) => new Date(second.date) - new Date(first.date));

    canvas.innerHTML = `
        <section class="lg:col-span-12 bg-surface-container-lowest border border-border-subtle rounded-xl p-stack-lg shadow-sm">
            <p class="font-label-sm text-label-sm text-primary uppercase tracking-widest">History</p>
            <h2 class="font-headline-sm text-headline-sm text-on-background mt-2">Activity Log</h2>
            <div class="flex flex-col gap-5 mt-6">
                ${events.length
                    ? events.map((item) => `
                        <article class="flex gap-4">
                            <span class="w-3 h-3 rounded-full bg-primary-container mt-1 shrink-0"></span>
                            <div>
                                <h3 class="font-label-md text-label-md text-on-background">${escapeHtml(item.label)}</h3>
                                <p class="font-body-sm text-body-sm text-on-surface-variant mt-1">${escapeHtml(item.detail)}</p>
                                <p class="font-label-sm text-label-sm text-on-surface-variant mt-1">${formatTimestamp(item.date)}</p>
                            </div>
                        </article>`).join("")
                    : '<p class="p-8 rounded-lg bg-surface-container-low text-center text-on-surface-variant">No deliverable activity has been recorded yet.</p>'}
            </div>
        </section>`;
}

function renderWorkspace() {
    if (!workspace.quest) {
        title.textContent = "No Active Quests";
        counterpart.textContent = role === "client"
            ? "Assign a freelancer to an open quest to start a workspace."
            : "An accepted application will appear here.";
        statusBadge.textContent = "No Assignment";
        deadline.textContent = "";
        actions.innerHTML = "";
        canvas.innerHTML = `
            <section class="lg:col-span-12 bg-surface-container-lowest border border-border-subtle rounded-xl p-stack-lg text-center text-on-surface-variant">
                There are no active quest assignments for this account.
            </section>`;
        return;
    }

    const approved = workspace.deliverables.filter((item) => item.submission_status === "approved").length;
    const percent = workspace.deliverables.length
        ? Math.round((approved / workspace.deliverables.length) * 100)
        : 100;
    syncTabs();
    title.textContent = workspace.quest.title;
    counterpart.innerHTML = `<span class="material-symbols-outlined text-[18px]">${role === "client" ? "person" : "business"}</span>
        ${escapeHtml(role === "client" ? workspace.quest.student_name : workspace.quest.client_name)}`;
    statusBadge.innerHTML = `<span class="w-2 h-2 rounded-full bg-status-info"></span>${escapeHtml(labelStatus(workspace.quest.status))}`;
    deadline.innerHTML = `<span class="material-symbols-outlined text-[16px]">event</span> Due: ${escapeHtml(formatDate(workspace.quest.deadline))}`;

    const allApproved = workspace.deliverables.every((item) => item.submission_status === "approved");
    actions.innerHTML = `
        <select aria-label="Select active quest" class="px-3 py-2 border border-border-subtle rounded bg-surface font-label-md text-label-md" data-workspace-select>
            ${workspace.quests.map((quest) => `<option value="${quest.id}" ${quest.id === workspace.quest.id ? "selected" : ""}>
                ${escapeHtml(quest.title)}
            </option>`).join("")}
        </select>
        ${role === "client" && workspace.quest.status !== "completed"
            ? `<button class="font-label-md text-label-md px-4 py-2 rounded ${allApproved ? "bg-primary-container text-white" : "bg-surface-container-high text-on-surface-variant opacity-60"}"
                    data-complete-quest type="button" ${allApproved ? "" : "disabled"}>Complete Quest</button>`
            : ""}`;

    if (activeTab === "overview") {
        renderOverview(approved, percent);
        return;
    }
    if (activeTab === "files") {
        renderFiles();
        return;
    }
    if (activeTab === "messages") {
        renderMessages();
        return;
    }
    if (activeTab === "activity") {
        renderActivity();
        return;
    }

    canvas.innerHTML = `
        <section class="lg:col-span-8 bg-surface-container-lowest border border-border-subtle rounded-xl p-stack-lg shadow-sm">
            <div class="flex items-center justify-between gap-4 mb-6">
                <div>
                    <h2 class="font-headline-sm text-headline-sm text-on-background">Deliverables Checklist</h2>
                    <p class="font-body-sm text-body-sm text-on-surface-variant">The agreed scope is locked for this assignment.</p>
                </div>
                <div class="text-right">
                    <span class="font-label-sm text-label-sm text-on-surface-variant">${approved}/${workspace.deliverables.length} Approved</span>
                    <div class="w-32 bg-surface-container-high rounded-full h-2 overflow-hidden mt-2">
                        <div class="bg-primary-container h-full rounded-full" style="width: ${percent}%"></div>
                    </div>
                </div>
            </div>
            <div class="flex flex-col gap-3">
                ${workspace.deliverables.length
                    ? workspace.deliverables.map(renderDeliverable).join("")
                    : '<p class="text-on-surface-variant">No deliverables were defined for this quest.</p>'}
            </div>
            <p aria-live="polite" class="mt-4 min-h-6 font-body-sm text-body-sm text-on-surface-variant" data-workspace-message></p>
        </section>
        <aside class="lg:col-span-4 flex flex-col gap-gutter">
            <section class="bg-surface-container-lowest border border-border-subtle rounded-xl p-stack-lg">
                <h2 class="font-headline-sm text-headline-sm text-on-background mb-3">Quest Details</h2>
                <p class="font-body-sm text-body-sm text-on-surface-variant whitespace-pre-line">${escapeHtml(workspace.quest.description)}</p>
                <dl class="mt-4 grid gap-3 font-body-sm text-body-sm">
                    <div><dt class="text-on-surface-variant">Arrangement</dt><dd class="text-on-background capitalize">${escapeHtml(workspace.quest.work_arrangement)}</dd></div>
                    <div><dt class="text-on-surface-variant">Status</dt><dd class="text-on-background">${escapeHtml(labelStatus(workspace.quest.status))}</dd></div>
                </dl>
            </section>
            ${renderReviewPanel()}
            <div class="p-4 bg-surface-container-low rounded-xl border border-border-subtle">
                <p class="text-label-sm text-on-surface-variant">Payment arrangements are completed externally. SideQuest does not process or hold funds.</p>
            </div>
        </aside>`;
}

async function loadWorkspace(questId) {
    canvas.innerHTML = '<section class="lg:col-span-12 p-stack-lg text-center text-on-surface-variant">Loading workspace...</section>';
    const query = questId ? `?questId=${encodeURIComponent(questId)}` : "";
    try {
        const response = await fetch(`/api/v1/workspace${query}`, {
            credentials: "include",
            headers: { Accept: "application/json" },
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error?.message || "Workspace could not be loaded.");
        workspace = result;
        if (workspace.quest) {
            window.history.replaceState(null, "", `${window.location.pathname}?questId=${workspace.quest.id}`);
        }
        renderWorkspace();
    } catch (error) {
        canvas.innerHTML = `<section class="lg:col-span-12 p-stack-lg text-center text-error">${escapeHtml(error.message)}</section>`;
    }
}

async function requestUpdate(path, options) {
    const response = await fetch(path, {
        ...options,
        credentials: "include",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error?.message || "The workspace could not be updated.");
    await loadWorkspace(workspace.quest.id);
}

document.addEventListener("change", (event) => {
    const select = event.target.closest("[data-workspace-select]");
    if (select) loadWorkspace(select.value);
});

document.addEventListener("click", async (event) => {
    const tab = event.target.closest("[data-workspace-tab]");
    if (tab) {
        activeTab = tab.dataset.workspaceTab;
        renderWorkspace();
        return;
    }

    const submit = event.target.closest("[data-submit-deliverable]");
    const review = event.target.closest("[data-review-deliverable]");
    const complete = event.target.closest("[data-complete-quest]");
    const submitReview = event.target.closest("[data-submit-review]");
    if (!submit && !review && !complete && !submitReview) return;

    const message = document.querySelector("[data-workspace-message]");
    event.target.closest("button").disabled = true;
    if (message) message.textContent = "Saving...";
    try {
        if (submit) {
            const note = document.querySelector(`[data-submission-note="${submit.dataset.submitDeliverable}"]`).value;
            await requestUpdate(`/api/v1/workspace/deliverables/${submit.dataset.submitDeliverable}/submit`, {
                method: "PATCH",
                body: JSON.stringify({ note }),
            });
        } else if (review) {
            await requestUpdate(`/api/v1/workspace/deliverables/${review.dataset.reviewDeliverable}/review`, {
                method: "PATCH",
                body: JSON.stringify({ decision: review.dataset.decision }),
            });
        } else if (complete && globalThis.confirm("Complete this quest? This locks the deliverables.")) {
            await requestUpdate(`/api/v1/workspace/quests/${workspace.quest.id}/complete`, {
                method: "POST",
                body: "{}",
            });
        } else if (submitReview) {
            const rating = Number(document.querySelector("[data-review-rating]").value);
            const comment = document.querySelector("[data-review-comment]").value;
            await requestUpdate(`/api/v1/workspace/quests/${workspace.quest.id}/reviews`, {
                method: "POST",
                body: JSON.stringify({ rating, comment }),
            });
        } else {
            event.target.closest("button").disabled = false;
        }
    } catch (error) {
        if (message) message.textContent = error.message;
        event.target.closest("button").disabled = false;
    }
});

loadWorkspace(new URLSearchParams(window.location.search).get("questId"));
