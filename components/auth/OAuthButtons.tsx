import { signInWithProvider } from "@/app/auth/actions";

export default function OAuthButtons() {
  return (
    <div className="flex flex-col gap-3">
      <form action={signInWithProvider}>
        <input type="hidden" name="provider" value="google" />
        <button
          type="submit"
          className="flex w-full items-center justify-center gap-3 rounded-xl border-2 border-wood/15 bg-white px-4 py-3 font-semibold text-foreground shadow-[0_3px_0_rgba(0,0,0,0.08)] transition hover:-translate-y-0.5 hover:shadow-[0_5px_0_rgba(0,0,0,0.08)] active:translate-y-0.5"
        >
          <GoogleIcon />
          <span>Google로 계속하기</span>
        </button>
      </form>

      <form action={signInWithProvider}>
        <input type="hidden" name="provider" value="kakao" />
        <button
          type="submit"
          className="flex w-full items-center justify-center gap-3 rounded-xl border-2 border-black/5 bg-[#FEE500] px-4 py-3 font-semibold text-[#3C1E1E] shadow-[0_3px_0_rgba(0,0,0,0.12)] transition hover:-translate-y-0.5 hover:shadow-[0_5px_0_rgba(0,0,0,0.12)] active:translate-y-0.5"
        >
          <KakaoIcon />
          <span>카카오로 계속하기</span>
        </button>
      </form>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1Z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38Z"
      />
    </svg>
  );
}

function KakaoIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#3C1E1E"
        d="M12 3C6.48 3 2 6.48 2 10.77c0 2.77 1.86 5.2 4.65 6.57-.2.72-.74 2.66-.85 3.07-.13.51.19.5.4.37.16-.11 2.6-1.77 3.66-2.49.7.1 1.42.16 2.14.16 5.52 0 10-3.48 10-7.65C22 6.48 17.52 3 12 3Z"
      />
    </svg>
  );
}
