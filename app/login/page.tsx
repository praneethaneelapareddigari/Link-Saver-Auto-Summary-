"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [mode, setMode] = useState<"login" | "signup">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      router.push("/app");
    } catch (err: any) {
      alert(err.message ?? "Auth failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen grid place-items-center p-6">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4 border p-6 rounded-xl">
        <h1 className="text-xl font-semibold">Link Saver – {mode === "signup" ? "Sign up" : "Log in"}</h1>
        <input className="w-full border p-2 rounded" placeholder="Email" type="email" value={email} onChange={(e)=>setEmail(e.target.value)} required />
        <input className="w-full border p-2 rounded" placeholder="Password" type="password" value={password} onChange={(e)=>setPassword(e.target.value)} required />
        <button className="w-full p-2 rounded bg-black text-white" type="submit" disabled={loading}>
          {loading ? "Please wait..." : (mode === "signup" ? "Create account" : "Log in")}
        </button>
        <button type="button" className="text-sm underline" onClick={()=>setMode(mode==="signup"?"login":"signup")}>
          {mode === "signup" ? "Have an account? Log in" : "New here? Sign up"}
        </button>
      </form>
    </div>
  );
}
