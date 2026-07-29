import { apiClient } from "../services/api-client.js";

const applicationList = document.querySelector("[data-application-list]");
const dashboardStatus = document.querySelector("[data-dashboard-status]");
const deadlines = document.querySelector("[data-dashboard-deadlines]");

function escapeHtml(value = "") {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function formatDate(value) {
    const date = new Date(value.endsWith("Z") ? value : `${value.replace(" ", "T")}Z`);
    return Number.isNaN(date.getTime())
        ? value
        : new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric", year: "numeric" }).format(date);
}

function statusBadge(status) {
    const styles = {
        accepted: "bg-status-success/10 text-status-success",
        pending: "bg-status-pending/10 text-status-pending",
        rejected: "bg-error/10 text-error",
        withdrawn: "bg-surface-container-high text-on-surface-variant",
    };
    const label = status[0].toUpperCase() + status.slice(1);
    return `<span class="inline-block px-2 py-1 rounded ${styles[status] || styles.withdrawn} font-label-sm text-label-sm">${label}</span>`;
}

function setMetric(name, value) {
    const target = document.querySelector(`[data-dashboard-metric="${name}"]`);
    if (target) target.textContent = value;
}

function renderSummary(summary) {
    setMetric("activeApplications", summary.activeApplications);
    setMetric("accepted", summary.accepted);
    setMetric("activeQuests", summary.activeQuests);
    setMetric("completed", summary.completed);
    setMetric("rating", summary.rating ?? "—");
    const projects = document.querySelector("[data-dashboard-profile-projects]");
    const progress = document.querySelector("[data-dashboard-profile-progress]");
    if (projects) projects.textContent = `${summary.completed} completed`;
    if (progress) progress.style.width = `${Math.min(Number(summary.completed) * 20, 100)}%`;
}

function renderApplications(applications) {
    if (!applications.length) {
        applicationList.innerHTML = `
            <tr>
                <td class="p-stack-lg text-center text-on-surface-variant" colspan="4">
                    No applications yet. Browse the marketplace to find your first quest.
                </td>
            </tr>
        `;
        dashboardStatus.textContent = "No applications";
        return;
    }

    applicationList.innerHTML = applications.map((application) => `
        <tr class="border-b border-border-subtle hover:bg-surface-bright transition-colors">
            <td class="p-stack-md font-medium text-primary">${escapeHtml(application.quest_title)}</td>
            <td class="p-stack-md text-on-surface-variant">${escapeHtml(application.client_name)}</td>
            <td class="p-stack-md text-on-surface-variant">${formatDate(application.created_at)}</td>
            <td class="p-stack-md text-right">${statusBadge(application.status)}</td>
        </tr>
    `).join("");
    dashboardStatus.textContent = `${applications.length} application${applications.length === 1 ? "" : "s"}`;
}

function renderDeadlines(applications) {
    const active = applications.filter((application) =>
        application.status === "accepted"
        && ["in_progress", "submitted"].includes(application.quest_status),
    );
    deadlines.classList.toggle("before:hidden", active.length === 0);
    deadlines.innerHTML = active.length
        ? active.map((application) => `
            <a class="relative pl-8 block group" href="student-quest-workspace.html?questId=${application.quest_id}">
                <span class="absolute left-0 top-1 w-6 h-6 rounded-full bg-surface-container-lowest border-2 border-status-pending flex items-center justify-center z-10">
                    <span class="w-2 h-2 rounded-full bg-status-pending"></span>
                </span>
                <strong class="font-label-md text-label-md text-primary group-hover:underline">${escapeHtml(application.quest_title)}</strong>
                <span class="block font-body-sm text-body-sm text-on-surface-variant mt-1">${escapeHtml(application.client_name)}</span>
                <span class="block font-label-sm text-label-sm text-status-pending mt-1">Due ${escapeHtml(formatDate(application.deadline))}</span>
            </a>`).join("")
        : '<p class="text-on-surface-variant">No upcoming deadlines. Accepted quests will appear here.</p>';
}

async function loadDashboard() {
    applicationList.innerHTML = `
        <tr><td class="p-stack-lg text-center text-on-surface-variant" colspan="4">Loading applications...</td></tr>
    `;
    try {
        const response = await apiClient.get("/applications/me");
        renderSummary(response.summary);
        renderApplications(response.applications);
        renderDeadlines(response.applications);
    } catch (error) {
        applicationList.innerHTML = `
            <tr><td class="p-stack-lg text-center text-error" colspan="4">Applications could not be loaded.</td></tr>
        `;
        dashboardStatus.textContent = error.details?.error?.message || "API error";
        dashboardStatus.classList.add("text-error");
    }
}

loadDashboard();
