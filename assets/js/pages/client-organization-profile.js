const form = document.querySelector("[data-organization-form]");
const name = document.querySelector("[data-organization-name]");
const type = document.querySelector("[data-organization-type]");
const accountName = document.querySelector("[data-account-name]");
const accountEmail = document.querySelector("[data-account-email]");
const status = document.querySelector("[data-organization-status]");
const submit = form.querySelector("button[type='submit']");

async function request(path, options = {}) {
    const response = await fetch(path, {
        credentials: "include",
        headers: {
            Accept: "application/json",
            ...(options.body ? { "Content-Type": "application/json" } : {}),
        },
        ...options,
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error?.message || "Organization profile could not be saved.");
    return result;
}

function render(profile) {
    name.value = profile.organization_name;
    type.value = profile.organization_type || "";
    accountName.textContent = profile.display_name;
    accountEmail.textContent = profile.email;
}

request("/api/v1/client/profile")
    .then((result) => render(result.profile))
    .catch((error) => {
        status.textContent = error.message;
        status.classList.add("text-error");
    });

form.addEventListener("submit", async (event) => {
    event.preventDefault();
    submit.disabled = true;
    status.textContent = "Saving...";
    status.classList.remove("text-error");
    try {
        const result = await request("/api/v1/client/profile", {
            method: "PATCH",
            body: JSON.stringify({
                organizationName: name.value,
                organizationType: type.value,
            }),
        });
        render(result.profile);
        status.textContent = "Organization profile saved.";
    } catch (error) {
        status.textContent = error.message;
        status.classList.add("text-error");
    } finally {
        submit.disabled = false;
    }
});
