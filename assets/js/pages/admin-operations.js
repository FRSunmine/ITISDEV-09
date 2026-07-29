const root = document.querySelector("[data-admin-operations]");
const search = document.querySelector("[data-admin-search]");
let operations = null;

function escapeHtml(value) {
    const element = document.createElement("div");
    element.textContent = value ?? "";
    return element.innerHTML;
}

function formatDate(value) {
    return new Intl.DateTimeFormat("en-PH", { dateStyle: "medium" }).format(new Date(value));
}

function metric(label, value, icon) {
    return `
        <article class="bg-surface-container-lowest border border-border-subtle rounded-xl p-stack-lg shadow-sm">
            <div class="flex justify-between items-start mb-4">
                <span class="font-label-sm text-label-sm text-secondary uppercase tracking-wider">${label}</span>
                <span class="material-symbols-outlined text-primary-container">${icon}</span>
            </div>
            <div class="font-display-lg text-display-lg text-primary">${value}</div>
        </article>`;
}

function renderUsers(query = "") {
    const table = root.querySelector("[data-admin-users]");
    if (!table || !operations) return;
    const normalized = query.trim().toLowerCase();
    const users = operations.users.filter((user) =>
        `${user.display_name} ${user.email} ${user.role}`.toLowerCase().includes(normalized));
    table.innerHTML = users.length
        ? users.map((user) => `
            <tr class="border-b border-border-subtle">
                <td class="p-stack-md">
                    <div class="font-medium text-primary">${escapeHtml(user.display_name)}</div>
                    <div class="text-secondary text-xs">${escapeHtml(user.email)}</div>
                </td>
                <td class="p-stack-md text-secondary capitalize">${escapeHtml(user.role)}</td>
                <td class="p-stack-md">
                    <span class="px-2 py-1 rounded bg-surface-container-high text-on-surface-variant">${escapeHtml(user.account_status)}</span>
                </td>
                <td class="p-stack-md text-right">
                    <button class="px-3 py-1.5 rounded border border-border-subtle text-primary"
                        data-user-status="${user.id}" data-next-status="${user.account_status === "suspended" ? "active" : "suspended"}" type="button">
                        ${user.account_status === "suspended" ? "Restore" : "Suspend"}
                    </button>
                </td>
            </tr>`).join("")
        : '<tr><td class="p-stack-lg text-center text-secondary" colspan="4">No users match this search.</td></tr>';
}

function renderSkills(query = "") {
    const table = root.querySelector("[data-admin-skills]");
    if (!table || !operations) return;
    const normalized = query.trim().toLowerCase();
    const skills = operations.skillGaps.filter((item) => item.name.toLowerCase().includes(normalized));
    table.innerHTML = skills.length
        ? skills.map((item) => `
            <tr class="border-b border-border-subtle">
                <td class="p-stack-md text-primary">${escapeHtml(item.name)}</td>
                <td class="p-stack-md text-right">${item.supply}</td>
                <td class="p-stack-md text-right">${item.demand}</td>
                <td class="p-stack-md text-right ${item.gap < 0 ? "text-error" : "text-status-success"}">${item.gap > 0 ? "+" : ""}${item.gap}</td>
            </tr>`).join("")
        : '<tr><td class="p-stack-lg text-center text-secondary" colspan="4">No active skills match this search.</td></tr>';
}

function syncSectionNavigation() {
    const activeSection = window.location.hash.slice(1) || "dashboard";
    document.querySelectorAll("[data-admin-section]").forEach((link) => {
        const isActive = link.dataset.adminSection === activeSection;
        link.classList.toggle("is-active", isActive);
        if (isActive) link.setAttribute("aria-current", "location");
        else link.removeAttribute("aria-current");
    });
}

