export default {
  async index(ctx) {
    ctx.body = { status: 'online', timestamp: Date.now() };
  },
};
