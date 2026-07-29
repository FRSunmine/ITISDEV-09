const root = document.querySelector("[data-platform-analytics]");

function escapeHtml(value) {
    const element = document.createElement("div");
    element.textContent = value ?? "";
    return element.innerHTML;
}

function titleCase(value) {
    return String(value).replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function bars(title, items, labelKey, valueKey = "count") {
    const max = Math.max(1, ...items.map((item) => item[valueKey]));
    return `
        <section class="tonal-card rounded-xl p-6">
            <h2 class="font-headline-md text-headline-md text-on-surface text-lg mb-5">${title}</h2>
            <div class="space-y-4">${items.length ? items.map((item) => `
                <div>
                    <div class="flex justify-between font-label-sm text-label-sm mb-1">
                        <span>${escapeHtml(titleCase(item[labelKey]))}</span><span>${item[valueKey]}</span>
                    </div>
                    <div class="h-3 bg-surface-variant rounded-full overflow-hidden">
                        <div class="h-full bg-primary rounded-full" style="width:${Math.round((item[valueKey] / max) * 100)}%"></div>
                    </div>
                </div>`).join("") : '<p class="text-on-surface-variant">No data yet.</p>'}</div>
        </section>`;
}

function metric(label, value) {
    return `<article class="tonal-card rounded-xl p-5"><p class="font-label-sm text-label-sm text-on-surface-variant uppercase">${label}</p>
        <p class="font-display-lg text-display-lg text-primary mt-2">${value}</p></article>`;
}

async function loadAnalytics() {
    root.innerHTML = '<p class="p-6 text-center text-on-surface-variant">Loading analytics...</p>';
    try {
        const response = await fetch("/api/v1/admin/analytics", { credentials: "include", headers: { Accept: "application/json" } });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error?.message || "Analytics could not be loaded.");
        root.innerHTML = `
            <header class="mb-8">
                <h1 class="font-display-lg text-display-lg text-primary">Platform Analytics</h1>
                <p class="font-body-md text-body-md text-on-surface-variant mt-2">Live ecosystem activity and supply/demand metrics.</p>
            </header>
            <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                ${metric("Users", data.totals.users)}${metric("Quests", data.totals.quests)}
                ${metric("Applications", data.totals.applications)}${metric("Completed", data.totals.completed)}
            </div>
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                ${bars("User Distribution", data.roleDistribution, "role")}
                ${bars("Quest Status", data.questStatuses, "status")}
                ${bars("Quest Categories", data.categories, "category")}
                ${bars("Application Status", data.applicationStatuses, "status")}
                ${bars("Monthly Completions", data.completionTrend, "month")}
                <section class="tonal-card rounded-xl p-6">
                    <h2 class="font-headline-md text-headline-md text-on-surface text-lg mb-5">Skill Gaps</h2>
                    <div class="overflow-x-auto"><table class="w-full text-left">
                        <thead><tr><th class="py-2">Skill</th><th class="py-2 text-right">Supply</th><th class="py-2 text-right">Demand</th><th class="py-2 text-right">Gap</th></tr></thead>
                        <tbody>${data.skillGaps.map((item) => `<tr class="border-t border-outline-variant/20">
                            <td class="py-3">${escapeHtml(item.name)}</td><td class="py-3 text-right">${item.supply}</td>
                            <td class="py-3 text-right">${item.demand}</td><td class="py-3 text-right ${item.gap < 0 ? "text-error" : "text-primary"}">${item.gap > 0 ? "+" : ""}${item.gap}</td>
                        </tr>`).join("")}</tbody>
                    </table></div>
                </section>
            </div>
            <section class="tonal-card rounded-xl mt-6 overflow-hidden">
                <div class="p-6 border-b border-outline-variant/30"><h2 class="font-headline-md text-headline-md text-on-surface text-lg">Recent Quests</h2></div>
                <div class="overflow-x-auto"><table class="w-full text-left">
                    <thead><tr class="bg-surface-container-low"><th class="p-4">Quest</th><th class="p-4">Client</th><th class="p-4">Category</th><th class="p-4">Status</th></tr></thead>
                    <tbody>${data.recentQuests.map((quest) => `<tr class="border-t border-outline-variant/20">
                        <td class="p-4 font-medium">${escapeHtml(quest.title)}</td><td class="p-4">${escapeHtml(quest.client_name)}</td>
                        <td class="p-4">${escapeHtml(quest.category)}</td><td class="p-4">${escapeHtml(titleCase(quest.status))}</td>
                    </tr>`).join("")}</tbody>
                </table></div>
            </section>`;
    } catch (error) {
        root.innerHTML = `<p class="p-6 text-center text-error">${escapeHtml(error.message)}</p>`;
    }
}

loadAnalytics();
