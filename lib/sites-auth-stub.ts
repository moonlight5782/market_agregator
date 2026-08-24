const unavailable = async () => undefined;

export const handlers = {
  GET: async () => new Response("Authentication is not configured", { status: 503 }),
  POST: async () => new Response("Authentication is not configured", { status: 503 }),
};

export const auth = async () => null;
export const signIn = unavailable;
export const signOut = unavailable;
