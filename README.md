# My Sindbad

## Google sign-in setup

The app uses Supabase Auth with the PKCE flow and returns to:

```text
https://<your-app-host>/auth/callback
```

To enable Google sign-in:

1. In Supabase, open **Authentication → Providers → Google** and add the Google OAuth client ID and secret.
2. In **Authentication → URL Configuration**, add the exact production callback URL above to the redirect allow list.
3. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in the frontend deployment environment.
4. If the deployment uses a fixed public URL different from the browser origin, set `VITE_AUTH_REDIRECT_URL` to that callback URL.

The callback is exchanged for a session in the browser and then the temporary `/auth/callback` URL is replaced with the app home route.