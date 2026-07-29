const form = document.querySelector("[data-report-form]");
const status = document.querySelector("[data-report-status]");
const history = document.querySelector("[data-report-history]");
const submit = form.querySelector("button[type='submit']");

function escapeHtml(value) {
    const element = document.createElement("div");
    element.textContent = value ?? "";
    return element.innerHTML;
}

function titleCase(value) {
    return String(value).replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

async function request(path, options = {}) {
    const response = await fetch(path, {
        credentials: "include",
        headers: { Accept: "application/json", ...(options.body ? { "Content-Type": "application/json" } : {}) },
        ...options,
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error?.message || "The report could not be submitted.");
    return result;
}

async function loadHistory() {
    const result = await request("/api/v1/reports/me");
    history.innerHTML = result.reports.length
        ? result.reports.map((report) => `
            <article class="p-4 border border-border-subtle rounded-lg">
                <div class="flex items-start justify-between gap-3">
                    <strong>${escapeHtml(report.subject)}</strong>
                    <span class="px-2 py-1 rounded-full bg-surface-container-high text-xs">${escapeHtml(titleCase(report.status))}</span>
                </div>
                <p class="text-sm text-on-surface-variant mt-2">${escapeHtml(titleCase(report.category))}</p>
                ${report.admin_notes ? `<p class="text-sm mt-3"><strong>Admin response:</strong> ${escapeHtml(report.admin_notes)}</p>` : ""}
            </article>`).join("")
        : '<p class="text-on-surface-variant">You have not submitted any reports.</p>';
}

form.addEventListener("submit", async (event) => {
    event.preventDefault();
    submit.disabled = true;
    status.textContent = "Submitting...";
    try {
        await request("/api/v1/reports", {
            method: "POST",
            body: JSON.stringify(Object.fromEntries(new FormData(form))),
        });
        form.reset();
        status.textContent = "Report submitted to the administrator.";
        await loadHistory();
    } catch (error) {
        status.textContent = error.message;
        status.classList.add("text-error");
    } finally {
        submit.disabled = false;
    }
});

loadHistory().catch((error) => {
    history.innerHTML = `<p class="text-error">${escapeHtml(error.message)}</p>`;
});
