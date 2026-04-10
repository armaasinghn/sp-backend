/**
 * Dashboard Controller — KPI stats + summary data
 */
const { query } = require('../../../config/database');
const { success } = require('../utils/response');

/** GET /api/dashboard */
exports.stats = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const role   = req.user.role;

    // Base filter
    const scopeFilter = role === 'approver'
      ? `AND p.host_user_id = '${userId}'`
      : '';

    const todayStr = new Date().toISOString().split('T')[0];

    const [statsResult, insideResult, pendingResult, recentResult] = await Promise.all([

      // KPI tile counts
      query(`
        SELECT
          COUNT(*)                                           AS total_passes,
          COUNT(*) FILTER (WHERE status='pending')           AS pending,
          COUNT(*) FILTER (WHERE status='approved')          AS approved,
          COUNT(*) FILTER (WHERE status='rejected')          AS rejected,
          COUNT(*) FILTER (
            WHERE status='approved'
            AND DATE(approved_at) = CURRENT_DATE
          )                                                  AS approved_today,
          COUNT(*) FILTER (
            WHERE DATE(created_at) = CURRENT_DATE
          )                                                  AS created_today
        FROM passes p WHERE 1=1 ${scopeFilter}
      `),

      // Currently inside
      query(`SELECT COUNT(*) AS inside_count FROM v_currently_inside`),

      // Pending passes (for action panel)
      query(`
        SELECT p.id, p.pass_number, p.visitor_name, p.visitor_company,
               p.purpose, p.host_name, p.created_at
        FROM passes p
        WHERE p.status = 'pending' ${scopeFilter}
        ORDER BY p.created_at ASC
        LIMIT 10
      `),

      // Recent passes
      query(`
        SELECT p.id, p.pass_number, p.visitor_name, p.visitor_company,
               p.host_name, p.department_name, p.purpose, p.status,
               p.valid_from, p.valid_until, p.created_at,
               u.color AS host_color, u.initial AS host_initial
        FROM passes p
        LEFT JOIN users u ON u.id = p.host_user_id
        WHERE 1=1 ${scopeFilter}
        ORDER BY p.created_at DESC
        LIMIT 5
      `),
    ]);

    // Total visitors (admin/gate only)
    let totalVisitors = 0;
    if (['admin', 'gate'].includes(role)) {
      const visResult = await query(
        `SELECT COUNT(*) FROM visitor_profiles`
      );
      totalVisitors = parseInt(visResult.rows[0].count);
    }

    const stats = statsResult.rows[0];

    return success(res, {
      kpi: {
        total_passes:   parseInt(stats.total_passes),
        pending:        parseInt(stats.pending),
        approved:       parseInt(stats.approved),
        rejected:       parseInt(stats.rejected),
        approved_today: parseInt(stats.approved_today),
        created_today:  parseInt(stats.created_today),
        inside_now:     parseInt(insideResult.rows[0].inside_count),
        total_visitors: totalVisitors,
      },
      pending_passes:  pendingResult.rows,
      recent_passes:   recentResult.rows,
    });
  } catch (err) { next(err); }
};
