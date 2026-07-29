const root = document.querySelector("[data-platform-analytics]");

function escapeHtml(value) {
    const element = document.createElement("div");
    element.textContent = value ?? "";
    return element.innerHTML;
}

function titleCase(value) {
    return String(value).replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function metric(label, value, icon, note) {
    return `
        <article class="analytics-metric">
            <div>
                <p>${escapeHtml(label)}</p>
                <strong>${value}</strong>
                <span>${escapeHtml(note)}</span>
            </div>
            <span class="material-symbols-outlined">${icon}</span>
        </article>`;
}

function horizontalBars(title, eyebrow, items, labelKey, valueKey = "count") {
    const max = Math.max(1, ...items.map((item) => item[valueKey]));
    return `
        <section class="analytics-panel">
            <div class="analytics-panel-heading"><div><p>${eyebrow}</p><h2>${title}</h2></div></div>
            <div class="analytics-bars">
                ${items.length ? items.map((item) => `
                    <div class="analytics-bar-row">
                        <div><span>${escapeHtml(titleCase(item[labelKey]))}</span><strong>${item[valueKey]}</strong></div>
                        <div class="analytics-track"><span style="width:${Math.round((item[valueKey] / max) * 100)}%"></span></div>
                    </div>`).join("") : '<p class="analytics-empty">No data recorded yet.</p>'}
            </div>
        </section>`;
}

function completionTrend(items) {
    const max = Math.max(1, ...items.map((item) => item.count));
    return `
        <section class="analytics-panel analytics-trend">
            <div class="analytics-panel-heading">
                <div><p>Delivery health</p><h2>Monthly completions</h2></div>
                <span class="analytics-chip">${items.reduce((total, item) => total + item.count, 0)} total</span>
            </div>
            <div class="analytics-columns">
                ${items.length ? items.map((item) => `
                    <div class="analytics-column">
                        <strong>${item.count}</strong>
                        <div><span style="height:${Math.max(8, Math.round((item.count / max) * 100))}%"></span></div>
                        <small>${escapeHtml(item.month)}</small>
                    </div>`).join("") : '<p class="analytics-empty">Completed quests will create the first trend point.</p>'}
            </div>
        </section>`;
}

function skillTable(items) {
    return `
        <section class="analytics-panel">
            <div class="analytics-panel-heading">
                <div><p>Marketplace balance</p><h2>Highest-priority skill gaps</h2></div>
                <a href="admin-operations.html">Search all skills</a>
            </div>
            <div class="overflow-x-auto">
                <table class="analytics-table">
                    <thead><tr><th>Skill</th><th>Supply</th><th>Demand</th><th>Balance</th></tr></thead>
                    <tbody>${items.slice(0, 8).map((item) => `
                        <tr><td>${escapeHtml(item.name)}</td><td>${item.supply}</td><td>${item.demand}</td>
                        <td><span class="${item.gap < 0 ? "analytics-deficit" : "analytics-surplus"}">${item.gap > 0 ? "+" : ""}${item.gap}</span></td></tr>
                    `).join("")}</tbody>
                </table>
            </div>
        </section>`;
}

function recentQuests(items) {
    return `
        <section class="analytics-panel analytics-recent">
            <div class="analytics-panel-heading"><div><p>Latest activity</p><h2>Recent quests</h2></div></div>
            <div class="overflow-x-auto"><table class="analytics-table">
                <thead><tr><th>Quest</th><th>Client</th><th>Category</th><th>Status</th></tr></thead>
                <tbody>${items.map((quest) => `
                    <tr><td><strong>${escapeHtml(quest.title)}</strong></td><td>${escapeHtml(quest.client_name)}</td>
                    <td>${escapeHtml(quest.category)}</td><td><span class="analytics-status">${escapeHtml(titleCase(quest.status))}</span></td></tr>
                `).join("")}</tbody>
            </table></div>
        </section>`;
}

async function loadAnalytics() {
    root.innerHTML = '<p class="analytics-loading">Loading platform intelligence...</p>';
    try {
        const response = await fetch("/api/v1/admin/analytics", {
            credentials: "include",
            headers: { Accept: "application/json" },
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error?.message || "Analytics could not be loaded.");
        root.innerHTML = `
            <header class="analytics-hero">
                <div><p>Platform intelligence</p><h1>Operational pulse</h1>
                    <span>Live demand, participation, and delivery signals from persisted SideQuest activity.</span>
                </div>
                <a href="admin-operations.html">Open operations <span class="material-symbols-outlined">arrow_forward</span></a>
            </header>
            <div class="analytics-metrics">
                ${metric("Users", data.totals.users, "group", "Registered accounts")}
                ${metric("Open work", data.questStatuses.find((item) => item.status === "open")?.count || 0, "work", "Quests accepting talent")}
                ${metric("Applications", data.totals.applications, "description", "Submitted proposals")}
                ${metric("Completed", data.totals.completed, "task_alt", "Verified outcomes")}
            </div>
            <div class="analytics-layout">
                ${horizontalBars("Community mix", "Participation", data.roleDistribution, "role")}
                ${horizontalBars("Quest pipeline", "Work status", data.questStatuses, "status")}
                ${completionTrend(data.completionTrend)}
                ${horizontalBars("Demand by category", "Marketplace", data.categories, "category")}
                ${horizontalBars("Application outcomes", "Conversion", data.applicationStatuses, "status")}
                ${skillTable(data.skillGaps)}
            </div>
            ${recentQuests(data.recentQuests)}`;
    } catch (error) {
        root.innerHTML = `<p class="analytics-loading text-error">${escapeHtml(error.message)}</p>`;
    }
}

loadAnalytics();
