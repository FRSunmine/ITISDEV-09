const drawer = document.getElementById("detailDrawer");
const modal = document.getElementById("selectionModal");
const tableBody = document.querySelector("[data-applicants-body]");
const questSelect = document.querySelector("[data-quest-select]");
const questCode = document.querySelector("[data-quest-code]");
const questSummary = document.querySelector("[data-quest-summary]");

let matrix = { quests: [], quest: null, applications: [] };
let selectedApplicationId = null;

function escapeHtml(value) {
    const element = document.createElement("div");
    element.textContent = value ?? "";
    return element.innerHTML;
}

function formatCurrency(cents) {
    if (cents == null) return "Not specified";
    return new Intl.NumberFormat("en-PH", {
        style: "currency",
        currency: "PHP",
        maximumFractionDigits: 0,
    }).format(cents / 100);
}

function formatDate(value) {
    const normalized = String(value).includes(" ") ? String(value).replace(" ", "T") : value;
    return new Intl.DateTimeFormat("en-PH", { dateStyle: "medium" }).format(new Date(normalized));
}

function initials(name) {
    return String(name)
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part[0])
        .join("")
        .toUpperCase();
}

function statusBadge(application) {
    const labels = {
        accepted: "Accepted",
        rejected: "Rejected",
        withdrawn: "Withdrawn",
    };
    if (labels[application.status]) {
        return `<span class="inline-flex px-2 py-1 rounded bg-surface-container-high text-on-surface-variant font-label-sm text-label-sm">
            ${labels[application.status]}
        </span>`;
    }
    const verified = application.verification_status === "verified";
    return `<span class="inline-flex items-center gap-1 px-2 py-1 rounded ${verified ? "bg-status-success/10 text-status-success" : "bg-status-pending/10 text-status-pending"} font-label-sm text-label-sm">
        <span class="material-symbols-outlined text-[14px]">${verified ? "verified" : "pending"}</span>
        ${verified ? "ID Verified" : "Pending"}
    </span>`;
}

function renderTable() {
    if (!matrix.applications.length) {
        tableBody.innerHTML = `<tr><td class="p-stack-lg text-center text-on-surface-variant" colspan="7">
            No applications have been submitted for this quest yet.
        </td></tr>`;
        renderDrawer(null);
        return;
    }

    tableBody.innerHTML = matrix.applications.map((application) => `
        <tr class="border-b border-border-subtle hover:bg-surface transition-colors cursor-pointer ${application.id === selectedApplicationId ? "bg-secondary-fixed/30" : ""}"
            data-application-id="${application.id}">
            <td class="p-stack-md">
                <div class="flex items-center gap-stack-md">
                    <div class="w-10 h-10 rounded-full bg-surface-container-high shrink-0 flex items-center justify-center font-bold text-on-surface-variant">
                        ${escapeHtml(initials(application.student_name))}
                    </div>
                    <div>
                        <div class="font-medium text-on-background">${escapeHtml(application.student_name)}</div>
                        <div class="text-on-surface-variant text-[12px]">${escapeHtml(application.course || application.university || "Student freelancer")}</div>
                    </div>
                </div>
            </td>
            <td class="p-stack-md">${statusBadge(application)}</td>
            <td class="p-stack-md">
                <div class="flex items-center gap-2">
                    <span class="font-semibold text-primary">${application.criteria_coverage}%</span>
                    <div class="w-16 h-1.5 bg-surface-container-highest rounded-full overflow-hidden">
                        <div class="h-full bg-primary" style="width: ${application.criteria_coverage}%"></div>
                    </div>
                </div>
            </td>
            <td class="p-stack-md">
                <div class="flex items-center gap-1">
                    <span class="material-symbols-outlined text-status-pending text-[16px]">star</span>
                    <span class="font-medium text-on-background">${application.rating ?? "New"}</span>
                </div>
            </td>
            <td class="p-stack-md text-on-surface-variant">${application.completed_quests} Quests</td>
            <td class="p-stack-md text-primary">
                <span class="material-symbols-outlined text-[18px]">person</span>
            </td>
            <td class="p-stack-md text-right">
                <button class="px-3 py-1.5 border border-primary text-primary rounded font-label-sm text-label-sm hover:bg-surface-container-low transition-colors"
                    data-review-application="${application.id}" type="button">Review</button>
            </td>
        </tr>
    `).join("");
}

