function createPostgresConfig(env = process.env) {
  const sslSetting = env.PGSSL ?? env.DB_SSL;
  const ssl = String(sslSetting).toLowerCase() === 'true'
    ? { rejectUnauthorized: false }
    : false;
  const hasExplicitDbConfig = Boolean(
    env.DB_HOST || env.DB_NAME || env.DB_USER || env.DB_PASSWORD,
  );

  if (env.DATABASE_URL && !hasExplicitDbConfig) {
    return {
      connectionString: env.DATABASE_URL,
      ssl,
    };
  }

  return {
    host: env.DB_HOST || 'localhost',
    port: Number(env.DB_PORT || 5432),
    database: env.DB_NAME || 'SIDOVI',
    user: env.DB_USER || 'postgres',
    password: env.DB_PASSWORD || '',
    ssl,
  };
}

module.exports = { createPostgresConfig };
