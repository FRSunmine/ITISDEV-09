const conversationList = document.querySelector("[data-conversation-list]");
const messageHeader = document.querySelector("[data-message-header]");
const messageList = document.querySelector("[data-message-list]");
const form = document.querySelector("[data-message-form]");
const input = document.querySelector("[data-message-input]");
const send = form.querySelector("button");
let activeConversationId = null;
let currentUserId = null;

function escapeHtml(value) {
    const element = document.createElement("div");
    element.textContent = value ?? "";
    return element.innerHTML;
}

function formatTime(value) {
    return new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short" })
        .format(new Date(`${value.replace(" ", "T")}Z`));
}

async function getJson(path, options) {
    const response = await fetch(path, {
        credentials: "include",
        headers: { Accept: "application/json", ...(options?.body ? { "Content-Type": "application/json" } : {}) },
        ...options,
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error?.message || "Messages could not be loaded.");
    return result;
}

async function openConversation(id) {
    activeConversationId = Number(id);
    const data = await getJson(`/api/v1/messages/${id}`);
    conversationList.querySelector(`[data-conversation="${id}"] .message-unread-count`)?.remove();
    messageHeader.innerHTML = `<h2 class="font-headline-sm text-headline-sm">${escapeHtml(data.conversation.counterpart_name)}</h2>
        <p class="text-sm text-on-surface-variant mt-1">${escapeHtml(data.conversation.quest_title)}</p>`;
    messageList.innerHTML = data.messages.length
        ? data.messages.map((message) => {
            const mine = message.sender_id === currentUserId;
            return `<div class="flex ${mine ? "justify-end" : "justify-start"}">
                <article class="max-w-[80%] rounded-xl px-4 py-3 ${mine ? "bg-primary text-on-primary" : "bg-surface-container-low"}">
                    <p>${escapeHtml(message.body)}</p>
                    <p class="text-[10px] mt-2 opacity-70">${escapeHtml(formatTime(message.created_at))}</p>
                </article>
            </div>`;
        }).join("")
        : '<p class="text-on-surface-variant">No messages yet.</p>';
    input.disabled = false;
    send.disabled = false;
    messageList.scrollTop = messageList.scrollHeight;
    document.dispatchEvent(new CustomEvent("sidequest:messages-read"));
}

async function load() {
    const [me, inbox] = await Promise.all([
        getJson("/api/v1/auth/me"),
        getJson("/api/v1/messages"),
    ]);
    currentUserId = me.user.id;
    conversationList.innerHTML = inbox.conversations.length
        ? inbox.conversations.map((conversation) => `
            <button class="w-full p-4 text-left hover:bg-surface-container-low" data-conversation="${conversation.id}" type="button">
                <span class="flex items-center justify-between gap-3">
                    <strong>${escapeHtml(conversation.counterpart_name)}</strong>
                    ${conversation.unread_count
                        ? `<span class="message-unread-count">${conversation.unread_count}</span>`
                        : ""}
                </span>
                <span class="block text-xs text-primary mt-1">${escapeHtml(conversation.quest_title)}</span>
                <span class="block text-sm text-on-surface-variant truncate mt-2">${escapeHtml(conversation.last_message || "Start the conversation")}</span>
            </button>`).join("")
        : '<p class="p-5 text-on-surface-variant">Conversations appear after a client accepts an application.</p>';
    const requestedQuest = Number(new URLSearchParams(window.location.search).get("questId"));
    const initial = inbox.conversations.find((item) => item.quest_id === requestedQuest) ?? inbox.conversations[0];
    if (initial) await openConversation(initial.id);
}

conversationList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-conversation]");
    if (button) openConversation(button.dataset.conversation);
});

form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!activeConversationId || !input.value.trim()) return;
    send.disabled = true;
    try {
        await getJson(`/api/v1/messages/${activeConversationId}`, {
            method: "POST",
            body: JSON.stringify({ body: input.value }),
        });
        input.value = "";
        await openConversation(activeConversationId);
    } finally {
        send.disabled = false;
    }
});

load().catch((error) => {
    conversationList.innerHTML = `<p class="p-5 text-error">${escapeHtml(error.message)}</p>`;
});
