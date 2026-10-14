# VubaTrustTyping — starter project

A responsive React/Vite starter for the VubaTrustTyping community typing-practice platform. It includes a landing page, a timed typing exercise, speed/accuracy feedback, Google OAuth wiring through Supabase, personal result history, a public opt-in leaderboard query, and a starter PostgreSQL schema for profiles, test results, race lobbies, participants, notifications, and top performers.

## Important scope notes

This is a **starter MVP**, not a complete production implementation. The solo typing exercise works locally. Saving results, sign-in, history, and leaderboard require a configured Supabase project. The schema includes race and messaging tables, but the full live multiplayer race flow, admin messaging interface, AI coach, anti-cheat protections, and advanced analytics are not implemented yet. Do not advertise those features as live until they are implemented and tested.

## Requirements

- Node.js 20.19+ or 22.12+ (recommended for current Vite releases)
- A Supabase account/project
- A GitHub account and Vercel account for the easiest hosting path

## 1. Run locally

1. Extract the ZIP.
2. Open a terminal in the `vubatrusttyping` folder.
3. Install dependencies:

   ```bash
   npm install
   ```

4. Copy `.env.example` to `.env.local` and add your Supabase project URL and public/anon key:

   ```env
   VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
   VITE_SUPABASE_ANON_KEY=YOUR_PUBLIC_OR_ANON_KEY
   ```

   Never put a Supabase `service_role` key or database password in a `VITE_` variable or browser code.

5. In Supabase, open **SQL Editor**, create a new query, paste the contents of `supabase/schema.sql`, and run it.
6. In Supabase, go to **Authentication → Providers → Google** and configure Google OAuth credentials. In **Authentication → URL Configuration**, set the local site URL to `http://localhost:5173` and add it to the redirect URL allow-list. Follow Supabase's current Google provider instructions to create OAuth credentials in Google Cloud.
7. Start the app:

   ```bash
   npm run dev
   ```

8. Open the local URL shown by Vite (usually `http://localhost:5173`).

Without Supabase credentials, the visual site and local typing practice still load, but account login and persistent database features won't work.

## 2. Configure the admin safely

1. Sign in once using the Google account that should administer the project.
2. In Supabase **SQL Editor**, run this statement after replacing the email with the actual admin email:

   ```sql
   update public.profiles
   set role = 'admin'
   where email = 'YOUR_ADMIN_EMAIL';
   ```

3. Do not place administrator passwords in source code, README files, frontend environment variables, or SQL commits. Keep privileged admin operations on a trusted backend or Supabase Edge Function and verify the role server-side.

The starter currently does not include the complete admin dashboard or trusted messaging Edge Function.

## 3. Host on GitHub + Vercel

### A. Push the project to GitHub

1. Create a new **private** GitHub repository for the project.
2. Extract this ZIP and open a terminal in the project folder.
3. Run:

   ```bash
   git init
   git add .
   git commit -m "Initial VubaTrustTyping MVP"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPOSITORY.git
   git push -u origin main
   ```

4. Confirm `.env.local` is not committed. The included `.gitignore` excludes it.

### B. Deploy to Vercel

1. Sign in to Vercel and choose **Add New → Project**.
2. Import the GitHub repository.
3. Framework preset: **Vite**. Build command: `npm run build`. Output directory: `dist`.
4. Under **Environment Variables**, add:
   - `VITE_SUPABASE_URL` = your Supabase project URL
   - `VITE_SUPABASE_ANON_KEY` = your Supabase publishable/anon key
5. Deploy. Vercel will provide a public HTTPS URL.

### C. Update Supabase URLs for production

After deployment, in Supabase **Authentication → URL Configuration**:

- Set the Site URL to your Vercel production URL, for example `https://your-project.vercel.app`.
- Add that URL to the allowed redirect URLs.
- In your Google OAuth provider configuration, add the exact authorized redirect URI shown by Supabase to Google Cloud Console.

Redeploy after changing environment variables. Test sign-in, sign-out, saving results, and leaderboard privacy in a private/incognito browser window.

## 4. Database tables

`supabase/schema.sql` creates:

- `profiles` — user profile, role, typing level, and public-profile consent
- `test_results` — WPM, accuracy, test mode, duration, timestamp
- `race_lobbies` — lobby and status records
- `race_participants` — participant progress and finishing position
- `notifications` — user messages and read state
- `top_performers` — opt-in recognition entries
- `public_leaderboard` — view for opted-in public display names and best WPM

Row Level Security (RLS) is enabled on the main tables. Review and test every policy before a real deployment, particularly race participant policies and any admin functions. The service-role key must never be exposed to the frontend.

## 5. Before real community use

- Test the app on the actual school computers and with the institution's internet conditions.
- Test the typing calculation, accuracy edge cases, and result saving.
- Add tests and server-side validation, rate limiting, abuse prevention, and monitoring.
- Implement real-time race synchronization and secure host/member authorization.
- Implement trusted admin messaging through a server/Edge Function.
- Add the AI coach only after defining costs, safeguards, and how learner data is sent to the AI provider.
- Establish privacy notice, consent and safeguarding procedures, especially for participants under 18.
- Ensure public profiles and leaderboard participation are optional.
- Make a backup and restoration plan for the database.

## 6. Troubleshooting

- **Login doesn't work:** verify Google provider settings, OAuth redirect URLs, and the Supabase Site URL.
- **Results aren't saved:** check the browser console, confirm the SQL schema was applied, and verify the user is signed in.
- **Profile doesn't appear:** inspect Supabase Auth logs and confirm the `on_auth_user_created` trigger exists.
- **Vercel page is blank:** check build logs and confirm output directory is `dist`.
- **Environment changes don't apply:** redeploy after updating Vercel environment variables.

## Project layout

```text
vubatrusttyping/
├── index.html
├── package.json
├── .env.example
├── .gitignore
├── README.md
├── src/
│   ├── main.jsx
│   └── styles.css
└── supabase/
    └── schema.sql
```
