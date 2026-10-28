import { LoginForm } from "./login-form";

export const metadata = {
  title: "Admin sign-in",
};

export default function AdminLoginPage() {
  return (
    <div className="flex min-h-screen flex-col items-center bg-zinc-50 px-4 py-16 dark:bg-black sm:px-6">
      <main className="w-full max-w-sm space-y-6 rounded-xl border border-zinc-200 bg-white p-8 shadow-xs dark:border-zinc-800 dark:bg-zinc-950">
        <header className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            TPS team sign-in
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Enter the admin password to see funds and record credit used.
          </p>
        </header>
        <LoginForm />
      </main>
    </div>
  );
}
