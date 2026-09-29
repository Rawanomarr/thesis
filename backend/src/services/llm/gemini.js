const { GoogleGenerativeAI } = require("@google/generative-ai");
const { LlmAdapterError } = require("./base");

const DEFAULT_MODEL = process.env.GEMINI_MODEL || "gemini-2.0-flash";

const toGeminiHistory = (messages) => {
  const systemParts = [];
  const contents = [];

  for (const message of messages) {
    if (message.role === "system") {
      systemParts.push(message.content);
      continue;
    }

    contents.push({
      role: message.role === "assistant" ? "model" : "user",
      parts: [{ text: message.content }],
    });
  }

  return {
    systemInstruction: systemParts.length
      ? { parts: [{ text: systemParts.join("\n\n") }] }
      : undefined,
    contents,
  };
};

const generateReply = async (messages, config = {}) => {
  const apiKey = process.env.GOOGLE_API_KEY;

  if (!apiKey) {
    throw new LlmAdapterError("GOOGLE_API_KEY is not configured", {
      status: 500,
      code: "MISSING_API_KEY",
    });
  }

  const client = new GoogleGenerativeAI(apiKey);
  const { systemInstruction, contents } = toGeminiHistory(messages);

  if (!contents.length) {
    throw new LlmAdapterError("At least one user/assistant message is required", {
      status: 400,
      code: "INVALID_MESSAGES",
    });
  }

  const history = contents.slice(0, -1);
  const last = contents[contents.length - 1];

  try {
    const model = client.getGenerativeModel({
      model: config.model || DEFAULT_MODEL,
      systemInstruction,
      generationConfig: {
        maxOutputTokens: config.maxTokens || 1024,
        temperature: config.temperature ?? 0.7,
      },
    });

    const chat = model.startChat({ history });
    const result = await chat.sendMessage(last.parts[0].text);
    const response = result.response;
    const usage = response.usageMetadata || {};

    return {
      content: response.text() || "",
      inputTokens: usage.promptTokenCount ?? 0,
      outputTokens: usage.candidatesTokenCount ?? usage.outputTokenCount ?? 0,
      raw: response,
    };
  } catch (error) {
    throw new LlmAdapterError(error.message || "Gemini request failed", {
      status: error.status || 502,
      code: "GEMINI_ERROR",
      cause: error,
    });
  }
};

module.exports = { generateReply };
