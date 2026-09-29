/**
 * Build public, shareable study URLs.
 * Prefer human-readable slug so the study can be found/shared online.
 * Frontend routes expected:
 *   /studies          — public catalog
 *   /study/:slugOrToken — join a study
 */

const getStudyAppBase = () => {
  const base =
    process.env.STUDY_APP_URL ||
    process.env.FRONTEND_URL ||
    "http://localhost:5173";

  return String(base).replace(/\/$/, "");
};

const toSlug = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

const buildShareableStudyLink = (experimentOrSlug) => {
  const slug =
    typeof experimentOrSlug === "string"
      ? experimentOrSlug
      : experimentOrSlug?.slug || experimentOrSlug?.inviteToken;

  if (!slug) return null;
  return `${getStudyAppBase()}/study/${slug}`;
};

const buildStudiesCatalogLink = () => `${getStudyAppBase()}/studies`;

const buildApiStudyPaths = (slugOrToken) => ({
  info: `/api/study/${slugOrToken}`,
  consent: `/api/study/${slugOrToken}/consent`,
  catalog: `/api/studies`,
});

module.exports = {
  getStudyAppBase,
  toSlug,
  buildShareableStudyLink,
  buildStudiesCatalogLink,
  buildApiStudyPaths,
};
