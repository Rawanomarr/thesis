/**
 * Shuffle real models onto anonymous labels (X/Y/Z).
 * The resulting mapping must never be sent to the participant client.
 */
const buildModelSlots = (labels, models) => {
  if (!Array.isArray(labels) || !Array.isArray(models) || labels.length !== models.length) {
    throw new Error("labels and models must be arrays of equal length");
  }

  const shuffled = [...models];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return labels.map((label, index) => ({
    label,
    model: shuffled[index],
    completed: false,
    sessionId: null,
  }));
};

module.exports = {
  buildModelSlots,
};
