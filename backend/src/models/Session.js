const mongoose = require("mongoose");

/**
 * One Session = one model evaluation (pre → chat → post) for a participant.
 * A participant completes exactly three sessions (labels X, Y, Z).
 */
const sessionSchema = new mongoose.Schema({
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
  sessionToken: { type: String, required: true, unique: true, index: true },
  // UI label only (X / Y / Z)
  anonymousLabel: { type: String, required: true },
  // Real provider — server-side only; never return this to the participant client
  assignedModel: { type: String, required: true },
  // Copied from participant choice at session start
  domainId: { type: String, required: true },
  domainName: { type: String, required: true },
  topicId: { type: String, required: true },
  topicName: { type: String, required: true },
  // Copied from experiment so later config edits don't affect in-progress runs
  roundCount: { type: Number, required: true, min: 1 },
  turnsCompleted: { type: Number, default: 0, min: 0 },
  startTime: { type: Date, default: null },
  endedReason: {
    type: String,
    enum: ["roundsComplete"],
    default: undefined,
  },
  status: {
    type: String,
    enum: ["awaiting_pre_survey", "in_conversation", "awaiting_post_survey", "complete"],
    default: "awaiting_pre_survey",
    index: true,
  },
  // Auto-computed when post-survey is submitted (admin benchmarking)
  metrics: {
    Apre: { type: Number, default: null },
    Apost: { type: Number, default: null },
    D: { type: Number, default: null },
    psi: { type: Number, default: null },
    computedAt: { type: Date, default: null },
  },
  createdAt: { type: Date, default: Date.now },
});

sessionSchema.index({ experimentId: 1, assignedModel: 1, status: 1 });
sessionSchema.index({ participantId: 1, anonymousLabel: 1 }, { unique: true });
sessionSchema.index({ experimentId: 1, domainId: 1, topicId: 1 });

module.exports = mongoose.model("Session", sessionSchema);
