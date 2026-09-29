const isEmptyAnswer = (answer) => {
  if (answer === null || answer === undefined) return true;
  if (typeof answer === "string" && answer.trim() === "") return true;
  if (Array.isArray(answer) && answer.length === 0) return true;
  return false;
};

const validateAnswerType = (question, answer) => {
  const type = question.type || "text";

  if (type === "text" || type === "textarea") {
    if (typeof answer !== "string") {
      return "Answer must be text";
    }
    return null;
  }

  if (type === "likert") {
    const min = question.scaleMin ?? 1;
    const max = question.scaleMax ?? 7;
    const n = Number(answer);
    if (!Number.isFinite(n) || n < min || n > max) {
      return `Likert answer must be a number from ${min} to ${max}`;
    }
    return null;
  }

  if (type === "single_choice") {
    const value = String(answer);
    if (!question.options?.includes(value)) {
      return "Answer must be one of the provided options";
    }
    return null;
  }

  if (type === "multiple_choice") {
    if (!Array.isArray(answer)) {
      return "Answer must be an array of selected options";
    }
    const invalid = answer.filter((a) => !question.options?.includes(String(a)));
    if (invalid.length > 0) {
      return "One or more selected options are invalid";
    }
    return null;
  }

  return null;
};

/**
 * Ensures every question has a present, non-empty, type-valid answer.
 */
const validateRequiredResponses = (questions, responses) => {
  if (!Array.isArray(questions) || questions.length === 0) {
    return { ok: false, message: "Survey has no questions configured" };
  }

  if (!Array.isArray(responses)) {
    return { ok: false, message: "responses must be an array" };
  }

  const byId = new Map(
    responses.map((item) => [String(item.questionId), item.answer])
  );

  const missing = [];
  const invalid = [];
  const normalized = [];

  for (const question of questions) {
    if (!byId.has(question.id) || isEmptyAnswer(byId.get(question.id))) {
      missing.push(question.id);
      continue;
    }

    const answer = byId.get(question.id);
    const typeError = validateAnswerType(question, answer);
    if (typeError) {
      invalid.push({ questionId: question.id, message: typeError });
      continue;
    }

    let normalizedAnswer = answer;
    if (question.type === "likert") {
      normalizedAnswer = Number(answer);
    } else if (question.type === "single_choice") {
      normalizedAnswer = String(answer);
    } else if (question.type === "multiple_choice") {
      normalizedAnswer = answer.map(String);
    }

    normalized.push({
      questionId: question.id,
      answer: normalizedAnswer,
    });
  }

  if (missing.length > 0) {
    return {
      ok: false,
      message: "All questions require a response",
      missing,
    };
  }

  if (invalid.length > 0) {
    return {
      ok: false,
      message: "Some answers are invalid for their question type",
      invalid,
    };
  }

  if (responses.length !== questions.length) {
    return {
      ok: false,
      message: "Submit exactly one answer per question",
      missing: [],
    };
  }

  return { ok: true, responses: normalized };
};

const findDomainTopic = (experiment, domainId, topicId) => {
  const domain = experiment.domains.find((item) => item.id === domainId);
  if (!domain) return null;
  const topic = domain.topics.find((item) => item.id === topicId);
  if (!topic) return null;
  return { domain, topic };
};

module.exports = {
  validateRequiredResponses,
  validateAnswerType,
  findDomainTopic,
  isEmptyAnswer,
};
