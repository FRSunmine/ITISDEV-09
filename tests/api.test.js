import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { createApp } from "../server/app.js";
import { createDatabase, DEMO_PASSWORD } from "../server/database.js";

let db;
let server;
let baseUrl;

async function request(path, { method = "GET", body, cookie } = {}) {
    const response = await fetch(`${baseUrl}${path}`, {
        method,
        headers: {
            ...(body ? { "Content-Type": "application/json" } : {}),
            ...(cookie ? { Cookie: cookie } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
    });
    const payload = response.status === 204 ? null : await response.json();
    return { response, payload };
}

async function login(email, role) {
    const result = await request("/api/v1/auth/login", {
        method: "POST",
        body: { email, password: DEMO_PASSWORD, role },
    });
    return {
        ...result,
        cookie: result.response.headers.getSetCookie()[0].split(";")[0],
    };
}

before(async () => {
    db = createDatabase(":memory:");
    const app = createApp({ db });
    await new Promise((resolve) => {
        server = app.listen(0, "127.0.0.1", resolve);
    });
    baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
    await new Promise((resolve) => server.close(resolve));
    db.close();
});

test("health endpoint reports a connected database", async () => {
    const { response, payload } = await request("/api/v1/health");
    assert.equal(response.status, 200);
    assert.deepEqual(payload, { status: "ok", database: "connected" });
});

test("seed includes realistic users and workflow states", () => {
    assert.ok(db.prepare("SELECT COUNT(*) AS count FROM users").get().count >= 8);
    assert.ok(db.prepare("SELECT COUNT(*) AS count FROM quests").get().count >= 6);
    assert.ok(db.prepare("SELECT COUNT(*) AS count FROM applications").get().count >= 4);
    assert.ok(db.prepare("SELECT COUNT(*) AS count FROM reviews").get().count >= 2);
    assert.ok(db.prepare("SELECT COUNT(*) AS count FROM portfolio_entries").get().count >= 1);
    assert.equal(
        db.prepare("SELECT verification_status FROM student_profiles WHERE user_id = (SELECT id FROM users WHERE email = ?)").get("nina.patel@dlsu.edu.ph").verification_status,
        "pending",
    );
});

test("login infers the account role when role is omitted", async () => {
    const result = await request("/api/v1/auth/login", {
        method: "POST",
        body: {
            email: "client@sidequest.demo",
            password: DEMO_PASSWORD,
        },
    });
    assert.equal(result.response.status, 200);
    assert.equal(result.payload.user.role, "client");
});

test("login creates a protected student session", async () => {
    const loginResult = await login("student@dlsu.edu.ph", "student");
    assert.equal(loginResult.response.status, 200);
    assert.equal(loginResult.payload.user.role, "student");

    const me = await request("/api/v1/auth/me", { cookie: loginResult.cookie });
    assert.equal(me.response.status, 200);
    assert.equal(me.payload.user.email, "student@dlsu.edu.ph");
});

test("main student has a matching active application, deadline, and conversation", async () => {
    const student = await login("student@dlsu.edu.ph", "student");
    const applications = await request("/api/v1/applications/me", { cookie: student.cookie });

    assert.equal(applications.response.status, 200);
    const activeApplication = applications.payload.applications.find(
        (item) => item.status === "accepted" && item.quest_status === "in_progress",
    );
    assert.ok(activeApplication);
    assert.ok(activeApplication.deadline);

    const conversations = await request("/api/v1/messages", { cookie: student.cookie });
    assert.equal(conversations.response.status, 200);
    assert.equal(conversations.payload.unreadCount, 2);
    const conversation = conversations.payload.conversations.find(
        (item) => item.quest_id === activeApplication.quest_id,
    );
    assert.ok(conversation);

    const detail = await request(`/api/v1/messages/${conversation.id}`, { cookie: student.cookie });
    assert.equal(detail.response.status, 200);
    assert.ok(detail.payload.messages.length >= 3);
    const readInbox = await request("/api/v1/messages", { cookie: student.cookie });
    assert.equal(readInbox.payload.unreadCount, 0);

    const sent = await request(`/api/v1/messages/${conversation.id}`, {
        method: "POST",
        cookie: student.cookie,
        body: { body: "I will share the revised dashboard link this afternoon." },
    });
    assert.equal(sent.response.status, 201);
    assert.equal(sent.payload.message.sender_id, student.payload.user.id);

    const client = await login("luis@sidequest.demo", "client");
    const reply = await request(`/api/v1/messages/${conversation.id}`, {
        method: "POST",
        cookie: client.cookie,
        body: { body: "Thanks, I will review it once the link is available." },
    });
    assert.equal(reply.response.status, 201);
    const unreadInbox = await request("/api/v1/messages", { cookie: student.cookie });
    assert.equal(unreadInbox.payload.unreadCount, 1);
});

test("login rejects a mismatched selected role", async () => {
    const { response, payload } = await request("/api/v1/auth/login", {
        method: "POST",
        body: {
            email: "student@dlsu.edu.ph",
            password: DEMO_PASSWORD,
            role: "client",
        },
    });
    assert.equal(response.status, 403);
    assert.equal(payload.error.code, "ROLE_MISMATCH");
});

test("student submits a persisted verification profile", async () => {
    const registration = await request("/api/v1/auth/register", {
        method: "POST",
        body: {
            email: "profile.candidate@dlsu.edu.ph",
            password: DEMO_PASSWORD,
            role: "student",
            displayName: "Profile Candidate",
        },
    });
    assert.equal(registration.response.status, 201);
    const student = await login("profile.candidate@dlsu.edu.ph", "student");

    const submission = await request("/api/v1/profile/me/verification", {
        method: "PATCH",
        cookie: student.cookie,
        body: {
            university: "De La Salle University",
            course: "BS Information Systems",
            bio: "Student product designer and frontend developer.",
            skills: ["UI/UX Design", "JavaScript", "JavaScript"],
        },
    });
    assert.equal(submission.response.status, 200);
    assert.equal(submission.payload.profile.verification_status, "pending");
    assert.deepEqual(submission.payload.skills, ["UI/UX Design", "JavaScript"]);

    const profile = await request("/api/v1/profile/me", { cookie: student.cookie });
    assert.equal(profile.payload.profile.course, "BS Information Systems");
    assert.ok(profile.payload.skills.includes("JavaScript"));
});

test("quest discovery returns enriched details and searches skills", async () => {
    const list = await request("/api/v1/quests?search=React");
    assert.equal(list.response.status, 200);
    assert.equal(list.payload.quests.length, 1);
    assert.equal(list.payload.quests[0].title, "Event Registration Website");
    assert.ok(list.payload.quests[0].skills.includes("React"));
    assert.equal(list.payload.quests[0].deliverables.length, 3);

    const details = await request(`/api/v1/quests/${list.payload.quests[0].id}`);
    assert.equal(details.response.status, 200);
    assert.equal(details.payload.quest.client_name, "Maya Santos");
    assert.equal(details.payload.quest.applicant_count, 1);
});

test("quest discovery combines skill, category, budget, deadline, and arrangement filters", async () => {
    const query = new URLSearchParams({
        skill: "Branding",
        category: "Design",
        minBudgetCents: "450000",
        maxBudgetCents: "550000",
        deadlineBefore: "2026-09-01",
        workArrangement: "hybrid",
    });
    const filtered = await request(`/api/v1/quests?${query}`);
    assert.equal(filtered.response.status, 200);
    assert.deepEqual(filtered.payload.quests.map((quest) => quest.title), ["Green Week Campaign Branding"]);

    const invalid = await request("/api/v1/quests?minBudgetCents=900000&maxBudgetCents=100000");
    assert.equal(invalid.response.status, 400);
    assert.equal(invalid.payload.error.code, "VALIDATION_ERROR");
});

test("client creates a quest and student applies once", async () => {
    const client = await login("client@sidequest.demo", "client");
    const created = await request("/api/v1/quests", {
        method: "POST",
        cookie: client.cookie,
        body: {
            title: "API Integration",
            description: "Connect the approved frontend to the SideQuest API.",
            category: "Development",
            budgetCents: 1200000,
            deadline: "2026-09-30",
            workArrangement: "remote",
            skills: ["Node.js", "API Integration"],
            deliverables: ["Quest API endpoint", "Automated API tests"],
        },
    });
    assert.equal(created.response.status, 201);
    assert.deepEqual(created.payload.quest.skills, ["API Integration", "Node.js"]);
    assert.equal(created.payload.quest.deliverables.length, 2);
    assert.equal(created.payload.quest.client_name, "Maya Santos");

    const student = await login("student@dlsu.edu.ph", "student");
    const applicationBody = {
        coverLetter: "I can implement and test this integration.",
        proposedRateCents: 1200000,
    };
    const first = await request(`/api/v1/quests/${created.payload.quest.id}/applications`, {
        method: "POST",
        cookie: student.cookie,
        body: applicationBody,
    });
    assert.equal(first.response.status, 201);

    const duplicate = await request(`/api/v1/quests/${created.payload.quest.id}/applications`, {
        method: "POST",
        cookie: student.cookie,
        body: applicationBody,
    });
    assert.equal(duplicate.response.status, 409);
    assert.equal(duplicate.payload.error.code, "ALREADY_APPLIED");

    const pendingDashboard = await request("/api/v1/applications/me", { cookie: student.cookie });
    assert.equal(pendingDashboard.response.status, 200);
    assert.equal(pendingDashboard.payload.summary.activeApplications, 1);
    const createdApplication = pendingDashboard.payload.applications.find(
        (application) => application.quest_id === created.payload.quest.id,
    );
    assert.equal(createdApplication.client_name, "Maya Santos");

    db.prepare("UPDATE applications SET status = 'accepted' WHERE id = ?").run(first.payload.application.id);
    db.prepare("UPDATE quests SET status = 'in_progress' WHERE id = ?").run(created.payload.quest.id);
    const activeDashboard = await request("/api/v1/applications/me", { cookie: student.cookie });
    assert.equal(activeDashboard.payload.summary.activeApplications, 0);
    assert.equal(activeDashboard.payload.summary.accepted, 2);
    assert.equal(activeDashboard.payload.summary.activeQuests, 2);
});

test("student cannot create a quest", async () => {
    const student = await login("student@dlsu.edu.ph", "student");
    const result = await request("/api/v1/quests", {
        method: "POST",
        cookie: student.cookie,
        body: {},
    });
    assert.equal(result.response.status, 403);
});

test("quest creation requires skills and deliverables", async () => {
    const client = await login("client@sidequest.demo", "client");
    const result = await request("/api/v1/quests", {
        method: "POST",
        cookie: client.cookie,
        body: {
            title: "Incomplete Quest",
            description: "This request intentionally omits its checklist.",
            category: "Development",
            budgetCents: 500000,
            deadline: "2026-11-01",
            workArrangement: "hybrid",
        },
    });
    assert.equal(result.response.status, 400);
    assert.match(result.payload.error.message, /skill and one deliverable/i);
});

test("client reviews applicants and accepts exactly one", async () => {
    const client = await login("client@sidequest.demo", "client");
    const created = await request("/api/v1/quests", {
        method: "POST",
        cookie: client.cookie,
        body: {
            title: "Applicant Decision Test",
            description: "Verify that a client can select one student safely.",
            category: "Development",
            budgetCents: 750000,
            deadline: "2026-12-01",
            workArrangement: "remote",
            skills: ["React"],
            deliverables: ["Tested implementation"],
        },
    });
    const student = await login("student@dlsu.edu.ph", "student");
    const first = await request(`/api/v1/quests/${created.payload.quest.id}/applications`, {
        method: "POST",
        cookie: student.cookie,
        body: { coverLetter: "I can deliver this quest." },
    });
    assert.equal(first.response.status, 201);

    const registered = await request("/api/v1/auth/register", {
        method: "POST",
        body: {
            email: "second.student@dlsu.edu.ph",
            password: DEMO_PASSWORD,
            role: "student",
            displayName: "Sam Cruz",
        },
    });
    assert.equal(registered.response.status, 201);
    db.prepare("UPDATE student_profiles SET verification_status = 'verified' WHERE user_id = ?")
        .run(registered.payload.user.id);
    db.prepare("UPDATE users SET account_status = 'active' WHERE id = ?").run(registered.payload.user.id);
    const secondStudent = await login("second.student@dlsu.edu.ph", "student");
    const second = await request(`/api/v1/quests/${created.payload.quest.id}/applications`, {
        method: "POST",
        cookie: secondStudent.cookie,
        body: { coverLetter: "I am also interested in this quest." },
    });
    assert.equal(second.response.status, 201);

    const matrix = await request(
        `/api/v1/client/applications?questId=${created.payload.quest.id}`,
        { cookie: client.cookie },
    );
    assert.equal(matrix.response.status, 200);
    assert.equal(matrix.payload.quest.title, "Applicant Decision Test");
    assert.equal(matrix.payload.applications.length, 2);

    await request("/api/v1/auth/register", {
        method: "POST",
        body: {
            email: "other.client@sidequest.demo",
            password: DEMO_PASSWORD,
            role: "client",
            displayName: "Other Client",
            organizationName: "Other Organization",
        },
    });
    const otherClient = await login("other.client@sidequest.demo", "client");
    const unauthorizedDecision = await request(
        `/api/v1/client/applications/${first.payload.application.id}`,
        {
            method: "PATCH",
            cookie: otherClient.cookie,
            body: { decision: "accepted" },
        },
    );
    assert.equal(unauthorizedDecision.response.status, 404);

    const accepted = await request(`/api/v1/client/applications/${first.payload.application.id}`, {
        method: "PATCH",
        cookie: client.cookie,
        body: { decision: "accepted" },
    });
    assert.equal(accepted.response.status, 200);
    assert.equal(accepted.payload.application.status, "accepted");
    assert.equal(db.prepare("SELECT status FROM applications WHERE id = ?").get(second.payload.application.id).status, "rejected");
    assert.equal(db.prepare("SELECT status FROM quests WHERE id = ?").get(created.payload.quest.id).status, "in_progress");

    const repeated = await request(`/api/v1/client/applications/${first.payload.application.id}`, {
        method: "PATCH",
        cookie: client.cookie,
        body: { decision: "accepted" },
    });
    assert.equal(repeated.response.status, 409);
});

test("student submits deliverables and client approves the completed quest", async () => {
    const client = await login("client@sidequest.demo", "client");
    const student = await login("student@dlsu.edu.ph", "student");
    const created = await request("/api/v1/quests", {
        method: "POST",
        cookie: client.cookie,
        body: {
            title: "Workspace Workflow Test",
            description: "Exercise the active quest workspace lifecycle.",
            category: "Development",
            budgetCents: 900000,
            deadline: "2026-12-15",
            workArrangement: "hybrid",
            skills: ["React"],
            deliverables: ["Working interface", "Technical documentation"],
        },
    });
    const application = await request(`/api/v1/quests/${created.payload.quest.id}/applications`, {
        method: "POST",
        cookie: student.cookie,
        body: { coverLetter: "I will complete both deliverables." },
    });
    await request(`/api/v1/client/applications/${application.payload.application.id}`, {
        method: "PATCH",
        cookie: client.cookie,
        body: { decision: "accepted" },
    });

    const studentWorkspace = await request(
        `/api/v1/workspace?questId=${created.payload.quest.id}`,
        { cookie: student.cookie },
    );
    assert.equal(studentWorkspace.response.status, 200);
    assert.equal(studentWorkspace.payload.quest.student_name, "Alex Rivera");
    assert.equal(studentWorkspace.payload.deliverables.length, 2);

    const [firstDeliverable, secondDeliverable] = studentWorkspace.payload.deliverables;
    const clientCannotSubmit = await request(
        `/api/v1/workspace/deliverables/${firstDeliverable.id}/submit`,
        {
            method: "PATCH",
            cookie: client.cookie,
            body: { note: "Clients cannot submit student work." },
        },
    );
    assert.equal(clientCannotSubmit.response.status, 403);
    const firstSubmission = await request(
        `/api/v1/workspace/deliverables/${firstDeliverable.id}/submit`,
        {
            method: "PATCH",
            cookie: student.cookie,
            body: { note: "Interface implementation is ready for review." },
        },
    );
    assert.equal(firstSubmission.payload.deliverable.submission_status, "submitted");
    await request(`/api/v1/workspace/deliverables/${secondDeliverable.id}/submit`, {
        method: "PATCH",
        cookie: student.cookie,
        body: { note: "Documentation draft is attached externally." },
    });
    assert.equal(db.prepare("SELECT status FROM quests WHERE id = ?").get(created.payload.quest.id).status, "submitted");

    const studentCannotApprove = await request(
        `/api/v1/workspace/deliverables/${firstDeliverable.id}/review`,
        {
            method: "PATCH",
            cookie: student.cookie,
            body: { decision: "approved" },
        },
    );
    assert.equal(studentCannotApprove.response.status, 403);
    const firstApproval = await request(
        `/api/v1/workspace/deliverables/${firstDeliverable.id}/review`,
        {
            method: "PATCH",
            cookie: client.cookie,
            body: { decision: "approved" },
        },
    );
    assert.equal(firstApproval.payload.deliverable.is_complete, 1);
    const revision = await request(
        `/api/v1/workspace/deliverables/${secondDeliverable.id}/review`,
        {
            method: "PATCH",
            cookie: client.cookie,
            body: { decision: "revision_requested" },
        },
    );
    assert.equal(revision.payload.deliverable.submission_status, "revision_requested");

    await request(`/api/v1/workspace/deliverables/${secondDeliverable.id}/submit`, {
        method: "PATCH",
        cookie: student.cookie,
        body: { note: "Documentation revised as requested." },
    });
    await request(`/api/v1/workspace/deliverables/${secondDeliverable.id}/review`, {
        method: "PATCH",
        cookie: client.cookie,
        body: { decision: "approved" },
    });
    const completed = await request(`/api/v1/workspace/quests/${created.payload.quest.id}/complete`, {
        method: "POST",
        cookie: client.cookie,
    });
    assert.equal(completed.response.status, 200);
    assert.equal(completed.payload.quest.status, "completed");
    const portfolioEntry = db.prepare(
        "SELECT * FROM portfolio_entries WHERE quest_id = ?",
    ).get(created.payload.quest.id);
    assert.equal(portfolioEntry.student_id, student.payload.user.id);
    assert.equal(portfolioEntry.title, "Workspace Workflow Test");

    const clientReview = await request(
        `/api/v1/workspace/quests/${created.payload.quest.id}/reviews`,
        {
            method: "POST",
            cookie: client.cookie,
            body: { rating: 5, comment: "Excellent delivery and revision turnaround." },
        },
    );
    assert.equal(clientReview.response.status, 201);
    assert.equal(clientReview.payload.review.reviewee_id, student.payload.user.id);

    const studentReview = await request(
        `/api/v1/workspace/quests/${created.payload.quest.id}/reviews`,
        {
            method: "POST",
            cookie: student.cookie,
            body: { rating: 4, comment: "Clear scope and responsive feedback." },
        },
    );
    assert.equal(studentReview.response.status, 201);
    assert.equal(studentReview.payload.review.reviewee_id, client.payload.user.id);

    const duplicateReview = await request(
        `/api/v1/workspace/quests/${created.payload.quest.id}/reviews`,
        {
            method: "POST",
            cookie: client.cookie,
            body: { rating: 5 },
        },
    );
    assert.equal(duplicateReview.response.status, 409);

    const profile = await request("/api/v1/profile/me", { cookie: student.cookie });
    assert.equal(profile.response.status, 200);
    assert.ok(profile.payload.portfolio.some((item) => item.quest_id === created.payload.quest.id));
    assert.ok(profile.payload.reviews.some((review) => review.quest_title === "Workspace Workflow Test"));
    assert.equal(profile.payload.summary.rating, 5);
});

test("administrator moderates accounts and reads persisted analytics", async () => {
    const candidate = await request("/api/v1/auth/register", {
        method: "POST",
        body: {
            email: "verification.candidate@dlsu.edu.ph",
            password: DEMO_PASSWORD,
            role: "student",
            displayName: "Verification Candidate",
        },
    });
    assert.equal(candidate.response.status, 201);

    const student = await login("student@dlsu.edu.ph", "student");
    const forbidden = await request("/api/v1/admin/operations", { cookie: student.cookie });
    assert.equal(forbidden.response.status, 403);

    const admin = await login("admin@sidequest.demo", "admin");
    const operations = await request("/api/v1/admin/operations", { cookie: admin.cookie });
    assert.equal(operations.response.status, 200);
    assert.ok(operations.payload.pendingStudents.some((item) => item.id === candidate.payload.user.id));
    assert.ok(Number.isInteger(operations.payload.summary.openQuests));

    const verification = await request(
        `/api/v1/admin/students/${candidate.payload.user.id}/verification`,
        {
            method: "PATCH",
            cookie: admin.cookie,
            body: { decision: "verified" },
        },
    );
    assert.equal(verification.response.status, 200);
    assert.equal(db.prepare("SELECT verification_status FROM student_profiles WHERE user_id = ?").get(candidate.payload.user.id).verification_status, "verified");

    const suspended = await request(`/api/v1/admin/users/${candidate.payload.user.id}/status`, {
        method: "PATCH",
        cookie: admin.cookie,
        body: { status: "suspended" },
    });
    assert.equal(suspended.payload.user.account_status, "suspended");
    const blockedLogin = await request("/api/v1/auth/login", {
        method: "POST",
        body: {
            email: "verification.candidate@dlsu.edu.ph",
            password: DEMO_PASSWORD,
            role: "student",
        },
    });
    assert.equal(blockedLogin.response.status, 403);
    assert.equal(blockedLogin.payload.error.code, "ACCOUNT_SUSPENDED");

    const analytics = await request("/api/v1/admin/analytics", { cookie: admin.cookie });
    assert.equal(analytics.response.status, 200);
    assert.ok(analytics.payload.totals.users >= 4);
    assert.ok(analytics.payload.questStatuses.some((item) => item.status === "completed"));
    assert.ok(Array.isArray(analytics.payload.skillGaps));
});

test("client dashboard is persisted and pending students cannot apply", async () => {
    const client = await login("client@sidequest.demo", "client");
    const dashboard = await request("/api/v1/client/dashboard", { cookie: client.cookie });
    assert.equal(dashboard.response.status, 200);
    assert.equal(dashboard.payload.client.organization_name, "DLSU Student Council");
    assert.equal(dashboard.payload.quests.length, db.prepare(
        "SELECT COUNT(*) AS count FROM quests WHERE client_id = (SELECT id FROM users WHERE email = 'client@sidequest.demo')",
    ).get().count);

    const registration = await request("/api/v1/auth/register", {
        method: "POST",
        body: {
            email: "pending.freelancer@dlsu.edu.ph",
            password: DEMO_PASSWORD,
            role: "student",
            displayName: "Pending Freelancer",
        },
    });
    const pending = await login("pending.freelancer@dlsu.edu.ph", "student");
    const openQuest = db.prepare("SELECT id FROM quests WHERE status = 'open' LIMIT 1").get();
    const application = await request(`/api/v1/quests/${openQuest.id}/applications`, {
        method: "POST",
        cookie: pending.cookie,
        body: { coverLetter: "This should wait for verification." },
    });
    assert.equal(registration.response.status, 201);
    assert.equal(application.response.status, 403);
    assert.equal(application.payload.error.code, "VERIFICATION_REQUIRED");
});

test("client can read and update a separate organization profile", async () => {
    const client = await login("client@sidequest.demo", "client");
    const initial = await request("/api/v1/client/profile", { cookie: client.cookie });
    assert.equal(initial.response.status, 200);
    assert.equal(initial.payload.profile.organization_name, "DLSU Student Council");

    const updated = await request("/api/v1/client/profile", {
        method: "PATCH",
        cookie: client.cookie,
        body: {
            organizationName: "DLSU Student Council Office",
            organizationType: "University media organization",
        },
    });
    assert.equal(updated.response.status, 200);
    assert.equal(updated.payload.profile.organization_name, "DLSU Student Council Office");
});

test("preferences persist per account instead of per device", async () => {
    const student = await login("student@dlsu.edu.ph", "student");
    const saved = await request("/api/v1/preferences", {
        method: "PATCH",
        cookie: student.cookie,
        body: {
            theme: "dark",
            applicationUpdates: true,
            messageNotifications: false,
            questRecommendations: true,
            profileVisibility: "campus",
            reduceMotion: true,
        },
    });
    assert.equal(saved.response.status, 200);
    assert.equal(saved.payload.preferences.theme, "dark");
    assert.equal(saved.payload.preferences.reduceMotion, true);

    const client = await login("client@sidequest.demo", "client");
    const clientPreferences = await request("/api/v1/preferences", { cookie: client.cookie });
    assert.equal(clientPreferences.response.status, 200);
    assert.equal(clientPreferences.payload.preferences.theme, "light");
    assert.equal(clientPreferences.payload.preferences.messageNotifications, true);
});

test("users submit reports and administrators resolve them", async () => {
    const student = await login("student@dlsu.edu.ph", "student");
    const submitted = await request("/api/v1/reports", {
        method: "POST",
        cookie: student.cookie,
        body: {
            subject: "Quest scope changed after acceptance",
            category: "quest_content",
            description: "The requested deliverables no longer match the accepted quest scope.",
        },
    });
    assert.equal(submitted.response.status, 201);

    const admin = await login("admin@sidequest.demo", "admin");
    const operations = await request("/api/v1/admin/operations", { cookie: admin.cookie });
    assert.ok(operations.payload.reports.some((report) => report.id === submitted.payload.report.id));

    const resolved = await request(`/api/v1/admin/reports/${submitted.payload.report.id}`, {
        method: "PATCH",
        cookie: admin.cookie,
        body: { status: "resolved", adminNotes: "The client was asked to restore the accepted scope." },
    });
    assert.equal(resolved.response.status, 200);

    const history = await request("/api/v1/reports/me", { cookie: student.cookie });
    const report = history.payload.reports.find((item) => item.id === submitted.payload.report.id);
    assert.equal(report.status, "resolved");
    assert.match(report.admin_notes, /restore the accepted scope/);
});
