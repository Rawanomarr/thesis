const express = require("express");
const rateLimit = require("express-rate-limit");
const {
  loadPublicExperiment,
  requireParticipant,
  requireSession,
} = require("../middleware/participantAuth");
const { validate } = require("../utils/validate");
const {
  surveyResponsesSchema,
  consentSchema,
  domainTopicSchema,
  selectModelSchema,
  chatMessageSchema,
} = require("../utils/participantSchemas");
const {
  listPublicStudies,
  getStudyInfo,
  consent,
  getMe,
  selectDomainTopic,
  listModels,
  selectModel,
  getSession,
} = require("../controllers/participantController");
const {
  submitDemographics,
  submitPreSurvey,
  submitPostSurvey,
} = require("../controllers/surveyController");
const { sendMessage } = require("../controllers/chatController");

const router = express.Router();

const startLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many study starts from this IP" },
});

const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many chat messages — slow down" },
});

// Public discovery + study entry (no auth) — experiments are openly listed
router.get("/studies", listPublicStudies);
router.get("/study/:slugOrToken", loadPublicExperiment, getStudyInfo);
router.post(
  "/study/:slugOrToken/consent",
  startLimiter,
  loadPublicExperiment,
  validate(consentSchema),
  consent
);

// Authenticated participant (header: X-Participant-Token)
router.get("/participant/me", requireParticipant, getMe);
router.post(
  "/participant/demographics",
  requireParticipant,
  validate(surveyResponsesSchema),
  submitDemographics
);
router.post(
  "/participant/domain-topic",
  requireParticipant,
  validate(domainTopicSchema),
  selectDomainTopic
);
router.get("/participant/models", requireParticipant, listModels);
router.post(
  "/participant/models/select",
  requireParticipant,
  validate(selectModelSchema),
  selectModel
);

router.get(
  "/participant/sessions/:sessionToken",
  requireParticipant,
  requireSession,
  getSession
);
router.post(
  "/participant/sessions/:sessionToken/surveys/pre",
  requireParticipant,
  requireSession,
  validate(surveyResponsesSchema),
  submitPreSurvey
);
router.post(
  "/participant/sessions/:sessionToken/chat",
  chatLimiter,
  requireParticipant,
  requireSession,
  validate(chatMessageSchema),
  sendMessage
);
router.post(
  "/participant/sessions/:sessionToken/surveys/post",
  requireParticipant,
  requireSession,
  validate(surveyResponsesSchema),
  submitPostSurvey
);

module.exports = router;
