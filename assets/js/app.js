export const routes = {
    login: "/pages/login.html",
    studentDashboard: "/pages/student-dashboard.html",
    studentApplications: "/pages/student-applications.html",
    studentMessages: "/pages/student-messages.html",
    studentMarketplace: "/pages/quest-marketplace.html",
    studentWorkspace: "/pages/student-quest-workspace.html",
    studentProfile: "/pages/student-profile.html",
    studentSettings: "/pages/student-settings.html",
    studentVerification: "/pages/student-verification.html",
    studentReport: "/pages/student-report.html",
    clientDashboard: "/pages/client-dashboard.html",
    clientMessages: "/pages/client-messages.html",
    clientOrganizationProfile: "/pages/client-organization-profile.html",
    clientSettings: "/pages/client-settings.html",
    clientReport: "/pages/client-report.html",
    createQuest: "/pages/create-quest.html",
    applicantSelection: "/pages/applicant-selection.html",
    clientWorkspace: "/pages/client-quest-workspace.html",
    adminOperations: "/pages/admin-operations.html",
    platformAnalytics: "/pages/platform-analytics.html",
    adminSettings: "/pages/admin-settings.html",
    accountProfile: "/pages/account-profile.html",
};

document.documentElement.classList.add("is-loading");

const THEME_STORAGE_KEY = "sidequest-theme";
const defaultPreferences = Object.freeze({
    theme: "light",
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
    return { ...defaultPreferences };
}

async function savePreferences(nextPreferences) {
    const response = await fetch("/api/v1/preferences", {
        method: "PATCH",
        credentials: "include",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify(nextPreferences),
    });
    if (!response.ok) {
        throw new Error("Preferences could not be saved.");
    }
    const result = await response.json();
    preferences = { ...defaultPreferences, ...result.preferences };
    try {
        window.localStorage.setItem(THEME_STORAGE_KEY, preferences.theme);
    } catch {
        // The server remains authoritative when local theme caching is unavailable.
    }
    return preferences;
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

function announceSettingsSaved(message = "Preferences saved to your account.") {
    const status = document.querySelector("[data-settings-status]");
    if (status) {
        status.textContent = message;
    }
}

let preferences = loadPreferences();
applyPreferences(preferences);

async function hydrateAccountPreferences() {
    const response = await fetch("/api/v1/preferences", {
        credentials: "include",
        headers: { Accept: "application/json" },
    });
    if (!response.ok) return;
    const result = await response.json();
    preferences = { ...defaultPreferences, ...result.preferences };
    applyTheme(preferences.theme);
    applyPreferences(preferences);
    syncThemeControls(preferences.theme);
    try {
        window.localStorage.setItem(THEME_STORAGE_KEY, preferences.theme);
    } catch {
        // Theme caching is optional; persisted preferences live on the account.
    }
}

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

async function verifyPageAccess(pathname = window.location.pathname) {
    if (pathname.endsWith("/login.html") || pathname === "/" || pathname.endsWith("/index.html")) {
        return;
    }

    try {
        const response = await fetch("/api/v1/auth/me", {
            credentials: "include",
            headers: { Accept: "application/json" },
        });
        if (!response.ok) {
            window.location.replace(routes.login);
            return;
        }

        const { user } = await response.json();
        const isSharedAccountPage = pathname.includes("/account-profile");
        const requiredRole = inferPageRole(pathname);
        if (!isSharedAccountPage && user.role !== requiredRole) {
            const homeByRole = {
                student: routes.studentDashboard,
                client: routes.clientDashboard,
                admin: routes.adminOperations,
            };
            window.location.replace(homeByRole[user.role] || routes.login);
        }
    } catch {
        window.location.replace(routes.login);
    }
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

function normalizeAccountNavigation() {
    const role = inferPageRole();
    document.querySelectorAll("a").forEach((link) => {
        const label = link.textContent.trim().toLowerCase();
        if (role === "client" && label === "settings") {
            link.href = routes.clientSettings;
        }
        if (role === "client" && label === "organization profile") {
            link.href = routes.clientOrganizationProfile;
        }
        if (role === "admin" && label === "platform settings") {
            link.href = routes.adminSettings;
        }
        if (role === "client" && label === "my quests") {
            link.href = `${routes.clientDashboard}#my-quests`;
        }
        if (role === "student" && label === "applications") {
            link.href = routes.studentApplications;
        }
        if (role === "student" && label === "messages") {
            link.href = routes.studentMessages;
        }
        if (role === "client" && label === "messages") {
            link.href = routes.clientMessages;
        }
    });
}

async function refreshMessageIndicators() {
    const role = inferPageRole();
    if (!["student", "client"].includes(role)) return;
    const messageRoute = role === "student" ? routes.studentMessages : routes.clientMessages;
    const response = await fetch("/api/v1/messages", {
        credentials: "include",
        headers: { Accept: "application/json" },
    });
    if (!response.ok) return;
    const inbox = await response.json();
    const unreadCount = Number(inbox.unreadCount) || 0;

    document.querySelectorAll("a").forEach((link) => {
        const labelElement = link.querySelector(".student-shell-nav-label, [data-nav-label]");
        const label = labelElement?.textContent.trim().toLowerCase();
        if (label !== "messages") return;
        link.href = messageRoute;
        link.querySelectorAll("[data-message-count], .bg-status-error").forEach((badge) => badge.remove());
        if (unreadCount > 0) {
            const badge = document.createElement("span");
            badge.dataset.messageCount = "";
            badge.className = "message-unread-count";
            badge.textContent = unreadCount > 99 ? "99+" : String(unreadCount);
            badge.setAttribute("aria-label", `${unreadCount} unread messages`);
            link.append(badge);
        }
    });

    document.querySelectorAll(".message-notification-control").forEach((control) => {
        control.querySelectorAll("[data-message-count]").forEach((badge) => badge.remove());
        if (unreadCount > 0) {
            const badge = document.createElement("span");
            badge.dataset.messageCount = "";
            badge.className = "message-notification-count";
            badge.textContent = unreadCount > 9 ? "9+" : String(unreadCount);
            control.append(badge);
        }
        control.setAttribute(
            "aria-label",
            unreadCount ? `Open messages, ${unreadCount} unread` : "Open messages",
        );
    });
}

function initializeMessageNavigation() {
    const role = inferPageRole();
    if (!["student", "client"].includes(role)) return;
    const messageRoute = role === "student" ? routes.studentMessages : routes.clientMessages;
    document.querySelectorAll(".material-symbols-outlined").forEach((icon) => {
        if (icon.textContent.trim() !== "notifications") return;
        let control = icon.closest("a, button");
        if (!control) {
            control = document.createElement("a");
            icon.replaceWith(control);
            control.append(icon);
        }
        control.classList.add("message-notification-control");
        control.querySelectorAll("span.absolute").forEach((badge) => badge.remove());
        if (control.tagName === "A") {
            control.href = messageRoute;
        } else {
            control.type = "button";
            control.addEventListener("click", () => {
                window.location.href = messageRoute;
            });
        }
    });
    refreshMessageIndicators().catch(() => {});
}

function initializeAccountMenu() {
    let avatar = document.querySelector(
        'img[alt="User profile avatar"], img[alt="Administrator profile avatar"]',
    );
    if (window.location.pathname.endsWith("/login.html")) return;

    if (!avatar) {
        const headerActions = document.querySelector("body > header > div:last-child");
        if (!headerActions) return;
        const role = inferPageRole();
        const avatarByRole = {
            student: sharedAssets.studentAvatar,
            client: sharedAssets.clientAvatar,
            admin: sharedAssets.adminAvatar,
        };
        avatar = document.createElement("img");
        avatar.alt = "User profile avatar";
        avatar.className = "student-shell-avatar border border-border-subtle";
        avatar.src = avatarByRole[role];
        headerActions.append(avatar);
    }

    avatar.dataset.accountMenuTrigger = "";
    avatar.setAttribute("role", "button");
    avatar.setAttribute("tabindex", "0");
    avatar.setAttribute("aria-haspopup", "menu");
    avatar.setAttribute("aria-expanded", "false");
    avatar.setAttribute("aria-label", "Open account menu");

    const menu = document.createElement("div");
    menu.className = "account-menu";
    menu.hidden = true;
    menu.setAttribute("role", "menu");
    menu.innerHTML = `
        <div class="account-menu-summary">
            <strong data-account-name>Loading account...</strong>
            <span data-account-email></span>
            <span class="account-menu-role" data-account-role></span>
        </div>
        <nav data-account-links aria-label="Account shortcuts"></nav>
        <button class="account-menu-item account-menu-signout" data-logout type="button" role="menuitem">
            <span class="material-symbols-outlined" aria-hidden="true">logout</span>
            Sign out
        </button>
    `;
    document.body.append(menu);

    const linksByRole = {
        student: [
            [routes.studentProfile, "account_circle", "Profile"],
            [routes.studentMessages, "forum", "Messages"],
            [routes.studentSettings, "settings", "Settings"],
            [routes.studentReport, "flag", "Report an issue"],
        ],
        client: [
            [routes.clientOrganizationProfile, "business", "Organization Profile"],
            [routes.clientMessages, "forum", "Messages"],
            [`${routes.clientDashboard}#my-quests`, "work", "My quests"],
            [routes.clientSettings, "settings", "Settings"],
            [routes.clientReport, "flag", "Report an issue"],
        ],
        admin: [
            [routes.accountProfile, "account_circle", "Profile"],
            [routes.platformAnalytics, "monitoring", "Analytics"],
            [routes.adminSettings, "settings", "Settings"],
        ],
    };

    function renderAccountLinks(role) {
        menu.querySelector("[data-account-links]").innerHTML = linksByRole[role]
            .map(([href, icon, label]) => `
                <a class="account-menu-item" href="${href}" role="menuitem">
                    <span class="material-symbols-outlined" aria-hidden="true">${icon}</span>
                    ${label}
                </a>
            `).join("");
    }

    renderAccountLinks(inferPageRole());

    function positionMenu() {
        const rect = avatar.getBoundingClientRect();
        const right = Math.max(12, window.innerWidth - rect.right);
        menu.style.top = `${rect.bottom + 10}px`;
        menu.style.right = `${right}px`;
    }

    function setOpen(open) {
        menu.hidden = !open;
        avatar.setAttribute("aria-expanded", String(open));
        if (open) {
            positionMenu();
            menu.querySelector(".account-menu-item")?.focus();
        }
    }

    avatar.addEventListener("click", (event) => {
        setOpen(true);
    });
    avatar.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setOpen(true);
        }
    });
    document.addEventListener("pointerdown", (event) => {
        if (event.target !== avatar && !menu.contains(event.target)) {
            setOpen(false);
        }
    });
    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && !menu.hidden) {
            setOpen(false);
            avatar.focus();
        }
    });
    window.addEventListener("resize", () => {
        if (!menu.hidden) positionMenu();
    });

    fetch("/api/v1/auth/me", {
        credentials: "include",
        headers: { Accept: "application/json" },
    })
        .then((response) => response.ok ? response.json() : Promise.reject())
        .then(({ user }) => {
            const avatarByRole = {
                student: sharedAssets.studentAvatar,
                client: sharedAssets.clientAvatar,
                admin: sharedAssets.adminAvatar,
            };
            avatar.src = avatarByRole[user.role];
            menu.querySelector("[data-account-name]").textContent = user.displayName;
            menu.querySelector("[data-account-email]").textContent = user.email;
            menu.querySelector("[data-account-role]").textContent =
                user.role === "admin" ? "Administrator" : user.role;

            renderAccountLinks(user.role);
        })
        .catch(() => {
            menu.querySelector("[data-account-name]").textContent = "SideQuest account";
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

function activateRoleButton(button, shouldFocus = false) {
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
        if (shouldFocus) button.focus();
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
        activateRoleButton(roleButton, true);
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
        applyPreferences(preferences);
        const appliedTheme = applyTheme("light");
        preferences.theme = appliedTheme;
        savePreferences(preferences).catch(() => announceSettingsSaved("Preferences could not be saved."));
        syncThemeControls(appliedTheme);
        announceSettingsSaved("Preferences restored to their defaults.");
    }

    const logoutControl = event.target.closest("[data-logout]");
    if (logoutControl) {
        fetch("/api/v1/auth/logout", {
            method: "POST",
            credentials: "include",
            headers: { Accept: "application/json" },
        }).finally(() => {
            window.location.href = routes.login;
        });
    }
});

