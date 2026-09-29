/**
 * Common LLM adapter interface.
 * Each provider implements generateReply(messages, config)
 * and returns a normalized { content, inputTokens, outputTokens, raw }.
 */

class LlmAdapterError extends Error {
  constructor(message, { status = 502, code = "LLM_ERROR", cause } = {}) {
    super(message);
    this.name = "LlmAdapterError";
    this.status = status;
    this.code = code;
    this.cause = cause;
  }
}

/**
 * @typedef {Object} ChatMessage
 * @property {"system"|"user"|"assistant"} role
 * @property {string} content
 */

/**
 * @typedef {Object} GenerateConfig
 * @property {string} [model]
 * @property {number} [maxTokens]
 * @property {number} [temperature]
 */

/**
 * @typedef {Object} GenerateResult
 * @property {string} content
 * @property {number} inputTokens
 * @property {number} outputTokens
 * @property {unknown} [raw]
 */

/**
 * @param {ChatMessage[]} messages
 * @param {GenerateConfig} [config]
 * @returns {Promise<GenerateResult>}
 */
async function generateReply(_messages, _config = {}) {
  throw new LlmAdapterError("generateReply must be implemented by a provider adapter", {
    status: 500,
    code: "NOT_IMPLEMENTED",
  });
}

module.exports = {
  generateReply,
  LlmAdapterError,
};
