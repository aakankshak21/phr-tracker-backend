const express = require('express');
const router  = express.Router();
const { query } = require('../db');

// ── KPIs ──────────────────────────────────────────────────────────────────────
router.get('/kpis', async (req, res) => {
  const { start, end } = req.query;
  try {
    const [total, scheduled, log] = await Promise.all([
      query('SELECT COUNT(*) AS cnt FROM users'),
      query('SELECT COUNT(*) AS cnt FROM phr_to_be_sent WHERE scheduled_date = CURRENT_DATE'),
      query(
        `SELECT COUNT(*) AS total,
                SUM(CASE WHEN status='sent'   THEN 1 ELSE 0 END) AS sent,
                SUM(CASE WHEN status='failed' THEN 1 ELSE 0 END) AS failed
         FROM phr_log WHERE phr_sent_date BETWEEN $1 AND $2`,
        [start, end]
      ),
    ]);
    const { total: t, sent, failed } = log.rows[0];
    res.json({
      totalUsers:    parseInt(total.rows[0].cnt),
      scheduledToday: parseInt(scheduled.rows[0].cnt),
      successRate:   t > 0 ? ((sent / t) * 100).toFixed(1) : '0.0',
      failedMessages: parseInt(failed),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Message status chart ──────────────────────────────────────────────────────
router.get('/status-chart', async (req, res) => {
  const { start, end } = req.query;
  try {
    const result = await query(
      `SELECT status::text AS status, COUNT(*) AS count
       FROM phr_log WHERE phr_sent_date BETWEEN $1 AND $2
       GROUP BY status::text ORDER BY count DESC`,
      [start, end]
    );
    res.json(result.rows.map(r => ({ ...r, count: parseInt(r.count) })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Pipeline chart ────────────────────────────────────────────────────────────
router.get('/pipeline-chart', async (req, res) => {
  try {
    const result = await query(
      `SELECT COALESCE(pipeline::text,'No Pipeline') AS pipeline, COUNT(*) AS count
       FROM users GROUP BY pipeline::text ORDER BY count DESC`
    );
    res.json(result.rows.map(r => ({ ...r, count: parseInt(r.count) })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Failure reasons chart ─────────────────────────────────────────────────────
router.get('/failure-chart', async (req, res) => {
  const { start, end } = req.query;
  try {
    const result = await query(
      `SELECT COALESCE(failure_reason::text,'Unknown') AS reason, COUNT(*) AS count
       FROM phr_log WHERE status='failed' AND phr_sent_date BETWEEN $1 AND $2
       GROUP BY failure_reason::text ORDER BY count DESC`,
      [start, end]
    );
    res.json(result.rows.map(r => ({ ...r, count: parseInt(r.count) })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── User activity table ───────────────────────────────────────────────────────
router.get('/users', async (req, res) => {
  const { start } = req.query;
  try {
    const result = await query(
      `WITH last_log AS (
         SELECT DISTINCT ON (user_id)
           user_id,
           status::text                             AS last_status,
           COALESCE(failure_reason::text, '—')      AS failure_reason
         FROM phr_log
         ORDER BY user_id, phr_sent_date DESC, phr_sent_time DESC
       )
       SELECT
         u.id,
         u.name,
         COALESCE(u.phone, '—')                          AS phone,
         COALESCE(u.pipeline::text, 'No Pipeline')        AS pipeline,
         MAX(l.phr_sent_date)                             AS last_phr_sent_date,
         CASE WHEN COUNT(CASE WHEN l.phr_sent_date >= $1 THEN 1 END) > 0
              THEN true ELSE false END                    AS phr_in_last_7_days,
         COALESCE(ll.last_status, '—')                    AS last_status,
         COALESCE(ll.failure_reason, '—')                 AS failure_reason
       FROM users u
       LEFT JOIN phr_log  l  ON u.id = l.user_id
       LEFT JOIN last_log ll ON u.id = ll.user_id
       GROUP BY u.id, u.name, u.phone, u.pipeline, ll.last_status, ll.failure_reason
       ORDER BY u.name`,
      [start]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Sidebar user list ─────────────────────────────────────────────────────────
router.get('/users/list', async (req, res) => {
  try {
    const result = await query(
      `SELECT id, name, COALESCE(pipeline::text,'No Pipeline') AS pipeline
       FROM users ORDER BY name`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── User detail ───────────────────────────────────────────────────────────────
router.get('/users/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const [info, history] = await Promise.all([
      query(
        `SELECT name, phone, email,
                COALESCE(pipeline::text,'No Pipeline') AS pipeline,
                mobile_status::text  AS mobile_status,
                email_validity::text AS email_validity,
                created_at
         FROM users WHERE id = $1`,
        [id]
      ),
      query(
        `SELECT phr_sent_date, phr_sent_time,
                phr_service::text                   AS phr_service,
                status::text                        AS status,
                COALESCE(failure_reason::text, '—') AS failure_reason,
                properties_sent_count
         FROM phr_log WHERE user_id = $1
         ORDER BY phr_sent_date DESC, phr_sent_time DESC
         LIMIT 30`,
        [id]
      ),
    ]);
    res.json({ info: info.rows[0] || null, history: history.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
