const {
  Experiment,
  Session,
  Participant,
} = require("../models");
const {
  buildDashboardSummaries,
  buildExperimentAnalytics,
} = require("../services/analyticsService");
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
} = require("../services/metricsService");

const getDashboard = async (req, res, next) => {
  try {
    const experimentIds = req.admin.experimentIds || [];

    const experiments = await Experiment.find({
      _id: { $in: experimentIds },
    }).select(
      "name active inviteToken models createdAt roundCount targetParticipantCount metricsConfig"
    );

    const summaries = await buildDashboardSummaries(experiments);

    const totals = summaries.reduce(
      (acc, item) => {
        acc.target += item.progress.target;
        acc.completed += item.progress.completedParticipants;
        acc.started += item.progress.startedParticipants;
        return acc;
      },
      { target: 0, completed: 0, started: 0 }
    );

    return res.json({
      admin: {
        id: req.admin._id,
        username: req.admin.username,
        experimentIds: req.admin.experimentIds,
      },
      totals: {
        ...totals,
        remaining: Math.max(totals.target - totals.completed, 0),
        percentComplete:
          totals.target === 0
            ? 0
            : Math.min(
                100,
                Math.round((totals.completed / totals.target) * 1000) / 10
              ),
      },
      experiments: summaries,
    });
  } catch (error) {
    return next(error);
  }
};

const getExperimentAnalytics = async (req, res, next) => {
  try {
    const experiment = await Experiment.findById(req.params.experimentId);

    if (!experiment) {
      return res.status(404).json({ message: "Experiment not found" });
    }

    const analytics = await buildExperimentAnalytics(experiment);
    return res.json(analytics);
  } catch (error) {
    return next(error);
  }
};

const listExperimentSessions = async (req, res, next) => {
  try {
    const sessions = await Session.find({
      experimentId: req.params.experimentId,
    })
      .sort({ createdAt: -1 })
      .lean();

    return res.json({ sessions });
  } catch (error) {
    return next(error);
  }
};

const listExperimentParticipants = async (req, res, next) => {
  try {
    const participants = await Participant.find({
      experimentId: req.params.experimentId,
    })
      .select(
        "email status demographicsCompleted chosenDomainId chosenDomainName chosenTopicId chosenTopicName modelSlots consentedAt createdAt participantPseudoId"
      )
      .sort({ createdAt: -1 })
      .lean();

    const safe = participants.map((p) => ({
      id: p._id,
      email: p.email,
      participantPseudoId: p.participantPseudoId,
      status: p.status,
      demographicsCompleted: p.demographicsCompleted,
      chosenDomainId: p.chosenDomainId,
      chosenDomainName: p.chosenDomainName,
      chosenTopicId: p.chosenTopicId,
      chosenTopicName: p.chosenTopicName,
      modelsCompleted: (p.modelSlots || [])
        .filter((s) => s.completed)
        .map((s) => s.label),
      modelsRemaining: (p.modelSlots || [])
        .filter((s) => !s.completed)
        .map((s) => s.label),
      // Real model names visible to admin only
      modelMapping: (p.modelSlots || []).map((s) => ({
        label: s.label,
        model: s.model,
        completed: s.completed,
      })),
      consentedAt: p.consentedAt,
      createdAt: p.createdAt,
    }));

    return res.json({
      count: safe.length,
      participants: safe,
    });
  } catch (error) {
    return next(error);
  }
};

/** Alias: metrics view is the full analytics payload (includes automated PSI). */
const getExperimentMetrics = async (req, res, next) => {
  return getExperimentAnalytics(req, res, next);
};

const wrapCompute =
  (fn) =>
  async (req, res) => {
    try {
      const result = fn(req.body);
      return res.json({ result });
    } catch (error) {
      return res.status(400).json({ message: error.message });
    }
  };

const computePsi = wrapCompute((body) =>
  calculatePSI(Number(body.Apre), Number(body.Apost), Number(body.D))
);

const computeJsd = wrapCompute((body) => {
  const P = body.P || computeBeliefVector(body.scoresP, body.logProbsP);
  const Q = body.Q || computeBeliefVector(body.scoresQ, body.logProbsQ);
  return {
    P,
    Q,
    pi: calculateJSD(P, Q),
  };
});

const computeBelief = wrapCompute((body) =>
  computeBeliefVector(body.scores, body.logProbs)
);

const computeCfr = wrapCompute((body) => calculateCFR(body.labels || []));

const computeEce = wrapCompute((body) =>
  calculateECE(body.samples || [], body.numBins || 10)
);

const computeJudgeBias = wrapCompute((body) => {
  const bias = calculateJudgeBias(body.responses || []);
  return {
    ...bias,
    targetMad: calculateTargetMAD(body.responses || []),
  };
});

const computeAvgTurn = wrapCompute((body) =>
  calculateAvgTurn(body.dialogues || [], Number(body.Tmax))
);

const computeTrust = wrapCompute((body) => {
  const w =
    body.w !== undefined
      ? Number(body.w)
      : calculateEdgeWeight(
          Number(body.pDirectSupport),
          Number(body.pWeakSupport)
        );

  return {
    w,
    thetaSupport:
      body.yu !== undefined && body.yv !== undefined
        ? thetaSupport(Number(body.yu), Number(body.yv), w, Number(body.beta ?? 1))
        : undefined,
    thetaAttack:
      body.yu !== undefined && body.yv !== undefined
        ? thetaAttack(Number(body.yu), Number(body.yv), w, Number(body.gamma ?? 1))
        : undefined,
    thetaRhetorical:
      body.yv !== undefined ? thetaRhetorical(Number(body.yv)) : undefined,
  };
});

module.exports = {
  getDashboard,
  getExperimentAnalytics,
  listExperimentSessions,
  listExperimentParticipants,
  getExperimentMetrics,
  computePsi,
  computeJsd,
  computeBelief,
  computeCfr,
  computeEce,
  computeJudgeBias,
  computeAvgTurn,
  computeTrust,
};