function renderDrawer(application) {
    if (!application) {
        drawer.innerHTML = `<div class="p-stack-lg text-center text-on-surface-variant">
            Select an applicant to review their proposal.
        </div>`;
        return;
    }
    const skills = application.skills.length
        ? application.skills.map((skill) => `<span class="px-2 py-1 bg-surface-container border border-border-subtle rounded font-label-sm text-label-sm">${escapeHtml(skill)}</span>`).join("")
        : '<span class="text-on-surface-variant">No skills listed yet.</span>';
    const portfolio = application.portfolio.length
        ? application.portfolio.map((entry) => `
            <article class="p-3 border border-border-subtle rounded-lg bg-surface-container-low">
                <div class="flex items-start justify-between gap-3">
                    <div>
                        <h5 class="font-label-md text-label-md font-semibold text-on-background">${escapeHtml(entry.title)}</h5>
                        <p class="font-label-sm text-label-sm text-on-surface-variant mt-1">${escapeHtml(entry.category)}</p>
                    </div>
                    <span class="shrink-0 font-label-sm text-label-sm text-primary">${entry.client_rating ? `${entry.client_rating}/5` : "Not rated"}</span>
                </div>
                <p class="text-on-surface-variant mt-2">${escapeHtml(entry.summary || "Verified SideQuest completion.")}</p>
                <p class="font-label-sm text-label-sm text-outline mt-2">Completed ${escapeHtml(formatDate(entry.completed_at))}</p>
            </article>`).join("")
        : '<p class="p-3 border border-dashed border-border-subtle rounded-lg text-on-surface-variant">No completed SideQuest projects yet.</p>';
    const decisionActions = application.status === "pending" && matrix.quest.status === "open"
        ? `<button class="flex-1 py-2 border border-border-subtle rounded font-label-md text-label-md text-on-surface-variant hover:bg-surface transition-colors"
                data-reject-application="${application.id}" type="button">Reject</button>
           <button class="flex-1 py-2 bg-primary-container text-white rounded font-label-md text-label-md hover:opacity-90 transition-opacity"
                data-open-assignment="${application.id}" type="button">Select Freelancer</button>`
        : `<div class="w-full py-2 text-center font-label-md text-label-md text-on-surface-variant">
                Application status: ${escapeHtml(application.status)}
           </div>`;

    drawer.innerHTML = `
        <div class="p-stack-lg border-b border-border-subtle flex justify-between items-start bg-surface-bright sticky top-0 z-10">
            <div class="flex items-center gap-stack-md">
                <div class="w-14 h-14 rounded-full bg-surface-container-high flex items-center justify-center font-bold text-primary">
                    ${escapeHtml(initials(application.student_name))}
                </div>
                <div>
                    <h3 class="font-headline-sm text-headline-sm text-on-background">${escapeHtml(application.student_name)}</h3>
                    <p class="font-body-sm text-body-sm text-on-surface-variant">${escapeHtml(application.course || "Student freelancer")}</p>
                </div>
            </div>
        </div>
        <div class="p-stack-lg flex-1 flex flex-col gap-stack-lg font-body-sm text-body-sm">
            <div class="grid grid-cols-2 gap-3">
                <div class="bg-surface-container-low p-3 rounded">
                    <div class="font-headline-sm text-headline-sm text-primary">${application.criteria_coverage}%</div>
                    <div class="font-label-sm text-label-sm text-on-surface-variant uppercase">Skill Coverage</div>
                </div>
                <div class="bg-surface-container-low p-3 rounded">
                    <div class="font-headline-sm text-headline-sm text-primary">${formatCurrency(application.proposed_rate_cents)}</div>
                    <div class="font-label-sm text-label-sm text-on-surface-variant uppercase">Proposed Rate</div>
                </div>
            </div>
            <section>
                <h4 class="font-label-md text-label-md text-on-background mb-2">Application Message</h4>
                <p class="p-3 border border-border-subtle rounded text-on-surface-variant whitespace-pre-line">${escapeHtml(application.cover_letter)}</p>
            </section>
            <section>
                <h4 class="font-label-md text-label-md text-on-background mb-2">Skills</h4>
                <div class="flex flex-wrap gap-2">${skills}</div>
            </section>
            <section>
                <h4 class="font-label-md text-label-md text-on-background mb-2">Profile</h4>
                <p class="text-on-surface-variant">${escapeHtml(application.bio || "This student has not added a profile summary yet.")}</p>
            </section>
            <section>
                <div class="flex items-center justify-between gap-3 mb-2">
                    <h4 class="font-label-md text-label-md text-on-background">Verified Portfolio</h4>
                    <span class="font-label-sm text-label-sm text-on-surface-variant">${application.portfolio.length} completed</span>
                </div>
                <div class="grid gap-3">${portfolio}</div>
            </section>
        </div>
        <div class="p-stack-lg border-t border-border-subtle bg-surface-bright sticky bottom-0 flex gap-3">
            ${decisionActions}
        </div>`;
}

