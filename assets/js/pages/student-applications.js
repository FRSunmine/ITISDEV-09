const summary = document.querySelector("[data-application-summary]");
const applicationsList = document.querySelector("[data-applications-list]");
const invitationsList = document.querySelector("[data-invitations-list]");

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

async function api(path, options = {}) {
    const response = await fetch(path, {
        credentials: "include",
        headers: { Accept: "application/json", ...(options.body ? { "Content-Type": "application/json" } : {}) },
        ...options,
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error?.message || "Request failed.");
    return result;
}

function renderApplications(data) {
    summary.innerHTML = [
        metric("Pending", data.summary.activeApplications),
        metric("Accepted", data.summary.accepted),
        metric("Active quests", data.summary.activeQuests),
        metric("Completed", data.summary.completed),
    ].join("");
    applicationsList.innerHTML = data.applications.length
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
}

function renderInvitations(data) {
    invitationsList.innerHTML = data.invitations.length
        ? data.invitations.map((invitation) => `
            <article class="p-5">
                <div class="flex flex-col md:flex-row md:items-start justify-between gap-4">
                    <div>
                        <div class="flex flex-wrap items-center gap-2">
                            <h3 class="font-headline-sm text-headline-sm text-on-surface">${escapeHtml(invitation.quest_title)}</h3>
                            <span class="px-2 py-1 rounded-full bg-surface-container-high text-xs">${escapeHtml(titleCase(invitation.status))}</span>
                        </div>
                        <p class="text-on-surface-variant mt-1">${escapeHtml(invitation.organization_name || invitation.client_name)}</p>
                        <p class="mt-3 whitespace-pre-line">${escapeHtml(invitation.message)}</p>
                        <p class="text-xs text-on-surface-variant mt-2">Deadline ${escapeHtml(formatDate(invitation.deadline))}</p>
                    </div>
                    ${invitation.status === "pending" ? `<div class="flex gap-2 shrink-0">
                        <button class="px-4 py-2 rounded-lg border border-border-subtle text-on-surface-variant" data-invitation-decision="declined" data-invitation-id="${invitation.id}" type="button">Decline</button>
                        <button class="px-4 py-2 rounded-lg bg-primary text-on-primary" data-invitation-decision="accepted" data-invitation-id="${invitation.id}" type="button">Accept invitation</button>
                    </div>` : ""}
                </div>
            </article>`).join("")
        : '<p class="p-8 text-center text-on-surface-variant">No quest invitations yet.</p>';
}

async function load() {
    try {
        const [applications, invitations] = await Promise.all([
            api("/api/v1/applications/me"),
            api("/api/v1/invitations/me"),
        ]);
        renderApplications(applications);
        renderInvitations(invitations);
    } catch (error) {
        applicationsList.innerHTML = `<p class="p-8 text-center text-error">${escapeHtml(error.message)}</p>`;
        invitationsList.innerHTML = "";
    }
}

invitationsList.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-invitation-decision]");
    if (!button) return;
    button.disabled = true;
    try {
        await api(`/api/v1/invitations/${button.dataset.invitationId}`, {
            method: "PATCH",
            body: JSON.stringify({ decision: button.dataset.invitationDecision }),
        });
        await load();
    } catch (error) {
        button.disabled = false;
        globalThis.alert(error.message);
    }
});

load();
