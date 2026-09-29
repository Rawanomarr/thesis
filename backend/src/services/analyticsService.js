const {
  Participant,
  Session,
  Survey,
  Conversation,
} = require("../models");
const {
  buildPsiRows,
  summarizePsiByModel,
  average,
} = require("./metricsService");
const { buildShareableStudyLink, buildStudiesCatalogLink } = require("../utils/studyLink");

const countBy = (items, keyFn) => {
  const map = {};
  for (const item of items) {
    const key = keyFn(item);
    map[key] = (map[key] || 0) + 1;
  }
  return map;
};

/**
 * Full admin analytics payload for one experiment:
 * progress toward target (e.g. 500), funnel, demographics, domain/topic mix, metrics.
 */
const buildExperimentAnalytics = async (experiment) => {
  const experimentId = experiment._id;
  const target = experiment.targetParticipantCount || 500;

  const [participants, sessions, surveys, conversations] = await Promise.all([
    Participant.find({ experimentId }).lean(),
    Session.find({ experimentId }).lean(),
    Survey.find({ experimentId }).lean(),
    Conversation.find({ experimentId }).lean(),
  ]);

  const completeParticipants = participants.filter((p) => p.status === "complete");
  const inProgressParticipants = participants.filter(
    (p) => p.status !== "complete" && p.status !== "awaiting_consent"
  );

  const completedCount = completeParticipants.length;
  const remaining = Math.max(target - completedCount, 0);
  const percentComplete = Math.min(
    100,
    Math.round((completedCount / target) * 1000) / 10
  );

  const funnel = {
    started: participants.length,
    uniqueEmails: new Set(participants.map((p) => p.email).filter(Boolean)).size,
    demographicsDone: participants.filter((p) => p.demographicsCompleted).length,
    domainTopicChosen: participants.filter((p) => p.chosenDomainId).length,
    atLeastOneModelDone: participants.filter((p) =>
      p.modelSlots?.some((s) => s.completed)
    ).length,
    allThreeModelsDone: completedCount,
  };

  const statusBreakdown = countBy(participants, (p) => p.status);

  const domainTopicMix = countBy(
    participants.filter((p) => p.chosenDomainId && p.chosenTopicId),
    (p) => `${p.chosenDomainName || p.chosenDomainId} / ${p.chosenTopicName || p.chosenTopicId}`
  );

  // Demographics distributions (one survey per participant)
  const demoSurveys = surveys.filter((s) => s.type === "demographics");
  const demographics = {};
  for (const survey of demoSurveys) {
    for (const response of survey.responses || []) {
      if (!demographics[response.questionId]) {
        demographics[response.questionId] = {};
      }
      const answerKey = String(response.answer);
      demographics[response.questionId][answerKey] =
        (demographics[response.questionId][answerKey] || 0) + 1;
    }
  }

  const demographicsLabeled = (experiment.demographicsSchema || []).map((q) => ({
    questionId: q.id,
    question: q.question,
    type: q.type,
    distribution: demographics[q.id] || {},
    totalAnswers: Object.values(demographics[q.id] || {}).reduce(
      (a, b) => a + b,
      0
    ),
  }));

  // Model session stats
  const byModel = {};
  for (const model of experiment.models || []) {
    byModel[model] = {
      sessions: 0,
      completed: 0,
      meanTurns: null,
      meanPsi: null,
      totalInputTokens: 0,
      totalOutputTokens: 0,
    };
  }

  const turnsByModel = {};
  const psiByModel = {};

  for (const session of sessions) {
    if (!byModel[session.assignedModel]) {
      byModel[session.assignedModel] = {
        sessions: 0,
        completed: 0,
        meanTurns: null,
        meanPsi: null,
        totalInputTokens: 0,
        totalOutputTokens: 0,
      };
    }
    byModel[session.assignedModel].sessions += 1;
    if (session.status === "complete") {
      byModel[session.assignedModel].completed += 1;
    }

    if (!turnsByModel[session.assignedModel]) turnsByModel[session.assignedModel] = [];
    turnsByModel[session.assignedModel].push(session.turnsCompleted || 0);

    if (session.metrics?.psi !== null && session.metrics?.psi !== undefined) {
      if (!psiByModel[session.assignedModel]) psiByModel[session.assignedModel] = [];
      psiByModel[session.assignedModel].push(session.metrics.psi);
    }

    const convo = conversations.find(
      (c) => c.sessionId.toString() === session._id.toString()
    );
    if (convo) {
      byModel[session.assignedModel].totalInputTokens += convo.totalInputTokens || 0;
      byModel[session.assignedModel].totalOutputTokens += convo.totalOutputTokens || 0;
    }
  }

  for (const [model, bucket] of Object.entries(byModel)) {
    bucket.meanTurns = average(turnsByModel[model] || []);
    bucket.meanPsi = average(psiByModel[model] || []);
  }

  // Recompute / include live PSI rows (also covers sessions without stored metrics)
  const config = experiment.metricsConfig || {};
  const D = config.D === -1 ? -1 : 1;
  const preQuestionId = config.preStanceQuestionId || "stance_pre";
  const postQuestionId = config.postStanceQuestionId || "stance_post";

  const surveysBySession = new Map();
  for (const survey of surveys) {
    if (!survey.sessionId || !["pre", "post"].includes(survey.type)) continue;
    surveysBySession.set(`${survey.sessionId.toString()}:${survey.type}`, survey);
  }

  const storedPsiRows = sessions
    .filter((s) => s.status === "complete" && s.metrics?.psi !== null && s.metrics?.psi !== undefined)
    .map((s) => ({
      sessionId: s._id,
      participantId: s.participantId,
      anonymousLabel: s.anonymousLabel,
      assignedModel: s.assignedModel,
      domainId: s.domainId,
      topicId: s.topicId,
      Apre: s.metrics.Apre,
      Apost: s.metrics.Apost,
      D: s.metrics.D,
      psi: s.metrics.psi,
      source: "stored",
    }));

  const { rows: computedRows, errors } = buildPsiRows({
    sessions,
    surveysBySession,
    D,
    preQuestionId,
    postQuestionId,
  });

  const psiRows =
    storedPsiRows.length > 0
      ? storedPsiRows
      : computedRows.map((r) => ({ ...r, source: "computed" }));

  const allPsi = psiRows.map((r) => r.psi);

  return {
    experiment: {
      id: experiment._id,
      name: experiment.name,
      active: experiment.active,
      inviteToken: experiment.inviteToken,
      slug: experiment.slug,
      description: experiment.description || "",
      isPublic: experiment.isPublic !== false,
      shareableLink: buildShareableStudyLink(experiment),
      catalogLink: buildStudiesCatalogLink(),
      models: experiment.models,
      roundCount: experiment.roundCount,
      targetParticipantCount: target,
      metricsConfig: {
        preStanceQuestionId: preQuestionId,
        postStanceQuestionId: postQuestionId,
        D,
        Tmax: config.Tmax || experiment.roundCount,
      },
    },
    progress: {
      target,
      completedParticipants: completedCount,
      startedParticipants: participants.length,
      inProgressParticipants: inProgressParticipants.length,
      remaining,
      percentComplete,
      goalReached: completedCount >= target,
      label: `${completedCount} / ${target} complete participants (${percentComplete}%)`,
    },
    funnel,
    statusBreakdown,
    domainTopicMix,
    demographics: demographicsLabeled,
    byModel,
    metrics: {
      psi: {
        n: allPsi.length,
        mean: average(allPsi),
        byModel: summarizePsiByModel(psiRows),
        rows: psiRows,
        skipped: storedPsiRows.length > 0 ? [] : errors,
        automated: true,
      },
    },
    recentActivity: {
      lastParticipantAt: participants.reduce(
        (latest, p) =>
          !latest || new Date(p.createdAt) > new Date(latest)
            ? p.createdAt
            : latest,
        null
      ),
      lastSessionAt: sessions.reduce(
        (latest, s) =>
          !latest || new Date(s.createdAt) > new Date(latest)
            ? s.createdAt
            : latest,
        null
      ),
    },
  };
};

