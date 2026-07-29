const root = document.querySelector("[data-client-dashboard]");

function escapeHtml(value) {
    const element = document.createElement("div");
    element.textContent = value ?? "";
    return element.innerHTML;
}

function formatDate(value) {
    return new Intl.DateTimeFormat("en-PH", { dateStyle: "medium" }).format(new Date(`${value}T00:00:00`));
}

function titleCase(value) {
    return String(value).replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function metric(label, value, icon) {
    return `
        <article class="bg-surface-container-lowest p-stack-md rounded-xl border border-border-subtle shadow-sm">
            <div class="flex justify-between items-start mb-2">
                <span class="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">${label}</span>
                <span class="material-symbols-outlined text-primary">${icon}</span>
            </div>
            <div class="font-display-lg text-display-lg text-on-surface">${value}</div>
        </article>`;
}

function questTarget(quest) {
    return quest.status === "open"
        ? `/pages/applicant-selection.html?questId=${quest.id}`
        : `/pages/client-quest-workspace.html?questId=${quest.id}`;
}

function render(data) {
    root.innerHTML = `
        <header class="mb-8 flex flex-col lg:flex-row justify-between lg:items-end gap-4">
            <div>
                <h1 class="font-display-lg text-display-lg text-on-surface">Welcome back, ${escapeHtml(data.client.organization_name)}.</h1>
                <p class="font-body-lg text-body-lg text-on-surface-variant mt-2">Here is the current state of your SideQuest projects.</p>
            </div>
            <div class="flex gap-3">
                <a class="bg-primary-container text-on-primary py-2 px-4 rounded-lg font-label-md text-label-md" href="/pages/create-quest.html">
                    Create Quest
                </a>
                <a class="border border-primary-container text-primary-container py-2 px-4 rounded-lg font-label-md text-label-md" href="/pages/applicant-selection.html">
                    Review Applicants
                </a>
            </div>
        </header>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-gutter mb-8">
            ${metric("Open Quests", data.summary.openQuests, "assignment_ind")}
            ${metric("Total Applicants", data.summary.totalApplicants, "groups")}
            ${metric("Active Projects", data.summary.activeProjects, "rocket_launch")}
            ${metric("Pending Reviews", data.summary.pendingReviews, "rate_review")}
        </div>
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-gutter">
            <section class="lg:col-span-2 bg-surface-container-lowest rounded-xl border border-border-subtle overflow-hidden shadow-sm scroll-mt-24" id="my-quests">
                <div class="p-stack-md border-b border-border-subtle bg-surface-bright">
                    <h2 class="font-headline-sm text-headline-sm text-on-surface">My Quests</h2>
                </div>
                <div class="overflow-x-auto">
                    <table class="w-full text-left">
                        <thead><tr class="border-b border-border-subtle">
                            <th class="p-stack-md text-on-surface-variant">Quest</th>
                            <th class="p-stack-md text-on-surface-variant">Applicants</th>
                            <th class="p-stack-md text-on-surface-variant">Deadline</th>
                            <th class="p-stack-md text-on-surface-variant">Status</th>
                            <th class="p-stack-md text-right text-on-surface-variant">Action</th>
                        </tr></thead>
                        <tbody>${data.quests.length ? data.quests.map((quest) => `
                            <tr class="border-b border-border-subtle">
                                <td class="p-stack-md">
                                    <div class="font-semibold text-primary">${escapeHtml(quest.title)}</div>
                                    <div class="text-on-surface-variant text-xs">${escapeHtml(quest.category)}</div>
                                </td>
                                <td class="p-stack-md">${quest.applicant_count}</td>
                                <td class="p-stack-md text-on-surface-variant">${escapeHtml(formatDate(quest.deadline))}</td>
                                <td class="p-stack-md"><span class="px-2 py-1 rounded-full text-xs bg-surface-container-high">${escapeHtml(titleCase(quest.status))}</span></td>
                                <td class="p-stack-md text-right">
                                    <a class="font-label-md text-label-md text-primary hover:underline" href="${questTarget(quest)}">
                                        ${quest.status === "open" ? "Applicants" : "Workspace"}
                                    </a>
                                </td>
                            </tr>`).join("") : '<tr><td class="p-stack-lg text-center text-on-surface-variant" colspan="5">No quests yet. Create your first quest to get started.</td></tr>'}</tbody>
                    </table>
                </div>
            </section>
            <aside class="bg-surface-container-lowest rounded-xl border border-border-subtle overflow-hidden shadow-sm">
                <div class="p-stack-md border-b border-border-subtle bg-surface-bright flex justify-between">
                    <h2 class="font-headline-sm text-headline-sm text-on-surface">Pending Applicants</h2>
                    <span class="text-status-pending">${data.pendingApplications.length}</span>
                </div>
                <div class="divide-y divide-border-subtle">${data.pendingApplications.length ? data.pendingApplications.map((application) => `
                    <a class="block p-stack-md hover:bg-surface-container-low" href="/pages/applicant-selection.html?questId=${application.quest_id}">
                        <div class="font-semibold text-on-surface">${escapeHtml(application.student_name)}</div>
                        <div class="text-xs text-on-surface-variant mt-1">${escapeHtml(application.quest_title)}</div>
                        <div class="text-xs text-primary mt-2">${escapeHtml(application.verification_status === "verified" ? "Verified student" : "Verification pending")}</div>
                    </a>`).join("") : '<p class="p-stack-lg text-center text-on-surface-variant">No pending applications.</p>'}</div>
            </aside>
        </div>
        <div class="mt-6 p-3 bg-surface-container-low rounded-lg border border-dashed border-border-subtle text-xs text-on-surface-variant">
            Payment arrangements are completed externally. SideQuest does not process or hold funds.
        </div>`;

    if (window.location.hash === "#my-quests") {
        requestAnimationFrame(() => document.querySelector("#my-quests")?.scrollIntoView());
    }
}

root.innerHTML = '<p class="p-stack-lg text-center text-on-surface-variant">Loading dashboard...</p>';
fetch("/api/v1/client/dashboard", { credentials: "include", headers: { Accept: "application/json" } })
    .then(async (response) => {
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error?.message || "Dashboard could not be loaded.");
        return result;
    })
    .then(render)
    .catch((error) => {
        root.innerHTML = `<p class="p-stack-lg text-center text-error">${escapeHtml(error.message)}</p>`;
    });
