const PORT = process.env.PORT || 5000;

const swaggerDefinition = {
  openapi: "3.0.3",
  info: {
    title: "LLM Benchmarking Platform API",
    version: "1.0.0",
    description: `
Public study + participant flow, admin analytics, and automated metrics.

**How to test in Swagger**
1. **Public:** \`GET /api/studies\` → pick a slug → consent with email
2. Copy \`participant.participantToken\` → Authorize → **ParticipantToken**
3. Walk demographics → domain-topic → models → pre → chat → post
4. **Admin:** \`POST /api/auth/login\` → copy \`token\` → Authorize → **AdminJWT** (Bearer)
    `.trim(),
  },
  servers: [
    {
      url: `http://localhost:${PORT}`,
      description: "Local",
    },
  ],
  tags: [
    { name: "Health", description: "Service health" },
    { name: "Public Studies", description: "Discoverable public experiments (no auth)" },
    { name: "Participant", description: "Study flow — header X-Participant-Token" },
    { name: "Auth", description: "Admin login / bootstrap" },
    { name: "Admin", description: "Dashboard, analytics, metrics — admin JWT only" },
    { name: "Admin Surveys", description: "Create demographics / pre / post surveys (text, likert, MCQ)" },
  ],
  components: {
    securitySchemes: {
      AdminJWT: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description: "Paste the admin token from POST /api/auth/login (without the word Bearer)",
      },
      ParticipantToken: {
        type: "apiKey",
        in: "header",
        name: "X-Participant-Token",
        description: "Paste participant.participantToken from consent response",
      },
    },
    schemas: {
      Error: {
        type: "object",
        properties: {
          message: { type: "string" },
          code: { type: "string" },
        },
      },
      ConsentBody: {
        type: "object",
        required: ["email", "consent"],
        properties: {
          email: { type: "string", format: "email", example: "participant@example.com" },
          consent: { type: "boolean", enum: [true], example: true },
        },
      },
      SurveyResponses: {
        type: "object",
        required: ["responses"],
        properties: {
          responses: {
            type: "array",
            items: {
              type: "object",
              required: ["questionId", "answer"],
              properties: {
                questionId: { type: "string", example: "age_range" },
                answer: {
                  oneOf: [
                    { type: "string" },
                    { type: "number" },
                    { type: "boolean" },
                    { type: "array", items: { type: "string" } },
                  ],
                  example: "18-24",
                },
              },
            },
          },
        },
      },
      DomainTopicBody: {
        type: "object",
        required: ["domainId", "topicId"],
        properties: {
          domainId: { type: "string", example: "climate" },
          topicId: { type: "string", example: "carbon-tax" },
        },
      },
      SelectModelBody: {
        type: "object",
        required: ["label"],
        properties: {
          label: { type: "string", enum: ["X", "Y", "Z"], example: "X" },
        },
      },
      ChatBody: {
        type: "object",
        required: ["message"],
        properties: {
          message: {
            type: "string",
            example: "I think a carbon tax is unfair to lower-income households.",
          },
        },
      },
      LoginBody: {
        type: "object",
        required: ["username", "password"],
        properties: {
          username: { type: "string", example: "admin" },
          password: { type: "string", format: "password", example: "changeme123" },
        },
      },
      SurveyQuestion: {
        type: "object",
        required: ["id", "question", "type"],
        properties: {
          id: { type: "string", example: "stance_pre" },
          question: { type: "string", example: "How strongly do you support a carbon tax?" },
          type: {
            type: "string",
            enum: ["text", "textarea", "likert", "single_choice", "multiple_choice"],
            example: "likert",
          },
          options: {
            type: "array",
            items: { type: "string" },
            description: "Required for MCQ; auto-filled 1–7 for likert if omitted",
            example: ["1", "2", "3", "4", "5", "6", "7"],
          },
          scaleMin: { type: "number", example: 1 },
          scaleMax: { type: "number", example: 7 },
          placeholder: { type: "string", example: "Type your answer" },
          required: { type: "boolean", example: true },
        },
      },
    },
  },
  paths: {
    "/health": {
      get: {
        tags: ["Health"],
        summary: "Health check",
        responses: {
          200: {
            description: "OK",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { status: { type: "string", example: "healthy" } },
                },
              },
            },
          },
        },
      },
    },
    "/api": {
      get: {
        tags: ["Health"],
        summary: "API root",
        responses: { 200: { description: "API status" } },
      },
    },
    "/api/studies": {
      get: {
        tags: ["Public Studies"],
        summary: "List public experiments (catalog)",
        responses: {
          200: { description: "Catalog of active public studies" },
        },
      },
    },
    "/api/study/{slugOrToken}": {
      get: {
        tags: ["Public Studies"],
        summary: "Get public study info",
        parameters: [
          {
            name: "slugOrToken",
            in: "path",
            required: true,
            schema: { type: "string" },
            example: "thesis-pilot-study",
          },
        ],
        responses: {
          200: { description: "Study details + domains/topics" },
          404: { description: "Not found or not public" },
        },
      },
    },
    "/api/study/{slugOrToken}/consent": {
      post: {
        tags: ["Public Studies"],
        summary: "Consent + email → start or resume participant",
        parameters: [
          {
            name: "slugOrToken",
            in: "path",
            required: true,
            schema: { type: "string" },
            example: "thesis-pilot-study",
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ConsentBody" },
            },
          },
        },
        responses: {
          201: { description: "New participant created — save participantToken" },
          200: { description: "Resumed incomplete participant" },
          409: { description: "Email already completed this study" },
        },
      },
    },
    "/api/participant/me": {
      get: {
        tags: ["Participant"],
        summary: "Current participant status",
        security: [{ ParticipantToken: [] }],
        responses: {
          200: { description: "Participant + schemas" },
          401: { description: "Missing/invalid participant token" },
        },
      },
    },
    "/api/participant/demographics": {
      post: {
        tags: ["Participant"],
        summary: "Submit demographics (once, all answers required)",
        security: [{ ParticipantToken: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/SurveyResponses" },
              example: {
                responses: [
                  { questionId: "age_range", answer: "18-24" },
                  { questionId: "education", answer: "Bachelor" },
                  { questionId: "ai_familiarity", answer: "5" },
                ],
              },
            },
          },
        },
        responses: {
          201: { description: "Saved — next: domain-topic" },
          400: { description: "Validation / wrong step" },
        },
      },
    },
    "/api/participant/domain-topic": {
      post: {
        tags: ["Participant"],
        summary: "Choose domain + topic (locked for all 3 models)",
        security: [{ ParticipantToken: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/DomainTopicBody" },
            },
          },
        },
        responses: {
          200: { description: "Domain/topic locked" },
        },
      },
    },
    "/api/participant/models": {
      get: {
        tags: ["Participant"],
        summary: "List anonymous models X/Y/Z and availability",
        security: [{ ParticipantToken: [] }],
        responses: { 200: { description: "Model labels" } },
      },
    },
    "/api/participant/models/select": {
      post: {
        tags: ["Participant"],
        summary: "Start a model run (cannot re-select completed labels)",
        security: [{ ParticipantToken: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/SelectModelBody" },
            },
          },
        },
        responses: {
          201: { description: "Session created — save sessionToken + preSurvey" },
        },
      },
    },
    "/api/participant/sessions/{sessionToken}": {
      get: {
        tags: ["Participant"],
        summary: "Get session, transcript, pending survey",
        security: [{ ParticipantToken: [] }],
        parameters: [
          {
            name: "sessionToken",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: { 200: { description: "Session state" } },
      },
    },
    "/api/participant/sessions/{sessionToken}/surveys/pre": {
      post: {
        tags: ["Participant"],
        summary: "Submit pre-survey for current model",
        security: [{ ParticipantToken: [] }],
        parameters: [
          {
            name: "sessionToken",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/SurveyResponses" },
              example: {
                responses: [
                  { questionId: "stance_pre", answer: "3" },
                  { questionId: "certainty_pre", answer: "5" },
                ],
              },
            },
          },
        },
        responses: { 201: { description: "Conversation unlocked" } },
      },
    },
    "/api/participant/sessions/{sessionToken}/chat": {
      post: {
        tags: ["Participant"],
        summary: "Send chat turn (proxied to assigned LLM)",
        security: [{ ParticipantToken: [] }],
        parameters: [
          {
            name: "sessionToken",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ChatBody" },
            },
          },
        },
        responses: {
          200: { description: "Assistant reply (+ redirectTo post_survey when done)" },
          400: { description: "Wrong step / turn limit" },
        },
      },
    },
    "/api/participant/sessions/{sessionToken}/surveys/post": {
      post: {
        tags: ["Participant"],
        summary: "Submit post-survey (auto-computes PSI for admin)",
        security: [{ ParticipantToken: [] }],
        parameters: [
          {
            name: "sessionToken",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/SurveyResponses" },
              example: {
                responses: [
                  { questionId: "stance_post", answer: "5" },
                  { questionId: "trust_post", answer: "4" },
                ],
              },
            },
          },
        },
        responses: {
          201: { description: "Model done — back to model select or study complete" },
        },
      },
    },
    "/api/auth/login": {
      post: {
        tags: ["Auth"],
        summary: "Admin login → JWT",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/LoginBody" },
            },
          },
        },
        responses: {
          200: { description: "token + admin profile" },
          401: { description: "Invalid credentials" },
        },
      },
    },
    "/api/auth/bootstrap": {
      post: {
        tags: ["Auth"],
        summary: "Create first admin (only if none exist; disabled in production)",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/LoginBody" },
            },
          },
        },
        responses: {
          201: { description: "First admin created" },
          403: { description: "Bootstrap disabled" },
        },
      },
    },
    "/api/auth/me": {
      get: {
        tags: ["Auth"],
        summary: "Current admin",
        security: [{ AdminJWT: [] }],
        responses: {
          200: { description: "Admin profile" },
          401: { description: "Unauthorized" },
          403: { description: "Not an admin token" },
        },
      },
    },
    "/api/admin/dashboard": {
      get: {
        tags: ["Admin"],
        summary: "Dashboard — progress toward target (e.g. 500) + mean PSI",
        security: [{ AdminJWT: [] }],
        responses: {
          200: { description: "Experiments + progress cards" },
          403: { description: "Admin only" },
        },
      },
    },
    "/api/admin/question-types": {
      get: {
        tags: ["Admin Surveys"],
        summary: "List supported survey question types",
        security: [{ AdminJWT: [] }],
        responses: { 200: { description: "text, textarea, likert, single_choice, multiple_choice" } },
      },
    },
    "/api/admin/experiments": {
      get: {
        tags: ["Admin Surveys"],
        summary: "List my experiments (full survey config)",
        security: [{ AdminJWT: [] }],
        responses: { 200: { description: "Experiments" } },
      },
      post: {
        tags: ["Admin Surveys"],
        summary: "Create experiment with demographics + domain/topic surveys",
        security: [{ AdminJWT: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["name", "domains", "roundCount"],
                properties: {
                  name: { type: "string", example: "My Public Study" },
                  slug: { type: "string", example: "my-public-study" },
                  description: { type: "string" },
                  roundCount: { type: "number", example: 5 },
                  targetParticipantCount: { type: "number", example: 500 },
                  demographicsSchema: {
                    type: "array",
                    items: { $ref: "#/components/schemas/SurveyQuestion" },
                  },
                  domains: { type: "array", items: { type: "object" } },
                },
              },
              example: {
                name: "My Public Study",
                slug: "my-public-study",
                description: "Public LLM persuasion study",
                roundCount: 5,
                demographicsSchema: [
                  {
                    id: "age_range",
                    question: "Age range?",
                    type: "single_choice",
                    options: ["18-24", "25-34", "35-44", "45+"],
                  },
                  {
                    id: "comments",
                    question: "Anything else we should know?",
                    type: "textarea",
                    placeholder: "Optional thoughts",
                  },
                ],
                domains: [
                  {
                    id: "climate",
                    name: "Climate",
                    topics: [
                      {
                        id: "carbon-tax",
                        name: "Carbon tax",
                        surveySchema: {
                          pre: [
                            {
                              id: "stance_pre",
                              question: "Support for carbon tax?",
                              type: "likert",
                              scaleMin: 1,
                              scaleMax: 7,
                            },
                          ],
                          post: [
                            {
                              id: "stance_post",
                              question: "Support for carbon tax now?",
                              type: "likert",
                            },
                            {
                              id: "free_text_post",
                              question: "What changed your mind, if anything?",
                              type: "text",
                            },
                          ],
                        },
                      },
                    ],
                  },
                ],
              },
            },
          },
        },
        responses: { 201: { description: "Experiment created" } },
      },
    },
    "/api/admin/experiments/{experimentId}/surveys": {
      get: {
        tags: ["Admin Surveys"],
        summary: "Get all surveys (demographics + per-topic pre/post)",
        security: [{ AdminJWT: [] }],
        parameters: [
          { name: "experimentId", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: { 200: { description: "Survey bundle" } },
      },
    },
    "/api/admin/experiments/{experimentId}/surveys/demographics": {
      put: {
        tags: ["Admin Surveys"],
        summary: "Replace demographics survey questions",
        security: [{ AdminJWT: [] }],
        parameters: [
          { name: "experimentId", in: "path", required: true, schema: { type: "string" } },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["questions"],
                properties: {
                  questions: {
                    type: "array",
                    items: { $ref: "#/components/schemas/SurveyQuestion" },
                  },
                },
              },
            },
          },
        },
        responses: { 200: { description: "Demographics updated" } },
      },
    },
    "/api/admin/experiments/{experimentId}/domains/{domainId}/topics/{topicId}/surveys": {
      put: {
        tags: ["Admin Surveys"],
        summary: "Replace pre or post survey for a topic",
        security: [{ AdminJWT: [] }],
        parameters: [
          { name: "experimentId", in: "path", required: true, schema: { type: "string" } },
          { name: "domainId", in: "path", required: true, schema: { type: "string" } },
          { name: "topicId", in: "path", required: true, schema: { type: "string" } },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["type", "questions"],
                properties: {
                  type: { type: "string", enum: ["pre", "post"] },
                  questions: {
                    type: "array",
                    items: { $ref: "#/components/schemas/SurveyQuestion" },
                  },
                },
              },
            },
          },
        },
        responses: { 200: { description: "Topic survey updated" } },
      },
    },
    "/api/admin/experiments/{experimentId}/surveys/{target}/questions": {
      post: {
        tags: ["Admin Surveys"],
        summary: "Add one question (demographics | pre | post)",
        description:
          "For pre/post pass query params domainId & topicId. target path = demographics | pre | post",
        security: [{ AdminJWT: [] }],
        parameters: [
          { name: "experimentId", in: "path", required: true, schema: { type: "string" } },
          {
            name: "target",
            in: "path",
            required: true,
            schema: { type: "string", enum: ["demographics", "pre", "post"] },
          },
          { name: "domainId", in: "query", schema: { type: "string" } },
          { name: "topicId", in: "query", schema: { type: "string" } },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["question"],
                properties: {
                  question: { $ref: "#/components/schemas/SurveyQuestion" },
                },
              },
            },
          },
        },
        responses: { 201: { description: "Question added" } },
      },
    },
    "/api/admin/experiments/{experimentId}/analytics": {
      get: {
        tags: ["Admin"],
        summary: "Full analytics (funnel, demographics, PSI, usage)",
        security: [{ AdminJWT: [] }],
        parameters: [
          {
            name: "experimentId",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: { 200: { description: "Analytics payload" } },
      },
    },
    "/api/admin/experiments/{experimentId}/metrics": {
      get: {
        tags: ["Admin"],
        summary: "Metrics (same as analytics — automated PSI)",
        security: [{ AdminJWT: [] }],
        parameters: [
          {
            name: "experimentId",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: { 200: { description: "Metrics payload" } },
      },
    },
    "/api/admin/experiments/{experimentId}/sessions": {
      get: {
        tags: ["Admin"],
        summary: "List sessions (includes metrics.psi)",
        security: [{ AdminJWT: [] }],
        parameters: [
          {
            name: "experimentId",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: { 200: { description: "Sessions" } },
      },
    },
    "/api/admin/experiments/{experimentId}/participants": {
      get: {
        tags: ["Admin"],
        summary: "List participants (emails + progress)",
        security: [{ AdminJWT: [] }],
        parameters: [
          {
            name: "experimentId",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: { 200: { description: "Participants" } },
      },
    },
    "/api/admin/metrics/psi": {
      post: {
        tags: ["Admin"],
        summary: "Compute PSI manually",
        security: [{ AdminJWT: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["Apre", "Apost", "D"],
                properties: {
                  Apre: { type: "number", example: 2 },
                  Apost: { type: "number", example: 5 },
                  D: { type: "number", enum: [1, -1], example: 1 },
                },
              },
            },
          },
        },
        responses: { 200: { description: "{ result }" } },
      },
    },
    "/api/admin/metrics/jsd": {
      post: {
        tags: ["Admin"],
        summary: "Compute JSD / π",
        security: [{ AdminJWT: [] }],
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  P: { type: "array", items: { type: "number" } },
                  Q: { type: "array", items: { type: "number" } },
                },
              },
            },
          },
        },
        responses: { 200: { description: "{ result }" } },
      },
    },
    "/api/admin/metrics/belief-vector": {
      post: {
        tags: ["Admin"],
        summary: "Compute belief vector from scores + logProbs",
        security: [{ AdminJWT: [] }],
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  scores: { type: "array", items: { type: "number" } },
                  logProbs: { type: "array", items: { type: "number" } },
                },
              },
            },
          },
        },
        responses: { 200: { description: "{ result }" } },
      },
    },
    "/api/admin/metrics/cfr": {
      post: {
        tags: ["Admin"],
        summary: "Compute CFR",
        security: [{ AdminJWT: [] }],
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  labels: {
                    type: "array",
                    items: { type: "string", enum: ["C", "M"] },
                    example: ["C", "C", "M"],
                  },
                },
              },
            },
          },
        },
        responses: { 200: { description: "{ result }" } },
      },
    },
    "/api/admin/metrics/ece": {
      post: {
        tags: ["Admin"],
        summary: "Compute ECE@T",
        security: [{ AdminJWT: [] }],
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  samples: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        confidence: { type: "number" },
                        correct: { type: "number" },
                      },
                    },
                  },
                  numBins: { type: "number", example: 10 },
                },
              },
            },
          },
        },
        responses: { 200: { description: "{ result }" } },
      },
    },
    "/api/admin/metrics/judge-bias": {
      post: {
        tags: ["Admin"],
        summary: "Compute MAD / SME_err",
        security: [{ AdminJWT: [] }],
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  responses: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        judgeScore: { type: "number" },
                        smeScore: { type: "number" },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        responses: { 200: { description: "{ result }" } },
      },
    },
    "/api/admin/metrics/avg-turn": {
      post: {
        tags: ["Admin"],
        summary: "Compute Avg_Turn",
        security: [{ AdminJWT: [] }],
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  dialogues: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        judgments: {
                          type: "array",
                          items: { type: "number" },
                        },
                      },
                    },
                  },
                  Tmax: { type: "number", example: 5 },
                },
              },
            },
          },
        },
        responses: { 200: { description: "{ result }" } },
      },
    },
    "/api/admin/metrics/trust": {
      post: {
        tags: ["Admin"],
        summary: "Compute trust potentials θ",
        security: [{ AdminJWT: [] }],
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  pDirectSupport: { type: "number" },
                  pWeakSupport: { type: "number" },
                  yu: { type: "number" },
                  yv: { type: "number" },
                  beta: { type: "number" },
                  gamma: { type: "number" },
                },
              },
            },
          },
        },
        responses: { 200: { description: "{ result }" } },
      },
    },
  },
};

module.exports = swaggerDefinition;
