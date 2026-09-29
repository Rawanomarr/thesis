const express = require("express");
const { protectAdmin, requireExperimentAccess } = require("../middleware/auth");
const {
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
} = require("../controllers/adminController");
const {
  listQuestionTypes,
  createExperiment,
  getExperiment,
  listMyExperiments,
  setDemographicsSurvey,
  setTopicSurvey,
  addSurveyQuestion,
  getSurveys,
} = require("../controllers/experimentController");
const { validate } = require("../utils/validate");
const {
  createExperimentSchema,
  updateDemographicsSchema,
  updateTopicSurveySchema,
  addQuestionSchema,
} = require("../utils/adminExperimentSchemas");

const router = express.Router();

// Every /api/admin/* route requires a valid admin JWT — never participant tokens
router.use(protectAdmin);

router.get("/dashboard", getDashboard);
router.get("/question-types", listQuestionTypes);
router.get("/experiments", listMyExperiments);
router.post(
  "/experiments",
  validate(createExperimentSchema),
  createExperiment
);

router.get(
  "/experiments/:experimentId",
  requireExperimentAccess,
  getExperiment
);
router.get(
  "/experiments/:experimentId/surveys",
  requireExperimentAccess,
  getSurveys
);
router.put(
  "/experiments/:experimentId/surveys/demographics",
  requireExperimentAccess,
  validate(updateDemographicsSchema),
  setDemographicsSurvey
);
router.put(
  "/experiments/:experimentId/domains/:domainId/topics/:topicId/surveys",
  requireExperimentAccess,
  validate(updateTopicSurveySchema),
  setTopicSurvey
);
router.post(
  "/experiments/:experimentId/surveys/:target/questions",
  requireExperimentAccess,
  validate(addQuestionSchema),
  addSurveyQuestion
);

router.get(
  "/experiments/:experimentId/analytics",
  requireExperimentAccess,
  getExperimentAnalytics
);

router.get(
  "/experiments/:experimentId/metrics",
  requireExperimentAccess,
  getExperimentMetrics
);

router.get(
  "/experiments/:experimentId/sessions",
  requireExperimentAccess,
  listExperimentSessions
);

router.get(
  "/experiments/:experimentId/participants",
  requireExperimentAccess,
  listExperimentParticipants
);

router.post("/metrics/psi", computePsi);
router.post("/metrics/jsd", computeJsd);
router.post("/metrics/belief-vector", computeBelief);
router.post("/metrics/cfr", computeCfr);
router.post("/metrics/ece", computeEce);
router.post("/metrics/judge-bias", computeJudgeBias);
router.post("/metrics/avg-turn", computeAvgTurn);
router.post("/metrics/trust", computeTrust);

module.exports = router;
