const { Experiment, Participant, Session } = require("../models");

const PARTICIPANT_HEADER = "x-participant-token";

/**
 * Resolve a public study by slug OR inviteToken.
 * Only active + public experiments are joinable this way.
 */
const loadPublicExperiment = async (req, res, next) => {
  try {
    const key = req.params.slugOrToken || req.params.inviteToken;

    if (!key) {
      return res.status(400).json({ message: "Study identifier required" });
    }

    const experiment = await Experiment.findOne({
      active: true,
      isPublic: true,
      $or: [{ slug: key.toLowerCase() }, { inviteToken: key }],
    });

    if (!experiment) {
      return res.status(404).json({ message: "Study not found or not public" });
    }

    req.experiment = experiment;
    return next();
  } catch (error) {
    return next(error);
  }
};

// Backwards-compatible alias
const loadExperimentByInvite = loadPublicExperiment;

const requireParticipant = async (req, res, next) => {
  try {
    const token =
      req.headers[PARTICIPANT_HEADER] ||
      req.headers.authorization?.replace(/^Participant\s+/i, "");

    if (!token) {
      return res.status(401).json({ message: "Participant token required" });
    }

    const participant = await Participant.findOne({ participantToken: token });

    if (!participant) {
      return res.status(401).json({ message: "Invalid participant token" });
    }

    const experiment = await Experiment.findById(participant.experimentId);

    if (!experiment || !experiment.active) {
      return res.status(403).json({ message: "Study is no longer active" });
    }

    req.participant = participant;
    req.experiment = experiment;
    return next();
  } catch (error) {
    return next(error);
  }
};

const requireSession = async (req, res, next) => {
  try {
    const session = await Session.findOne({
      sessionToken: req.params.sessionToken,
      participantId: req.participant._id,
    });

    if (!session) {
      return res.status(404).json({ message: "Session not found" });
    }

    req.sessionDoc = session;
    return next();
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  loadPublicExperiment,
  loadExperimentByInvite,
  requireParticipant,
  requireSession,
  PARTICIPANT_HEADER,
};
