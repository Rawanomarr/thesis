const mongoose = require("mongoose");

const modelSlotSchema = new mongoose.Schema(
  {
    // What the participant sees (X / Y / Z)
    label: { type: String, required: true },
    // Real provider id — never sent to the browser
    model: { type: String, required: true },
    completed: { type: Boolean, default: false },
    sessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Session",
      default: null,
    },
  },
  { _id: false }
);

/**
 * One document per human participant.
 * Holds consent, demographics (once), domain/topic choice, and the X/Y/Z → model mapping.
 * Each model evaluation is a separate Session under this participant.
 */
const participantSchema = new mongoose.Schema({
  experimentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Experiment",
    required: true,
    index: true,
  },
  // Opaque token given to the client (never expose Mongo _id to participants)
  participantToken: { type: String, required: true, unique: true, index: true },
  participantPseudoId: { type: String, required: true },
  // Used only to prevent repeat participation in the same experiment
  email: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
  },
  consentedAt: { type: Date, default: null },
  demographicsCompleted: { type: Boolean, default: false },
  // Chosen once; reused for all three model runs
  chosenDomainId: { type: String, default: null },
  chosenDomainName: { type: String, default: null },
  chosenTopicId: { type: String, default: null },
  chosenTopicName: { type: String, default: null },
  // Randomized at consent: label X/Y/Z ↔ real model. Participant picks remaining labels only.
  modelSlots: {
    type: [modelSlotSchema],
    default: [],
  },
  status: {
    type: String,
    enum: [
      "awaiting_consent",
      "awaiting_demographics",
      "awaiting_domain_topic",
      "awaiting_model",
      "in_model_run",
      "complete",
    ],
    default: "awaiting_consent",
    index: true,
  },
  createdAt: { type: Date, default: Date.now },
});

participantSchema.index({ experimentId: 1, status: 1 });
participantSchema.index(
  { experimentId: 1, email: 1 },
  { unique: true }
);

module.exports = mongoose.model("Participant", participantSchema);
