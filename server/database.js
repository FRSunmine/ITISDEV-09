import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { hashPassword } from "./auth.js";

export const DEMO_PASSWORD = "SideQuest123!";

export function createDatabase(path = resolve("data", "sidequest.db")) {
    if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });

    const db = new DatabaseSync(path);
    db.exec("PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;");
    migrate(db);
    seed(db);
    return db;
}

function migrate(db) {
    db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT NOT NULL UNIQUE COLLATE NOCASE,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL CHECK (role IN ('student', 'client', 'admin')),
            display_name TEXT NOT NULL,
            account_status TEXT NOT NULL DEFAULT 'active'
                CHECK (account_status IN ('pending', 'active', 'suspended')),
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS sessions (
            token_hash TEXT PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            expires_at TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS user_preferences (
            user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
            theme TEXT NOT NULL DEFAULT 'light' CHECK (theme IN ('light', 'dark')),
            application_updates INTEGER NOT NULL DEFAULT 1 CHECK (application_updates IN (0, 1)),
            message_notifications INTEGER NOT NULL DEFAULT 1 CHECK (message_notifications IN (0, 1)),
            quest_recommendations INTEGER NOT NULL DEFAULT 1 CHECK (quest_recommendations IN (0, 1)),
            profile_visibility TEXT NOT NULL DEFAULT 'campus'
                CHECK (profile_visibility IN ('campus', 'clients', 'private')),
            reduce_motion INTEGER NOT NULL DEFAULT 0 CHECK (reduce_motion IN (0, 1)),
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS student_profiles (
            user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
            university TEXT NOT NULL,
            course TEXT,
            bio TEXT,
            availability_status TEXT NOT NULL DEFAULT 'available'
                CHECK (availability_status IN ('available', 'limited', 'unavailable')),
            verification_status TEXT NOT NULL DEFAULT 'pending'
                CHECK (verification_status IN ('pending', 'verified', 'rejected'))
        );

        CREATE TABLE IF NOT EXISTS client_profiles (
            user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
            organization_name TEXT NOT NULL,
            organization_type TEXT
        );

        CREATE TABLE IF NOT EXISTS skills (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE COLLATE NOCASE
        );

        CREATE TABLE IF NOT EXISTS user_skills (
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            skill_id INTEGER NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
            PRIMARY KEY (user_id, skill_id)
        );

        CREATE TABLE IF NOT EXISTS quests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            client_id INTEGER NOT NULL REFERENCES users(id),
            title TEXT NOT NULL,
            description TEXT NOT NULL,
            category TEXT NOT NULL,
            budget_cents INTEGER NOT NULL CHECK (budget_cents >= 0),
            deadline TEXT NOT NULL,
            work_arrangement TEXT NOT NULL
                CHECK (work_arrangement IN ('remote', 'hybrid', 'onsite')),
            status TEXT NOT NULL DEFAULT 'open'
                CHECK (status IN ('draft', 'open', 'in_progress', 'submitted', 'completed', 'cancelled')),
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS quest_skills (
            quest_id INTEGER NOT NULL REFERENCES quests(id) ON DELETE CASCADE,
            skill_id INTEGER NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
            PRIMARY KEY (quest_id, skill_id)
        );

        CREATE TABLE IF NOT EXISTS applications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            quest_id INTEGER NOT NULL REFERENCES quests(id) ON DELETE CASCADE,
            student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            cover_letter TEXT NOT NULL,
            proposed_rate_cents INTEGER,
            status TEXT NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'accepted', 'rejected', 'withdrawn')),
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE (quest_id, student_id)
        );

        CREATE TABLE IF NOT EXISTS invitations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            client_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            quest_id INTEGER NOT NULL REFERENCES quests(id) ON DELETE CASCADE,
            message TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'accepted', 'declined')),
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE (quest_id, student_id)
        );

        CREATE TABLE IF NOT EXISTS conversations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            quest_id INTEGER NOT NULL UNIQUE REFERENCES quests(id) ON DELETE CASCADE,
            student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            client_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            student_last_read_message_id INTEGER,
            client_last_read_message_id INTEGER,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
            sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            body TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS deliverables (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            quest_id INTEGER NOT NULL REFERENCES quests(id) ON DELETE CASCADE,
            title TEXT NOT NULL,
            is_complete INTEGER NOT NULL DEFAULT 0 CHECK (is_complete IN (0, 1)),
            completed_at TEXT
        );

        CREATE TABLE IF NOT EXISTS reviews (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            quest_id INTEGER NOT NULL REFERENCES quests(id),
            reviewer_id INTEGER NOT NULL REFERENCES users(id),
            reviewee_id INTEGER NOT NULL REFERENCES users(id),
            rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
            comment TEXT,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE (quest_id, reviewer_id, reviewee_id)
        );

        CREATE TABLE IF NOT EXISTS reports (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            reporter_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            subject TEXT NOT NULL,
            category TEXT NOT NULL
                CHECK (category IN ('user_conduct', 'quest_content', 'payment_dispute', 'technical_issue', 'other')),
            description TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'open'
                CHECK (status IN ('open', 'resolved', 'dismissed')),
            admin_notes TEXT,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS portfolio_entries (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            quest_id INTEGER NOT NULL UNIQUE REFERENCES quests(id),
            title TEXT NOT NULL,
            summary TEXT,
            completed_at TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX IF NOT EXISTS idx_quests_status ON quests(status);
        CREATE INDEX IF NOT EXISTS idx_applications_student ON applications(student_id);
        CREATE INDEX IF NOT EXISTS idx_applications_quest ON applications(quest_id);
        CREATE INDEX IF NOT EXISTS idx_invitations_student ON invitations(student_id, status);
        CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, created_at);
        CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status, created_at);
        CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
    `);

    const studentProfileColumns = new Set(
        db.prepare("PRAGMA table_info(student_profiles)").all().map((column) => column.name),
    );
    if (!studentProfileColumns.has("availability_status")) {
        db.exec(`
            ALTER TABLE student_profiles ADD COLUMN availability_status TEXT NOT NULL DEFAULT 'available'
                CHECK (availability_status IN ('available', 'limited', 'unavailable'));
            UPDATE student_profiles SET availability_status = 'limited'
            WHERE user_id = (SELECT id FROM users WHERE email = 'jamie.cruz@dlsu.edu.ph');
            UPDATE student_profiles SET availability_status = 'unavailable'
            WHERE user_id = (SELECT id FROM users WHERE email = 'sam.lee@dlsu.edu.ph');
        `);
    }

    const deliverableColumns = new Set(
        db.prepare("PRAGMA table_info(deliverables)").all().map((column) => column.name),
    );
    if (!deliverableColumns.has("submission_status")) {
        db.exec(`
            ALTER TABLE deliverables ADD COLUMN submission_status TEXT NOT NULL DEFAULT 'pending'
                CHECK (submission_status IN ('pending', 'submitted', 'revision_requested', 'approved'));
        `);
    }
    if (!deliverableColumns.has("submission_note")) {
        db.exec("ALTER TABLE deliverables ADD COLUMN submission_note TEXT;");
    }
    if (!deliverableColumns.has("submitted_at")) {
        db.exec("ALTER TABLE deliverables ADD COLUMN submitted_at TEXT;");
    }
    const conversationColumns = new Set(
        db.prepare("PRAGMA table_info(conversations)").all().map((column) => column.name),
    );
    if (!conversationColumns.has("student_last_read_message_id")) {
        db.exec("ALTER TABLE conversations ADD COLUMN student_last_read_message_id INTEGER;");
    }
    if (!conversationColumns.has("client_last_read_message_id")) {
        db.exec("ALTER TABLE conversations ADD COLUMN client_last_read_message_id INTEGER;");
    }
}

function seed(db) {
    db.exec("BEGIN");
    try {
        const addUser = db.prepare(`
            INSERT OR IGNORE INTO users (email, password_hash, role, display_name, account_status)
            VALUES (?, ?, ?, ?, ?)
        `);
        const passwordHash = hashPassword(DEMO_PASSWORD);
        const students = [
            {
                email: "student@dlsu.edu.ph",
                name: "Alex Rivera",
                status: "active",
                university: "De La Salle University",
                course: "BS Computer Science",
                bio: "UI/UX designer and frontend developer.",
                verification: "verified",
                availability: "available",
                skills: ["React", "Figma", "JavaScript"],
            },
            {
                email: "jamie.cruz@dlsu.edu.ph",
                name: "Jamie Cruz",
                status: "active",
                university: "De La Salle University",
                course: "AB Communication",
                bio: "Copywriter and campaign strategist for campus organizations.",
                verification: "verified",
                availability: "limited",
                skills: ["Copywriting", "Social Media", "Branding"],
            },
            {
                email: "sam.lee@dlsu.edu.ph",
                name: "Sam Lee",
                status: "active",
                university: "De La Salle University",
                course: "AB Multimedia Arts",
                bio: "Video editor and motion designer focused on student stories.",
                verification: "verified",
                availability: "unavailable",
                skills: ["Video Editing", "Motion Graphics", "Storyboarding"],
            },
            {
                email: "nina.patel@dlsu.edu.ph",
                name: "Nina Patel",
                status: "pending",
                university: "De La Salle University",
                course: "BS Information Systems",
                bio: "Data and product student building practical campus tools.",
                verification: "pending",
                availability: "available",
                skills: ["Data Analysis", "Excel", "SQL"],
            },
        ];
        const clients = [
            {
                email: "client@sidequest.demo",
                name: "Maya Santos",
                organization: "DLSU Student Council",
                type: "Student organization",
            },
            {
                email: "luis@sidequest.demo",
                name: "Luis Mendoza",
                organization: "Green Labs Manila",
                type: "Startup",
            },
            {
                email: "bea@sidequest.demo",
                name: "Bea Lim",
                organization: "Campus Press",
                type: "Student publication",
            },
        ];

        students.forEach((student) => {
            addUser.run(student.email, passwordHash, "student", student.name, student.status);
        });
        clients.forEach((client) => {
            addUser.run(client.email, passwordHash, "client", client.name, "active");
        });
        addUser.run("admin@sidequest.demo", passwordHash, "admin", "Jordan Reyes", "active");

        const findUser = db.prepare("SELECT id FROM users WHERE email = ? COLLATE NOCASE");
        const addStudentProfile = db.prepare(`
            INSERT OR IGNORE INTO student_profiles
                (user_id, university, course, bio, verification_status, availability_status)
            VALUES (?, ?, ?, ?, ?, ?)
        `);
        const addClientProfile = db.prepare(`
            INSERT OR IGNORE INTO client_profiles (user_id, organization_name, organization_type)
            VALUES (?, ?, ?)
        `);
        students.forEach((student) => {
            addStudentProfile.run(
                findUser.get(student.email).id,
                student.university,
                student.course,
                student.bio,
                student.verification,
                student.availability,
            );
        });
        clients.forEach((client) => {
            addClientProfile.run(
                findUser.get(client.email).id,
                client.organization,
                client.type,
            );
        });

        const addQuest = db.prepare(`
            INSERT INTO quests
                (client_id, title, description, category, budget_cents, deadline, work_arrangement, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);
        const quests = [
            {
            owner: "client@sidequest.demo",
            title: "Event Registration Website",
            description: "Build a responsive registration portal for university week.",
            category: "Development",
            budget: 850000,
            deadline: "2026-08-15",
            arrangement: "remote",
            status: "open",
            skills: ["React", "Node.js", "SQLite"],
            deliverables: [
                "Responsive registration form",
                "Persistent attendee records",
                "CSV-ready administrator view",
            ],
            },
            {
            owner: "client@sidequest.demo",
            title: "Green Week Campaign Branding",
            description: "Create a cohesive visual identity and social media kit.",
            category: "Design",
            budget: 500000,
            deadline: "2026-09-01",
            arrangement: "hybrid",
            status: "open",
            skills: ["Figma", "Branding", "Social Media"],
            deliverables: [
                "Campaign visual identity",
                "Social media template kit",
                "Exported brand guidelines",
            ],
            },
            {
            owner: "luis@sidequest.demo",
            title: "Startup Pitch Deck Polish",
            description: "Refine a climate-tech pitch deck for an upcoming university demo day.",
            category: "Design",
            budget: 420000,
            deadline: "2026-08-22",
            arrangement: "remote",
            status: "open",
            skills: ["Presentation Design", "Copywriting", "Branding"],
            deliverables: ["Redesigned 12-slide deck", "Editable source file"],
            },
            {
            owner: "bea@sidequest.demo",
            title: "Freshman Orientation Video",
            description: "Edit a fast-paced orientation video from supplied campus footage.",
            category: "Multimedia",
            budget: 650000,
            deadline: "2026-08-28",
            arrangement: "hybrid",
            status: "open",
            skills: ["Video Editing", "Motion Graphics", "Storyboarding"],
            deliverables: ["Two-minute final cut", "Captioned social media version"],
            },
            {
            owner: "luis@sidequest.demo",
            title: "Campus Sustainability Data Dashboard",
            description: "Turn survey data into a concise dashboard for a campus sustainability report.",
            category: "Data",
            budget: 700000,
            deadline: "2026-08-10",
            arrangement: "remote",
            status: "in_progress",
            skills: ["Data Analysis", "Excel", "Data Visualization"],
            deliverables: ["Cleaned survey workbook", "Interactive summary dashboard"],
            },
            {
            owner: "luis@sidequest.demo",
            title: "Alumni Newsletter Redesign",
            description: "Refresh the alumni newsletter layout and rewrite key campaign sections.",
            category: "Marketing",
            budget: 480000,
            deadline: "2026-07-10",
            arrangement: "remote",
            status: "completed",
            skills: ["Copywriting", "Branding", "Email Marketing"],
            deliverables: ["Newsletter copy", "Responsive newsletter layout"],
            },
        ];

        const findQuest = db.prepare("SELECT id FROM quests WHERE title = ?");
        quests.forEach((quest) => {
            if (!findQuest.get(quest.title)) {
                addQuest.run(
                    findUser.get(quest.owner).id,
                    quest.title,
                    quest.description,
                    quest.category,
                    quest.budget,
                    quest.deadline,
                    quest.arrangement,
                    quest.status,
                );
            }
        });

        const addSkill = db.prepare("INSERT OR IGNORE INTO skills (name) VALUES (?)");
        const findSkill = db.prepare("SELECT id FROM skills WHERE name = ? COLLATE NOCASE");
        const addQuestSkill = db.prepare("INSERT OR IGNORE INTO quest_skills (quest_id, skill_id) VALUES (?, ?)");
        const addUserSkill = db.prepare("INSERT OR IGNORE INTO user_skills (user_id, skill_id) VALUES (?, ?)");
        const addDeliverable = db.prepare("INSERT INTO deliverables (quest_id, title) VALUES (?, ?)");
        const countDeliverables = db.prepare("SELECT COUNT(*) AS count FROM deliverables WHERE quest_id = ?");

        for (const item of quests) {
            const quest = findQuest.get(item.title);
            for (const skillName of item.skills) {
                addSkill.run(skillName);
                addQuestSkill.run(quest.id, findSkill.get(skillName).id);
            }
            if (countDeliverables.get(quest.id).count === 0) {
                item.deliverables.forEach((title) => addDeliverable.run(quest.id, title));
            }
        }

        students.forEach((student) => {
            for (const skillName of student.skills) {
                addSkill.run(skillName);
                addUserSkill.run(findUser.get(student.email).id, findSkill.get(skillName).id);
            }
        });

        const addApplication = db.prepare(`
            INSERT OR IGNORE INTO applications
                (quest_id, student_id, cover_letter, proposed_rate_cents, status)
            VALUES (?, ?, ?, ?, ?)
        `);
        const sampleApplications = [
            ["Event Registration Website", "jamie.cruz@dlsu.edu.ph", "I can shape clear registration copy and participant messaging.", 380000, "pending"],
            ["Green Week Campaign Branding", "sam.lee@dlsu.edu.ph", "I can extend the campaign into motion and social-first assets.", 450000, "pending"],
            ["Campus Sustainability Data Dashboard", "student@dlsu.edu.ph", "I can build a clear, responsive dashboard from the survey findings.", 620000, "accepted"],
            ["Alumni Newsletter Redesign", "jamie.cruz@dlsu.edu.ph", "I have newsletter writing and campaign branding experience.", 450000, "accepted"],
        ];
        db.prepare(`
            DELETE FROM applications
            WHERE quest_id = ? AND student_id = ?
        `).run(
            findQuest.get("Campus Sustainability Data Dashboard").id,
            findUser.get("sam.lee@dlsu.edu.ph").id,
        );
        sampleApplications.forEach(([questTitle, studentEmail, letter, rate, status]) => {
            addApplication.run(
                findQuest.get(questTitle).id,
                findUser.get(studentEmail).id,
                letter,
                rate,
                status,
            );
        });

        const completedQuest = findQuest.get("Alumni Newsletter Redesign");
        db.prepare(`
            UPDATE deliverables
            SET is_complete = 1, submission_status = 'approved',
                submitted_at = COALESCE(submitted_at, '2026-07-08 09:00:00'),
                completed_at = COALESCE(completed_at, '2026-07-09 15:00:00')
            WHERE quest_id = ?
        `).run(completedQuest.id);
        const jamieId = findUser.get("jamie.cruz@dlsu.edu.ph").id;
        const luisId = findUser.get("luis@sidequest.demo").id;
        db.prepare(`
            INSERT OR IGNORE INTO portfolio_entries
                (student_id, quest_id, title, summary, completed_at)
            VALUES (?, ?, ?, ?, '2026-07-09 15:00:00')
        `).run(
            jamieId,
            completedQuest.id,
            "Alumni Newsletter Redesign",
            "Reworked campaign copy and delivered a responsive newsletter layout.",
        );
        const addReview = db.prepare(`
            INSERT OR IGNORE INTO reviews
                (quest_id, reviewer_id, reviewee_id, rating, comment, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
        `);
        addReview.run(
            completedQuest.id,
            luisId,
            jamieId,
            5,
            "Clear writing, thoughtful revisions, and an excellent final handoff.",
            "2026-07-10 10:00:00",
        );
        addReview.run(
            completedQuest.id,
            jamieId,
            luisId,
            5,
            "Well-scoped project with fast, specific feedback.",
            "2026-07-10 11:00:00",
        );

        const activeQuest = findQuest.get("Campus Sustainability Data Dashboard");
        const alexId = findUser.get("student@dlsu.edu.ph").id;
        db.prepare(`
            INSERT OR IGNORE INTO conversations (quest_id, student_id, client_id)
            VALUES (?, ?, ?)
        `).run(activeQuest.id, alexId, luisId);
        const conversation = db.prepare("SELECT id FROM conversations WHERE quest_id = ?").get(activeQuest.id);
        const messageCount = db.prepare(
            "SELECT COUNT(*) AS count FROM messages WHERE conversation_id = ?",
        ).get(conversation.id).count;
        if (messageCount === 0) {
            const addMessage = db.prepare(`
                INSERT INTO messages (conversation_id, sender_id, body, created_at)
                VALUES (?, ?, ?, ?)
            `);
            addMessage.run(
                conversation.id,
                luisId,
                "Hi Alex, the cleaned survey workbook is ready in the project brief.",
                "2026-07-27 09:15:00",
            );
            addMessage.run(
                conversation.id,
                alexId,
                "Thanks! I will share the first dashboard structure tomorrow.",
                "2026-07-27 10:02:00",
            );
            addMessage.run(
                conversation.id,
                luisId,
                "Perfect. Please prioritize the transport and energy-use findings.",
                "2026-07-28 14:30:00",
            );
        }

        db.exec("COMMIT");
    } catch (error) {
        db.exec("ROLLBACK");
        throw error;
    }
}
