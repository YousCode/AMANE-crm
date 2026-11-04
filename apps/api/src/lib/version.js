export const VERSION = '2.0.0' + (process.env.VERCEL_GIT_COMMIT_SHA ? '+' + process.env.VERCEL_GIT_COMMIT_SHA.slice(0, 7) : '');
