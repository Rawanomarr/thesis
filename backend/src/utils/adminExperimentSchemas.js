const { z } = require("zod");
const { toSlug } = require("./studyLink");

const QUESTION_TYPES = [
  "text",
  "textarea",
  "likert",
  "single_choice",
  "multiple_choice",
];

const surveyQuestionSchema = z
  .object({
    id: z
      .string()
      .trim()
      .min(1)
      .max(64)
      .regex(/^[a-zA-Z0-9_-]+$/, "id must be alphanumeric/underscore/dash"),
    question: z.string().trim().min(1).max(1000),
    type: z.enum(QUESTION_TYPES),
    options: z.array(z.string().trim().min(1)).default([]),
    scaleMin: z.number().int().min(0).max(10).optional(),
    scaleMax: z.number().int().min(1).max(10).optional(),
    placeholder: z.string().trim().max(200).optional().default(""),
    required: z.boolean().optional().default(true),
  })
  .superRefine((q, ctx) => {
    if (q.type === "likert") {
      const min = q.scaleMin ?? 1;
      const max = q.scaleMax ?? 7;
      if (max <= min) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "likert scaleMax must be greater than scaleMin",
          path: ["scaleMax"],
        });
      }
    }

    if (
      (q.type === "single_choice" || q.type === "multiple_choice") &&
      (!q.options || q.options.length < 2)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "MCQ questions need at least 2 options",
        path: ["options"],
      });
    }
  })
  .transform((q) => {
    if (q.type === "likert") {
      const min = q.scaleMin ?? 1;
      const max = q.scaleMax ?? 7;
      const options =
        q.options?.length > 0
          ? q.options
          : Array.from({ length: max - min + 1 }, (_, i) => String(min + i));
      return {
        ...q,
        scaleMin: min,
        scaleMax: max,
        options,
      };
    }
    return q;
  });

const topicSurveySchema = z.object({
  pre: z.array(surveyQuestionSchema).default([]),
  post: z.array(surveyQuestionSchema).default([]),
});

const topicSchema = z.object({
  id: z.string().trim().min(1).max(64),
  name: z.string().trim().min(1).max(200),
  surveySchema: topicSurveySchema.default({ pre: [], post: [] }),
});

const domainSchema = z.object({
  id: z.string().trim().min(1).max(64),
  name: z.string().trim().min(1).max(200),
  topics: z.array(topicSchema).min(1),
});

const createExperimentSchema = z.object({
  name: z.string().trim().min(2).max(200),
  slug: z.string().trim().min(2).max(80).optional(),
  description: z.string().trim().max(2000).optional().default(""),
  isPublic: z.boolean().optional().default(true),
  active: z.boolean().optional().default(true),
  models: z
    .array(z.string().trim().min(1))
    .length(3)
    .optional()
    .default(["claude", "gpt", "gemini"]),
  anonymousLabels: z
    .array(z.string().trim().min(1))
    .length(3)
    .optional()
    .default(["X", "Y", "Z"]),
  roundCount: z.number().int().min(1).max(50).default(5),
  targetParticipantCount: z.number().int().min(1).optional().default(500),
  demographicsSchema: z.array(surveyQuestionSchema).optional().default([]),
  domains: z.array(domainSchema).min(1),
  metricsConfig: z
    .object({
      preStanceQuestionId: z.string().optional(),
      postStanceQuestionId: z.string().optional(),
      D: z.union([z.literal(1), z.literal(-1)]).optional(),
      Tmax: z.number().int().min(1).optional(),
    })
    .optional(),
});

const updateDemographicsSchema = z.object({
  questions: z.array(surveyQuestionSchema).min(1),
});

const updateTopicSurveySchema = z.object({
  type: z.enum(["pre", "post"]),
  questions: z.array(surveyQuestionSchema).min(1),
});

const addQuestionSchema = z.object({
  question: surveyQuestionSchema,
});

const normalizeSlug = (name, slug) => toSlug(slug || name);

module.exports = {
  QUESTION_TYPES,
  surveyQuestionSchema,
  createExperimentSchema,
  updateDemographicsSchema,
  updateTopicSurveySchema,
  addQuestionSchema,
  normalizeSlug,
};
