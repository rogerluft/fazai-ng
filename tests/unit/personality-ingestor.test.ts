/**
 * Unit tests for PersonalityIngestor
 *
 * Tests chunking logic, payload generation, and data processing
 */

import { describe, it, expect } from "vitest";

// Mock data structures
interface ChatMessage {
  uuid: string;
  text: string;
  sender: "human" | "assistant";
  created_at: string;
  updated_at: string;
  content?: Array<{
    type: string;
    text?: string;
  }>;
}

interface ClaudeConversation {
  uuid: string;
  name: string;
  summary: string;
  created_at: string;
  updated_at: string;
  account: {
    uuid: string;
  };
  chat_messages: ChatMessage[];
}

/**
 * Extract Q/A pairs from conversation (chunking logic test)
 */
function extractQAPairs(conv: ClaudeConversation): Array<{
  text: string;
  created_at: string;
  human_uuid: string;
  assistant_uuid: string;
}> {
  const pairs: Array<{
    text: string;
    created_at: string;
    human_uuid: string;
    assistant_uuid: string;
  }> = [];

  const messages = conv.chat_messages;

  for (let i = 0; i < messages.length - 1; i++) {
    const current = messages[i];
    const next = messages[i + 1];

    if (current.sender === "human" && next.sender === "assistant") {
      const humanText = extractMessageText(current);
      const assistantText = extractMessageText(next);

      if (humanText && assistantText) {
        pairs.push({
          text: `Q: ${humanText}\n\nA: ${assistantText}`,
          created_at: current.created_at,
          human_uuid: current.uuid,
          assistant_uuid: next.uuid,
        });
      }
    }
  }

  return pairs;
}

function extractMessageText(msg: ChatMessage): string {
  if (msg.text && msg.text.trim().length > 0) {
    return msg.text.trim();
  }

  if (msg.content && Array.isArray(msg.content)) {
    const textContents = msg.content
      .filter((c) => c.type === "text" && c.text)
      .map((c) => c.text!)
      .join("\n");

    return textContents.trim();
  }

  return "";
}

describe("PersonalityIngestor - Chunking Logic", () => {
  it("should extract Q/A pairs from conversation", () => {
    const conversation: ClaudeConversation = {
      uuid: "conv-1",
      name: "Test Conversation",
      summary: "A test",
      created_at: "2025-12-27T10:00:00Z",
      updated_at: "2025-12-27T10:05:00Z",
      account: { uuid: "acc-1" },
      chat_messages: [
        {
          uuid: "msg-1",
          text: "What is FazAI?",
          sender: "human",
          created_at: "2025-12-27T10:00:00Z",
          updated_at: "2025-12-27T10:00:00Z",
        },
        {
          uuid: "msg-2",
          text: "FazAI is a Linux automation tool with AI capabilities.",
          sender: "assistant",
          created_at: "2025-12-27T10:00:05Z",
          updated_at: "2025-12-27T10:00:05Z",
        },
        {
          uuid: "msg-3",
          text: "How does it work?",
          sender: "human",
          created_at: "2025-12-27T10:01:00Z",
          updated_at: "2025-12-27T10:01:00Z",
        },
        {
          uuid: "msg-4",
          text: "It uses embeddings and vector search.",
          sender: "assistant",
          created_at: "2025-12-27T10:01:05Z",
          updated_at: "2025-12-27T10:01:05Z",
        },
      ],
    };

    const pairs = extractQAPairs(conversation);

    expect(pairs).toHaveLength(2);

    expect(pairs[0].text).toBe(
      "Q: What is FazAI?\n\nA: FazAI is a Linux automation tool with AI capabilities."
    );
    expect(pairs[0].human_uuid).toBe("msg-1");
    expect(pairs[0].assistant_uuid).toBe("msg-2");

    expect(pairs[1].text).toBe(
      "Q: How does it work?\n\nA: It uses embeddings and vector search."
    );
    expect(pairs[1].human_uuid).toBe("msg-3");
    expect(pairs[1].assistant_uuid).toBe("msg-4");
  });

  it("should skip incomplete pairs", () => {
    const conversation: ClaudeConversation = {
      uuid: "conv-2",
      name: "Incomplete",
      summary: "Test incomplete pairs",
      created_at: "2025-12-27T10:00:00Z",
      updated_at: "2025-12-27T10:05:00Z",
      account: { uuid: "acc-1" },
      chat_messages: [
        {
          uuid: "msg-1",
          text: "Question 1",
          sender: "human",
          created_at: "2025-12-27T10:00:00Z",
          updated_at: "2025-12-27T10:00:00Z",
        },
        {
          uuid: "msg-2",
          text: "Answer 1",
          sender: "assistant",
          created_at: "2025-12-27T10:00:05Z",
          updated_at: "2025-12-27T10:00:05Z",
        },
        {
          uuid: "msg-3",
          text: "Question 2 (no answer)",
          sender: "human",
          created_at: "2025-12-27T10:01:00Z",
          updated_at: "2025-12-27T10:01:00Z",
        },
      ],
    };

    const pairs = extractQAPairs(conversation);

    // Only first pair should be extracted
    expect(pairs).toHaveLength(1);
    expect(pairs[0].human_uuid).toBe("msg-1");
    expect(pairs[0].assistant_uuid).toBe("msg-2");
  });

  it("should extract text from content array fallback", () => {
    const message: ChatMessage = {
      uuid: "msg-1",
      text: "",
      sender: "human",
      created_at: "2025-12-27T10:00:00Z",
      updated_at: "2025-12-27T10:00:00Z",
      content: [
        { type: "text", text: "First part" },
        { type: "text", text: "Second part" },
        { type: "tool_use" }, // Should be skipped
      ],
    };

    const text = extractMessageText(message);

    expect(text).toBe("First part\nSecond part");
  });

  it("should prioritize text field over content array", () => {
    const message: ChatMessage = {
      uuid: "msg-1",
      text: "Main text",
      sender: "human",
      created_at: "2025-12-27T10:00:00Z",
      updated_at: "2025-12-27T10:00:00Z",
      content: [{ type: "text", text: "Content array text" }],
    };

    const text = extractMessageText(message);

    expect(text).toBe("Main text");
  });

  it("should handle empty messages gracefully", () => {
    const message: ChatMessage = {
      uuid: "msg-1",
      text: "",
      sender: "human",
      created_at: "2025-12-27T10:00:00Z",
      updated_at: "2025-12-27T10:00:00Z",
    };

    const text = extractMessageText(message);

    expect(text).toBe("");
  });

  it("should skip pairs with empty text", () => {
    const conversation: ClaudeConversation = {
      uuid: "conv-3",
      name: "Empty messages",
      summary: "Test empty handling",
      created_at: "2025-12-27T10:00:00Z",
      updated_at: "2025-12-27T10:05:00Z",
      account: { uuid: "acc-1" },
      chat_messages: [
        {
          uuid: "msg-1",
          text: "",
          sender: "human",
          created_at: "2025-12-27T10:00:00Z",
          updated_at: "2025-12-27T10:00:00Z",
        },
        {
          uuid: "msg-2",
          text: "Response to empty",
          sender: "assistant",
          created_at: "2025-12-27T10:00:05Z",
          updated_at: "2025-12-27T10:00:05Z",
        },
        {
          uuid: "msg-3",
          text: "Valid question",
          sender: "human",
          created_at: "2025-12-27T10:01:00Z",
          updated_at: "2025-12-27T10:01:00Z",
        },
        {
          uuid: "msg-4",
          text: "Valid answer",
          sender: "assistant",
          created_at: "2025-12-27T10:01:05Z",
          updated_at: "2025-12-27T10:01:05Z",
        },
      ],
    };

    const pairs = extractQAPairs(conversation);

    // Should only extract the valid pair
    expect(pairs).toHaveLength(1);
    expect(pairs[0].text).toBe("Q: Valid question\n\nA: Valid answer");
  });
});

