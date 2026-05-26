const { z } = require("zod");
const { APPLICATION_STATUS } = require("../domain/applicationStatus/constants/uiStatuses");

const PAGE_SIZES = [10, 20, 30, 50];
const SORT_FIELDS = [
  "created_at",
  "updated_at",
  "match_score",
  "normalized_company_name",
  "application_status",
];
const DATE_PRESETS = ["today", "last7", "last30", "custom"];
const MAX_SEARCH_LENGTH = 100;

const statusEnum = z.enum([
  APPLICATION_STATUS.DRAFT,
  APPLICATION_STATUS.GENERATED,
  APPLICATION_STATUS.NEEDS_REVIEW,
  APPLICATION_STATUS.SENT,
  APPLICATION_STATUS.FAILED,
  APPLICATION_STATUS.CANCELLED,
]);

function coerceStatusArray(val) {
  if (val === undefined || val === null || val === "") return undefined;
  const raw = Array.isArray(val) ? val : String(val).split(",");
  const cleaned = [...new Set(raw.map((s) => String(s).trim()).filter(Boolean))];
  return cleaned.length ? cleaned : undefined;
}

const listQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).optional().default(1),
    pageSize: z.coerce
      .number()
      .int()
      .refine((n) => PAGE_SIZES.includes(n), { message: "Invalid pageSize" })
      .optional()
      .default(20),
    sort: z.enum(SORT_FIELDS).optional().default("created_at"),
    order: z.enum(["asc", "desc"]).optional().default("desc"),
    status: z.preprocess(coerceStatusArray, z.array(statusEnum).optional()),
    datePreset: z.enum(DATE_PRESETS).optional(),
    dateFrom: z.string().optional(),
    dateTo: z.string().optional(),
    q: z
      .string()
      .optional()
      .transform((s) => {
        if (s == null) return undefined;
        const t = s.trim();
        if (!t) return undefined;
        return t.slice(0, MAX_SEARCH_LENGTH);
      }),
  })
  .superRefine((data, ctx) => {
    if (data.datePreset === "custom") {
      if (!data.dateFrom || !data.dateTo) {
        ctx.addIssue({
          code: "custom",
          message: "dateFrom and dateTo are required when datePreset is custom",
          path: ["dateFrom"],
        });
        return;
      }
      const from = new Date(data.dateFrom);
      const to = new Date(data.dateTo);
      if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
        ctx.addIssue({ code: "custom", message: "Invalid date range", path: ["dateFrom"] });
        return;
      }
      if (from > to) {
        ctx.addIssue({
          code: "custom",
          message: "dateFrom must not be after dateTo",
          path: ["dateFrom"],
        });
      }
    } else if (data.dateFrom || data.dateTo) {
      const from = data.dateFrom ? new Date(data.dateFrom) : null;
      const to = data.dateTo ? new Date(data.dateTo) : null;
      if (from && Number.isNaN(from.getTime())) {
        ctx.addIssue({ code: "custom", message: "Invalid dateFrom", path: ["dateFrom"] });
      }
      if (to && Number.isNaN(to.getTime())) {
        ctx.addIssue({ code: "custom", message: "Invalid dateTo", path: ["dateTo"] });
      }
      if (from && to && from > to) {
        ctx.addIssue({
          code: "custom",
          message: "dateFrom must not be after dateTo",
          path: ["dateFrom"],
        });
      }
    }
  });

/**
 * @param {Record<string, unknown>} rawQuery
 * @returns {{ ok: true, data: z.infer<typeof listQuerySchema> } | { ok: false, error: z.ZodError }}
 */
function validateApplicationsListQuery(rawQuery) {
  const parsed = listQuerySchema.safeParse(rawQuery);
  if (!parsed.success) {
    return { ok: false, error: parsed.error };
  }
  const data = { ...parsed.data };
  if (data.status?.length) {
    data.status = [...data.status].sort();
  }
  return { ok: true, data };
}

module.exports = {
  validateApplicationsListQuery,
  PAGE_SIZES,
  SORT_FIELDS,
  MAX_SEARCH_LENGTH,
};