document.addEventListener("change", (event) => {
    const themeToggle = event.target.closest("[data-theme-toggle]");
    if (themeToggle) {
        const nextTheme = themeToggle.checked ? "dark" : "light";
        const appliedTheme = applyTheme(nextTheme);
        preferences.theme = appliedTheme;
        savePreferences(preferences).catch(() => announceSettingsSaved("Preferences could not be saved."));
        syncThemeControls(appliedTheme);
        announceSettingsSaved();
        return;
    }

    const preferenceControl = event.target.closest("[data-preference]");
    if (preferenceControl) {
        const key = preferenceControl.dataset.preference;
        preferences[key] =
            preferenceControl.type === "checkbox" ? preferenceControl.checked : preferenceControl.value;
        savePreferences(preferences).catch(() => announceSettingsSaved("Preferences could not be saved."));
        applyPreferences(preferences);
        announceSettingsSaved();
    }
});

normalizeSharedImages();
normalizeAccountNavigation();
initializeMessageNavigation();
initializeAccountMenu();
activateRoleButton(document.querySelector("[data-role-button][aria-pressed='true']"));
syncThemeControls();
hydrateAccountPreferences().catch(() => {});

document.addEventListener("sidequest:messages-read", () => {
    refreshMessageIndicators().catch(() => {});
});

Promise.all([waitForWindowLoad(), waitForFonts(), verifyPageAccess()]).finally(() => {
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            document.documentElement.classList.remove("is-loading");
            document.documentElement.classList.add("is-ready");
        });
    });
});
