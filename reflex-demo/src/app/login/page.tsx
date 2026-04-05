"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("j.martinez@valero.com");
  const [password, setPassword] = useState("password");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    router.push("/operations");
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F5F5F5] p-4">
      <div className="flex flex-col items-center gap-8 w-full max-w-[400px]">
        <div className="w-full bg-white rounded-lg py-10 px-8 shadow-elevated">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-headline font-bold text-[#0D9488]">
              Reflex
            </h1>
            <p className="text-sm font-body text-[#6B7280] mt-1">
              Refinery Optimization Platform
            </p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col">
              <label
                htmlFor="email"
                className="text-sm font-body font-medium text-[#4B5563] mb-1"
              >
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-[#F9FAFB] border border-[#E5E7EB] rounded font-body text-[#111827] placeholder:text-[#9CA3AF] focus:outline-none focus:border-[#0D9488] focus:ring-1 focus:ring-[#0D9488]"
              />
            </div>

            <div className="flex flex-col">
              <label
                htmlFor="password"
                className="text-sm font-body font-medium text-[#4B5563] mb-1"
              >
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-[#F9FAFB] border border-[#E5E7EB] rounded font-body text-[#111827] placeholder:text-[#9CA3AF] focus:outline-none focus:border-[#0D9488] focus:ring-1 focus:ring-[#0D9488]"
              />
            </div>

            <div className="flex items-center justify-between">
              <label
                htmlFor="remember"
                className="flex items-center gap-2 text-sm font-body text-[#4B5563] cursor-pointer"
              >
                <input
                  id="remember"
                  name="remember"
                  type="checkbox"
                  className="w-4 h-4 rounded border-[#E5E7EB] accent-[#0D9488] cursor-pointer"
                />
                Remember me
              </label>
              <a
                href="#"
                className="text-sm text-[#0D9488] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488] focus-visible:ring-offset-1 rounded"
              >
                Forgot Password?
              </a>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 rounded bg-[#0D9488] text-white font-headline font-semibold hover:bg-[#0F766E] transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488] focus-visible:ring-offset-2"
            >
              Sign In
            </button>
          </form>
        </div>

        <p className="text-xs font-body text-[#6B7280]">
          Reflex v2.1.0 &middot; Constellation Energy
        </p>
      </div>
    </div>
  );
}
