export default () => ({
  port: process.env.PORT || 8000,
  database: {
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    host: process.env.DATABASE_HOST,
    port: process.env.DATABASE_PORT,
    name: process.env.DATABASE_NAME,
  },
});

