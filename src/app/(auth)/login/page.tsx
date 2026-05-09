import { AuthForm } from "@/components/auth/auth-form";

export default function LoginPage() {
  return (
    <div className="space-y-3">
      <h1 className="text-center text-2xl font-semibold tracking-tight">
        HAN OPS
      </h1>
      <p className="text-center text-sm text-muted-foreground">
        Google 계정으로 로그인합니다.
      </p>
      <AuthForm />
    </div>
  );
}
