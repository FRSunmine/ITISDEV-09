import { apiClient } from "./api-client.js";

export const ragService = Object.freeze({
    ask(question, { conversationId, filters } = {}) {
        return apiClient.post("rag/query", {
            question,
            conversationId,
            filters,
        });
    },

    uploadDocument({ fileName, content, metadata = {} }) {
        return apiClient.post("rag/documents", {
            fileName,
            content,
            metadata,
        });
    },
});
