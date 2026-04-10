/**
 * Database configuration — PostgreSQL connection pool
 */
const { Pool } = require('pg');

const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME     || 'securitypass',
  user:     process.env.DB_USER     || 'sp_user',
  password: process.env.DB_PASSWORD || 'sp_password',
  min:      parseInt(process.env.DB_POOL_MIN || '2'),
  max:      parseInt(process.env.DB_POOL_MAX || '10'),
  idleTimeoutMillis:    30000,
  connectionTimeoutMillis: 5000,
});

pool.on('connect', () => {
  if (process.env.NODE_ENV !== 'test') {
    console.log('PostgreSQL client connected');
  }
});

pool.on('error', (err) => {
  console.error('Unexpected PostgreSQL client error:', err.message);
  process.exit(1);
});

/**
 * Execute a parameterised query
 * @param {string} text  - SQL query
 * @param {Array}  params - Query parameters
 */
const query = (text, params) => pool.query(text, params);

/**
 * Get a dedicated client for transactions
 */
const getClient = () => pool.connect();

module.exports = { pool, query, getClient };
