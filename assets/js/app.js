export const routes = {
    login: "/pages/login.html",
    studentDashboard: "/pages/student-dashboard.html",
    studentMarketplace: "/pages/quest-marketplace.html",
    studentWorkspace: "/pages/student-quest-workspace.html",
    studentProfile: "/pages/student-profile.html",
    studentSettings: "/pages/student-settings.html",
    studentVerification: "/pages/student-verification.html",
    clientDashboard: "/pages/client-dashboard.html",
    createQuest: "/pages/create-quest.html",
    applicantSelection: "/pages/applicant-selection.html",
    clientWorkspace: "/pages/client-quest-workspace.html",
    adminOperations: "/pages/admin-operations.html",
    platformAnalytics: "/pages/platform-analytics.html",
};

document.documentElement.classList.add("is-loading");

const THEME_STORAGE_KEY = "sidequest-theme";
const PREFERENCES_STORAGE_KEY = "sidequest-preferences";
const defaultPreferences = Object.freeze({
    applicationUpdates: true,
    messageNotifications: true,
    questRecommendations: true,
    profileVisibility: "campus",
    reduceMotion: false,
});

function applyTheme(theme) {
    const normalizedTheme = theme === "dark" ? "dark" : "light";
    document.documentElement.classList.remove("light", "dark");
    document.documentElement.classList.add(normalizedTheme);
    document.documentElement.dataset.theme = normalizedTheme;
    return normalizedTheme;
}

function initializeTheme() {
    try {
        return applyTheme(window.localStorage.getItem(THEME_STORAGE_KEY) || "light");
    } catch {
        return applyTheme("light");
    }
}

function syncThemeControls(theme = document.documentElement.dataset.theme || "light") {
    const isDark = theme === "dark";
    document.querySelectorAll("[data-theme-toggle]").forEach((control) => {
        if ("checked" in control) {
            control.checked = isDark;
        }

        control.setAttribute("aria-checked", isDark ? "true" : "false");
    });

    document.querySelectorAll("[data-theme-label]").forEach((label) => {
        label.textContent = isDark ? "Dark mode is on" : "Dark mode is off";
    });
}

initializeTheme();

function loadPreferences() {
    try {
        const storedPreferences = JSON.parse(window.localStorage.getItem(PREFERENCES_STORAGE_KEY) || "{}");
        return { ...defaultPreferences, ...storedPreferences };
    } catch {
        return { ...defaultPreferences };
    }
}

function savePreferences(preferences) {
    try {
        window.localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(preferences));
    } catch {
        // Keep preferences working for this page even when storage is unavailable.
    }
}

function applyPreferences(preferences) {
    document.documentElement.classList.toggle("reduce-motion", preferences.reduceMotion);

    document.querySelectorAll("[data-preference]").forEach((control) => {
        const key = control.dataset.preference;
        if (!(key in preferences)) {
            return;
        }

        if (control.type === "checkbox") {
            control.checked = Boolean(preferences[key]);
        } else {
            control.value = preferences[key];
        }
    });
}

function announceSettingsSaved(message = "Preferences saved on this device.") {
    const status = document.querySelector("[data-settings-status]");
    if (status) {
        status.textContent = message;
    }
}

let preferences = loadPreferences();
applyPreferences(preferences);

