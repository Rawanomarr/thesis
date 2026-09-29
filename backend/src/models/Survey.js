const mongoose = require("mongoose");

const responseSchema = new mongoose.Schema(
  {
    questionId: { type: String, required: true },
    // Every question is required — empty/null answers are rejected at the API layer
    answer: { type: mongoose.Schema.Types.Mixed, required: true },
  },
  { _id: false }
);

const surveySchema = new mongoose.Schema({
  experimentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Experiment",
    required: true,
    index: true,
  },
  participantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Participant",
    required: true,
    index: true,
  },
  // null for demographics (once per participant); set for pre/post (per model session)
  sessionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Session",
    default: null,
    index: true,
  },
  domainId: { type: String, default: null, index: true },
  topicId: { type: String, default: null, index: true },
  type: {
    type: String,
    enum: ["demographics", "pre", "post"],
    required: true,
  },
  responses: {
    type: [responseSchema],
    default: [],
    validate: {
      validator: (responses) => Array.isArray(responses) && responses.length > 0,
      message: "All questions require a response",
    },
  },
  submittedAt: { type: Date, default: Date.now },
});

// Demographics once per participant
surveySchema.index(
  { participantId: 1, type: 1 },
  {
    unique: true,
    partialFilterExpression: { type: "demographics" },
  }
);

// One pre and one post per model session
surveySchema.index(
  { sessionId: 1, type: 1 },
  {
    unique: true,
    partialFilterExpression: { type: { $in: ["pre", "post"] } },
  }
);

surveySchema.index({ experimentId: 1, domainId: 1, topicId: 1 });

module.exports = mongoose.model("Survey", surveySchema);
