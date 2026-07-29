const form = document.querySelector("#verification-form");
const fullName = document.querySelector("#full_name");
const email = document.querySelector("#uni_email");
const university = document.querySelector("#university");
const course = document.querySelector("#degree");
const bio = document.querySelector("#bio");
const skillInput = document.querySelector("#skill_input");
const skillList = document.querySelector("[data-skill-list]");
const status = document.querySelector("[data-verification-status]");
const description = document.querySelector("[data-verification-description]");
const message = document.querySelector("[data-verification-message]");
const submit = document.querySelector("[data-verification-submit]");
const bioCount = document.querySelector("[data-bio-count]");
let skills = [];

function setMessage(text, isError = false) {
    message.textContent = text;
    message.classList.toggle("text-error", isError);
    message.classList.toggle("text-status-success", !isError && Boolean(text));
}

function renderSkills() {
    skillList.querySelectorAll("[data-skill]").forEach((element) => element.remove());
    skills.forEach((skill, index) => {
        const tag = document.createElement("span");
        tag.dataset.skill = "";
        tag.className = "inline-flex items-center gap-1 px-3 py-1 rounded-full bg-primary-container text-on-primary-container font-label-sm text-label-sm border border-primary-container/20";
        tag.append(document.createTextNode(skill));

        const remove = document.createElement("button");
        remove.type = "button";
        remove.className = "hover:text-error transition-colors";
        remove.setAttribute("aria-label", `Remove ${skill}`);
        remove.innerHTML = '<span class="material-symbols-outlined text-[14px]">close</span>';
        remove.addEventListener("click", () => {
            skills.splice(index, 1);
            renderSkills();
        });
        tag.append(remove);
        skillList.insertBefore(tag, skillInput);
    });
}

function addSkill() {
    const skill = skillInput.value.trim();
    if (!skill) return;
    if (skills.length >= 10) {
        setMessage("You can add up to 10 skills.", true);
        return;
    }
    if (!skills.some((item) => item.toLowerCase() === skill.toLowerCase())) skills.push(skill);
    skillInput.value = "";
    renderSkills();
}

skillInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === ",") {
        event.preventDefault();
        addSkill();
    }
});

bio.addEventListener("input", () => {
    bioCount.textContent = `${bio.value.length}/300 chars`;
});

fetch("/api/v1/profile/me", {
    credentials: "include",
    headers: { Accept: "application/json" },
})
    .then(async (response) => {
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error?.message || "Profile could not be loaded.");
        return result;
    })
    .then((data) => {
        fullName.value = data.profile.display_name;
        email.value = data.profile.email;
        university.value = data.profile.university === "Pending confirmation" ? "" : data.profile.university;
        course.value = data.profile.course || "";
        bio.value = data.profile.bio || "";
        bioCount.textContent = `${bio.value.length}/300 chars`;
        skills = [...data.skills];
        renderSkills();

        const label = data.profile.verification_status === "verified" ? "Verified" : "Pending Review";
        status.textContent = label;
        description.textContent = data.profile.verification_status === "verified"
            ? "Your student profile is verified. You can update these public details without losing verification."
            : "Complete your academic profile and submit it for administrator review.";
        submit.querySelector("span").textContent = data.profile.verification_status === "verified"
            ? "Save Profile"
            : "Submit for Verification";
    })
    .catch((error) => {
        setMessage(error.message, true);
        submit.disabled = true;
    });

form.addEventListener("submit", async (event) => {
    event.preventDefault();
    addSkill();
    setMessage("");
    submit.disabled = true;

    try {
        const response = await fetch("/api/v1/profile/me/verification", {
            method: "PATCH",
            credentials: "include",
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            body: JSON.stringify({
                university: university.value,
                course: course.value,
                bio: bio.value,
                skills,
            }),
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error?.message || "Profile could not be submitted.");
        status.textContent = result.profile.verification_status === "verified" ? "Verified" : "Pending Review";
        setMessage(result.profile.verification_status === "verified"
            ? "Profile saved."
            : "Verification profile submitted for administrator review.");
    } catch (error) {
        setMessage(error.message, true);
    } finally {
        submit.disabled = false;
    }
});
