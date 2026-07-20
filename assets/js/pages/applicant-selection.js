const drawer = document.getElementById("detailDrawer");
const modal = document.getElementById("selectionModal");

function openDrawer() {
    drawer?.classList.remove("translate-x-full");
    drawer?.classList.add("translate-x-0");
    drawer?.setAttribute("aria-hidden", "false");
}

function closeDrawer() {
    drawer?.classList.add("translate-x-full");
    drawer?.classList.remove("translate-x-0");
    drawer?.setAttribute("aria-hidden", "true");
}

function openModal() {
    modal?.classList.remove("hidden");
    modal?.classList.add("flex");
    modal?.setAttribute("aria-hidden", "false");
}

function closeModal() {
    modal?.classList.add("hidden");
    modal?.classList.remove("flex");
    modal?.setAttribute("aria-hidden", "true");
}

document.addEventListener("click", (event) => {
    const control = event.target.closest("[data-applicant-action]");
    if (!control) return;

    const actions = {
        "open-drawer": openDrawer,
        "close-drawer": closeDrawer,
        "open-modal": openModal,
        "close-modal": closeModal,
        "confirm-assignment": () => {
            globalThis.alert("Assignment confirmed (simulated). API integration pending.");
            closeModal();
        },
    };

    actions[control.dataset.applicantAction]?.();
});
