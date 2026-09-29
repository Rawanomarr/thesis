const { Survey } = require("../models");
const {
  validateRequiredResponses,
  findDomainTopic,
} = require("../utils/surveyValidation");
const {
  publicParticipant,
  publicSession,
} = require("../utils/participantView");
const { computeSessionPsi } = require("../services/autoMetrics");

const submitDemographics = async (req, res, next) => {
  try {
    const participant = req.participant;
    const experiment = req.experiment;

    if (participant.status !== "awaiting_demographics") {
      return res.status(400).json({
        message: "Demographics already submitted or not expected now",
      });
    }

    const validation = validateRequiredResponses(
      experiment.demographicsSchema,
      req.body.responses
    );

    if (!validation.ok) {
      return res.status(400).json(validation);
    }

    await Survey.create({
      experimentId: experiment._id,
      participantId: participant._id,
      sessionId: null,
      domainId: null,
      topicId: null,
      type: "demographics",
      responses: validation.responses,
    });

    participant.demographicsCompleted = true;
    participant.status = "awaiting_domain_topic";
    await participant.save();

    return res.status(201).json({
      participant: publicParticipant(participant, experiment),
      domains: experiment.domains.map((domain) => ({
        id: domain.id,
        name: domain.name,
        topics: domain.topics.map((topic) => ({
          id: topic.id,
          name: topic.name,
        })),
      })),
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: "Demographics already submitted" });
    }
    return next(error);
  }
};

const submitPreSurvey = async (req, res, next) => {
  try {
    const session = req.sessionDoc;
    const participant = req.participant;
    const experiment = req.experiment;

    if (session.status !== "awaiting_pre_survey") {
      return res.status(400).json({ message: "Pre-survey not expected now" });
    }

    const match = findDomainTopic(experiment, session.domainId, session.topicId);

    if (!match) {
      return res.status(400).json({ message: "Topic configuration missing" });
    }

    const validation = validateRequiredResponses(
      match.topic.surveySchema.pre,
      req.body.responses
    );

    if (!validation.ok) {
      return res.status(400).json(validation);
    }

    await Survey.create({
      experimentId: experiment._id,
      participantId: participant._id,
      sessionId: session._id,
      domainId: session.domainId,
      topicId: session.topicId,
      type: "pre",
      responses: validation.responses,
    });

    session.status = "in_conversation";
    session.startTime = new Date();
    await session.save();

    return res.status(201).json({
      session: publicSession(session),
      participant: publicParticipant(participant, experiment),
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: "Pre-survey already submitted" });
    }
    return next(error);
  }
};

const submitPostSurvey = async (req, res, next) => {
  try {
    const session = req.sessionDoc;
    const participant = req.participant;
    const experiment = req.experiment;

    if (session.status !== "awaiting_post_survey") {
      return res.status(400).json({
        message: "Post-survey is only available after the conversation ends",
      });
    }

    const match = findDomainTopic(experiment, session.domainId, session.topicId);

    if (!match) {
      return res.status(400).json({ message: "Topic configuration missing" });
    }

    const validation = validateRequiredResponses(
      match.topic.surveySchema.post,
      req.body.responses
    );

    if (!validation.ok) {
      return res.status(400).json(validation);
    }

    await Survey.create({
      experimentId: experiment._id,
      participantId: participant._id,
      sessionId: session._id,
      domainId: session.domainId,
      topicId: session.topicId,
      type: "post",
      responses: validation.responses,
    });

    const preSurvey = await Survey.findOne({
      sessionId: session._id,
      type: "pre",
    }).lean();

    const auto = computeSessionPsi({
      experiment,
      preResponses: preSurvey?.responses || [],
      postResponses: validation.responses,
    });

    session.metrics = {
      Apre: auto.Apre,
      Apost: auto.Apost,
      D: auto.D,
      psi: auto.psi,
      computedAt: auto.computedAt,
    };
    session.status = "complete";
    await session.save();

    const slot = participant.modelSlots.find(
      (item) => item.label === session.anonymousLabel
    );

    if (slot) {
      slot.completed = true;
      slot.sessionId = session._id;
    }

    const allDone = participant.modelSlots.every((item) => item.completed);
    participant.status = allDone ? "complete" : "awaiting_model";
    await participant.save();

    return res.status(201).json({
      session: publicSession(session),
      participant: publicParticipant(participant, experiment),
      studyComplete: allDone,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: "Post-survey already submitted" });
    }
    return next(error);
  }
};

module.exports = {
  submitDemographics,
  submitPreSurvey,
  submitPostSurvey,
};
