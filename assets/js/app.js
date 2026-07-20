function selectTargets(selectorList) {
    return selectorList
        .split(",")
        .map((selector) => document.querySelector(selector.trim()))
        .filter(Boolean);
}

document.addEventListener("submit", (event) => {
    if (event.target.matches('[data-demo-form="login"]')) {
        event.preventDefault();
    }
});

document.addEventListener("click", (event) => {
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
