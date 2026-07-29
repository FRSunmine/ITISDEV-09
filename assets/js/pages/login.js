import { apiClient } from "../services/api-client.js";

const form = document.querySelector("[data-auth-form]");
const submitButton = form?.querySelector('button[type="submit"]');
const status = document.querySelector("[data-auth-status]");
const passwordInput = document.querySelector("#password");
const registerFields = document.querySelector("[data-register-fields]");
const organizationField = document.querySelector("[data-organization-field]");
const organizationInput = document.getElementById("organization_name");
const displayNameInput = document.getElementById("display_name");
const submitLabel = document.querySelector("[data-auth-submit-label]");
const modeToggle = document.querySelector("[data-auth-mode-toggle]");
const modePrompt = document.querySelector("[data-auth-toggle-prompt]");
const roleGroup = document.querySelector("[data-role-group]");
const registrationOnly = document.querySelector("[data-registration-only]");
const emailHint = document.querySelector("[data-email-hint]");
const emailInput = document.querySelector("#email");
const demoButtons = [...document.querySelectorAll("[data-demo-login]")];
let mode = "login";

const routeByRole = {
    student: "/pages/student-dashboard.html",
    client: "/pages/client-dashboard.html",
    admin: "/pages/admin-operations.html",
};

const demoAccounts = {
    student: "student@dlsu.edu.ph",
    client: "client@sidequest.demo",
    admin: "admin@sidequest.demo",
};

function setAuthBusy(busy) {
    [submitButton, ...demoButtons].forEach((button) => {
        button.disabled = busy;
    });
    submitButton.classList.toggle("opacity-60", busy);
    submitButton.classList.toggle("cursor-wait", busy);
}

async function signIn(credentials, message = "Signing in...") {
    status.textContent = message;
    status.className = "font-body-sm text-body-sm text-on-surface-variant";
    const response = await apiClient.post("/auth/login", credentials);
    status.textContent = `Welcome, ${response.user.displayName}.`;
    window.location.href = routeByRole[response.user.role];
}

function selectedApiRole() {
    return document.body.dataset.selectedRole || "student";
}

function syncRoleFields() {
    const isClientRegistration = mode === "register" && selectedApiRole() === "client";
    organizationField.classList.toggle("hidden", !isClientRegistration);
    organizationInput.required = isClientRegistration;
}

function syncMode() {
    const registering = mode === "register";
    registerFields.classList.toggle("hidden", !registering);
    document.querySelectorAll("[data-login-only]").forEach((element) => {
        element.classList.toggle("hidden", registering);
    });
    registrationOnly.classList.toggle("hidden", !registering);
    displayNameInput.required = registering;
    submitLabel.textContent = registering ? "Create Account" : "Sign In";
    modeToggle.textContent = registering ? "Sign in" : "Create account";
    modePrompt.textContent = registering ? "Already have an account?" : "Don't have an account?";
    emailInput.placeholder = registering && selectedApiRole() === "student"
        ? "name@university.edu"
        : "name@example.com";
    emailHint.lastChild.textContent = registering && selectedApiRole() === "student"
        ? " Use your university email to register."
        : registering
            ? " Use your organization email to register."
            : " Your account type is detected automatically.";
    syncRoleFields();
}

document.querySelector("[data-password-toggle]")?.addEventListener("click", (event) => {
    const showing = passwordInput.type === "text";
    passwordInput.type = showing ? "password" : "text";
    event.currentTarget.setAttribute("aria-label", showing ? "Show password" : "Hide password");
    event.currentTarget.querySelector(".material-symbols-outlined").textContent =
        showing ? "visibility_off" : "visibility";
});

modeToggle?.addEventListener("click", () => {
    mode = mode === "login" ? "register" : "login";
    status.textContent = "";
    syncMode();
});

roleGroup?.addEventListener("click", () => queueMicrotask(syncMode));

form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    const credentials = {
        email: formData.get("email"),
        password: formData.get("password"),
        remember: formData.get("remember") === "on",
    };

    setAuthBusy(true);
    status.textContent = mode === "register" ? "Creating account..." : "Signing in...";
    status.className = "font-body-sm text-body-sm text-on-surface-variant";

    try {
        if (mode === "register") {
            const role = selectedApiRole();
            await apiClient.post("/auth/register", {
                email: credentials.email,
                password: credentials.password,
                role,
                displayName: formData.get("displayName"),
                organizationName: role === "client" ? formData.get("organizationName") : undefined,
            });
        }
        await signIn(credentials, mode === "register" ? "Account created. Signing in..." : "Signing in...");
    } catch (error) {
        status.textContent =
            error.details?.error?.message || "Unable to continue. Check your details and try again.";
        status.className = "font-body-sm text-body-sm text-error";
    } finally {
        setAuthBusy(false);
    }
});

demoButtons.forEach((button) => {
    button.addEventListener("click", async () => {
        const role = button.dataset.demoLogin;
        const email = demoAccounts[role];
        if (!email) return;

        emailInput.value = email;
        passwordInput.value = "SideQuest123!";
        setAuthBusy(true);
        try {
            await signIn(
                { email, password: "SideQuest123!", remember: false },
                `Opening the ${role} demo...`,
            );
        } catch (error) {
            status.textContent =
                error.details?.error?.message || "The demo account could not be opened.";
            status.className = "font-body-sm text-body-sm text-error";
        } finally {
            setAuthBusy(false);
        }
    });
});

syncMode();
