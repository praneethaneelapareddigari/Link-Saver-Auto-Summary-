export default function Home() {
  return (
    <main className="min-h-screen grid place-items-center p-6">
      <div className="max-w-xl text-center space-y-4">
        <h1 className="text-3xl font-bold">Link Saver + Auto-Summary</h1>
        <p>Sign up or log in to start saving links.</p>
        <a className="underline" href="/login">Continue</a>
      </div>
    </main>
  );
}
