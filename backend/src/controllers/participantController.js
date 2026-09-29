const {
  Experiment,
  Participant,
  Session,
  Conversation,
} = require("../models");
const { createToken, createPseudoId } = require("../utils/tokens");
const { buildModelSlots } = require("../utils/modelMapping");
const { findDomainTopic } = require("../utils/surveyValidation");
const {
  publicParticipant,
  publicSession,
  publicConversation,
  publicDomains,
} = require("../utils/participantView");
const { buildShareableStudyLink, buildStudiesCatalogLink } = require("../utils/studyLink");

const publicStudyCard = (experiment) => ({
  name: experiment.name,
  slug: experiment.slug,
  description: experiment.description || "",
  shareableLink: buildShareableStudyLink(experiment),
  roundCount: experiment.roundCount,
  modelCount: (experiment.models || []).length,
  anonymousLabels: experiment.anonymousLabels,
  emailRequired: true,
  isPublic: true,
  active: experiment.active,
});

/**
 * Public catalog — anyone can list open experiments (SEO / discovery).
 */
const listPublicStudies = async (req, res, next) => {
  try {
    const experiments = await Experiment.find({
      active: true,
      isPublic: true,
    })
      .select(
        "name slug description inviteToken roundCount models anonymousLabels active isPublic createdAt"
      )
      .sort({ createdAt: -1 })
      .lean();

    return res.json({
      catalogLink: buildStudiesCatalogLink(),
      count: experiments.length,
      studies: experiments.map(publicStudyCard),
    });
  } catch (error) {
    return next(error);
  }
};

const getStudyInfo = async (req, res) => {
  const experiment = req.experiment;

  return res.json({
    ...publicStudyCard(experiment),
    inviteToken: experiment.inviteToken,
    domains: publicDomains(experiment),
    requiresConsent: true,
    entry: {
      step: "consent_and_email",
      then: [
        "demographics",
        "choose_domain_topic",
        "choose_model_xyz",
        "pre_survey",
        "conversation",
        "post_survey",
        "repeat_until_all_models",
      ],
    },
  });
};

const consent = async (req, res, next) => {
  try {
    const experiment = req.experiment;
    const email = req.body.email;

    const existing = await Participant.findOne({
      experimentId: experiment._id,
      email,
    });

    if (existing) {
      if (existing.status === "complete") {
        return res.status(409).json({
          message:
            "This email has already completed the study and cannot participate again",
          code: "ALREADY_COMPLETED",
        });
      }

      // Allow resume of an in-progress run with the same email (not a second attempt)
      return res.status(200).json({
        resumed: true,
        participant: publicParticipant(existing, experiment),
        demographicsSchema: experiment.demographicsSchema,
        message: "Welcome back — continuing your existing session",
      });
    }

    const modelSlots = buildModelSlots(
      experiment.anonymousLabels,
      experiment.models
    );

    const participant = await Participant.create({
      experimentId: experiment._id,
      participantToken: createToken(),
      participantPseudoId: createPseudoId(),
      email,
      consentedAt: new Date(),
      modelSlots,
      status: "awaiting_demographics",
    });

    return res.status(201).json({
      resumed: false,
      participant: publicParticipant(participant, experiment),
      demographicsSchema: experiment.demographicsSchema,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        message:
          "This email is already registered for this study and cannot start again",
        code: "ALREADY_REGISTERED",
      });
    }
    return next(error);
  }
};

const getMe = async (req, res) => {
  return res.json({
    participant: publicParticipant(req.participant, req.experiment),
    demographicsSchema: req.experiment.demographicsSchema,
    domains: publicDomains(req.experiment),
  });
};

