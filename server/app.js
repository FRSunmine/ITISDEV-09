import express from "express";
import { resolve } from "node:path";
import {
    clearSessionCookie,
    createSessionToken,
    hashPassword,
    hashSessionToken,
    parseCookies,
    sessionCookie,
    verifyPassword,
} from "./auth.js";

const EIGHT_HOURS = 60 * 60 * 8;
const THIRTY_DAYS = 60 * 60 * 24 * 30;
const STUDENT_EMAIL = /@(?:[a-z0-9-]+\.)*edu(?:\.ph)?$/i;

function publicUser(user) {
    return {
        id: user.id,
        email: user.email,
        role: user.role,
        displayName: user.display_name,
        accountStatus: user.account_status,
    };
}

function validationError(res, message) {
    return res.status(400).json({ error: { code: "VALIDATION_ERROR", message } });
}

export function createApp({ db, serveStatic = false, production = false } = {}) {
    if (!db) throw new Error("createApp requires a database.");

    const app = express();
    app.disable("x-powered-by");
    app.use(express.json({ limit: "1mb" }));
    app.use((req, res, next) => {
        res.setHeader("X-Content-Type-Options", "nosniff");
        res.setHeader("Referrer-Policy", "same-origin");
        next();
    });

    function currentUser(req) {
        const token = parseCookies(req.headers.cookie).sidequest_session;
        if (!token) return null;

        return db.prepare(`
            SELECT users.*
            FROM sessions
            JOIN users ON users.id = sessions.user_id
            WHERE sessions.token_hash = ? AND sessions.expires_at > CURRENT_TIMESTAMP
        `).get(hashSessionToken(token)) ?? null;
    }

    function requireUser(roles = []) {
        return (req, res, next) => {
            const user = currentUser(req);
            if (!user) {
                return res.status(401).json({ error: { code: "UNAUTHENTICATED", message: "Sign in required." } });
            }
            if (user.account_status === "suspended") {
                return res.status(403).json({ error: { code: "ACCOUNT_SUSPENDED", message: "This account is suspended." } });
            }
            if (roles.length && !roles.includes(user.role)) {
                return res.status(403).json({ error: { code: "FORBIDDEN", message: "Insufficient permissions." } });
            }
            req.user = user;
            next();
        };
    }

    app.get("/api/v1/health", (_req, res) => {
        res.json({ status: "ok", database: "connected" });
    });

    app.post("/api/v1/auth/register", (req, res) => {
        const { email, password, role, displayName, organizationName } = req.body ?? {};
        if (!email || !password || !displayName || !["student", "client"].includes(role)) {
            return validationError(res, "Email, password, display name, and a valid role are required.");
        }
        if (password.length < 10) return validationError(res, "Password must contain at least 10 characters.");
        if (role === "student" && !STUDENT_EMAIL.test(email)) {
            return validationError(res, "Students must register with a university email address.");
        }
        if (role === "client" && !organizationName) {
            return validationError(res, "Clients must provide an organization name.");
        }

        db.exec("BEGIN");
        try {
            const result = db.prepare(`
                INSERT INTO users (email, password_hash, role, display_name, account_status)
                VALUES (?, ?, ?, ?, ?)
            `).run(
                email.trim().toLowerCase(),
                hashPassword(password),
                role,
                displayName.trim(),
                role === "student" ? "pending" : "active",
            );
            const userId = Number(result.lastInsertRowid);
            if (role === "student") {
                db.prepare(`
                    INSERT INTO student_profiles (user_id, university, verification_status)
                    VALUES (?, 'Pending confirmation', 'pending')
                `).run(userId);
            } else {
                db.prepare(`
                    INSERT INTO client_profiles (user_id, organization_name)
                    VALUES (?, ?)
                `).run(userId, organizationName.trim());
            }
            db.exec("COMMIT");
            const user = db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
            res.status(201).json({ user: publicUser(user) });
        } catch (error) {
            db.exec("ROLLBACK");
            if (String(error.message).includes("UNIQUE constraint failed")) {
                return res.status(409).json({ error: { code: "EMAIL_EXISTS", message: "Email is already registered." } });
            }
            throw error;
        }
    });

    app.post("/api/v1/auth/login", (req, res) => {
        const { email, password, role, remember = false } = req.body ?? {};
        if (!email || !password) return validationError(res, "Email and password are required.");

        const user = db.prepare("SELECT * FROM users WHERE email = ? COLLATE NOCASE").get(email.trim());
        if (!user || !verifyPassword(password, user.password_hash)) {
            return res.status(401).json({ error: { code: "INVALID_CREDENTIALS", message: "Invalid email or password." } });
        }
        if (user.account_status === "suspended") {
            return res.status(403).json({ error: { code: "ACCOUNT_SUSPENDED", message: "This account is suspended." } });
        }
        if (role && user.role !== role) {
            return res.status(403).json({ error: { code: "ROLE_MISMATCH", message: "This account does not use the selected role." } });
        }

        const token = createSessionToken();
        const maxAgeSeconds = remember ? THIRTY_DAYS : EIGHT_HOURS;
        const expiresAt = new Date(Date.now() + maxAgeSeconds * 1000)
            .toISOString()
            .slice(0, 19)
            .replace("T", " ");
        db.prepare(`
            INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)
        `).run(hashSessionToken(token), user.id, expiresAt);
        res.setHeader("Set-Cookie", sessionCookie(token, { maxAgeSeconds, secure: production }));
        res.json({ user: publicUser(user) });
    });

    app.post("/api/v1/auth/logout", (req, res) => {
        const token = parseCookies(req.headers.cookie).sidequest_session;
        if (token) db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(hashSessionToken(token));
        res.setHeader("Set-Cookie", clearSessionCookie({ secure: production }));
        res.status(204).end();
    });

    app.get("/api/v1/auth/me", requireUser(), (req, res) => {
        res.json({ user: publicUser(req.user) });
    });

    function hydrateQuest(quest) {
        const skills = db.prepare(`
            SELECT skills.name
            FROM quest_skills JOIN skills ON skills.id = quest_skills.skill_id
            WHERE quest_skills.quest_id = ?
            ORDER BY skills.name
        `).all(quest.id).map((skill) => skill.name);
        const deliverables = db.prepare(`
            SELECT id, title, is_complete
            FROM deliverables
            WHERE quest_id = ?
            ORDER BY id
        `).all(quest.id);
        const applicantCount = db.prepare(`
            SELECT COUNT(*) AS count FROM applications
            WHERE quest_id = ? AND status = 'pending'
        `).get(quest.id).count;
        return { ...quest, skills, deliverables, applicant_count: applicantCount };
    }

    app.get("/api/v1/quests", (req, res) => {
        const search = String(req.query.search ?? "").trim();
        const skill = String(req.query.skill ?? "").trim();
        const category = String(req.query.category ?? "").trim();
        const workArrangement = String(req.query.workArrangement ?? "").trim().toLowerCase();
        const deadlineBefore = String(req.query.deadlineBefore ?? "").trim();
        const parseBudget = (value) => {
            if (value === undefined || value === "") return null;
            const parsed = Number(value);
            return Number.isInteger(parsed) && parsed >= 0 ? parsed : Number.NaN;
        };
        const minBudgetCents = parseBudget(req.query.minBudgetCents);
        const maxBudgetCents = parseBudget(req.query.maxBudgetCents);
        const parsedDeadline = new Date(`${deadlineBefore}T00:00:00Z`);
        const validDate = !deadlineBefore || (
            /^\d{4}-\d{2}-\d{2}$/.test(deadlineBefore)
            && !Number.isNaN(parsedDeadline.getTime())
            && parsedDeadline.toISOString().slice(0, 10) === deadlineBefore
        );

        if (search.length > 120 || skill.length > 80 || category.length > 80) {
            return validationError(res, "Quest filters are too long.");
        }
        if (workArrangement && !["remote", "hybrid", "onsite"].includes(workArrangement)) {
            return validationError(res, "Select a valid work arrangement.");
        }
        if (Number.isNaN(minBudgetCents) || Number.isNaN(maxBudgetCents)) {
            return validationError(res, "Budget filters must be non-negative integers in cents.");
        }
        if (minBudgetCents !== null && maxBudgetCents !== null && minBudgetCents > maxBudgetCents) {
            return validationError(res, "Minimum budget cannot exceed maximum budget.");
        }
        if (!validDate) return validationError(res, "Deadline filter must be a valid date.");

        const pattern = `%${search}%`;
        const skillPattern = `%${skill}%`;
        const quests = db.prepare(`
            SELECT quests.*, users.display_name AS client_name
            FROM quests
            JOIN users ON users.id = quests.client_id
            WHERE quests.status = 'open'
              AND (
                  ? = ''
                  OR quests.title LIKE ?
                  OR quests.description LIKE ?
                  OR quests.category LIKE ?
                  OR users.display_name LIKE ?
                  OR EXISTS (
                      SELECT 1 FROM quest_skills
                      JOIN skills ON skills.id = quest_skills.skill_id
                      WHERE quest_skills.quest_id = quests.id AND skills.name LIKE ?
                  )
              )
              AND (? = '' OR quests.category = ? COLLATE NOCASE)
              AND (? = '' OR quests.work_arrangement = ?)
              AND (? IS NULL OR quests.budget_cents >= ?)
              AND (? IS NULL OR quests.budget_cents <= ?)
              AND (? = '' OR quests.deadline <= ?)
              AND (
                  ? = ''
                  OR EXISTS (
                      SELECT 1 FROM quest_skills
                      JOIN skills ON skills.id = quest_skills.skill_id
                      WHERE quest_skills.quest_id = quests.id AND skills.name LIKE ?
                  )
              )
            ORDER BY quests.created_at DESC
        `).all(
            search,
            pattern,
            pattern,
            pattern,
            pattern,
            pattern,
            category,
            category,
            workArrangement,
            workArrangement,
            minBudgetCents,
            minBudgetCents,
            maxBudgetCents,
            maxBudgetCents,
            deadlineBefore,
            deadlineBefore,
            skill,
            skillPattern,
        );
        res.json({ quests: quests.map(hydrateQuest) });
    });

    app.get("/api/v1/quests/:id", (req, res) => {
        const quest = db.prepare(`
            SELECT quests.*, users.display_name AS client_name
            FROM quests JOIN users ON users.id = quests.client_id
            WHERE quests.id = ?
        `).get(req.params.id);
        if (!quest) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Quest not found." } });
        res.json({ quest: hydrateQuest(quest) });
    });

    app.post("/api/v1/quests", requireUser(["client", "admin"]), (req, res) => {
        const {
            title,
            description,
            category,
            budgetCents,
            deadline,
            workArrangement,
            skills,
            deliverables,
        } = req.body ?? {};
        const requiredText = [title, description, category, deadline];
        if (
            requiredText.some((value) => typeof value !== "string" || !value.trim())
            || !["remote", "hybrid", "onsite"].includes(workArrangement)
        ) {
            return validationError(res, "Complete quest details are required.");
        }
        if (!Number.isInteger(budgetCents) || budgetCents < 0) {
            return validationError(res, "Budget must be a non-negative integer in cents.");
        }
        const normalizedSkills = Array.isArray(skills)
            ? [...new Set(skills.map((skill) => String(skill).trim()).filter(Boolean))]
            : [];
        const normalizedDeliverables = Array.isArray(deliverables)
            ? deliverables.map((item) => String(item).trim()).filter(Boolean)
            : [];
        if (normalizedSkills.length === 0 || normalizedDeliverables.length === 0) {
            return validationError(res, "Add at least one skill and one deliverable.");
        }
        if (normalizedSkills.length > 10 || normalizedDeliverables.length > 20) {
            return validationError(res, "Use at most 10 skills and 20 deliverables.");
        }

        let questId;
        try {
            db.exec("BEGIN");
            const result = db.prepare(`
                INSERT INTO quests
                    (client_id, title, description, category, budget_cents, deadline, work_arrangement)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `).run(
                req.user.id,
                title.trim(),
                description.trim(),
                category.trim(),
                budgetCents,
                deadline,
                workArrangement,
            );
            questId = result.lastInsertRowid;

            const addSkill = db.prepare("INSERT OR IGNORE INTO skills (name) VALUES (?)");
            const findSkill = db.prepare("SELECT id FROM skills WHERE name = ? COLLATE NOCASE");
            const addQuestSkill = db.prepare(
                "INSERT OR IGNORE INTO quest_skills (quest_id, skill_id) VALUES (?, ?)",
            );
            for (const skillName of normalizedSkills) {
                addSkill.run(skillName);
                addQuestSkill.run(questId, findSkill.get(skillName).id);
            }

            const addDeliverable = db.prepare(
                "INSERT INTO deliverables (quest_id, title) VALUES (?, ?)",
            );
            for (const deliverable of normalizedDeliverables) {
                addDeliverable.run(questId, deliverable);
            }
            db.exec("COMMIT");
        } catch (error) {
            db.exec("ROLLBACK");
            throw error;
        }

        const quest = db.prepare(`
            SELECT quests.*, users.display_name AS client_name
            FROM quests JOIN users ON users.id = quests.client_id
            WHERE quests.id = ?
        `).get(questId);
        res.status(201).json({ quest: hydrateQuest(quest) });
    });

    app.post("/api/v1/quests/:id/applications", requireUser(["student"]), (req, res) => {
        const { coverLetter, proposedRateCents } = req.body ?? {};
        if (!coverLetter?.trim()) return validationError(res, "A cover letter is required.");
        const verification = db.prepare(`
            SELECT verification_status FROM student_profiles WHERE user_id = ?
        `).get(req.user.id);
        if (verification?.verification_status !== "verified") {
            return res.status(403).json({
                error: { code: "VERIFICATION_REQUIRED", message: "Student verification is required before applying." },
            });
        }
        const quest = db.prepare("SELECT id FROM quests WHERE id = ? AND status = 'open'").get(req.params.id);
        if (!quest) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Open quest not found." } });
        try {
            const result = db.prepare(`
                INSERT INTO applications (quest_id, student_id, cover_letter, proposed_rate_cents)
                VALUES (?, ?, ?, ?)
            `).run(quest.id, req.user.id, coverLetter.trim(), proposedRateCents ?? null);
            const application = db.prepare("SELECT * FROM applications WHERE id = ?").get(result.lastInsertRowid);
            res.status(201).json({ application });
        } catch (error) {
            if (String(error.message).includes("UNIQUE constraint failed")) {
                return res.status(409).json({ error: { code: "ALREADY_APPLIED", message: "You already applied to this quest." } });
            }
            throw error;
        }
    });

    function talentSummary(student) {
        const skills = db.prepare(`
            SELECT skills.name FROM user_skills
            JOIN skills ON skills.id = user_skills.skill_id
            WHERE user_skills.user_id = ? ORDER BY skills.name
        `).all(student.id).map((item) => item.name);
        return { ...student, skills };
    }

    app.get("/api/v1/freelancers", requireUser(["client"]), (req, res) => {
        const search = String(req.query.search ?? "").trim();
        const skill = String(req.query.skill ?? "").trim();
        const availability = String(req.query.availability ?? "").trim();
        const minRating = req.query.minRating === undefined || req.query.minRating === ""
            ? 0 : Number(req.query.minRating);
        const minCompleted = req.query.minCompleted === undefined || req.query.minCompleted === ""
            ? 0 : Number(req.query.minCompleted);
        if (search.length > 120 || skill.length > 80) return validationError(res, "Talent filters are too long.");
        if (availability && !["available", "limited", "unavailable"].includes(availability)) {
            return validationError(res, "Select a valid availability.");
        }
        if (!Number.isFinite(minRating) || minRating < 0 || minRating > 5) {
            return validationError(res, "Minimum rating must be between 0 and 5.");
        }
        if (!Number.isInteger(minCompleted) || minCompleted < 0) {
            return validationError(res, "Minimum experience must be a non-negative integer.");
        }
        const pattern = `%${search}%`;
        const skillPattern = `%${skill}%`;
        const freelancers = db.prepare(`
            SELECT users.id, users.display_name, student_profiles.university, student_profiles.course,
                   student_profiles.bio, student_profiles.availability_status,
                   COALESCE((SELECT ROUND(AVG(rating), 1) FROM reviews WHERE reviewee_id = users.id), 0) AS rating,
                   (SELECT COUNT(*) FROM portfolio_entries WHERE student_id = users.id) AS completed_quests
            FROM users
            JOIN student_profiles ON student_profiles.user_id = users.id
            LEFT JOIN user_preferences ON user_preferences.user_id = users.id
            WHERE users.role = 'student' AND users.account_status = 'active'
              AND student_profiles.verification_status = 'verified'
              AND COALESCE(user_preferences.profile_visibility, 'campus') != 'private'
              AND (? = '' OR student_profiles.availability_status = ?)
              AND (
                  ? = '' OR users.display_name LIKE ? OR student_profiles.course LIKE ?
                  OR student_profiles.bio LIKE ? OR student_profiles.university LIKE ?
                  OR EXISTS (
                      SELECT 1 FROM user_skills JOIN skills ON skills.id = user_skills.skill_id
                      WHERE user_skills.user_id = users.id AND skills.name LIKE ?
                  )
              )
              AND (
                  ? = '' OR EXISTS (
                      SELECT 1 FROM user_skills JOIN skills ON skills.id = user_skills.skill_id
                      WHERE user_skills.user_id = users.id AND skills.name LIKE ?
                  )
              )
              AND COALESCE((SELECT AVG(rating) FROM reviews WHERE reviewee_id = users.id), 0) >= ?
              AND (SELECT COUNT(*) FROM portfolio_entries WHERE student_id = users.id) >= ?
            ORDER BY rating DESC, completed_quests DESC, users.display_name
        `).all(
            availability, availability,
            search, pattern, pattern, pattern, pattern, pattern,
            skill, skillPattern,
            minRating, minCompleted,
        ).map(talentSummary);
        const openQuests = db.prepare(`
            SELECT id, title, deadline FROM quests
            WHERE client_id = ? AND status = 'open' ORDER BY created_at DESC
        `).all(req.user.id);
        res.json({ freelancers, openQuests });
    });

    app.get("/api/v1/freelancers/:id", requireUser(["client"]), (req, res) => {
        const student = db.prepare(`
            SELECT users.id, users.display_name, student_profiles.university, student_profiles.course,
                   student_profiles.bio, student_profiles.availability_status,
                   COALESCE((SELECT ROUND(AVG(rating), 1) FROM reviews WHERE reviewee_id = users.id), 0) AS rating,
                   (SELECT COUNT(*) FROM portfolio_entries WHERE student_id = users.id) AS completed_quests
            FROM users
            JOIN student_profiles ON student_profiles.user_id = users.id
            LEFT JOIN user_preferences ON user_preferences.user_id = users.id
            WHERE users.id = ? AND users.role = 'student' AND users.account_status = 'active'
              AND student_profiles.verification_status = 'verified'
              AND COALESCE(user_preferences.profile_visibility, 'campus') != 'private'
        `).get(req.params.id);
        if (!student) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Freelancer not found." } });
        const portfolio = db.prepare(`
            SELECT portfolio_entries.id, portfolio_entries.title, portfolio_entries.summary,
                   portfolio_entries.completed_at, quests.category,
                   (SELECT rating FROM reviews
                    WHERE reviews.quest_id = portfolio_entries.quest_id
                      AND reviews.reviewee_id = portfolio_entries.student_id) AS client_rating
            FROM portfolio_entries JOIN quests ON quests.id = portfolio_entries.quest_id
            WHERE portfolio_entries.student_id = ? ORDER BY portfolio_entries.completed_at DESC
        `).all(student.id);
        const reviews = db.prepare(`
            SELECT reviews.rating, reviews.comment, reviews.created_at, quests.title AS quest_title,
                   users.display_name AS reviewer_name
            FROM reviews JOIN quests ON quests.id = reviews.quest_id
            JOIN users ON users.id = reviews.reviewer_id
            WHERE reviews.reviewee_id = ? ORDER BY reviews.created_at DESC
        `).all(student.id);
        res.json({ freelancer: talentSummary(student), portfolio, reviews });
    });

    app.post("/api/v1/freelancers/:id/invitations", requireUser(["client"]), (req, res) => {
        const questId = Number(req.body?.questId);
        const message = String(req.body?.message ?? "").trim();
        if (!Number.isInteger(questId) || !message || message.length > 1000) {
            return validationError(res, "Choose an open quest and provide a message of at most 1000 characters.");
        }
        const quest = db.prepare("SELECT id FROM quests WHERE id = ? AND client_id = ? AND status = 'open'")
            .get(questId, req.user.id);
        const student = db.prepare(`
            SELECT users.id FROM users JOIN student_profiles ON student_profiles.user_id = users.id
            LEFT JOIN user_preferences ON user_preferences.user_id = users.id
            WHERE users.id = ? AND users.account_status = 'active'
              AND student_profiles.verification_status = 'verified'
              AND COALESCE(user_preferences.profile_visibility, 'campus') != 'private'
        `).get(req.params.id);
        if (!quest || !student) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Quest or freelancer not found." } });
        try {
            const result = db.prepare(`
                INSERT INTO invitations (client_id, student_id, quest_id, message) VALUES (?, ?, ?, ?)
            `).run(req.user.id, student.id, quest.id, message);
            res.status(201).json({ invitation: db.prepare("SELECT * FROM invitations WHERE id = ?").get(result.lastInsertRowid) });
        } catch (error) {
            if (String(error.message).includes("UNIQUE constraint failed")) {
                return res.status(409).json({ error: { code: "ALREADY_INVITED", message: "This student already has an invitation for that quest." } });
            }
            throw error;
        }
    });

    app.get("/api/v1/invitations/me", requireUser(["student"]), (req, res) => {
        const invitations = db.prepare(`
            SELECT invitations.*, quests.title AS quest_title, quests.deadline, quests.budget_cents,
                   users.display_name AS client_name, client_profiles.organization_name
            FROM invitations JOIN quests ON quests.id = invitations.quest_id
            JOIN users ON users.id = invitations.client_id
            LEFT JOIN client_profiles ON client_profiles.user_id = users.id
            WHERE invitations.student_id = ? ORDER BY invitations.created_at DESC
        `).all(req.user.id);
        res.json({ invitations });
    });

    app.patch("/api/v1/invitations/:id", requireUser(["student"]), (req, res) => {
        const decision = req.body?.decision;
        if (!["accepted", "declined"].includes(decision)) return validationError(res, "Accept or decline the invitation.");
        const invitation = db.prepare(`
            SELECT invitations.*, quests.status AS quest_status FROM invitations
            JOIN quests ON quests.id = invitations.quest_id
            WHERE invitations.id = ? AND invitations.student_id = ? AND invitations.status = 'pending'
        `).get(req.params.id, req.user.id);
        if (!invitation) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Pending invitation not found." } });
        if (decision === "accepted" && invitation.quest_status !== "open") {
            return res.status(409).json({ error: { code: "QUEST_UNAVAILABLE", message: "This quest is no longer open." } });
        }
        try {
            db.exec("BEGIN");
            if (decision === "accepted") {
                db.prepare(`
                    INSERT INTO applications (quest_id, student_id, cover_letter)
                    VALUES (?, ?, ?)
                `).run(invitation.quest_id, req.user.id, `Invited by the client.\n\n${invitation.message}`);
            }
            db.prepare("UPDATE invitations SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
                .run(decision, invitation.id);
            db.exec("COMMIT");
            res.json({ invitation: db.prepare("SELECT * FROM invitations WHERE id = ?").get(invitation.id) });
        } catch (error) {
            db.exec("ROLLBACK");
            if (String(error.message).includes("UNIQUE constraint failed")) {
                return res.status(409).json({ error: { code: "ALREADY_APPLIED", message: "You already applied to this quest." } });
            }
            throw error;
        }
    });

    app.get("/api/v1/client/applications", requireUser(["client"]), (req, res) => {
        const quests = db.prepare(`
            SELECT
                quests.*,
                COUNT(applications.id) AS application_count,
                COALESCE(SUM(CASE WHEN applications.status = 'pending' THEN 1 ELSE 0 END), 0) AS pending_count
            FROM quests
            LEFT JOIN applications ON applications.quest_id = quests.id
            WHERE quests.client_id = ? AND quests.status IN ('open', 'in_progress')
            GROUP BY quests.id
            ORDER BY pending_count DESC, quests.created_at DESC
        `).all(req.user.id);
        const requestedQuestId = Number(req.query.questId);
        const quest = quests.find((item) => item.id === requestedQuestId) ?? quests[0] ?? null;
        if (!quest) return res.json({ quests: [], quest: null, applications: [] });

        const questSkills = db.prepare(`
            SELECT skills.name
            FROM quest_skills JOIN skills ON skills.id = quest_skills.skill_id
            WHERE quest_skills.quest_id = ?
            ORDER BY skills.name
        `).all(quest.id).map((skill) => skill.name);
        const questDeliverables = db.prepare(`
            SELECT id, title, is_complete
            FROM deliverables
            WHERE quest_id = ?
            ORDER BY id
        `).all(quest.id);
        const applications = db.prepare(`
            SELECT
                applications.*,
                users.display_name AS student_name,
                student_profiles.course,
                student_profiles.university,
                student_profiles.bio,
                student_profiles.verification_status,
                (SELECT ROUND(AVG(rating), 1) FROM reviews WHERE reviewee_id = users.id) AS rating,
                (SELECT COUNT(*) FROM portfolio_entries WHERE student_id = users.id) AS completed_quests
            FROM applications
            JOIN users ON users.id = applications.student_id
            LEFT JOIN student_profiles ON student_profiles.user_id = users.id
            WHERE applications.quest_id = ?
            ORDER BY
                CASE applications.status WHEN 'accepted' THEN 0 WHEN 'pending' THEN 1 ELSE 2 END,
                applications.created_at
        `).all(quest.id).map((application) => {
            const studentSkills = db.prepare(`
                SELECT skills.name
                FROM user_skills JOIN skills ON skills.id = user_skills.skill_id
                WHERE user_skills.user_id = ?
                ORDER BY skills.name
            `).all(application.student_id).map((skill) => skill.name);
            const normalizedStudentSkills = new Set(studentSkills.map((skill) => skill.toLowerCase()));
            const matchedSkills = questSkills.filter((skill) => normalizedStudentSkills.has(skill.toLowerCase()));
            const criteriaCoverage = questSkills.length
                ? Math.round((matchedSkills.length / questSkills.length) * 100)
                : 100;
            const portfolio = db.prepare(`
                SELECT portfolio_entries.id, portfolio_entries.title, portfolio_entries.summary,
                       portfolio_entries.completed_at, quests.category,
                       (SELECT rating FROM reviews
                        WHERE reviews.quest_id = portfolio_entries.quest_id
                          AND reviews.reviewee_id = portfolio_entries.student_id) AS client_rating
                FROM portfolio_entries
                JOIN quests ON quests.id = portfolio_entries.quest_id
                WHERE portfolio_entries.student_id = ?
                ORDER BY portfolio_entries.completed_at DESC
            `).all(application.student_id);
            return {
                ...application,
                skills: studentSkills,
                matched_skills: matchedSkills,
                criteria_coverage: criteriaCoverage,
                portfolio,
            };
        });

        res.json({
            quests,
            quest: { ...quest, skills: questSkills, deliverables: questDeliverables },
            applications,
        });
    });

    app.patch("/api/v1/client/applications/:id", requireUser(["client"]), (req, res) => {
        const { decision } = req.body ?? {};
        if (!["accepted", "rejected"].includes(decision)) {
            return validationError(res, "Decision must be accepted or rejected.");
        }
        const application = db.prepare(`
            SELECT applications.*, quests.client_id, quests.status AS quest_status
            FROM applications
            JOIN quests ON quests.id = applications.quest_id
            WHERE applications.id = ? AND quests.client_id = ?
        `).get(req.params.id, req.user.id);
        if (!application) {
            return res.status(404).json({ error: { code: "NOT_FOUND", message: "Application not found." } });
        }
        if (application.status !== "pending" || application.quest_status !== "open") {
            return res.status(409).json({
                error: { code: "DECISION_LOCKED", message: "This application can no longer be changed." },
            });
        }

        try {
            db.exec("BEGIN");
            db.prepare(`
                UPDATE applications SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
            `).run(decision, application.id);
            if (decision === "accepted") {
                db.prepare(`
                    UPDATE applications
                    SET status = 'rejected', updated_at = CURRENT_TIMESTAMP
                    WHERE quest_id = ? AND id != ? AND status = 'pending'
                `).run(application.quest_id, application.id);
                db.prepare(`
                    UPDATE quests SET status = 'in_progress', updated_at = CURRENT_TIMESTAMP WHERE id = ?
                `).run(application.quest_id);
                db.prepare(`
                    INSERT OR IGNORE INTO conversations (quest_id, student_id, client_id)
                    VALUES (?, ?, ?)
                `).run(application.quest_id, application.student_id, application.client_id);
            }
            db.exec("COMMIT");
        } catch (error) {
            db.exec("ROLLBACK");
            throw error;
        }

        const updated = db.prepare("SELECT * FROM applications WHERE id = ?").get(application.id);
        res.json({ application: updated });
    });

    app.get("/api/v1/messages", requireUser(["student", "client"]), (req, res) => {
        const conversations = db.prepare(`
            SELECT conversations.id, conversations.quest_id, quests.title AS quest_title,
                   quests.status AS quest_status, conversations.student_id,
                   conversations.student_last_read_message_id,
                   conversations.client_last_read_message_id,
                   CASE WHEN conversations.student_id = ?
                       THEN clients.display_name ELSE students.display_name END AS counterpart_name,
                   (SELECT body FROM messages
                    WHERE messages.conversation_id = conversations.id
                    ORDER BY messages.id DESC LIMIT 1) AS last_message,
                   (SELECT created_at FROM messages
                    WHERE messages.conversation_id = conversations.id
                    ORDER BY messages.id DESC LIMIT 1) AS last_message_at
            FROM conversations
            JOIN quests ON quests.id = conversations.quest_id
            JOIN users AS students ON students.id = conversations.student_id
            JOIN users AS clients ON clients.id = conversations.client_id
            WHERE conversations.student_id = ? OR conversations.client_id = ?
            ORDER BY COALESCE(last_message_at, conversations.created_at) DESC
        `).all(req.user.id, req.user.id, req.user.id).map((conversation) => {
            const lastReadMessageId = conversation.student_id === req.user.id
                ? conversation.student_last_read_message_id
                : conversation.client_last_read_message_id;
            const unreadCount = db.prepare(`
                SELECT COUNT(*) AS count
                FROM messages
                WHERE conversation_id = ? AND sender_id != ?
                  AND id > COALESCE(?, 0)
            `).get(conversation.id, req.user.id, lastReadMessageId).count;
            const {
                student_id: _studentId,
                student_last_read_message_id: _studentLastReadMessageId,
                client_last_read_message_id: _clientLastReadMessageId,
                ...publicConversation
            } = conversation;
            return { ...publicConversation, unread_count: unreadCount };
        });
        res.json({
            conversations,
            unreadCount: conversations.reduce((total, item) => total + item.unread_count, 0),
        });
    });

    app.get("/api/v1/messages/:id", requireUser(["student", "client"]), (req, res) => {
        const conversation = db.prepare(`
            SELECT conversations.id, conversations.quest_id, conversations.student_id,
                   conversations.client_id, quests.title AS quest_title,
                   CASE WHEN conversations.student_id = ?
                       THEN clients.display_name ELSE students.display_name END AS counterpart_name
            FROM conversations
            JOIN quests ON quests.id = conversations.quest_id
            JOIN users AS students ON students.id = conversations.student_id
            JOIN users AS clients ON clients.id = conversations.client_id
            WHERE conversations.id = ?
              AND (conversations.student_id = ? OR conversations.client_id = ?)
        `).get(req.user.id, req.params.id, req.user.id, req.user.id);
        if (!conversation) {
            return res.status(404).json({ error: { code: "NOT_FOUND", message: "Conversation not found." } });
        }
        const readColumn = conversation.student_id === req.user.id
            ? "student_last_read_message_id"
            : "client_last_read_message_id";
        db.prepare(`
            UPDATE conversations
            SET ${readColumn} = (
                SELECT COALESCE(MAX(id), 0) FROM messages WHERE conversation_id = ?
            )
            WHERE id = ?
        `).run(conversation.id, conversation.id);
        const messages = db.prepare(`
            SELECT messages.id, messages.sender_id, messages.body, messages.created_at,
                   users.display_name AS sender_name
            FROM messages
            JOIN users ON users.id = messages.sender_id
            WHERE messages.conversation_id = ?
            ORDER BY messages.id
        `).all(conversation.id);
        res.json({ conversation, messages });
    });

    app.post("/api/v1/messages/:id", requireUser(["student", "client"]), (req, res) => {
        const body = String(req.body?.body ?? "").trim();
        if (!body || body.length > 2000) {
            return validationError(res, "Message must contain 1 to 2000 characters.");
        }
        const conversation = db.prepare(`
            SELECT id FROM conversations
            WHERE id = ? AND (student_id = ? OR client_id = ?)
        `).get(req.params.id, req.user.id, req.user.id);
        if (!conversation) {
            return res.status(404).json({ error: { code: "NOT_FOUND", message: "Conversation not found." } });
        }
        const result = db.prepare(`
            INSERT INTO messages (conversation_id, sender_id, body) VALUES (?, ?, ?)
        `).run(conversation.id, req.user.id, body);
        const message = db.prepare(`
            SELECT messages.id, messages.sender_id, messages.body, messages.created_at,
                   users.display_name AS sender_name
            FROM messages JOIN users ON users.id = messages.sender_id
            WHERE messages.id = ?
        `).get(result.lastInsertRowid);
        res.status(201).json({ message });
    });

    app.get("/api/v1/workspace", requireUser(["student", "client"]), (req, res) => {
        const ownershipClause = req.user.role === "client"
            ? "quests.client_id = ?"
            : "applications.student_id = ?";
        const quests = db.prepare(`
            SELECT
                quests.*,
                applications.student_id,
                students.display_name AS student_name,
                clients.display_name AS client_name
            FROM quests
            JOIN applications ON applications.quest_id = quests.id AND applications.status = 'accepted'
            JOIN users AS students ON students.id = applications.student_id
            JOIN users AS clients ON clients.id = quests.client_id
            WHERE ${ownershipClause}
              AND quests.status IN ('in_progress', 'submitted', 'completed')
            ORDER BY
                CASE quests.status WHEN 'submitted' THEN 0 WHEN 'in_progress' THEN 1 ELSE 2 END,
                quests.updated_at DESC
        `).all(req.user.id);
        const requestedQuestId = Number(req.query.questId);
        const quest = quests.find((item) => item.id === requestedQuestId) ?? quests[0] ?? null;
        if (!quest) return res.json({ quests: [], quest: null, deliverables: [] });

        const deliverables = db.prepare(`
            SELECT id, quest_id, title, is_complete, completed_at, submission_status,
                   submission_note, submitted_at
            FROM deliverables
            WHERE quest_id = ?
            ORDER BY id
        `).all(quest.id);
        const currentReview = db.prepare(`
            SELECT id, rating, comment, created_at
            FROM reviews WHERE quest_id = ? AND reviewer_id = ?
        `).get(quest.id, req.user.id) ?? null;
        const receivedReview = db.prepare(`
            SELECT reviews.id, reviews.rating, reviews.comment, reviews.created_at,
                   users.display_name AS reviewer_name
            FROM reviews
            JOIN users ON users.id = reviews.reviewer_id
            WHERE reviews.quest_id = ? AND reviews.reviewee_id = ?
        `).get(quest.id, req.user.id) ?? null;
        res.json({ quests, quest, deliverables, currentReview, receivedReview });
    });

    app.patch("/api/v1/workspace/deliverables/:id/submit", requireUser(["student"]), (req, res) => {
        const note = typeof req.body?.note === "string" ? req.body.note.trim() : "";
        const deliverable = db.prepare(`
            SELECT deliverables.*, quests.status AS quest_status
            FROM deliverables
            JOIN quests ON quests.id = deliverables.quest_id
            JOIN applications ON applications.quest_id = quests.id
            WHERE deliverables.id = ?
              AND applications.student_id = ?
              AND applications.status = 'accepted'
        `).get(req.params.id, req.user.id);
        if (!deliverable) {
            return res.status(404).json({ error: { code: "NOT_FOUND", message: "Deliverable not found." } });
        }
        if (!["in_progress", "submitted"].includes(deliverable.quest_status) || deliverable.submission_status === "approved") {
            return res.status(409).json({
                error: { code: "SUBMISSION_LOCKED", message: "This deliverable cannot be submitted." },
            });
        }

        db.prepare(`
            UPDATE deliverables
            SET submission_status = 'submitted', submission_note = ?, submitted_at = CURRENT_TIMESTAMP,
                is_complete = 0, completed_at = NULL
            WHERE id = ?
        `).run(note || null, deliverable.id);
        const remaining = db.prepare(`
            SELECT COUNT(*) AS count FROM deliverables
            WHERE quest_id = ? AND submission_status NOT IN ('submitted', 'approved')
        `).get(deliverable.quest_id).count;
        db.prepare(`
            UPDATE quests SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
        `).run(remaining === 0 ? "submitted" : "in_progress", deliverable.quest_id);
        res.json({ deliverable: db.prepare("SELECT * FROM deliverables WHERE id = ?").get(deliverable.id) });
    });

    app.patch("/api/v1/workspace/deliverables/:id/review", requireUser(["client"]), (req, res) => {
        const { decision } = req.body ?? {};
        if (!["approved", "revision_requested"].includes(decision)) {
            return validationError(res, "Decision must be approved or revision_requested.");
        }
        const deliverable = db.prepare(`
            SELECT deliverables.*, quests.status AS quest_status
            FROM deliverables
            JOIN quests ON quests.id = deliverables.quest_id
            WHERE deliverables.id = ? AND quests.client_id = ?
        `).get(req.params.id, req.user.id);
        if (!deliverable) {
            return res.status(404).json({ error: { code: "NOT_FOUND", message: "Deliverable not found." } });
        }
        if (!["in_progress", "submitted"].includes(deliverable.quest_status) || deliverable.submission_status !== "submitted") {
            return res.status(409).json({
                error: { code: "REVIEW_LOCKED", message: "Only submitted deliverables can be reviewed." },
            });
        }

        db.prepare(`
            UPDATE deliverables
            SET submission_status = ?, is_complete = ?, completed_at = ?
            WHERE id = ?
        `).run(
            decision,
            decision === "approved" ? 1 : 0,
            decision === "approved" ? new Date().toISOString() : null,
            deliverable.id,
        );
        const waiting = db.prepare(`
            SELECT COUNT(*) AS count FROM deliverables
            WHERE quest_id = ? AND submission_status NOT IN ('submitted', 'approved')
        `).get(deliverable.quest_id).count;
        db.prepare(`
            UPDATE quests SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
        `).run(waiting === 0 ? "submitted" : "in_progress", deliverable.quest_id);
        res.json({ deliverable: db.prepare("SELECT * FROM deliverables WHERE id = ?").get(deliverable.id) });
    });

    app.post("/api/v1/workspace/quests/:id/complete", requireUser(["client"]), (req, res) => {
        const quest = db.prepare(`
            SELECT * FROM quests WHERE id = ? AND client_id = ? AND status IN ('in_progress', 'submitted')
        `).get(req.params.id, req.user.id);
        if (!quest) {
            return res.status(404).json({ error: { code: "NOT_FOUND", message: "Active quest not found." } });
        }
        const unapproved = db.prepare(`
            SELECT COUNT(*) AS count FROM deliverables
            WHERE quest_id = ? AND submission_status != 'approved'
        `).get(quest.id).count;
        if (unapproved > 0) {
            return res.status(409).json({
                error: { code: "DELIVERABLES_INCOMPLETE", message: "Approve every deliverable before completing the quest." },
            });
        }
        const assignment = db.prepare(`
            SELECT student_id FROM applications
            WHERE quest_id = ? AND status = 'accepted'
        `).get(quest.id);
        const completedAt = new Date().toISOString();
        try {
            db.exec("BEGIN");
            db.prepare(`
                UPDATE quests SET status = 'completed', updated_at = CURRENT_TIMESTAMP WHERE id = ?
            `).run(quest.id);
            db.prepare(`
                INSERT INTO portfolio_entries
                    (student_id, quest_id, title, summary, completed_at)
                VALUES (?, ?, ?, ?, ?)
            `).run(assignment.student_id, quest.id, quest.title, quest.description, completedAt);
            db.exec("COMMIT");
        } catch (error) {
            db.exec("ROLLBACK");
            throw error;
        }
        res.json({ quest: db.prepare("SELECT * FROM quests WHERE id = ?").get(quest.id) });
    });

    app.post("/api/v1/workspace/quests/:id/reviews", requireUser(["student", "client"]), (req, res) => {
        const { rating, comment } = req.body ?? {};
        if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
            return validationError(res, "Rating must be an integer from 1 to 5.");
        }
        const normalizedComment = typeof comment === "string" ? comment.trim() : "";
        if (normalizedComment.length > 1000) {
            return validationError(res, "Review comments must contain at most 1000 characters.");
        }
        const quest = db.prepare(`
            SELECT quests.*, applications.student_id
            FROM quests
            JOIN applications ON applications.quest_id = quests.id AND applications.status = 'accepted'
            WHERE quests.id = ? AND quests.status = 'completed'
              AND (quests.client_id = ? OR applications.student_id = ?)
        `).get(req.params.id, req.user.id, req.user.id);
        if (!quest) {
            return res.status(404).json({ error: { code: "NOT_FOUND", message: "Completed quest not found." } });
        }
        const revieweeId = req.user.id === quest.client_id ? quest.student_id : quest.client_id;
        try {
            const result = db.prepare(`
                INSERT INTO reviews (quest_id, reviewer_id, reviewee_id, rating, comment)
                VALUES (?, ?, ?, ?, ?)
            `).run(quest.id, req.user.id, revieweeId, rating, normalizedComment || null);
            const review = db.prepare("SELECT * FROM reviews WHERE id = ?").get(result.lastInsertRowid);
            res.status(201).json({ review });
        } catch (error) {
            if (String(error.message).includes("UNIQUE constraint failed")) {
                return res.status(409).json({
                    error: { code: "ALREADY_REVIEWED", message: "You already reviewed this quest." },
                });
            }
            throw error;
        }
    });

    app.get("/api/v1/profile/me", requireUser(["student"]), (req, res) => {
        const profile = db.prepare(`
            SELECT users.id, users.email, users.display_name, student_profiles.university,
                   student_profiles.course, student_profiles.bio,
                   student_profiles.availability_status,
                   student_profiles.verification_status
            FROM users
            JOIN student_profiles ON student_profiles.user_id = users.id
            WHERE users.id = ?
        `).get(req.user.id);
        const skills = db.prepare(`
            SELECT skills.name
            FROM user_skills JOIN skills ON skills.id = user_skills.skill_id
            WHERE user_skills.user_id = ?
            ORDER BY skills.name
        `).all(req.user.id).map((skill) => skill.name);
        const portfolio = db.prepare(`
            SELECT portfolio_entries.*, quests.category, users.display_name AS client_name,
                   (SELECT rating FROM reviews
                    WHERE reviews.quest_id = portfolio_entries.quest_id
                      AND reviews.reviewee_id = portfolio_entries.student_id) AS client_rating
            FROM portfolio_entries
            JOIN quests ON quests.id = portfolio_entries.quest_id
            JOIN users ON users.id = quests.client_id
            WHERE portfolio_entries.student_id = ?
            ORDER BY portfolio_entries.completed_at DESC
        `).all(req.user.id);
        const reviews = db.prepare(`
            SELECT reviews.id, reviews.rating, reviews.comment, reviews.created_at,
                   users.display_name AS reviewer_name, quests.title AS quest_title,
                   client_profiles.organization_name
            FROM reviews
            JOIN users ON users.id = reviews.reviewer_id
            JOIN quests ON quests.id = reviews.quest_id
            LEFT JOIN client_profiles ON client_profiles.user_id = users.id
            WHERE reviews.reviewee_id = ?
            ORDER BY reviews.created_at DESC
        `).all(req.user.id);
        const rating = db.prepare(`
            SELECT ROUND(AVG(rating), 1) AS average FROM reviews WHERE reviewee_id = ?
        `).get(req.user.id).average;
        res.json({
            profile,
            skills,
            portfolio,
            reviews,
            summary: { completed: portfolio.length, rating },
        });
    });

    app.patch("/api/v1/profile/me/availability", requireUser(["student"]), (req, res) => {
        const availability = String(req.body?.availability ?? "");
        if (!["available", "limited", "unavailable"].includes(availability)) {
            return validationError(res, "Select a valid availability.");
        }
        db.prepare("UPDATE student_profiles SET availability_status = ? WHERE user_id = ?")
            .run(availability, req.user.id);
        res.json({ availability });
    });

    app.patch("/api/v1/profile/me/verification", requireUser(["student"]), (req, res) => {
        const { university, course, bio = "", skills } = req.body ?? {};
        const normalizedUniversity = String(university ?? "").trim();
        const normalizedCourse = String(course ?? "").trim();
        const normalizedBio = String(bio).trim();
        const normalizedSkills = Array.isArray(skills)
            ? [...new Set(skills.map((skill) => String(skill).trim()).filter(Boolean))]
            : [];

        if (!normalizedUniversity || !normalizedCourse || normalizedSkills.length === 0) {
            return validationError(res, "University, course, and at least one skill are required.");
        }
        if (normalizedUniversity.length > 120 || normalizedCourse.length > 120 || normalizedBio.length > 300) {
            return validationError(res, "University and course must be at most 120 characters; bio must be at most 300.");
        }
        if (normalizedSkills.length > 10 || normalizedSkills.some((skill) => skill.length > 60)) {
            return validationError(res, "Provide no more than 10 skills, each at most 60 characters.");
        }

        try {
            db.exec("BEGIN");
            db.prepare(`
                UPDATE student_profiles
                SET university = ?, course = ?, bio = ?,
                    verification_status = CASE
                        WHEN verification_status = 'verified' THEN 'verified'
                        ELSE 'pending'
                    END
                WHERE user_id = ?
            `).run(normalizedUniversity, normalizedCourse, normalizedBio || null, req.user.id);
            db.prepare("DELETE FROM user_skills WHERE user_id = ?").run(req.user.id);

            const addSkill = db.prepare("INSERT OR IGNORE INTO skills (name) VALUES (?)");
            const findSkill = db.prepare("SELECT id FROM skills WHERE name = ? COLLATE NOCASE");
            const addUserSkill = db.prepare("INSERT INTO user_skills (user_id, skill_id) VALUES (?, ?)");
            for (const skillName of normalizedSkills) {
                addSkill.run(skillName);
                addUserSkill.run(req.user.id, findSkill.get(skillName).id);
            }
            db.exec("COMMIT");
        } catch (error) {
            db.exec("ROLLBACK");
            throw error;
        }

        const profile = db.prepare(`
            SELECT users.id, users.email, users.display_name, student_profiles.university,
                   student_profiles.course, student_profiles.bio,
                   student_profiles.verification_status
            FROM users
            JOIN student_profiles ON student_profiles.user_id = users.id
            WHERE users.id = ?
        `).get(req.user.id);
        res.json({ profile, skills: normalizedSkills });
    });

    app.get("/api/v1/applications/me", requireUser(["student"]), (req, res) => {
        const applications = db.prepare(`
            SELECT
                applications.*,
                quests.title AS quest_title,
                quests.status AS quest_status,
                quests.deadline,
                quests.budget_cents,
                users.display_name AS client_name
            FROM applications
            JOIN quests ON quests.id = applications.quest_id
            JOIN users ON users.id = quests.client_id
            WHERE applications.student_id = ?
            ORDER BY applications.created_at DESC
        `).all(req.user.id);
        const counts = db.prepare(`
            SELECT
                COALESCE(SUM(CASE WHEN applications.status = 'pending' THEN 1 ELSE 0 END), 0) AS active_applications,
                COALESCE(SUM(CASE WHEN applications.status = 'accepted' THEN 1 ELSE 0 END), 0) AS accepted,
                COALESCE(SUM(CASE
                    WHEN applications.status = 'accepted' AND quests.status IN ('in_progress', 'submitted')
                    THEN 1 ELSE 0 END), 0) AS active_quests
            FROM applications
            JOIN quests ON quests.id = applications.quest_id
            WHERE applications.student_id = ?
        `).get(req.user.id);
        const completed = db.prepare(`
            SELECT COUNT(*) AS count FROM portfolio_entries WHERE student_id = ?
        `).get(req.user.id).count;
        const rating = db.prepare(`
            SELECT ROUND(AVG(rating), 1) AS average FROM reviews WHERE reviewee_id = ?
        `).get(req.user.id).average;

        res.json({
            applications,
            summary: {
                activeApplications: counts.active_applications,
                accepted: counts.accepted,
                activeQuests: counts.active_quests,
                completed,
                rating,
            },
        });
    });

    app.get("/api/v1/client/dashboard", requireUser(["client"]), (req, res) => {
        const client = db.prepare(`
            SELECT users.display_name, client_profiles.organization_name, client_profiles.organization_type
            FROM users
            JOIN client_profiles ON client_profiles.user_id = users.id
            WHERE users.id = ?
        `).get(req.user.id);
        const quests = db.prepare(`
            SELECT quests.*,
                   COUNT(applications.id) AS applicant_count,
                   MAX(CASE WHEN applications.status = 'accepted' THEN students.display_name END) AS student_name
            FROM quests
            LEFT JOIN applications ON applications.quest_id = quests.id
            LEFT JOIN users AS students ON students.id = applications.student_id
            WHERE quests.client_id = ?
            GROUP BY quests.id
            ORDER BY quests.updated_at DESC
        `).all(req.user.id);
        const pendingApplications = db.prepare(`
            SELECT applications.id, applications.quest_id, applications.created_at,
                   students.display_name AS student_name, quests.title AS quest_title,
                   student_profiles.course, student_profiles.verification_status
            FROM applications
            JOIN quests ON quests.id = applications.quest_id
            JOIN users AS students ON students.id = applications.student_id
            LEFT JOIN student_profiles ON student_profiles.user_id = students.id
            WHERE quests.client_id = ? AND applications.status = 'pending'
            ORDER BY applications.created_at DESC
            LIMIT 8
        `).all(req.user.id);
        const totalApplicants = db.prepare(`
            SELECT COUNT(*) AS count FROM applications
            JOIN quests ON quests.id = applications.quest_id
            WHERE quests.client_id = ?
        `).get(req.user.id).count;
        const pendingReviews = db.prepare(`
            SELECT COUNT(*) AS count
            FROM quests
            WHERE quests.client_id = ? AND quests.status = 'completed'
              AND NOT EXISTS (
                  SELECT 1 FROM reviews
                  WHERE reviews.quest_id = quests.id AND reviews.reviewer_id = ?
              )
        `).get(req.user.id, req.user.id).count;
        res.json({
            client,
            quests,
            pendingApplications,
            summary: {
                openQuests: quests.filter((quest) => quest.status === "open").length,
                totalApplicants,
                activeProjects: quests.filter((quest) => ["in_progress", "submitted"].includes(quest.status)).length,
                pendingReviews,
                completed: quests.filter((quest) => quest.status === "completed").length,
            },
        });
    });

    app.get("/api/v1/client/profile", requireUser(["client"]), (req, res) => {
        const profile = db.prepare(`
            SELECT users.display_name, users.email, client_profiles.organization_name,
                   client_profiles.organization_type
            FROM users
            JOIN client_profiles ON client_profiles.user_id = users.id
            WHERE users.id = ?
        `).get(req.user.id);
        res.json({ profile });
    });

    app.patch("/api/v1/client/profile", requireUser(["client"]), (req, res) => {
        const organizationName = String(req.body?.organizationName ?? "").trim();
        const organizationType = String(req.body?.organizationType ?? "").trim();
        if (!organizationName || !organizationType) {
            return validationError(res, "Organization name and type are required.");
        }
        if (organizationName.length > 120 || organizationType.length > 80) {
            return validationError(res, "Organization name or type is too long.");
        }
        db.prepare(`
            UPDATE client_profiles
            SET organization_name = ?, organization_type = ?
            WHERE user_id = ?
        `).run(organizationName, organizationType, req.user.id);
        const profile = db.prepare(`
            SELECT users.display_name, users.email, client_profiles.organization_name,
                   client_profiles.organization_type
            FROM users
            JOIN client_profiles ON client_profiles.user_id = users.id
            WHERE users.id = ?
        `).get(req.user.id);
        res.json({ profile });
    });

    function readPreferences(userId) {
        db.prepare("INSERT OR IGNORE INTO user_preferences (user_id) VALUES (?)").run(userId);
        const item = db.prepare("SELECT * FROM user_preferences WHERE user_id = ?").get(userId);
        return {
            theme: item.theme,
            applicationUpdates: Boolean(item.application_updates),
            messageNotifications: Boolean(item.message_notifications),
            questRecommendations: Boolean(item.quest_recommendations),
            profileVisibility: item.profile_visibility,
            reduceMotion: Boolean(item.reduce_motion),
        };
    }

    app.get("/api/v1/preferences", requireUser(), (req, res) => {
        res.json({ preferences: readPreferences(req.user.id) });
    });

    app.patch("/api/v1/preferences", requireUser(), (req, res) => {
        const current = readPreferences(req.user.id);
        const next = { ...current, ...req.body };
        if (!["light", "dark"].includes(next.theme)) {
            return validationError(res, "Theme must be light or dark.");
        }
        if (!["campus", "clients", "private"].includes(next.profileVisibility)) {
            return validationError(res, "Select a valid profile visibility.");
        }
        for (const key of ["applicationUpdates", "messageNotifications", "questRecommendations", "reduceMotion"]) {
            if (typeof next[key] !== "boolean") {
                return validationError(res, `${key} must be true or false.`);
            }
        }
        db.prepare(`
            UPDATE user_preferences
            SET theme = ?, application_updates = ?, message_notifications = ?,
                quest_recommendations = ?, profile_visibility = ?, reduce_motion = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE user_id = ?
        `).run(
            next.theme,
            Number(next.applicationUpdates),
            Number(next.messageNotifications),
            Number(next.questRecommendations),
            next.profileVisibility,
            Number(next.reduceMotion),
            req.user.id,
        );
        res.json({ preferences: readPreferences(req.user.id) });
    });

    app.get("/api/v1/reports/me", requireUser(["student", "client"]), (req, res) => {
        const reports = db.prepare(`
            SELECT id, subject, category, description, status, admin_notes, created_at, updated_at
            FROM reports WHERE reporter_id = ? ORDER BY created_at DESC
        `).all(req.user.id);
        res.json({ reports });
    });

    app.post("/api/v1/reports", requireUser(["student", "client"]), (req, res) => {
        const subject = String(req.body?.subject ?? "").trim();
        const category = String(req.body?.category ?? "").trim();
        const description = String(req.body?.description ?? "").trim();
        const categories = ["user_conduct", "quest_content", "payment_dispute", "technical_issue", "other"];
        if (!subject || subject.length > 120) {
            return validationError(res, "Subject must contain 1 to 120 characters.");
        }
        if (!categories.includes(category)) {
            return validationError(res, "Select a valid report category.");
        }
        if (description.length < 10 || description.length > 2000) {
            return validationError(res, "Description must contain 10 to 2000 characters.");
        }
        const result = db.prepare(`
            INSERT INTO reports (reporter_id, subject, category, description)
            VALUES (?, ?, ?, ?)
        `).run(req.user.id, subject, category, description);
        const report = db.prepare("SELECT * FROM reports WHERE id = ?").get(result.lastInsertRowid);
        res.status(201).json({ report });
    });

    function skillGaps() {
        return db.prepare(`
            SELECT skills.name,
                   (SELECT COUNT(*) FROM user_skills WHERE user_skills.skill_id = skills.id) AS supply,
                   (SELECT COUNT(*) FROM quest_skills
                    JOIN quests ON quests.id = quest_skills.quest_id
                    WHERE quest_skills.skill_id = skills.id
                      AND quests.status IN ('open', 'in_progress', 'submitted')) AS demand
            FROM skills
            ORDER BY (demand - supply) DESC, skills.name
        `).all()
            .filter((item) => item.supply > 0 || item.demand > 0)
            .map((item) => ({ ...item, gap: item.supply - item.demand }));
    }

    app.get("/api/v1/admin/operations", requireUser(["admin"]), (_req, res) => {
        const verifiedStudents = db.prepare(`
            SELECT COUNT(*) AS count FROM student_profiles WHERE verification_status = 'verified'
        `).get().count;
        const pendingVerifications = db.prepare(`
            SELECT COUNT(*) AS count FROM student_profiles WHERE verification_status = 'pending'
        `).get().count;
        const openQuests = db.prepare("SELECT COUNT(*) AS count FROM quests WHERE status = 'open'").get().count;
        const completedQuests = db.prepare("SELECT COUNT(*) AS count FROM quests WHERE status = 'completed'").get().count;
        const startedQuests = db.prepare(`
            SELECT COUNT(*) AS count FROM quests WHERE status IN ('in_progress', 'submitted', 'completed')
        `).get().count;
        const pendingStudents = db.prepare(`
            SELECT users.id, users.display_name, users.email, users.created_at,
                   student_profiles.university, student_profiles.course,
                   student_profiles.verification_status
            FROM users
            JOIN student_profiles ON student_profiles.user_id = users.id
            WHERE student_profiles.verification_status = 'pending'
            ORDER BY users.created_at
        `).all();
        const users = db.prepare(`
            SELECT id, display_name, email, role, account_status, created_at
            FROM users
            WHERE role != 'admin'
            ORDER BY created_at DESC
            LIMIT 20
        `).all();
        const reports = db.prepare(`
            SELECT reports.id, reports.subject, reports.category, reports.description,
                   reports.status, reports.admin_notes, reports.created_at,
                   users.display_name AS reporter_name, users.email AS reporter_email,
                   users.role AS reporter_role
            FROM reports
            JOIN users ON users.id = reports.reporter_id
            ORDER BY CASE reports.status WHEN 'open' THEN 0 ELSE 1 END, reports.created_at DESC
            LIMIT 50
        `).all();
        res.json({
            summary: {
                verifiedStudents,
                openQuests,
                pendingVerifications,
                completionRate: startedQuests ? Math.round((completedQuests / startedQuests) * 100) : 0,
            },
            pendingStudents,
            users,
            reports,
            skillGaps: skillGaps(),
        });
    });

    app.patch("/api/v1/admin/reports/:id", requireUser(["admin"]), (req, res) => {
        const status = String(req.body?.status ?? "");
        const adminNotes = String(req.body?.adminNotes ?? "").trim();
        if (!["resolved", "dismissed"].includes(status)) {
            return validationError(res, "Report status must be resolved or dismissed.");
        }
        if (adminNotes.length > 1000) {
            return validationError(res, "Administrative notes must be at most 1000 characters.");
        }
        const result = db.prepare(`
            UPDATE reports SET status = ?, admin_notes = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(status, adminNotes || null, req.params.id);
        if (!result.changes) {
            return res.status(404).json({ error: { code: "NOT_FOUND", message: "Report not found." } });
        }
        res.json({ report: db.prepare("SELECT * FROM reports WHERE id = ?").get(req.params.id) });
    });

    app.patch("/api/v1/admin/students/:id/verification", requireUser(["admin"]), (req, res) => {
        const { decision } = req.body ?? {};
        if (!["verified", "rejected"].includes(decision)) {
            return validationError(res, "Decision must be verified or rejected.");
        }
        const student = db.prepare(`
            SELECT users.id FROM users
            JOIN student_profiles ON student_profiles.user_id = users.id
            WHERE users.id = ? AND users.role = 'student'
        `).get(req.params.id);
        if (!student) {
            return res.status(404).json({ error: { code: "NOT_FOUND", message: "Student not found." } });
        }
        try {
            db.exec("BEGIN");
            db.prepare("UPDATE student_profiles SET verification_status = ? WHERE user_id = ?")
                .run(decision, student.id);
            db.prepare("UPDATE users SET account_status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
                .run(decision === "verified" ? "active" : "suspended", student.id);
            if (decision === "rejected") db.prepare("DELETE FROM sessions WHERE user_id = ?").run(student.id);
            db.exec("COMMIT");
        } catch (error) {
            db.exec("ROLLBACK");
            throw error;
        }
        res.json({ student: { id: student.id, verificationStatus: decision } });
    });

    app.patch("/api/v1/admin/users/:id/status", requireUser(["admin"]), (req, res) => {
        const { status } = req.body ?? {};
        if (!["active", "suspended"].includes(status)) {
            return validationError(res, "Status must be active or suspended.");
        }
        if (Number(req.params.id) === req.user.id) {
            return res.status(409).json({ error: { code: "SELF_MODERATION", message: "Administrators cannot change their own status." } });
        }
        const result = db.prepare(`
            UPDATE users SET account_status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND role != 'admin'
        `).run(status, req.params.id);
        if (result.changes === 0) {
            return res.status(404).json({ error: { code: "NOT_FOUND", message: "User not found." } });
        }
        if (status === "suspended") db.prepare("DELETE FROM sessions WHERE user_id = ?").run(req.params.id);
        res.json({ user: db.prepare("SELECT id, display_name, role, account_status FROM users WHERE id = ?").get(req.params.id) });
    });

    app.get("/api/v1/admin/analytics", requireUser(["admin"]), (_req, res) => {
        const roleDistribution = db.prepare(`
            SELECT role, COUNT(*) AS count FROM users GROUP BY role ORDER BY role
        `).all();
        const questStatuses = db.prepare(`
            SELECT status, COUNT(*) AS count FROM quests GROUP BY status ORDER BY status
        `).all();
        const categories = db.prepare(`
            SELECT category, COUNT(*) AS count FROM quests GROUP BY category ORDER BY count DESC, category
        `).all();
        const applicationStatuses = db.prepare(`
            SELECT status, COUNT(*) AS count FROM applications GROUP BY status ORDER BY status
        `).all();
        const completionTrend = db.prepare(`
            SELECT SUBSTR(completed_at, 1, 7) AS month, COUNT(*) AS count
            FROM portfolio_entries
            GROUP BY month ORDER BY month
        `).all();
        const recentQuests = db.prepare(`
            SELECT quests.id, quests.title, quests.category, quests.status, quests.created_at,
                   users.display_name AS client_name
            FROM quests JOIN users ON users.id = quests.client_id
            ORDER BY quests.created_at DESC LIMIT 10
        `).all();
        res.json({
            totals: {
                users: db.prepare("SELECT COUNT(*) AS count FROM users").get().count,
                quests: db.prepare("SELECT COUNT(*) AS count FROM quests").get().count,
                applications: db.prepare("SELECT COUNT(*) AS count FROM applications").get().count,
                completed: db.prepare("SELECT COUNT(*) AS count FROM quests WHERE status = 'completed'").get().count,
            },
            roleDistribution,
            questStatuses,
            categories,
            applicationStatuses,
            completionTrend,
            skillGaps: skillGaps(),
            recentQuests,
        });
    });

    if (serveStatic) {
        if (production) {
            app.use(express.static(resolve("dist"), { index: "index.html" }));
        } else {
            app.use("/assets", express.static(resolve("assets")));
            app.use("/pages", express.static(resolve("pages")));
            app.get("/", (_req, res) => res.sendFile(resolve("index.html")));
        }
    }

    app.use((error, _req, res, _next) => {
        console.error(error);
        res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "An unexpected server error occurred." } });
    });

    return app;
}
