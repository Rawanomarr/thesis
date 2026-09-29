/**
 * Safe participant-facing serializers — never include real model provider names.
 */

const publicModelSlots = (modelSlots = []) =>
  modelSlots.map((slot) => ({
    label: slot.label,
    completed: Boolean(slot.completed),
    available: !slot.completed,
  }));

const publicParticipant = (participant, experiment) => ({
  participantToken: participant.participantToken,
  email: participant.email,
  status: participant.status,
  demographicsCompleted: participant.demographicsCompleted,
  chosenDomainId: participant.chosenDomainId,
  chosenDomainName: participant.chosenDomainName,
  chosenTopicId: participant.chosenTopicId,
  chosenTopicName: participant.chosenTopicName,
  models: publicModelSlots(participant.modelSlots),
  completedModelCount: participant.modelSlots.filter((s) => s.completed).length,
  totalModels: participant.modelSlots.length,
  experiment: experiment
    ? {
        id: experiment._id,
        name: experiment.name,
        roundCount: experiment.roundCount,
      }
    : undefined,
});

const publicSession = (session) => ({
  sessionToken: session.sessionToken,
  anonymousLabel: session.anonymousLabel,
  domainId: session.domainId,
  domainName: session.domainName,
  topicId: session.topicId,
  topicName: session.topicName,
  roundCount: session.roundCount,
  turnsCompleted: session.turnsCompleted,
  status: session.status,
  endedReason: session.endedReason || null,
});

const publicConversation = (conversation) => ({
  turns: (conversation?.turns || []).map((turn) => ({
    turnNumber: turn.turnNumber,
    role: turn.role,
    content: turn.content,
    timestamp: turn.timestamp,
  })),
});

const publicDomains = (experiment) =>
  (experiment.domains || []).map((domain) => ({
    id: domain.id,
    name: domain.name,
    topics: domain.topics.map((topic) => ({
      id: topic.id,
      name: topic.name,
    })),
  }));

module.exports = {
  publicParticipant,
  publicSession,
  publicConversation,
  publicDomains,
  publicModelSlots,
};
