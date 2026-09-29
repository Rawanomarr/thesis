const { Conversation } = require("../models");
const { generateReply } = require("../services/llm");
const {
  publicSession,
  publicConversation,
  publicParticipant,
} = require("../utils/participantView");

const buildSystemPrompt = (session) => {
  return [
    "You are an anonymous debate partner in a research study.",
    "Do not reveal which AI model or company you are.",
    "Do not claim to be Claude, GPT, ChatGPT, Gemini, or any named product.",
    `Domain: ${session.domainName}.`,
    `Topic: ${session.topicName}.`,
    "Engage in a thoughtful, respectful argumentative dialogue on this topic.",
    "Keep replies concise (a few short paragraphs).",
  ].join(" ");
};

const sendMessage = async (req, res, next) => {
  try {
    const session = req.sessionDoc;
    const participant = req.participant;
    const { message } = req.body;

    if (session.status !== "in_conversation") {
      return res.status(400).json({
        message:
          session.status === "awaiting_pre_survey"
            ? "Complete the pre-survey before chatting"
            : session.status === "awaiting_post_survey"
              ? "Conversation ended — continue to the post-survey"
              : "Conversation is not active",
      });
    }

    if (session.turnsCompleted >= session.roundCount) {
      session.status = "awaiting_post_survey";
      session.endedReason = "roundsComplete";
      await session.save();
      return res.status(400).json({
        message: "Turn limit reached",
        session: publicSession(session),
        redirectTo: "post_survey",
      });
    }

    const content = typeof message === "string" ? message.trim() : "";

    if (!content) {
      return res.status(400).json({ message: "message is required" });
    }

    if (content.length > 4000) {
      return res.status(400).json({ message: "message is too long" });
    }

    let conversation = await Conversation.findOne({ sessionId: session._id });

    if (!conversation) {
      conversation = await Conversation.create({
        sessionId: session._id,
        participantId: participant._id,
        experimentId: session.experimentId,
        turns: [],
      });
    }

    const nextRound = session.turnsCompleted + 1;

    const llmMessages = [
      { role: "system", content: buildSystemPrompt(session) },
      ...conversation.turns.map((turn) => ({
        role: turn.role === "participant" ? "user" : "assistant",
        content: turn.content,
      })),
      { role: "user", content },
    ];

    const reply = await generateReply(session.assignedModel, llmMessages);

    conversation.turns.push({
      turnNumber: nextRound,
      role: "participant",
      content,
      inputTokens: 0,
      outputTokens: 0,
      timestamp: new Date(),
    });

    conversation.turns.push({
      turnNumber: nextRound,
      role: "assistant",
      content: reply.content,
      inputTokens: reply.inputTokens,
      outputTokens: reply.outputTokens,
      timestamp: new Date(),
    });

    conversation.totalInputTokens += reply.inputTokens;
    conversation.totalOutputTokens += reply.outputTokens;
    await conversation.save();

    session.turnsCompleted = nextRound;

    const roundsDone = session.turnsCompleted >= session.roundCount;

    if (roundsDone) {
      session.status = "awaiting_post_survey";
      session.endedReason = "roundsComplete";
    }

    await session.save();

    return res.json({
      session: publicSession(session),
      conversation: publicConversation(conversation),
      assistantMessage: {
        turnNumber: nextRound,
        role: "assistant",
        content: reply.content,
      },
      conversationEnded: roundsDone,
      redirectTo: roundsDone ? "post_survey" : null,
      participant: publicParticipant(participant, req.experiment),
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  sendMessage,
};
