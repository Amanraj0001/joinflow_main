export const config = {
  production: process.env.NODE_ENV === 'production',
  port: Number(process.env.PORT || 3001),
  logLevel: process.env.LOG_LEVEL || 'info',
  jwtSecret: process.env.JWT_SECRET,
  groqKey: process.env.GROQ_API_KEY,
  groqModel: process.env.GROQ_MODEL || 'openai/gpt-oss-20b',
  origin:
    process.env.APP_ORIGIN ||
    process.env.RENDER_EXTERNAL_URL ||
    'http://localhost:5173',
  ragUrl: process.env.RAG_URL || 'http://127.0.0.1:8010',
  ragSecret: process.env.RAG_SECRET || 'local-joinflow',
  smtp: process.env.SMTP_URL,
  from: process.env.MAIL_FROM || 'JoinFlow <onboarding@joinflow.example>',
}
