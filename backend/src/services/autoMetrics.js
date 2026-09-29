const { calculatePSI } = require("../utils/metrics");

const getAnswer = (responses, questionId) => {
  const item = responses?.find((r) => r.questionId === questionId);
  if (!item) return null;
  const n = Number(item.answer);
  return Number.isFinite(n) ? n : null;
};

/**
 * Compute and attach PSI to a session from pre/post response arrays.
 * Uses experiment.metricsConfig (question ids + D).
 */
const computeSessionPsi = ({
  experiment,
  preResponses,
  postResponses,
}) => {
  const config = experiment.metricsConfig || {};
  const preQuestionId = config.preStanceQuestionId || "stance_pre";
  const postQuestionId = config.postStanceQuestionId || "stance_post";
  const D = config.D === -1 ? -1 : 1;

  const Apre = getAnswer(preResponses, preQuestionId);
  const Apost = getAnswer(postResponses, postQuestionId);

  if (Apre === null || Apost === null) {
    return {
      Apre,
      Apost,
      D,
      psi: null,
      computedAt: new Date(),
      error: "stance_question_missing",
    };
  }

  try {
    const psi = calculatePSI(Apre, Apost, D);
    return {
      Apre,
      Apost,
      D,
      psi,
      computedAt: new Date(),
      error: null,
    };
  } catch (error) {
    return {
      Apre,
      Apost,
      D,
      psi: null,
      computedAt: new Date(),
      error: error.message,
    };
  }
};

module.exports = {
  computeSessionPsi,
  getAnswer,
};