const sharedAssets = Object.freeze({
    studentAvatar:
        "https://lh3.googleusercontent.com/aida-public/AB6AXuA1_yDpvgMYJYer7rTM5MAmM-eKWZJwpqMJ5cwRURAJx-t58q387wjvzn1wajQREdNrKPTF-gGF-GQcGG7fQIAMpvN86piLjgLyDxETYKRj2MJfEUA_E-oGz61Xyj7qBtXgP1FZ3eE7k_1zA-tuo_rEwsb2J7sglTVW63p3hWzAIKXCvwJZBDv8Bxp_NLhBYFHmbvdPwIbFoEGZcdzph_DS6DHa6yW3PPHc4XF6Ab-bSMco1-GFTLH1mkix9WPPDTGi-QKD7196WqQ",
    clientAvatar:
        "https://lh3.googleusercontent.com/aida-public/AB6AXuD2Tth-tmLbvlrryB5jTbvn6W4y7u1suwxa87W0E2NPXGLCSI7pKT-tDtOW7T-SjQ7iWR84WHiLikaG0hNdAvLUYKxS1pkQrCDfdOeafPQPXF9yFptsDeOkuLmq4QUBld5D72J8S3WZGpoqs7BACTjjVX1v_fA3R8AmnuWIZ5BjBrUGfpigFebWPEQnY7PBHJlO7NnVbOkt-WYC7tp0dzG9Zqqge_KryFTUimWMQeacB1cmQXNXDOGvRhYK7XtBzrJn0rVXX0wvrMA",
    adminAvatar:
        "https://lh3.googleusercontent.com/aida-public/AB6AXuDgqYnsA_d6yeHo3Wqrq1NLblx6xOjBvkpjBXxLx0ccrCSCXISInbdpw9zAHzGLnKUhkVwGk5WP6GJ96Nfe0QZMPOcxJhCFE3CVv1NDLXKzMfAbGxCAbUaAC-R0q2Fpd7Vdv7PSXZybgOgvQQRLHus9e4s-DCiWSYR0QpHixSWIX0_VtTDH33vDL5NymiMhsBBNwDleku1f57farcA4Sq4bIfNptI75rSisXSMbL-AD-OlTkwkov2ruZAsbJbZZwWvC4tHxHWXSgXM",
    clientLogo:
        "https://lh3.googleusercontent.com/aida-public/AB6AXuBui7BDVxlGTa4DZKCroo40X24IkZy3KyzItJEunPVMZGuPyq5vLbGI9exifFa3mW6f9Tv51Ix9vt49BdMsPa3F3noKrD5b24-msGUua1mR0thBv1_GQWSB0kIhEYL1A2BEW9xuXEWTTYUljLPIlQWbgLyszCElepmzN_BkaAQ7nQSmKZIen_TMpRQb5N_TIwQFt3BLRLsLkccIF1rTjxwIe1y62VvgkUKARnp-N3YQ_F3GfZ61PRB8KzG0fvB4pr9S7EkqmjkGWZo",
    adminLogo:
        "https://lh3.googleusercontent.com/aida-public/AB6AXuDWxQikaCsSXZLi-x9fWrEcnoOa-3IW_jeu2xtrorMBke8xsSwOHFxuag91dla-6DIn3kYt0MopMd__mHvu8-ltAvA_hs4O6e-dgydV2gJsTd4s_SQ_U9KiLIYaj2CUOn3Q8j5lXnrcBZuZO-KM3SAKiNILkCkKJL-GF_CH7j0DSueoZ4iHeW4SQk4c1V2mb4wmluUQPaO7z-Jtni-T-wedweMr_amIgk0CR80fG_54KkP_wJiaI_pDr5VdzV8yGeWpd-Mr2dQl9gU",
});

const rolePageMatchers = {
    student: ["/student-", "/quest-marketplace", "/login"],
    client: ["/client-", "/create-quest", "/applicant-selection"],
    admin: ["/admin-", "/platform-analytics"],
};

function inferPageRole(pathname = window.location.pathname) {
    if (rolePageMatchers.admin.some((value) => pathname.includes(value))) {
        return "admin";
    }
    if (rolePageMatchers.client.some((value) => pathname.includes(value))) {
        return "client";
    }
    return "student";
}

function normalizeSharedImages() {
    const role = inferPageRole();
    const avatarByRole = {
        student: sharedAssets.studentAvatar,
        client: sharedAssets.clientAvatar,
        admin: sharedAssets.adminAvatar,
    };
    const logoByRole = {
        student: sharedAssets.studentAvatar,
        client: sharedAssets.clientLogo,
        admin: sharedAssets.adminLogo,
    };

    document.querySelectorAll("img").forEach((image) => {
        const alt = image.getAttribute("alt") ?? "";

        if (alt === "User profile avatar" || alt === "Administrator profile avatar") {
            image.src = avatarByRole[role];
            return;
        }

        if (alt === "Alex Rivera Profile Picture") {
            image.src = sharedAssets.studentAvatar;
            return;
        }

        if (alt === "Student Avatar") {
            image.src = role === "client" ? sharedAssets.clientLogo : logoByRole[role];
            return;
        }

        if (alt === "Organization Logo") {
            image.src = sharedAssets.clientLogo;
            return;
        }

        if (alt === "Admin Seal") {
            image.src = sharedAssets.adminLogo;
        }
    });
}

function waitForWindowLoad() {
    if (document.readyState === "complete") {
        return Promise.resolve();
    }

    return new Promise((resolve) => {
        window.addEventListener("load", resolve, { once: true });
    });
}

