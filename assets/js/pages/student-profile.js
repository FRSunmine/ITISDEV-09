const name = document.querySelector("[data-profile-name]");
const meta = document.querySelector("[data-profile-meta]");
const completed = document.querySelector("[data-profile-completed]");
const bio = document.querySelector("[data-profile-bio]");
const skills = document.querySelector("[data-profile-skills]");
const portfolio = document.querySelector("[data-profile-portfolio]");
const reviews = document.querySelector("[data-profile-reviews]");

function escapeHtml(value) {
    const element = document.createElement("div");
    element.textContent = value ?? "";
    return element.innerHTML;
}

function formatDate(value) {
    return new Intl.DateTimeFormat("en-PH", {
        year: "numeric",
        month: "short",
    }).format(new Date(value));
}

function renderProfile(data) {
    name.textContent = data.profile.display_name;
    meta.textContent = [data.profile.course, data.profile.university].filter(Boolean).join(" @ ");
    completed.textContent = data.summary.completed;
    bio.textContent = data.profile.bio || "This student has not added a profile summary yet.";

    skills.innerHTML = data.skills.length
        ? data.skills.map((skill) => `
            <span class="border border-border-subtle bg-surface px-3 py-1.5 rounded-full font-label-sm text-label-sm text-on-surface-variant">
                ${escapeHtml(skill)}
            </span>`).join("")
        : '<span class="font-body-sm text-body-sm text-on-surface-variant">No skills listed yet.</span>';

    portfolio.innerHTML = data.portfolio.length
        ? data.portfolio.map((entry) => `
            <article class="bg-surface-container-lowest border border-border-subtle rounded-xl overflow-hidden shadow-sm flex flex-col">
                <div class="h-32 bg-surface-container-highest border-b border-border-subtle flex items-center justify-center relative overflow-hidden">
                    <div class="absolute inset-0 opacity-40" style="background: radial-gradient(circle at 20% 20%, var(--color-primary-fixed, #cce8dd), transparent 45%), linear-gradient(135deg, transparent 40%, var(--color-surface-container-high, #e5e9e6));"></div>
                    <span class="material-symbols-outlined text-primary text-[42px] relative">verified</span>
                    <span class="absolute top-3 left-3 bg-surface/90 border border-border-subtle rounded px-2 py-1 font-label-sm text-[9px] text-primary">Verified by SideQuest</span>
                </div>
                <div class="p-stack-md flex-1 flex flex-col">
                    <h3 class="font-label-md text-label-md text-on-surface font-semibold">${escapeHtml(entry.title)}</h3>
                    <p class="font-body-sm text-body-sm text-on-surface-variant mt-2 line-clamp-3">${escapeHtml(entry.summary || "")}</p>
                    <div class="mt-auto pt-stack-sm flex items-center justify-between border-t border-border-subtle">
                        <span class="font-label-sm text-label-sm text-secondary">Client: ${escapeHtml(entry.client_name)}${entry.client_rating ? ` | ${entry.client_rating}/5` : ""}</span>
                        <span class="font-label-sm text-label-sm text-tertiary-container">${escapeHtml(formatDate(entry.completed_at))}</span>
                    </div>
                </div>
            </article>`).join("")
        : `<div class="md:col-span-2 bg-surface-container-lowest border border-border-subtle rounded-xl p-stack-lg text-center text-on-surface-variant">
            Completed SideQuest work will appear here automatically.
        </div>`;

    reviews.innerHTML = data.reviews.length
        ? data.reviews.map((review) => `
            <article class="p-stack-md border-b border-border-subtle last:border-0">
                <div class="flex justify-between items-start gap-3">
                    <div>
                        <h4 class="font-label-md text-label-md text-on-surface font-semibold">${escapeHtml(review.reviewer_name)}</h4>
                        <span class="font-label-sm text-label-sm text-secondary">${escapeHtml(review.organization_name || "SideQuest client")}</span>
                    </div>
                    <span class="text-status-pending flex" aria-label="${review.rating} out of 5">
                        ${Array.from({ length: 5 }, (_, index) => `
                            <span class="material-symbols-outlined text-[16px]">${index < review.rating ? "star" : "star_outline"}</span>
                        `).join("")}
                    </span>
                </div>
                <p class="font-body-sm text-body-sm text-on-surface-variant mt-2">${escapeHtml(review.comment || "No written comment.")}</p>
                <div class="mt-2 flex items-center gap-2">
                    <span class="font-label-sm text-label-sm text-tertiary-container bg-surface-container px-2 py-0.5 rounded">Project: ${escapeHtml(review.quest_title)}</span>
                    <span class="font-label-sm text-label-sm text-outline">${escapeHtml(formatDate(review.created_at))}</span>
                </div>
            </article>`).join("")
        : '<p class="p-stack-lg text-center text-on-surface-variant">No client reviews yet.</p>';
}

portfolio.innerHTML = '<p class="md:col-span-2 p-stack-lg text-center text-on-surface-variant">Loading portfolio...</p>';
reviews.innerHTML = '<p class="p-stack-lg text-center text-on-surface-variant">Loading reviews...</p>';

fetch("/api/v1/profile/me", {
    credentials: "include",
    headers: { Accept: "application/json" },
})
    .then(async (response) => {
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error?.message || "Profile could not be loaded.");
        return result;
    })
    .then(renderProfile)
    .catch((error) => {
        portfolio.innerHTML = `<p class="md:col-span-2 p-stack-lg text-center text-error">${escapeHtml(error.message)}</p>`;
        reviews.innerHTML = "";
    });
