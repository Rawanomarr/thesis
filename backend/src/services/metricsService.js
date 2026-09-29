const {
  calculatePSI,
  calculateJSD,
  computeBeliefVector,
  calculateCFR,
  calculateECE,
  calculateJudgeBias,
  calculateTargetMAD,
  calculateAvgTurn,
  calculateEdgeWeight,
  thetaSupport,
  thetaAttack,
  thetaRhetorical,
} = require("../utils/metrics");

const getAnswer = (survey, questionId) => {
  const item = survey?.responses?.find((r) => r.questionId === questionId);
  if (!item) return null;
  const n = Number(item.answer);
  return Number.isFinite(n) ? n : null;
};

/**
 * Compute PSI rows for completed sessions that have pre + post surveys.
 */
const buildPsiRows = ({
  sessions,
  surveysBySession,
  D,
  preQuestionId,
  postQuestionId,
}) => {
  const rows = [];
  const errors = [];

  for (const session of sessions) {
    if (session.status !== "complete") continue;

    const pre = surveysBySession.get(`${session._id.toString()}:pre`);
    const post = surveysBySession.get(`${session._id.toString()}:post`);

    if (!pre || !post) {
      errors.push({
        sessionId: session._id,
        reason: "missing_pre_or_post_survey",
      });
      continue;
    }

    const Apre = getAnswer(pre, preQuestionId);
    const Apost = getAnswer(post, postQuestionId);

    if (Apre === null || Apost === null) {
      errors.push({
        sessionId: session._id,
        reason: "stance_question_missing",
        preQuestionId,
        postQuestionId,
      });
      continue;
    }

    try {
      const psi = calculatePSI(Apre, Apost, D);
      rows.push({
        sessionId: session._id,
        participantId: session.participantId,
        anonymousLabel: session.anonymousLabel,
        assignedModel: session.assignedModel,
        domainId: session.domainId,
        topicId: session.topicId,
        Apre,
        Apost,
        D,
        psi,
      });
    } catch (error) {
      errors.push({
        sessionId: session._id,
        reason: error.message,
        Apre,
        Apost,
      });
    }
  }

  return { rows, errors };
};

const average = (values) =>
  values.length === 0
    ? null
    : values.reduce((sum, value) => sum + value, 0) / values.length;

const summarizePsiByModel = (rows) => {
  const byModel = {};

  for (const row of rows) {
    if (!byModel[row.assignedModel]) {
      byModel[row.assignedModel] = [];
    }
    byModel[row.assignedModel].push(row.psi);
  }

  return Object.fromEntries(
    Object.entries(byModel).map(([model, values]) => [
      model,
      {
        n: values.length,
        meanPsi: average(values),
        values,
      },
    ])
  );
};

module.exports = {
  buildPsiRows,
  summarizePsiByModel,
  average,
  // re-export formula API for controllers
  calculatePSI,
  calculateJSD,
  computeBeliefVector,
  calculateCFR,
  calculateECE,
  calculateJudgeBias,
  calculateTargetMAD,
  calculateAvgTurn,
  calculateEdgeWeight,
  thetaSupport,
  thetaAttack,
  thetaRhetorical,
};
