import { apiClient } from "../services/api-client.js";

const questList = document.querySelector("[data-quest-list]");
const questStatus = document.querySelector("[data-quest-status]");
const searchInput = document.querySelector("[data-quest-search]");
const sortSelect = document.querySelector("[data-quest-sort]");
const filtersForm = document.querySelector("[data-quest-filters]");
const drawer = document.querySelector("#quest-drawer");
const drawerPanel = document.querySelector("#drawer-panel");
const modal = document.querySelector("#application-modal");
const modalPanel = document.querySelector("#modal-panel");
const submitButton = document.querySelector("[data-submit-application]");
const applicationStatus = document.querySelector("[data-application-status]");
const coverLetter = document.querySelector("[data-cover-letter]");
const portfolioLink = document.querySelector("[data-portfolio-link]");

let quests = [];
let selectedQuest = null;
let searchTimer;

function escapeHtml(value = "") {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function formatCurrency(cents) {
    return new Intl.NumberFormat("en-PH", {
        style: "currency",
        currency: "PHP",
        maximumFractionDigits: 0,
    }).format(cents / 100);
}

function formatDate(value) {
    const date = new Date(`${value}T00:00:00`);
    return Number.isNaN(date.getTime())
        ? value
        : new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric", year: "numeric" }).format(date);
}

function categoryIcon(category) {
    const icons = {
        Design: "draw",
        Development: "code",
        Tutoring: "school",
        Video: "movie",
        Writing: "edit_note",
    };
    return icons[category] || "work";
}

function showStatus(message, { error = false, hidden = false } = {}) {
    questStatus.hidden = hidden;
    questStatus.textContent = message;
    questStatus.classList.toggle("text-error", error);
}

function sortedQuests() {
    const items = [...quests];
    if (sortSelect.value === "budget") {
        return items.sort((a, b) => b.budget_cents - a.budget_cents);
    }
    if (sortSelect.value === "deadline") {
        return items.sort((a, b) => a.deadline.localeCompare(b.deadline));
    }
    return items.sort((a, b) => b.id - a.id);
}

function renderQuestCard(quest) {
    const coverage = Math.min(95, 55 + quest.skills.length * 10);
    const skills = quest.skills.length ? quest.skills : [quest.category];
    return `
        <article
            class="quest-card bg-surface-container-lowest border border-border-subtle rounded-xl p-stack-lg flex flex-col h-full cursor-pointer"
            data-quest-id="${quest.id}"
            role="button"
            tabindex="0"
            aria-label="View ${escapeHtml(quest.title)}"
        >
            <div class="flex justify-between items-start mb-stack-md">
                <span class="font-label-sm text-label-sm text-primary uppercase tracking-wider bg-primary-fixed/30 px-2 py-0.5 rounded">${escapeHtml(quest.category)}</span>
                <span class="font-label-md text-label-md font-bold text-on-surface">${formatCurrency(quest.budget_cents)}</span>
            </div>
            <h2 class="font-headline-sm text-headline-sm text-on-surface mb-2 line-clamp-2">${escapeHtml(quest.title)}</h2>
            <div class="flex items-center gap-2 mb-stack-md">
                <div class="w-6 h-6 rounded bg-surface-container-highest flex items-center justify-center shrink-0">
                    <span class="material-symbols-outlined text-[14px] text-on-surface-variant">${categoryIcon(quest.category)}</span>
                </div>
                <span class="font-body-sm text-body-sm text-on-surface-variant truncate">${escapeHtml(quest.client_name)}</span>
                <span class="material-symbols-outlined text-[14px] text-status-info" title="Verified client">verified</span>
            </div>
            <div class="flex items-center gap-2 mb-2">
                <div class="h-1.5 w-24 bg-surface-container rounded-full overflow-hidden">
                    <div class="h-full bg-status-success" style="width: ${coverage}%"></div>
                </div>
                <span class="font-label-sm text-label-sm text-on-surface-variant">${coverage}% Criteria Coverage</span>
            </div>
            <p class="font-body-sm text-body-sm text-on-surface-variant line-clamp-3 mb-stack-lg flex-1 mt-2">${escapeHtml(quest.description)}</p>
            <div class="flex flex-wrap gap-2 mb-stack-lg mt-auto">
                ${skills.map((skill) => `<span class="font-label-sm text-label-sm bg-surface-container px-2 py-1 rounded text-on-surface">${escapeHtml(skill)}</span>`).join("")}
            </div>
            <div class="flex items-center justify-between border-t border-border-subtle pt-stack-md">
                <div class="flex items-center gap-1.5 text-on-surface-variant">
                    <span class="material-symbols-outlined text-[16px]">schedule</span>
                    <span class="font-label-sm text-label-sm">Due ${formatDate(quest.deadline)}</span>
                </div>
                <div class="flex items-center gap-1.5 text-on-surface-variant">
                    <span class="material-symbols-outlined text-[16px]">public</span>
                    <span class="font-label-sm text-label-sm capitalize">${escapeHtml(quest.work_arrangement)}</span>
                </div>
            </div>
        </article>
    `;
}

function renderQuests() {
    const items = sortedQuests();
    questList.innerHTML = items.map(renderQuestCard).join("");
    if (!items.length) {
        showStatus("No open quests match the current search and filters.");
    } else {
        showStatus(`${items.length} open quest${items.length === 1 ? "" : "s"} found.`);
    }
}

function questQuery() {
    const params = new URLSearchParams();
    const search = searchInput.value.trim();
    if (search) params.set("search", search);

    filtersForm.querySelectorAll("[data-quest-filter]").forEach((control) => {
        const value = control.value.trim();
        if (!value) return;
        const name = control.dataset.questFilter;
        if (name === "minBudget" || name === "maxBudget") {
            params.set(`${name}Cents`, String(Math.round(Number(value) * 100)));
        } else {
            params.set(name, value);
        }
    });
    return params;
}

async function loadQuests() {
    showStatus("Loading quests...");
    questList.innerHTML = "";
    try {
        const response = await apiClient.get(`/quests?${questQuery().toString()}`);
        quests = response.quests;
        renderQuests();
    } catch (error) {
        quests = [];
        questList.innerHTML = "";
        showStatus(error.details?.error?.message || "Quests could not be loaded. Try again.", { error: true });
    }
}

function setDetail(name, value) {
    const target = document.querySelector(`[data-quest-detail="${name}"]`);
    if (target) target.textContent = value;
}

function populateDrawer(quest) {
    selectedQuest = quest;
    setDetail("title", quest.title);
    setDetail("budget", formatCurrency(quest.budget_cents));
    setDetail("client", quest.client_name);
    setDetail("deadline", formatDate(quest.deadline));
    setDetail("arrangement", quest.work_arrangement[0].toUpperCase() + quest.work_arrangement.slice(1));
    setDetail("category", quest.category);
    setDetail("applicants", `${quest.applicant_count} pending`);
    setDetail("description", quest.description);

    const deliverables = document.querySelector('[data-quest-detail="deliverables"]');
    deliverables.innerHTML = quest.deliverables.length
        ? quest.deliverables.map((item) => `
            <div class="p-stack-sm flex items-start gap-3">
                <span class="material-symbols-outlined text-on-surface-variant mt-0.5">radio_button_unchecked</span>
                <span class="block font-label-md text-label-md text-on-surface">${escapeHtml(item.title)}</span>
            </div>
        `).join("")
        : '<p class="p-stack-sm font-body-sm text-body-sm text-on-surface-variant">The client has not added a deliverables checklist yet.</p>';

    const skills = document.querySelector('[data-quest-detail="skills"]');
    skills.innerHTML = (quest.skills.length ? quest.skills : [quest.category])
        .map((skill) => `<span class="font-label-md text-label-md border border-border-subtle px-3 py-1.5 rounded-full text-on-surface">${escapeHtml(skill)}</span>`)
        .join("");
}

async function openQuest(questId) {
    drawer.classList.add("active");
    drawerPanel.classList.add("active");
    setDetail("title", "Loading quest...");
    try {
        const response = await apiClient.get(`/quests/${questId}`);
        populateDrawer(response.quest);
    } catch (error) {
        setDetail("title", "Quest unavailable");
        setDetail("description", error.details?.error?.message || "This quest could not be loaded.");
    }
}

function openApplication() {
    if (!selectedQuest) return;
    document.querySelector("[data-application-quest-title]").textContent = selectedQuest.title;
    applicationStatus.textContent = "";
    modal.classList.add("active");
    modalPanel.classList.add("active");
    setTimeout(() => coverLetter.focus(), 0);
}

async function submitApplication() {
    const proposal = coverLetter.value.trim();
    if (!proposal) {
        applicationStatus.textContent = "Please enter a proposal.";
        applicationStatus.className = "mr-auto self-center font-body-sm text-body-sm text-error";
        coverLetter.focus();
        return;
    }

    const portfolio = portfolioLink.value.trim();
    const fullCoverLetter = portfolio ? `${proposal}\n\nPortfolio: ${portfolio}` : proposal;
    submitButton.disabled = true;
    submitButton.classList.add("opacity-60", "cursor-wait");
    applicationStatus.textContent = "Submitting...";
    applicationStatus.className = "mr-auto self-center font-body-sm text-body-sm text-on-surface-variant";

    try {
        await apiClient.post(`/quests/${selectedQuest.id}/applications`, { coverLetter: fullCoverLetter });
        selectedQuest.applicant_count += 1;
        setDetail("applicants", `${selectedQuest.applicant_count} pending`);
        applicationStatus.textContent = "Application submitted successfully.";
        applicationStatus.className = "mr-auto self-center font-body-sm text-body-sm text-status-success";
        coverLetter.value = "";
        portfolioLink.value = "";
    } catch (error) {
        applicationStatus.textContent =
            error.details?.error?.message || "Application could not be submitted.";
        applicationStatus.className = "mr-auto self-center font-body-sm text-body-sm text-error";
    } finally {
        submitButton.disabled = false;
        submitButton.classList.remove("opacity-60", "cursor-wait");
    }
}

questList.addEventListener("click", (event) => {
    const card = event.target.closest("[data-quest-id]");
    if (card) openQuest(card.dataset.questId);
});

questList.addEventListener("keydown", (event) => {
    const card = event.target.closest("[data-quest-id]");
    if (card && ["Enter", " "].includes(event.key)) {
        event.preventDefault();
        openQuest(card.dataset.questId);
    }
});

searchInput.addEventListener("input", () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(loadQuests, 250);
});
sortSelect.addEventListener("change", renderQuests);
filtersForm.addEventListener("submit", (event) => {
    event.preventDefault();
    loadQuests();
});
filtersForm.querySelector("[data-clear-quest-filters]").addEventListener("click", () => {
    filtersForm.reset();
    loadQuests();
});
document.querySelector("[data-open-application]").addEventListener("click", openApplication);
submitButton.addEventListener("click", submitApplication);

questList.innerHTML = "";
loadQuests();
