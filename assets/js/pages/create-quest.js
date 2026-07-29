const titleInput = document.getElementById("quest_title");
const descriptionInput = document.getElementById("quest_desc");
const budgetInput = document.getElementById("quest_budget");
const deadlineInput = document.getElementById("quest_deadline");
const categoryInput = document.getElementById("quest_category");
const arrangementInput = document.getElementById("quest_arrangement");
const skillInput = document.getElementById("quest_skill");
const skillsList = document.querySelector("[data-skills-list]");
const deliverablesList = document.querySelector("[data-deliverables-list]");
const publishButton = document.querySelector("[data-publish-quest]");
const status = document.querySelector("[data-create-quest-status]");

function escapeHtml(value) {
    const element = document.createElement("div");
    element.textContent = value;
    return element.innerHTML;
}

function setStatus(message, isError = false) {
    status.textContent = message;
    status.classList.toggle("text-error", isError);
    status.classList.toggle("text-primary", !isError && Boolean(message));
}

function addSkill(name) {
    const normalizedName = name.trim();
    if (!normalizedName) return;
    const exists = [...skillsList.querySelectorAll("[data-skill]")]
        .some((item) => item.dataset.skill.toLowerCase() === normalizedName.toLowerCase());
    if (exists) return;

    const tag = document.createElement("span");
    tag.className =
        "inline-flex items-center gap-1 px-3 py-1 rounded bg-secondary-container text-on-secondary-container font-label-sm text-label-sm border border-secondary-container";
    tag.dataset.skill = normalizedName;
    tag.innerHTML = `${escapeHtml(normalizedName)}
        <button aria-label="Remove ${escapeHtml(normalizedName)}" class="hover:text-primary" data-remove-skill type="button">
            <span class="material-symbols-outlined text-[14px]" data-icon="close">close</span>
        </button>`;
    skillsList.append(tag);
}

function addDeliverable(value = "") {
    const item = document.createElement("div");
    item.className =
        "flex items-center justify-between p-4 bg-surface-container-low border border-outline-variant rounded group hover:border-outline transition-colors";
    item.innerHTML = `
        <div class="flex items-center gap-4 flex-1">
            <div class="h-6 w-6 rounded border-2 border-primary flex items-center justify-center flex-shrink-0">
                <span class="material-symbols-outlined text-[16px] text-primary" data-icon="check" data-weight="fill">check</span>
            </div>
            <div class="flex-1">
                <input class="bg-transparent border-none p-0 focus:ring-0 font-body-md text-body-md text-on-surface w-full"
                    data-deliverable-input placeholder="Describe the expected output" type="text" value="${escapeHtml(value)}">
            </div>
        </div>
        <button aria-label="Remove deliverable" class="text-outline hover:text-error transition-colors p-2 opacity-0 group-hover:opacity-100 focus:opacity-100"
            data-remove-deliverable type="button">
            <span class="material-symbols-outlined" data-icon="delete">delete</span>
        </button>`;
    deliverablesList.append(item);
    item.querySelector("input").focus();
}

function collectValues(selector) {
    return [...document.querySelectorAll(selector)]
        .map((item) => item.value.trim())
        .filter(Boolean);
}

async function publishQuest() {
    const budgetPesos = Number(budgetInput.value);
    const payload = {
        title: titleInput.value.trim(),
        description: descriptionInput.value.trim(),
        category: categoryInput.value,
        budgetCents: Number.isFinite(budgetPesos) ? Math.round(budgetPesos * 100) : -1,
        deadline: deadlineInput.value,
        workArrangement: arrangementInput.value,
        skills: [...document.querySelectorAll("[data-skill]")].map((item) => item.dataset.skill),
        deliverables: collectValues("[data-deliverable-input]"),
    };

    if (!payload.title || !payload.description || !payload.deadline || payload.budgetCents < 0) {
        setStatus("Complete the title, description, budget, and deadline.", true);
        return;
    }
    if (payload.skills.length === 0 || payload.deliverables.length === 0) {
        setStatus("Add at least one skill and one deliverable.", true);
        return;
    }

    publishButton.disabled = true;
    publishButton.classList.add("opacity-60", "cursor-wait");
    setStatus("Publishing quest...");
    try {
        const response = await fetch("/api/v1/quests", {
            method: "POST",
            credentials: "include",
            headers: {
                Accept: "application/json",
                "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(result.error?.message || "The quest could not be published.");
        }
        setStatus("Quest published. Returning to your dashboard.");
        window.setTimeout(() => {
            window.location.href = `/pages/client-dashboard.html?created=${result.quest.id}`;
        }, 700);
    } catch (error) {
        setStatus(error.message, true);
        publishButton.disabled = false;
        publishButton.classList.remove("opacity-60", "cursor-wait");
    }
}

deadlineInput.min = new Date().toISOString().slice(0, 10);

skillInput.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== ",") return;
    event.preventDefault();
    addSkill(skillInput.value.replace(/,$/, ""));
    skillInput.value = "";
});

document.addEventListener("click", (event) => {
    if (event.target.closest("[data-add-deliverable]")) {
        addDeliverable();
        return;
    }
    event.target.closest("[data-remove-deliverable]")?.closest(".group")?.remove();
    event.target.closest("[data-remove-skill]")?.closest("[data-skill]")?.remove();
    if (event.target.closest("[data-publish-quest]")) publishQuest();
});