function render() {
    const { summary, pendingStudents } = operations;
    root.innerHTML = `
        <header class="mb-8">
            <h1 class="font-display-lg text-display-lg text-primary">Operations Overview</h1>
            <p class="font-body-lg text-body-lg text-secondary mt-2">Live platform metrics and administrative tasks.</p>
        </header>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-gutter mb-gutter">
            ${metric("Verified Students", summary.verifiedStudents, "school")}
            ${metric("Open Quests", summary.openQuests, "work_outline")}
            ${metric("Completion Rate", `${summary.completionRate}%`, "done_all")}
            ${metric("Pending Verifications", summary.pendingVerifications, "pending_actions")}
        </div>
        <p class="min-h-6 text-secondary" aria-live="polite" data-admin-message></p>
        <div class="grid grid-cols-1 xl:grid-cols-2 gap-gutter">
            <section class="bg-surface-container-lowest border border-border-subtle rounded-xl overflow-hidden scroll-mt-24" id="verification-queue">
                <div class="p-stack-md border-b border-border-subtle bg-surface-container-low">
                    <h2 class="font-headline-sm text-headline-sm text-primary">Verification Queue</h2>
                </div>
                <div class="overflow-x-auto">
                    <table class="w-full text-left">
                        <thead><tr class="border-b border-border-subtle">
                            <th class="p-stack-md text-secondary">Student</th>
                            <th class="p-stack-md text-secondary">Institution</th>
                            <th class="p-stack-md text-secondary text-right">Decision</th>
                        </tr></thead>
                        <tbody>${pendingStudents.length ? pendingStudents.map((student) => `
                            <tr class="border-b border-border-subtle">
                                <td class="p-stack-md">
                                    <div class="font-medium text-primary">${escapeHtml(student.display_name)}</div>
                                    <div class="text-secondary text-xs">${escapeHtml(formatDate(student.created_at))}</div>
                                </td>
                                <td class="p-stack-md text-secondary">${escapeHtml(student.university)}${student.course ? ` - ${escapeHtml(student.course)}` : ""}</td>
                                <td class="p-stack-md text-right whitespace-nowrap">
                                    <button class="px-3 py-1.5 rounded border border-border-subtle text-error" data-verify-student="${student.id}" data-decision="rejected" type="button">Reject</button>
                                    <button class="px-3 py-1.5 rounded bg-primary-container text-on-primary" data-verify-student="${student.id}" data-decision="verified" type="button">Verify</button>
                                </td>
                            </tr>`).join("") : '<tr><td class="p-stack-lg text-center text-secondary" colspan="3">Verification queue is clear.</td></tr>'}</tbody>
                    </table>
                </div>
            </section>
            <section class="bg-surface-container-lowest border border-border-subtle rounded-xl overflow-hidden">
                <div class="p-stack-md border-b border-border-subtle bg-surface-container-low flex flex-wrap items-center justify-between gap-3">
                    <h2 class="font-headline-sm text-headline-sm text-primary">Skill Supply and Demand</h2>
                    <label class="relative">
                        <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-secondary">search</span>
                        <input class="w-56 rounded-lg border border-border-subtle bg-surface pl-9 pr-3 py-2 text-sm" data-skill-search placeholder="Search skills" type="search">
                    </label>
                </div>
                <table class="w-full text-left">
                    <thead><tr class="border-b border-border-subtle">
                        <th class="p-stack-md text-secondary">Skill</th><th class="p-stack-md text-right text-secondary">Supply</th>
                        <th class="p-stack-md text-right text-secondary">Demand</th><th class="p-stack-md text-right text-secondary">Gap</th>
                    </tr></thead>
                    <tbody data-admin-skills></tbody>
                </table>
            </section>
        </div>
        <section class="mt-gutter bg-surface-container-lowest border border-border-subtle rounded-xl overflow-hidden scroll-mt-24" id="reports">
            <div class="p-stack-md border-b border-border-subtle bg-surface-container-low">
                <h2 class="font-headline-sm text-headline-sm text-primary">User Reports</h2>
                <p class="text-sm text-secondary mt-1">Issues submitted by students and clients.</p>
            </div>
            <div class="divide-y divide-border-subtle">
                ${operations.reports.length ? operations.reports.map((report) => `
                    <article class="p-stack-md">
                        <div class="flex flex-wrap items-start justify-between gap-3">
                            <div><h3 class="font-semibold text-primary">${escapeHtml(report.subject)}</h3>
                                <p class="text-xs text-secondary mt-1">${escapeHtml(report.reporter_name)} (${escapeHtml(report.reporter_role)}) · ${escapeHtml(formatDate(report.created_at))}</p>
                            </div>
                            <span class="px-2 py-1 rounded-full bg-surface-container-high text-xs capitalize">${escapeHtml(report.status)}</span>
                        </div>
                        <p class="mt-3 text-sm text-on-surface-variant whitespace-pre-line">${escapeHtml(report.description)}</p>
                        <p class="mt-2 text-xs uppercase tracking-wider text-secondary">${escapeHtml(report.category.replaceAll("_", " "))}</p>
                        ${report.status === "open" ? `
                            <div class="mt-4 flex flex-col md:flex-row gap-2">
                                <input class="flex-1 rounded-lg border border-border-subtle bg-surface px-3 py-2 text-sm" data-report-notes="${report.id}" maxlength="1000" placeholder="Optional administrative note">
                                <button class="px-3 py-2 rounded border border-border-subtle text-secondary" data-report-action="${report.id}" data-report-status="dismissed" type="button">Dismiss</button>
                                <button class="px-3 py-2 rounded bg-primary text-on-primary" data-report-action="${report.id}" data-report-status="resolved" type="button">Resolve</button>
                            </div>` : report.admin_notes ? `<p class="mt-3 text-sm text-secondary"><strong>Admin note:</strong> ${escapeHtml(report.admin_notes)}</p>` : ""}
                    </article>`).join("") : '<p class="p-stack-lg text-center text-secondary">No reports have been submitted.</p>'}
            </div>
        </section>
        <section class="mt-gutter bg-surface-container-lowest border border-border-subtle rounded-xl overflow-hidden scroll-mt-24" id="users">
            <div class="p-stack-md border-b border-border-subtle bg-surface-container-low">
                <h2 class="font-headline-sm text-headline-sm text-primary">Account Management</h2>
            </div>
            <div class="overflow-x-auto"><table class="w-full text-left">
                <thead><tr class="border-b border-border-subtle">
                    <th class="p-stack-md text-secondary">User</th><th class="p-stack-md text-secondary">Role</th>
                    <th class="p-stack-md text-secondary">Status</th><th class="p-stack-md text-secondary text-right">Action</th>
                </tr></thead>
                <tbody data-admin-users></tbody>
            </table></div>
        </section>`;
    renderUsers(search?.value);
    renderSkills();
    syncSectionNavigation();
    if (window.location.hash) {
        requestAnimationFrame(() => document.querySelector(window.location.hash)?.scrollIntoView());
    }
}

