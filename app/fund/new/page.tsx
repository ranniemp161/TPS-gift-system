import { CreateFundForm } from "./create-fund-form";

export const metadata = {
  title: "Create a gift fund",
};

export default function CreateFundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center bg-zinc-50 px-4 py-16 dark:bg-black sm:px-6">
      <main className="w-full max-w-xl rounded-xl border border-zinc-200 bg-white p-8 shadow-xs dark:border-zinc-800 dark:bg-zinc-950 sm:p-10">
        <header className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            Create a gift fund
          </h1>
          <p className="mt-2 text-base text-zinc-600 dark:text-zinc-400">
            Every contribution becomes prepaid TPS gift credit for postpartum
            support services.
          </p>
          <p className="mt-2 text-base text-zinc-600 dark:text-zinc-400">
            Usually set up by a friend or family member (the organiser) on the
            mum&apos;s behalf, using her email. The mum can also set up her own
            fund. This demo has no sign-in, so anyone with the link can create
            a fund.
          </p>
        </header>

        <CreateFundForm />
      </main>
    </div>
  );
}
