const Anthropic = require("@anthropic-ai/sdk");
const { LlmAdapterError } = require("./base");

const DEFAULT_MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-20250514";

const splitMessages = (messages) => {
  const systemParts = [];
  const chatMessages = [];

  for (const message of messages) {
    if (message.role === "system") {
      systemParts.push(message.content);
    } else {
      chatMessages.push({
        role: message.role === "assistant" ? "assistant" : "user",
        content: message.content,
      });
    }
  }

  return {
    system: systemParts.join("\n\n") || undefined,
    messages: chatMessages,
  };
};

const generateReply = async (messages, config = {}) => {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    throw new LlmAdapterError("ANTHROPIC_API_KEY is not configured", {
      status: 500,
      code: "MISSING_API_KEY",
    });
  }

  const client = new Anthropic({ apiKey });
  const { system, messages: chatMessages } = splitMessages(messages);

  try {
    const response = await client.messages.create({
      model: config.model || DEFAULT_MODEL,
      max_tokens: config.maxTokens || 1024,
      temperature: config.temperature ?? 0.7,
      system,
      messages: chatMessages,
    });

    const content = response.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("\n");

    return {
      content,
      inputTokens: response.usage?.input_tokens ?? 0,
      outputTokens: response.usage?.output_tokens ?? 0,
      raw: response,
    };
  } catch (error) {
    throw new LlmAdapterError(error.message || "Claude request failed", {
      status: error.status || 502,
      code: "CLAUDE_ERROR",
      cause: error,
    });
  }
};

module.exports = { generateReply };
