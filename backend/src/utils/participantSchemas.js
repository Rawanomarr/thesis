const { z } = require("zod");

const responseItemSchema = z.object({
  questionId: z.string().min(1),
  answer: z.any(),
});

const surveyResponsesSchema = z.object({
  responses: z.array(responseItemSchema).min(1),
});

const consentSchema = z.object({
  email: z
    .string()
    .trim()
    .email("A valid email is required")
    .max(254)
    .transform((value) => value.toLowerCase()),
  consent: z
    .boolean()
    .refine((value) => value === true, {
      message: "Consent must be accepted",
    }),
});

const domainTopicSchema = z.object({
  domainId: z.string().min(1),
  topicId: z.string().min(1),
});

const selectModelSchema = z.object({
  label: z.string().min(1),
});

const chatMessageSchema = z.object({
  message: z.string().trim().min(1).max(4000),
});

module.exports = {
  surveyResponsesSchema,
  consentSchema,
  domainTopicSchema,
  selectModelSchema,
  chatMessageSchema,
};