function waitForFonts() {
    if (!("fonts" in document) || typeof document.fonts.ready?.then !== "function") {
        return Promise.resolve();
    }

    return document.fonts.ready.catch(() => undefined);
}

function selectTargets(selectorList) {
    return selectorList
        .split(",")
        .map((selector) => document.querySelector(selector.trim()))
        .filter(Boolean);
}

const roleRoutes = {
    student: routes.studentDashboard,
    client: routes.clientDashboard,
    administrator: routes.adminOperations,
};

function activateRoleButton(button) {
    const buttons = document.querySelectorAll("[data-role-button]");
    buttons.forEach((item) => {
        const isActive = item === button;
        item.setAttribute("aria-pressed", isActive ? "true" : "false");
        item.classList.toggle("bg-surface-container-lowest", isActive);
        item.classList.toggle("shadow-sm", isActive);
        item.classList.toggle("border", isActive);
        item.classList.toggle("border-outline-variant", isActive);
        item.classList.toggle("text-primary", isActive);
        item.classList.toggle("text-on-surface-variant", !isActive);
    });
    if (button) {
        button.focus();
        document.body.dataset.selectedRole = button.dataset.roleButton;
    }
}

function getSelectedRole() {
    return document.body.dataset.selectedRole || "student";
}

document.addEventListener("submit", (event) => {
    if (event.target.matches('[data-demo-form="login"]')) {
        event.preventDefault();
        const role = getSelectedRole();
        const targetPath = roleRoutes[role] || roleRoutes.student;
        window.location.href = targetPath;
    }
});

document.addEventListener("click", (event) => {
    const roleButton = event.target.closest("[data-role-button]");
    if (roleButton) {
        event.preventDefault();
        activateRoleButton(roleButton);
        return;
    }

    const navTarget = event.target.closest("[data-nav]");
    if (navTarget?.dataset.nav) {
        event.preventDefault();
        window.location.href = routes[navTarget.dataset.nav] || navTarget.dataset.nav;
        return;
    }

    const focusControl = event.target.closest("[data-focus-target]");
    if (focusControl) {
        document.querySelector(focusControl.dataset.focusTarget)?.focus();
    }

    const showControl = event.target.closest("[data-ui-show]");
    if (showControl) {
        selectTargets(showControl.dataset.uiShow).forEach((element) => {
            element.classList.add("active");
            element.setAttribute("aria-hidden", "false");
        });
    }

    const hideControl = event.target.closest("[data-ui-hide]");
    if (hideControl) {
        selectTargets(hideControl.dataset.uiHide).forEach((element) => {
            element.classList.remove("active");
            element.setAttribute("aria-hidden", "true");
        });
    }

    const resetPreferences = event.target.closest("[data-reset-preferences]");
    if (resetPreferences) {
        preferences = { ...defaultPreferences };
        savePreferences(preferences);
        applyPreferences(preferences);
        const appliedTheme = applyTheme("light");
        try {
            window.localStorage.setItem(THEME_STORAGE_KEY, appliedTheme);
        } catch {
            // Keep the restored theme active for this page when storage is unavailable.
        }
        syncThemeControls(appliedTheme);
        announceSettingsSaved("Preferences restored to their defaults.");
    }
});

document.addEventListener("change", (event) => {
    const themeToggle = event.target.closest("[data-theme-toggle]");
    if (themeToggle) {
        const nextTheme = themeToggle.checked ? "dark" : "light";
        const appliedTheme = applyTheme(nextTheme);

        try {
            window.localStorage.setItem(THEME_STORAGE_KEY, appliedTheme);
        } catch {
            // Ignore storage failures and continue with the in-memory theme state.
        }

        syncThemeControls(appliedTheme);
        announceSettingsSaved();
        return;
    }

    const preferenceControl = event.target.closest("[data-preference]");
    if (preferenceControl) {
        const key = preferenceControl.dataset.preference;
        preferences[key] =
            preferenceControl.type === "checkbox" ? preferenceControl.checked : preferenceControl.value;
        savePreferences(preferences);
        applyPreferences(preferences);
        announceSettingsSaved();
    }
});

normalizeSharedImages();
activateRoleButton(document.querySelector("[data-role-button][aria-pressed='true']"));
syncThemeControls();

Promise.all([waitForWindowLoad(), waitForFonts()]).finally(() => {
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            document.documentElement.classList.remove("is-loading");
            document.documentElement.classList.add("is-ready");
        });
    });
});