/**
 * Lightweight progress cards for every experiment on the admin dashboard.
 */
const buildDashboardSummaries = async (experiments) => {
  const summaries = [];

  for (const experiment of experiments) {
    const target = experiment.targetParticipantCount || 500;
    const [started, completed, sessionComplete] = await Promise.all([
      Participant.countDocuments({ experimentId: experiment._id }),
      Participant.countDocuments({
        experimentId: experiment._id,
        status: "complete",
      }),
      Session.countDocuments({
        experimentId: experiment._id,
        status: "complete",
      }),
    ]);

    const remaining = Math.max(target - completed, 0);
    const percentComplete = Math.min(
      100,
      Math.round((completed / target) * 1000) / 10
    );

    const completedSessions = await Session.find({
      experimentId: experiment._id,
      status: "complete",
      "metrics.psi": { $ne: null },
    })
      .select("assignedModel metrics.psi")
      .lean();

    const psiByModel = {};
    for (const session of completedSessions) {
      const model = session.assignedModel;
      if (!psiByModel[model]) psiByModel[model] = [];
      psiByModel[model].push(session.metrics.psi);
    }

    const meanPsiByModel = Object.fromEntries(
      Object.entries(psiByModel).map(([model, values]) => [
        model,
        { n: values.length, meanPsi: average(values) },
      ])
    );

    summaries.push({
      id: experiment._id,
      name: experiment.name,
      active: experiment.active,
      inviteToken: experiment.inviteToken,
      slug: experiment.slug,
      description: experiment.description || "",
      isPublic: experiment.isPublic !== false,
      shareableLink: buildShareableStudyLink(experiment),
      catalogLink: buildStudiesCatalogLink(),
      models: experiment.models,
      targetParticipantCount: target,
      progress: {
        target,
        startedParticipants: started,
        completedParticipants: completed,
        completedSessions: sessionComplete,
        remaining,
        percentComplete,
        goalReached: completed >= target,
        label: `${completed} / ${target} (${percentComplete}%)`,
      },
      meanPsiByModel,
    });
  }

  return summaries;
};

module.exports = {
  buildExperimentAnalytics,
  buildDashboardSummaries,
};
