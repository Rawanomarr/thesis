const mongoose = require("mongoose");

const QUESTION_TYPES = [
  "text",
  "textarea",
  "likert",
  "single_choice",
  "multiple_choice",
];

const surveyQuestionSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, trim: true },
    question: { type: String, required: true, trim: true },
    type: {
      type: String,
      required: true,
      enum: QUESTION_TYPES,
    },
    // Used for single_choice / multiple_choice (and optional display labels for likert)
    options: { type: [String], default: [] },
    // Likert defaults 1–7
    scaleMin: { type: Number, default: 1 },
    scaleMax: { type: Number, default: 7 },
    placeholder: { type: String, default: "" },
    required: { type: Boolean, default: true },
  },
  { _id: false }
);

const topicSurveySchema = new mongoose.Schema(
  {
    pre: { type: [surveyQuestionSchema], default: [] },
    post: { type: [surveyQuestionSchema], default: [] },
  },
  { _id: false }
);

const topicSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    surveySchema: {
      type: topicSurveySchema,
      default: () => ({ pre: [], post: [] }),
    },
  },
  { _id: false }
);

const domainSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    topics: {
      type: [topicSchema],
      default: [],
      validate: {
        validator: (topics) => Array.isArray(topics) && topics.length > 0,
        message: "Each domain must have at least one topic",
      },
    },
  },
  { _id: false }
);

const conditionSchema = new mongoose.Schema(
  {
    key: { type: String, required: true },
    value: { type: String, required: true },
  },
  { _id: false }
);

const experimentSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Admin",
    required: true,
  },
  demographicsSchema: {
    type: [surveyQuestionSchema],
    default: [],
  },
  domains: {
    type: [domainSchema],
    default: [],
    validate: {
      validator: (domains) => Array.isArray(domains) && domains.length > 0,
      message: "At least one domain is required",
    },
  },
  conditions: {
    type: [conditionSchema],
    default: [],
  },
  models: {
    type: [String],
    default: ["claude", "gpt", "gemini"],
    validate: {
      validator: (models) => Array.isArray(models) && models.length === 3,
      message: "Exactly three models are required (shown as X, Y, Z)",
    },
  },
  anonymousLabels: {
    type: [String],
    default: ["X", "Y", "Z"],
    validate: {
      validator: (labels) => Array.isArray(labels) && labels.length === 3,
      message: "Exactly three anonymous labels are required",
    },
  },
  roundCount: { type: Number, required: true, min: 1 },
  targetParticipantCount: { type: Number, default: 500, min: 1 },
  metricsConfig: {
    preStanceQuestionId: { type: String, default: "stance_pre" },
    postStanceQuestionId: { type: String, default: "stance_post" },
    D: {
      type: Number,
      enum: [1, -1],
      default: 1,
    },
    Tmax: { type: Number, default: 5, min: 1 },
  },
  inviteToken: { type: String, required: true, unique: true, index: true },
  slug: {
    type: String,
    required: true,
    unique: true,
    index: true,
    lowercase: true,
    trim: true,
  },
  description: { type: String, default: "", trim: true },
  isPublic: { type: Boolean, default: true, index: true },
  active: { type: Boolean, default: true, index: true },
  createdAt: { type: Date, default: Date.now },
});

const Experiment = mongoose.model("Experiment", experimentSchema);
Experiment.QUESTION_TYPES = QUESTION_TYPES;

module.exports = Experiment;