function renderModal(application) {
    const deliverables = matrix.quest.deliverables.length
        ? matrix.quest.deliverables.map((item) => `
            <li class="flex gap-3">
                <span class="material-symbols-outlined text-primary text-[20px]">check_circle</span>
                <span>${escapeHtml(item.title)}</span>
            </li>`).join("")
        : "<li>No deliverables listed.</li>";
    modal.innerHTML = `
        <div class="absolute inset-0 bg-on-background/40 backdrop-blur-sm" data-close-assignment></div>
        <div class="relative bg-surface-container-lowest w-full max-w-2xl rounded-xl shadow-xl border border-border-subtle overflow-hidden mx-4">
            <div class="p-stack-lg border-b border-border-subtle flex justify-between items-center">
                <h2 class="font-headline-sm text-headline-sm text-on-background">Confirm Assignment</h2>
                <button aria-label="Close confirmation" class="p-1 text-on-surface-variant" data-close-assignment type="button">
                    <span class="material-symbols-outlined">close</span>
                </button>
            </div>
            <div class="p-stack-lg text-on-surface-variant">
                <p class="mb-4">Assign <strong class="text-on-background">${escapeHtml(application.student_name)}</strong>
                    to <strong class="text-on-background">${escapeHtml(matrix.quest.title)}</strong>?</p>
                <div class="bg-surface-container-low border border-border-subtle rounded-lg p-4">
                    <h3 class="font-label-md text-label-md text-on-background mb-3">Locked Deliverables</h3>
                    <ul class="space-y-3 font-body-sm text-body-sm">${deliverables}</ul>
                </div>
                <p class="mt-4 font-body-sm text-body-sm">Other pending applications will be rejected and the quest will move to active work.</p>
                <p class="mt-2 font-body-sm text-body-sm">Payment arrangements remain external to SideQuest.</p>
                <p aria-live="polite" class="mt-3 text-error" data-decision-status></p>
            </div>
            <div class="p-stack-lg border-t border-border-subtle bg-surface-bright flex justify-end gap-3">
                <button class="px-6 py-2 border border-border-subtle rounded font-label-md text-label-md" data-close-assignment type="button">Cancel</button>
                <button class="px-6 py-2 bg-primary-container text-white rounded font-label-md text-label-md" data-confirm-assignment="${application.id}" type="button">
                    Confirm &amp; Assign
                </button>
            </div>
        </div>`;
}

function selectApplication(id) {
    selectedApplicationId = Number(id);
    const application = matrix.applications.find((item) => item.id === selectedApplicationId);
    renderTable();
    renderDrawer(application);
}

