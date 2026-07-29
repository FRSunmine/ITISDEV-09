const summary = document.querySelector("[data-application-summary]");
const list = document.querySelector("[data-applications-list]");

function escapeHtml(value) {
    const element = document.createElement("div");
    element.textContent = value ?? "";
    return element.innerHTML;
}

function titleCase(value) {
    return String(value).replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDate(value) {
    const normalized = value.includes(" ") ? value.replace(" ", "T") : `${value}T00:00:00`;
    return new Intl.DateTimeFormat("en-PH", { dateStyle: "medium" }).format(new Date(`${normalized}Z`));
}

function metric(label, value) {
    return `<div class="p-4 rounded-xl border border-border-subtle bg-surface-container-lowest">
        <div class="font-label-sm text-label-sm text-on-surface-variant uppercase">${label}</div>
        <div class="font-headline-md text-headline-md text-primary mt-2">${value}</div>
    </div>`;
}

fetch("/api/v1/applications/me", { credentials: "include", headers: { Accept: "application/json" } })
    .then(async (response) => {
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error?.message || "Applications could not be loaded.");
        return result;
    })
    .then((data) => {
        summary.innerHTML = [
            metric("Pending", data.summary.activeApplications),
            metric("Accepted", data.summary.accepted),
            metric("Active quests", data.summary.activeQuests),
            metric("Completed", data.summary.completed),
        ].join("");
        list.innerHTML = data.applications.length
            ? data.applications.map((application) => `
                <article class="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <div class="flex flex-wrap items-center gap-2">
                            <h2 class="font-headline-sm text-headline-sm text-on-surface">${escapeHtml(application.quest_title)}</h2>
                            <span class="px-2 py-1 rounded-full bg-surface-container-high text-xs">${escapeHtml(titleCase(application.status))}</span>
                        </div>
                        <p class="text-on-surface-variant mt-1">${escapeHtml(application.client_name)}</p>
                        <p class="text-xs text-on-surface-variant mt-2">Applied ${escapeHtml(formatDate(application.created_at))} | Deadline ${escapeHtml(formatDate(application.deadline))}</p>
                    </div>
                    ${application.status === "accepted"
                        ? `<a class="px-4 py-2 rounded-lg bg-primary text-on-primary text-center" href="student-quest-workspace.html?questId=${application.quest_id}">Open workspace</a>`
                        : '<a class="px-4 py-2 rounded-lg border border-border-subtle text-primary text-center" href="quest-marketplace.html">View marketplace</a>'}
                </article>`).join("")
            : '<p class="p-8 text-center text-on-surface-variant">No applications yet.</p>';
    })
    .catch((error) => {
        list.innerHTML = `<p class="p-8 text-center text-error">${escapeHtml(error.message)}</p>`;
    });