async function loadOperations(message = "") {
    root.innerHTML = '<p class="p-stack-lg text-center text-secondary">Loading operations...</p>';
    try {
        const response = await fetch("/api/v1/admin/operations", { credentials: "include", headers: { Accept: "application/json" } });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error?.message || "Operations could not be loaded.");
        operations = result;
        render();
        const target = root.querySelector("[data-admin-message]");
        if (target) target.textContent = message;
    } catch (error) {
        root.innerHTML = `<p class="p-stack-lg text-center text-error">${escapeHtml(error.message)}</p>`;
    }
}

async function update(path, body, successMessage) {
    const response = await fetch(path, {
        method: "PATCH",
        credentials: "include",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error?.message || "Administrative action failed.");
    await loadOperations(successMessage);
}

search?.addEventListener("input", () => renderUsers(search.value));
window.addEventListener("hashchange", syncSectionNavigation);
syncSectionNavigation();
root.addEventListener("input", (event) => {
    if (event.target.matches("[data-skill-search]")) renderSkills(event.target.value);
});
document.addEventListener("click", async (event) => {
    const verification = event.target.closest("[data-verify-student]");
    const userStatus = event.target.closest("[data-user-status]");
    const reportAction = event.target.closest("[data-report-action]");
    if (!verification && !userStatus && !reportAction) return;
    event.target.disabled = true;
    try {
        if (verification) {
            await update(`/api/v1/admin/students/${verification.dataset.verifyStudent}/verification`,
                { decision: verification.dataset.decision }, "Verification decision saved.");
        } else if (userStatus) {
            await update(`/api/v1/admin/users/${userStatus.dataset.userStatus}/status`,
                { status: userStatus.dataset.nextStatus }, "Account status updated.");
        } else {
            const notes = document.querySelector(`[data-report-notes="${reportAction.dataset.reportAction}"]`);
            await update(`/api/v1/admin/reports/${reportAction.dataset.reportAction}`,
                { status: reportAction.dataset.reportStatus, adminNotes: notes?.value || "" }, "Report updated.");
        }
    } catch (error) {
        globalThis.alert(error.message);
        event.target.disabled = false;
    }
});

loadOperations();