function renderMatrix() {
    questSelect.innerHTML = matrix.quests.length
        ? matrix.quests.map((quest) => `<option value="${quest.id}" ${quest.id === matrix.quest?.id ? "selected" : ""}>
            ${escapeHtml(quest.title)} (${quest.pending_count} pending)
        </option>`).join("")
        : "<option>No open quests</option>";
    questSelect.disabled = matrix.quests.length === 0;
    questCode.textContent = matrix.quest ? `Q-${String(matrix.quest.id).padStart(4, "0")}` : "No quest";
    questSummary.textContent = matrix.quest
        ? `Review and select a student freelancer for "${matrix.quest.title}".`
        : "Create an open quest to begin receiving applications.";
    selectedApplicationId = matrix.applications[0]?.id ?? null;
    renderTable();
    renderDrawer(matrix.applications[0] ?? null);
}

async function loadMatrix(questId) {
    tableBody.innerHTML = '<tr><td class="p-stack-lg text-center text-on-surface-variant" colspan="7">Loading applications...</td></tr>';
    const query = questId ? `?questId=${encodeURIComponent(questId)}` : "";
    try {
        const response = await fetch(`/api/v1/client/applications${query}`, {
            credentials: "include",
            headers: { Accept: "application/json" },
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error?.message || "Applications could not be loaded.");
        matrix = result;
        if (matrix.quest) {
            window.history.replaceState(null, "", `${window.location.pathname}?questId=${matrix.quest.id}`);
        }
        renderMatrix();
    } catch (error) {
        tableBody.innerHTML = `<tr><td class="p-stack-lg text-center text-error" colspan="7">${escapeHtml(error.message)}</td></tr>`;
    }
}

async function decide(applicationId, decision) {
    const response = await fetch(`/api/v1/client/applications/${applicationId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({ decision }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error?.message || "The decision could not be saved.");
    modal.classList.add("hidden");
    modal.classList.remove("flex");
    await loadMatrix(matrix.quest.id);
}

function exportApplicants() {
    if (!matrix.applications.length) return;
    const rows = [
        ["Applicant", "Course", "Verification", "Coverage", "Rating", "Completed", "Status"],
        ...matrix.applications.map((item) => [
            item.student_name,
            item.course || "",
            item.verification_status,
            `${item.criteria_coverage}%`,
            item.rating ?? "",
            item.completed_quests,
            item.status,
        ]),
    ];
    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `sidequest-applicants-${matrix.quest.id}.csv`;
    link.click();
    URL.revokeObjectURL(url);
}

questSelect.addEventListener("change", () => loadMatrix(questSelect.value));

document.addEventListener("click", async (event) => {
    const review = event.target.closest("[data-review-application], [data-application-id]");
    if (review) {
        selectApplication(review.dataset.reviewApplication || review.dataset.applicationId);
        return;
    }
    const openAssignment = event.target.closest("[data-open-assignment]");
    if (openAssignment) {
        const application = matrix.applications.find((item) => item.id === Number(openAssignment.dataset.openAssignment));
        renderModal(application);
        modal.classList.remove("hidden");
        modal.classList.add("flex");
        return;
    }
    if (event.target.closest("[data-close-assignment]")) {
        modal.classList.add("hidden");
        modal.classList.remove("flex");
        return;
    }
    const reject = event.target.closest("[data-reject-application]");
    if (reject && globalThis.confirm("Reject this application?")) {
        try {
            await decide(reject.dataset.rejectApplication, "rejected");
        } catch (error) {
            globalThis.alert(error.message);
        }
        return;
    }
    const confirm = event.target.closest("[data-confirm-assignment]");
    if (confirm) {
        confirm.disabled = true;
        try {
            await decide(confirm.dataset.confirmAssignment, "accepted");
        } catch (error) {
            const status = modal.querySelector("[data-decision-status]");
            if (status) status.textContent = error.message;
            confirm.disabled = false;
        }
        return;
    }
    if (event.target.closest("[data-export-applicants]")) exportApplicants();
});

const initialQuestId = new URLSearchParams(window.location.search).get("questId");
loadMatrix(initialQuestId);
