export default () => ({
  secret: process.env.JWT_SECRET,
  secretExpiresIn: process.env.JWT_EXPIRES_IN,
  secretRefresh: process.env.JWT_SECRET_REFRESH,
  secretRefreshExpiresIn: process.env.JWT_SECRET_REFRESH_EXPIRES_IN,
});
