const name = document.querySelector("[data-profile-name]");
const email = document.querySelector("[data-profile-email]");
const role = document.querySelector("[data-profile-role]");
const contextLabel = document.querySelector("[data-profile-context-label]");
const context = document.querySelector("[data-profile-context]");
const homeLinks = document.querySelectorAll("[data-account-home]");

const homeByRole = {
    student: "/pages/student-dashboard.html",
    client: "/pages/client-dashboard.html",
    admin: "/pages/admin-operations.html",
};

function titleCase(value) {
    return String(value).replace(/\b\w/g, (letter) => letter.toUpperCase());
}

fetch("/api/v1/auth/me", {
    credentials: "include",
    headers: { Accept: "application/json" },
})
    .then(async (response) => {
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error?.message || "Account could not be loaded.");
        return result.user;
    })
    .then(async (user) => {
        name.textContent = user.displayName;
        email.textContent = user.email;
        role.textContent = user.role === "admin" ? "Administrator" : titleCase(user.role);
        homeLinks.forEach((link) => {
            link.href = homeByRole[user.role];
        });

        if (user.role === "student") {
            const response = await fetch("/api/v1/profile/me", { credentials: "include" });
            if (!response.ok) return;
            const data = await response.json();
            contextLabel.textContent = "Academic profile";
            context.textContent = [data.profile.course, data.profile.university].filter(Boolean).join(" at ");
        } else if (user.role === "client") {
            const response = await fetch("/api/v1/client/dashboard", { credentials: "include" });
            if (!response.ok) return;
            const data = await response.json();
            contextLabel.textContent = "Organization";
            context.textContent = data.client.organization_name;
        }
    })
    .catch((error) => {
        name.textContent = error.message;
    });
