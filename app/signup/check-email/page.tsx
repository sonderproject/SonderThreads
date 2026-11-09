import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function CheckEmailPage({ searchParams }: { searchParams: Promise<{ email?: string }> }) {
  const { email } = await searchParams;
  return (
    <div className="flex min-h-screen items-start justify-center bg-bg px-4 pt-32">
      <div className="w-full max-w-xs space-y-3">
        <p className="font-display text-xl font-semibold text-accent">sonderthreads</p>
        <h1 className="section-title">Check your email</h1>
        <p className="text-sm text-text-muted">
          We sent a confirmation link to {email ? <strong className="text-text">{email}</strong> : "your email"}. Open it
          to finish creating your account.
        </p>
        <p className="text-center text-xs">
          <Link href="/login" className="text-accent hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
