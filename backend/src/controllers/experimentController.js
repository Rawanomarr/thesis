const crypto = require("crypto");
const { Experiment, Admin } = require("../models");
const {
  normalizeSlug,
  QUESTION_TYPES,
} = require("../utils/adminExperimentSchemas");
const {
  buildShareableStudyLink,
  buildStudiesCatalogLink,
} = require("../utils/studyLink");

const findOwnedExperiment = async (admin, experimentId) => {
  const allowed = admin.experimentIds.some(
    (id) => id.toString() === experimentId.toString()
  );
  if (!allowed) return null;
  return Experiment.findById(experimentId);
};

const experimentPublicAdminView = (experiment) => ({
  id: experiment._id,
  name: experiment.name,
  slug: experiment.slug,
  description: experiment.description,
  isPublic: experiment.isPublic,
  active: experiment.active,
  inviteToken: experiment.inviteToken,
  shareableLink: buildShareableStudyLink(experiment),
  catalogLink: buildStudiesCatalogLink(),
  models: experiment.models,
  anonymousLabels: experiment.anonymousLabels,
  roundCount: experiment.roundCount,
  targetParticipantCount: experiment.targetParticipantCount,
  metricsConfig: experiment.metricsConfig,
  demographicsSchema: experiment.demographicsSchema,
  domains: experiment.domains,
  questionTypes: QUESTION_TYPES,
  createdAt: experiment.createdAt,
});

const listQuestionTypes = (req, res) => {
  return res.json({
    questionTypes: [
      {
        type: "text",
        label: "Short text",
        description: "Single-line free text",
      },
      {
        type: "textarea",
        label: "Long text",
        description: "Multi-line free text",
      },
      {
        type: "likert",
        label: "Likert scale",
        description: "Numeric scale (default 1–7)",
        defaults: { scaleMin: 1, scaleMax: 7 },
      },
      {
        type: "single_choice",
        label: "Multiple choice (one answer)",
        description: "MCQ — participant picks one option",
        requiresOptions: true,
      },
      {
        type: "multiple_choice",
        label: "Multiple choice (many answers)",
        description: "MCQ — participant may pick several options",
        requiresOptions: true,
      },
    ],
  });
};

const createExperiment = async (req, res, next) => {
  try {
    const body = req.body;
    const slug = normalizeSlug(body.name, body.slug);

    const clash = await Experiment.findOne({
      $or: [{ slug }, { name: body.name }],
    });
    if (clash) {
      return res.status(409).json({
        message: "An experiment with this name or slug already exists",
      });
    }

    const inviteToken = crypto.randomBytes(24).toString("hex");

    const experiment = await Experiment.create({
      name: body.name,
      slug,
      description: body.description || "",
      isPublic: body.isPublic !== false,
      active: body.active !== false,
      createdBy: req.admin._id,
      demographicsSchema: body.demographicsSchema || [],
      domains: body.domains,
      models: body.models,
      anonymousLabels: body.anonymousLabels,
      roundCount: body.roundCount,
      targetParticipantCount: body.targetParticipantCount || 500,
      metricsConfig: {
        preStanceQuestionId: body.metricsConfig?.preStanceQuestionId || "stance_pre",
        postStanceQuestionId: body.metricsConfig?.postStanceQuestionId || "stance_post",
        D: body.metricsConfig?.D === -1 ? -1 : 1,
        Tmax: body.metricsConfig?.Tmax || body.roundCount,
      },
      inviteToken,
    });

    await Admin.findByIdAndUpdate(req.admin._id, {
      $addToSet: { experimentIds: experiment._id },
    });

    req.admin.experimentIds.push(experiment._id);

    return res.status(201).json({
      experiment: experimentPublicAdminView(experiment),
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: "Slug or invite token conflict" });
    }
    return next(error);
  }
};

const getExperiment = async (req, res, next) => {
  try {
    const experiment = await findOwnedExperiment(
      req.admin,
      req.params.experimentId
    );
    if (!experiment) {
      return res.status(404).json({ message: "Experiment not found" });
    }
    return res.json({ experiment: experimentPublicAdminView(experiment) });
  } catch (error) {
    return next(error);
  }
};

