export default () => ({
  port: process.env.PORT ? parseInt(process.env.PORT, 10) : 3000,
  nodeName: process.env.NODE_NAME || 'booking-core',
});