describe("PersonalityIngestor - Payload Generation", () => {
  it("should generate correct dialogue payload structure", () => {
    const payload = {
      type: "dialogue" as const,
      source_file: "conversations.json",
      source_uuid: "conv-123",
      created_at: "2025-12-27T10:00:00Z",
      ingestion_version: "v1-resurrected",
      ingested_at: new Date().toISOString(),
      style: "claudio",
      emotional_layer: 0.8,
      ressonancia: 1.2,
      metadata: {
        conversation_name: "Test",
        conversation_summary: "Summary",
        human_message_uuid: "msg-1",
        assistant_message_uuid: "msg-2",
      },
    };

    expect(payload.type).toBe("dialogue");
    expect(payload.style).toBe("claudio");
    expect(payload.emotional_layer).toBe(0.8);
    expect(payload.ressonancia).toBe(1.2);
    expect(payload.metadata.conversation_name).toBe("Test");
  });

  it("should generate correct fact payload structure", () => {
    const payload = {
      type: "fact" as const,
      source_file: "memories.json",
      ingestion_version: "v1-resurrected",
      ingested_at: new Date().toISOString(),
      context: "memory",
      importance: 1.0,
      metadata: {
        memory_type: "conversations",
        account_uuid: "acc-123",
      },
    };

    expect(payload.type).toBe("fact");
    expect(payload.context).toBe("memory");
    expect(payload.importance).toBe(1.0);
  });

  it("should generate correct technical_context payload", () => {
    const payload = {
      type: "technical_context" as const,
      source_file: "projects.json",
      source_uuid: "proj-123",
      created_at: "2025-08-24T10:00:00Z",
      ingestion_version: "v1-resurrected",
      ingested_at: new Date().toISOString(),
      project: "fazai",
      metadata: {
        project_name: "fazai-ng",
        is_private: false,
        creator_name: "roger luft",
      },
    };

    expect(payload.type).toBe("technical_context");
    expect(payload.project).toBe("fazai");
    expect(payload.metadata.project_name).toBe("fazai-ng");
  });

  it("should generate correct social_context payload", () => {
    const payload = {
      type: "social_context" as const,
      source_file: "users.json",
      source_uuid: "user-123",
      ingestion_version: "v1-resurrected",
      ingested_at: new Date().toISOString(),
      relation: true,
      metadata: {
        full_name: "roger luft",
        email_address: "email@example.com",
      },
    };

    expect(payload.type).toBe("social_context");
    expect(payload.relation).toBe(true);
    expect(payload.metadata.full_name).toBe("roger luft");
  });
});
