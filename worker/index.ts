import handler from "vinext/server/app-router-entry";

export default {
  fetch(request: Request, env: any, ctx: any) {
    return handler.fetch(request, env, ctx);
  },
};