const selectDomainTopic = async (req, res, next) => {
  try {
    const { domainId, topicId } = req.body;
    const participant = req.participant;

    if (participant.status !== "awaiting_domain_topic") {
      return res.status(400).json({
        message: "Domain and topic can only be chosen after demographics",
      });
    }

    if (participant.chosenDomainId) {
      return res.status(400).json({
        message: "Domain and topic are already locked for this participant",
      });
    }

    const match = findDomainTopic(req.experiment, domainId, topicId);

    if (!match) {
      return res.status(400).json({ message: "Invalid domain or topic" });
    }

    participant.chosenDomainId = match.domain.id;
    participant.chosenDomainName = match.domain.name;
    participant.chosenTopicId = match.topic.id;
    participant.chosenTopicName = match.topic.name;
    participant.status = "awaiting_model";
    await participant.save();

    return res.json({
      participant: publicParticipant(participant, req.experiment),
    });
  } catch (error) {
    return next(error);
  }
};

const listModels = async (req, res) => {
  const participant = req.participant;

  if (
    !["awaiting_model", "in_model_run", "complete"].includes(participant.status)
  ) {
    return res.status(400).json({
      message: "Choose domain and topic before selecting a model",
    });
  }

  return res.json({
    models: publicParticipant(participant).models,
    status: participant.status,
  });
};

const selectModel = async (req, res, next) => {
  try {
    const { label } = req.body;
    const participant = req.participant;
    const experiment = req.experiment;

    if (!["awaiting_model"].includes(participant.status)) {
      return res.status(400).json({
        message:
          participant.status === "in_model_run"
            ? "Finish the current model evaluation before selecting another"
            : "Not ready to select a model",
      });
    }

    if (!participant.chosenDomainId || !participant.chosenTopicId) {
      return res.status(400).json({ message: "Select a domain and topic first" });
    }

    const slot = participant.modelSlots.find((item) => item.label === label);

    if (!slot) {
      return res.status(400).json({ message: "Invalid model label" });
    }

    if (slot.completed) {
      return res.status(400).json({
        message: "This model was already evaluated — choose another",
      });
    }

    if (slot.sessionId) {
      const existing = await Session.findById(slot.sessionId);
      if (existing && existing.status !== "complete") {
        participant.status = "in_model_run";
        await participant.save();
        return res.json({
          session: publicSession(existing),
          participant: publicParticipant(participant, experiment),
          message: "Resuming existing session",
        });
      }
    }

    const match = findDomainTopic(
      experiment,
      participant.chosenDomainId,
      participant.chosenTopicId
    );

    if (!match) {
      return res.status(400).json({ message: "Configured topic no longer exists" });
    }

    const session = await Session.create({
      experimentId: experiment._id,
      participantId: participant._id,
      sessionToken: createToken(),
      anonymousLabel: slot.label,
      assignedModel: slot.model,
      domainId: match.domain.id,
      domainName: match.domain.name,
      topicId: match.topic.id,
      topicName: match.topic.name,
      roundCount: experiment.roundCount,
      status: "awaiting_pre_survey",
    });

    await Conversation.create({
      sessionId: session._id,
      participantId: participant._id,
      experimentId: experiment._id,
      turns: [],
    });

    slot.sessionId = session._id;
    participant.status = "in_model_run";
    await participant.save();

    return res.status(201).json({
      session: publicSession(session),
      preSurvey: match.topic.surveySchema.pre,
      participant: publicParticipant(participant, experiment),
    });
  } catch (error) {
    return next(error);
  }
};

const getSession = async (req, res, next) => {
  try {
    const session = req.sessionDoc;
    const conversation = await Conversation.findOne({ sessionId: session._id });
    const match = findDomainTopic(
      req.experiment,
      session.domainId,
      session.topicId
    );

    let survey = null;
    if (session.status === "awaiting_pre_survey") {
      survey = { type: "pre", questions: match?.topic.surveySchema.pre || [] };
    } else if (session.status === "awaiting_post_survey") {
      survey = { type: "post", questions: match?.topic.surveySchema.post || [] };
    }

    return res.json({
      session: publicSession(session),
      conversation: publicConversation(conversation),
      survey,
      participant: publicParticipant(req.participant, req.experiment),
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  listPublicStudies,
  getStudyInfo,
  consent,
  getMe,
  selectDomainTopic,
  listModels,
  selectModel,
  getSession,
};
