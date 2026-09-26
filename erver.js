[1mdiff --git a/server.js b/server.js[m
[1mindex e9a4e57..8da4544 100644[m
[1m--- a/server.js[m
[1m+++ b/server.js[m
[36m@@ -21,7 +21,7 @@[m [mconst postgresConfig = process.env.DATABASE_URL[m
       port: Number(process.env.DB_PORT || 5432),[m
       database: process.env.DB_NAME || 'SIDOVI',[m
       user: process.env.DB_USER || 'postgres',[m
[31m-      password: process.env.DB_PASSWORD || 'julian123',[m
[32m+[m[32m      password: process.env.DB_PASSWORD || 'KAREN123',[m
       ssl: String(sslSetting).toLowerCase() === 'true' ? { rejectUnauthorized: false } : false[m
     };[m
 const db = new Pool(postgresConfig);[m
