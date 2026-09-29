const claude = require("./claude");
const openai = require("./openai");
const gemini = require("./gemini");
const { LlmAdapterError } = require("./base");

const PROVIDERS = {
  claude,
  gpt: openai,
  openai,
  gemini,
};

/**
 * Unified LLM proxy entry point.
 * Normalizes provider-specific usage into { content, inputTokens, outputTokens }.
 *
 * @param {string} provider - "claude" | "gpt" | "openai" | "gemini"
 * @param {Array<{role: string, content: string}>} messages
 * @param {object} [config]
 */
const generateReply = async (provider, messages, config = {}) => {
  const key = String(provider || "").toLowerCase();
  const adapter = PROVIDERS[key];

  if (!adapter) {
    throw new LlmAdapterError(`Unsupported LLM provider: ${provider}`, {
      status: 400,
      code: "UNSUPPORTED_PROVIDER",
    });
  }

  const result = await adapter.generateReply(messages, config);

  return {
    content: result.content || "",
    inputTokens: Number(result.inputTokens) || 0,
    outputTokens: Number(result.outputTokens) || 0,
    raw: result.raw,
  };
};

const listProviders = () => ["claude", "gpt", "gemini"];

module.exports = {
  generateReply,
  listProviders,
  LlmAdapterError,
};
