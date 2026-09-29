const OpenAI = require("openai");
const { LlmAdapterError } = require("./base");

const DEFAULT_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

const generateReply = async (messages, config = {}) => {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new LlmAdapterError("OPENAI_API_KEY is not configured", {
      status: 500,
      code: "MISSING_API_KEY",
    });
  }

  const client = new OpenAI({ apiKey });

  try {
    const response = await client.chat.completions.create({
      model: config.model || DEFAULT_MODEL,
      max_tokens: config.maxTokens || 1024,
      temperature: config.temperature ?? 0.7,
      messages: messages.map((message) => ({
        role: message.role,
        content: message.content,
      })),
    });

    const choice = response.choices?.[0]?.message;

    return {
      content: choice?.content || "",
      inputTokens: response.usage?.prompt_tokens ?? 0,
      outputTokens: response.usage?.completion_tokens ?? 0,
      raw: response,
    };
  } catch (error) {
    throw new LlmAdapterError(error.message || "OpenAI request failed", {
      status: error.status || 502,
      code: "OPENAI_ERROR",
      cause: error,
    });
  }
};

module.exports = { generateReply };