const listMyExperiments = async (req, res, next) => {
  try {
    const experiments = await Experiment.find({
      _id: { $in: req.admin.experimentIds },
    }).sort({ createdAt: -1 });

    return res.json({
      count: experiments.length,
      experiments: experiments.map(experimentPublicAdminView),
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * Replace demographics survey questions for an experiment.
 */
const setDemographicsSurvey = async (req, res, next) => {
  try {
    const experiment = await findOwnedExperiment(
      req.admin,
      req.params.experimentId
    );
    if (!experiment) {
      return res.status(404).json({ message: "Experiment not found" });
    }

    experiment.demographicsSchema = req.body.questions;
    await experiment.save();

    return res.json({
      message: "Demographics survey updated",
      demographicsSchema: experiment.demographicsSchema,
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * Replace pre or post survey for a domain/topic.
 */
const setTopicSurvey = async (req, res, next) => {
  try {
    const { domainId, topicId } = req.params;
    const { type, questions } = req.body;

    const experiment = await findOwnedExperiment(
      req.admin,
      req.params.experimentId
    );
    if (!experiment) {
      return res.status(404).json({ message: "Experiment not found" });
    }

    const domain = experiment.domains.find((d) => d.id === domainId);
    if (!domain) {
      return res.status(404).json({ message: "Domain not found" });
    }

    const topic = domain.topics.find((t) => t.id === topicId);
    if (!topic) {
      return res.status(404).json({ message: "Topic not found" });
    }

    if (!topic.surveySchema) {
      topic.surveySchema = { pre: [], post: [] };
    }
    topic.surveySchema[type] = questions;
    experiment.markModified("domains");
    await experiment.save();

    return res.json({
      message: `${type} survey updated for topic ${topicId}`,
      domainId,
      topicId,
      surveySchema: topic.surveySchema,
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * Append one question to demographics or topic pre/post survey.
 */
const addSurveyQuestion = async (req, res, next) => {
  try {
    const { target } = req.params; // demographics | pre | post
    const { domainId, topicId } = req.query;
    const question = req.body.question;

    const experiment = await findOwnedExperiment(
      req.admin,
      req.params.experimentId
    );
    if (!experiment) {
      return res.status(404).json({ message: "Experiment not found" });
    }

    if (target === "demographics") {
      const exists = experiment.demographicsSchema.some((q) => q.id === question.id);
      if (exists) {
        return res.status(409).json({ message: "Question id already exists in demographics" });
      }
      experiment.demographicsSchema.push(question);
      await experiment.save();
      return res.status(201).json({
        message: "Demographics question added",
        demographicsSchema: experiment.demographicsSchema,
      });
    }

    if (!["pre", "post"].includes(target)) {
      return res.status(400).json({ message: "target must be demographics, pre, or post" });
    }

    if (!domainId || !topicId) {
      return res.status(400).json({
        message: "domainId and topicId query params are required for pre/post",
      });
    }

    const domain = experiment.domains.find((d) => d.id === domainId);
    if (!domain) return res.status(404).json({ message: "Domain not found" });
    const topic = domain.topics.find((t) => t.id === topicId);
    if (!topic) return res.status(404).json({ message: "Topic not found" });

    if (!topic.surveySchema) topic.surveySchema = { pre: [], post: [] };
    const list = topic.surveySchema[target];
    if (list.some((q) => q.id === question.id)) {
      return res.status(409).json({ message: "Question id already exists in this survey" });
    }
    list.push(question);
    experiment.markModified("domains");
    await experiment.save();

    return res.status(201).json({
      message: `${target} question added`,
      domainId,
      topicId,
      surveySchema: topic.surveySchema,
    });
  } catch (error) {
    return next(error);
  }
};

const getSurveys = async (req, res, next) => {
  try {
    const experiment = await findOwnedExperiment(
      req.admin,
      req.params.experimentId
    );
    if (!experiment) {
      return res.status(404).json({ message: "Experiment not found" });
    }

    return res.json({
      experimentId: experiment._id,
      questionTypes: QUESTION_TYPES,
      demographics: experiment.demographicsSchema,
      topics: experiment.domains.flatMap((domain) =>
        domain.topics.map((topic) => ({
          domainId: domain.id,
          domainName: domain.name,
          topicId: topic.id,
          topicName: topic.name,
          pre: topic.surveySchema?.pre || [],
          post: topic.surveySchema?.post || [],
        }))
      ),
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  listQuestionTypes,
  createExperiment,
  getExperiment,
  listMyExperiments,
  setDemographicsSurvey,
  setTopicSurvey,
  addSurveyQuestion,
  getSurveys,
};
