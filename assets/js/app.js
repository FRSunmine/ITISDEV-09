function selectTargets(selectorList) {
    return selectorList
        .split(",")
        .map((selector) => document.querySelector(selector.trim()))
        .filter(Boolean);
}

const roleRoutes = {
    student: "/pages/student-dashboard.html",
    client: "/pages/client-dashboard.html",
    administrator: "/pages/admin-operations.html",
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
});

activateRoleButton(document.querySelector("[data-role-button][aria-pressed='true']"));
